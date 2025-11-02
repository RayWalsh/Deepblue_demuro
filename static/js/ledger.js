// ==============================================
// 📘 ledger.js — Deep Blue Ledger (Full + Advanced Settings)
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

  const PROTECTED_FIELDS = ["CaseID", "DeepBlueRef"];

  // Default visible columns (persisted)
  let visibleColumns = JSON.parse(
    localStorage.getItem("ledger_visible_columns") ||
      '["Ref","Ship Name","Charterer","CP Date","Claim Submitted","Amount (USD)","Status"]'
  );

  // Table header definition used across render/CSV/settings
  const TABLE_HEADERS = [
    "Ref",
    "Ship Name",
    "Charterer",
    "CP Date",
    "Claim Submitted",
    "Amount (USD)",
    "Status",
  ];

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
      allColumns = json.columns || [];
      // Force horizontal scroll to work even when few columns
      ensureScrollable();
      renderTable(ledgerData);
    } catch (err) {
      console.error("❌ Ledger fetch failed:", err);
      tableBody.innerHTML = `<tr><td colspan="7">⚠️ Error loading ledger.</td></tr>`;
    }
  }

  function ensureScrollable() {
    // Make sure the table area can scroll horizontally for expand/shrink
    if (tableScroll) tableScroll.style.overflowX = "auto";
    if (tableWrapper) {
      tableWrapper.style.overflowX = "auto";
      // give table a min-width so there's something to scroll
      const tableEl = document.getElementById("ledgerTable");
      if (tableEl) tableEl.style.minWidth = "900px";
    }
  }

  // --------------------------------------------------
  // 🧾 RENDER TABLE
  // --------------------------------------------------
  function renderTable(rows) {
    const headRow = document.querySelector("#ledgerTable thead tr");
    headRow.innerHTML = TABLE_HEADERS
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
        "Amount (USD)": row.ClaimFiledAmount ?? "—",
        Status: row.ClaimStatus || "—",
      };

      const tr = document.createElement("tr");
      tr.innerHTML = visibleColumns.map((col) => `<td>${rowMap[col]}</td>`).join("");
      tableBody.appendChild(tr);
    });

    // Make the "Ref" column (if visible) clickable for editing
    const refIndex = visibleColumns.indexOf("Ref");
    if (refIndex !== -1) {
      document
        .querySelectorAll(`.case-table tbody tr td:nth-child(${refIndex + 1})`)
        .forEach((cell) => {
          cell.style.cursor = "pointer";
          cell.addEventListener("click", (e) => {
            const ref = e.target.textContent.trim();
            const item = ledgerData.find((r) => (r.DeepBlueRef || "—") === ref);
            if (item) openEditModal(item);
          });
        });
    }
  }

  // --------------------------------------------------
  // ⚙️ SETTINGS MODAL (ADVANCED VERSION)
  // --------------------------------------------------
  if (openSettingsBtn && settingsModal) {
    openSettingsBtn.addEventListener("click", () => {
      console.log("🔧 Opening Settings modal");
      settingsModal.style.display = "flex";
      renderSettingsContent();
    });
  }

  closeSettingsBtn?.addEventListener("click", () => (settingsModal.style.display = "none"));
  settingsModal?.addEventListener("click", (e) => {
    if (e.target === settingsModal) settingsModal.style.display = "none";
  });

  async function renderSettingsContent() {
    const modalBody = settingsModal.querySelector(".modal-body");
    modalBody.innerHTML = `<p>Loading settings…</p>`;

    // Try to load column metadata from server (optional).
    // If it fails (404/500), we still show Column Visibility controls.
    let sqlColumns = null;
    try {
      const res = await fetch("/api/columns", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        sqlColumns = data.columns || null; // [{name,type},...]
      }
    } catch (e) {
      // ignore and degrade gracefully
      console.warn("ℹ️ /api/columns not available, showing basic settings only");
    }

    modalBody.innerHTML = `
      <div class="modal-tabs">
        <button class="active" id="tab-visibility">Visibility</button>
        <button id="tab-columns" ${sqlColumns ? "" : "disabled"}>Columns</button>
        <button id="tab-formulas" disabled>Formulas</button>
      </div>

      <div id="visibilityTab">
        <h4>👁️ Column Visibility</h4>
        <div id="columnVisibility" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;margin:1rem 0;">
          ${TABLE_HEADERS.map(
            (col) => `
              <label>
                <input type="checkbox" value="${col}" ${
              visibleColumns.includes(col) ? "checked" : ""
            }>
                ${col}
              </label>`
          ).join("")}
        </div>
        <button id="applyVisibilityBtn" class="header-add-btn small" style="background:#0e3a6d;color:white;">Apply</button>
      </div>

      <div id="columnsTab" style="display:none;">
        ${
          sqlColumns
            ? `
          <h4>🧱 Manage SQL Columns</h4>
          <ul id="colList">
            ${sqlColumns
              .map(
                (c) => `
                <li>
                  <span>${c.name}</span>
                  <span class="col-type">${c.type || ""}</span>
                  ${
                    PROTECTED_FIELDS.includes(c.name)
                      ? `<small class="disabled">Protected</small>`
                      : `<button class="delete-col" data-name="${c.name}">🗑 Delete</button>`
                  }
                </li>`
              )
              .join("")}
          </ul>

          <div class="add-column-row">
            <input id="newColName" placeholder="Column name" />
            <select id="newColType">
              <option value="NVARCHAR(255)">Text</option>
              <option value="INT">Number</option>
              <option value="BIT">Yes/No</option>
              <option value="DATETIME">Date</option>
              <option value="DECIMAL(18,2)">Money</option>
            </select>
            <button id="addColBtn">➕ Add</button>
          </div>

          <div class="reset-row">
            <button id="resetColumnsBtn" class="danger-btn">Reset Columns</button>
          </div>
        `
            : `
          <p>SQL column management is not enabled on this server. You can still adjust column visibility in the <strong>Visibility</strong> tab.</p>
        `
        }
      </div>

      <div id="formulasTab" style="display:none;">
        <h4>🧮 Formula Fields</h4>
        <p>Coming soon: define calculated fields like <code>DATEDIFF()</code>, <code>IF()</code>, etc.</p>
      </div>
    `;

    // Tabs
    const tabVis = modalBody.querySelector("#tab-visibility");
    const tabCols = modalBody.querySelector("#tab-columns");
    const tabFor = modalBody.querySelector("#tab-formulas");
    const visTab = modalBody.querySelector("#visibilityTab");
    const colsTab = modalBody.querySelector("#columnsTab");
    const forTab = modalBody.querySelector("#formulasTab");

    function activate(tab) {
      [tabVis, tabCols, tabFor].forEach((b) => b?.classList.remove("active"));
      tab.classList.add("active");
      visTab.style.display = tab === tabVis ? "block" : "none";
      colsTab.style.display = tab === tabCols ? "block" : "none";
      forTab.style.display = tab === tabFor ? "block" : "none";
    }

    tabVis?.addEventListener("click", () => activate(tabVis));
    tabCols?.addEventListener("click", () => {
      if (!tabCols.hasAttribute("disabled")) activate(tabCols);
    });
    tabFor?.addEventListener("click", () => {
      if (!tabFor.hasAttribute("disabled")) activate(tabFor);
    });

    // Apply column visibility
    modalBody.querySelector("#applyVisibilityBtn")?.addEventListener("click", () => {
      const selected = [
        ...modalBody.querySelectorAll('#columnVisibility input[type="checkbox"]:checked'),
      ].map((i) => i.value);
      if (selected.length === 0) {
        alert("At least one column must be visible.");
        return;
      }
      visibleColumns = selected;
      localStorage.setItem("ledger_visible_columns", JSON.stringify(selected));
      renderTable(ledgerData);
      settingsModal.style.display = "none";
    });

    // SQL Column admin handlers (optional)
    if (sqlColumns) {
      // Delete column
      modalBody.querySelectorAll(".delete-col").forEach((btn) =>
        btn.addEventListener("click", async () => {
          const name = btn.getAttribute("data-name");
          if (PROTECTED_FIELDS.includes(name)) {
            alert("This column is protected and cannot be deleted.");
            return;
          }
          if (!confirm(`Delete column "${name}" from SQL?`)) return;
          try {
            const res = await fetch(`/api/delete-column/${encodeURIComponent(name)}`, {
              method: "DELETE",
            });
            const result = await res.json();
            if (result.success) {
              alert("✅ Column deleted");
              await loadLedger(); // refresh data/columns
              renderSettingsContent(); // refresh modal
            } else {
              alert("❌ " + (result.error || "Failed deleting column"));
            }
          } catch (e) {
            alert("❌ " + e.message);
          }
        })
      );

      // Add column
      modalBody.querySelector("#addColBtn")?.addEventListener("click", async () => {
        const name = modalBody.querySelector("#newColName").value.trim();
        const type = modalBody.querySelector("#newColType").value;
        if (!name) return alert("Please enter a column name.");
        if (PROTECTED_FIELDS.includes(name)) return alert("That name is reserved.");
        try {
          const res = await fetch("/api/add-column", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, type }),
          });
          const result = await res.json();
          if (result.success) {
            alert("✅ Column added");
            await loadLedger();
            renderSettingsContent();
          } else {
            alert("❌ " + (result.error || "Failed adding column"));
          }
        } catch (e) {
          alert("❌ " + e.message);
        }
      });

      // Reset columns
      modalBody.querySelector("#resetColumnsBtn")?.addEventListener("click", async () => {
        if (!confirm("Reset columns to default schema?")) return;
        try {
          const res = await fetch("/api/reset-columns", { method: "POST" });
          const result = await res.json();
          if (result.success) {
            alert("✅ Columns reset");
            await loadLedger();
            renderSettingsContent();
          } else {
            alert("❌ " + (result.error || "Failed resetting columns"));
          }
        } catch (e) {
          alert("❌ " + e.message);
        }
      });
    }
  }

  // --------------------------------------------------
  // 🔍 EXPAND / SHRINK VIEW
  // --------------------------------------------------
  if (toggleBtn && tableWrapper && tableScroll) {
    toggleBtn.addEventListener("click", () => {
      expanded = !expanded;
      // class hooks if your CSS uses them
      tableWrapper.classList.toggle("expanded", expanded);
      tableScroll.classList.toggle("expanded", expanded);
      // plus hard styles for safety
      if (expanded) {
        tableWrapper.style.maxWidth = "100%";
        tableWrapper.style.overflowX = "auto";
        tableScroll.style.overflowX = "auto";
        toggleBtn.innerHTML = '<i class="fas fa-compress-arrows-alt"></i>';
        toggleBtn.title = "Shrink View";
      } else {
        tableWrapper.style.maxWidth = "95%";
        tableWrapper.style.overflowX = "auto";
        tableScroll.style.overflowX = "auto";
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
    if (lower.includes("amount") || lower.includes("rate") || lower.includes("days") || lower.includes("hours"))
      return "number";
    if (lower.includes("notes") || lower.includes("instruction")) return "textarea";
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
          html += `<div><label>${col}</label><textarea name="${col}" rows="2" ${disabled}>${value}</textarea></div>`;
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
    editModalBody.querySelectorAll("input, textarea").forEach((i) => {
      payload[i.name] = i.value;
    });

    const caseId = currentEditItem.CaseID;
    try {
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
      } else {
        alert("❌ " + (data.error || "Update failed"));
      }
    } catch (e) {
      alert("❌ " + e.message);
    }
  };

  deleteEntryBtn.onclick = async () => {
    const caseId = currentEditItem.CaseID;
    if (!confirm("Delete this entry?")) return;
    try {
      const res = await fetch(`/api/delete-ledger-item/${caseId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        alert("🗑 Entry deleted");
        editModal.style.display = "none";
        loadLedger();
      } else {
        alert("❌ " + (data.error || "Delete failed"));
      }
    } catch (e) {
      alert("❌ " + e.message);
    }
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
        if (type === "textarea") {
          html += `<div><label>${col}</label><textarea name="${col}" rows="2" ${disabled}></textarea></div>`;
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
      payload[i.name] = i.value || null;
    });

    try {
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
      } else {
        alert("❌ " + (data.error || "Insert failed"));
      }
    } catch (e) {
      alert("❌ " + e.message);
    }
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