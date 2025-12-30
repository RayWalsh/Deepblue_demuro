// =========================================
// 📄 case.js — Unified metadata-driven Case View + Edit + Save UX
// Replaces legacy static form logic + case-metadata.js
// =========================================

document.addEventListener("DOMContentLoaded", async () => {
  // --------------------------------------------------
  // 🔗 Core DOM references
  // --------------------------------------------------
  const metaContainer = document.getElementById("case-meta-content"); // metadata UI target
  const caseContainer = document.querySelector(".case-detail-container[data-case-id]");
  const editBtn = document.getElementById("editBtn");
  const saveNotice = document.getElementById("saveNotification");
  const backBtn = document.getElementById("backToLedger");

  // If metadata container isn't present, do nothing (keeps old pages safe).
  if (!metaContainer || !caseContainer) return;

  const caseId = caseContainer.dataset.caseId;

  // --------------------------------------------------
  // ⚙️ State
  // --------------------------------------------------
  let metadata = [];
  let caseData = {};
  let editMode = false;

  // Baseline values for dirty detection (only for editable fields)
  let baselineData = {}; // { ColumnName: normalizedValue }

  let hasUnsavedChanges = false;
  let isSaving = false;

  // Cache: { ColumnName: [ "Choice 1", "Choice 2" ] }
  const choiceCache = {};

  // --------------------------------------------------
  // 🔔 Save notification helper (reuses your existing UI)
  // --------------------------------------------------
  function showSaveState(type, text, autoHide = true) {
    if (!saveNotice) return;

    saveNotice.className = `save-notification ${type}`;
    saveNotice.textContent = text;
    saveNotice.classList.remove("hidden");

    if (autoHide && type === "success") {
      setTimeout(() => saveNotice.classList.add("hidden"), 2500);
    }
  }

  // --------------------------------------------------
  // 🚀 INIT
  // --------------------------------------------------
  try {
    await loadData();
    buildBaselineFromCase();   // baseline from DB values
    await renderMetaView();    // renders inputs based on metadata
    wireGlobalGuards();        // unload/back protection

    // initial icon state = pen
    setEditButtonVisual(false);
    showSaveState("info", "No unsaved changes", false);
  } catch (err) {
    console.error("❌ Case init failed:", err);
    metaContainer.innerHTML = `<p style="color:red;">Failed to load case view</p>`;
    return;
  }

  // --------------------------------------------------
  // ✏️ Edit / Save toggle button
  // --------------------------------------------------
  editBtn?.addEventListener("click", async () => {
    // Toggle
    editMode = !editMode;

    // Update visuals / CSS hook
    document.body.classList.toggle("editing", editMode);
    editBtn.classList.toggle("editing", editMode);
    setEditButtonVisual(editMode);

    // Enable/disable inputs
    setInputsEnabled(editMode);

    // SAVE mode when turning OFF editing
    if (!editMode) {
      if (isSaving) return;

      const changes = collectChangedFields();
      if (Object.keys(changes).length === 0) {
        // If user tried to save but nothing changed
        showSaveState("info", "No changes to save", false);
        return;
      }

      isSaving = true;
      showSaveState("info", "Saving…", false);

      const ok = await saveChanges(changes);
      isSaving = false;

      if (!ok) return;

      // Refresh data from server so UI is truth
      await loadData();
      buildBaselineFromCase();
      await renderMetaView();

      // Reset dirty state
      hasUnsavedChanges = false;
      showSaveState("success", "All changes saved");
    }
  });

  // --------------------------------------------------
  // 📡 LOAD METADATA + CASE DATA
  // --------------------------------------------------
  async function loadData() {
    const metaRes = await fetch("/api/case-metadata", { cache: "no-store" });
    const metaJson = await metaRes.json();
    if (!metaJson.success) throw new Error("Metadata load failed");

    const caseRes = await fetch(`/api/case/${caseId}`, { cache: "no-store" });
    const caseJson = await caseRes.json();
    if (!caseJson.success) throw new Error("Case load failed");

    metadata = Array.isArray(metaJson.columns) ? metaJson.columns : [];
    caseData = caseJson.case || {};
  }

  // --------------------------------------------------
  // 🧱 Build baseline from DB caseData (editable fields only)
  // --------------------------------------------------
  function buildBaselineFromCase() {
    baselineData = {};

    metadata
      .filter(m => m.IsEditable)
      .forEach(m => {
        const col = m.ColumnName;
        baselineData[col] = normalizeValueForCompare(m, caseData[col]);
      });
  }

  // --------------------------------------------------
  // 🧾 Render metadata-driven view
  // --------------------------------------------------
  async function renderMetaView() {
    // Group by GroupName
    const groups = {};
    metadata.forEach(col => {
      const g = col.GroupName || "Other";
      if (!groups[g]) groups[g] = [];
      groups[g].push(col);
    });

    metaContainer.innerHTML = "";

    // Iterate in insertion order (metadata already ordered by SQL)
    for (const [groupName, fields] of Object.entries(groups)) {
      const section = document.createElement("section");
      section.className = "case-details-view";

      const h3 = document.createElement("h3");
      h3.textContent = groupName;

      const grid = document.createElement("div");
      grid.className = "form-grid";

      for (const f of fields) {
        const fieldEl = await renderField(f);
        if (fieldEl) grid.appendChild(fieldEl);
      }

      section.appendChild(h3);
      section.appendChild(grid);
      metaContainer.appendChild(section);
    }

    // After render, hook dirty detection on these new inputs
    wireDirtyDetection();
    // Ensure enable/disable matches current edit mode
    setInputsEnabled(editMode);
  }

  // --------------------------------------------------
  // 🧩 Render one field
  // --------------------------------------------------
  async function renderField(meta) {
    const col = meta.ColumnName;
    if (!col) return null;

    const wrapper = document.createElement("div");
    wrapper.className = "form-field";

    if (!meta.IsEditable) wrapper.classList.add("readonly");

    const label = document.createElement("label");
    label.textContent = meta.DisplayName || col;

    // Build input
    const rawValue = caseData[col];
    const disabled = !editMode || !meta.IsEditable;

    let inputEl;

    switch ((meta.FieldType || "").toLowerCase()) {
      case "date": {
        inputEl = document.createElement("input");
        inputEl.type = "date";
        inputEl.dataset.field = col;
        inputEl.disabled = disabled;
        inputEl.value = toDateInputValue(rawValue);
        break;
      }

      // ✅ NEW: datetime support
      case "datetime": {
        inputEl = document.createElement("input");
        inputEl.type = "datetime-local";
        inputEl.dataset.field = col;
        inputEl.disabled = disabled;
        inputEl.value = toDateTimeInputValue(rawValue);
        break;
      }

      case "number":
      case "money": {
        inputEl = document.createElement("input");
        inputEl.type = "number";
        inputEl.dataset.field = col;
        inputEl.disabled = disabled;
        inputEl.value =
          rawValue === null || rawValue === undefined ? "" : String(rawValue);
        break;
      }

      case "boolean": {
        inputEl = document.createElement("input");
        inputEl.type = "checkbox";
        inputEl.dataset.field = col;
        inputEl.disabled = disabled;
        inputEl.checked = !!rawValue;
        break;
      }

      case "choice": {
        inputEl = document.createElement("select");
        inputEl.dataset.field = col;
        inputEl.disabled = disabled;

        const choices = await getChoicesForColumn(col);

        const blank = document.createElement("option");
        blank.value = "";
        blank.textContent = "—";
        inputEl.appendChild(blank);

        choices.forEach((c) => {
          const opt = document.createElement("option");
          opt.value = c;
          opt.textContent = c;
          inputEl.appendChild(opt);
        });

        inputEl.value = rawValue ?? "";
        break;
      }

      default: {
        inputEl = document.createElement("input");
        inputEl.type = "text";
        inputEl.dataset.field = col;
        inputEl.disabled = disabled;
        inputEl.value =
          rawValue === null || rawValue === undefined ? "" : String(rawValue);
        break;
      }
    }

    // Mark readonly fields as readonly-looking (optional)
    if (!meta.IsEditable) {
      inputEl.setAttribute("data-readonly", "true");
    }

    wrapper.appendChild(label);
    wrapper.appendChild(inputEl);

    return wrapper;
  }

  // --------------------------------------------------
  // 🔽 Load choices (cached)
  // --------------------------------------------------
  async function getChoicesForColumn(columnName) {
    if (choiceCache[columnName]) return choiceCache[columnName];

    try {
      const res = await fetch(`/api/column-choices/${encodeURIComponent(columnName)}`, {
        cache: "no-store",
      });
      const json = await res.json();

      if (!json.success) {
        choiceCache[columnName] = [];
        return [];
      }

      const arr = Array.isArray(json.choices) ? json.choices : [];
      choiceCache[columnName] = arr;
      return arr;
    } catch (e) {
      console.warn(`⚠️ Failed loading choices for ${columnName}`, e);
      choiceCache[columnName] = [];
      return [];
    }
  }

  // --------------------------------------------------
  // 🟡 Dirty detection (metadata inputs)
  // --------------------------------------------------
  function wireDirtyDetection() {
    // Remove old dirty state and re-evaluate from scratch
    hasUnsavedChanges = false;

    const inputs = metaContainer.querySelectorAll("[data-field]");
    inputs.forEach(el => {
      el.classList.remove("dirty");
      el.addEventListener("input", onFieldChange);
      el.addEventListener("change", onFieldChange); // for select/checkbox/date
    });

    updateDirtyUI();
  }

  function onFieldChange(e) {
    const el = e.target;
    const col = el.dataset.field;
    if (!col) return;

    const meta = metadata.find(m => m.ColumnName === col);
    if (!meta || !meta.IsEditable) return;

    const current = readValueFromElement(meta, el);
    const baseline = baselineData[col];

    const changed = current !== baseline;

    if (changed) el.classList.add("dirty");
    else el.classList.remove("dirty");

    hasUnsavedChanges = !!metaContainer.querySelector(".dirty");
    updateDirtyUI();
  }

  function updateDirtyUI() {
    if (hasUnsavedChanges) {
      showSaveState("info", "Unsaved changes", false);
    } else {
      showSaveState("info", "No unsaved changes", false);
    }
  }

  // --------------------------------------------------
  // 💾 Collect only changed editable fields
  // --------------------------------------------------
  function collectChangedFields() {
    const changed = {};

    metadata
      .filter(m => m.IsEditable)
      .forEach(m => {
        const col = m.ColumnName;
        const el = metaContainer.querySelector(`[data-field="${cssEscape(col)}"]`);
        if (!el) return;

        const current = readValueFromElement(m, el);
        const baseline = baselineData[col];

        if (current !== baseline) {
          // Convert for saving (SQL-friendly)
          changed[col] = toSavePayloadValue(m, el);
        }
      });

    return changed;
  }

  // --------------------------------------------------
  // 💾 Save changes to Flask
  // --------------------------------------------------
  async function saveChanges(changes) {
    try {
      const res = await fetch(`/update-case/${caseId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });

      const result = await res.json();
      if (!result.success) {
        showSaveState("error", "Save failed", false);
        console.error("Save error:", result);
        return false;
      }

      return true;
    } catch (err) {
      showSaveState("error", "Network error", false);
      console.error("Save exception:", err);
      return false;
    }
  }

  // --------------------------------------------------
  // 🔒 Enable/disable inputs based on editMode
  // --------------------------------------------------
  function setInputsEnabled(isEditing) {
    const inputs = metaContainer.querySelectorAll("[data-field]");
    inputs.forEach(el => {
      const col = el.dataset.field;
      const meta = metadata.find(m => m.ColumnName === col);
      if (!meta) return;

      // editable fields toggle, readonly stays disabled always
      el.disabled = !(isEditing && meta.IsEditable);
    });
  }

  // --------------------------------------------------
  // ⬅️ Back / unload guards
  // --------------------------------------------------
  function wireGlobalGuards() {
    window.addEventListener("beforeunload", (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    });

    backBtn?.addEventListener("click", (e) => {
      if (hasUnsavedChanges && !confirm("You have unsaved changes. Leave without saving?")) {
        e.preventDefault();
      }
    });
  }

  // --------------------------------------------------
  // 🎛️ Edit button icon toggle
  // --------------------------------------------------
  function setEditButtonVisual(isEditing) {
    const icon = editBtn?.querySelector("i");
    if (!icon) return;

    icon.classList.toggle("fa-pen", !isEditing);
    icon.classList.toggle("fa-save", isEditing);
  }

  // --------------------------------------------------
  // 🧰 Value helpers
  // --------------------------------------------------
  function readValueFromElement(meta, el) {
    const ft = (meta.FieldType || "").toLowerCase();

    if (ft === "boolean") {
      return !!el.checked;
    }

    if (ft === "date") {
      // compare as YYYY-MM-DD (or "" => null)
      const v = (el.value || "").trim();
      return v === "" ? null : v;
    }

    if (ft === "datetime") {
      const v = (el.value || "").trim();
      return v === "" ? null : v;
    }

    // text/number/money/choice
    const v = (el.value ?? "").toString().trim();
    return v === "" ? null : v;
  }

  function normalizeValueForCompare(meta, valueFromDb) {
    const ft = (meta.FieldType || "").toLowerCase();

    if (valueFromDb === undefined || valueFromDb === null || valueFromDb === "") {
      return null;
    }

    if (ft === "boolean") {
      return !!valueFromDb;
    }

    if (ft === "date") {
      // normalize DB datetime → YYYY-MM-DD
      return toDateInputValue(valueFromDb) || null;
    }

    if (ft === "datetime") {
      // normalize DB datetime → YYYY-MM-DDTHH:MM (for datetime-local inputs)
      return toDateTimeInputValue(valueFromDb) || null;
    }

    // For numbers stored as numeric, normalize to string to compare against input.value
    if (ft === "number" || ft === "money") {
      return String(valueFromDb);
    }

    // choice / text etc
    return String(valueFromDb);
  }

  function toSavePayloadValue(meta, el) {
    const ft = (meta.FieldType || "").toLowerCase();

    if (ft === "boolean") {
      return !!el.checked;
    }

    if (ft === "date") {
      // Save as "YYYY-MM-DD 00:00:00" (matches DB expectations)
      const v = (el.value || "").trim();
      return v === "" ? null : `${v} 00:00:00`;
    }

    if (ft === "datetime") {
      const v = (el.value || "").trim();
      return v === "" ? null : toSQLDateTime(v);
    }

    // number / money / choice / text
    const v = (el.value ?? "").toString().trim();
    return v === "" ? null : v;
  }

  function toSQLDateTime(value) {
    // value comes from <input type="datetime-local">
    // format: YYYY-MM-DDTHH:MM
    if (!value) return null;

    return value.replace("T", " ") + ":00";
  }

  function toDateInputValue(value) {
    if (!value) return "";
    const d = new Date(value);
    if (isNaN(d)) return "";

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function toDateTimeInputValue(value) {
    if (!value) return "";
    const d = new Date(value);
    if (isNaN(d)) return "";

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");

    // HTML datetime-local format
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  function cssEscape(str) {
    // Your column names are safe; this prevents selector failures later
    return String(str).replace(/"/g, '\\"');
  }
});