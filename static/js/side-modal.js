// ==============================================
// SIDE MODAL CONTROLLER + SAVE TO API
// ==============================================
(function () {

  function getOverlay() {
    return document.querySelector(".side-modal-overlay");
  }

  function open(id) {
    const modal = document.getElementById(id);
    const overlay = getOverlay();
    if (!modal || !overlay) return;

    modal.classList.add("open");
    overlay.classList.add("active");
    document.body.classList.add("no-scroll");
  }

  function close(id) {
    const modal = document.getElementById(id);
    const overlay = getOverlay();
    if (!modal || !overlay) return;

    modal.classList.remove("open");
    overlay.classList.remove("active");
    document.body.classList.remove("no-scroll");
  }

  function closeAll() {
    document
      .querySelectorAll(".side-modal.open")
      .forEach(m => m.classList.remove("open"));

    getOverlay()?.classList.remove("active");
    document.body.classList.remove("no-scroll");
  }



  // ----------------------------------------------
  // DOM READY
  // ----------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    const overlay = getOverlay();

    // Overlay click closes modal
    overlay?.addEventListener("click", closeAll);

    // Click delegation
    document.addEventListener("click", (e) => {

      // Close buttons
      const closeBtn = e.target.closest("[data-side-modal-close]");
      if (closeBtn) {
        const modal = closeBtn.closest(".side-modal");
        modal?.id ? close(modal.id) : closeAll();
        return;
      }

      // Edit button
      const editBtn = e.target.closest("#editCaseBtn");
      if (editBtn) {
        open("editCaseModal");
        return;
      }


    });

    // Escape closes modal
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAll();
    });
  });

  window.SideModal = { open, close, closeAll };

})();