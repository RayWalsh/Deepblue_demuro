# ==============================================
# ⏳ timebars.py — Timebar Notices + Todos (Milestone 1)
# ==============================================
from flask import Blueprint, request, jsonify
from sqlalchemy import text
from datetime import timedelta, datetime

timebars_bp = Blueprint("timebars_bp", __name__)

# ---------------- Helpers ----------------

def parse_offsets(offset_str: str):
    if not offset_str:
        return []
    parts = [p.strip() for p in offset_str.split(",") if p.strip()]
    offsets = []
    for p in parts:
        try:
            n = int(p)
            if n >= 0:
                offsets.append(n)
        except ValueError:
            continue
    return sorted(list(set(offsets)), reverse=True)

def merge_template(subject: str, body: str, context: dict):
    subject = subject or ""
    body = body or ""

    for key, value in context.items():
        token = f"{{{{{key}}}}}"
        subject = subject.replace(token, str(value or ""))
        body = body.replace(token, str(value or ""))

    return subject, body

def upsert_missing_voyage_end_todo(conn, case_id: int, has_voyage_end: bool):
    todo_type = "MISSING_VOYAGE_END_DATE"
    title = "⚠ Voyage End Date is empty — timebar reminders can’t be scheduled"

    if not has_voyage_end:
        conn.execute(text("""
            IF NOT EXISTS (
              SELECT 1 FROM dbo.CaseTodos
              WHERE CaseID=:CaseID AND Type=:Type AND Status='OPEN'
            )
            INSERT INTO dbo.CaseTodos (CaseID, Type, Title, Status, DueDate, MetaKey)
            VALUES (:CaseID, :Type, :Title, 'OPEN', NULL, 'MISSING_VOYAGE_END_DATE');
        """), {"CaseID": case_id, "Type": todo_type, "Title": title})
    else:
        conn.execute(text("""
            UPDATE dbo.CaseTodos
            SET Status='DISMISSED', UpdatedAt=SYSUTCDATETIME()
            WHERE CaseID=:CaseID AND Type=:Type AND Status='OPEN';
        """), {"CaseID": case_id, "Type": todo_type})

