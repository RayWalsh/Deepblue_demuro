# ==============================================
# 📘 ledger.py — Ledger Blueprint for Deep Blue Portal
# ==============================================
from flask import Blueprint, render_template, jsonify, request
from sqlalchemy import text

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
# 💾 API Route — Update Ledger Item
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

            set_clause = ", ".join([f"{key} = :{key}" for key in data.keys()])
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
# ➕ API Route — Add New Ledger Item
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

            # Build INSERT dynamically from provided keys
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