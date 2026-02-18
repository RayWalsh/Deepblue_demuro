// ==============================================
// ⚙️ Table Settings — Side Modal (Ledger)
// Tabs: Columns | Conditional Formatting (persisted)
// Persistence: localStorage (client-side)
// ==============================================

// --------------------------------------------------
// 🧹 DEV ONLY: Reset ledger view state via URL flag
// --------------------------------------------------
if (location.search.includes("resetLedgerView")) {
  localStorage.removeItem("ledger_table_view");
  console.log("🔁 Ledger view state reset (early)");
}

// --------------------------------------------------
// 🔔 Toast helper (global)
// --------------------------------------------------
window.showToast = function (message, timeout = 2000) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.remove("hidden");
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
    toast.classList.add("hidden");
  }, timeout);
};

// --------------------------------------------------
// 🔁 Helpers
// --------------------------------------------------
function swap(arr, i, j) {
  const tmp = arr[i];
  arr[i] = arr[j];
  arr[j] = tmp;
}

// Small uid helper (Safari-safe)
function uid() {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return "rule-" + Math.random().toString(16).slice(2) + "-" + Date.now();
}

// Ledger-specific storage key
const STORAGE_KEY = "ledger_table_view";

// --------------------------------------------------
// 🧠 Persistence helpers
// --------------------------------------------------
function saveViewState() {
  if (!Array.isArray(window.visibleColumns)) return;

  const payload = {
    columns: {
      order: window.visibleColumns.map(c => c.name),
      hidden: (window.allColumns || [])
        .filter(c => !window.visibleColumns.some(v => v.name === c.name))
        .map(c => c.name),
    },
    formatting: {
      rules: window.conditionalFormattingRules || []
    }
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadViewState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw || !Array.isArray(window.allColumns)) return;

    const state = JSON.parse(raw);

    // ---------------------------------------------
    // 🧠 COLUMN STATE (new or legacy)
    // ---------------------------------------------
    let order = [];
    let hidden = [];

    if (state.columns) {
      // ✅ New schema
      order = state.columns.order || [];
      hidden = state.columns.hidden || [];
    } else if (state.order) {
      // ♻️ Legacy schema (migrate)
      order = state.order;
      hidden = state.hidden || [];
    }

    const ordered = [];
    const seen = new Set();

    order.forEach(name => {
      const col = window.allColumns.find(c => c.name === name);
      if (col) {
        ordered.push(col);
        seen.add(name);
      }
    });

    window.allColumns.forEach(c => {
      if (!seen.has(c.name) && !hidden.includes(c.name)) {
        ordered.push(c);
      }
    });

    window.visibleColumns = ordered;

    // ---------------------------------------------
    // 🎨 CONDITIONAL FORMATTING (normalize shape)
    // ---------------------------------------------
    const storedRules =
      state.formatting?.rules && Array.isArray(state.formatting.rules)
        ? state.formatting.rules
        : [];

    window.conditionalFormattingRules = storedRules
      .filter(r => r && r.column && r.operator)
      .map(r => ({
        id: r.id || uid(),
        enabled: r.enabled !== false,
        target: r.target || "row",
        style: {
          backgroundColor: r.style?.backgroundColor || "#e6fffa"
        },
        ...r
      }));

  } catch (e) {
    console.warn("Failed to restore table view state", e);
  }
}

// Expose for ledger.js
window.saveViewState = saveViewState;
window.loadViewState = loadViewState;

