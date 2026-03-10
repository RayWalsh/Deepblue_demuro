# ==============================================
# ✉️ templates.py — Email Template CRUD
# ==============================================

from flask import Blueprint, request, jsonify
from sqlalchemy import text


templates_bp = Blueprint("templates_bp", __name__)


# =========================================================
# GET ALL TEMPLATES
# =========================================================

@templates_bp.route("/api/templates", methods=["GET"])
def get_templates():

    from app import get_db_connection, login_required

    @login_required
    def inner():

        try:

            with get_db_connection() as conn:

                result = conn.execute(text("""
                    SELECT
                        TemplateID,
                        OrgID,
                        Name,
                        Category,
                        Subject,
                        Body,
                        CreatedAt,
                        IsActive
                    FROM dbo.Templates
                    WHERE IsActive = 1
                    ORDER BY Name
                """))

                rows = [dict(r._mapping) for r in result.fetchall()]

            return jsonify({
                "success": True,
                "count": len(rows),
                "templates": rows
            })

        except Exception as e:

            print("❌ Template fetch error:", e)

            return jsonify({
                "success": False,
                "error": str(e)
            }), 500

    return inner()


# =========================================================
# CREATE TEMPLATE
# =========================================================

@templates_bp.route("/api/templates", methods=["POST"])
def create_template():

    from app import get_db_connection, login_required

    @login_required
    def inner():

        payload = request.get_json(force=True) or {}

        org_id = int(payload.get("OrgID", 1))
        name = (payload.get("Name") or "").strip()
        category = payload.get("Category")
        subject = payload.get("Subject")
        body = payload.get("Body")

        if not name:
            return jsonify({"success": False, "error": "Name required"}), 400

        if not body:
            return jsonify({"success": False, "error": "Body required"}), 400

        try:

            with get_db_connection() as conn:

                row = conn.execute(text("""
                    INSERT INTO dbo.Templates
                    (OrgID, Name, Category, Subject, Body, IsActive)
                    OUTPUT INSERTED.TemplateID
                    VALUES
                    (:OrgID, :Name, :Category, :Subject, :Body, 1)
                """), {
                    "OrgID": org_id,
                    "Name": name,
                    "Category": category,
                    "Subject": subject,
                    "Body": body
                }).fetchone()

                conn.commit()

            return jsonify({
                "success": True,
                "TemplateID": int(row[0])
            })

        except Exception as e:

            print("❌ Template create error:", e)

            return jsonify({
                "success": False,
                "error": str(e)
            }), 500

    return inner()


# =========================================================
# UPDATE TEMPLATE
# =========================================================

@templates_bp.route("/api/templates/<int:template_id>", methods=["PATCH"])
def update_template(template_id):

    from app import get_db_connection, login_required

    @login_required
    def inner():

        payload = request.get_json(force=True) or {}

        org_id = int(payload.get("OrgID", 1))

        name = payload.get("Name")
        category = payload.get("Category")
        subject = payload.get("Subject")
        body = payload.get("Body")
        is_active = payload.get("IsActive")

        sets = []
        params = {
            "TemplateID": template_id,
            "OrgID": org_id
        }

        if name is not None:
            sets.append("Name = :Name")
            params["Name"] = str(name).strip()

        if category is not None:
            sets.append("Category = :Category")
            params["Category"] = category

        if subject is not None:
            sets.append("Subject = :Subject")
            params["Subject"] = subject

        if body is not None:
            sets.append("Body = :Body")
            params["Body"] = body

        if is_active is not None:
            sets.append("IsActive = :IsActive")
            params["IsActive"] = 1 if bool(is_active) else 0

        if not sets:
            return jsonify({"success": False, "error": "Nothing to update"}), 400

        try:

            sql = f"""
                UPDATE dbo.Templates
                SET {", ".join(sets)}
                WHERE TemplateID = :TemplateID
                AND OrgID = :OrgID
            """

            with get_db_connection() as conn:

                rc = conn.execute(text(sql), params).rowcount
                conn.commit()

            if rc == 0:
                return jsonify({"success": False, "error": "Template not found"}), 404

            return jsonify({"success": True})

        except Exception as e:

            print("❌ Template update error:", e)

            return jsonify({
                "success": False,
                "error": str(e)
            }), 500

    return inner()


# =========================================================
# DELETE TEMPLATE
# =========================================================

@templates_bp.route("/api/templates/<int:template_id>", methods=["DELETE"])
def delete_template(template_id):

    from app import get_db_connection, login_required

    @login_required
    def inner():

        org_id = int(request.args.get("org_id", 1))

        try:

            with get_db_connection() as conn:

                rc = conn.execute(text("""
                    UPDATE dbo.Templates
                    SET IsActive = 0
                    WHERE TemplateID = :TemplateID
                    AND OrgID = :OrgID
                """), {
                    "TemplateID": template_id,
                    "OrgID": org_id
                }).rowcount

                conn.commit()

            if rc == 0:
                return jsonify({"success": False, "error": "Template not found"}), 404

            return jsonify({"success": True})

        except Exception as e:

            print("❌ Template delete error:", e)

            return jsonify({
                "success": False,
                "error": str(e)
            }), 500

    return inner()

