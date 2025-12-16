# case.py
from flask import Blueprint, render_template, request, jsonify
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

@case_bp.route("/update-case/<int:case_id>", methods=["POST"])
@login_required
def update_case(case_id):
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400

    # Normalise empty strings and "None" → NULL
    for k, v in list(data.items()):
        if isinstance(v, str):
            v_strip = v.strip()
            if v_strip == "" or v_strip.lower() == "none":
                data[k] = None

    # Allow only known fields
    allowed_fields = {
        "ClientName",
        "VesselName",
        "VoyageNumber",
        "VoyageEndDate",
        "CPType",
        "CPForm",
        "OwnersName",
        "BrokersName",
        "CharterersName",
        "Layday",
        "Cancelling",
        "LoadingRate",
        "DischargingRate",
        "DemurrageRate",
        "InitialClaim",
        "NoticeReceived",
        "ClaimReceived",
        "NoticeDays",
        "ClaimDays",
        "ContractType",
        "ClaimType",
        "ClaimFiledAmount",
        "ClaimStatus",
        "Reversible",
        "LumpsumHours",
        "CalculationType",
        "TotalAllowedLaytime",
        "TotalTimeUsed",
        "TotalTimeOnDemurrage",
        "TotalDemurrageCost",
        "AgreedAmount",
        "AgreedDate",
        "PaidDate",
        "ContactName",
        "InvoiceNumber",
        "CalculatorNotes"
    }

    fields_to_update = {k: v for k, v in data.items() if k in allowed_fields}

    if not fields_to_update:
        return jsonify({"error": "No valid fields to update"}), 400

    set_clause = ", ".join([f"{key} = :{key}" for key in fields_to_update])
    fields_to_update["CaseID"] = case_id

    query = f"""
        UPDATE dbo.Cases
        SET {set_clause}
        WHERE CaseID = :CaseID
    """

    try:
        with get_db_connection() as conn:
            conn.execute(text(query), fields_to_update)
            conn.commit()
    except Exception as e:
        print(f"❌ Error updating case {case_id}:", e)
        return jsonify({"error": "Database update failed"}), 500

    return jsonify({"success": True})