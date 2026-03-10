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

  if (!subnav || !content) return;

  // Reset columns
  subnav.innerHTML = "";
  content.innerHTML = "";

  // =====================================================
  // ACCOUNT
  // =====================================================
  if (section === "account") {
    subnav.innerHTML = `
      <button data-sub="profile">Profile</button>
      <button data-sub="password">Password</button>
    `;
    attachSubnavHandlers(section);
    content.innerHTML = `<h3>Select a setting</h3>`;
    return;
  }

  // =====================================================
  // GENERAL
  // =====================================================
  if (section === "general") {
    subnav.innerHTML = `
      <button data-sub="language">Language & Time</button>
      <button data-sub="appearance">Appearance</button>
    `;
    attachSubnavHandlers(section);
    content.innerHTML = `<h3>Select a setting</h3>`;
    return;
  }

  // =====================================================
  // ADMIN
  // =====================================================
  if (section === "admin") {
    subnav.innerHTML = `
      <button data-sub="users">Users</button>
    `;
    attachSubnavHandlers(section);
    content.innerHTML = `<h3>Select an admin setting</h3>`;
    return;
  }

  // =====================================================
  // COMMUNICATIONS
  // =====================================================
  if (section === "communications") {
    subnav.innerHTML = `
      <button data-sub="templates">Templates</button>
      <button data-sub="templateAssignments">Template Assignments</button>
    `;
    attachSubnavHandlers(section);
    content.innerHTML = `<h3>Select a setting</h3>`;
    return;
  }

  // =====================================================
  // DEFAULT FALLBACK  ✅ ADD HERE
  // =====================================================
  content.innerHTML = `
    <div class="settings-section">
      <h3>${section}</h3>
      <p class="muted">Settings coming soon.</p>
    </div>
  `;
}


// =====================================================
// SUBNAV HANDLERS
// =====================================================

