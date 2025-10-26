// ==============================================
// ⚙️ settings_ledger.js — Ledger Settings Page
// ==============================================
document.addEventListener("DOMContentLoaded", () => {
  const contentEl = document.getElementById("settings-content");

  // -------------------------------
  // 🧭 Navigation Pages
  // -------------------------------
  const pages = {
    general: `
      <section class="section">
        <h3>General Settings</h3>
        <p>Define defaults, data sources, or workflow settings here (coming soon).</p>
      </section>
    `,
    columns: `
      <section class="section">
        <h3>Manage Columns</h3>
        <div class="settings-columns-layout">
          <div class="settings-columns-left">
            <p><strong>How to use this section:</strong></p>
            <p>You can click any column on the right to edit its display type. In future, you’ll be able to reorder or lock fields too.</p>
            <button class="primary-btn" id="addColumnBtn">+ Add New Column</button>
          </div>
          <div class="settings-columns-right">
            <ul class="settings-column-list" id="column-list">
              <li>Loading columns...</li>
            </ul>
          </div>
        </div>
      </section>
    `,
    appearance: `
      <section class="section">
        <h3>Table Appearance</h3>
        <label><input type="checkbox" checked /> Show column borders</label><br>
        <label><input type="checkbox" /> Alternate row colors</label>
      </section>
    `,
  };

  // -------------------------------
  // 🚀 Load Page
  // -------------------------------
  function loadPage(pageKey) {
    contentEl.innerHTML = pages[pageKey];

    // Highlight active tab
    document.querySelectorAll("a[data-page]").forEach((link) => {
      link.classList.toggle("active", link.dataset.page === pageKey);
    });

    // Initialize page-specific logic
    if (pageKey === "columns") {
      loadColumns();
      document
        .getElementById("addColumnBtn")
        .addEventListener("click", openNewColumnModal);
    }
  }

  // -------------------------------
  // 🧾 Load Columns from API
  // -------------------------------
  async function loadColumns() {
    const list = document.getElementById("column-list");
    list.innerHTML = "<li>Loading columns...</li>";

    try {
      const res = await fetch("/api/case-columns");
      const data = await res.json();

      if (!res.ok || !Array.isArray(data)) {
        list.innerHTML = "<li>Error loading columns.</li>";
        return;
      }

      list.innerHTML = "";
      data.forEach((col) => {
        const friendly = friendlyTypeFromSQLType(col.type);
        const item = document.createElement("li");
        item.className = "settings-column-item";
        item.innerHTML = `
          <span><strong>${col.name}</strong></span>
          <span>${friendly} <small style="color:#888;">(${col.type})</small></span>
        `;

        if (!["CaseID", "DeepBlueRef"].includes(col.name)) {
          item.classList.add("clickable");
          item.addEventListener("click", () => openColumnEditor(col.name, col.type));
        } else {
          item.style.opacity = "0.6";
          item.style.cursor = "default";
        }

        list.appendChild(item);
      });
    } catch (err) {
      console.error("Error fetching columns:", err);
      list.innerHTML = "<li>⚠️ Failed to load columns.</li>";
    }
  }

  // -------------------------------
  // 🧠 Helpers
  // -------------------------------
  function friendlyTypeFromSQLType(sqlType) {
    const type = sqlType.toLowerCase();
    if (["int", "bigint", "smallint", "tinyint"].includes(type)) return "Number";
    if (["decimal", "numeric", "float", "real", "money"].includes(type))
      return "Decimal Number";
    if (type === "bit") return "Yes/No";
    if (["datetime", "date", "smalldatetime", "datetime2", "datetimeoffset"].includes(type))
      return "Date/Time";
    if (["nchar", "nvarchar", "varchar", "char", "text"].includes(type)) return "Text";
    if (["ntext", "nvarchar(max)", "varchar(max)"].includes(type)) return "Paragraph";
    if (type === "uniqueidentifier") return "ID / Reference";
    if (["varbinary", "image", "binary"].includes(type)) return "File Upload";
    return "Other";
  }

  // -------------------------------
  // 🪟 Modal Logic — Edit Column
  // -------------------------------
  window.openColumnEditor = (name, sqlType) => {
    const isProtected = ["CaseID", "DeepBlueRef"].includes(name);
    document.getElementById("col-name").value = name;
    document.getElementById("col-name").disabled = true;
    document.getElementById("friendly-type").value = friendlyTypeFromSQLType(sqlType);
    document.getElementById("friendly-type").disabled = isProtected;

    const deleteBtn = document.getElementById("deleteColumnBtn");
    if (isProtected) {
      deleteBtn.style.display = "none";
    } else {
      deleteBtn.style.display = "inline-block";
      deleteBtn.onclick = () => confirmDeleteColumn(name);
    }

    document.getElementById("column-editor-modal").style.display = "flex";
  };

  window.closeColumnEditor = () => {
    document.getElementById("column-editor-modal").style.display = "none";
  };

  window.saveColumnChanges = () => {
    const name = document.getElementById("col-name").value;
    const friendlyType = document.getElementById("friendly-type").value;
    console.log("Saving column changes:", { name, friendlyType });
    alert(`✅ Changes saved for column "${name}" (${friendlyType})`);
    closeColumnEditor();
  };

  // -------------------------------
  // 🪟 Modal Logic — New Column
  // -------------------------------
  window.openNewColumnModal = () => {
    document.getElementById("new-column-name").value = "";
    document.getElementById("new-column-type").value = "Text";
    document.getElementById("new-column-modal").style.display = "flex";
  };

  window.closeNewColumnModal = () => {
    document.getElementById("new-column-modal").style.display = "none";
  };

  window.createNewColumn = async () => {
    const name = document.getElementById("new-column-name").value.trim();
    const friendlyType = document.getElementById("new-column-type").value;

    if (!name || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      alert("❌ Invalid column name. Use only letters, numbers, and underscores. Must not start with a number.");
      return;
    }

    try {
      const res = await fetch("/api/add-column", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, friendlyType }),
      });
      const data = await res.json();

      if (data.success) {
        alert(`✅ Column "${name}" added successfully.`);
        closeNewColumnModal();
        loadColumns();
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      console.error("Add column failed:", err);
      alert("❌ Server error while adding column.");
    }
  };

  // -------------------------------
  // 🗑 Delete Column
  // -------------------------------
  window.confirmDeleteColumn = async (name) => {
    if (!confirm(`Are you sure you want to permanently delete "${name}" from the Cases table? This cannot be undone.`))
      return;

    try {
      const res = await fetch(`/api/delete-column/${name}`, { method: "DELETE" });
      const data = await res.json();

      if (data.success) {
        alert(`🗑 Column "${name}" deleted.`);
        closeColumnEditor();
        loadColumns();
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("❌ Failed to delete column.");
    }
  };

  // -------------------------------
  // 🧱 Sidebar Navigation
  // -------------------------------
  document.querySelectorAll("a[data-page]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      loadPage(link.dataset.page);
    });
  });

  // -------------------------------
  // 🚀 Init
  // -------------------------------
  loadPage("general");

  // Allow modals to close when clicking background
  document.querySelectorAll(".sof-modal").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.style.display = "none";
    });
  });
});