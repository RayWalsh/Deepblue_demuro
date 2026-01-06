# case.py
from flask import Blueprint, render_template, request, jsonify, session
from sqlalchemy import text
from utils import get_db_connection, login_required
from datetime import date, datetime

case_bp = Blueprint("case_bp", __name__)

# ==================================================
# 🔧 HELPERS
# ==================================================

def get_editable_case_fields(conn):
    """
    Returns a set of column names that are editable,
    derived from dbo.ColumnMeta (single source of truth).
    """
    result = conn.execute(
        text("""
            SELECT ColumnName
            FROM dbo.ColumnMeta
            WHERE IsEditable = 1
        """)
    )
    return {row.ColumnName for row in result.fetchall()}


# ==================================================
# 📄 VIEW CASE (LEGACY / SIMPLE)
# ==================================================

@case_bp.route("/case/<int:case_id>")
@login_required
def view_case(case_id):
    try:
        with get_db_connection() as conn:
            result = conn.execute(
                text("SELECT * FROM dbo.Cases WHERE CaseID = :id"),
                {"id": case_id}
            )
            row = result.fetchone()

            if not row:
                return render_template(
                    "case.html",
                    error="Case not found",
                    case_id=case_id
                )

            case = dict(row._mapping)

        return render_template("case.html", case=case)

    except Exception as e:
        print(f"❌ Error fetching case {case_id}:", e)
        return render_template(
            "case.html",
            error="Database error",
            case_id=case_id
        )


# ==================================================
# 📊 CASE DASHBOARD (NEW UI)
# ==================================================

@case_bp.route("/case-dashboard/<int:case_id>")
@login_required
def case_dashboard(case_id):
    try:
        with get_db_connection() as conn:
            result = conn.execute(
                text("SELECT * FROM dbo.Cases WHERE CaseID = :id"),
                {"id": case_id}
            )
            row = result.fetchone()

            if not row:
                return render_template(
                    "case-dashboard.html",
                    error="Case not found",
                    case_id=case_id
                )

            case = dict(row._mapping)

            # -----------------------------
            # Days Open (Claim)
            # -----------------------------
            claim_filed = case.get("ClaimFiled")
            agreed_date = case.get("AgreedDate")

            days_open = None

            if claim_filed:
                start = claim_filed.date() if isinstance(claim_filed, datetime) else claim_filed
                end = (
                    agreed_date.date()
                    if agreed_date
                    else date.today()
                )
                days_open = (end - start).days

            case["DaysOpen"] = days_open

        return render_template("case-dashboard.html", case=case)

    except Exception as e:
        print(f"❌ Error fetching case {case_id}:", e)
        return render_template(
            "case-dashboard.html",
            error="Database error",
            case_id=case_id
        )


# ==================================================
# 📦 CASE JSON (CLIENT USE)
# ==================================================

@case_bp.route("/api/case/<int:case_id>", methods=["GET"])
@login_required
def get_case_json(case_id):
    try:
        with get_db_connection() as conn:
            result = conn.execute(
                text("SELECT * FROM dbo.Cases WHERE CaseID = :id"),
                {"id": case_id}
            )
            row = result.fetchone()

            if not row:
                return jsonify({
                    "success": False,
                    "error": "Case not found"
                }), 404

            return jsonify({
                "success": True,
                "case": dict(row._mapping)
            })

    except Exception as e:
        print("❌ Error loading case JSON:", e)
        return jsonify({
            "success": False,
            "error": "Database error"
        }), 500


# ==================================================
# 🧩 CASE METADATA (UI STRUCTURE)
# ==================================================

@case_bp.route("/api/case-metadata", methods=["GET"])
@login_required
def get_case_metadata():
    try:
        with get_db_connection() as conn:
            result = conn.execute(text("""
                SELECT
                    ColumnName,
                    DisplayName,
                    GroupName,
                    GroupOrder,
                    FieldOrder,
                    FieldType,
                    IsEditable,
                    IsVisible,
                    LookupTable
                FROM dbo.ColumnMeta
                WHERE IsVisible = 1
                ORDER BY GroupOrder ASC, FieldOrder ASC
            """))

            rows = result.fetchall()
            metadata = [dict(row._mapping) for row in rows]

        return jsonify({
            "success": True,
            "columns": metadata
        })

    except Exception as e:
        print("❌ Error loading case metadata:", e)
        return jsonify({
            "success": False,
            "error": "Failed to load case metadata"
        }), 500


# ==================================================
# ✏️ UPDATE CASE (SIDE MODAL SAVE)
# ==================================================