// --------------------------------------------------
// 🚀 Main
// --------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  const openBtn   = document.getElementById("openSettingsBtn");
  const modal     = document.getElementById("tableSettingsModal");
  const closeBtn  = document.getElementById("closeTableSettingsBtn");
  const cancelBtn = document.getElementById("cancelTableSettingsBtn");
  const applyBtn  = document.getElementById("applyTableSettingsBtn");
  const list      = document.getElementById("tableSettingsColumnList");

  if (!openBtn || !modal || !list) return;

  
    // --------------------------------------------------
    // 🧭 Tabs (dashboard-style: .tab-bar .tab + #tab-*)
    // HTML expects:
    //  - .tab-bar .tab[data-tab="columns|formatting"]
    //  - #tab-columns, #tab-formatting
    // --------------------------------------------------
    const tabs = modal.querySelectorAll(".tab-bar .tab");

    function setActiveTab(name) {
      tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === name));

      const columnsPanel = modal.querySelector("#tab-columns");
      const formattingPanelEl = modal.querySelector("#tab-formatting");

      columnsPanel?.classList.toggle("active", name === "columns");
      formattingPanelEl?.classList.toggle("active", name === "formatting");

      // Render on tab switch
      if (name === "columns") renderList();
      if (name === "formatting") renderRules();
    }

    tabs.forEach(tab => {
      tab.addEventListener("click", () => setActiveTab(tab.dataset.tab));
    });

  // --------------------------------------------------
  // 🎨 Conditional Formatting UI (TAB PANEL, NOT INJECTED)
  // Requires: <div id="ledgerFormattingPanel"></div> inside formatting panel
  // --------------------------------------------------
  const formattingPanel = modal.querySelector("#ledgerFormattingPanel");
  let formattingBound = false;

  function ensureFormattingUI() {
    if (!formattingPanel) return null;

    // Only build once
    if (formattingPanel.dataset.ready === "1") return formattingPanel;

    formattingPanel.dataset.ready = "1";
    formattingPanel.innerHTML = `
      <h3 class="table-settings-heading">Conditional Formatting</h3>

      <div class="ledger-formatting-actions">
        <button type="button" id="addLedgerRuleBtn" class="secondary-btn small">
          ➕ Add rule
        </button>
      </div>

      <ul id="ledgerRuleList" class="ledger-rule-list"></ul>
    `;

    return formattingPanel;
  }

  function renderRules() {
    const panel = ensureFormattingUI();
    if (!panel) return;

    const ruleList = panel.querySelector("#ledgerRuleList");
    if (!ruleList) return;

    const rules = window.conditionalFormattingRules || [];
    ruleList.innerHTML = "";

    rules.forEach(rule => {
      const li = document.createElement("li");
      li.className = "ledger-rule-item";
      li.dataset.id = rule.id;

      li.innerHTML = `
        <div class="rule-card">
          <!-- Row 1 -->
          <div class="rule-row rule-row-1">
            <label class="rule-field">
              <span>Column</span>
              <select data-field="column">
                ${(window.allColumns || []).map(c => `
                  <option value="${c.name}" ${c.name === rule.column ? "selected" : ""}>
                    ${c.display || c.name}
                  </option>
                `).join("")}
              </select>
            </label>

            <label class="rule-field">
              <span>Operator</span>
              <select data-field="operator">
                <option value="equals" ${rule.operator === "equals" ? "selected" : ""}>equals</option>
                <option value="not_equals" ${rule.operator === "not_equals" ? "selected" : ""}>not equals</option>
                <option value="contains" ${rule.operator === "contains" ? "selected" : ""}>contains</option>
                <option value="gt" ${rule.operator === "gt" ? "selected" : ""}>&gt;</option>
                <option value="lt" ${rule.operator === "lt" ? "selected" : ""}>&lt;</option>
              </select>
            </label>

            <label class="rule-field">
              <span>Value</span>
              <input data-field="value" value="${rule.value ?? ""}" />
            </label>
          </div>

          <!-- Row 2 -->
          <div class="rule-row rule-row-2">
            <label class="rule-field rule-color">
              <span>Color</span>
              <input type="color" data-field="backgroundColor"
                value="${rule.style?.backgroundColor || "#e6fffa"}" />
            </label>

            <label class="rule-toggle">
              <span>On</span>
              <input type="checkbox" data-field="enabled" ${rule.enabled ? "checked" : ""} />
            </label>

            <button type="button" class="danger-btn small rule-delete" data-action="delete" title="Delete">
              🗑
            </button>
          </div>
        </div>
      `;

      ruleList.appendChild(li);
    });
  }

  function bindFormattingEvents() {
    const panel = ensureFormattingUI();
    if (!panel) return;

    if (formattingBound) return; // 🔒 prevent duplicate bindings
    formattingBound = true;

    const addBtn = panel.querySelector("#addLedgerRuleBtn");
    const ruleList = panel.querySelector("#ledgerRuleList");

    addBtn?.addEventListener("click", () => {
      const firstCol = window.allColumns?.[0]?.name || "ClaimStatus";

      window.conditionalFormattingRules = window.conditionalFormattingRules || [];
      window.conditionalFormattingRules.push({
        id: uid(),
        enabled: true,
        target: "row",
        column: firstCol,
        operator: "equals",
        value: "",
        style: { backgroundColor: "#e6fffa" }
      });

      renderRules();
    });

    // Input delegation
    ruleList?.addEventListener("input", (e) => {
      const li = e.target.closest(".ledger-rule-item");
      if (!li) return;

      const rules = window.conditionalFormattingRules || [];
      const rule = rules.find(r => r.id === li.dataset.id);
      if (!rule) return;

      const field = e.target.dataset.field;
      if (!field) return;

      if (field === "backgroundColor") {
        rule.style = rule.style || {};
        rule.style.backgroundColor = e.target.value;
        return;
      }

      if (field === "enabled") {
        rule.enabled = e.target.checked;
        return;
      }

      rule[field] = e.target.value;
    });

    // Delete delegation
    ruleList?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action='delete']");
      if (!btn) return;

      const li = btn.closest(".ledger-rule-item");
      if (!li) return;

      window.conditionalFormattingRules =
        (window.conditionalFormattingRules || []).filter(r => r.id !== li.dataset.id);

      renderRules();
    });
  }

  // --------------------------------------------------
  // Open modal
  // --------------------------------------------------
  openBtn.addEventListener("click", () => {
    // Columns not ready at all
    if (!Array.isArray(window.allColumns)) {
      showToast("Columns still loading… please try again");
      return;
    }

    // Columns loaded but visibleColumns not initialised yet
    if (!Array.isArray(window.visibleColumns) || window.visibleColumns.length === 0) {
      window.visibleColumns = window.allColumns.filter(c => c.name !== "CaseID");
    }

    modal.classList.add("open");

    // default tab
    setActiveTab("columns");

    // formatting tab setup (no DOM injection)
    ensureFormattingUI();
    bindFormattingEvents();
    renderRules();
  });

  // --------------------------------------------------
  // Close helpers
  // --------------------------------------------------
  function closeModal() {
    modal.classList.remove("open");
  }

  closeBtn?.addEventListener("click", closeModal);
  cancelBtn?.addEventListener("click", closeModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("open")) {
      closeModal();
    }
  });

  // --------------------------------------------------
  // Render list (single source of truth)
  // --------------------------------------------------
  function renderList() {
    list.innerHTML = "";

    if (!Array.isArray(window.allColumns) || window.allColumns.length === 0) {
      list.innerHTML = `
        <li class="table-settings-item muted">
          Columns not loaded yet
        </li>`;
      return;
    }

    if (!Array.isArray(window.visibleColumns)) {
      window.visibleColumns = [];
    }

    const visibleNames = window.visibleColumns.map(c => c.name);

    // Visible columns
    window.visibleColumns.forEach((col, index) => {
      const li = document.createElement("li");
      li.className = "table-settings-item";
      li.dataset.index = index;

      li.innerHTML = `
        <div class="table-settings-left">
          <div class="table-settings-title">
            <input
              type="checkbox"
              class="col-toggle"
              data-name="${col.name}"
              checked
            />
            <span class="table-settings-label">
              ${col.display || col.name}
            </span>
          </div>
          ${
            col.fieldType
              ? `<span class="table-settings-type">${col.fieldType}</span>`
              : ""
          }
        </div>

        <div class="table-settings-arrows">
          <button class="move-up" ${index === 0 ? "disabled" : ""}>↑</button>
          <button class="move-down"
            ${index === window.visibleColumns.length - 1 ? "disabled" : ""}>
            ↓
          </button>
        </div>
      `;

      list.appendChild(li);
    });

    // Hidden columns
    window.allColumns.forEach(col => {
      if (visibleNames.includes(col.name)) return;

      const li = document.createElement("li");
      li.className = "table-settings-item muted";

      li.innerHTML = `
        <div class="table-settings-left">
          <div class="table-settings-title">
            <input
              type="checkbox"
              class="col-toggle"
              data-name="${col.name}"
            />
            <span class="table-settings-label">
              ${col.display || col.name}
            </span>
          </div>
          ${
            col.fieldType
              ? `<span class="table-settings-type">${col.fieldType}</span>`
              : ""
          }
        </div>
      `;

      list.appendChild(li);
    });
  }

  // --------------------------------------------------
  // Handle arrow clicks (visible rows only)
  // --------------------------------------------------
  list.addEventListener("click", (e) => {
    const row = e.target.closest(".table-settings-item");
    if (!row || !row.hasAttribute("data-index")) return;

    const index = Number(row.dataset.index);
    if (Number.isNaN(index)) return;

    if (e.target.classList.contains("move-up") && index > 0) {
      swap(window.visibleColumns, index, index - 1);
      renderList();
    }

    if (
      e.target.classList.contains("move-down") &&
      index < window.visibleColumns.length - 1
    ) {
      swap(window.visibleColumns, index, index + 1);
      renderList();
    }
  });

  // --------------------------------------------------
  // Apply (persist + refresh ledger)
  // --------------------------------------------------
  applyBtn?.addEventListener("click", () => {
    const checkedNames = new Set(
      [...list.querySelectorAll(".col-toggle:checked")]
        .map(i => i.dataset.name)
    );

    const nextVisible = [];

    // Preserve existing order
    window.visibleColumns.forEach(col => {
      if (checkedNames.has(col.name)) {
        nextVisible.push(col);
        checkedNames.delete(col.name);
      }
    });

    // Append newly enabled columns
    checkedNames.forEach(name => {
      const col = window.allColumns.find(c => c.name === name);
      if (col) nextVisible.push(col);
    });

    window.visibleColumns = nextVisible;

    // Persist both columns + formatting rules
    saveViewState();

    if (typeof window.refreshLedgerView === "function") {
      window.refreshLedgerView();
    }

    closeModal();
    showToast("View updated");
  });

  // --------------------------------------------------
  // Restore saved view on load
  // --------------------------------------------------
  loadViewState();
});