// ==============================================
// 📂 Case Documents (List + Upload)
// ==============================================

document.addEventListener("DOMContentLoaded", () => {
  if (!window.caseData?.DeepBlueRef) return;

  initDocumentList();
  initUpload();
});

// ----------------------------------------------
// 📄 LIST DOCUMENTS
// ----------------------------------------------

async function initDocumentList() {
  const list = document.querySelector(".file-list");
  if (!list) return;

  list.innerHTML = `
    <li class="file-item muted">
      Loading documents…
    </li>
  `;

  try {
    const res = await fetch(
      `/api/case-documents/${encodeURIComponent(window.caseData.DeepBlueRef)}`
    );
    const data = await res.json();

    list.innerHTML = "";

    if (!data.documents.length) {
      list.innerHTML = `
        <li class="file-item muted">
          No documents uploaded
        </li>
      `;
    } else {
      data.documents.forEach(doc => {
        list.appendChild(renderDocumentItem(doc));
      });
    }

    // ----------------------------------------------
    // ⚠️ Missing required documents
    // ----------------------------------------------
    const footer = document.getElementById("documentsFooter");
    if (footer) {
      footer.innerHTML = "";

      if (data.missing && data.missing.length) {
        data.missing.forEach(type => {
          const span = document.createElement("span");
          span.className = "missing-doc";
          span.textContent = `⚠️ ${type} not uploaded`;
          footer.appendChild(span);
        });
      }
    }

  } catch (err) {
    console.error("❌ Document load failed:", err);
    list.innerHTML = `
      <li class="file-item error">
        Failed to load documents
      </li>
    `;
  }
}

// ----------------------------------------------
// ⬆️ UPLOAD (Charterparty for now)
// ----------------------------------------------

function initUpload() {
  const uploadBtn = document.getElementById("uploadDocumentBtn");
  const fileInput = document.getElementById("charterpartyFileInput");

  if (!uploadBtn || !fileInput) return;

  uploadBtn.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Only PDF files are supported.");
      fileInput.value = "";
      return;
    }

    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading';

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("DeepBlueRef", window.caseData.DeepBlueRef);
      formData.append("VesselName", window.caseData.VesselName || "");
      formData.append("CPDate", window.caseData.CPDate || "");

      const res = await fetch(
        "/api/case-documents/upload/charterparty",
        {
          method: "POST",
          body: formData
        }
      );

      const result = await res.json();

      if (!result.success) {
        throw new Error(result.error || "Upload failed");
      }

      // Refresh list
      initDocumentList();

    } catch (err) {
      console.error("❌ Upload failed:", err);
      alert("Upload failed: " + err.message);
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = '<i class="fas fa-upload"></i> Upload';
      fileInput.value = "";
    }
  });
}

// ----------------------------------------------
// 🧱 RENDER HELPERS
// ----------------------------------------------

function renderDocumentItem(doc) {
  const li = document.createElement("li");
  li.className = "file-item";

  li.innerHTML = `
    <i class="fas ${iconForType(doc.type)}"></i>

    <div class="file-meta">
      <span class="file-name">${doc.filename}</span>
      <span class="file-info">${doc.type}</span>
    </div>

    <div class="file-actions">
      <a
        href="/api/case-documents/download?path=${encodeURIComponent(doc.path)}"
        title="Download"
      >
        <i class="fas fa-download"></i>
      </a>
    </div>
  `;

  return li;
}

function iconForType(type) {
  switch (type) {
    case "Charterparty":
      return "fa-file-contract";
    case "SOF":
      return "fa-file-alt";
    case "NOR":
      return "fa-file-signature";
    default:
      return "fa-file";
  }
}