@case_bp.route('/update-case/<int:case_id>', methods=['POST'])
@login_required
def update_case(case_id):
    print("🟡 update_case called (case_bp)")
    payload = request.get_json() or {}
    print(f"🟡 CaseID: {case_id}")
    print(f"🟡 Incoming payload: {payload}")

    # Try to read editable columns from metadata; if table missing, fall back to payload keys
    try:
        with get_db_connection() as conn:
            rows = conn.execute(text("SELECT ColumnName FROM dbo.ColumnMeta WHERE IsEditable = 1")).fetchall()
            editable_cols = {r[0] for r in rows}
    except Exception as e:
        print("⚠️ CaseMetadata lookup failed, falling back to payload keys:", e)
        editable_cols = set(payload.keys())

    # Validate column names to avoid SQL injection (letters, numbers, underscore)
    import re
    valid_name = re.compile(r'^[A-Za-z0-9_]+$')

    updates = {k: v for k, v in payload.items() if isinstance(k, str) and valid_name.match(k) and k in editable_cols}
    if not updates:
        return jsonify(success=True, message="No changes"), 200

    set_clause = ", ".join(f"[{k}] = :{k}" for k in updates.keys())
    sql = text(f"UPDATE Cases SET {set_clause} WHERE CaseID = :case_id")
    params = {**updates, "case_id": case_id}

    try:
        with get_db_connection() as conn:
            conn.execute(sql, params)
            conn.commit()
        return jsonify(success=True), 200
    except Exception as err:
        print(f"❌ Error updating case {case_id}:", err)
        try:
            with get_db_connection() as conn:
                conn.rollback()
        except Exception:
            pass
        return jsonify(success=False, error=str(err)), 500
    
    
# ==================================================
# 🧩 COLUMN METADATA (SINGLE COLUMN)
# ==================================================

@case_bp.route("/api/column-metadata/<column_name>", methods=["GET"])
@login_required
def get_column_metadata(column_name):
    try:
        with get_db_connection() as conn:
            meta_result = conn.execute(
                text("""
                    SELECT
                        ColumnName,
                        DisplayName,
                        FieldType,
                        GroupName,
                        IsEditable,
                        IsVisible
                    FROM dbo.ColumnMeta
                    WHERE ColumnName = :col
                """),
                {"col": column_name}
            )

            meta_row = meta_result.fetchone()
            if not meta_row:
                return jsonify({
                    "success": False,
                    "error": "Column not found"
                }), 404

            column = dict(meta_row._mapping)

            choices = []
            if column.get("FieldType") == "choice":
                choice_result = conn.execute(
                    text("""
                        SELECT
                            ChoiceValue AS Value,
                            DisplayOrder AS SortOrder,
                            IsActive
                        FROM dbo.ColumnChoices
                        WHERE ColumnName = :col
                        ORDER BY DisplayOrder ASC
                    """),
                    {"col": column_name}
                )

                choices = [dict(row._mapping) for row in choice_result.fetchall()]

        return jsonify({
            "success": True,
            "column": column,
            "choices": choices
        })

    except Exception as e:
        print(f"❌ Error loading column metadata for {column_name}:", e)
        return jsonify({
            "success": False,
            "error": "Failed to load column metadata"
        }), 500


# ==================================================
# 🧩 COLUMN CHOICES (LOOKUP)
# ==================================================

@case_bp.route("/api/column-choices/<column_name>", methods=["GET"])
@login_required
def get_column_choices(column_name):
    try:
        with get_db_connection() as conn:
            result = conn.execute(
                text("""
                    SELECT
                        ChoiceValue,
                        DisplayOrder
                    FROM dbo.ColumnChoices
                    WHERE ColumnName = :col
                      AND IsActive = 1
                    ORDER BY DisplayOrder ASC
                """),
                {"col": column_name}
            )

            choices = [row.ChoiceValue for row in result.fetchall()]

        return jsonify({
            "success": True,
            "column": column_name,
            "choices": choices
        })

    except Exception as e:
        print(f"❌ Error loading choices for {column_name}:", e)
        return jsonify({
            "success": False,
            "error": "Failed to load column choices"
        }), 500
    
@case_bp.route("/api/case/<int:case_id>/emails", methods=["GET"])
@login_required
def get_case_emails(case_id):
    """
    Temporary stub endpoint.
    Returns no emails yet.
    Locks in frontend contract.
    """
    return jsonify({
        "success": True,
        "items": []
    })

@case_bp.route("/api/case/<int:case_id>/emails", methods=["POST"])
@login_required
def attach_case_email(case_id):
    data = request.get_json() or {}

    outlook_link = data.get("OutlookLink")
    subject = data.get("Subject")
    from_address = data.get("FromAddress")
    direction = data.get("Direction")
    counterparty_role = data.get("CounterpartyRole")
    tag = data.get("Tag")

    if not outlook_link or not direction or not counterparty_role:
        return jsonify(
            success=False,
            error="Missing required fields"
        ), 400

    try:
        with get_db_connection() as conn:
            conn.execute(
                text("""
                    INSERT INTO dbo.CaseEmails (
                        CaseID,
                        OutlookLink,
                        Subject,
                        FromAddress,
                        Direction,
                        CounterpartyRole,
                        Tag,
                        CreatedBy
                    )
                    VALUES (
                        :case_id,
                        :outlook_link,
                        :subject,
                        :from_address,
                        :direction,
                        :counterparty_role,
                        :tag,
                        :created_by
                    )
                """),
                {
                    "case_id": case_id,
                    "outlook_link": outlook_link,
                    "subject": subject,
                    "from_address": from_address,
                    "direction": direction,
                    "counterparty_role": counterparty_role,
                    "tag": tag,
                    "created_by": session.get("username")
                }
            )
            conn.commit()

        return jsonify(success=True)

    except Exception as e:
        print("❌ Attach email error:", e)
        return jsonify(
            success=False,
            error="Failed to attach email"
        ), 500