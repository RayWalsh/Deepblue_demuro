# ==============================================
# 📘 ledger.py — Ledger Blueprint for Deep Blue Portal
# ==============================================
from flask import Blueprint, render_template, jsonify
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
                    SELECT *
                    FROM dbo.Cases
                    ORDER BY CPDate DESC
                """))
                columns = result.keys()
                rows = [dict(zip(columns, row)) for row in result.fetchall()]

                print(f"✅ Loaded {len(rows)} ledger rows from dbo.Cases")

            # Return both columns and rows
            return jsonify({
                "columns": list(columns),
                "rows": rows
            }), 200

        except Exception as e:
            print("❌ Error fetching ledger data:", e)
            return jsonify({"error": str(e)}), 500

    return inner()