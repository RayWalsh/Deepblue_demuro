// ==============================================
// ➕ Add Entry Modal Controller (Autofill + Confidence)
// ==============================================
document.addEventListener("DOMContentLoaded", () => {

  // --------------------------------------------------
  // 🔧 Elements
  // --------------------------------------------------
  const addModal = document.getElementById("addEntryModal");
  const openAddBtn = document.getElementById("openAddEntryBtn");
  const closeAddBtn = document.getElementById("closeAddEntryBtn");
  const saveAddBtn = document.getElementById("saveAddEntryBtn");
  const addModalForm = document.getElementById("addModalForm");

  const cpUploadZone = document.getElementById("cpUploadZone");
  const cpFileInput = document.getElementById("cpFileInput");
  const cpUploadStatus = document.getElementById("cpUploadStatus");

  if (!addModal || !openAddBtn || !addModalForm) return;

  let selectedCPFile = null;

  // --------------------------------------------------
  // 🔗 CP → Ledger field mapping
  // --------------------------------------------------
  const CP_FIELD_MAP = {
    VesselName: "VesselName",
    ChartererName: "CharterersName",
    OwnerName: "OwnersName",
    BrokerName: "BrokersName",
    CPDate: "CPDate",
    DemurrageRate: "DemurrageRate",
    CPForm: "CPForm",
  };

  // --------------------------------------------------
  // 🧠 Helpers
  // --------------------------------------------------
  function openModal() {
    addModal.style.display = "flex";
  }

  function closeModal() {
    addModal.style.display = "none";
    addModalForm.innerHTML = `<p class="muted">Loading form…</p>`;
    resetCPUpload();
  }

  function resetCPUpload() {
    if (!cpUploadStatus || !cpFileInput) return;
    cpUploadStatus.classList.add("hidden");
    cpUploadStatus.innerHTML = "";
    cpFileInput.value = "";
    selectedCPFile = null;
  }

  function normalizeDateForInput(value) {
    if (!value) return null;

    const cleaned = value
      .replace(/\./g, " ")
      .replace(/TH|ST|ND|RD/i, "")
      .trim();

    const parsed = Date.parse(cleaned);
    if (isNaN(parsed)) return null;

    return new Date(parsed).toISOString().split("T")[0];
  }

  // --------------------------------------------------
  // 🎯 Confidence helpers
  // --------------------------------------------------
  function confidenceColour(confidence) {
    if (confidence >= 0.85) return "green";
    if (confidence >= 0.6) return "orange";
    return "red";
  }

  function injectConfidenceIndicator(input, confidence) {
    if (confidence === null || confidence === undefined) return;

    const wrapper = input.closest("div");
    if (!wrapper || wrapper.querySelector(".confidence-indicator")) return;

    wrapper.style.position = "relative";

    const indicator = document.createElement("span");
    indicator.className = "confidence-indicator";

    const dot = document.createElement("span");
    dot.className = `dot ${confidenceColour(confidence)}`;

    const label = document.createElement("span");
    label.textContent = `${Math.round(confidence * 100)}%`;

    indicator.appendChild(dot);
    indicator.appendChild(label);
    wrapper.appendChild(indicator);
  }

  // --------------------------------------------------
  // ⏳ CP Processing Indicator
  // --------------------------------------------------
  function showCPProcessing() {
    if (!cpUploadStatus) return;
    if (cpUploadStatus.classList.contains("hidden")) return;

    cpUploadStatus.classList.add("loading");

    if (cpUploadStatus.querySelector(".cp-processing")) return;

    cpUploadStatus.insertAdjacentHTML(
      "beforeend",
      `<div class="cp-processing">
        <span class="spinner"></span>
        <span>Processing charterparty…</span>
      </div>`
    );
  }

  function clearCPProcessing() {
    if (!cpUploadStatus) return;

    const p = cpUploadStatus.querySelector(".cp-processing");
    if (p) p.remove();

    cpUploadStatus.classList.remove("loading");
  }

  // --------------------------------------------------
  // 🔍 Fuzzy match dropdown options
  // --------------------------------------------------
  function fuzzyMatchOption(value, options = []) {
    if (!value) return null;

    const v = value.toLowerCase().replace(/\s+/g, "");
    let best = null;
    let score = 0;

    options.forEach(opt => {
      const o = opt.toLowerCase().replace(/\s+/g, "");
      let matches = 0;

      for (let i = 0; i < Math.min(v.length, o.length); i++) {
        if (v[i] === o[i]) matches++;
      }

      const ratio = matches / Math.max(v.length, o.length);
      if (ratio > score) {
        score = ratio;
        best = opt;
      }
    });

    return score >= 0.6 ? best : null;
  }

  function injectExtractedNote(input, text) {
    const wrapper = input.closest("div");
    if (!wrapper || wrapper.querySelector(".cp-extracted-note")) return;

    const note = document.createElement("div");
    note.className = "cp-extracted-note amber";
    note.textContent = `Extracted: “${text}” (not in list)`;

    wrapper.appendChild(note);
  }

  // --------------------------------------------------
  // ➕ OPEN ADD ENTRY MODAL
  // --------------------------------------------------
  openAddBtn.addEventListener("click", () => {

    if (!window.allColumns || !window.fieldGroups) {
      alert("Ledger metadata is still loading. Please try again.");
      return;
    }

    openModal();

    let html = "";

    for (const [groupName, fields] of Object.entries(window.fieldGroups)) {
      html += `
        <section class="field-group">
          <h4>${groupName}</h4>
          <div class="field-grid">
      `;

      fields.forEach(col => {
        const type = inferInputType(col);
        const disabled = window.systemFields?.includes(col) ? "disabled" : "";

        if (type === "textarea") {
          html += `
            <div>
              <label>${col}</label>
              <textarea name="${col}" rows="2" ${disabled}></textarea>
            </div>
          `;
        } else if (type === "select") {
          html += `
            <div>
              <label>${col}</label>
              ${renderChoiceSelect({ name: col, value: "", disabled: !!disabled })}
            </div>
          `;
        } else {
          html += `
            <div>
              <label>${col}</label>
              <input type="${type}" name="${col}" ${disabled}/>
            </div>
          `;
        }
      });

      html += `
          </div>
        </section>
      `;
    }

    addModalForm.innerHTML = html;
  });

  // --------------------------------------------------
  // ❌ CLOSE MODAL
  // --------------------------------------------------
  closeAddBtn.addEventListener("click", closeModal);

  addModal.addEventListener("click", (e) => {
    if (e.target === addModal) closeModal();
  });

  // --------------------------------------------------
  // 💾 SAVE ENTRY (DeepBlueRef required)
  // --------------------------------------------------
  saveAddBtn.addEventListener("click", async () => {

    // 🔒 Enforce DeepBlueRef
    const refInput = addModalForm.querySelector('[name="DeepBlueRef"]');

    if (!refInput || !refInput.value || !refInput.value.trim()) {
      alert("❌ Deep Blue Ref is required before saving this case.");
      refInput?.focus();
      return;
    }

    const payload = buildPayloadFromInputs(addModalForm);

    try {
      const res = await fetch("/api/add-ledger-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Insert failed");
      }

      closeModal();

      if (typeof window.reloadLedger === "function") {
        window.reloadLedger();
      }

    } catch (err) {
      alert("❌ " + err.message);
    }
  });

  // --------------------------------------------------
  // 📎 CP UPLOAD + PARSE
  // --------------------------------------------------
  if (cpUploadZone && cpFileInput && cpUploadStatus) {

    cpUploadZone.onclick = () => cpFileInput.click();

    cpFileInput.onchange = () => {
      if (cpFileInput.files.length) {
        handleCPFile(cpFileInput.files[0]);
      }
    };
  }

  async function handleCPFile(file) {

    if (file.type !== "application/pdf") {
      alert("Only PDF charterparties are supported.");
      return;
    }

    selectedCPFile = file;

    cpUploadStatus.innerHTML = `
      <i class="fa-solid fa-file-lines"></i>
      <div class="meta">
        <strong>${file.name}</strong>
        <span>${Math.round(file.size / 1024)} KB</span>
      </div>
      <span class="replace">Replace</span>
    `;
    cpUploadStatus.classList.remove("hidden");

    cpUploadStatus.querySelector(".replace").onclick = (e) => {
      e.stopPropagation();
      resetCPUpload();
    };

    showCPProcessing();

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/cp/parse", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Parse failed");

      applyCPFieldsToForm(data.fields);

    } catch (err) {
      alert("❌ CP parse failed: " + err.message);
    } finally {
      clearCPProcessing();
    }
  }

  // --------------------------------------------------
  // 🧠 APPLY FIELDS + CONFIDENCE
  // --------------------------------------------------
  function applyCPFieldsToForm(fields) {
    if (!fields || typeof fields !== "object") return;

    Object.entries(fields).forEach(([cpField, payload]) => {
      const ledgerField = CP_FIELD_MAP[cpField];
      if (!ledgerField) return;

      const input = addModalForm.querySelector(`[name="${ledgerField}"]`);
      if (!input || !payload?.value) return;

      // Do not overwrite user edits
      if (input.value && input.value.trim() !== "") return;

      let value = payload.value;

      // Date fields
      if (input.type === "date") {
        value = normalizeDateForInput(value);
        if (!value) return;
        input.value = value;
      }

      // Select / dropdown fields
      else if (input.tagName === "SELECT") {
        const options = Array.from(input.options).map(o => o.value);
        const match = fuzzyMatchOption(value, options);

        if (match) {
          input.value = match;
        } else {
          injectExtractedNote(input, value);
        }
      }

      // Text / number
      else {
        input.value = value;
      }

      input.classList.add("autofilled");
      injectConfidenceIndicator(input, payload.confidence);
    });
  }

});