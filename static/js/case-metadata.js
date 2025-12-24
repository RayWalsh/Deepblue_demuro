// =========================================
// 📄 case-metadata.js — Metadata-driven Case View + Edit + Choice Dropdowns
// =========================================

document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("case-meta-content");
  const caseContainer = document.querySelector(".case-detail-container[data-case-id]");
  const editBtn = document.getElementById("editBtn");

  if (!container || !caseContainer) return;

  const caseId = caseContainer.dataset.caseId;

  let metadata = [];
  let caseData = {};
  let editMode = false;
  let didAttemptSave = false;

  // Cache: { ColumnName: [ "Choice 1", "Choice 2", ... ] }
  const choiceCache = {};

  // --------------------------------------------------
  // 🚀 INIT
  // --------------------------------------------------
  try {
    await loadData();
    await renderView(); // async now (choices)
  } catch (err) {
    console.error("❌ Metadata case render failed:", err);
    container.innerHTML = `<p style="color:red;">Failed to load metadata-driven case view</p>`;
  }

  // --------------------------------------------------
  // ✏️ EDIT BUTTON TOGGLE
  // --------------------------------------------------
  if (editBtn) {
    editBtn.addEventListener("click", async () => {
      editMode = !editMode;
      editBtn.classList.toggle("active", editMode);

      if (!editMode) {
        didAttemptSave = true;
        await saveChanges();
        showSaveToast("Saved successfully");
      }

      renderView();
    });
  }

  // --------------------------------------------------
  // 📡 LOAD METADATA + CASE
  // --------------------------------------------------
  async function loadData() {
    const metaRes = await fetch("/api/case-metadata", { cache: "no-store" });
    const metaJson = await metaRes.json();
    if (!metaJson.success) throw new Error("Metadata load failed");

    const caseRes = await fetch(`/api/case/${caseId}`, { cache: "no-store" });
    const caseJson = await caseRes.json();
    if (!caseJson.success) throw new Error("Case load failed");

    metadata = metaJson.columns || [];
    caseData = caseJson.case || {};
  }

  // --------------------------------------------------
  // 🧱 RENDER VIEW (GROUPED)
  // --------------------------------------------------
  async function renderView() {
    // Group metadata by GroupName
    const groups = {};
    metadata.forEach((col) => {
      const g = col.GroupName || "Other";
      if (!groups[g]) groups[g] = [];
      groups[g].push(col);
    });

    container.innerHTML = "";

    // Render groups in order (GroupOrder then FieldOrder already sorted by SQL,
    // but we’ll keep it stable)
    for (const [groupName, fields] of Object.entries(groups)) {
      const section = document.createElement("section");
      section.className = "case-details-view";

      const grid = document.createElement("div");
      grid.className = "form-grid";

      // Render fields in this group
      for (const f of fields) {
        const fieldEl = await renderField(f);
        if (fieldEl) grid.appendChild(fieldEl);
      }

      const h3 = document.createElement("h3");
      h3.textContent = groupName;

      section.appendChild(h3);
      section.appendChild(grid);
      container.appendChild(section);
    }
  }

  // --------------------------------------------------
  // 🧩 FIELD RENDERER (returns DOM element)
  // --------------------------------------------------
  async function renderField(meta) {
    const col = meta.ColumnName;
    if (!col) return null;

    const wrapper = document.createElement("div");
    wrapper.className = "form-field";

    if (!meta.IsEditable) wrapper.classList.add("readonly");

    const label = document.createElement("label");
    label.textContent = meta.DisplayName || col;

    // Current value from case
    const rawValue = caseData[col];

    // Disabled rules:
    // - If not edit mode -> disabled always
    // - If edit mode but field is not editable -> disabled
    const disabled = !editMode || !meta.IsEditable;

    let inputEl;

    switch ((meta.FieldType || "").toLowerCase()) {
      case "date":
        inputEl = document.createElement("input");
        inputEl.type = "date";
        inputEl.dataset.field = col;
        inputEl.disabled = disabled;

        // Convert DB date into YYYY-MM-DD if possible
        inputEl.value = toDateInputValue(rawValue);
        break;

      case "number":
      case "money":
        inputEl = document.createElement("input");
        inputEl.type = "number";
        inputEl.dataset.field = col;
        inputEl.disabled = disabled;

        inputEl.value =
          rawValue === null || rawValue === undefined ? "" : String(rawValue);
        break;

      case "boolean":
        inputEl = document.createElement("input");
        inputEl.type = "checkbox";
        inputEl.dataset.field = col;
        inputEl.disabled = disabled;

        inputEl.checked = !!rawValue;
        break;

      case "choice":
        inputEl = document.createElement("select");
        inputEl.dataset.field = col;
        inputEl.disabled = disabled;

        const choices = await getChoicesForColumn(col);

        // Add blank option (lets user clear value)
        const blank = document.createElement("option");
        blank.value = "";
        blank.textContent = "—";
        inputEl.appendChild(blank);

        choices.forEach((c) => {
          const opt = document.createElement("option");
          opt.value = c;          // ✅ store text value (A)
          opt.textContent = c;
          inputEl.appendChild(opt);
        });

        // Preselect current value (match text)
        inputEl.value = rawValue ?? "";
        break;

      default:
        inputEl = document.createElement("input");
        inputEl.type = "text";
        inputEl.dataset.field = col;
        inputEl.disabled = disabled;

        inputEl.value =
          rawValue === null || rawValue === undefined ? "" : String(rawValue);
    }

    wrapper.appendChild(label);
    wrapper.appendChild(inputEl);

    return wrapper;
  }

  // --------------------------------------------------
  // 🔽 LOAD CHOICES (cached)
  // --------------------------------------------------
  async function getChoicesForColumn(columnName) {
    if (choiceCache[columnName]) return choiceCache[columnName];

    try {
      const res = await fetch(`/api/column-choices/${encodeURIComponent(columnName)}`, {
        cache: "no-store",
      });
      const json = await res.json();

      if (!json.success) {
        console.warn(`⚠️ Choices not available for ${columnName}`);
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
  // 💾 SAVE CHANGES (EDITABLE FIELDS ONLY)
  // --------------------------------------------------
  async function saveChanges() {
    const payload = {};

    metadata
      .filter((m) => m.IsEditable)
      .forEach((m) => {
        const col = m.ColumnName;
        const el = container.querySelector(`[data-field="${cssEscape(col)}"]`);
        if (!el) return;

        let value = null;

        switch ((m.FieldType || "").toLowerCase()) {
          case "boolean":
            value = el.checked;
            break;

          case "date":
            // store as ISO-ish string suitable for SQL
            // if blank -> null
            value = el.value ? toSQLDateTime(el.value) : null;
            break;

          default:
            value = (el.value ?? "").toString().trim();
            if (value === "") value = null;
        }

        payload[col] = value;
      });

    try {
      const res = await fetch(`/update-case/${caseId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!result.success) throw new Error(result.error || "Save failed");

      // Reload fresh data (so values re-render cleanly)
      await loadData();
    } catch (err) {
      alert("❌ Failed to save changes");
      console.error("Save error:", err);
    }
  }

  // --------------------------------------------------
  // 🧰 HELPERS
  // --------------------------------------------------

  // Convert DB value into YYYY-MM-DD for <input type="date">
  function toDateInputValue(value) {
    if (!value) return "";
    const d = new Date(value);
    if (isNaN(d)) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // Convert "YYYY-MM-DD" to "YYYY-MM-DD 00:00:00"
  // (keeps your SQL happy without timezone madness)
  function toSQLDateTime(dateStr) {
    // dateStr is already YYYY-MM-DD
    return `${dateStr} 00:00:00`;
  }

  // CSS.escape polyfill-ish for simple field names
  function cssEscape(str) {
    // Most of your column names are safe already (letters/numbers/_)
    // This just prevents selector failures if odd chars appear later.
    return String(str).replace(/"/g, '\\"');
  }
});