# ==============================================
# 📘 ledger.py — Ledger Blueprint for Deep Blue Portal
# ==============================================
from flask import Blueprint, render_template, jsonify, request
from sqlalchemy import text
from sqlalchemy import inspect

# Create the Blueprint
ledger_bp = Blueprint('ledger_bp', __name__)

# -------------------------------
# 🌐 Page Route — /ledger
# -------------------------------
@ledger_bp.route('/ledger')
def ledger_page():
    from app import login_required

    @login_required
    def inner():
        return render_template('ledger.html')

    return inner()

# -------------------------------
# 🧾 API Route — /api/ledger
# -------------------------------
@ledger_bp.route('/api/ledger', methods=['GET'])
def get_ledger():
    from app import get_db_connection, login_required

    @login_required
    def inner():
        try:
            with get_db_connection() as conn:
                result = conn.execute(text("""
                    SELECT * FROM dbo.Cases ORDER BY CPDate DESC
                """))
                columns = result.keys()
                rows = [dict(zip(columns, row)) for row in result.fetchall()]

            return jsonify({"columns": list(columns), "rows": rows}), 200

        except Exception as e:
            print("❌ Error fetching ledger data:", e)
            return jsonify({"error": str(e)}), 500

    return inner()

# -------------------------------
# 💾 API Route — Update Ledger Item (ISO-only)
# -------------------------------
@ledger_bp.route('/api/update-ledger-item/<int:case_id>', methods=['PUT'])
def update_ledger_item(case_id):
    from app import get_db_connection, login_required

    @login_required
    def inner():
        try:
            data = request.get_json()
            if not data:
                return jsonify({"error": "No data provided"}), 400

            # 🧹 Clean up empty strings and numeric text
            for k, v in list(data.items()):
                if isinstance(v, str):
                    v_strip = v.strip()
                    if v_strip == "":
                        data[k] = None
                    else:
                        # detect numeric strings like "12", "12.5"
                        num_check = v_strip.replace(".", "", 1)
                        if num_check.isdigit():
                            try:
                                data[k] = float(v_strip) if "." in v_strip else int(v_strip)
                            except ValueError:
                                pass  # leave as string

            # 🔒 Exclude identity & protected fields
            protected_fields = ["CaseID", "DeepBlueRef"]
            update_fields = [key for key in data.keys() if key not in protected_fields]

            if not update_fields:
                return jsonify({"error": "No valid fields to update"}), 400

            set_clause = ", ".join([f"{key} = :{key}" for key in update_fields])
            sql = text(f"UPDATE dbo.Cases SET {set_clause} WHERE CaseID = :case_id")
            data["case_id"] = case_id

            with get_db_connection() as conn:
                conn.execute(sql, data)
                conn.commit()

            print(f"✅ Updated CaseID {case_id}")
            return jsonify({"success": True}), 200

        except Exception as e:
            print(f"❌ Error updating ledger item {case_id}:", e)
            return jsonify({"success": False, "error": str(e)}), 500

    return inner()

# -------------------------------
# 🗑 API Route — Delete Ledger Item
# -------------------------------
@ledger_bp.route('/api/delete-ledger-item/<int:case_id>', methods=['DELETE'])
def delete_ledger_item(case_id):
    from app import get_db_connection, login_required

    @login_required
    def inner():
        try:
            with get_db_connection() as conn:
                conn.execute(text("DELETE FROM dbo.Cases WHERE CaseID = :case_id"), {"case_id": case_id})
                conn.commit()

            print(f"🗑 Deleted CaseID {case_id}")
            return jsonify({"success": True}), 200

        except Exception as e:
            print(f"❌ Error deleting ledger item {case_id}:", e)
            return jsonify({"success": False, "error": str(e)}), 500

    return inner()