def recalc_case_timebars(conn, case_id: int, org_id: int, voyage_end_col: str = "VoyageEndDate"):
    """
    Recalculate timebar expiry dates and reminder todos for a case.
    Uses TemplateAssignments first, falling back to NoticeTypes.TemplateID.
    """

    # ------------------------------------------------
    # 1️⃣ Get VoyageEndDate
    # ------------------------------------------------
    row = conn.execute(text(f"""
        SELECT CaseID, {voyage_end_col} AS VoyageEndDate
        FROM dbo.Cases
        WHERE CaseID = :CaseID
    """), {"CaseID": case_id}).fetchone()

    if not row:
        return {"ok": False, "error": "Case not found"}

    voyage_end = row._mapping.get("VoyageEndDate")
    has_voyage_end = voyage_end is not None

    upsert_missing_voyage_end_todo(conn, case_id, has_voyage_end)

    if not has_voyage_end:

        conn.execute(text("""
            UPDATE dbo.CaseTodos
            SET Status='DISMISSED', UpdatedAt=SYSUTCDATETIME()
            WHERE CaseID=:CaseID
              AND Type='TIMEBAR_REMINDER'
              AND Status='OPEN';
        """), {"CaseID": case_id})

        conn.execute(text("""
            UPDATE dbo.CaseNotices
            SET ExpiryDate = NULL,
                UpdatedAt = SYSUTCDATETIME()
            WHERE CaseID=:CaseID;
        """), {"CaseID": case_id})

        return {"ok": True, "scheduled": 0, "reason": "VoyageEndDate missing"}

    # Normalize datetime → date
    if isinstance(voyage_end, datetime):
        voyage_end = voyage_end.date()

    # ------------------------------------------------
    # 2️⃣ Load case notices
    # ------------------------------------------------
    notices = conn.execute(text("""
        SELECT
            cn.CaseNoticeID,
            cn.TimebarDaysSnapshot,
            cn.ReminderOffsetsSnapshot,
            cn.IsEnabled,
            nt.Name AS NoticeTypeName,

            ta.TemplateID AS AssignedTemplateID,
            nt.TemplateID AS NoticeTypeTemplateID

        FROM dbo.CaseNotices cn

        JOIN dbo.NoticeTypes nt
            ON nt.NoticeTypeID = cn.NoticeTypeID

        LEFT JOIN dbo.TemplateAssignments ta
            ON ta.AssignmentKey = 'TIMEBAR_REMINDER'
            AND ta.OrgID = :OrgID
            AND ta.IsActive = 1

        WHERE cn.CaseID = :CaseID
    """), {
        "CaseID": case_id,
        "OrgID": org_id
    }).fetchall()

    scheduled = 0

    # ------------------------------------------------
    # 3️⃣ Process notices
    # ------------------------------------------------
    for n in notices:

        m = n._mapping

        case_notice_id = m["CaseNoticeID"]
        enabled = bool(m["IsEnabled"])
        notice_name = m["NoticeTypeName"]

        template_id = (
            m.get("AssignedTemplateID")
            or m.get("NoticeTypeTemplateID")
        )

        timebar_days = int(m["TimebarDaysSnapshot"])
        offsets = parse_offsets(m["ReminderOffsetsSnapshot"])

        # Disable reminders if notice disabled
        if not enabled:

            conn.execute(text("""
                UPDATE dbo.CaseTodos
                SET Status='DISMISSED',
                    UpdatedAt=SYSUTCDATETIME()
                WHERE CaseID=:CaseID
                  AND Type='TIMEBAR_REMINDER'
                  AND RelatedEntityType='CaseNotice'
                  AND RelatedEntityID=:CaseNoticeID
                  AND Status='OPEN';
            """), {
                "CaseID": case_id,
                "CaseNoticeID": case_notice_id
            })

            continue

        # ------------------------------------------------
        # 4️⃣ Calculate expiry
        # ------------------------------------------------
        expiry = voyage_end + timedelta(days=timebar_days)

        conn.execute(text("""
            UPDATE dbo.CaseNotices
            SET ExpiryDate=:ExpiryDate,
                UpdatedAt=SYSUTCDATETIME()
            WHERE CaseNoticeID=:CaseNoticeID
        """), {
            "ExpiryDate": expiry,
            "CaseNoticeID": case_notice_id
        })

        # ------------------------------------------------
        # 5️⃣ Create / update reminder todos
        # ------------------------------------------------
        for off in offsets:

            due = expiry - timedelta(days=off)

            display_name = (
                notice_name
                if str(notice_name).lower().endswith("notice")
                else f"{notice_name} Notice"
            )

            title = (
                f"Send {display_name} — {off} days before timebar "
                f"(timebar expires {expiry.isoformat()})"
            )

            meta = f"TIMEBAR:{case_notice_id}:OFFSET:{off}"

            updated = conn.execute(text("""
                UPDATE dbo.CaseTodos
                SET DueDate=:DueDate,
                    Title=:Title,
                    TemplateID=:TemplateID,
                    Status='OPEN',
                    UpdatedAt=SYSUTCDATETIME()
                WHERE CaseID=:CaseID
                  AND Type='TIMEBAR_REMINDER'
                  AND MetaKey=:MetaKey
            """), {
                "DueDate": due,
                "Title": title,
                "TemplateID": template_id,
                "CaseID": case_id,
                "MetaKey": meta
            }).rowcount

            if updated == 0:

                conn.execute(text("""
                    INSERT INTO dbo.CaseTodos
                        (CaseID, Type, Title, DueDate, Status,
                         RelatedEntityType, RelatedEntityID,
                         TemplateID, MetaKey)
                    VALUES
                        (:CaseID, 'TIMEBAR_REMINDER', :Title, :DueDate,
                         'OPEN', 'CaseNotice', :CaseNoticeID,
                         :TemplateID, :MetaKey)
                """), {
                    "CaseID": case_id,
                    "Title": title,
                    "DueDate": due,
                    "CaseNoticeID": case_notice_id,
                    "TemplateID": template_id,
                    "MetaKey": meta
                })

                scheduled += 1

    return {"ok": True, "scheduled": scheduled}

