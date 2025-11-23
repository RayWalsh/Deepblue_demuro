# case.py
from flask import Blueprint, render_template, request
from sqlalchemy import text
from utils import get_db_connection, login_required

case_bp = Blueprint('case_bp', __name__)

@case_bp.route('/case/<int:case_id>')
@login_required
def view_case(case_id):
    try:
        with get_db_connection() as conn:
            result = conn.execute(text("SELECT * FROM dbo.Cases WHERE CaseID = :id"), {"id": case_id})
            row = result.fetchone()

            if not row:
                return render_template('case.html', error="Case not found", case_id=case_id)

            case = dict(row._mapping)  # Convert Row object to dict

    except Exception as e:
        print(f"❌ Error fetching case {case_id}:", e)
        return render_template('case.html', error="Database error", case_id=case_id)

    return render_template('case.html', case=case)