// ==============================================
// 📘 ledger.js — The Ledger + Edit Modal + Add Modal + Settings
// ==============================================
document.addEventListener("DOMContentLoaded", async () => {
  const tableBody = document.getElementById("ledgerTableBody");
  const searchInput = document.getElementById("globalSearch");
  const exportBtn = document.getElementById("exportCSVBtn");
  const toggleBtn = document.getElementById("toggleViewBtn");
  const openSettingsBtn = document.getElementById("openSettingsBtn");

  const editModal = document.getElementById("editEntryModal");
  const closeEditEntryBtn = document.getElementById("closeEditEntryBtn");
  const saveEntryBtn = document.getElementById("saveEntryBtn");
  const deleteEntryBtn = document.getElementById("deleteEntryBtn");
  const editModalBody = document.getElementById("editModalBody");

  const addModal = document.getElementById("addEntryModal");
  const openAddBtn = document.getElementById("openAddEntryBtn");
  const closeAddEntryBtn = document.getElementById("closeAddEntryBtn");
  const saveAddEntryBtn = document.getElementById("saveAddEntryBtn");
  const addModalBody = document.getElementById("addModalBody");

  let ledgerData = [];
  let allColumns = [];
  let currentEditItem = null;

  // -------------------------------
  // Load Ledger
  // -------------------------------
  async function loadLedger() {
    try {
      const res = await fetch("/api/ledger");
      const json = await res.json();
      ledgerData = json.rows || [];
      allColumns = json.columns || [];
      renderTable(ledgerData);
    } catch {
      tableBody.innerHTML = `<tr><td colspan="7">⚠️ Error loading ledger.</td></tr>`;
    }
  }

  // -------------------------------
  // Render Table
  // -------------------------------
  function renderTable(rows) {
    tableBody.innerHTML = "";
    rows.forEach((row) => {
      const ref = row.DeepBlueRef || "—";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="ref-cell">${ref}</td>
        <td>${row.VesselName || "—"}</td>
        <td>${row.ClientName || "—"}</td>
        <td>${row.CPDate ? new Date(row.CPDate).toLocaleDateString("en-GB") : "—"}</td>
        <td>${row.ClaimSubmittedDate ? new Date(row.ClaimSubmittedDate).toLocaleDateString("en-GB") : "—"}</td>
        <td style="text-align:right;">${row.ClaimFiledAmount || "—"}</td>
        <td>${row.ClaimStatus || "—"}</td>
      `;
      tableBody.appendChild(tr);
    });

    document.querySelectorAll(".ref-cell").forEach((cell) => {
      cell.addEventListener("click", (e) => {
        const ref = e.target.textContent.trim();
        const item = ledgerData.find((r) => r.DeepBlueRef === ref);
        if (item) openEditModal(item);
      });
    });
  }

// -------------------------------
// ✏️ Edit Entry Modal (Grouped)
// -------------------------------
function openEditModal(data) {
  currentEditItem = data;
  editModal.style.display = "flex";

  let html = "";

  for (const [groupName, fields] of Object.entries(fieldGroups)) {
    html += `<section class="field-group"><h4>${groupName}</h4><div class="field-grid">`;
    fields.forEach((col) => {
      const type = inferInputType(col);
      const value = data[col] ?? "";
      const disabled = systemFields.includes(col) ? "disabled" : "";

      if (type === "textarea") {
        html += `<div><label>${col}</label><textarea name="${col}" rows="2" ${disabled}>${value}</textarea></div>`;
      } else if (type === "checkbox") {
        const checked = value === 1 || value === true ? "checked" : "";
        html += `<div><label><input type="checkbox" name="${col}" ${checked} ${disabled}/> ${col}</label></div>`;
      } else {
        html += `<div><label>${col}</label><input type="${type}" name="${col}" value="${value}" ${disabled}/></div>`;
      }
    });
    html += "</div></section>";
  }

  editModalBody.innerHTML = html;
}

  closeEditEntryBtn.onclick = () => (editModal.style.display = "none");
  editModal.onclick = (e) => {
    if (e.target === editModal) editModal.style.display = "none";
  };

  saveEntryBtn.onclick = async () => {
    const payload = {};
    editModalBody.querySelectorAll("input").forEach((i) => (payload[i.name] = i.value));
    const caseId = currentEditItem.CaseID;
    const res = await fetch(`/api/update-ledger-item/${caseId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.success) {
      alert("✅ Entry updated");
      editModal.style.display = "none";
      loadLedger();
    } else alert("❌ " + data.error);
  };

  deleteEntryBtn.onclick = async () => {
    const caseId = currentEditItem.CaseID;
    if (!confirm("Delete this entry?")) return;
    const res = await fetch(`/api/delete-ledger-item/${caseId}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      alert("🗑 Entry deleted");
      editModal.style.display = "none";
      loadLedger();
    } else alert("❌ " + data.error);
  };

  // -------------------------------
  // 🧱 Grouped Field Rendering
  // -------------------------------
  const fieldGroups = {
    "Case Info": [
      "CaseID", "DeepBlueRef", "ClientName", "VesselName", "VoyageNumber", "VoyageEndDate",
      "CharterersName", "BrokersName", "OwnersName", "CPDate", "CPType", "CPForm"
    ],
    "Charterparty Details": [
      "Layday", "Cancelling", "NoticeReceived", "NoticeDays", "InitialClaim",
      "ContractType", "ClaimReceived"
    ],
    "Rates & Demurrage": [
      "LoadRate", "DischRate", "DemurrageRate", "LoadingRate", "DischargingRate",
      "TotalAllowedLaytime", "TotalTimeUsed", "TotalDemurrageCost"
    ],
    "Claim Info": [
      "ClaimType", "ClaimDays", "ClaimFiledAmount", "AgreedAmount", "ClaimStatus",
      "CalculationType", "ClaimFiled", "AgreedDate", "InvoiceNumber"
    ],
    "Admin & Notes": [
      "CalculatorNotes", "ClaimNotes", "InstructionReceived", "ContactName", "CreatedAt"
    ]
  };

  const systemFields = ["CaseID", "CreatedAt"];

  function inferInputType(name) {
    const lower = name.toLowerCase();
    if (lower.includes("date")) return "date";
    if (lower.includes("amount") || lower.includes("rate") || lower.includes("days") || lower.includes("hours")) return "number";
    if (lower.includes("notes") || lower.includes("instruction")) return "textarea";
    if (lower.includes("received") && !lower.includes("date")) return "checkbox";
    return "text";
  }

  // -------------------------------
  // ➕ Open Add Modal (Grouped)
  // -------------------------------
  openAddBtn.onclick = () => {
    addModal.style.display = "flex";
    let html = "";

    for (const [groupName, fields] of Object.entries(fieldGroups)) {
      html += `<section class="field-group"><h4>${groupName}</h4><div class="field-grid">`;
      fields.forEach((col) => {
        const type = inferInputType(col);
        const disabled = systemFields.includes(col) ? "disabled" : "";
        if (type === "textarea") {
          html += `<div><label>${col}</label><textarea name="${col}" rows="2" ${disabled}></textarea></div>`;
        } else if (type === "checkbox") {
          html += `<div><label><input type="checkbox" name="${col}" ${disabled}/> ${col}</label></div>`;
        } else {
          html += `<div><label>${col}</label><input type="${type}" name="${col}" ${disabled}/></div>`;
        }
      });
      html += "</div></section>";
    }

    addModalBody.innerHTML = html;
  };

  closeAddEntryBtn.onclick = () => (addModal.style.display = "none");
  addModal.onclick = (e) => {
    if (e.target === addModal) addModal.style.display = "none";
  };

  saveAddEntryBtn.onclick = async () => {
    const payload = {};
    addModalBody.querySelectorAll("input, textarea").forEach((i) => {
      if (i.type === "checkbox") payload[i.name] = i.checked ? 1 : 0;
      else payload[i.name] = i.value;
    });

    const res = await fetch("/api/add-ledger-item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.success) {
      alert("✅ New ledger entry added");
      addModal.style.display = "none";
      loadLedger();
    } else alert("❌ " + data.error);
  };

  // -------------------------------
  // Search Filter
  // -------------------------------
  searchInput.oninput = (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = ledgerData.filter((r) =>
      Object.values(r).join(" ").toLowerCase().includes(term)
    );
    renderTable(filtered);
  };

  loadLedger();
});