# ---------------- Routes ----------------

@timebars_bp.route("/api/timebars/notice-types", methods=["GET"])
def get_notice_types():
    from app import get_db_connection, login_required

    @login_required
    def inner():
        org_id = int(request.args.get("org_id", 1))
        with get_db_connection() as conn:
            rows = conn.execute(text("""
                SELECT NoticeTypeID, OrgID, Name, TimebarDays, ReminderOffsets, TemplateID, IsActive
                FROM dbo.NoticeTypes
                WHERE OrgID=:OrgID AND IsActive=1
                ORDER BY Name ASC
            """), {"OrgID": org_id}).fetchall()
        return jsonify([dict(r._mapping) for r in rows])

    return inner()

@timebars_bp.route("/api/timebars/cases/<int:case_id>/notices", methods=["POST"])
def add_notice_to_case(case_id):
    from app import get_db_connection, login_required

    @login_required
    def inner():
        payload = request.get_json(force=True) or {}

        org_id = int(payload.get("OrgID", 1))
        notice_type_id = payload.get("NoticeTypeID")

        if not notice_type_id:
            return jsonify({"ok": False, "error": "NoticeTypeID is required"}), 400

        notice_type_id = int(notice_type_id)

        with get_db_connection() as conn:

            # 🔎 1️⃣ Load NoticeType defaults
            nt = conn.execute(text("""
                SELECT NoticeTypeID,
                       Name,
                       TimebarDays,
                       COALESCE(
                           ReminderOffsets,
                           (SELECT DefaultReminderOffsets
                            FROM dbo.OrgSettings
                            WHERE OrgID=:OrgID)
                       ) AS ReminderOffsetsResolved
                FROM dbo.NoticeTypes
                WHERE NoticeTypeID=:NoticeTypeID
                  AND OrgID=:OrgID
                  AND IsActive=1
            """), {
                "NoticeTypeID": notice_type_id,
                "OrgID": org_id
            }).fetchone()

            if not nt:
                return jsonify({"ok": False, "error": "NoticeType not found"}), 404

            m = nt._mapping
            timebar_days = int(m["TimebarDays"])
            offsets = m["ReminderOffsetsResolved"] or "45,30,15,10,5,1"

            # 🔁 2️⃣ Insert or update CaseNotice (idempotent)
            existing = conn.execute(text("""
                SELECT CaseNoticeID
                FROM dbo.CaseNotices
                WHERE CaseID=:CaseID AND NoticeTypeID=:NoticeTypeID
            """), {
                "CaseID": case_id,
                "NoticeTypeID": notice_type_id
            }).fetchone()

            if not existing:
                conn.execute(text("""
                    INSERT INTO dbo.CaseNotices
                      (CaseID, NoticeTypeID, TimebarDaysSnapshot,
                       ReminderOffsetsSnapshot, IsEnabled)
                    VALUES
                      (:CaseID, :NoticeTypeID, :Days, :Offsets, 1)
                """), {
                    "CaseID": case_id,
                    "NoticeTypeID": notice_type_id,
                    "Days": timebar_days,
                    "Offsets": offsets
                })
            else:
                conn.execute(text("""
                    UPDATE dbo.CaseNotices
                    SET TimebarDaysSnapshot=:Days,
                        ReminderOffsetsSnapshot=:Offsets,
                        UpdatedAt=SYSUTCDATETIME()
                    WHERE CaseID=:CaseID AND NoticeTypeID=:NoticeTypeID
                """), {
                    "CaseID": case_id,
                    "NoticeTypeID": notice_type_id,
                    "Days": timebar_days,
                    "Offsets": offsets
                })

            # 🔄 3️⃣ Recalculate expiry + reminders
            result = recalc_case_timebars(
                conn,
                case_id,
                org_id,
                voyage_end_col="VoyageEndDate"
            )

            conn.commit()

        return jsonify(result)

    return inner()

