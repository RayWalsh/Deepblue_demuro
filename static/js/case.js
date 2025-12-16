document.addEventListener("DOMContentLoaded", () => {

  // ==============================
  // 📌 Capture original values
  // ==============================
  const formInputs = document.querySelectorAll("input, textarea");
  const originalData = {};

  formInputs.forEach(input => {
    originalData[input.id] = input.value;
  });

  // ==============================
  // ✏️ Edit & Save Toggle
  // ==============================
  const editBtn = document.getElementById("editBtn");

  editBtn?.addEventListener("click", () => {
    const isEditing = editBtn.classList.toggle("editing");

    // Enable / disable inputs
    formInputs.forEach(input => {
      input.disabled = !isEditing;
    });

    // Toggle icon
    const icon = editBtn.querySelector("i");
    if (icon) {
      icon.classList.toggle("fa-pen", !isEditing);
      icon.classList.toggle("fa-save", isEditing);
    }

    console.log(isEditing ? "✏️ Editing enabled" : "💾 Saving changes");

    // ==============================
    // 💾 SAVE MODE
    // ==============================
    if (!isEditing) {
      const changedData = {};

      formInputs.forEach(input => {
        const originalValue = originalData[input.id] ?? "";
        const currentValue = input.value ?? "";

        if (currentValue !== originalValue) {
          changedData[input.id] = currentValue;
        }
      });

      // Nothing changed → do nothing
      if (Object.keys(changedData).length === 0) {
        console.log("ℹ️ No changes detected");
        return;
      }

      const caseContainer = document.querySelector(".case-detail-container");
      const caseId = caseContainer?.dataset.caseId;

      if (!caseId) {
        console.error("❌ No CaseID found");
        return;
      }

      console.log("🔄 Sending changed fields:", changedData);

      fetch(`/update-case/${caseId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(changedData)
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            console.log("✅ Case updated");

            // Update originalData snapshot
            Object.keys(changedData).forEach(key => {
              originalData[key] = changedData[key];
            });
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