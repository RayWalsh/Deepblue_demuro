// ===========================================================
// 🆕 newCaseModal.js — Handles the universal New Case modal
// ===========================================================

document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("newCaseModal");
  const openBtn = document.getElementById("new-case-btn");
  const closeBtn = document.getElementById("closeNewCase");
  const form = document.getElementById("newCaseForm");

  if (!modal || !openBtn || !closeBtn || !form) {
    console.warn("⚠️ New Case modal elements not found on this page.");
    return;
  }

  // -------------------------------
  // 🪟 Open / Close Modal
  // -------------------------------
  openBtn.addEventListener("click", () => {
    modal.style.display = "flex";
    document.body.classList.add("no-scroll");
  });

  closeBtn.addEventListener("click", () => closeModal());
  window.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  function closeModal() {
    modal.style.display = "none";
    document.body.classList.remove("no-scroll");
  }

  // -------------------------------
  // 🧭 Swipe Down to Close (Mobile)
  // -------------------------------
  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  modal.addEventListener("touchstart", (e) => {
    if (e.target.closest(".modal-content")) {
      startY = e.touches[0].clientY;
      isDragging = true;
    }
  });

  modal.addEventListener("touchmove", (e) => {
    if (!isDragging) return;
    currentY = e.touches[0].clientY;
    const diff = currentY - startY;

    // Move the modal slightly with touch
    if (diff > 0) {
      const content = modal.querySelector(".modal-content");
      content.style.transform = `translateY(${diff}px)`;
      content.style.transition = "none";
    }
  });

  modal.addEventListener("touchend", () => {
    if (!isDragging) return;
    const diff = currentY - startY;
    const content = modal.querySelector(".modal-content");

    if (diff > 100) {
      // Swipe down far enough — close it
      content.style.transition = "transform 0.25s ease";
      content.style.transform = "translateY(100%)";
      setTimeout(closeModal, 200);
    } else {
      // Snap back
      content.style.transition = "transform 0.25s ease";
      content.style.transform = "translateY(0)";
    }

    isDragging = false;
  });

  // -------------------------------
  // 📨 Form Submission
  // -------------------------------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving...";

    const formData = Object.fromEntries(new FormData(form).entries());
    console.log("🆕 Submitting new case:", formData);

    try {
      const response = await fetch("/api/add-case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        alert("✅ Case added successfully!");
        closeModal();
        location.reload();
      } else {
        alert("❌ Error: " + (result.error || "Unable to save case"));
      }
    } catch (err) {
      console.error("❌ Submission error:", err);
      alert("❌ Network error. Please try again.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit";
    }
  });
});