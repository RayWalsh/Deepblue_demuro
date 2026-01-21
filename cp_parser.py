# ============================================================
# 📄 Charterparty Parser (Azure Document Intelligence)
# ============================================================

from flask import Blueprint, request, jsonify
import os
import tempfile

from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential

cp_parser_bp = Blueprint("cp_parser", __name__)

# ------------------------------------------------------------
# 🔐 Azure DI Client
# ------------------------------------------------------------
def get_di_client():
    endpoint = os.getenv("AZURE_DI_ENDPOINT")
    key = os.getenv("AZURE_DI_KEY")

    if not endpoint or not key:
        raise RuntimeError("Azure Document Intelligence credentials not set")

    return DocumentAnalysisClient(
        endpoint=endpoint,
        credential=AzureKeyCredential(key)
    )

# ------------------------------------------------------------
# 📎 Parse Charterparty (PDF only)
# ------------------------------------------------------------
@cp_parser_bp.route("/api/cp/parse", methods=["POST"])
def parse_charterparty():

    # ---------------------------------------------
    # 📥 Validate upload
    # ---------------------------------------------
    if "file" not in request.files:
        return jsonify(success=False, error="No file uploaded"), 400

    file = request.files["file"]

    if not file or file.filename == "":
        return jsonify(success=False, error="Empty file"), 400

    if file.mimetype != "application/pdf":
        return jsonify(success=False, error="Only PDF supported"), 400

    # ---------------------------------------------
    # 🔧 Model config
    # ---------------------------------------------
    model_id = os.getenv("AZURE_DI_MODEL_ID")
    if not model_id:
        return jsonify(
            success=False,
            error="CP parser model not configured"
        ), 500

    # ---------------------------------------------
    # 🧭 OPTIONAL: DeepBlueRef (future storage hook)
    # ---------------------------------------------
    deep_blue_ref = request.form.get("DeepBlueRef")
    if deep_blue_ref:
        deep_blue_ref = deep_blue_ref.strip()

    tmp_path = None

    try:
        # ---------------------------------------------
        # 📄 Save temp file
        # ---------------------------------------------
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            file.save(tmp.name)
            tmp_path = tmp.name

        # ---------------------------------------------
        # ☁️ Send to Azure DI
        # ---------------------------------------------
        client = get_di_client()

        with open(tmp_path, "rb") as f:
            poller = client.begin_analyze_document(
                model_id=model_id,
                document=f
            )

        result = poller.result()

    except Exception as e:
        return jsonify(success=False, error=str(e)), 500

    finally:
        if tmp_path:
            try:
                os.remove(tmp_path)
            except Exception:
                pass

    # ---------------------------------------------
    # 🧠 Extract fields + confidence
    # ---------------------------------------------
    if not result.documents:
        return jsonify(
            success=False,
            error="No document data extracted"
        ), 422

    doc = result.documents[0]
    extracted = {}

    for name, field in doc.fields.items():
        extracted[name] = {
            "value": field.value if field.value is not None else field.content,
            "confidence": round(field.confidence, 2) if field.confidence else None
        }

    # ---------------------------------------------
    # ✅ Response (future-ready)
    # ---------------------------------------------
    return jsonify(
        success=True,
        fields=extracted,
        meta={
            "deepBlueRef": deep_blue_ref,
            "modelId": model_id,
            "fileName": file.filename
        }
    )