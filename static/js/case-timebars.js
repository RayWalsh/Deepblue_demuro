// ==============================================
// ⏳ Case Timebars UI
// ==============================================
document.addEventListener("DOMContentLoaded", () => {
  const caseId = window.CASE_ID;
  if (!caseId) return;

  const els = {
    typeSelect: document.getElementById("tbNoticeTypeSelect"),
    addBtn: document.getElementById("tbAddNoticeBtn"),
    recalcBtn: document.getElementById("tbRecalcBtn"),
    noticesList: document.getElementById("tbNoticesList"),
    todosList: document.getElementById("tbTodosList"),
    callout: document.getElementById("tbCallout"),
    daysToTimebar: document.getElementById("tbDaysToTimebar"),
    timebarDate: document.getElementById("tbTimebarDate"),
    nextNoticeDue: document.getElementById("tbNextNoticeDue"),
  };

  const fmtDate = (d) => {
    if (!d) return "—";
    try {
      const dt = new Date(d);
      return dt.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return d;
    }
  };

  const daysBetween = (from, to) => {
    if (!from || !to) return null;
    const a = new Date(from);
    const b = new Date(to);
    const ms = b - a;
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  };

  async function api(url, options = {}) {
    const res = await fetch(url, options);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) throw new Error(typeof data === "string" ? data : (data.error || "Request failed"));
    return data;
  }

  async function loadNoticeTypes() {
    const types = await api(`/api/timebars/notice-types?org_id=1`);
    els.typeSelect.innerHTML = `<option value="">+ Add notice type…</option>` +
      types.map(t => `<option value="${t.NoticeTypeID}">${t.Name} (${t.TimebarDays}d)</option>`).join("");
  }

  async function loadCaseNotices() {
    const notices = await api(`/api/timebars/cases/${caseId}/notices`);
    renderNotices(notices);
    updateKpis(notices);
  }

  async function loadCaseTodos() {
    const todos = await api(`/api/timebars/cases/${caseId}/todos`);
    renderTodos(todos);
    updateCallout(todos);
  }

  function renderNotices(notices) {
    if (!notices.length) {
      els.noticesList.innerHTML = `<div class="muted">No notice types attached to this case yet.</div>`;
      return;
    }

    els.noticesList.innerHTML = notices.map(n => {
      return `
        <div class="tb-item">
          <div class="tb-item-main">
            <div class="tb-item-title">${n.NoticeTypeName}</div>
            <div class="tb-item-meta">
              <span><strong>Timebar:</strong> ${n.TimebarDaysSnapshot} days</span>
              <span><strong>Expiry:</strong> ${fmtDate(n.ExpiryDate)}</span>
            </div>
          </div>

          <div class="tb-item-actions">
            <label class="tb-toggle">
              <input type="checkbox" data-casenoticeid="${n.CaseNoticeID}" ${n.IsEnabled ? "checked" : ""}>
              <span>Enabled</span>
            </label>

            <button class="tb-btn danger" data-delete="${n.CaseNoticeID}">Remove</button>
          </div>
        </div>
      `;
    }).join("");

    // Toggle enable
    els.noticesList.querySelectorAll('input[type="checkbox"][data-casenoticeid]').forEach(cb => {
      cb.addEventListener("change", async () => {
        const id = cb.getAttribute("data-casenoticeid");
        await api(`/api/timebars/case-notices/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ IsEnabled: cb.checked })
        });
        await loadCaseTodos();
        await loadCaseNotices();
      });
    });

    // Remove
    els.noticesList.querySelectorAll('button[data-delete]').forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-delete");
        if (!confirm("Remove this notice type from the case?")) return;
        await api(`/api/timebars/case-notices/${id}`, { method: "DELETE" });
        await loadCaseTodos();
        await loadCaseNotices();
      });
    });
  }

  function renderTodos(todos) {
    if (!todos.length) {
      els.todosList.innerHTML = `<div class="muted">No upcoming tasks.</div>`;
      return;
    }

    els.todosList.innerHTML = todos.map(t => `
      <div class="tb-todo ${t.Type}">
        <div class="tb-todo-left">
          <div class="tb-todo-title">${t.Title}</div>
          <div class="tb-todo-meta">${t.DueDate ? fmtDate(t.DueDate) : "No due date"}</div>
        </div>
      </div>
    `).join("");
  }

  function updateKpis(notices) {
    // pick earliest expiry as "timebar date" for now
    const expDates = notices.map(n => n.ExpiryDate).filter(Boolean).sort();
    const expiry = expDates.length ? expDates[0] : null;

    els.timebarDate.textContent = fmtDate(expiry);

    const today = new Date().toISOString().slice(0, 10);
    const days = expiry ? daysBetween(today, expiry) : null;
    els.daysToTimebar.textContent = (days === null ? "—" : `${days}`);

    // Next notice due will come from todos; leave placeholder here
  }

  function updateCallout(todos) {
    const open = todos.filter(t => t.Status === "OPEN");
    const missing = open.find(t => t.Type === "MISSING_VOYAGE_END_DATE");
    if (missing) {
      els.callout.style.display = "block";
      els.callout.className = "notice-callout warning";
      els.callout.innerHTML = `<strong>Voyage End Date missing</strong><br>${missing.Title}`;
      els.nextNoticeDue.textContent = "—";
      return;
    }

    const next = open
      .filter(t => t.Type === "TIMEBAR_REMINDER" && t.DueDate)
      .sort((a, b) => (a.DueDate > b.DueDate ? 1 : -1))[0];

    if (!next) {
      els.callout.style.display = "none";
      els.nextNoticeDue.textContent = "—";
      return;
    }

    els.nextNoticeDue.textContent = fmtDate(next.DueDate);

    // Callout severity based on proximity
    const today = new Date().toISOString().slice(0, 10);
    const d = daysBetween(today, next.DueDate);

    els.callout.style.display = "block";
    els.callout.className = d <= 5 ? "notice-callout critical" : (d <= 15 ? "notice-callout warning" : "notice-callout neutral");
    els.callout.innerHTML = `<strong>Next notice due</strong><br>${next.Title}`;
  }

  async function addNotice() {
    const noticeTypeId = els.typeSelect.value;
    if (!noticeTypeId) return alert("Pick a notice type first.");
    const result = await api(`/api/timebars/cases/${caseId}/notices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ OrgID: 1, NoticeTypeID: parseInt(noticeTypeId, 10) })
    });
    await loadCaseNotices();
    await loadCaseTodos();
    return result;
  }

  async function recalc() {
    await api(`/api/timebars/cases/${caseId}/recalc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ OrgID: 1 })
    });
    await loadCaseNotices();
    await loadCaseTodos();
  }

  els.addBtn.addEventListener("click", () => addNotice().catch(e => alert(e.message)));
  els.recalcBtn.addEventListener("click", () => recalc().catch(e => alert(e.message)));

  // Boot
  (async function init() {
    try {
      await loadNoticeTypes();
      await loadCaseNotices();
      await loadCaseTodos();
    } catch (e) {
      console.error(e);
      els.callout.style.display = "block";
      els.callout.className = "notice-callout warning";
      els.callout.innerHTML = `<strong>Timebars error</strong><br>${e.message}`;
    }
  })();
});