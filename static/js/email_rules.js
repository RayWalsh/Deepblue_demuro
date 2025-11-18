/* ============================================================
   Email Rules Manager Logic (Luberef / Outlook Tagging)
============================================================ */

/* ============================
   Modal Logic
============================ */
const modal = document.getElementById("categoryModal");
const openBtn = document.getElementById("openModal");
const closeBtn = document.getElementById("closeModal");

openBtn?.addEventListener("click", () => {
  modal.style.display = "block";
  document.getElementById("createCategoryForm")?.reset();
});

closeBtn?.addEventListener("click", () => (modal.style.display = "none"));

window.addEventListener("click", (e) => {
  if (e.target === modal) modal.style.display = "none";
});


/* ============================
   Create Category (AJAX)
============================ */
const form = document.getElementById("createCategoryForm");

form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = Object.fromEntries(new FormData(form).entries());
  if (!data.reference || !data.ship || !data.cpdate) {
    alert("⚠️ Please fill in Reference, Ship Name, and CP Date.");
    return;
  }

  const submitBtn = form.querySelector("button[type='submit']");
  submitBtn.disabled = true;
  submitBtn.textContent = "Creating...";

  try {
    const res = await fetch("/email/create", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(data),
    });

    if (res.ok) {
      alert("✅ Category created successfully!");
      window.location.reload();
    } else {
      alert("⚠️ Failed to create category.");
    }
  } catch (err) {
    console.error(err);
    alert("⚠️ Network or server error.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Create Category";
  }
});


/* ============================
   Edit Tag (from kebab)
============================ */
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".edit-tag-btn");
  if (!btn) return;

  modal.style.display = "block";
  document.querySelector("input[name='reference']").value = btn.dataset.ref || "";
  document.querySelector("input[name='ship']").value = btn.dataset.ship || "";
  document.querySelector("input[name='cpdate']").value = btn.dataset.cpdate || "";
  document.querySelector("select[name='color']").value = btn.dataset.color || "preset0";

  document.querySelectorAll(".card.is-open").forEach((c) => c.classList.remove("is-open"));
});


/* ============================
   Create Rule Button
============================ */
document.getElementById("createRuleBtn")?.addEventListener("click", () => {
  const ref = document.querySelector("input[name='reference']").value.trim();
  const ship = document.querySelector("input[name='ship']").value.trim();
  const cpdate = document.querySelector("input[name='cpdate']").value.trim();

  if (!ref || !ship || !cpdate) {
    alert("⚠️ Please fill in Reference, Ship, and CP Date.");
    return;
  }

  const name = `${ref} - ${ship} - ${cpdate}`;
  window.location.href = `/email/create_rule/${encodeURIComponent(name)}`;
});


window.addEventListener("pageshow", () => {
  if (modal) modal.style.display = "none";
});


