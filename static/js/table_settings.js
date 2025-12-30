// ==============================================
// ⚙️ Table Settings — Side Modal (Ledger)
// Columns: reorder + visibility
// Persistence: localStorage (client-side)
// ==============================================

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

// Ledger-specific storage key
const STORAGE_KEY = "ledger_table_view";

// --------------------------------------------------
// 🧠 Persistence helpers
// --------------------------------------------------
function saveViewState() {
  if (!Array.isArray(window.visibleColumns)) return;

  const payload = {
    order: window.visibleColumns.map(c => c.name),
    hidden: (window.allColumns || [])
      .filter(c => !window.visibleColumns.some(v => v.name === c.name))
      .map(c => c.name),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadViewState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw || !Array.isArray(window.allColumns)) return;

    const state = JSON.parse(raw);
    if (!Array.isArray(state.order)) return;

    const ordered = [];
    const seen = new Set();

    // Apply saved order
    state.order.forEach(name => {
      const col = window.allColumns.find(c => c.name === name);
      if (col) {
        ordered.push(col);
        seen.add(name);
      }
    });

    // Append new columns (not hidden)
    window.allColumns.forEach(c => {
      if (!seen.has(c.name) && !state.hidden?.includes(c.name)) {
        ordered.push(c);
      }
    });

    window.visibleColumns = ordered;
  } catch (e) {
    console.warn("Failed to restore table view state", e);
  }
}

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
    renderList();
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

    // ----------------------------------------------
    // Visible columns (checked + reorderable)
    // ----------------------------------------------
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

    // ----------------------------------------------
    // Hidden columns (unchecked, no arrows)
    // ----------------------------------------------
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