@timebars_bp.route("/api/timebars/cases/<int:case_id>/recalc", methods=["POST"])
def recalc_case(case_id):
    from app import get_db_connection, login_required

    @login_required
    def inner():
        payload = request.get_json(force=True) or {}
        org_id = int(payload.get("OrgID", 1))

        # 🔒 lock down column name
        voyage_end_col = "VoyageEndDate"

        with get_db_connection() as conn:
            result = recalc_case_timebars(conn, case_id, org_id, voyage_end_col)
            conn.commit()

        return jsonify(result)

    return inner()

@timebars_bp.route("/api/todos", methods=["GET"])
def get_todos():
    from app import get_db_connection, login_required

    @login_required
    def inner():
        status = (request.args.get("status") or "OPEN").upper()
        due_before = request.args.get("due_before")
        todo_type = request.args.get("type")

        sql = """
          SELECT TodoID, CaseID, Type, Title, DueDate, Status, RelatedEntityType, RelatedEntityID, TemplateID, MetaKey
          FROM dbo.CaseTodos
          WHERE Status = :Status
        """
        params = {"Status": status}

        if todo_type:
            sql += " AND Type = :Type"
            params["Type"] = todo_type

        if due_before:
            sql += " AND DueDate <= :DueBefore"
            params["DueBefore"] = due_before

        sql += " ORDER BY CASE WHEN DueDate IS NULL THEN 1 ELSE 0 END, DueDate ASC"

        with get_db_connection() as conn:
            rows = conn.execute(text(sql), params).fetchall()

        return jsonify([dict(r._mapping) for r in rows])

    return inner()

@timebars_bp.route("/api/timebars/cases/<int:case_id>/notices", methods=["GET"])
def get_case_notices(case_id):
    from app import get_db_connection, login_required

    @login_required
    def inner():
        with get_db_connection() as conn:
            rows = conn.execute(text("""
                SELECT
                  cn.CaseNoticeID,
                  cn.CaseID,
                  cn.IsEnabled,
                  cn.TimebarDaysSnapshot,
                  cn.ReminderOffsetsSnapshot,
                  cn.ExpiryDate,
                  nt.Name AS NoticeTypeName
                FROM dbo.CaseNotices cn
                JOIN dbo.NoticeTypes nt ON nt.NoticeTypeID = cn.NoticeTypeID
                WHERE cn.CaseID = :CaseID
                ORDER BY nt.Name ASC
            """), {"CaseID": case_id}).fetchall()

        return jsonify([dict(r._mapping) for r in rows])

    return inner()


@timebars_bp.route("/api/timebars/cases/<int:case_id>/todos", methods=["GET"])
def get_case_todos(case_id):
    from app import get_db_connection, login_required
    from sqlalchemy import text

    @login_required
    def inner():
        include_done = str(request.args.get("include_done", "0")).lower() in ("1", "true", "yes")
        include_dismissed = str(request.args.get("include_dismissed", "0")).lower() in ("1", "true", "yes")

        statuses = ["OPEN"]
        if include_done:
            statuses.append("DONE")
        if include_dismissed:
            statuses.append("DISMISSED")

        # build an IN list safely
        status_params = {f"s{i}": s for i, s in enumerate(statuses)}
        status_in = ", ".join(f":s{i}" for i in range(len(statuses)))

        sql = f"""
            SELECT
                t.TodoID,
                t.CaseID,
                t.Type,
                t.Title,
                t.DueDate,
                t.Status,
                t.MetaKey,
                t.CompletedAt,
                t.CompletedByUserID,
                u.Username AS CompletedByName,
                t.CompletionNote
            FROM dbo.CaseTodos t
            LEFT JOIN dbo.UsersSecure u
                ON u.UserID = t.CompletedByUserID
            WHERE t.CaseID = :CaseID
            AND t.Status IN ({status_in})
            AND t.Type IN ('TIMEBAR_REMINDER', 'MISSING_VOYAGE_END_DATE')
            ORDER BY
            CASE WHEN t.DueDate IS NULL THEN 1 ELSE 0 END,
            t.DueDate ASC,
            t.TodoID ASC
        """

        with get_db_connection() as conn:
            rows = conn.execute(text(sql), {"CaseID": case_id, **status_params}).fetchall()

        return jsonify([dict(r._mapping) for r in rows])

    return inner()


