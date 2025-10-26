# ==============================================
# ⚙️ settings_bp.py — Ledger Settings API
# ==============================================
from flask import Blueprint, jsonify, request
from sqlalchemy import text

settings_bp = Blueprint("settings_bp", __name__)

# -------------------------------
# 🧱 API — Get All Columns
# -------------------------------
@settings_bp.route("/api/case-columns", methods=["GET"])
def get_case_columns():
    from app import get_db_connection, login_required

    @login_required
    def inner():
        try:
            with get_db_connection() as conn:
                result = conn.execute(text("""
                    SELECT COLUMN_NAME AS name, DATA_TYPE AS type
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_NAME = 'Cases'
                    ORDER BY ORDINAL_POSITION
                """))
                # ✅ FIXED HERE
                columns = [dict(row._mapping) for row in result.fetchall()]
            return jsonify(columns), 200
        except Exception as e:
            print("❌ Error fetching SQL columns:", e)
            return jsonify({"error": str(e)}), 500

    return inner()

# -------------------------------
# ➕ API — Add New Column
# -------------------------------
@settings_bp.route("/api/add-column", methods=["POST"])
def add_column():
    from app import get_db_connection, login_required

    @login_required
    def inner():
        try:
            data = request.get_json()
            name = data.get("name")
            friendly_type = data.get("friendlyType")

            type_map = {
                "Text": "NVARCHAR(255)",
                "Paragraph": "NVARCHAR(MAX)",
                "Number": "INT",
                "Decimal Number": "DECIMAL(18,2)",
                "Date/Time": "DATETIME2",
                "Yes/No": "BIT",
                "ID / Reference": "UNIQUEIDENTIFIER",
                "File Upload": "VARBINARY(MAX)",
                "Other": "NVARCHAR(255)"
            }

            sql_type = type_map.get(friendly_type, "NVARCHAR(255)")

            with get_db_connection() as conn:
                conn.execute(text(f"ALTER TABLE dbo.Cases ADD [{name}] {sql_type} NULL;"))
                conn.commit()

            print(f"✅ Added new column '{name}' as {sql_type}")
            return jsonify({"success": True}), 200

        except Exception as e:
            print("❌ Error adding column:", e)
            return jsonify({"success": False, "error": str(e)}), 500

    return inner()

# -------------------------------
# 🗑️ API — Delete Column
# -------------------------------
@settings_bp.route("/api/delete-column/<name>", methods=["DELETE"])
def delete_column(name):
    from app import get_db_connection, login_required

    @login_required
    def inner():
        try:
            protected = ["CaseID", "DeepBlueRef"]
            if name in protected:
                return jsonify({"success": False, "error": "Protected column cannot be deleted."}), 400

            with get_db_connection() as conn:
                conn.execute(text(f"ALTER TABLE dbo.Cases DROP COLUMN [{name}]"))
                conn.commit()

            print(f"🗑️ Deleted column '{name}' from dbo.Cases")
            return jsonify({"success": True}), 200

        except Exception as e:
            print("❌ Error deleting column:", e)
            return jsonify({"success": False, "error": str(e)}), 500

    return inner()