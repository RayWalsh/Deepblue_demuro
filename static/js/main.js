function toggleUserMenu() {
  const menu = document.getElementById('user-menu');
  if (!menu) return;
  menu.classList.toggle('open');
}

document.addEventListener('click', (e) => {
  const menu = document.getElementById('user-menu');
  if (!menu) return;
  const user = document.querySelector('.dbs-topbar .user');
  if (menu.classList.contains('open') && !user.contains(e.target)) {
    menu.classList.remove('open');
  }
});