/* ============================
   Save Changes
============================ */
document.getElementById("saveChangesBtn")?.addEventListener("click", async () => {
  const data = Object.fromEntries(new FormData(form).entries());
  const catId = form.dataset.catid;

  if (!catId) {
    alert("⚠️ This category hasn’t been created yet.");
    return;
  }

  const res = await fetch(`/email/update/${catId}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(data),
  });

  if (res.ok) {
    alert("✅ Category updated.");
    window.location.reload();
  } else {
    alert("⚠️ Failed to update.");
  }
});


/* ============================
   Helpers
============================ */
function getCategoryNameFromCard(card) {
  const titleEl = card.querySelector(".card-title");
  return titleEl ? titleEl.textContent.trim() : "";
}

function setLoading(tabContent, isLoading) {
  if (!tabContent) return;
  if (isLoading) tabContent.classList.add("loading");
  else tabContent.classList.remove("loading");
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
}


/* ============================================================
   Item kebab menu handling (capture phase)
============================================================ */
document.addEventListener("click", (e) => {
  const kebabBtn = e.target.closest(".item-kebab-btn");
  const item = e.target.closest(".list-item");

  if (!kebabBtn || !item) return;

  const alreadyOpen = item.classList.contains("menu-open");

  document.querySelectorAll(".list-item.menu-open")
          .forEach((li) => li.classList.remove("menu-open"));

  if (!alreadyOpen) item.classList.add("menu-open");

  e.stopPropagation();
}, true);


/* ============================================================
   EXPAND / COLLAPSE — title only (with toggle!)
============================================================ */
document.addEventListener("click", (e) => {
  const title = e.target.closest(".card-title");
  if (!title) return;

  e.preventDefault();

  const card = title.closest(".card");
  const currentlyExpanded = card.classList.contains("expanded");

  // collapse if already open
  if (currentlyExpanded) {
    card.classList.remove("expanded");
    return;
  }

  // collapse all others, open this one
  document.querySelectorAll(".card.expanded").forEach((c) => c.classList.remove("expanded"));
  card.classList.add("expanded");

  // ensure expanded content area exists
  let expandArea = card.querySelector(".expanded-content");
  if (!expandArea) {
    expandArea = document.createElement("div");
    expandArea.className = "expanded-content";

    expandArea.innerHTML = `
      <div class="stats-row">
        <button class="icon-btn tab-btn active" data-tab="emails">
          📧 <span class="count-badge" data-count-type="emails">–</span>
        </button>
        <button class="icon-btn tab-btn" data-tab="attachments">
          📎 <span class="count-badge" data-count-type="attachments">–</span>
        </button>
      </div>
      <div class="tab-content">
        <p class="placeholder">Loading emails…</p>
      </div>
    `;
    card.appendChild(expandArea);
  }

  const categoryName = getCategoryNameFromCard(card);
  loadCategorySummary(card, categoryName);
  loadTabData(card, "emails", 1, false);
});


/* ============================================================
   LOAD SUMMARY
============================================================ */
async function loadCategorySummary(card, categoryName) {
  try {
    const res = await fetch(`/email/api/summary?category=${encodeURIComponent(categoryName)}`);
    if (!res.ok) return;

    const data = await res.json();
    card.querySelector(".count-badge[data-count-type='emails']").textContent =
      data.email_count ?? "0";
    card.querySelector(".count-badge[data-count-type='attachments']").textContent =
      data.attachment_count ?? "0";
  } catch (err) {
    console.error("Summary error:", err);
  }
}


/* ============================================================
   LOAD TAB DATA
============================================================ */
async function loadTabData(card, type, page = 1, append = false) {
  const tabContent = card.querySelector(".tab-content");
  const categoryName = getCategoryNameFromCard(card);

  if (!tabContent || !categoryName) return;

  setLoading(tabContent, true);
  if (!append) tabContent.innerHTML = "";

  try {
    const res = await fetch(`/email/api/${type}?category=${encodeURIComponent(categoryName)}&page=${page}`);
    if (!res.ok) {
      if (!append)
        tabContent.innerHTML = `<p class="placeholder">No ${type} found.</p>`;
      return;
    }

    const data = await res.json();
    const items = data.items || [];
    const nextPage = data.next_page;

    let list = tabContent.querySelector(".list-view");
    if (!list || !append) {
      list = document.createElement("ul");
      list.className = "list-view";
      tabContent.appendChild(list);
    }

    if (!items.length && !append) {
      list.innerHTML = `<li class="placeholder">No ${type} found.</li>`;
    } else {
      items.forEach((item) => {
        const li = document.createElement("li");
        li.className = `list-item ${type === "emails" ? "email-item" : "attachment-item"}`;

        if (type === "emails") {
          li.innerHTML = `
            <div class="item-main">
              <div class="item-title-row">
                <span class="item-icon">📨</span>
                <span class="item-subject">${escapeHtml(item.subject || "(no subject)")}</span>
              </div>
              <div class="item-meta">${escapeHtml(item.from || "")} · ${escapeHtml(item.received || "")}</div>
            </div>
            <div class="item-kebab-wrap">
              <button class="item-kebab-btn">⋯</button>
              <div class="item-kebab-menu">
                <button class="item-menu-row open-outlook-btn" data-link="${escapeHtml(item.web_link || "#")}">
                  Open in Outlook
                </button>
              </div>
            </div>`;
        } else {
          li.innerHTML = `
            <div class="item-main">
              <div class="item-title-row">
                <span class="item-icon">📎</span>
                <span class="item-subject">${escapeHtml(item.file_name || "Attachment")}</span>
              </div>
              <div class="item-meta">${escapeHtml(item.size_human || "")} · ${escapeHtml(item.from || "")}</div>
            </div>
            <div class="item-kebab-wrap">
              <button class="item-kebab-btn">⋯</button>
              <div class="item-kebab-menu">
                <button class="item-menu-row download-attachment-btn" data-download="${escapeHtml(item.download_url || "")}">
                  Download
                </button>
                <button class="item-menu-row open-outlook-btn" data-link="${escapeHtml(item.web_link || "#")}">
                  Open in Outlook
                </button>
              </div>
            </div>`;
        }

        list.appendChild(li);
      });
    }

    if (nextPage) {
      const more = document.createElement("div");
      more.className = "load-more-row";
      more.innerHTML = `<button class="load-more-btn" data-next-page="${nextPage}" data-tab-type="${type}">Load more ${type}</button>`;
      tabContent.appendChild(more);
    }
  } catch (err) {
    console.error("Tab load error:", err);
    tabContent.innerHTML = `<p class="placeholder">Error loading ${type}.</p>`;
  } finally {
    setLoading(tabContent, false);
  }
}


/* ============================================================
   TAB SWITCHING
============================================================ */
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab-btn");
  if (!btn) return;

  const card = btn.closest(".card");

  card.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");

  const type = btn.dataset.tab;
  const tabContent = card.querySelector(".tab-content");

  tabContent.innerHTML = `<p class="placeholder">Loading ${type}...</p>`;
  loadTabData(card, type, 1, false);
});


/* ============================================================
   LOAD MORE
============================================================ */
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".load-more-btn");
  if (!btn) return;

  const card = btn.closest(".card");
  const type = btn.dataset.tabType;
  const nextPage = parseInt(btn.dataset.nextPage, 10);

  loadTabData(card, type, nextPage, true);
});


/* ============================================================
   Per-item actions
============================================================ */
document.addEventListener("click", (e) => {
  const openBtn = e.target.closest(".open-outlook-btn");
  if (openBtn) {
    window.open(openBtn.dataset.link, "_blank");
    return;
  }

  const dlBtn = e.target.closest(".download-attachment-btn");
  if (dlBtn) {
    window.open(dlBtn.dataset.download, "_blank");
    return;
  }
});


/* ============================================================
   Header kebab
============================================================ */
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".kebab-btn");
  const card = e.target.closest(".card");

  if (btn && card) {
    const alreadyOpen = card.classList.contains("is-open");
    document.querySelectorAll(".card.is-open").forEach((c) => c.classList.remove("is-open"));
    if (!alreadyOpen) card.classList.add("is-open");
    e.stopPropagation();
    return;
  }

  if (!e.target.closest(".kebab-wrap")) {
    document.querySelectorAll(".card.is-open").forEach((c) => c.classList.remove("is-open"));
  }
});


/* ============================================================
   ESC closes menus
============================================================ */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".card.is-open").forEach((c) => c.classList.remove("is-open"));
    document.querySelectorAll(".list-item.menu-open").forEach((li) => li.classList.remove("menu-open"));
  }
});


/* ============================================================
   Search
============================================================ */
const searchInput = document.getElementById("searchInput");

if (searchInput) {
  const cards = Array.from(document.querySelectorAll(".card"));

  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    cards.forEach((card) => {
      const text = card.getAttribute("data-search") || card.textContent.toLowerCase();
      card.style.display = text.includes(q) ? "" : "none";
    });
  });
}


/* ============================================================
   SSE RUN RULE (progress overlay)
============================================================ */
document.addEventListener("submit", (e) => {
  const f = e.target.closest("form[action^='/email/run_rule/']");
  if (!f) return;

  e.preventDefault();

  const overlay = document.getElementById("progressOverlay");
  const logEl = document.getElementById("progressLog");
  const barEl = document.getElementById("progressBar");
  const closeBtn = document.getElementById("closeProgressBtn");

  overlay.style.display = "flex";
  logEl.innerHTML = "";
  barEl.style.width = "0%";

  const url = new URL(f.action, window.location.origin);
  const rawName = decodeURIComponent(url.pathname.split("/email/run_rule/")[1]);
  const days = f.querySelector("input[name='days']")?.value || 90;

  const es = new EventSource(`/email/run_rule/${encodeURIComponent(rawName)}?days=${days}`);

  let steps = 0;

  const add = (text, cls = "info") => {
    const div = document.createElement("div");
    div.className = `log-line ${cls}`;
    div.textContent = text;
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight;
  };

  es.onmessage = (ev) => {
    if (ev.data === "DONE") {
      barEl.style.width = "100%";
      add("✅ Rule run complete.", "done");
      closeBtn.style.display = "inline-block";
      es.close();
      return;
    }

    if (ev.data.includes("Tagged")) {
      steps++;
      barEl.style.width = Math.min(100, steps * 5) + "%";
      add(ev.data, "tagged");
    } else if (ev.data.includes("Skipping")) {
      add(ev.data, "skipped");
    } else if (ev.data.includes("⚠️")) {
      add(ev.data, "warning");
    } else {
      add(ev.data, "info");
    }
  };

  es.onerror = () => {
    add("⚠️ Connection lost or an error occurred.", "warning");
    closeBtn.style.display = "inline-block";
    es.close();
  };

  closeBtn.onclick = () => (overlay.style.display = "none");
});


/* ============================================================
   Submenu (Run Rule →)
============================================================ */
document.addEventListener("click", (e) => {
  const trigger = e.target.closest(".submenu-trigger");
  const submenu = e.target.closest(".submenu");

  document.querySelectorAll(".submenu.open").forEach((s) => {
    if (s !== submenu) s.classList.remove("open");
  });

  if (trigger && submenu) {
    submenu.classList.toggle("open");
    e.stopPropagation();
    return;
  }

  if (!e.target.closest(".submenu")) {
    document.querySelectorAll(".submenu.open").forEach((s) => s.classList.remove("open"));
  }
});


/* ============================================================
   HARD FIX: Prevent card expansion on kebab taps
============================================================ */
document.addEventListener("click", (e) => {
  if (e.target.closest(".item-kebab-btn") || e.target.closest(".item-kebab-menu")) {
    e.stopImmediatePropagation();
    e.stopPropagation();
  }
}, true);