@timebars_bp.route("/api/timebars/case-notices/<int:case_notice_id>", methods=["PATCH"])
def update_case_notice(case_notice_id):
    from app import get_db_connection, login_required

    @login_required
    def inner():
        payload = request.get_json(force=True) or {}
        is_enabled = payload.get("IsEnabled")
        if is_enabled is None:
            return jsonify({"ok": False, "error": "IsEnabled required"}), 400

        with get_db_connection() as conn:
            conn.execute(text("""
                UPDATE dbo.CaseNotices
                SET IsEnabled=:IsEnabled, UpdatedAt=SYSUTCDATETIME()
                WHERE CaseNoticeID=:ID
            """), {"IsEnabled": 1 if bool(is_enabled) else 0, "ID": case_notice_id})

            # Find case_id + org_id for recalc
            row = conn.execute(text("""
                SELECT cn.CaseID, nt.OrgID
                FROM dbo.CaseNotices cn
                JOIN dbo.NoticeTypes nt ON nt.NoticeTypeID = cn.NoticeTypeID
                WHERE cn.CaseNoticeID=:ID
            """), {"ID": case_notice_id}).fetchone()

            if row:
                recalc_case_timebars(conn, row._mapping["CaseID"], row._mapping["OrgID"], "VoyageEndDate")

            conn.commit()

        return jsonify({"ok": True})

    return inner()


@timebars_bp.route("/api/timebars/case-notices/<int:case_notice_id>", methods=["DELETE"])
def delete_case_notice(case_notice_id):
    from app import get_db_connection, login_required

    @login_required
    def inner():
        with get_db_connection() as conn:
            # Grab CaseID first to dismiss related todos
            row = conn.execute(text("""
                SELECT CaseID
                FROM dbo.CaseNotices
                WHERE CaseNoticeID=:ID
            """), {"ID": case_notice_id}).fetchone()

            case_id = row._mapping["CaseID"] if row else None

            # Dismiss related todos
            conn.execute(text("""
                UPDATE dbo.CaseTodos
                SET Status='DISMISSED', UpdatedAt=SYSUTCDATETIME()
                WHERE RelatedEntityType='CaseNotice'
                  AND RelatedEntityID=:ID
                  AND Status='OPEN'
            """), {"ID": case_notice_id})

            # Delete notice
            conn.execute(text("""
                DELETE FROM dbo.CaseNotices
                WHERE CaseNoticeID=:ID
            """), {"ID": case_notice_id})

            # Recalc (optional) if we still have case_id
            if case_id:
                recalc_case_timebars(conn, case_id, org_id=1, voyage_end_col="VoyageEndDate")

            conn.commit()

        return jsonify({"ok": True})

    return inner()



@timebars_bp.route("/api/timebars/todos/<int:todo_id>", methods=["PATCH"])
def update_case_todo(todo_id):
    from app import get_db_connection, login_required
    from flask import session
    from flask import current_app

    @login_required
    def inner():
        payload = request.get_json(silent=True) or {}

        # accept Status or status
        raw_status = payload.get("Status", payload.get("status", ""))
        status = str(raw_status).upper().strip()

        note = payload.get("CompletionNote", payload.get("completionNote"))

        current_app.logger.info(f"[update_case_todo] TodoID={todo_id} payload={payload} parsed_status={status}")

        if status not in ("OPEN", "DONE", "DISMISSED"):
            return jsonify({"ok": False, "error": f"Invalid Status: {raw_status}"}), 400

        user_id = session.get("user_id")
        if status == "DONE" and not user_id:
            return jsonify({"ok": False, "error": "No user_id in session. Please log out and log back in."}), 401

        with get_db_connection() as conn:
            if status == "DONE":
                conn.execute(text("""
                    UPDATE dbo.CaseTodos
                    SET Status='DONE',
                        CompletedAt=SYSUTCDATETIME(),
                        CompletedByUserID=:UserID,
                        CompletionNote=:Note,
                        UpdatedAt=SYSUTCDATETIME()
                    WHERE TodoID=:TodoID;
                """), {"TodoID": todo_id, "UserID": user_id, "Note": note})
            else:
                conn.execute(text("""
                    UPDATE dbo.CaseTodos
                    SET Status=:Status,
                        CompletedAt=NULL,
                        CompletedByUserID=NULL,
                        CompletionNote=NULL,
                        UpdatedAt=SYSUTCDATETIME()
                    WHERE TodoID=:TodoID;
                """), {"TodoID": todo_id, "Status": status})

            conn.commit()

        return jsonify({"ok": True})

    return inner()

