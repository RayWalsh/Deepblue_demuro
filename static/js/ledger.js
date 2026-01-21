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

  const tableWrapper = document.querySelector(".table-wrapper");
  const tableScroll = document.querySelector(".table-scroll");

  const editColumnModal = document.getElementById("editColumnModal");
  const closeEditColumnModal = document.getElementById("closeEditColumnModal");
  const cancelEditColumn = document.getElementById("cancelEditColumn");

  /* 🔍 FILTER COLUMN MODAL */
  const filterModal = document.getElementById("filterColumnModal");
  const filterModalBody = document.getElementById("filterModalBody");
  const filterModalTitle = document.getElementById("filterModalTitle");
  const closeFilterModal = document.getElementById("closeFilterModal");
  const clearFilterBtn = document.getElementById("clearFilterBtn");
  const applyFilterBtn = document.getElementById("applyFilterBtn");

  const FIELD_TYPES = [
  { value: "text",     label: "Text" },
  { value: "number",   label: "Number" },
  { value: "money",    label: "Currency" },
  { value: "date",     label: "Date" },
  { value: "datetime", label: "Date & Time" },
  { value: "boolean",  label: "Yes / No" },
  { value: "choice",   label: "Choice (Dropdown)" }
  ];

// --------------------------------------------------
// ⚙️ STATE
// --------------------------------------------------
window.ledgerData = [];
let originalLedgerData = [];
let allColumns = [];
let expanded = false;

let choiceColumns = new Set();
let choiceOptions = {}; 

let activeFilters = {};        // { ColumnName: [values...] }
let currentFilterColumn = null;

let sortState = {
  column: null,
  direction: null // "asc" | "desc"
};

const PROTECTED_FIELDS = ["CaseID", "DeepBlueRef"];

// --------------------------------------------------
// 🔍 COLUMN FILTER MODAL
// --------------------------------------------------
function openFilterModal(columnName) {
  currentFilterColumn = columnName;

  const colMeta = allColumns.find(c => c.name === columnName);
  filterModalTitle.textContent = `Filter: ${colMeta?.display || columnName}`;

  // Collect distinct values from full dataset
  const values = [
    ...new Set(
      originalLedgerData
        .map(r => r[columnName])
        .filter(v => v !== null && v !== undefined && v !== "")
    )
  ].sort();

  const selected = activeFilters[columnName] || [];

  filterModalBody.innerHTML = `
    <ul class="filter-list">
      ${values.map(v => `
        <li>
          <label>
            <input
              type="checkbox"
              value="${v}"
              ${selected.includes(v) ? "checked" : ""}
            />
            ${v}
          </label>
        </li>
      `).join("")}
    </ul>
  `;

  filterModal.classList.add("open");
}

// --------------------------------------------------
// 🔍 APPLY ACTIVE COLUMN FILTERS
// --------------------------------------------------
function applyFilters() {
  ledgerData = originalLedgerData.filter(row => {
    return Object.entries(activeFilters).every(([col, values]) => {
      return values.includes(String(row[col]));
    });
  });

  renderTable(ledgerData);
}

// --------------------------------------------------
// 🔘 FILTER MODAL BUTTON HANDLERS
// --------------------------------------------------
applyFilterBtn.onclick = () => {
  const checked = [
    ...filterModalBody.querySelectorAll("input:checked")
  ].map(i => i.value);

  if (checked.length) {
    activeFilters[currentFilterColumn] = checked;
  } else {
    delete activeFilters[currentFilterColumn];
  }

  applyFilters();
  filterModal.classList.remove("open");
};

clearFilterBtn.onclick = () => {
  delete activeFilters[currentFilterColumn];
  applyFilters();
  filterModal.classList.remove("open");
};

