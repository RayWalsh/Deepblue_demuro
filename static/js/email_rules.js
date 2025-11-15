/* ============================================================
   Email Rules Manager Logic (Luberef / Outlook Tagging)
   ============================================================ */

// ============== Modal Logic ==============
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

// ============== Create Category (AJAX) ==============
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
      alert("✅ Category created successfully! You can now click 'Create Rule'.");
      window.location.reload();
    } else {
      alert("⚠️ Failed to create category. Please check input or server logs.");
    }
  } catch (err) {
    console.error(err);
    alert("⚠️ Network or server error occurred.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Create Category";
  }
});

// ============== ✏️ Edit Tag from Kebab Menu ==============
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

// ============== Create Rule Button ==============
document.getElementById("createRuleBtn")?.addEventListener("click", () => {
  const ref = document.querySelector("input[name='reference']").value.trim();
  const ship = document.querySelector("input[name='ship']").value.trim();
  const cpdate = document.querySelector("input[name='cpdate']").value.trim();

  if (!ref || !ship || !cpdate) {
    alert("⚠️ Please fill in Reference, Ship, and CP Date before creating a rule.");
    return;
  }

  const name = `${ref} - ${ship} - ${cpdate}`;
  window.location.href = `/email/create_rule/${encodeURIComponent(name)}`;
});

window.addEventListener("pageshow", () => {
  if (modal) modal.style.display = "none";
});

