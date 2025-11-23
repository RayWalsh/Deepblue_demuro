document.addEventListener("DOMContentLoaded", () => {
  const tabButtons = document.querySelectorAll(".tab-menu .tab");
  const tabSections = document.querySelectorAll(".tab-content");

  window.switchTab = function (tabId) {
    // Remove 'active' from all tabs
    tabButtons.forEach(btn => btn.classList.remove("active"));
    tabSections.forEach(section => section.classList.add("hidden"));

    // Add 'active' to clicked tab
    document.querySelector(`.tab-menu .tab[onclick="switchTab('${tabId}')"]`)?.classList.add("active");

    // Show selected section
    document.getElementById(tabId)?.classList.remove("hidden");
  };
});