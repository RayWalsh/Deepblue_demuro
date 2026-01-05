// =====================================================
// SETTINGS MODAL CONTROLLER
// =====================================================

document.addEventListener("DOMContentLoaded", () => {
  const openBtn = document.getElementById("open-settings");
  const overlay = document.getElementById("settings-overlay");
  const closeBtn = document.getElementById("close-settings");

  if (!openBtn || !overlay) return;

  // Open settings modal
  openBtn.addEventListener("click", (e) => {
    e.preventDefault();
    overlay.classList.remove("hidden");

    // Default section
    setActiveMainNav("account");
    loadMainSection("account");
  });

  // Close settings modal
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      overlay.classList.add("hidden");
    });
  }

  // Main nav click handling
  document.querySelectorAll(".settings-nav .nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      setActiveMainNav(btn.dataset.section);
      loadMainSection(btn.dataset.section);
    });
  });
});

// =====================================================
// MAIN SECTION LOADER
// =====================================================

function loadMainSection(section) {
  const subnav = document.querySelector(".settings-subnav");
  const content = document.getElementById("settings-content-inner");

  subnav.innerHTML = "";
  content.innerHTML = "";

  // -------------------------------
  // ACCOUNT
  // -------------------------------
  if (section === "account") {
    subnav.innerHTML = `
      <button data-sub="profile">Profile</button>
      <button data-sub="password">Password</button>
    `;

    attachSubnavHandlers(section);
    content.innerHTML = `<h3>Select a setting</h3>`;
  }

  // -------------------------------
  // GENERAL
  // -------------------------------
  if (section === "general") {
    subnav.innerHTML = `
      <button data-sub="language">Language & Time</button>
      <button data-sub="appearance">Appearance</button>
    `;

    attachSubnavHandlers(section);
    content.innerHTML = `<h3>Select a setting</h3>`;
  }
}

// =====================================================
// SUBNAV HANDLERS
// =====================================================

function attachSubnavHandlers(section) {
  const subnav = document.querySelector(".settings-subnav");

  subnav.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      subnav.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const sub = btn.dataset.sub;

      // Account → Password
      if (section === "account" && sub === "password") {
        renderChangePassword();
      }

      // Placeholder for future sections
      if (sub !== "password") {
        document.getElementById("settings-content-inner").innerHTML =
          `<h3>${btn.textContent}</h3><p>Settings coming soon.</p>`;
      }
    });
  });
}

// =====================================================
// CHANGE PASSWORD UI
// =====================================================

function renderChangePassword() {
  const content = document.getElementById("settings-content-inner");

  content.innerHTML = `
    <div class="settings-section">
      <h3>Change Password</h3>

      <div class="form-group">
        <label>Current password</label>
        <input type="password" id="currentPassword">
      </div>

      <div class="form-group">
        <label>New password</label>
        <input type="password" id="newPassword">
      </div>

      <div class="form-group">
        <label>Confirm new password</label>
        <input type="password" id="confirmPassword">
      </div>

      <button class="btn-primary" id="updatePasswordBtn">
        Update password
      </button>

      <p id="passwordMessage" class="form-message"></p>
    </div>
  `;

  attachChangePasswordHandler();
}

// =====================================================
// CHANGE PASSWORD HANDLER
// =====================================================

function attachChangePasswordHandler() {
  const btn = document.getElementById("updatePasswordBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const msg = document.getElementById("passwordMessage");

    const payload = {
      current_password: document.getElementById("currentPassword").value,
      new_password: document.getElementById("newPassword").value,
      confirm_password: document.getElementById("confirmPassword").value
    };

    msg.textContent = "Updating password...";
    msg.className = "form-message";

    try {
      const res = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (data.success) {
        msg.textContent = "Password updated successfully.";
        msg.className = "form-message success";

        // Clear sensitive fields
        document.getElementById("currentPassword").value = "";
        document.getElementById("newPassword").value = "";
        document.getElementById("confirmPassword").value = "";
      } else {
        msg.textContent = data.error || "Failed to update password.";
        msg.className = "form-message error";
      }
    } catch (err) {
      console.error("Password update error:", err);
      msg.textContent = "Server error. Please try again.";
      msg.className = "form-message error";
    }
  });
}

// =====================================================
// HELPERS
// =====================================================

function setActiveMainNav(section) {
  document.querySelectorAll(".settings-nav .nav-item")
    .forEach(b => b.classList.remove("active"));

  const active = document.querySelector(
    `.settings-nav .nav-item[data-section="${section}"]`
  );

  if (active) active.classList.add("active");
}