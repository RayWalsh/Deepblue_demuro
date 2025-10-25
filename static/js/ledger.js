// ==============================================
// 📘 ledger.js — The Ledger (Deep Blue Portal)
// ==============================================
document.addEventListener("DOMContentLoaded", async () => {
  const tableBody = document.getElementById("ledgerTableBody");
  const searchInput = document.getElementById("globalSearch");
  const exportBtn = document.getElementById("exportCSVBtn");
  const columnBtn = document.getElementById("manageColumnsBtn");
  const columnPanel = document.getElementById("columnPickerPanel");
  const closeColumnPanel = document.getElementById("closeColumnPicker");

  let ledgerData = [];

  // -------------------------------
  // 🔹 Load Ledger Data from API
  // -------------------------------
  async function loadLedger() {
    try {
      const res = await fetch("/api/ledger");
      const data = await res.json();

      if (!res.ok || !Array.isArray(data)) {
        tableBody.innerHTML = `<tr><td colspan="6">⚠️ Error loading data.</td></tr>`;
        return;
      }

      ledgerData = data;
      if (ledgerData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6">No ledger entries found.</td></tr>`;
        return;
      }

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
    rows.forEach(row => {
      const date = row.CPDate
        ? new Date(row.CPDate).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric"
          })
        : "";
      const description = row.VesselName || "(Unknown Vessel)";
      const type = row.ClaimType || "";
      const currency = "USD";
      const amount = row.ClaimFiledAmount
        ? Number(row.ClaimFiledAmount).toLocaleString("en-US", {
            style: "currency",
            currency: "USD"
          })
        : "";
      const status = row.ClaimStatus || "";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${date}</td>
        <td>${description}</td>
        <td>${type}</td>
        <td>${currency}</td>
        <td>${amount}</td>
        <td>${status}</td>
      `;
      tableBody.appendChild(tr);
    });
  }

  // -------------------------------
  // 🔍 Live Search Filter
  // -------------------------------
  searchInput.addEventListener("input", (e) => {
    const searchValue = e.target.value.toLowerCase();
    const filtered = ledgerData.filter((row) =>
      Object.values(row)
        .join(" ")
        .toLowerCase()
        .includes(searchValue)
    );
    renderTable(filtered);
  });

  // -------------------------------
  // 📤 Export to CSV
  // -------------------------------
  exportBtn.addEventListener("click", () => {
    if (!ledgerData.length) {
      alert("No data to export!");
      return;
    }

    const headers = ["Date", "Description", "Type", "Currency", "Amount", "Status"];
    const rows = ledgerData.map((row) => [
      row.CPDate ? new Date(row.CPDate).toLocaleDateString("en-GB") : "",
      row.VesselName || "",
      row.ClaimType || "",
      "USD",
      row.ClaimFiledAmount || "",
      row.ClaimStatus || ""
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = "ledger_export.csv";
    link.click();
  });

  // -------------------------------
  // ⚙️ Column Picker Panel Toggle
  // -------------------------------
  if (columnBtn && columnPanel && closeColumnPanel) {
    columnBtn.addEventListener("click", () => columnPanel.classList.add("open"));
    closeColumnPanel.addEventListener("click", () => columnPanel.classList.remove("open"));
  }

  // -------------------------------
  // 🚀 Initialize Page
  // -------------------------------
  loadLedger();
});