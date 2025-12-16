document.addEventListener("DOMContentLoaded", () => {
  // === TAB LOGIC ===
  const tabButtons = document.querySelectorAll(".tab-menu .tab");
  const tabSections = document.querySelectorAll(".tab-content");

  window.switchTab = function (tabId) {
    tabButtons.forEach(btn => btn.classList.remove("active"));
    tabSections.forEach(section => section.classList.add("hidden"));

    document.querySelector(`.tab-menu .tab[onclick="switchTab('${tabId}')"]`)?.classList.add("active");
    document.getElementById(tabId)?.classList.remove("hidden");
  };

  // === EDIT & SAVE MODE TOGGLE ===
  const editBtn = document.getElementById("editBtn");
  const formInputs = document.querySelectorAll("input, textarea");

  editBtn?.addEventListener("click", () => {
    const isEditing = editBtn.classList.toggle("editing");

    formInputs.forEach(input => {
      input.disabled = !isEditing;
    });

    // Toggle FontAwesome icon
    const icon = editBtn.querySelector("i");
    if (icon) {
      icon.classList.toggle("fa-pen", !isEditing);
      icon.classList.toggle("fa-save", isEditing);
    }

    console.log(isEditing ? "✏️ Editing enabled" : "✅ Editing disabled");

// If toggling off, collect updated values
    if (!isEditing) {
      const updatedData = {};
      formInputs.forEach(input => {
        updatedData[input.id] = input.value;
      });

      const caseContainer = document.querySelector(".case-detail-container");
      const caseId = caseContainer?.dataset.caseId;

      if (!caseId) {
        console.error("❌ No CaseID found");
        return;
      }

      fetch(`/update-case/${caseId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(updatedData)
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            console.log("✅ Case saved successfully");
          } else {
            console.error("❌ Save failed:", data);
            alert("Save failed");
          }
        })
        .catch(err => {
          console.error("❌ Network error:", err);
          alert("Network error saving case");
        });
    }
  });
});