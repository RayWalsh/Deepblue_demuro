# ==============================================
# 📘 ledger.py — Ledger Blueprint for Deep Blue Portal
# ==============================================
from flask import Blueprint, render_template, jsonify
from sqlalchemy import text

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
                query = text("""
                    SELECT 
                        [CaseID],
                        [DeepBlueRef],
                        [VesselName],
                        [ClientName],
                        [CPDate],
                        [ClaimType],
                        [ClaimFiledAmount],
                        [ClaimStatus]
                    FROM dbo.Cases
                    ORDER BY [CPDate] DESC
                """)
                result = conn.execute(query)
                columns = result.keys()
                data = [dict(zip(columns, row)) for row in result.fetchall()]
                print(f"✅ Loaded {len(data)} ledger rows from dbo.Cases")
                return jsonify(data), 200
        except Exception as e:
            print("🚨 SQL Error in /api/ledger:", e)
            return jsonify({"error": str(e)}), 500

    return inner()