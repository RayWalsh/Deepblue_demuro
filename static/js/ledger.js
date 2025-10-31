// ==============================================
// 📘 ledger.js — The Ledger + Edit Modal + Settings + Column Picker
// ==============================================
document.addEventListener("DOMContentLoaded", async () => {
  // -------------------------------
  // 🔹 Elements
  // -------------------------------
  const tableBody = document.getElementById("ledgerTableBody");
  const searchInput = document.getElementById("globalSearch");
  const exportBtn = document.getElementById("exportCSVBtn");
  const toggleBtn = document.getElementById("toggleViewBtn");

  // Settings modal
  const modal = document.getElementById("settingsModal");
  const openSettingsBtn = document.getElementById("openSettingsBtn");
  const closeSettingsBtn = document.getElementById("closeSettingsBtn");
  const modalBody = document.getElementById("modalBody");

  // Column picker panel
  const columnPanel = document.getElementById("columnPickerPanel");
  const openSettingsBtnAlt = document.getElementById("openSettingsBtnAlt");
  const closeColumnPicker = document.getElementById("closeColumnPicker");
  const applyColumnPrefs = document.getElementById("applyColumnPrefs");
  const cancelColumnPrefs = document.getElementById("cancelColumnPrefs");

  // Edit entry modal
  const editModal = document.getElementById("editEntryModal");
  const closeEditEntryBtn = document.getElementById("closeEditEntryBtn");
  const saveEntryBtn = document.getElementById("saveEntryBtn");
  const deleteEntryBtn = document.getElementById("deleteEntryBtn");
  const editModalBody = document.getElementById("editModalBody");

  // -------------------------------
  // 🔹 State
  // -------------------------------
  let ledgerData = [];
  let allColumns = [];
  let viewMode = "summary"; // "summary" or "full"
  let currentEditItem = null;

  // -------------------------------
  // 🗄 Load Ledger Data
  // -------------------------------
  async function loadLedger() {
    try {
      const res = await fetch("/api/ledger");
      const json = await res.json();

      if (!res.ok || !json.rows) {
        tableBody.innerHTML = `<tr><td colspan="6">⚠️ Error loading data.</td></tr>`;
        return;
      }

      ledgerData = json.rows;
      allColumns = json.columns || [];
      renderTable(ledgerData);
    } catch (err) {
      console.error("Error loading ledger:", err);
      tableBody.innerHTML = `<tr><td colspan="6">⚠️ Failed to connect to API.</td></tr>`;
    }
  }

  // -------------------------------
  // 🧾 Render Table
  // -------------------------------
  function renderTable(rows) {
    tableBody.innerHTML = "";

    // Clear and rebuild headers
    const thead = document.querySelector("#ledgerTable thead tr");
    thead.innerHTML = "";

    const headers = [
      "Ref",
      "Ship Name",
      "Charterer",
      "CP Date",
      "Claim Submitted",
      "Amount (USD)",
      "Status",
    ];

    headers.forEach((h) => {
      const th = document.createElement("th");
      th.textContent = h;
      thead.appendChild(th);
    });

    rows.forEach((row) => {
      const ref = row.DeepBlueRef || "—";
      const vessel = row.VesselName || "—";
      const charterer = row.ClientName || "—";
      const cpDate = row.CPDate
        ? new Date(row.CPDate).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "—";
      const claimSubmitted = row.ClaimSubmittedDate
        ? new Date(row.ClaimSubmittedDate).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "—";
      const amount = row.ClaimFiledAmount
        ? Number(row.ClaimFiledAmount).toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
          })
        : "—";
      const statusMap = {
        "1. Documents Received": "status-blue",
        "4. Calculation in Process": "status-amber",
        "9. Settlement Agreed with Owners": "status-green",
        "10. Claim Closed": "status-grey",
      };
      const statusClass = statusMap[row.ClaimStatus] || "";
      const status = row.ClaimStatus
        ? `<span class="status-badge ${statusClass}">${row.ClaimStatus}</span>`
        : "—";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="ref-cell" style="cursor:pointer;color:var(--primary-color);font-weight:600;">${ref}</td>
        <td>${vessel}</td>
        <td>${charterer}</td>
        <td>${cpDate}</td>
        <td>${claimSubmitted}</td>
        <td style="text-align:right;">${amount}</td>
        <td>${status}</td>
      `;
      tableBody.appendChild(tr);
    });

    // Attach click handlers for Ref cells
    document.querySelectorAll(".ref-cell").forEach((cell) => {
      cell.addEventListener("click", (e) => {
        const ref = e.target.textContent.trim();
        const rowData = ledgerData.find((r) => r.DeepBlueRef === ref);
        if (rowData) openEditModal(rowData);
      });
    });
  }

  // -------------------------------
  // ✏️ Edit Entry Modal
  // -------------------------------
  function openEditModal(rowData) {
    currentEditItem = rowData;
    editModal.style.display = "flex";

    let html = "";
    Object.entries(rowData).forEach(([key, value]) => {
      const safeVal = value === null || value === undefined ? "" : value;
      html += `
        <label for="edit-${key}">${key}</label>
        <input id="edit-${key}" name="${key}" value="${safeVal}" />
      `;
    });
    editModalBody.innerHTML = html;
  }

  closeEditEntryBtn?.addEventListener("click", () => {
    editModal.style.display = "none";
  });

  editModal.addEventListener("click", (e) => {
    if (e.target === editModal) editModal.style.display = "none";
  });

  saveEntryBtn?.addEventListener("click", async () => {
    if (!currentEditItem) return;
    const updates = {};
    document.querySelectorAll("#editModalBody input").forEach((input) => {
      updates[input.name] = input.value;
    });

    try {
      const res = await fetch("/api/ledger/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.success) {
        alert("✅ Ledger entry updated.");
        editModal.style.display = "none";
        loadLedger();
      } else alert("❌ Update failed: " + data.error);
    } catch (err) {
      console.error("Update error:", err);
      alert("❌ Error updating entry.");
    }
  });

  deleteEntryBtn?.addEventListener("click", async () => {
    if (!currentEditItem) return;
    if (!confirm("Delete this ledger entry?")) return;

    try {
      const res = await fetch("/api/ledger/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ DeepBlueRef: currentEditItem.DeepBlueRef }),
      });
      const data = await res.json();
      if (data.success) {
        alert("🗑 Entry deleted.");
        editModal.style.display = "none";
        loadLedger();
      } else alert("❌ Delete failed: " + data.error);
    } catch (err) {
      console.error("Delete error:", err);
      alert("❌ Error deleting entry.");
    }
  });

  // -------------------------------
  // 🔍 Live Search Filter
  // -------------------------------
  searchInput?.addEventListener("input", (e) => {
    const val = e.target.value.toLowerCase();
    const filtered = ledgerData.filter((r) =>
      Object.values(r).join(" ").toLowerCase().includes(val)
    );
    renderTable(filtered);
  });

  // -------------------------------
  // ⚙️ SETTINGS MODAL
  // -------------------------------
  function attachTabEvents() {
    const tabButtons = modal.querySelectorAll(".modal-tabs button");
    tabButtons.forEach((btn) => {
      btn.onclick = () => {
        tabButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        loadSettingsTab(btn.dataset.tab);
      };
    });
  }

  openSettingsBtn?.addEventListener("click", () => {
    modal.style.display = "flex";
    attachTabEvents();
    loadSettingsTab("general");
  });

  closeSettingsBtn?.addEventListener("click", () => (modal.style.display = "none"));
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });

  async function loadSettingsTab(tab) {
    if (tab === "general") {
      modalBody.innerHTML = `
        <h4>General Settings</h4>
        <p>Defaults, currencies, or workflow options can be added here later.</p>
      `;
    }

    if (tab === "columns") {
      modalBody.innerHTML = `
        <h4>Manage Columns</h4>
        <ul id="colList"><li>Loading columns...</li></ul>
        <div class="add-column-row">
          <input type="text" id="newColName" placeholder="New column name">
          <select id="newColType">
            <option>Text</option>
            <option>Paragraph</option>
            <option>Number</option>
            <option>Decimal Number</option>
            <option>Date/Time</option>
            <option>Yes/No</option>
            <option>ID / Reference</option>
            <option>File Upload</option>
          </select>
          <button id="addColBtn">Add</button>
        </div>
      `;
      loadColumnList();

      document.getElementById("addColBtn").addEventListener("click", async () => {
        const name = document.getElementById("newColName").value.trim();
        const type = document.getElementById("newColType").value;
        if (!name) return alert("Enter a column name.");

        try {
          const res = await fetch("/api/add-column", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, friendlyType: type }),
          });
          const data = await res.json();
          if (data.success) {
            alert(`✅ Added column: ${name}`);
            loadColumnList();
          } else alert(`❌ ${data.error}`);
        } catch (err) {
          alert("❌ Failed to add column.");
        }
      });
    }

    if (tab === "appearance") {
      modalBody.innerHTML = `
        <h4>Table Appearance</h4>
        <label><input type="checkbox" checked /> Show borders</label><br>
        <label><input type="checkbox" /> Alternate row colors</label>
      `;
    }
  }

  async function loadColumnList() {
    const list = document.getElementById("colList");
    list.innerHTML = "<li>Loading...</li>";

    try {
      const res = await fetch("/api/case-columns");
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Bad data");

      list.innerHTML = "";
      data.forEach((col) => {
        const item = document.createElement("li");
        item.className = "settings-column-item";
        const protectedCols = ["CaseID", "DeepBlueRef"];

        item.innerHTML = `
          <span>${col.name}</span>
          <span>
            ${col.type}
            ${protectedCols.includes(col.name) ? "" : `<button data-name="${col.name}">🗑</button>`}
          </span>
        `;
        list.appendChild(item);
      });

      list.querySelectorAll("button[data-name]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const name = btn.dataset.name;
          if (!confirm(`Delete column "${name}"?`)) return;
          try {
            const res = await fetch(`/api/delete-column/${name}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
              alert(`🗑 Deleted ${name}`);
              loadColumnList();
            } else alert(`❌ ${data.error}`);
          } catch {
            alert("❌ Delete failed.");
          }
        });
      });
    } catch (err) {
      console.error("Column load error:", err);
      list.innerHTML = "<li>⚠️ Failed to load columns.</li>";
    }
  }

  // -------------------------------
  // ⚙️ COLUMN PICKER PANEL
  // -------------------------------
  openSettingsBtnAlt?.addEventListener("click", () => {
    columnPanel.style.display = "flex";
  });

  closeColumnPicker?.addEventListener("click", () => {
    columnPanel.style.display = "none";
  });
  cancelColumnPrefs?.addEventListener("click", () => {
    columnPanel.style.display = "none";
  });
  applyColumnPrefs?.addEventListener("click", () => {
    alert("✅ Column preferences saved (future functionality).");
    columnPanel.style.display = "none";
  });

  // -------------------------------
  // 🔁 View Mode Toggle
  // -------------------------------
  toggleBtn?.addEventListener("click", () => {
    viewMode = viewMode === "summary" ? "full" : "summary";
    toggleBtn.title =
      viewMode === "summary" ? "Switch to Full View" : "Switch to Summary View";
    renderTable(ledgerData);
  });

  // -------------------------------
  // 🚀 Initialize Page
  // -------------------------------
  loadLedger();
});