// ==============================================
// 📊 case-dashboard.js
// Display-only logic for Case Dashboard
// ==============================================

(function () {
  if (!window.caseData) {
    console.warn("⚠️ case-dashboard.js loaded without caseData");
    return;
  }

  const caseData = window.caseData;

  // ----------------------------------------------
  // Helpers
  // ----------------------------------------------
  function formatDateDDMMMYY(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d)) return "—";

    const day = String(d.getDate()).padStart(2, "0");
    const month = d.toLocaleString("en-GB", { month: "short" });
    const year = String(d.getFullYear()).slice(-2);

    return `${day} ${month} ${year}`;
  }

  function formatMoney(value) {
    if (value === null || value === undefined || value === "") return "—";
    const num = Number(value);
    if (isNaN(num)) return "—";
    return `USD ${num.toLocaleString("en-US")}`;
  }

  function daysBetween(start, end = new Date()) {
    if (!start) return "—";
    const s = new Date(start);
    if (isNaN(s)) return "—";
    const diff = end - s;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  // ----------------------------------------------
  // Header / Pills
  // ----------------------------------------------
  const cpPill = document.querySelector(".case-pills .pill:nth-child(2)");
  if (cpPill) {
    cpPill.textContent = `CP ${formatDateDDMMMYY(caseData.CPDate)}`;
  }

  // ----------------------------------------------
  // General Info panel
  // ----------------------------------------------
  document.querySelectorAll("[data-field='CPDate']").forEach(el => {
    el.textContent = formatDateDDMMMYY(caseData.CPDate);
  });

  // ----------------------------------------------
  // Claim & Status KPIs
  // ----------------------------------------------
  const claimFiledEl = document.querySelector(".kpi-value[data-kpi='claim-filed']");
  if (claimFiledEl) {
    claimFiledEl.textContent = formatMoney(caseData.ClaimFiledAmount);
  }

  const agreedEl = document.querySelector(".kpi-value[data-kpi='agreed-amount']");
  if (agreedEl) {
    agreedEl.textContent = formatMoney(caseData.AgreedAmount);
  }

  const daysOpenEl = document.querySelector(".kpi-value[data-kpi='days-open']");
  if (daysOpenEl) {
    daysOpenEl.textContent = daysBetween(caseData.ClaimReceivedDate);
  }

})();