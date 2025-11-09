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

  // Open modal prefilled
  modal.style.display = "block";
  document.querySelector("input[name='reference']").value = btn.dataset.ref || "";
  document.querySelector("input[name='ship']").value = btn.dataset.ship || "";
  document.querySelector("input[name='cpdate']").value = btn.dataset.cpdate || "";
  document.querySelector("select[name='color']").value = btn.dataset.color || "preset0";

  // Close kebab after clicking
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

// ============== Expand / Collapse Cards ==============
document.addEventListener("click", (e) => {
  const title = e.target.closest(".card-title");
  if (!title) return;

  e.preventDefault();
  const card = title.closest(".card");

  // Toggle expanded state
  card.classList.toggle("expanded");

  // Close any open kebab menu if present
  card.querySelectorAll(".kebab-menu").forEach((m) => (m.style.display = "none"));

  // Create expanded content dynamically (if not already)
  let expandArea = card.querySelector(".expanded-content");
  if (!expandArea) {
    expandArea = document.createElement("div");
    expandArea.className = "expanded-content";
    expandArea.innerHTML = `
      <div class="stats-row">
        <button class="icon-btn" title="View Emails">
          📧<span class="count-badge">12</span>
        </button>
        <button class="icon-btn" title="View Attachments">
          📎<span class="count-badge">7</span>
        </button>
      </div>
      <div class="tab-content">
        <p class="placeholder">Select an icon above to view emails or attachments for this tag.</p>
      </div>
    `;
    card.appendChild(expandArea);
  }
});

// ============== Kebab Menu (3-dot Dropdowns) ==============
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
  if (e.key === "Escape")
    document.querySelectorAll(".card.is-open").forEach((c) => c.classList.remove("is-open"));
});

// ============== Search (Filter Cards) ==============
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

// ============== SSE “Run Rule” Overlay ==============
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

// ============== Submenu Tap Support (for iPad / Touch) ==============
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