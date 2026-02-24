// ==============================================
// ⏳ Case Timebars UI (Per-notice minis + global callout + mark todos done)
// Refactor: single todo completion route (PATCH /api/timebars/todos/:id)
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
  };

  // Local state
  let currentNotices = [];
  let currentTodos = [];

  // ----------------------------
  // Date helpers
  // ----------------------------
  const fmtDate = (d) => {
    if (!d) return "—";
    try {
      const dt = new Date(d);
      return dt.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return d;
    }
  };

  const isoToday = () => new Date().toISOString().slice(0, 10);

  const daysBetween = (from, to) => {
    if (!from || !to) return null;
    const a = new Date(from);
    const b = new Date(to);
    const ms = b - a;
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  };

  // Convert "... (expires 2026-04-29)" into "... (expires 29 Apr 2026)"
  function humanizeExpiresInTitle(title) {
  const s = String(title || "");
  return s
    .replace(/\(expires\s+(\d{4}-\d{2}-\d{2})\)/g, (m, iso) => `(expires ${fmtDate(iso)})`)
    .replace(/\(timebar expires\s+(\d{4}-\d{2}-\d{2})\)/gi, (m, iso) => `(Timebar expires ${fmtDate(iso)})`);
}

  // ----------------------------
  // API
  // ----------------------------
  async function api(url, options = {}) {
    const res = await fetch(url, options);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    if (!res.ok) {
      throw new Error(
        typeof data === "string" ? data : data.error || "Request failed"
      );
    }
    return data;
  }

  async function loadNoticeTypes() {
    if (!els.typeSelect) return;
    const types = await api(`/api/timebars/notice-types?org_id=1`);
    els.typeSelect.innerHTML =
      `<option value="">+ Add notice type…</option>` +
      types
        .map(
          (t) =>
            `<option value="${t.NoticeTypeID}">${t.Name} (${t.TimebarDays}d)</option>`
        )
        .join("");
  }

  // ----------------------------
  // Matching helpers
  // ----------------------------
  function severityForDays(days) {
    if (days === null) return "neutral";
    if (days < 0) return "expired";
    if (days <= 5) return "critical";
    if (days <= 15) return "warning";
    return "safe";
  }

  function matchTodoToNotice(todo, notices) {
    const todoName = (
      todo.NoticeTypeName ||
      todo.NoticeType ||
      todo.NoticeName ||
      ""
    ).trim();

    if (todoName) {
      const exact = notices.find(
        (n) =>
          String(n.NoticeTypeName || "").toLowerCase() ===
          todoName.toLowerCase()
      );
      return exact || null;
    }

    const title = String(todo.Title || "").toLowerCase();
    if (!title) return null;

    let best = null;
    let bestLen = 0;

    notices.forEach((n) => {
      const name = String(n.NoticeTypeName || "").toLowerCase();
      if (!name) return;
      if (title.includes(name) && name.length > bestLen) {
        best = n;
        bestLen = name.length;
      }
    });

    return best;
  }

  function getNextTaskGlobal(todos) {
    const open = todos.filter((t) => t.Status === "OPEN");
    return (
      open
        .filter((t) => t.Type === "TIMEBAR_REMINDER" && t.DueDate)
        .sort((a, b) => (a.DueDate > b.DueDate ? 1 : -1))[0] || null
    );
  }

  function getNextTaskForNotice(notice, todos, notices) {
    const open = todos.filter((t) => t.Status === "OPEN" && t.DueDate);
    return (
      open
        .filter((t) => {
          if (t.Type !== "TIMEBAR_REMINDER") return false;
          const n = matchTodoToNotice(t, notices);
          return n && n.CaseNoticeID === notice.CaseNoticeID;
        })
        .sort((a, b) => (a.DueDate > b.DueDate ? 1 : -1))[0] || null
    );
  }

  // ----------------------------
  // Rendering
  // ----------------------------
  function renderNotices(notices, todos) {
    if (!els.noticesList) return;

    if (!notices.length) {
      els.noticesList.innerHTML = `<div class="muted">No notice types attached to this case yet.</div>`;
      return;
    }

    const today = isoToday();

    els.noticesList.innerHTML = notices
      .map((n) => {
        const daysToExpiry = n.ExpiryDate
          ? daysBetween(today, n.ExpiryDate)
          : null;

        const sev = severityForDays(daysToExpiry);

        const chipText =
          daysToExpiry === null
            ? "No expiry"
            : daysToExpiry < 0
            ? `Expired ${Math.abs(daysToExpiry)}d ago`
            : `${daysToExpiry}d remaining`;

        const nextTask = getNextTaskForNotice(n, todos, notices);

        return `
          <div class="tb-item">
            <div class="tb-item-main">
              <div class="tb-item-title">${n.NoticeTypeName}</div>

              <div class="tb-item-meta">
                <span><strong>Timebar:</strong> ${n.TimebarDaysSnapshot} days</span>
                <span><strong>Expiry:</strong> ${fmtDate(n.ExpiryDate)}</span>
              </div>

              <div class="tb-mini">
                <span class="tb-chip ${sev}">${chipText}</span>
                <span class="tb-chip">${
                  nextTask
                    ? `Next task: ${fmtDate(nextTask.DueDate)}`
                    : "Next task: —"
                }</span>
              </div>
            </div>

            <div class="tb-item-actions">
              <label class="tb-toggle">
                <input type="checkbox" data-casenoticeid="${n.CaseNoticeID}" ${
          n.IsEnabled ? "checked" : ""
        }>
                <span>Enabled</span>
              </label>

              <button class="tb-btn danger" data-delete="${n.CaseNoticeID}">Remove</button>
            </div>
          </div>
        `;
      })
      .join("");

    wireNoticeHandlers();
  }

  function wireNoticeHandlers() {
    if (!els.noticesList) return;

    // Toggle enable
    els.noticesList
      .querySelectorAll('input[type="checkbox"][data-casenoticeid]')
      .forEach((cb) => {
        cb.addEventListener("change", async () => {
          const id = cb.getAttribute("data-casenoticeid");
          await api(`/api/timebars/case-notices/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ IsEnabled: cb.checked }),
          });
          await refresh();
        });
      });

    // Remove
    els.noticesList.querySelectorAll("button[data-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-delete");
        if (!confirm("Remove this notice type from the case?")) return;
        await api(`/api/timebars/case-notices/${id}`, { method: "DELETE" });
        await refresh();
      });
    });
  }

  function renderTodos(todos) {
    if (!els.todosList) return;

    const open = todos.filter((t) => t.Status === "OPEN");
    const done = todos.filter((t) => t.Status === "DONE");

    if (!open.length && !done.length) {
      els.todosList.innerHTML = `<div class="muted">No tasks.</div>`;
      return;
    }

    const openHtml = open.length
      ? open.map(t => `
          <div class="tb-todo ${t.Type}">
            <div class="tb-todo-left">
              <div class="tb-todo-title">${humanizeExpiresInTitle(t.Title)}</div>
              <div class="tb-todo-meta">${t.DueDate ? fmtDate(t.DueDate) : "No due date"}</div>
            </div>
            <button class="tb-btn" data-done="${t.TodoID}">Done</button>
          </div>
        `).join("")
      : `<div class="muted">No upcoming tasks.</div>`;

    const doneHtml = done.length
      ? `
        <div class="tb-subtitle" style="margin-top:12px;">Completed</div>
        ${done.map(t => {
          const by =
            t.CompletedByName ||
            (t.CompletedByUserID ? `User #${t.CompletedByUserID}` : "—");

          const when = t.CompletedAt ? fmtDate(t.CompletedAt) : null;

          const note = t.CompletionNote
            ? `<div class="tb-todo-note">${t.CompletionNote}</div>`
            : "";

          const metaParts = [];
          if (by) metaParts.push(`Completed by ${by}`);
          if (when) metaParts.push(when);

          return `
            <div class="tb-todo ${t.Type}" style="opacity:0.65;">
              <div class="tb-todo-left">
                <div class="tb-todo-title">
                  ${humanizeExpiresInTitle(t.Title)}
                </div>
                <div class="tb-todo-meta">
                  ${metaParts.join(" • ")}
                </div>
                ${note}
              </div>
            </div>
          `;
        }).join("")}
      `
      : "";

    els.todosList.innerHTML = openHtml + doneHtml;

    // only wire buttons for OPEN items
    wireTodoHandlers();
  }

  function wireTodoHandlers() {
    if (!els.todosList) return;

    els.todosList.querySelectorAll("button[data-done]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-done");
        if (!id) return;

        console.log("PATCH todo", id, { Status: "DONE" });
        // ✅ Single source of truth: PATCH the todo status
        await api(`/api/timebars/todos/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ Status: "DONE" })  // must be Status, must be DONE
        });

        await refresh();
      });
    });
  }

  function updateCallout(todos) {
    if (!els.callout) return;

    const open = todos.filter((t) => t.Status === "OPEN");

    const missing = open.find((t) => t.Type === "MISSING_VOYAGE_END_DATE");
    if (missing) {
      els.callout.style.display = "block";
      els.callout.className = "notice-callout warning";
      els.callout.innerHTML = `<strong>Voyage End Date missing</strong><br>${missing.Title}`;
      return;
    }

    const next = getNextTaskGlobal(todos);
    if (!next) {
      els.callout.style.display = "none";
      return;
    }

    const today = isoToday();
    const d = daysBetween(today, next.DueDate);

    els.callout.style.display = "block";
    els.callout.className =
      d <= 5
        ? "notice-callout critical"
        : d <= 15
        ? "notice-callout warning"
        : "notice-callout neutral";

    const sendOn = next.DueDate ? fmtDate(next.DueDate) : "—";

    els.callout.innerHTML = `
      <strong>Next notice due</strong><br>
      ${humanizeExpiresInTitle(next.Title)}<br>
      <span class="muted">Send on: ${sendOn}</span>
    `;
  }

  // ----------------------------
  // Data loading (single pipeline)
  // ----------------------------
  async function refresh() {
    const [notices, todos] = await Promise.all([
      api(`/api/timebars/cases/${caseId}/notices`),
      api(`/api/timebars/cases/${caseId}/todos?include_done=1&include_dismissed=1`),
    ]);

    currentNotices = Array.isArray(notices) ? notices : [];
    currentTodos = Array.isArray(todos) ? todos : [];

    renderNotices(currentNotices, currentTodos);
    renderTodos(currentTodos);
    updateCallout(currentTodos);
  }

  // ----------------------------
  // Actions
  // ----------------------------
  async function addNotice() {
    const noticeTypeId = els.typeSelect?.value;
    if (!noticeTypeId) return alert("Pick a notice type first.");

    await api(`/api/timebars/cases/${caseId}/notices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        OrgID: 1,
        NoticeTypeID: parseInt(noticeTypeId, 10),
      }),
    });

    await refresh();
  }

  async function recalc() {
    await api(`/api/timebars/cases/${caseId}/recalc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ OrgID: 1 }),
    });

    await refresh();
  }

  // ----------------------------
  // Boot
  // ----------------------------
  els.addBtn?.addEventListener("click", () =>
    addNotice().catch((e) => alert(e.message))
  );
  els.recalcBtn?.addEventListener("click", () =>
    recalc().catch((e) => alert(e.message))
  );

  (async function init() {
    try {
      await loadNoticeTypes();
      await refresh();
    } catch (e) {
      console.error(e);
      if (els.callout) {
        els.callout.style.display = "block";
        els.callout.className = "notice-callout warning";
        els.callout.innerHTML = `<strong>Timebars error</strong><br>${e.message}`;
      }
    }
  })();
});