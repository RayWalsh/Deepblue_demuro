// ==============================================
// 📘 ledger.js — The Ledger + Edit Entry Modal
// ==============================================
document.addEventListener("DOMContentLoaded", async () => {
  // -------------------------------
  // 🔹 Elements
  // -------------------------------
  const tableBody = document.getElementById("ledgerTableBody");
  const searchInput = document.getElementById("globalSearch");
  const exportBtn = document.getElementById("exportCSVBtn");
  const toggleBtn = document.getElementById("toggleViewBtn");
  const modal = document.getElementById("settingsModal");
  const openSettingsBtn = document.getElementById("openSettingsBtn");
  const closeSettingsBtn = document.getElementById("closeSettingsBtn");
  const modalBody = document.getElementById("modalBody");

  // --- New Edit Modal Elements ---
  const editModal = document.getElementById("editEntryModal");
  const editModalBody = document.getElementById("editModalBody");
  const editModalTitle = document.getElementById("editModalTitle");
  const saveEntryBtn = document.getElementById("saveEntryBtn");
  const deleteEntryBtn = document.getElementById("deleteEntryBtn");
  const closeEditEntryBtn = document.getElementById("closeEditEntryBtn");

  // -------------------------------
  // 🔹 State
  // -------------------------------
  let ledgerData = [];
  let allColumns = [];
  let viewMode = "summary"; // "summary" or "full"
  let currentEditingItem = null;

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
  // 🧾 Render Table (Summary + Full View)
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
      const status = row.ClaimStatus || "—";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="clickable-ref" data-id="${row.CaseID || ""}">${ref}</td>
        <td>${vessel}</td>
        <td>${charterer}</td>
        <td>${cpDate}</td>
        <td>${claimSubmitted}</td>
        <td style="text-align:right;">${amount}</td>
        <td>${status}</td>
      `;
      tableBody.appendChild(tr);
    });

    attachRefClickEvents();
  }

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
  // 🖱 Click Ref → Open Edit Modal
  // -------------------------------
  function attachRefClickEvents() {
    document.querySelectorAll(".clickable-ref").forEach((cell) => {
      cell.style.color = "var(--primary-color)";
      cell.style.cursor = "pointer";
      cell.title = "Click to edit entry";
      cell.addEventListener("click", () => {
        const id = cell.dataset.id;
        const entry = ledgerData.find((r) => String(r.CaseID) === String(id));
        if (entry) openEditModal(entry);
      });
    });
  }

  // -------------------------------
  // 🧩 Open Edit Modal
  // -------------------------------
  function openEditModal(entry) {
    currentEditingItem = entry;
    editModalTitle.textContent = `Edit Ledger Entry – ${entry.DeepBlueRef || "Untitled"}`;

    editModalBody.innerHTML = "";
    allColumns.forEach((col) => {
      const value = entry[col] ?? "";
      const field = document.createElement("div");
      field.innerHTML = `
        <label>${col}</label>
        <input type="text" data-field="${col}" value="${value}">
      `;
      editModalBody.appendChild(field);
    });

    editModal.style.display = "flex";
  }

  // -------------------------------
  // 💾 Save Ledger Item
  // -------------------------------
  saveEntryBtn.addEventListener("click", async () => {
    if (!currentEditingItem) return;
    const id = currentEditingItem.CaseID;

    const updates = {};
    editModalBody.querySelectorAll("input[data-field]").forEach((input) => {
      updates[input.dataset.field] = input.value.trim();
    });

    try {
      const res = await fetch(`/api/update-ledger-item/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const result = await res.json();

      if (result.success) {
        alert("✅ Ledger entry updated successfully.");
        editModal.style.display = "none";
        loadLedger();
      } else {
        alert(`❌ ${result.error || "Update failed."}`);
      }
    } catch (err) {
      alert("❌ Error saving changes.");
      console.error(err);
    }
  });

  // -------------------------------
  // 🗑 Delete Ledger Item
  // -------------------------------
  deleteEntryBtn.addEventListener("click", async () => {
    if (!currentEditingItem) return;
    const id = currentEditingItem.CaseID;

    if (!confirm("Are you sure you want to delete this ledger entry?")) return;

    try {
      const res = await fetch(`/api/delete-ledger-item/${id}`, {
        method: "DELETE",
      });
      const result = await res.json();

      if (result.success) {
        alert("🗑 Ledger entry deleted.");
        editModal.style.display = "none";
        loadLedger();
      } else {
        alert(`❌ ${result.error || "Delete failed."}`);
      }
    } catch (err) {
      alert("❌ Error deleting item.");
      console.error(err);
    }
  });

  // -------------------------------
  // ❌ Close Edit Modal
  // -------------------------------
  closeEditEntryBtn.addEventListener("click", () => {
    editModal.style.display = "none";
    currentEditingItem = null;
  });

  // Click outside closes modal
  editModal.addEventListener("click", (e) => {
    if (e.target === editModal) {
      editModal.style.display = "none";
      currentEditingItem = null;
    }
  });

  // -------------------------------
  // ⚙ Settings Modal (unchanged)
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

  openSettingsBtn.addEventListener("click", () => {
    modal.style.display = "flex";
    attachTabEvents();
    loadSettingsTab("general");
  });

  closeSettingsBtn.addEventListener("click", () => (modal.style.display = "none"));
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
  }

  // -------------------------------
  // 🚀 Initialize Page
  // -------------------------------
  loadLedger();
});