# ============================================================
# 📂 Case Documents (Azure Blob Storage)
# ============================================================

from dotenv import load_dotenv
load_dotenv()

from flask import Blueprint, request, jsonify, send_file
import os
from datetime import datetime
import io

from azure.storage.blob import BlobServiceClient
from azure.core.exceptions import ResourceExistsError

# ------------------------------------------------------------
# ⚙️ Blueprint
# ------------------------------------------------------------
case_documents_bp = Blueprint("case_documents", __name__)

# ------------------------------------------------------------
# 📌 Required documents (v1 – hard-coded)
# ------------------------------------------------------------
REQUIRED_DOCUMENTS = [
    "Charterparty",
    "SOF"
]

# ------------------------------------------------------------
# 🔐 Azure Blob Client Helper
# ------------------------------------------------------------
def get_blob_service():
    conn_str = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
    if not conn_str:
        raise RuntimeError("Azure Blob Storage connection string not set")

    return BlobServiceClient.from_connection_string(conn_str)

# ------------------------------------------------------------
# 🧼 Helpers
# ------------------------------------------------------------
def sanitize_filename_part(value: str) -> str:
    return (
        value.strip()
        .replace(" ", "_")
        .replace(":", "")
        .replace("/", "-")
    )

def format_cp_date(cp_date_str: str) -> str:
    """
    Converts CPDate to ddMMMyy (e.g. 28Oct25).
    Falls back safely if parsing fails.
    """
    if not cp_date_str:
        return datetime.utcnow().strftime("%d%b%y")

    try:
        for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S"):
            try:
                dt = datetime.strptime(cp_date_str, fmt)
                return dt.strftime("%d%b%y")
            except ValueError:
                pass

        dt = datetime.fromisoformat(cp_date_str)
        return dt.strftime("%d%b%y")

    except Exception:
        return datetime.utcnow().strftime("%d%b%y")

# ------------------------------------------------------------
# 🗑️ Delete ALL documents for a case (HELPER)
# ------------------------------------------------------------
def delete_case_documents(deep_blue_ref: str) -> int:
    """
    Deletes all blobs under:
    Charterparty/{DeepBlueRef}/

    Returns number of deleted blobs.
    """
    blob_service = get_blob_service()
    container_client = blob_service.get_container_client("case-documents")

    prefix = f"Charterparty/{deep_blue_ref}/"
    deleted = 0

    for blob in container_client.list_blobs(name_starts_with=prefix):
        container_client.delete_blob(blob.name)
        deleted += 1

    return deleted

# ------------------------------------------------------------
# 📎 Upload Charterparty PDF
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

    safe_vessel = sanitize_filename_part(vessel_name) if vessel_name else "UnknownVessel"
    safe_date = format_cp_date(cp_date)

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

# ------------------------------------------------------------
# 📄 List Case Documents (by DeepBlueRef)
# ------------------------------------------------------------
@case_documents_bp.route("/api/case-documents/<deep_blue_ref>", methods=["GET"])
def list_case_documents(deep_blue_ref):
    try:
        blob_service = get_blob_service()
        container_client = blob_service.get_container_client("case-documents")

        documents = []

        for blob in container_client.list_blobs():
            parts = blob.name.split("/")

            # Expected: Type / DeepBlueRef / filename
            if len(parts) < 3:
                continue

            doc_type, ref, filename = parts[0], parts[1], parts[-1]

            if ref != deep_blue_ref:
                continue

            documents.append({
                "type": doc_type,
                "filename": filename,
                "path": blob.name,
                "size": blob.size,
                "last_modified": blob.last_modified.isoformat()
            })

        present_types = {doc["type"] for doc in documents}

        missing_documents = [
            doc_type
            for doc_type in REQUIRED_DOCUMENTS
            if doc_type not in present_types
        ]

        return jsonify(
            success=True,
            documents=documents,
            missing=missing_documents
        )

    except Exception as e:
        return jsonify(
            success=False,
            error=str(e)
        ), 500

# ------------------------------------------------------------
# ⬇️ Download Case Document
# ------------------------------------------------------------
@case_documents_bp.route("/api/case-documents/download", methods=["GET"])
def download_case_document():
    path = request.args.get("path")
    if not path:
        return jsonify(success=False, error="Missing blob path"), 400

    try:
        blob_service = get_blob_service()
        container_client = blob_service.get_container_client("case-documents")
        blob_client = container_client.get_blob_client(path)

        stream = blob_client.download_blob()
        data = stream.readall()

        return send_file(
            io.BytesIO(data),
            as_attachment=True,
            download_name=os.path.basename(path)
        )

    except Exception as e:
        return jsonify(
            success=False,
            error=str(e)
        ), 500