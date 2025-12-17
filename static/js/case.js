document.addEventListener("DOMContentLoaded", () => {

  // ==============================
  // 🔗 Core DOM references
  // ==============================
  const formInputs = document.querySelectorAll("input, textarea");
  const editBtn = document.getElementById("editBtn");
  const saveNotice = document.getElementById("saveNotification");
  const caseContainer = document.querySelector(".case-detail-container");
  const caseId = caseContainer?.dataset.caseId;
  const backBtn = document.getElementById("backToLedger");

  let hasUnsavedChanges = false;
  let isSaving = false;

  const originalData = {};

  // ==============================
  // 🔔 Save notification helper
  // ==============================
  function showSaveState(type, text, autoHide = true) {
    saveNotice.className = `save-notification ${type}`;
    saveNotice.textContent = text;
    saveNotice.classList.remove("hidden");

    if (autoHide && type === "success") {
      setTimeout(() => {
        saveNotice.classList.add("hidden");
      }, 2500);
    }
  }

  // ==============================
  // 📌 Capture original values
  // ==============================
  formInputs.forEach(input => {
    if (input.id) {
      originalData[input.id] = input.value ?? "";
    }
  });

  // ==============================
  // 🟡 Dirty detection
  // ==============================
  formInputs.forEach(input => {
    if (!input.id || input.dataset.readonly === "true") return;

    input.addEventListener("input", () => {
      const originalValue = originalData[input.id] ?? "";
      const currentValue = input.value ?? "";

      if (currentValue !== originalValue) {
        input.classList.add("dirty");
        hasUnsavedChanges = true;
        showSaveState("info", "Unsaved changes", false);
      } else {
        input.classList.remove("dirty");
        hasUnsavedChanges = [...formInputs].some(i => i.classList.contains("dirty"));

        if (!hasUnsavedChanges) {
          showSaveState("info", "No unsaved changes", false);
        }
      }
    });
  });

  // ==============================
  // ⚠️ Browser unload protection
  // ==============================
  window.addEventListener("beforeunload", (e) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  // ==============================
  // ⬅️ Back navigation protection
  // ==============================
  backBtn?.addEventListener("click", (e) => {
    if (hasUnsavedChanges && !confirm("You have unsaved changes. Leave without saving?")) {
      e.preventDefault();
    }
  });

  // ==============================
  // ✏️ Edit / Save toggle
  // ==============================
  editBtn?.addEventListener("click", () => {
    const isEditing = editBtn.classList.toggle("editing");
    document.body.classList.toggle("editing", isEditing);

    formInputs.forEach(input => {
      if (input.dataset.readonly === "true") return;
      input.disabled = !isEditing;
    });

    const icon = editBtn.querySelector("i");
    if (icon) {
      icon.classList.toggle("fa-pen", !isEditing);
      icon.classList.toggle("fa-save", isEditing);
    }

    // ==============================
    // 💾 SAVE MODE
    // ==============================
    if (!isEditing) {
      if (isSaving) return;

      const changedData = {};

      formInputs.forEach(input => {
        if (!input.id || input.dataset.readonly === "true") return;

        const originalValue = originalData[input.id] ?? "";
        const currentValue = input.value ?? "";

        if (currentValue !== originalValue) {
          changedData[input.id] = currentValue;
        }
      });

      if (Object.keys(changedData).length === 0) {
        showSaveState("info", "No changes to save");
        return;
      }

      isSaving = true;
      showSaveState("info", "Saving…", false);

      fetch(`/update-case/${caseId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changedData)
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            Object.keys(changedData).forEach(key => {
              originalData[key] = changedData[key];
              document.getElementById(key)?.classList.remove("dirty");
            });

            hasUnsavedChanges = false;
            showSaveState("success", "All changes saved");
          } else {
            showSaveState("error", "Save failed", false);
            alert("Save failed");
          }
        })
        .catch(() => {
          showSaveState("error", "Network error", false);
          alert("Network error saving case");
        })
        .finally(() => {
          isSaving = false;
        });
    }
  });

  // ==============================
  // 🎯 Field type icons (dates & money)
  // ==============================
  const FIELD_TYPE_ICONS = {
    date: "fa-regular fa-calendar",
    money: "fa-solid fa-sterling-sign"
  };

  document.querySelectorAll(".form-field").forEach(field => {
    const input = field.querySelector("[data-field-type]");
    const label = field.querySelector("label");

    if (!input || !label) return;

    const type = input.dataset.fieldType;
    const iconClass = FIELD_TYPE_ICONS[type];
    if (!iconClass) return;

    const icon = document.createElement("i");
    icon.className = `label-icon ${iconClass}`;
    icon.setAttribute("aria-hidden", "true");

    label.appendChild(icon);
    field.classList.add("has-label-icon");
  });
});