@timebars_bp.route("/api/timebars/todos/<int:todo_id>/generate", methods=["GET"])
def generate_notice_from_todo(todo_id):
    from app import get_db_connection, login_required
    from flask import session
    from datetime import datetime

    @login_required
    def inner():
        org_id = 1  # TODO: replace with session org later

        with get_db_connection() as conn:

            # 1️⃣ Load Todo + Case + NoticeType
            todo = conn.execute(text("""
                SELECT
                    t.TodoID,
                    t.CaseID,
                    t.TemplateID AS TodoTemplateID,
                    cn.CaseNoticeID,
                    cn.ExpiryDate,
                    nt.Name AS NoticeTypeName,
                    nt.TemplateID AS NoticeTypeTemplateID,
                    c.VesselName,
                    c.CharterersName AS ChartererName,
                    c.VoyageEndDate,
                    c.DeepBlueRef
                FROM dbo.CaseTodos t
                LEFT JOIN dbo.CaseNotices cn
                    ON cn.CaseNoticeID = t.RelatedEntityID
                LEFT JOIN dbo.NoticeTypes nt
                    ON nt.NoticeTypeID = cn.NoticeTypeID
                LEFT JOIN dbo.Cases c
                    ON c.CaseID = t.CaseID
                WHERE t.TodoID = :TodoID
            """), {"TodoID": todo_id}).fetchone()

            if not todo:
                return jsonify({"ok": False, "error": "Todo not found"}), 404

            m = todo._mapping

            # 2️⃣ Determine template (Todo first, then NoticeType fallback)
            template_id = m.get("TodoTemplateID") or m.get("NoticeTypeTemplateID")

            if not template_id:
                return jsonify({
                    "ok": False,
                    "error": "No template linked (Todo.TemplateID and NoticeType.TemplateID are both NULL)"
                }), 400

            # 3️⃣ Load Template
            template = conn.execute(text("""
                SELECT TemplateID, Name, Subject, Body
                FROM dbo.Templates
                WHERE TemplateID = :TemplateID
                  AND OrgID = :OrgID
                  AND IsActive = 1
            """), {
                "TemplateID": int(template_id),
                "OrgID": org_id
            }).fetchone()

            if not template:
                return jsonify({"ok": False, "error": "Template not found"}), 404

            t = template._mapping

            # 4️⃣ Normalize date/datetime safely
            expiry = m.get("ExpiryDate")
            voyage_end = m.get("VoyageEndDate")

            expiry_date = expiry.date() if isinstance(expiry, datetime) else expiry
            voyage_end_date = voyage_end.date() if isinstance(voyage_end, datetime) else voyage_end

            # 5️⃣ Pretty date formatter
            def fmt(d):
                return d.strftime("%d %b %Y") if d else ""

            # 6️⃣ Merge context
            context = {
                "VesselName": m.get("VesselName"),
                "ChartererName": m.get("ChartererName"),
                "VoyageEndDate": fmt(voyage_end_date),
                "TimebarExpiryDate": fmt(expiry_date),
                "NoticeTypeName": m.get("NoticeTypeName"),
                "Today": fmt(datetime.utcnow().date()),
                "CaseRef": m.get("DeepBlueRef"),
            }

            # 7️⃣ Merge template tokens
            subject, body = merge_template(
                t.get("Subject"),
                t.get("Body"),
                context
            )

        return jsonify({
            "ok": True,
            "subject": subject,
            "body": body
        })

    return inner()
