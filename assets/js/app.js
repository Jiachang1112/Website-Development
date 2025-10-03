// assets/js/app.js
import AuthPage from './pages/auth.js';
import DashboardPage from './pages/dashboard.js';

// 路由對照表
const routes = {
  dashboard: DashboardPage,
  auth: AuthPage,
};

// 渲染目前頁面
function render() {
  const hash = (location.hash || '#dashboard').replace('#', '');
  const Page = routes[hash] || routes['dashboard'];

  const root = document.getElementById('app');
  root.innerHTML = '';
  root.appendChild(Page());
}

// 綁定導航列（header 裡的按鈕）
function bindNav() {
  document.querySelectorAll('header nav button').forEach(btn => {
    btn.addEventListener('click', () => {
      const route = btn.getAttribute('data-route');
      if (route) location.hash = `#${route}`;
    });
  });
}

// 初始化
window.addEventListener('hashchange', render);
window.addEventListener('load', () => {
  bindNav();
  render();
});