# =========================================================
# CLONE TEMPLATE
# =========================================================

@templates_bp.route("/api/templates/<int:template_id>/clone", methods=["POST"])
def clone_template(template_id):

    from app import get_db_connection, login_required

    @login_required
    def inner():

        org_id = int(request.args.get("org_id", 1))

        try:

            with get_db_connection() as conn:

                # Get original template
                original = conn.execute(text("""
                    SELECT
                        Name,
                        Category,
                        Subject,
                        Body
                    FROM dbo.Templates
                    WHERE TemplateID = :TemplateID
                    AND OrgID = :OrgID
                    AND IsActive = 1
                """), {
                    "TemplateID": template_id,
                    "OrgID": org_id
                }).fetchone()

                if not original:
                    return jsonify({
                        "success": False,
                        "error": "Template not found"
                    }), 404

                new_name = f"{original.Name} (Copy)"

                # Insert clone
                row = conn.execute(text("""
                    INSERT INTO dbo.Templates
                    (OrgID, Name, Category, Subject, Body, IsActive)
                    OUTPUT INSERTED.TemplateID
                    VALUES
                    (:OrgID, :Name, :Category, :Subject, :Body, 1)
                """), {
                    "OrgID": org_id,
                    "Name": new_name,
                    "Category": original.Category,
                    "Subject": original.Subject,
                    "Body": original.Body
                }).fetchone()

                conn.commit()

            return jsonify({
                "success": True,
                "TemplateID": int(row[0])
            })

        except Exception as e:

            print("❌ Template clone error:", e)

            return jsonify({
                "success": False,
                "error": str(e)
            }), 500

    return inner()

# =====================================================
# GET SINGLE TEMPLATE
# =====================================================

@templates_bp.route("/api/templates/<int:template_id>", methods=["GET"])
def get_template(template_id):

    from app import get_db_connection, login_required

    @login_required
    def inner():

        try:

            with get_db_connection() as conn:

                result = conn.execute(text("""
                    SELECT
                        TemplateID,
                        OrgID,
                        Name,
                        Category,
                        Subject,
                        Body,
                        IsActive,
                        CreatedAt
                    FROM dbo.Templates
                    WHERE TemplateID = :id
                    AND IsActive = 1
                """), {"id": template_id})

                row = result.fetchone()

                if not row:
                    return jsonify({
                        "success": False,
                        "error": "Template not found"
                    }), 404

                template = dict(row._mapping)

            return jsonify({
                "success": True,
                "template": template
            })

        except Exception as e:

            print("❌ Template fetch error:", e)

            return jsonify({
                "success": False,
                "error": str(e)
            }), 500

    return inner()


# =========================================================
# TEMPLATE ASSIGNMENTS
# =========================================================

@templates_bp.route("/api/template-assignments", methods=["GET"])
def get_template_assignments():

    from app import get_db_connection, login_required

    @login_required
    def inner():

        org_id = int(request.args.get("org_id", 1))

        with get_db_connection() as conn:

            rows = conn.execute(text("""
                SELECT
                    ta.AssignmentID,
                    ta.AssignmentKey,
                    ta.AssignmentLabel,
                    ta.TemplateID,
                    t.Name AS TemplateName
                FROM dbo.TemplateAssignments ta
                LEFT JOIN dbo.Templates t
                    ON t.TemplateID = ta.TemplateID
                WHERE ta.OrgID = :OrgID
                AND ta.IsActive = 1
                ORDER BY ta.AssignmentLabel
            """), {"OrgID": org_id}).fetchall()

        return jsonify({
            "success": True,
            "assignments": [dict(r._mapping) for r in rows]
        })

    return inner()


# =========================================================
# UPDATE TEMPLATE ASSIGNMENT
# =========================================================

@templates_bp.route("/api/template-assignments/<int:assignment_id>", methods=["PATCH"])
def update_template_assignment(assignment_id):

    from app import get_db_connection, login_required

    @login_required
    def inner():

        payload = request.get_json(force=True) or {}

        template_id = payload.get("TemplateID")
        org_id = int(payload.get("OrgID", 1))

        with get_db_connection() as conn:

            conn.execute(text("""
                UPDATE dbo.TemplateAssignments
                SET TemplateID = :TemplateID,
                    UpdatedAt = SYSUTCDATETIME()
                WHERE AssignmentID = :AssignmentID
                AND OrgID = :OrgID
            """), {
                "TemplateID": template_id,
                "AssignmentID": assignment_id,
                "OrgID": org_id
            })

            conn.commit()

        return jsonify({"success": True})

    return inner()