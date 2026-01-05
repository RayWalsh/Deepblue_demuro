// =====================================================
// SETTINGS MODAL CONTROLLER
// =====================================================

document.addEventListener("DOMContentLoaded", () => {
  const openBtn = document.getElementById("open-settings");
  const overlay = document.getElementById("settings-overlay");

  if (!openBtn || !overlay) return;

  // Open modal
  openBtn.addEventListener("click", (e) => {
    e.preventDefault();
    overlay.classList.remove("hidden");
    setActiveMainNav("account");
    loadMainSection("account");
  });

  // Close modal (supports id + data attribute)
  document.querySelectorAll("#close-settings, [data-close-settings]").forEach(btn => {
    btn.addEventListener("click", () => {
      overlay.classList.add("hidden");
    });
  });

  // Main nav handling
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

  if (section === "account") {
    subnav.innerHTML = `
      <button data-sub="profile">Profile</button>
      <button data-sub="password">Password</button>
    `;
    attachSubnavHandlers(section);
    content.innerHTML = `<h3>Select a setting</h3>`;
  }

  if (section === "general") {
    subnav.innerHTML = `
      <button data-sub="language">Language & Time</button>
      <button data-sub="appearance">Appearance</button>
    `;
    attachSubnavHandlers(section);
    content.innerHTML = `<h3>Select a setting</h3>`;
  }

  if (section === "admin") {
    subnav.innerHTML = `
      <button data-sub="users">Users</button>
    `;
    attachSubnavHandlers(section);
    content.innerHTML = `<h3>Select an admin setting</h3>`;
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

      if (section === "account" && sub === "password") {
        renderChangePassword();
        return;
      }

      if (section === "admin" && sub === "users") {
        renderAdminUsers();
        return;
      }

      document.getElementById("settings-content-inner").innerHTML =
        `<h3>${btn.textContent}</h3><p>Settings coming soon.</p>`;
    });
  });
}


// =====================================================
// ACCOUNT → CHANGE PASSWORD (SELF)
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

      if (!data.success) throw new Error(data.error);

      msg.textContent = "Password updated successfully.";
      msg.className = "form-message success";

      ["currentPassword", "newPassword", "confirmPassword"].forEach(id => {
        document.getElementById(id).value = "";
      });

    } catch {
      msg.textContent = "Failed to update password.";
      msg.className = "form-message error";
    }
  });
}


// =====================================================
// ADMIN → USERS
// =====================================================

async function renderAdminUsers() {
  const content = document.getElementById("settings-content-inner");

  content.innerHTML = `
    <div class="settings-section">
      <h3>Users</h3>
      <p class="muted">Loading users…</p>
    </div>
  `;

  try {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (!data.success) throw new Error();

    const rows = data.users.map(u => `
      <tr>
        <td>${u.Username}</td>
        <td>${u.Email}</td>
        <td>${u.CompanyName || "-"}</td>
        <td>
          <select
            class="role-select"
            data-username="${u.Username}"
            data-original="${u.Role}"
          >
            <option value="Admin" ${u.Role === "Admin" ? "selected" : ""}>Admin</option>
            <option value="User" ${u.Role === "User" ? "selected" : ""}>User</option>
          </select>
        </td>
        <td>${u.IsActive ? "Active" : "Inactive"}</td>
        <td class="actions">
          <button class="btn-secondary" data-action="reset" data-user="${u.Username}">
            Reset password
          </button>
          <button class="btn-danger" data-action="delete" data-user="${u.Username}">
            Delete
          </button>
        </td>
      </tr>
    `).join("");

    content.innerHTML = `
      <div class="settings-section">
        <h3>Users (${data.count})</h3>

        <table class="settings-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Company</th>
              <th>Role</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

    attachAdminUserActions();
    attachRoleChangeHandlers();

  } catch {
    content.innerHTML = `
      <div class="settings-section error">
        Failed to load users.
      </div>
    `;
  }
}


// =====================================================
// ADMIN → ACTIONS
// =====================================================

function attachAdminUserActions() {
  document.querySelectorAll("[data-action]").forEach(btn => {
    const user = btn.dataset.user;

    if (btn.dataset.action === "delete") {
      btn.onclick = () => openConfirmAction({
        title: "Delete user",
        username: user,
        onConfirm: () => deleteUser(user)
      });
    }

    if (btn.dataset.action === "reset") {
      btn.onclick = () => {
        const pw = prompt(`Enter new password for ${user}`);
        if (pw) resetUserPassword(user, pw);
      };
    }
  });
}

async function deleteUser(username) {
  await fetch(`/api/admin/users/${username}`, { method: "DELETE" });
  renderAdminUsers();
}

async function resetUserPassword(username, password) {
  await fetch(`/api/admin/users/${username}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  });
  showToast("Password updated", "success");
}


// =====================================================
// ROLE CHANGE (INSTANT SAVE)
// =====================================================

function attachRoleChangeHandlers() {
  document.querySelectorAll(".role-select").forEach(select => {
    select.addEventListener("change", async () => {
      const username = select.dataset.username;
      const newRole = select.value;
      const original = select.dataset.original;

      select.disabled = true;

      try {
        const res = await fetch(`/api/admin/users/${username}/role`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole })
        });

        const data = await res.json();
        if (!data.success) throw new Error();

        select.dataset.original = newRole;
        showToast(`Role updated to ${newRole}`, "success");

      } catch {
        select.value = original;
        showToast("Failed to update role", "error");
      } finally {
        select.disabled = false;
      }
    });
  });
}


// =====================================================
// CONFIRM ACTION MODAL
// =====================================================

function ensureConfirmModal() {
  if (document.getElementById("confirmActionOverlay")) return;

  const modal = document.createElement("div");
  modal.id = "confirmActionOverlay";
  modal.className = "modal-overlay hidden";

  modal.innerHTML = `
    <div class="modal-shell">
      <div class="modal-header">
        <h3 id="confirmActionTitle"></h3>
        <button class="modal-close" data-close-confirm>×</button>
      </div>
      <div class="modal-body">
        <p>This action cannot be undone.</p>
        <p>Type <strong id="confirm-username-label"></strong> to confirm:</p>
        <input id="confirmUsernameInput" autocomplete="off">
        <div class="confirm-actions">
          <button class="btn-secondary" data-close-confirm>Cancel</button>
          <button class="btn-danger" id="confirmActionBtn" disabled>Confirm</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

function openConfirmAction({ title, username, onConfirm }) {
  ensureConfirmModal();

  const overlay = document.getElementById("confirmActionOverlay");
  const input = document.getElementById("confirmUsernameInput");
  const btn = document.getElementById("confirmActionBtn");

  document.getElementById("confirmActionTitle").textContent = title;
  document.getElementById("confirm-username-label").textContent = username;

  input.value = "";
  btn.disabled = true;
  overlay.classList.remove("hidden");

  input.oninput = () => btn.disabled = input.value !== username;

  btn.onclick = () => {
    overlay.classList.add("hidden");
    onConfirm();
  };

  document.querySelectorAll("[data-close-confirm]").forEach(b =>
    b.onclick = () => overlay.classList.add("hidden")
  );
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

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.remove("hidden", "success", "error");
  toast.classList.add(type);

  setTimeout(() => {
    toast.classList.add("hidden");
  }, 2200);
}