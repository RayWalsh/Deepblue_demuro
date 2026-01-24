# ============================================================
# 📂 Case Documents (Azure Blob Storage)
# ============================================================

from dotenv import load_dotenv
load_dotenv()

from flask import Blueprint, request, jsonify
import os
from datetime import datetime

from azure.storage.blob import BlobServiceClient
from azure.core.exceptions import ResourceExistsError

# ------------------------------------------------------------
# ⚙️ Blueprint
# ------------------------------------------------------------
case_documents_bp = Blueprint("case_documents", __name__)

# ------------------------------------------------------------
# 🔐 Azure Blob Client Helper
# ------------------------------------------------------------
def get_blob_service():
    conn_str = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
    if not conn_str:
        raise RuntimeError("Azure Blob Storage connection string not set")

    return BlobServiceClient.from_connection_string(conn_str)

# ------------------------------------------------------------
# 📎 Upload Charterparty PDF (REAL ENDPOINT)
# ------------------------------------------------------------
@case_documents_bp.route("/api/case-documents/upload/charterparty", methods=["POST"])
def upload_charterparty():

    # ---------------------------------------------
    # 📥 Validate inputs
    # ---------------------------------------------
    deep_blue_ref = request.form.get("DeepBlueRef", "").strip()
    vessel_name = request.form.get("VesselName", "").strip()
    cp_date = request.form.get("CPDate", "").strip()

    if not deep_blue_ref:
        return jsonify(
            success=False,
            error="DeepBlueRef is required to upload documents"
        ), 400

    if "file" not in request.files:
        return jsonify(success=False, error="No file uploaded"), 400

    file = request.files["file"]

    if not file or file.filename == "":
        return jsonify(success=False, error="Empty file"), 400

    if file.mimetype != "application/pdf":
        return jsonify(
            success=False,
            error="Only PDF charterparties are supported"
        ), 400

    # ---------------------------------------------
    # 🧭 Build blob path
    # ---------------------------------------------
    container_name = "case-documents"
    folder_path = f"Charterparty/{deep_blue_ref}"

    safe_vessel = vessel_name.replace(" ", "_") if vessel_name else "UnknownVessel"
    safe_date = cp_date if cp_date else datetime.utcnow().strftime("%Y-%m-%d")

    blob_name = f"{folder_path}/{safe_vessel}-{safe_date}-Charterparty.pdf"

    # ---------------------------------------------
    # ☁️ Upload to Azure Blob Storage
    # ---------------------------------------------
    try:
        blob_service = get_blob_service()
        container_client = blob_service.get_container_client(container_name)

        try:
            container_client.create_container()
        except ResourceExistsError:
            pass  # container already exists

        blob_client = container_client.get_blob_client(blob_name)

        blob_client.upload_blob(
            file,
            overwrite=True,
            content_type="application/pdf"
        )

    except Exception as e:
        return jsonify(
            success=False,
            error=f"Blob upload failed: {str(e)}"
        ), 500

    # ---------------------------------------------
    # ✅ Success response
    # ---------------------------------------------
    return jsonify(
        success=True,
        document={
            "type": "Charterparty",
            "deepBlueRef": deep_blue_ref,
            "fileName": os.path.basename(blob_name),
            "blobPath": blob_name,
            "container": container_name,
        }
    )

# ------------------------------------------------------------
# 🧪 TEMP: Test Blob Connectivity
# ------------------------------------------------------------
@case_documents_bp.route("/api/case-documents/test-upload", methods=["GET"])
def test_blob_upload():
    try:
        print("🧪 Starting blob test")

        blob_service = get_blob_service()
        print("✅ BlobServiceClient OK")

        container_name = "case-documents"
        container_client = blob_service.get_container_client(container_name)

        try:
            container_client.create_container()
            print("📦 Container created")
        except ResourceExistsError:
            print("📦 Container already exists")

        blob_name = "test/hello-from-flask.txt"
        blob_client = container_client.get_blob_client(blob_name)

        blob_client.upload_blob(
            b"Hello from Flask Blob Test",
            overwrite=True
        )

        print("✅ Blob upload completed")

        return jsonify(
            success=True,
            message="Blob upload successful",
            container=container_name,
            blob=blob_name
        )

    except Exception as e:
        print("❌ BLOB TEST FAILED:", repr(e))
        raise