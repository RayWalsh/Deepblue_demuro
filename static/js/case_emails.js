(() => {
  console.log("📧 case_emails.js LOADED");

  // ----------------------------------
  // Core DOM elements
  // ----------------------------------
  const openBtn   = document.getElementById("openEmailsBtn");
  const panel     = document.getElementById("emailsPanel");
  const overlay   = document.getElementById("emailsOverlay");
  const closeBtn  = document.getElementById("closeEmailsBtn");

  // If email panel not present on page, exit quietly
  if (!openBtn || !panel || !overlay || !closeBtn) {
    return;
  }

  // ----------------------------------
  // Panel open / close
  // ----------------------------------
  function openPanel() {
    panel.classList.remove("hidden");
    overlay.classList.remove("hidden");
    panel.setAttribute("aria-hidden", "false");
    fetchEmails(); // load emails when opened
  }

  function closePanel() {
    panel.classList.add("hidden");
    overlay.classList.add("hidden");
    panel.setAttribute("aria-hidden", "true");
  }

  openBtn.addEventListener("click", (e) => {
    e.preventDefault();
    openPanel();
  });

  closeBtn.addEventListener("click", closePanel);
  overlay.addEventListener("click", closePanel);

  // ----------------------------------
  // Manual attach email (supports multiple buttons)
  // ----------------------------------
  document.querySelectorAll("#attachEmailBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const link = prompt("Paste Outlook email link:");
      if (!link) return;

      try {
        const res = await fetch(`/api/case/${window.CASE_ID}/emails`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            OutlookLink: link,
            Direction: "In",
            CounterpartyRole: "Owner"
          })
        });

        const data = await res.json();

        if (data.success) {
          fetchEmails();
        } else {
          alert("Failed to attach email");
        }
      } catch (err) {
        console.error("Attach email error:", err);
        alert("Error attaching email");
      }
    });
  });

  // ----------------------------------
  // Fetch emails
  // ----------------------------------
  function fetchEmails() {
    fetch(`/api/case/${window.CASE_ID}/emails`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          renderEmails(data.items || []);
        }
      })
      .catch(err => {
        console.error("Fetch emails failed:", err);
      });
  }

  // ----------------------------------
  // Render emails
  // ----------------------------------
  function renderEmails(items) {
    const list = document.getElementById("emailsList");
    if (!list) return;

    list.innerHTML = "";

    if (!items.length) {
      list.innerHTML = `
        <div class="emails-empty">
          <i class="fas fa-envelope-open-text"></i>
          <h3>No emails linked to this case</h3>
          <p>
            Emails related to this case will appear here automatically,<br>
            or can be attached manually.
          </p>
        </div>
      `;
      return;
    }

    items.forEach(email => {
      const row = document.createElement("div");
      row.className = "email-row";

      row.innerHTML = `
        <div class="email-meta">
          <strong>${email.Subject || "(No subject)"}</strong>
          <div class="email-sub">
            ${email.FromAddress || "—"}
            ${email.Tag ? "· " + email.Tag : ""}
          </div>
        </div>

        <a href="${email.OutlookLink}"
           target="_blank"
           class="email-link">
          Open
        </a>
      `;

      list.appendChild(row);
    });
  }

})();