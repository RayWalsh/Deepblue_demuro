// ==============================================
// ⚙️ Table Settings — Side Modal (Column Ordering)
// ==============================================
//
// Responsibilities:
// - Render visible columns
// - Allow reordering via ↑ ↓ arrows
// - Apply changes to the ledger table
// - Cancel safely (no mutation leaks)
//
// Assumes ledger.js provides:
// - window.visibleColumns  (array of column objects)
// - window.ledgerData     (table data)
// - renderTable(data)     (re-render function)
// ==============================================

let workingColumns = []; // temporary working copy

document.addEventListener("DOMContentLoaded", () => {
  const openBtn   = document.getElementById("openSettingsBtn");
  const modal     = document.getElementById("tableSettingsModal");
  const closeBtn  = document.getElementById("closeTableSettingsBtn");
  const cancelBtn = document.getElementById("cancelTableSettingsBtn");
  const applyBtn  = document.getElementById("applyTableSettingsBtn");
  const list      = document.getElementById("tableSettingsColumnList");

  if (!openBtn || !modal || !list) return;

  // --------------------------------------------------
  // Open modal — clone visibleColumns safely
  // --------------------------------------------------
  openBtn.addEventListener("click", () => {
    if (!Array.isArray(window.visibleColumns)) return;

    // Create isolated working copy
    workingColumns = window.visibleColumns.map(col => ({ ...col }));

    modal.classList.add("open");
    renderColumnList();
  });

  // --------------------------------------------------
  // Close helpers
  // --------------------------------------------------
  function closeModal() {
    modal.classList.remove("open");
  }

  closeBtn?.addEventListener("click", closeModal);
  cancelBtn?.addEventListener("click", () => {
    workingColumns = []; // discard changes
    closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("open")) {
      workingColumns = [];
      closeModal();
    }
  });

  // --------------------------------------------------
  // Apply changes
  // --------------------------------------------------
  applyBtn?.addEventListener("click", () => {
    if (!workingColumns.length) return;

    // Commit new order
    window.visibleColumns = workingColumns.map(col => ({ ...col }));

    // Persist order (names only)
    localStorage.setItem(
      "ledger_visible_columns",
      JSON.stringify(window.visibleColumns.map(c => c.name))
    );

    // Re-render ledger table
    if (typeof renderTable === "function" && window.ledgerData) {
      renderTable(window.ledgerData);
    }

    workingColumns = [];
    closeModal();
  });

  // --------------------------------------------------
  // Render column list UI
  // --------------------------------------------------
  function renderColumnList() {
    if (!workingColumns.length) {
      list.innerHTML = "";
      return;
    }

    list.innerHTML = "";

    workingColumns.forEach((col, index) => {
      const li = document.createElement("li");
      li.className = "table-settings-item";
      li.dataset.index = index;

      li.innerHTML = `
        <div class="table-settings-left">
          <span class="table-settings-label">
            ${col.display || col.name}
          </span>
          ${
            col.fieldType
              ? `<span class="table-settings-type">${col.fieldType}</span>`
              : ""
          }
        </div>

        <div class="table-settings-arrows">
          <button
            class="move-up"
            title="Move up"
            ${index === 0 ? "disabled" : ""}
          >↑</button>

          <button
            class="move-down"
            title="Move down"
            ${index === workingColumns.length - 1 ? "disabled" : ""}
          >↓</button>
        </div>
      `;

      list.appendChild(li);
    });
  }

  // --------------------------------------------------
  // Handle arrow clicks (reorder workingColumns)
  // --------------------------------------------------
  list.addEventListener("click", (e) => {
    const row = e.target.closest(".table-settings-item");
    if (!row) return;

    const index = Number(row.dataset.index);
    if (Number.isNaN(index)) return;

    // Move up
    if (e.target.classList.contains("move-up") && index > 0) {
      swapColumns(index, index - 1);
    }

    // Move down
    if (
      e.target.classList.contains("move-down") &&
      index < workingColumns.length - 1
    ) {
      swapColumns(index, index + 1);
    }

    renderColumnList();
  });

  // --------------------------------------------------
  // Swap helper (mutates workingColumns only)
  // --------------------------------------------------
  function swapColumns(a, b) {
    const tmp = workingColumns[a];
    workingColumns[a] = workingColumns[b];
    workingColumns[b] = tmp;
  }
});