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

  const editColumnModal = document.getElementById("editColumnModal");
  const closeEditColumnModal = document.getElementById("closeEditColumnModal");
  const cancelEditColumn = document.getElementById("cancelEditColumn");

// --------------------------------------------------
// ⚙️ STATE
// --------------------------------------------------
let ledgerData = [];
let originalLedgerData = [];
let allColumns = [];
let currentEditItem = null;
let expanded = false;

let sortState = {
  column: null,
  direction: null // "asc" | "desc"
};

const PROTECTED_FIELDS = ["CaseID", "DeepBlueRef"];

// --------------------------------------------------
// 💻 DEVICE DETECTION
// --------------------------------------------------
function isDesktop() {
  return window.innerWidth >= 1024;
}

// --------------------------------------------------
// 🏷️ COLUMN LABELS & VISIBLE COLUMNS (SQL-DRIVEN)
// --------------------------------------------------

// Pretty labels for known SQL columns — used in table headers & settings
const DISPLAY_LABELS = {
  DeepBlueRef: "Ref",
  VesselName: "Ship Name",
  ClientName: "Charterer",
  CPDate: "CP Date",
  ClaimSubmittedDate: "Claim Submitted",
  ClaimFiledAmount: "Amount (USD)",
  ClaimStatus: "Status",
};

// Helper: return user-friendly label or fallback to SQL name
function labelFor(col) {
  return DISPLAY_LABELS[col] || col;
}

