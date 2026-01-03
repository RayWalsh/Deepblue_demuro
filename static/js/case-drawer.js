// ==============================================
// Case Editor (Side Modal) — Metadata-driven + TABBED
// - Renders fields from /api/case-metadata
// - Loads choices from /api/column-choices/<ColumnName>
// - Saves to /update-case/<CaseID>
// - No window.CASE_EDIT_SCHEMA
// ==============================================

(function () {
  const META_URL = "/api/case-metadata";

  let cachedMeta = null;
  const choicesCache = new Map(); // columnName -> array
  let baseline = {};              // baseline values for dirty detection

  function $(id) {
    return document.getElementById(id);
  }

  function safeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toDateInputValue(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
      return "";
    }
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  async function fetchMeta() {
    if (cachedMeta) return cachedMeta;

    const res = await fetch(META_URL, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Metadata request failed (${res.status})`);

    const json = await res.json();
    if (!json.success) throw new Error(json.error || "Metadata error");

    cachedMeta = json.columns || [];
    return cachedMeta;
  }

  async function fetchChoices(columnName) {
    if (choicesCache.has(columnName)) return choicesCache.get(columnName);

    const res = await fetch(`/api/column-choices/${encodeURIComponent(columnName)}`, {
      headers: { Accept: "application/json" }
    });

    if (!res.ok) {
      choicesCache.set(columnName, []);
      return [];
    }

    const json = await res.json();
    const choices = json.success ? (json.choices || []) : [];
    choicesCache.set(columnName, choices);
    return choices;
  }

  function getCurrentValue(caseData, col) {
    const v = caseData?.[col];
    return v === null || v === undefined ? "" : v;
  }

  function buildFieldHTML(field, value, choices = []) {
    const key = field.ColumnName;
    const label = field.DisplayName || key;
    const type = (field.FieldType || "text").toLowerCase();
    const editable = !!field.IsEditable;

    const disabledAttr = editable ? "" : "disabled";

    if (type === "boolean") {
      const boolVal = (value === true || value === "true");
      return `
        <label class="form-row">
          <span>${safeHtml(label)}</span>
          <select data-key="${safeHtml(key)}" ${disabledAttr}>
            <option value="true" ${boolVal ? "selected" : ""}>Yes</option>
            <option value="false" ${!boolVal ? "selected" : ""}>No</option>
          </select>
        </label>
      `;
    }

    if (type === "date") {
      const dateVal = toDateInputValue(value);
      return `
        <label class="form-row">
          <span>${safeHtml(label)}</span>
          <input type="date" value="${safeHtml(dateVal)}" data-key="${safeHtml(key)}" ${disabledAttr} />
        </label>
      `;
    }

    if (type === "number") {
      const numVal = value === "" ? "" : value;
      return `
        <label class="form-row">
          <span>${safeHtml(label)}</span>
          <input type="number" value="${safeHtml(numVal)}" data-key="${safeHtml(key)}" ${disabledAttr} />
        </label>
      `;
    }

    if (type === "choice") {
      const strVal = value === "" ? "" : String(value);
      const opts = [`<option value="">—</option>`]
        .concat(
          choices.map(c => {
            const v = String(c);
            const selected = v === strVal ? "selected" : "";
            return `<option value="${safeHtml(v)}" ${selected}>${safeHtml(v)}</option>`;
          })
        )
        .join("");

      return `
        <label class="form-row">
          <span>${safeHtml(label)}</span>
          <select data-key="${safeHtml(key)}" ${disabledAttr}>
            ${opts}
          </select>
        </label>
      `;
    }

    // default text
    return `
      <label class="form-row">
        <span>${safeHtml(label)}</span>
        <input type="text" value="${safeHtml(value)}" data-key="${safeHtml(key)}" ${disabledAttr} />
      </label>
    `;
  }

  // Map metadata GroupName -> your 3 tabs
  function groupToTabKey(groupName) {
    const g = String(groupName || "").toLowerCase();
    if (g.includes("charter")) return "charterparty";
    if (g.includes("rate") || g.includes("laytime")) return "rates";
    return "general";
  }

  async function renderTabbedForm() {
    const modal = document.getElementById("editCaseModal");
    const panelGeneral = document.getElementById("edit-general");
    const panelCP = document.getElementById("edit-charterparty");
    const panelRates = document.getElementById("edit-rates");

    if (!modal || !panelGeneral || !panelCP || !panelRates) {
      console.warn("❌ Edit case modal structure missing");
      return;
    }

    // --------------------------------------------------
    // ✅ SOURCE OF TRUTH: window.caseData (dashboard only)
    // --------------------------------------------------
    const caseData = window.caseData;

    if (!caseData) {
      panelGeneral.innerHTML =
        `<p class="muted">Case data not available.</p>`;
      panelCP.innerHTML = "";
      panelRates.innerHTML = "";
      return;
    }

    // Loading placeholders
    panelGeneral.innerHTML = `<p class="muted">Loading…</p>`;
    panelCP.innerHTML = `<p class="muted">Loading…</p>`;
    panelRates.innerHTML = `<p class="muted">Loading…</p>`;

    // --------------------------------------------------
    // 📡 Load metadata (allowed)
    // --------------------------------------------------
    const meta = await fetchMeta();
    const visible = (meta || []).filter(m => !!m.IsVisible);

    // --------------------------------------------------
    // 🧱 Build baseline from dashboard data
    // --------------------------------------------------
    baseline = {};
    visible.forEach(f => {
      baseline[f.ColumnName] = caseData[f.ColumnName] ?? null;
    });

    // Sort fields
    visible.sort((a, b) => {
      const ga = Number(a.GroupOrder ?? 999);
      const gb = Number(b.GroupOrder ?? 999);
      if (ga !== gb) return ga - gb;
      return Number(a.FieldOrder ?? 999) - Number(b.FieldOrder ?? 999);
    });

    let htmlGeneral = "";
    let htmlCP = "";
    let htmlRates = "";

    for (const field of visible) {
      const key = field.ColumnName;
      const value = caseData[key] ?? "";

      let fieldHtml;
      if ((field.FieldType || "").toLowerCase() === "choice") {
        const choices = await fetchChoices(key);
        fieldHtml = buildFieldHTML(field, value, choices);
      } else {
        fieldHtml = buildFieldHTML(field, value);
      }

      const tabKey = groupToTabKey(field.GroupName);

      if (tabKey === "charterparty") htmlCP += fieldHtml;
      else if (tabKey === "rates") htmlRates += fieldHtml;
      else htmlGeneral += fieldHtml;
    }

    panelGeneral.innerHTML =
      htmlGeneral || `<p class="muted">No fields.</p>`;
    panelCP.innerHTML =
      htmlCP || `<p class="muted">No fields.</p>`;
    panelRates.innerHTML =
      htmlRates || `<p class="muted">No fields.</p>`;
  }

  function coerceValue(inputEl) {
    const tag = inputEl.tagName;
    const type = (inputEl.getAttribute("type") || "").toLowerCase();

    if (tag === "SELECT") {
      const v = inputEl.value;
      if (v === "true") return true;
      if (v === "false") return false;
      return v === "" ? null : v;
    }

    if (type === "number") return inputEl.value === "" ? null : Number(inputEl.value);
    if (type === "date") return inputEl.value === "" ? null : inputEl.value;

    return inputEl.value === "" ? null : inputEl.value;
  }

  async function saveEditCase() {
    console.log("💾 SAVE HANDLER FIRING");

    const caseData = window.caseData;

    if (!caseData || !caseData.CaseID) {
      alert("❌ CaseID missing");
      return;
    }

    const modal = document.getElementById("editCaseModal");
    if (!modal) return;

    const inputs = modal.querySelectorAll("[data-key]");
    const payload = {};

    inputs.forEach(el => {
      if (el.disabled) return;

      const key = el.dataset.key;
      const value = coerceValue(el);
      const base = baseline[key] ?? null;

      const same =
        (base === null && value === null) ||
        String(base) === String(value);

      if (!same) payload[key] = value;
    });

    if (Object.keys(payload).length === 0) {
      window.SideModal?.close("editCaseModal");
      return;
    }

    const res = await fetch(`/update-case/${caseData.CaseID}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      alert("❌ Failed to save changes");
      return;
    }

    // 🔁 FULL reload so Flask becomes truth again
    window.SideModal?.close("editCaseModal");
    setTimeout(() => location.reload(), 300);
  }

  function wireTabs() {
    document.querySelectorAll(".drawer-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        const target = tab.dataset.tab;

        document.querySelectorAll(".drawer-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");

        document.querySelectorAll(".drawer-panel").forEach(p => p.classList.remove("active"));
        document.getElementById(`edit-${target}`)?.classList.add("active");
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    wireTabs();

    const editBtn = $("editCaseBtn");
    if (!editBtn) return;

    editBtn.addEventListener("click", () => {
      // modal opens via side-modal.js
      setTimeout(async () => {
        await renderTabbedForm();

        // Robust save-button binding: prefer modal-local button, try common selectors,
        // otherwise use delegated handler on the modal so dynamically injected buttons still work.
        const modal = document.getElementById("editCaseModal");
        const findSaveBtn = () =>
          modal?.querySelector(
            "#saveCaseBtn, button[data-action='saveCase'], button[data-action='save-case'], button.save, button.save-case"
          ) || document.getElementById("saveCaseBtn");

        const attachSaveHandler = (btn) => {
          if (!btn) return;
          btn.onclick = null;
          btn.addEventListener("click", async (e) => {
            e.preventDefault();
            try {
              await saveEditCase();
            } catch (err) {
              console.error("saveEditCase error:", err);
              alert("Save failed");
            }
          });
        };

        let saveBtn = findSaveBtn();
        if (saveBtn) {
          attachSaveHandler(saveBtn);
        } else if (modal) {
          // delegated click: will catch clicks on matching targets even if button is injected later
          const delegated = async (e) => {
            const btn = e.target.closest("#saveCaseBtn, [data-action='saveCase'], [data-action='save-case'], button.save, button.save-case");
            if (!btn) return;
            // prevent double invocation if concrete button is bound later
            e.preventDefault();
            try {
              await saveEditCase();
            } catch (err) {
              console.error("saveEditCase (delegated) error:", err);
              alert("Save failed");
            }
          };
          // remove any previous delegated listener (idempotent attach)
          modal.removeEventListener("click", modal._saveDelegatedHandler);
          modal.addEventListener("click", delegated);
          modal._saveDelegatedHandler = delegated;
        } else {
          console.warn("editCaseModal not found; cannot bind save handler");
        }

      }, 50); // small delay is intentional
    });

    // ------------------------------------------------------------------
    // Global delegated save handler — catches clicks even if button never bound
    // Keeps scope to the editCaseModal so other pages are unaffected.
    // ------------------------------------------------------------------
    document.addEventListener("click", async (e) => {
      const btn = e.target.closest("#saveCaseBtn, [data-action='saveCase'], [data-action='save-case'], button.save, button.save-case");
      if (!btn) return;
      const modal = document.getElementById("editCaseModal");
      if (!modal) return;
      if (!modal.contains(btn)) return; // only react to buttons inside the modal

      e.preventDefault();

      // avoid double invocation
      if (btn.dataset._saving === "1" || window._caseSaving) return;
      btn.dataset._saving = "1";
      window._caseSaving = true;

      try {
        await saveEditCase();
      } catch (err) {
        console.error("saveEditCase (global delegated) error:", err);
        alert("Save failed");
      } finally {
        btn.dataset._saving = "0";
        window._caseSaving = false;
      }
    });
  });

})();