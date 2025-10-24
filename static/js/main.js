document.addEventListener("DOMContentLoaded", () => {
  // ===== USER MENU =====
  const userMenu = document.getElementById("user-menu");
  const userIcon = document.querySelector(".user-initials");

  if (userIcon && userMenu) {
    userIcon.addEventListener("click", (e) => {
      e.stopPropagation();
      userMenu.classList.toggle("open");
    });

    document.addEventListener("click", (e) => {
      if (!userMenu.contains(e.target) && !userIcon.contains(e.target)) {
        userMenu.classList.remove("open");
      }
    });
  }

  // ===== MOBILE SIDEBAR TOGGLE =====
  const menuToggle = document.getElementById("menu-toggle");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");

  if (menuToggle && sidebar && overlay) {
    menuToggle.addEventListener("click", () => {
      sidebar.classList.toggle("open");
      overlay.classList.toggle("active");
    });

    overlay.addEventListener("click", () => {
      sidebar.classList.remove("open");
      overlay.classList.remove("active");
    });
  }
});