// Initialise — will be filled after fetching SQL columns
let visibleColumns = [];

  // --------------------------------------------------
  // 🕓 DATE UTILITIES — ISO ENFORCEMENT & DISPLAY
  // --------------------------------------------------
  /**
   * Converts a date string or input value into an SQL-safe ISO string.
   * Returns null if invalid or empty.
   * Output example: "2025-04-29 15:45:26"
   */
  function toISO(value) {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(d)) return null;
    return d.toISOString().slice(0, 19).replace("T", " ");
  }

  /**
   * Converts an ISO string (YYYY-MM-DD HH:MM:SS) to user-friendly display.
   * Output example: "29 Apr 2025"
   */
  function displayDate(isoString) {
    if (!isoString) return "—";
    const d = new Date(isoString);
    if (isNaN(d)) return "—";
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  // --------------------------------------------------
// 📡 LOAD LEDGER (SQL-DRIVEN HEADERS)
// --------------------------------------------------
async function loadLedger() {
  try {
    console.log("📡 Fetching /api/ledger ...");
    const res = await fetch("/api/ledger", { headers: { "Cache-Control": "no-cache" } });
    const json = await res.json();
    if (!json.rows) throw new Error(json.error || "No rows returned");

    originalLedgerData = [...json.rows];
    ledgerData = [...json.rows];
    // ✅ Works whether /api/ledger returns strings OR objects
    allColumns = (json.columns || []).map(c =>
      typeof c === "string" ? c : c.name
    ).filter(Boolean);

    console.log("🧩 API columns raw:", allColumns);
    console.log("🧩 First column entry type:", typeof allColumns[0]);
    console.log("🧩 First column entry value:", allColumns[0]);

    // --------------------------------------------------
    // 🧭 DETERMINE VISIBLE COLUMNS
    // --------------------------------------------------
    // 💻📱 Show all columns on all devices (except CaseID)
visibleColumns = allColumns.filter(c => c !== "CaseID");

    renderTable(ledgerData);
  } catch (err) {
    console.error("❌ Ledger fetch failed:", err);
    tableBody.innerHTML = `<tr><td colspan="7">⚠️ Error loading ledger.</td></tr>`;
  }
}

// --------------------------------------------------
// 🧾 RENDER TABLE (SQL-DRIVEN HEADERS)
// --------------------------------------------------
function renderTable(rows) {
  const headRow = document.querySelector("#ledgerTable thead tr");
  if (!headRow) return;

  // Build table headers dynamically using visibleColumns + labels
  headRow.innerHTML = visibleColumns
  .filter(col => col !== "CaseID")
  .map(col => {
    let cls = "";

    if (sortState.column === col) {
      cls =
        sortState.direction === "asc"
          ? "sorted sorted-asc"
          : "sorted sorted-desc";
    }

    return `<th class="${cls}" data-col="${col}">${labelFor(col)}</th>`;
  })
  .join("");

  tableBody.innerHTML = "";

  rows.forEach((row) => {
  const tr = document.createElement("tr");

  visibleColumns
    .filter((col) => col !== "CaseID")
    .forEach((col) => {
      const td = document.createElement("td");

      let val = row[col];
      if (col.toLowerCase().includes("date")) val = displayDate(val);
      if (typeof val === "number") val = val.toLocaleString();
      td.textContent = val ?? "—";

      // 🔑 PRIMARY CLICK TARGET — REF COLUMN
      if (col === "DeepBlueRef") {
        td.classList.add("row-action");        // ✅ CSS now applies
        td.title = "Click to edit case";
        td.addEventListener("click", () => {
  window.location.href = `/case/${row.CaseID}`;
});
      }

      tr.appendChild(td);
    });

  tableBody.appendChild(tr);
});

  // Make "Ref" column (DeepBlueRef) clickable for editing
  const refIndex = visibleColumns.indexOf("DeepBlueRef");
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

let activeSortColumn = null;
let activeHeaderEl = null;
let menuOpen = false;

const columnMenu = document.getElementById("columnMenu");

// Open menu on header click
document.addEventListener("click", (e) => {
  const th = e.target.closest("th");

  // Clicked outside table headers → close
  if (!th || !th.closest(".data-table")) {
    columnMenu.style.display = "none";
    menuOpen = false;
    activeHeaderEl = null;
    return;
  }

  const index = [...th.parentNode.children].indexOf(th);
  const column = visibleColumns[index];

  // 🔁 Toggle if same header clicked again
  if (menuOpen && activeHeaderEl === th) {
    columnMenu.style.display = "none";
    menuOpen = false;
    activeHeaderEl = null;
    return;
  }

  // Open menu for this header
  activeSortColumn = column;
  activeHeaderEl = th;
  menuOpen = true;

  const rect = th.getBoundingClientRect();
  columnMenu.style.left = rect.right - 140 + "px";
  columnMenu.style.top = rect.bottom + "px";
  columnMenu.style.display = "flex";
});

// Handle menu clicks
columnMenu.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  // 🧱 EDIT COLUMN → open side modal
  if (btn.id === "editColumnBtn") {
  // Prefill column name (read-only for now)
  const nameInput = document.getElementById("editColumnName");
  if (nameInput && activeSortColumn) {
    nameInput.value = labelFor(activeSortColumn);
  }

  editColumnModal.classList.add("open");
  columnMenu.style.display = "none";
  menuOpen = false;
  return;
  } 

  // ⬇️ existing sort logic continues
  if (!btn.dataset.sort || !activeSortColumn) return;

  const dir = btn.dataset.sort;

  // 🔁 Toggle OFF if same sort clicked again
  if (
  sortState.column === activeSortColumn &&
  sortState.direction === dir
) {
  sortState.column = null;
  sortState.direction = null;

  ledgerData = [...originalLedgerData]; // 🔑 restore original order

  // Clear ticks
  columnMenu.querySelectorAll("button").forEach(b =>
    b.classList.remove("active")
  );

  renderTable(ledgerData);
  columnMenu.style.display = "none";
  return; // ⛔ STOP — do NOT re-sort
} else {
    sortState.column = activeSortColumn;
    sortState.direction = dir;

    ledgerData.sort((a, b) => {
      const va = a[activeSortColumn] ?? "";
      const vb = b[activeSortColumn] ?? "";

      if (typeof va === "number" && typeof vb === "number") {
        return dir === "asc" ? va - vb : vb - va;
      }

      return dir === "asc"
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
  }

  // ✅ Tick handling
  columnMenu.querySelectorAll("button").forEach((b) =>
    b.classList.remove("active")
  );

  if (sortState.column === activeSortColumn) {
    btn.classList.add("active");
  }

  renderTable(ledgerData);
  columnMenu.style.display = "none";
});

// --------------------------------------------------
// 🧠 FRIENDLY SQL TYPE LABELS
// --------------------------------------------------
function friendlyType(sqlType) {
  if (!sqlType) return "Unknown";

  const t = sqlType.toUpperCase();

  if (t.includes("NVARCHAR") || t.includes("VARCHAR")) return "Text";
  if (t.includes("INT")) return "Number";
  if (t.includes("BIT")) return "Yes/No";
  if (t.includes("DATETIME")) return "Date";
  if (t.includes("DECIMAL") || t.includes("NUMERIC") || t.includes("FLOAT")) return "Money / Decimal";
  if (t.includes("CHAR")) return "Text";
  if (t.includes("TEXT")) return "Long Text";

  return "Other";
}

// Map raw SQL types to a normalized family + friendly label + icon
function normalizeSqlType(raw) {
  const t = (raw || "").toUpperCase();

  // Order matters: check more specific patterns first
  if (t.includes("BIT"))           return { family: "boolean", label: "Yes / No", icon: "fa-check-circle" };
  if (t.includes("INT"))           return { family: "number",  label: "Number",   icon: "fa-hashtag" };
  if (t.includes("DECIMAL") || t.includes("NUMERIC") || t.includes("MONEY"))
                                   return { family: "money",   label: "Money",    icon: "fa-coins" };
  if (t.includes("DATE") || t.includes("TIME"))
                                   return { family: "date",    label: "Date/Time",icon: "fa-calendar-days" };
  if (t.includes("TEXT") || t.includes("NVARCHAR") || t.includes("VARCHAR") || t.includes("CHAR"))
                                   return { family: "text",    label: "Text",     icon: "fa-align-left" };

  // fallback
  return { family: "text", label: "Text", icon: "fa-align-left" };
}

// Return the actual badge HTML (icon + friendly label)
function getTypeBadge(rawType) {
  const { label, icon } = normalizeSqlType(rawType);
  return `<span class="col-type"><i class="fa-solid ${icon}"></i>${label}</span>`;
}

// --------------------------------------------------
// ⚙️ SETTINGS MODAL (SQL-DRIVEN)
// --------------------------------------------------
async function renderSettingsContent() {
  const modalBody = settingsModal.querySelector(".modal-body");
  modalBody.innerHTML = `<p>Loading settings…</p>`;

  // Try to load column metadata from server (optional).
  // If it fails, still show basic visibility controls.
  let sqlColumns = null;
  try {
    const res = await fetch("/api/columns", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      sqlColumns = data.columns || null; // [{name,type},...]
      allColumns = sqlColumns; // refresh cache
    }
  } catch (e) {
    console.warn("ℹ️ /api/columns not available, showing basic settings only");
  }

  // Build modal content
  modalBody.innerHTML = `
    <div class="modal-tabs">
      <button class="active" id="tab-visibility">Visibility</button>
      <button id="tab-columns" ${sqlColumns ? "" : "disabled"}>Columns</button>
      <button id="tab-formulas" disabled>Formulas</button>
    </div>

    <div id="visibilityTab">
      <h4>👁️ Column Visibility</h4>
      <div id="columnVisibility" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;margin:1rem 0;">
        ${
          (allColumns.length
            ? allColumns
            : [{ name: "DeepBlueRef" }, { name: "VesselName" }, { name: "ClientName" }]
          )
            .map(
              (col) => `
              <label style="display:flex;align-items:center;gap:8px;">
                <input type="checkbox" value="${col.name}" ${visibleColumns.includes(col.name) ? "checked" : ""}>
                <span>${labelFor(col.name)}</span>
                ${getTypeBadge(col.type)}   <!-- will show Text/Money/Date etc -->
              </label>`
            )
            .join("")
        }
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
                ${getTypeBadge(c.type)}
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
        <p>SQL column management not enabled. You can still adjust column visibility in the <strong>Visibility</strong> tab.</p>
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

  // SQL Column admin handlers (delete/add/reset)
  if (sqlColumns) {
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
            await loadLedger();
            renderSettingsContent();
          } else {
            alert("❌ " + (result.error || "Failed deleting column"));
          }
        } catch (e) {
          alert("❌ " + e.message);
        }
      })
    );

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
  if (isDesktop() && toggleBtn) {
  toggleBtn.style.display = "none"; // or toggleBtn.disabled = true;
  }
  
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
  let val = i.value.trim();
  if (i.type === "date" || i.name.toLowerCase().includes("date")) {
    payload[i.name] = toISO(val);
  } else {
    payload[i.name] = val || null;
  }
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
  let val = i.value.trim();
  if (i.type === "date" || i.name.toLowerCase().includes("date")) {
    payload[i.name] = toISO(val);
  } else {
    payload[i.name] = val || null;
  }
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
// 🧱 EDIT COLUMN SIDE MODAL — OPEN / CLOSE
// --------------------------------------------------
if (closeEditColumnModal) {
  closeEditColumnModal.onclick = () => {
    editColumnModal.classList.remove("open");
  };
}

if (cancelEditColumn) {
  cancelEditColumn.onclick = () => {
    editColumnModal.classList.remove("open");
  };
}

// --------------------------------------------------
// 🔍 SEARCH FILTER (AND + quoted phrases)
// --------------------------------------------------
searchInput.oninput = (e) => {
  const words = e.target.value.toLowerCase().split(/\s+/).filter(Boolean);

  if (!words.length) {
    renderTable(originalLedgerData);
    return;
  }

  const filtered = originalLedgerData.filter(row => {
    const haystack = Object.entries(row)
      .map(([key, value]) => {
        if (!value) return "";

        if (key.toLowerCase().includes("date")) {
          const d = new Date(value);
          if (isNaN(d)) return String(value);

          const monthShort = d.toLocaleString("en-GB", { month: "short" }).toLowerCase();
          const monthLong  = d.toLocaleString("en-GB", { month: "long" }).toLowerCase();
          const display    = displayDate(value).toLowerCase();

          return `${value} ${display} ${monthShort} ${monthLong}`;
        }

        return String(value);
      })
      .join(" ")
      .toLowerCase();

    return words.every(w => haystack.includes(w));
  });

  renderTable(filtered);

  const params = new URLSearchParams(window.location.search);
  e.target.value.trim()
    ? params.set("search", e.target.value.trim())
    : params.delete("search");

  history.replaceState(null, "", "?" + params.toString());
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
        "CP Date": displayDate(row.CPDate),
        "Claim Submitted": displayDate(row.ClaimSubmittedDate),
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
// ⚙️ SETTINGS MODAL OPEN/CLOSE HANDLERS
// --------------------------------------------------
if (openSettingsBtn && settingsModal) {
  openSettingsBtn.addEventListener("click", async () => {
    console.log("⚙️ Opening settings modal...");
    settingsModal.style.display = "flex";
    await renderSettingsContent();
  });
}

if (closeSettingsBtn) {
  closeSettingsBtn.addEventListener("click", () => {
    settingsModal.style.display = "none";
  });
}

settingsModal?.addEventListener("click", (e) => {
  if (e.target === settingsModal) settingsModal.style.display = "none";
});

// --------------------------------------------------
// 🔁 RESTORE SEARCH FROM URL
// --------------------------------------------------
function restoreSearchFromURL() {
  const params = new URLSearchParams(window.location.search);
  const search = params.get("search");

  if (search) {
    searchInput.value = search;
    searchInput.dispatchEvent(new Event("input"));
  }
}

// --------------------------------------------------
// 🚀 INIT
// --------------------------------------------------
loadLedger().then(restoreSearchFromURL);
});