function attachSubnavHandlers(section) {
  const subnav = document.querySelector(".settings-subnav");
  const content = document.getElementById("settings-content-inner");

  if (!subnav || !content) return;

  subnav.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {

      // Reset active state
      subnav.querySelectorAll("button")
        .forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const sub = btn.dataset.sub;

      // =====================================================
      // ACCOUNT
      // =====================================================
      if (section === "account" && sub === "password") {
        renderChangePassword();
        return;
      }

      if (section === "account" && sub === "profile") {
        content.innerHTML = `
          <div class="settings-section">
            <h3>Profile</h3>
            <p class="muted">Profile settings coming soon.</p>
          </div>
        `;
        return;
      }

      // =====================================================
      // ADMIN
      // =====================================================
      if (section === "admin" && sub === "users") {
        renderAdminUsers();
        return;
      }

      // =====================================================
      // COMMUNICATIONS ✅ NEW
      // =====================================================
      if (section === "communications" && sub === "templates") {
        renderTemplatesSettings();
        return;
      }

      if (section === "communications" && sub === "templateAssignments") {
        renderTemplateAssignments();
        return;
      }

      // =====================================================
      // DEFAULT FALLBACK
      // =====================================================
      content.innerHTML = `
        <div class="settings-section">
          <h3>${btn.textContent}</h3>
          <p class="muted">Settings coming soon.</p>
        </div>
      `;
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
// COMMUNICATIONS → EMAIL TEMPLATES
// =====================================================

async function renderTemplatesSettings() {

  const content = document.getElementById("settings-content-inner");
  if (!content) return;

  content.innerHTML = `
    <div class="settings-section">
      <h3>Email Templates</h3>
      <p class="muted">Loading templates…</p>
    </div>
  `;

  try {

    const res = await fetch("/api/templates");
    const data = await res.json();

    // Support both API response styles
    const templates = Array.isArray(data) ? data : (data.templates || []);

    const rows = templates.map(t => `
      <tr data-template-id="${t.TemplateID}">
        <td>${t.Name || "-"}</td>
        <td>${t.Category || "-"}</td>
        <td>${t.Subject || "-"}</td>
        <td class="actions actions-right">
          <button
            class="icon-btn clone-btn"
            data-clone-template="${t.TemplateID}"
            title="Clone template"
          >
            <i class="fa-solid fa-copy"></i>
          </button>

          <button
            class="icon-btn delete-btn"
            data-delete-template="${t.TemplateID}"
            title="Delete template"
          >
            <i class="fa-solid fa-trash"></i>
          </button>

        </td>
      </tr>
      `).join("");

    content.innerHTML = `
      <div class="settings-section settings-wide">

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3>Email Templates (${templates.length})</h3>
          <button class="btn-primary" id="newTemplateBtn">
            + New Template
          </button>
        </div>

        <table class="settings-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Subject</th>
              <th style="width:60px;"></th>
            </tr>
          </thead>
          <tbody>
            ${templates.length ? rows : `
              <tr>
                <td colspan="3" class="muted" style="text-align:center; padding:30px;">
                  No templates created yet.
                </td>
              </tr>
            `}
          </tbody>
        </table>

      </div>
    `;

    attachTemplateActions();

  } catch (err) {

    console.error("Template load error:", err);

    content.innerHTML = `
      <div class="settings-section error">
        <h3>Email Templates</h3>
        <p>Failed to load templates.</p>
      </div>
    `;
  }

}

// =====================================================
// COMMUNICATIONS → TEMPLATE ASSIGNMENTS
// =====================================================

async function renderTemplateAssignments() {

  const content = document.getElementById("settings-content-inner");
  if (!content) return;

  content.innerHTML = `
    <div class="settings-section">

      <h3>Template Assignments</h3>

      <p class="muted">
        Choose which email template is used for each automated message.
      </p>

      <table class="settings-table" id="templateAssignmentsTable">
        <thead>
          <tr>
            <th>Message</th>
            <th>Template</th>
          </tr>
        </thead>
        <tbody id="templateAssignmentsBody"></tbody>
      </table>

    </div>
  `;

  try {

    const [assignRes, templatesRes] = await Promise.all([
      fetch("/api/template-assignments"),
      fetch("/api/templates")
    ]);

    const assignData = await assignRes.json();
    const templatesData = await templatesRes.json();

    const assignments = assignData.assignments || [];
    const templates = templatesData.templates || [];

    const rows = assignments.map(a => {

      const options = templates.map(t => {

        const selected = t.TemplateID === a.TemplateID ? "selected" : "";

        return `<option value="${t.TemplateID}" ${selected}>${t.Name}</option>`;

      }).join("");

      return `
        <tr>
          <td>${a.AssignmentLabel}</td>

          <td>
            <select data-assignment="${a.AssignmentID}">
              <option value="">-- None --</option>
              ${options}
            </select>
          </td>
        </tr>
      `;

    }).join("");

    document.getElementById("templateAssignmentsBody").innerHTML = rows;

    attachTemplateAssignmentHandlers();

  } catch (err) {

    console.error("Assignment load error:", err);

    content.innerHTML = `
      <div class="settings-section error">
        Failed to load template assignments.
      </div>
    `;

  }

}

function attachTemplateAssignmentHandlers() {

  document.querySelectorAll("[data-assignment]").forEach(select => {

    select.addEventListener("change", async () => {

      const assignmentID = select.dataset.assignment;
      const templateID = select.value || null;

      try {

        await fetch(`/api/template-assignments/${assignmentID}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            TemplateID: templateID
          })
        });

        showToast("Assignment updated", "success");

      } catch (err) {

        console.error(err);
        showToast("Failed to update assignment", "error");

      }

    });

  });

}

// =====================================================
// TEMPLATE ACTIONS
// =====================================================

function attachTemplateActions() {

  // NEW TEMPLATE
  const newBtn = document.getElementById("newTemplateBtn");
  if (newBtn) {
    newBtn.onclick = () => openTemplateEditor();
  }

// =====================================================
// CLONE TEMPLATE
// =====================================================

document.querySelectorAll("[data-clone-template]").forEach(btn => {

  btn.addEventListener("click", async (e) => {

    e.stopPropagation(); // prevent row click

    const id = btn.dataset.cloneTemplate;

    try {

      const res = await fetch(`/api/templates/${id}/clone`, {
        method: "POST"
      });

      const data = await res.json();

      if (!data.success) throw new Error();

      showToast("Template cloned", "success");
      renderTemplatesSettings();

    } catch (err) {

      console.error("Clone failed:", err);
      showToast("Failed to clone template", "error");

    }

  });

});

  // =====================================================
  // DELETE TEMPLATE
  // =====================================================

  document.querySelectorAll("[data-delete-template]").forEach(btn => {

    btn.onclick = async (e) => {

      e.stopPropagation(); // prevent row click

      const id = btn.dataset.deleteTemplate;

      if (!confirm("Delete this template?")) return;

      try {

        await fetch(`/api/templates/${id}`, {
          method: "DELETE"
        });

        showToast("Template deleted", "success");
        renderTemplatesSettings();

      } catch {

        showToast("Failed to delete template", "error");

      }

    };

  });

  // =====================================================
  // ROW CLICK → OPEN EDITOR
  // =====================================================

  document.querySelectorAll(".settings-table tbody tr").forEach(row => {

    row.addEventListener("click", () => {

      const id = row.dataset.templateId;
      if (!id) return;

      openTemplateEditor(id);

    });

  });

}

// =====================================================
// TEMPLATE EDITOR
// =====================================================

async function openTemplateEditor(templateId = null) {

  const content = document.getElementById("settings-content-inner");
  if (!content) return;

  content.innerHTML = `
    <div class="settings-section template-editor">

      <h3>${templateId ? "Edit Template" : "New Template"}</h3>

      <!-- VARIABLE CHIPS -->
      <div class="variable-toolbar">

        <span class="variable-label">Insert Variable:</span>

        <div class="variable-chips">

          <button class="variable-chip" data-variable="VesselName">VesselName</button>
          <button class="variable-chip" data-variable="VoyageNo">VoyageNo</button>
          <button class="variable-chip" data-variable="ChartererName">ChartererName</button>
          <button class="variable-chip" data-variable="CaseRef">CaseRef</button>
          <button class="variable-chip" data-variable="TimebarExpiryDate">TimebarExpiry</button>
          <button class="variable-chip" data-variable="VoyageEndDate">VoyageEndDate</button>

        </div>

      </div>

      <!-- NAME -->
      <div class="form-group">
        <label>Name</label>
        <input id="templateName" placeholder="Template name">
      </div>

      <!-- CATEGORY -->
      <div class="form-group">
        <label>Category</label>

        <select id="templateCategory">

          <option value="">Select category</option>
          <option value="Claims">Claims</option>
          <option value="Notifications">Notifications</option>
          <option value="Reminders">Reminders</option>
          <option value="Internal">Internal</option>

        </select>

      </div>

      <!-- SUBJECT -->
      <div class="form-group">
        <label>Subject</label>
        <input id="templateSubject" placeholder="Email subject">
      </div>

      <!-- BODY -->
      <div class="form-group">
        <label>Email Body</label>

        <div class="template-editor-layout">

          <!-- EDITOR -->
          <div class="template-panel">

            <div class="template-panel-header">
              Email Editor
            </div>

            <div class="template-panel-body">
              <textarea id="templateBody"></textarea>
            </div>

          </div>

          <!-- PREVIEW -->
          <div class="template-panel">

            <div class="template-panel-header">
              Email Preview
            </div>

            <div class="template-panel-body">
              <div id="templatePreview" class="template-preview-text"></div>
            </div>

          </div>

        </div>

      </div>

      <!-- ACTIONS -->
      <div style="display:flex; gap:10px; margin-top:16px;">
        <button class="btn-primary" id="saveTemplateBtn">
          Save Template
        </button>

        <button class="btn-secondary" id="cancelTemplateBtn">
          Cancel
        </button>
      </div>

    </div>
  `;

  // =====================================================
  // TRACK ACTIVE FIELD
  // =====================================================

  let activeField = null;

  const nameField = document.getElementById("templateName");
  const subjectField = document.getElementById("templateSubject");
  const bodyField = document.getElementById("templateBody");

  [nameField, subjectField, bodyField].forEach(field => {
    field.addEventListener("focus", () => {
      activeField = field;
    });
  });

  // =====================================================
  // PREVIEW HANDLER
  // =====================================================

  bodyField.addEventListener("input", renderTemplatePreview);
  renderTemplatePreview();

  // =====================================================
  // VARIABLE CHIP INSERT
  // =====================================================

  document.querySelectorAll(".variable-chip").forEach(chip => {

    chip.addEventListener("click", () => {

      if (!activeField) return;

      const variableName = chip.dataset.variable;
      const variable = "{{" + variableName + "}}";

      const start = activeField.selectionStart || 0;
      const end = activeField.selectionEnd || 0;

      activeField.value =
        activeField.value.substring(0, start) +
        variable +
        activeField.value.substring(end);

      activeField.focus();
      activeField.selectionStart =
      activeField.selectionEnd =
        start + variable.length;

      renderTemplatePreview();

    });

  });

  // =====================================================
  // LOAD TEMPLATE (EDIT MODE)
  // =====================================================

  if (templateId) {

    try {

      const res = await fetch(`/api/templates/${templateId}`);
      const data = await res.json();

      if (!data.success) throw new Error();

      const t = data.template;

      nameField.value = t.Name || "";
      document.getElementById("templateCategory").value = t.Category || "";
      subjectField.value = t.Subject || "";
      bodyField.value = t.Body || "";

      renderTemplatePreview();

    } catch (err) {

      console.error("Template load failed", err);
      showToast("Failed to load template", "error");

    }
  }

  // =====================================================
  // SAVE TEMPLATE
  // =====================================================

  const saveBtn = document.getElementById("saveTemplateBtn");

  if (saveBtn) {

    saveBtn.addEventListener("click", async () => {

      const payload = {
        Name: nameField.value.trim(),
        Category: document.getElementById("templateCategory").value,
        Subject: subjectField.value.trim(),
        Body: bodyField.value
      };

      if (!payload.Name) {
        showToast("Template name required", "error");
        return;
      }

      try {

        let res;

        if (templateId) {

          res = await fetch(`/api/templates/${templateId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });

        } else {

          res = await fetch(`/api/templates`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });

        }

        if (!res.ok) {
          const txt = await res.text();
          console.error("Server error:", txt);
          throw new Error("Save failed");
        }

        const data = await res.json();

        if (!data.success) {
          throw new Error(data.error || "Save failed");
        }

        showToast("Template saved", "success");

        renderTemplatesSettings();

      } catch (err) {

        console.error("Template save failed:", err);

        showToast("Failed to save template", "error");

      }

    });

  }

  // =====================================================
  // CANCEL
  // =====================================================

  document.getElementById("cancelTemplateBtn").onclick = () => {
    renderTemplatesSettings();
  };

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

function renderTemplatePreview() {

  const textarea = document.getElementById("templateBody");
  const preview = document.getElementById("templatePreview");

  if (!textarea || !preview) return;

  let text = textarea.value;

  Object.keys(previewData).forEach(key => {

    const regex = new RegExp(`{{${key}}}`, "g");
    text = text.replace(regex, previewData[key]);

  });

  preview.textContent = text;
}

const previewData = {
  VesselName: "OCEANIC FORTUNE",
  VoyageNo: "VOY123",
  ChartererName: "Glencore",
  CaseRef: "DBLS-2026-001",
  TimebarExpiryDate: "15 April 2026",
  VoyageEndDate: "10 March 2026"
};