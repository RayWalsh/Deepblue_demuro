// ==============================================
// 📘 ledger.js — Deep Blue Ledger (Full Version)
// ==============================================
document.addEventListener("DOMContentLoaded", async () => {
  console.log("✅ Ledger.js loaded");

  // --------------------------------------------------
  // 🔧 ELEMENTS
  // --------------------------------------------------
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

  const settingsModal = document.getElementById("settingsModal");
  const closeSettingsBtn = document.getElementById("closeSettingsBtn");
  const tableWrapper = document.querySelector(".table-wrapper");
  const tableScroll = document.querySelector(".table-scroll");

  // --------------------------------------------------
  // ⚙️ STATE
  // --------------------------------------------------
  let ledgerData = [];
  let allColumns = [];
  let currentEditItem = null;
  let expanded = false;

  // Default visible columns
  let visibleColumns = JSON.parse(
    localStorage.getItem("ledger_visible_columns") ||
      '["Ref","Ship Name","Charterer","CP Date","Claim Submitted","Amount (USD)","Status"]'
  );

  // --------------------------------------------------
  // 📡 LOAD LEDGER
  // --------------------------------------------------
  async function loadLedger() {
    try {
      console.log("📡 Fetching /api/ledger ...");
      const res = await fetch("/api/ledger", { headers: { "Cache-Control": "no-cache" } });
      const json = await res.json();
      if (!json.rows) throw new Error(json.error || "No rows returned");
      ledgerData = json.rows;
      allColumns = json.columns;
      renderTable(ledgerData);
    } catch (err) {
      console.error("❌ Ledger fetch failed:", err);
      tableBody.innerHTML = `<tr><td colspan="7">⚠️ Error loading ledger.</td></tr>`;
    }
  }

  // --------------------------------------------------
  // 🧾 RENDER TABLE
  // --------------------------------------------------
  function renderTable(rows) {
    const headers = [
      "Ref",
      "Ship Name",
      "Charterer",
      "CP Date",
      "Claim Submitted",
      "Amount (USD)",
      "Status",
    ];

    const tableHead = document.querySelector("#ledgerTable thead tr");
    tableHead.innerHTML = headers
      .filter((h) => visibleColumns.includes(h))
      .map((h) => `<th>${h}</th>`)
      .join("");

    tableBody.innerHTML = "";
    rows.forEach((row) => {
      const ref = row.DeepBlueRef || "—";
      const rowMap = {
        Ref: ref,
        "Ship Name": row.VesselName || "—",
        Charterer: row.ClientName || "—",
        "CP Date": row.CPDate ? new Date(row.CPDate).toLocaleDateString("en-GB") : "—",
        "Claim Submitted": row.ClaimSubmittedDate
          ? new Date(row.ClaimSubmittedDate).toLocaleDateString("en-GB")
          : "—",
        "Amount (USD)": row.ClaimFiledAmount || "—",
        Status: row.ClaimStatus || "—",
      };

      const tr = document.createElement("tr");
      tr.innerHTML = visibleColumns
        .map((col) => `<td>${rowMap[col]}</td>`)
        .join("");
      tableBody.appendChild(tr);
    });

    // Clickable ref cell for edit
    document.querySelectorAll(".case-table tbody tr td:first-child").forEach((cell) => {
      cell.style.cursor = "pointer";
      cell.addEventListener("click", (e) => {
        const ref = e.target.textContent.trim();
        const item = ledgerData.find((r) => r.DeepBlueRef === ref);
        if (item) openEditModal(item);
      });
    });
  }

  // --------------------------------------------------
  // ⚙️ SETTINGS MODAL
  // --------------------------------------------------
  if (openSettingsBtn && settingsModal) {
    openSettingsBtn.addEventListener("click", () => {
      console.log("🔧 Opening Settings modal");
      settingsModal.style.display = "flex";

      const modalBody = settingsModal.querySelector(".modal-body");
      modalBody.innerHTML = `
        <h4>Column Visibility</h4>
        <div id="columnSettings" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:1rem 0;">
          ${["Ref","Ship Name","Charterer","CP Date","Claim Submitted","Amount (USD)","Status"]
            .map(
              (col) => `
              <label>
                <input type="checkbox" value="${col}" ${
                visibleColumns.includes(col) ? "checked" : ""
              }>
                ${col}
              </label>`
            )
            .join("")}
        </div>
        <button id="applySettingsBtn" class="header-add-btn small" style="background:#0e3a6d;color:white;">Apply</button>
      `;

      modalBody.querySelector("#applySettingsBtn").addEventListener("click", () => {
        const selected = [
          ...modalBody.querySelectorAll('input[type="checkbox"]:checked'),
        ].map((i) => i.value);
        visibleColumns = selected;
        localStorage.setItem("ledger_visible_columns", JSON.stringify(selected));
        renderTable(ledgerData);
        settingsModal.style.display = "none";
      });
    });
  }

  closeSettingsBtn?.addEventListener("click", () => (settingsModal.style.display = "none"));
  settingsModal?.addEventListener("click", (e) => {
    if (e.target === settingsModal) settingsModal.style.display = "none";
  });

  // --------------------------------------------------
  // 🔍 EXPAND / SHRINK VIEW
  // --------------------------------------------------
  if (toggleBtn && tableWrapper && tableScroll) {
    toggleBtn.addEventListener("click", () => {
      expanded = !expanded;
      tableWrapper.classList.toggle("expanded", expanded);
      tableScroll.classList.toggle("expanded", expanded);
      if (expanded) {
        toggleBtn.innerHTML = '<i class="fas fa-compress-arrows-alt"></i>';
        toggleBtn.title = "Shrink View";
      } else {
        toggleBtn.innerHTML = '<i class="fas fa-expand-arrows-alt"></i>';
        toggleBtn.title = "Expand View";
      }
    });
  }

  // --------------------------------------------------
  // 🧩 FIELD GROUPS + INPUT TYPES
  // --------------------------------------------------
  const fieldGroups = {
    "Case Info": [
      "CaseID",
      "DeepBlueRef",
      "ClientName",
      "VesselName",
      "VoyageNumber",
      "VoyageEndDate",
      "CharterersName",
      "BrokersName",
      "OwnersName",
      "CPDate",
      "CPType",
      "CPForm",
    ],
    "Claim Info": [
      "ClaimType",
      "ClaimDays",
      "ClaimFiledAmount",
      "AgreedAmount",
      "ClaimStatus",
      "CalculationType",
      "ClaimFiled",
      "AgreedDate",
      "InvoiceNumber",
    ],
    "Admin & Notes": [
      "CalculatorNotes",
      "ClaimNotes",
      "InstructionReceived",
      "ContactName",
      "CreatedAt",
    ],
  };

  const systemFields = ["CaseID", "CreatedAt"];

  function inferInputType(name) {
    const lower = name.toLowerCase();
    if (lower.includes("date")) return "date";
    if (lower.includes("amount") || lower.includes("rate")) return "number";
    if (lower.includes("notes")) return "textarea";
    return "text";
  }

  // --------------------------------------------------
  // ✏️ EDIT MODAL
  // --------------------------------------------------
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
          html += `<div><label>${col}</label><textarea name="${col}" ${disabled}>${value}</textarea></div>`;
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
    editModalBody.querySelectorAll("input, textarea").forEach(
      (i) => (payload[i.name] = i.value)
    );
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

  // --------------------------------------------------
  // ➕ ADD ENTRY MODAL
  // --------------------------------------------------
  openAddBtn.onclick = () => {
    addModal.style.display = "flex";
    let html = "";
    for (const [groupName, fields] of Object.entries(fieldGroups)) {
      html += `<section class="field-group"><h4>${groupName}</h4><div class="field-grid">`;
      fields.forEach((col) => {
        const type = inferInputType(col);
        const disabled = systemFields.includes(col) ? "disabled" : "";
        html += `<div><label>${col}</label><input type="${type}" name="${col}" ${disabled}/></div>`;
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
    addModalBody.querySelectorAll("input, textarea").forEach(
      (i) => (payload[i.name] = i.value)
    );
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

  // --------------------------------------------------
  // 🔍 SEARCH FILTER
  // --------------------------------------------------
  searchInput.oninput = (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = ledgerData.filter((r) =>
      Object.values(r).join(" ").toLowerCase().includes(term)
    );
    renderTable(filtered);
  };

  // --------------------------------------------------
  // 📄 CSV EXPORT
  // --------------------------------------------------
  function toCSVCell(val) {
    if (val === null || val === undefined) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  }

  function exportCurrentTableToCSV() {
    const headers = visibleColumns.slice();

    const lines = ledgerData.map((row) => {
      const map = {
        Ref: row.DeepBlueRef || "",
        "Ship Name": row.VesselName || "",
        Charterer: row.ClientName || "",
        "CP Date": row.CPDate ? new Date(row.CPDate).toLocaleDateString("en-GB") : "",
        "Claim Submitted": row.ClaimSubmittedDate
          ? new Date(row.ClaimSubmittedDate).toLocaleDateString("en-GB")
          : "",
        "Amount (USD)": row.ClaimFiledAmount ?? "",
        Status: row.ClaimStatus || "",
      };
      return headers.map((h) => toCSVCell(map[h] ?? "")).join(",");
    });

    const csv = [headers.map(toCSVCell).join(","), ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const fname = `ledger-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
      now.getDate()
    )}-${pad(now.getHours())}${pad(now.getMinutes())}.csv`;
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();
  }

  if (exportBtn) exportBtn.addEventListener("click", exportCurrentTableToCSV);

  // --------------------------------------------------
  // 🚀 INIT
  // --------------------------------------------------
  loadLedger();
});