closeFilterModal.onclick = () => {
  filterModal.classList.remove("open");
};

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
window.visibleColumns = [];

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

  function displayDateTime(isoString) {
    if (!isoString) return "—";
    const d = new Date(isoString);
    if (isNaN(d)) return "—";

    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

// --------------------------------------------------
// 🔽 CHOICE FIELD RENDERER (GLOBAL SCOPE)
// --------------------------------------------------
window.renderChoiceSelect = function renderChoiceSelect({ name, value, disabled = false }) {
  const options = choiceOptions[name] || [];

  const optsHtml = options.map(opt => `
    <option value="${opt}" ${String(opt) === String(value) ? "selected" : ""}>
      ${opt}
    </option>
  `).join("");

  return `
    <select name="${name}" ${disabled ? "disabled" : ""}>
      <option value="">— Select —</option>
      ${optsHtml}
    </select>
  `;
}

  //** 
  //* 🧩 BUILD PAYLOAD FROM FORM INPUTS (metadata-driven)
  //** 
  window.buildPayloadFromInputs = function buildPayloadFromInputs(container) {
    const payload = {};

    container.querySelectorAll("input, textarea, select").forEach((i) => {
      const name = i.name;
      const raw = i.value?.trim?.() ?? "";

      const meta = allColumns.find(c => c.name === name);
      const fieldType = meta?.fieldType;

      // Empty values
      if (!raw && fieldType !== "boolean") {
        payload[name] = null;
        return;
      }

      // 🗓 DATE → midnight
      if (fieldType === "date") {
        payload[name] = toISO(raw + " 00:00");
        return;
      }

      // 🕓 DATETIME
      if (fieldType === "datetime") {
        payload[name] = toISO(raw);
        return;
      }

      // ✅ BOOLEAN
      if (fieldType === "boolean") {
        payload[name] = i.checked ? 1 : 0;
        return;
      }

      // 🔢 NUMBER / MONEY
      if (fieldType === "number" || fieldType === "money") {
        payload[name] = raw === "" ? null : Number(raw);
        return;
      }

      // 📝 DEFAULT (text, choice, lookup, etc.)
      payload[name] = raw;
    });

    return payload;
  }

  // --------------------------------------------------
  // 🟣 LOAD CHOICE OPTIONS (for pill validation)
  // Supports string[] OR object[] API responses
  // --------------------------------------------------
  async function loadChoiceOptions() {
    choiceOptions = {};

    const choiceCols = allColumns
      .filter(c => c.fieldType === "choice")
      .map(c => c.name);

    for (const col of choiceCols) {
      try {
        const res = await fetch(
          `/api/column-choices/${encodeURIComponent(col)}`,
          { cache: "no-store" }
        );

        if (!res.ok) continue;

        const json = await res.json();

        console.log(`📦 Raw choices response for ${col}:`, json);

        const normalized = (json.choices || [])
          .map(c => {
            // ✅ Handle BOTH strings and objects
            if (typeof c === "string") {
              return c.trim().toLowerCase();
            }

            const raw =
              c.Value ??
              c.value ??
              c.ChoiceValue ??
              c.choiceValue ??
              c.Label ??
              c.label ??
              "";

            return String(raw).trim().toLowerCase();
          })
          .filter(Boolean);

        console.log(`🧪 Normalized choices for ${col}:`, normalized);

        choiceOptions[col] = normalized;

      } catch (e) {
        console.warn(`⚠️ Failed loading choices for ${col}`, e);
      }
    }

    console.log("🟣 Loaded choice options (final):", choiceOptions);
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
      // Columns now come from SQL with name + display
  // Example: { name: "VesselName", display: "Ship Name" }
  allColumns = (json.columns || []).filter(c => c && c.name);
  window.allColumns = allColumns; // 🔑 expose globally

  // 🟣 Load valid choices for choice columns
  await loadChoiceOptions();



  // --------------------------------------------------
  // 🟣 Mark choice columns from API metadata
  // --------------------------------------------------
  choiceColumns.clear();

  allColumns.forEach(c => {
    if (c.fieldType === "choice") {
      choiceColumns.add(c.name);
    }
  });

  console.log("🟣 Choice columns (from metadata):", [...choiceColumns]);

  console.log("🟣 Choice columns:", [...choiceColumns]);

      console.log("🧩 API columns raw:", allColumns);
      console.log("🧩 First column entry type:", typeof allColumns[0]);
      console.log("🧩 First column entry value:", allColumns[0]);

  // --------------------------------------------------
  // 🧠 RESTORE / DETERMINE VISIBLE COLUMNS
  // --------------------------------------------------

  // 1️⃣ Restore saved view state (from table_settings.js)
  if (typeof window.loadViewState === "function") {
    window.loadViewState();
  }

  // 2️⃣ Fallback if nothing restored (first visit)
  if (!Array.isArray(window.visibleColumns) || window.visibleColumns.length === 0) {
    window.visibleColumns = allColumns.filter(c => c.name !== "CaseID");
  }

  // 3️⃣ Render using resolved column order
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
  .filter(c => c.name !== "CaseID")
  .map(c => {
    let cls = "";

    if (sortState.column === c.name) {
      cls =
        sortState.direction === "asc"
          ? "sorted sorted-asc"
          : "sorted sorted-desc";
    }

    return `
      <th class="${cls}" data-col="${c.name}">
        ${c.display || c.name}
      </th>
    `;
  })
  .join("");

  tableBody.innerHTML = "";

  rows.forEach((row) => {
  const tr = document.createElement("tr");

  visibleColumns
  .filter(c => c.name !== "CaseID")
  .forEach((c) => {
    const col = c.name; // 🔑 normalize here
    const td = document.createElement("td");

    let val = row[col];
    const colMeta = allColumns.find(c => c.name === col);
    const fieldType = colMeta?.fieldType;

    if (fieldType === "date") {
      val = displayDate(val);               // date only
    }

    if (fieldType === "datetime") {
      val = displayDateTime(val);           // date + time
    }
    if (typeof val === "number") val = val.toLocaleString();

    if (choiceColumns.has(col) && val) {
      const values = Array.isArray(val) ? val : [val];

      const norm = (s) => String(s ?? "").trim().toLowerCase();
      const allowed = choiceOptions[col] || [];

      td.innerHTML = values.map(v => {
        const hasRules = allowed.length > 0;
        const isValid = !hasRules || allowed.map(norm).includes(norm(v)); // ✅ key line

        const cls = isValid ? "pill" : "pill pill-warning";
        
        console.log({
          column: col,
          value: v,
          allowed,
          hasRules: allowed.length > 0,
          valid: (!allowed.length) || allowed.map(norm).includes(norm(v))
        });
        
        return `<span class="${cls}">${v}</span>`;
      }).join("");

    } else {
      td.textContent = val ?? "—";
    }

      // 🔑 PRIMARY CLICK TARGET — REF COLUMN
      if (col === "DeepBlueRef") {
        td.classList.add("row-action");        // ✅ CSS now applies
        td.title = "Click to edit case";
        td.addEventListener("click", () => {
          window.location.href = `/case-dashboard/${row.CaseID}`;
        });
      }

      tr.appendChild(td);
    });

  tableBody.appendChild(tr);
  });
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
  activeSortColumn = column.name; // ✅ ALWAYS a string
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

  // 🧱 FILTER COLUMN → open filter side modal
  if (btn.id === "filterColumnBtn") {
    if (!activeSortColumn) return;

    openFilterModal(activeSortColumn);

    columnMenu.style.display = "none";
    menuOpen = false;
    activeHeaderEl = null;
    return;
  }

  // 🧱 EDIT COLUMN → open side modal
  if (btn.id === "editColumnBtn") {
    if (!activeSortColumn) return;

    editColumnModal.classList.add("open");

    columnMenu.style.display = "none";
    menuOpen = false;
    activeHeaderEl = null;

    loadColumnMetadata(activeSortColumn);
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

    ledgerData = [...originalLedgerData]; // restore original order

    columnMenu.querySelectorAll("button").forEach(b =>
      b.classList.remove("active")
    );

    renderTable(ledgerData);
    columnMenu.style.display = "none";
    menuOpen = false;
    activeHeaderEl = null;
    return;
  }

  // ⬆️ Apply new sort
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

  columnMenu.querySelectorAll("button").forEach(b =>
    b.classList.remove("active")
  );

  btn.classList.add("active");

  renderTable(ledgerData);
  columnMenu.style.display = "none";
  menuOpen = false;
  activeHeaderEl = null;
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
// 🧩 COLUMN METADATA (READ-ONLY)
// --------------------------------------------------
async function loadColumnMetadata(columnName) {
  const body = editColumnModal.querySelector(".side-modal-body");
  body.innerHTML = `<p class="muted">Loading column metadata…</p>`;

  try {
    const res = await fetch(`/api/column-metadata/${encodeURIComponent(columnName)}`, {
      cache: "no-store",
    });
    const json = await res.json();
    if (!json.success) throw new Error("Failed loading metadata");

    const col = json.column;
    const choices = json.choices || [];

    // 🔽 Fetch existing column groups
    let groups = [];
    try {
      const gRes = await fetch("/api/column-groups", { cache: "no-store" });
      const gJson = await gRes.json();
      groups = gJson.groups || [];
    } catch (e) {
      console.warn("Could not load column groups");
    }

    body.innerHTML = `
      <div class="column-meta-grid">
        <div class="form-group">
          <label>Name</label>
          <input value="${col.ColumnName}" disabled />
        </div>

        <div class="form-group">
          <label>Display Name</label>
          <input id="editDisplayName" value="${col.DisplayName || ""}" />
        </div>

        <div class="form-group">
          <label>Field Type</label>
          <select id="editFieldType">
            ${FIELD_TYPES.map(t => `
              <option value="${t.value}" ${t.value === col.FieldType ? "selected" : ""}>
                ${t.label}
              </option>
            `).join("")}
          </select>

          <small class="muted">
            Changing field type may affect existing data.
          </small>
        </div>

        <div class="form-group">
          <label>Group</label>
          <select id="editGroupName">
            <option value="">—</option>
            ${groups.map(g => `
              <option value="${g}" ${g === (col.GroupName || "") ? "selected" : ""}>
                ${g}
              </option>
            `).join("")}
          </select>
        </div>
      </div>

      <div class="form-inline">
        <label>
          <input id="editIsEditable" type="checkbox" ${col.IsEditable ? "checked" : ""} />
          Editable
        </label>

        <label>
          <input id="editIsVisible" type="checkbox" ${col.IsVisible ? "checked" : ""} />
          Visible
        </label>
      </div>

      ${col.FieldType === "choice" ? renderEditableChoiceList(choices) : ""}
    `;

    const addChoiceBtn = body.querySelector("#addChoiceBtn");
    const choiceList = body.querySelector(".choice-list.editable");

    if (addChoiceBtn && choiceList) {
      addChoiceBtn.addEventListener("click", () => {
        choiceList.insertAdjacentHTML(
          "beforeend",
          createChoiceRow("", true)
        );

        // Focus new choice input
        const inputs = choiceList.querySelectorAll('input[type="text"]');
        inputs[inputs.length - 1]?.focus();
      });
    }

    // 🔼🔽 Move choice up / down (event delegation)
    if (choiceList) {
      choiceList.addEventListener("click", (e) => {
        const upBtn = e.target.closest(".choice-up");
        const downBtn = e.target.closest(".choice-down");
        if (!upBtn && !downBtn) return;

        e.preventDefault();

        const li = e.target.closest("li");
        if (!li) return;

        if (upBtn) {
          const prev = li.previousElementSibling;
          if (prev) choiceList.insertBefore(li, prev);
        }

        if (downBtn) {
          const next = li.nextElementSibling;
          if (next) choiceList.insertBefore(next, li);
        }
      });
    }

  } catch (err) {
    console.error(err);
    body.innerHTML = `<p class="error">Failed to load column metadata</p>`;
  }
}

  function renderEditableChoiceList(choices) {
    return `
      <hr />
      <h4>Choices</h4>

      <ul class="choice-list editable">
        ${choices
          .sort((a, b) => a.SortOrder - b.SortOrder)
          .map(
            (c, idx) => `
            <li data-index="${idx}">
              <input
                type="text"
                value="${c.Value}"
                ${c.IsActive ? "" : "class='muted'"}
              />

              <button type="button" class="choice-up">↑</button>
              <button type="button" class="choice-down">↓</button>

              <label title="Active">
                <input type="checkbox" ${c.IsActive ? "checked" : ""} />
              </label>
            </li>
          `
          )
          .join("")}
      </ul>

      <button id="addChoiceBtn" class="secondary-btn small">
        ➕ Add choice
      </button>
    `;
  }

function createChoiceRow(value = "", isActive = true) {
  return `
    <li>
      <input
        type="text"
        value="${value}"
      />

      <button type="button" class="choice-up">↑</button>
      <button type="button" class="choice-down">↓</button>

      <label title="Active">
        <input type="checkbox" ${isActive ? "checked" : ""} />
      </label>
    </li>
  `;
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
  window.fieldGroups = {
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

  window.systemFields = ["CaseID", "CreatedAt"];

  window.inferInputType = function inferInputType(colName) {
    // --------------------------------------------------
    // 1️⃣ Try metadata first (source of truth)
    // --------------------------------------------------
    const meta = allColumns.find(c => c.name === colName);

    if (meta?.fieldType) {
      switch (meta.fieldType) {
        case "date":
          return "date";

        case "datetime":
          return "datetime-local";

        case "number":
        case "money":
          return "number";

        case "boolean":
          return "checkbox";

        case "choice":
          return "select"; // (we’ll wire this later)

        case "text":
        default:
          return "text";
      }
    }



    // --------------------------------------------------
    // 2️⃣ Fallback heuristics (only if no metadata)
    // --------------------------------------------------
    const lower = colName.toLowerCase();

    if (lower.includes("notes") || lower.includes("instruction"))
      return "textarea";

    if (
      lower.includes("amount") ||
      lower.includes("rate") ||
      lower.includes("days") ||
      lower.includes("hours")
    )
      return "number";

    if (lower.includes("date"))
      return "date";

    return "text";
  }


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

const saveColumnBtn = editColumnModal.querySelector(".header-add-btn");

if (saveColumnBtn) {
  saveColumnBtn.onclick = async () => {
    if (!activeSortColumn) return;

    // --------------------------------------------------
    // 🧩 COLLECT CHOICES (if applicable)
    // --------------------------------------------------
    const choiceRows = editColumnModal.querySelectorAll(
      ".choice-list.editable li"
    );

    const choices = [...choiceRows].map((li, idx) => {
      const valueInput = li.querySelector('input[type="text"]');
      const activeInput = li.querySelector('input[type="checkbox"]');

      return {
        Value: valueInput?.value.trim(),
        IsActive: activeInput?.checked ?? true,
        SortOrder: idx + 1
      };
    }).filter(c => c.Value); // remove empty rows

    const payload = {
      DisplayName: document.getElementById("editDisplayName")?.value || null,
      GroupName: document.getElementById("editGroupName")?.value || null,
      FieldType: document.getElementById("editFieldType")?.value || null,
      IsEditable: document.getElementById("editIsEditable")?.checked || false,
      IsVisible: document.getElementById("editIsVisible")?.checked || false,
    };

    try {
      const res = await fetch(
        `/api/column-metadata/${encodeURIComponent(activeSortColumn)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || "Update failed");
      }

      // --------------------------------------------------
      // 💾 SAVE CHOICES (only if present)
      // --------------------------------------------------
      if (choices.length) {
        await fetch(
          `/api/column-choices/${encodeURIComponent(activeSortColumn)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ choices }),
          }
        );
      }

      // ✅ Success UX
      editColumnModal.classList.remove("open");
      await loadLedger(); // refresh headers
      alert("✅ Column updated");

    } catch (err) {
      console.error(err);
      alert("❌ Failed to save column settings");
    }
  };
}

// --------------------------------------------------
// 🔍 SEARCH FILTER (AND + quoted phrases)
// --------------------------------------------------
searchInput.oninput = (e) => {
  const words = e.target.value.toLowerCase().split(/\s+/).filter(Boolean);

  // 🔑 IMPORTANT:
  // If column filters are active, search should apply on TOP of them
  const baseData =
    Object.keys(activeFilters).length
      ? ledgerData
      : originalLedgerData;

  if (!words.length) {
    renderTable(baseData);
    return;
  }

  const filtered = baseData.filter(row => {
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
  const headers = visibleColumns;

  const lines = ledgerData.map((row) =>
    headers
      .map((c) => toCSVCell(row[c.name] ?? ""))
      .join(",")
  );

  const headerRow = headers.map((c) =>
    toCSVCell(c.display || c.name)
  ).join(",");

  const csv = [headerRow, ...lines].join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");

  a.href = URL.createObjectURL(blob);
  a.download = `ledger-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate()
  )}.csv`;

  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
}

  if (exportBtn) exportBtn.addEventListener("click", exportCurrentTableToCSV);



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
  // 🔁 External refresh hook (used by Table Settings)
  // --------------------------------------------------
  window.refreshLedgerView = function () {
        if (Array.isArray(window.ledgerData)) {
      renderTable(window.ledgerData);
    }

  };

  window.reloadLedger = function () {
    loadLedger();
  };

  // --------------------------------------------------
  // 🚀 INIT
  // --------------------------------------------------
  loadLedger().then(restoreSearchFromURL);
});