# -------------------------------
# ➕ API Route — Add New Ledger Item (ISO-only)
# -------------------------------
@ledger_bp.route('/api/add-ledger-item', methods=['POST'])
def add_ledger_item():
    from app import get_db_connection, login_required

    @login_required
    def inner():
        try:
            data = request.get_json()
            if not data:
                return jsonify({"error": "No data provided"}), 400

            # 🔒 Remove protected/identity fields
            for field in ["CaseID"]:
                data.pop(field, None)

            # 🧹 Clean up empty strings and numeric text
            for k, v in list(data.items()):
                if isinstance(v, str):
                    v_strip = v.strip()
                    if v_strip == "":
                        data[k] = None
                    else:
                        # detect numeric strings
                        num_check = v_strip.replace(".", "", 1)
                        if num_check.isdigit():
                            try:
                                data[k] = float(v_strip) if "." in v_strip else int(v_strip)
                            except ValueError:
                                pass  # leave as string

            # ✅ Expect all date/time strings already in ISO ("YYYY-MM-DD HH:MM:SS")
            # SQL Server DATETIME2 can handle that directly.

            columns = ", ".join(data.keys())
            values = ", ".join([f":{k}" for k in data.keys()])
            sql = text(f"INSERT INTO dbo.Cases ({columns}) VALUES ({values})")

            with get_db_connection() as conn:
                conn.execute(sql, data)
                conn.commit()

            print(f"✅ Added new ledger item {data.get('DeepBlueRef', '')}")
            return jsonify({"success": True}), 200

        except Exception as e:
            print("❌ Error adding ledger item:", e)
            return jsonify({"success": False, "error": str(e)}), 500

    return inner()

# ==============================================
# ⚙️ ADVANCED SETTINGS API — Column Management
# ==============================================
from sqlalchemy import inspect

# -------------------------------
# 📋 List SQL Columns
# -------------------------------
@ledger_bp.route("/api/columns", methods=["GET"])
def get_columns():
    from app import get_db_connection, login_required

    @login_required
    def inner():
        try:
            with get_db_connection() as conn:
                inspector = inspect(conn)
                columns = []
                for col in inspector.get_columns("Cases", schema="dbo"):
                    columns.append({
                        "name": col["name"],
                        "type": str(col["type"])
                    })
            return jsonify({"columns": columns}), 200
        except Exception as e:
            print("❌ Error fetching columns:", e)
            return jsonify({"success": False, "error": str(e)}), 500

    return inner()


# -------------------------------
# ➕ Add New Column
# -------------------------------
@ledger_bp.route("/api/add-column", methods=["POST"])
def add_column():
    from app import get_db_connection, login_required

    @login_required
    def inner():
        try:
            data = request.get_json()
            col_name = data.get("name")
            col_type = data.get("type", "NVARCHAR(255)")

            if not col_name:
                return jsonify({"success": False, "error": "Column name required"}), 400

            # ⚠️ Protect key columns
            if col_name in ["CaseID", "DeepBlueRef"]:
                return jsonify({"success": False, "error": "Protected column cannot be added"}), 400

            sql = text(f"ALTER TABLE dbo.Cases ADD [{col_name}] {col_type}")
            with get_db_connection() as conn:
                conn.execute(sql)
                conn.commit()

            print(f"✅ Added column {col_name} ({col_type})")
            return jsonify({"success": True}), 200

        except Exception as e:
            print("❌ Error adding column:", e)
            return jsonify({"success": False, "error": str(e)}), 500

    return inner()


# -------------------------------
# 🗑 Delete Column
# -------------------------------
@ledger_bp.route("/api/delete-column/<string:col_name>", methods=["DELETE"])
def delete_column(col_name):
    from app import get_db_connection, login_required

    @login_required
    def inner():
        try:
            if col_name in ["CaseID", "DeepBlueRef"]:
                return jsonify({"success": False, "error": "Protected column cannot be deleted"}), 400

            sql = text(f"ALTER TABLE dbo.Cases DROP COLUMN [{col_name}]")
            with get_db_connection() as conn:
                conn.execute(sql)
                conn.commit()

            print(f"🗑 Deleted column {col_name}")
            return jsonify({"success": True}), 200

        except Exception as e:
            print("❌ Error deleting column:", e)
            return jsonify({"success": False, "error": str(e)}), 500

    return inner()


# -------------------------------
# 🔄 Reset Columns (optional)
# -------------------------------
@ledger_bp.route("/api/reset-columns", methods=["POST"])
def reset_columns():
    from app import get_db_connection, login_required

    @login_required
    def inner():
        try:
            # Example: You could rebuild missing columns to your default schema here.
            # For now, this just confirms the route works.
            print("🔄 Reset columns called (placeholder)")
            return jsonify({"success": True, "message": "Reset executed"}), 200

        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    return inner()