// ============== Save Changes ==============
document.getElementById("saveChangesBtn")?.addEventListener("click", async () => {
  const data = Object.fromEntries(new FormData(form).entries());
  const catId = form.dataset.catid;
  if (!catId) {
    alert("⚠️ This category hasn’t been created yet. Use Create Category first.");
    return;
  }

  const res = await fetch(`/email/update/${catId}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(data),
  });

  if (res.ok) {
    alert("✅ Category updated. Please re-run the rule to tag older emails.");
    window.location.reload();
  } else {
    alert("⚠️ Failed to update category.");
  }
});


/* ============================================================
   Helpers
   ============================================================ */

function getCategoryNameFromCard(card) {
  const titleEl = card.querySelector(".card-title");
  return titleEl ? titleEl.textContent.trim() : "";
}

function setLoading(tabContent, isLoading) {
  if (!tabContent) return;
  if (isLoading) {
    tabContent.classList.add("loading");
  } else {
    tabContent.classList.remove("loading");
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}


/* ============================================================
   EXPAND / COLLAPSE CARDS + INITIAL LOAD
   ============================================================ */

document.addEventListener("click", (e) => {
  const title = e.target.closest(".card-title");
  if (!title) return;

  e.preventDefault();
  const card = title.closest(".card");
  const categoryName = getCategoryNameFromCard(card);
  if (!categoryName) return;

  // Toggle expanded state
  const isNowExpanded = !card.classList.contains("expanded");
  card.classList.toggle("expanded");

  // Close any open kebab menu
  card.querySelectorAll(".kebab-menu").forEach((m) => (m.style.display = "none"));

  // If collapsed, nothing more to do
  if (!isNowExpanded) return;

  // Create expanded content if missing
  let expandArea = card.querySelector(".expanded-content");
  if (!expandArea) {
    expandArea = document.createElement("div");
    expandArea.className = "expanded-content";

    expandArea.innerHTML = `
      <div class="stats-row">
        <button class="icon-btn tab-btn active" data-tab="emails" title="View Emails">
          📧<span class="count-badge" data-count-type="emails">–</span>
        </button>
        <button class="icon-btn tab-btn" data-tab="attachments" title="View Attachments">
          📎<span class="count-badge" data-count-type="attachments">–</span>
        </button>
      </div>

      <div class="tab-content">
        <p class="placeholder">Loading emails for this tag...</p>
      </div>
    `;

    card.appendChild(expandArea);
  }

  const tabContent = card.querySelector(".tab-content");

  // Load counts + first page of emails
  loadCategorySummary(card, categoryName);
  loadTabData(card, "emails", 1, false);
});


/* ============================================================
   LOAD SUMMARY (COUNTS)
   ============================================================ */

async function loadCategorySummary(card, categoryName) {
  try {
    const res = await fetch(
      `/email/api/summary?category=${encodeURIComponent(categoryName)}`
    );
    if (!res.ok) return;

    const data = await res.json(); // { email_count, attachment_count }
    const emailBadge = card.querySelector(".count-badge[data-count-type='emails']");
    const attBadge = card.querySelector(".count-badge[data-count-type='attachments']");

    if (emailBadge) emailBadge.textContent = data.email_count ?? "0";
    if (attBadge) attBadge.textContent = data.attachment_count ?? "0";
  } catch (err) {
    console.error("Error loading summary:", err);
  }
}


/* ============================================================
   LOAD TAB DATA (EMAILS / ATTACHMENTS) + PAGINATION
   ============================================================ */

async function loadTabData(card, type, page = 1, append = false) {
  const tabContent = card.querySelector(".tab-content");
  const categoryName = getCategoryNameFromCard(card);
  if (!tabContent || !categoryName) return;

  setLoading(tabContent, true);

  // Remove old "Load more" if reloading from page 1
  if (!append) {
    tabContent.innerHTML = "";
  } else {
    const oldMore = tabContent.querySelector(".load-more-row");
    if (oldMore) oldMore.remove();
  }

  try {
    const res = await fetch(
      `/email/api/${type}?category=${encodeURIComponent(categoryName)}&page=${page}`
    );
    if (!res.ok) {
      if (!append) {
        tabContent.innerHTML = `<p class="placeholder">No ${type} found for this tag.</p>`;
      }
      return;
    }

    const data = await res.json();
    const items = data.items || [];
    const nextPage = data.next_page; // null or number

    let list = tabContent.querySelector(".list-view");
    if (!list || !append) {
      list = document.createElement("ul");
      list.className = "list-view";
      if (!append) tabContent.innerHTML = "";
      tabContent.appendChild(list);
    }

    if (!items.length && !append) {
      list.innerHTML = `<li class="placeholder">No ${type} found for this tag.</li>`;
    } else {
      items.forEach((item) => {
        const li = document.createElement("li");
        li.className =
          type === "emails" ? "list-item email-item" : "list-item attachment-item";

        if (type === "emails") {
          const subject = escapeHtml(item.subject || "(no subject)");
          const from = escapeHtml(item.from || "");
          const received = escapeHtml(item.received || "");
          const webLink = item.web_link || item.outlook_web_link || "#";

          li.innerHTML = `
            <div class="item-main">
              <div class="item-title-row">
                <span class="item-icon">📨</span>
                <span class="item-subject">${subject}</span>
              </div>
              <div class="item-meta">
                ${from ? from + " · " : ""}${received}
              </div>
            </div>
            <div class="item-kebab-wrap">
              <button class="item-kebab-btn" aria-haspopup="true" aria-expanded="false">⋯</button>
              <div class="item-kebab-menu">
                <button class="item-menu-row open-outlook-btn"
                        data-link="${escapeHtml(webLink)}">
                  Open in Outlook
                </button>
              </div>
            </div>
          `;
        } else {
          const fileName = escapeHtml(item.file_name || "Attachment");
          const size = escapeHtml(item.size_human || "");
          const fromEmail = escapeHtml(item.from || "");
          const webLink = item.web_link || item.outlook_web_link || "#";
          const downloadUrl = item.download_url || webLink;

          li.innerHTML = `
            <div class="item-main">
              <div class="item-title-row">
                <span class="item-icon">📎</span>
                <span class="item-subject">${fileName}</span>
              </div>
              <div class="item-meta">
                ${size ? size + " · " : ""}${fromEmail}
              </div>
            </div>
            <div class="item-kebab-wrap">
              <button class="item-kebab-btn" aria-haspopup="true" aria-expanded="false">⋯</button>
              <div class="item-kebab-menu">
                <button class="item-menu-row download-attachment-btn"
                        data-download="${escapeHtml(downloadUrl)}">
                  Download
                </button>
                <button class="item-menu-row open-outlook-btn"
                        data-link="${escapeHtml(webLink)}">
                  Open in Outlook
                </button>
              </div>
            </div>
          `;
        }

        list.appendChild(li);
      });
    }

    // Add "Load more" if there is another page
    if (nextPage) {
      const moreRow = document.createElement("div");
      moreRow.className = "load-more-row";
      moreRow.innerHTML = `
        <button class="load-more-btn"
                data-next-page="${nextPage}"
                data-tab-type="${type}">
          Load more ${type === "emails" ? "emails" : "attachments"}
        </button>
      `;
      tabContent.appendChild(moreRow);
    }
  } catch (err) {
    console.error(`Error loading ${type}:`, err);
    if (!append) {
      tabContent.innerHTML = `<p class="placeholder">Error loading ${type}. Please try again.</p>`;
    }
  } finally {
    setLoading(tabContent, false);
  }
}


/* ============================================================
   TAB SWITCHING (Emails / Attachments)
   ============================================================ */

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab-btn");
  if (!btn) return;

  const card = btn.closest(".card");
  const tabContent = card.querySelector(".tab-content");
  const allBtns = card.querySelectorAll(".tab-btn");
  const tab = btn.dataset.tab;

  allBtns.forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");

  // Reset content + load from page 1
  tabContent.innerHTML = `<p class="placeholder">Loading ${tab}...</p>`;
  loadTabData(card, tab, 1, false);
});


/* ============================================================
   "Load more" Pagination
   ============================================================ */
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".load-more-btn");
  if (!btn) return;

  const card = btn.closest(".card");
  const type = btn.dataset.tabType;
  const nextPage = parseInt(btn.dataset.nextPage || "2", 10);

  loadTabData(card, type, nextPage, true);
});


/* ============================================================
   Item kebab menus + actions (Open in Outlook / Download)
   ============================================================ */

document.addEventListener("click", (e) => {
  // Toggle per-item kebab
  const kebabBtn = e.target.closest(".item-kebab-btn");
  const item = e.target.closest(".list-item");

  if (kebabBtn && item) {
    const wasOpen = item.classList.contains("menu-open");
    document
      .querySelectorAll(".list-item.menu-open")
      .forEach((li) => li.classList.remove("menu-open"));
    if (!wasOpen) item.classList.add("menu-open");
    e.stopPropagation();
    return;
  }

  // Open in Outlook
  const openBtn = e.target.closest(".open-outlook-btn");
  if (openBtn) {
    const link = openBtn.dataset.link;
    if (link && link !== "#") {
      window.open(link, "_blank");
    } else {
      alert("No Outlook link available for this item.");
    }
    return;
  }

  // Download attachment
  const dlBtn = e.target.closest(".download-attachment-btn");
  if (dlBtn) {
    const url = dlBtn.dataset.download;
    if (url && url !== "#") {
      window.open(url, "_blank");
    } else {
      alert("No download URL available for this attachment.");
    }
    return;
  }

  // Clicking anywhere else closes open item menus
  if (!e.target.closest(".item-kebab-wrap")) {
    document
      .querySelectorAll(".list-item.menu-open")
      .forEach((li) => li.classList.remove("menu-open"));
  }
});



/* ============================================================
   Kebab Menu (Top-level card 3-dot)
   ============================================================ */
document.addEventListener("click", (e) => {
  const kebabBtn = e.target.closest(".kebab-btn");
  const card = e.target.closest(".card");

  if (kebabBtn && card) {
    const wasOpen = card.classList.contains("is-open");
    document.querySelectorAll(".card.is-open").forEach((c) => c.classList.remove("is-open"));
    if (!wasOpen) card.classList.add("is-open");
    e.stopPropagation();
    return;
  }

  if (!e.target.closest(".kebab-wrap")) {
    document.querySelectorAll(".card.is-open").forEach((c) => c.classList.remove("is-open"));
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".card.is-open").forEach((c) => c.classList.remove("is-open"));
    document
      .querySelectorAll(".list-item.menu-open")
      .forEach((li) => li.classList.remove("menu-open"));
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
      const hay = card.getAttribute("data-search") || card.textContent.toLowerCase();
      card.style.display = hay.includes(q) ? "" : "none";
    });
  });
}


/* ============================================================
   SSE Progress Overlay
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
  barEl.style.backgroundColor = "var(--accent-color)";
  closeBtn.style.display = "none";

  const url = new URL(f.action, window.location.origin);
  const rawName = decodeURIComponent(url.pathname.split("/email/run_rule/")[1]);
  const days = f.querySelector("input[name='days']")?.value || 90;

  const es = new EventSource(`/email/run_rule/${encodeURIComponent(rawName)}?days=${days}`);
  let steps = 0;

  const add = (t, cls = "info") => {
    const d = document.createElement("div");
    d.className = `log-line ${cls}`;
    d.textContent = t;
    logEl.appendChild(d);
    logEl.scrollTop = logEl.scrollHeight;
  };

  es.onmessage = (ev) => {
    const msg = ev.data;
    if (msg === "DONE") {
      barEl.style.width = "100%";
      barEl.style.backgroundColor = "#10b981";
      add("✅ Rule run complete.", "done");
      closeBtn.style.display = "inline-block";
      es.close();
      return;
    }

    if (msg.includes("Skipping")) add(msg, "skipped");
    else if (msg.includes("⚠️")) add(msg, "warning");
    else if (msg.includes("Tagged")) {
      add(msg, "tagged");
      steps++;
      barEl.style.width = Math.min(100, steps * 5) + "%";
    } else if (msg.includes("✅")) add(msg, "success");
    else add(msg, "info");
  };

  es.onerror = () => {
    add("⚠️ Connection lost or an error occurred.", "warning");
    closeBtn.style.display = "inline-block";
    es.close();
  };

  closeBtn.onclick = () => {
    overlay.style.display = "none";
  };
});


/* ============================================================
   Submenu Tap Support (Run Rule ▸)
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