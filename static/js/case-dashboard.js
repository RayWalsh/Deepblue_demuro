// ==============================================
// 🗑️ case-dashboard.js
// Delete Case only
// ==============================================

(function () {
  if (!window.caseData) {
    console.warn("⚠️ case-dashboard.js loaded without caseData");
    return;
  }

  const caseId = window.caseData.CaseID;

  // Event delegation – timing safe
  document.addEventListener("click", async (e) => {
    const deleteBtn = e.target.closest("#deleteCaseBtn");
    if (!deleteBtn) return;

    if (!caseId) {
      alert("Cannot delete case: missing Case ID.");
      return;
    }

    const confirmText = prompt(
      "This will permanently delete this case.\n\nType DELETE to confirm."
    );

    if (confirmText !== "DELETE") {
      alert("Delete cancelled.");
      return;
    }

    try {
      deleteBtn.disabled = true;
      deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

      const res = await fetch(`/api/case/${caseId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" }
      });

      const result = await res.json();

      if (!result.success) {
        alert("Delete failed: " + (result.error || "Unknown error"));
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        return;
      }

      // Success → back to ledger
      window.location.href = "/ledger";

    } catch (err) {
      console.error("Delete failed:", err);
      alert("Network error deleting case.");
      deleteBtn.disabled = false;
      deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    }
  });

})();