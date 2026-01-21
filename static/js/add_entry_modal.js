// ==============================================
// ➕ Add Entry Modal Controller (Global)
// ==============================================
document.addEventListener("DOMContentLoaded", () => {
  const addModal = document.getElementById("addEntryModal");
  if (!addModal) return;

  const openAddBtn = document.getElementById("openAddEntryBtn");
  const closeAddEntryBtn = document.getElementById("closeAddEntryBtn");
  const saveAddEntryBtn = document.getElementById("saveAddEntryBtn");
  const addModalBody = document.getElementById("addModalBody");

  if (!openAddBtn || !saveAddEntryBtn || !addModalBody) return;

  // ----------------------------------------------
  // 🔧 Helpers
  // ----------------------------------------------
  function closeAddModal() {
    addModal.style.display = "none";
    addModalBody.innerHTML = `<p>Loading form...</p>`;
  }

  // ----------------------------------------------
  // ➕ OPEN ADD ENTRY MODAL
  // ----------------------------------------------
  openAddBtn.onclick = () => {

    // 🔐 SAFETY GUARD — ledger metadata not ready yet
    if (!window.allColumns || window.allColumns.length === 0) {
        alert("Ledger metadata is still loading. Please try again in a moment.");
        return;
    }

    console.log("➕ Add modal opened");
    console.log("fieldGroups:", fieldGroups);
    console.log("allColumns:", allColumns);

    addModal.style.display = "flex";

    let html = "";

    if (!window.fieldGroups || !window.allColumns) {
      addModalBody.innerHTML = `<p class="error">Form metadata not loaded.</p>`;
      return;
    }

    for (const [groupName, fields] of Object.entries(window.fieldGroups)) {
      html += `
        <section class="field-group">
          <h4>${groupName}</h4>
          <div class="field-grid">
      `;

      fields.forEach((col) => {
        const type = inferInputType(col);
        const disabled = window.systemFields?.includes(col) ? "disabled" : "";

        if (type === "textarea") {
          html += `
            <div>
              <label>${col}</label>
              <textarea name="${col}" rows="2" ${disabled}></textarea>
            </div>
          `;
        }
        else if (type === "select") {
          html += `
            <div>
              <label>${col}</label>
              ${renderChoiceSelect({
                name: col,
                value: "",
                disabled: !!disabled
              })}
            </div>
          `;
        }
        else {
          html += `
            <div>
              <label>${col}</label>
              <input type="${type}" name="${col}" ${disabled}/>
            </div>
          `;
        }
      });

      html += `
          </div>
        </section>
      `;
    }

    addModalBody.innerHTML = html;
  };

  // ----------------------------------------------
  // ❌ CLOSE MODAL
  // ----------------------------------------------
  closeAddEntryBtn.onclick = closeAddModal;

  addModal.onclick = (e) => {
    if (e.target === addModal) {
      closeAddModal();
    }
  };

  // ----------------------------------------------
  // 💾 SAVE ENTRY
  // ----------------------------------------------
  saveAddEntryBtn.onclick = async () => {
    const payload = buildPayloadFromInputs(addModalBody);

    try {
      const res = await fetch("/api/add-ledger-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        alert("✅ New ledger entry added");
        closeAddModal();

        // 🔁 Refresh ledger if available
        if (typeof window.reloadLedger === "function") {
          window.reloadLedger();
        }
      } else {
        alert("❌ " + (data.error || "Insert failed"));
      }
    } catch (e) {
      alert("❌ " + e.message);
    }
  };
});