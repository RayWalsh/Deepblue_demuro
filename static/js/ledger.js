// ==============================================
// 📘 ledger.js — The Ledger + Built-in Settings Modal
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

  // -------------------------------
  // 🔹 State
  // -------------------------------
  let ledgerData = [];
  let allColumns = [];
  let viewMode = "summary"; // "summary" or "full"

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

  if (viewMode === "summary") {
    // --- Compact business summary view ---
    const headers = [
      "Ref",
      "Ship Name",
      "Charterer",
      "CP Date",
      "Claim Submitted",
      "Amount (USD)",
      "Status"
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
        <td>${ref}</td>
        <td>${vessel}</td>
        <td>${charterer}</td>
        <td>${cpDate}</td>
        <td>${claimSubmitted}</td>
        <td style="text-align:right;">${amount}</td>
        <td>${status}</td>
      `;
      tableBody.appendChild(tr);
    });
  } else {
    // --- Full dynamic SQL view ---
    const allCols = allColumns;
    allCols.forEach((col) => {
      const th = document.createElement("th");
      th.textContent = col;
      thead.appendChild(th);
    });

    rows.forEach((row) => {
      const tr = document.createElement("tr");
      allCols.forEach((col) => {
        const td = document.createElement("td");
        let val = row[col];
        if (val === null || val === undefined || val === "") val = "—";
        td.textContent = val;
        tr.appendChild(td);
      });
      tableBody.appendChild(tr);
    });
  }
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

  openSettingsBtn.addEventListener("click", () => {
    modal.style.display = "flex";
    attachTabEvents();
    loadSettingsTab("general");
  });

  closeSettingsBtn.addEventListener("click", () => (modal.style.display = "none"));
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });

  // -------------------------------
  // 🧭 Load Settings Tab Content
  // -------------------------------
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
          } else {
            alert(`❌ ${data.error}`);
          }
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

  // -------------------------------
  // 📜 Load Column List
  // -------------------------------
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

      // attach delete handlers
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
            } else {
              alert(`❌ ${data.error}`);
            }
          } catch (err) {
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