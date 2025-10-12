// assets/js/app.js
import { GOOGLE_CLIENT_ID, ADMIN_EMAILS } from './config.js';

// 頁面元件
import { DashboardPage }        from './pages/dashboard.js';
import { ExpensePage }          from './pages/expense.js';
import { IncomePage }           from './pages/income.js';
import { ChatbookPage }         from './pages/chatbook.js';
import { CameraExpensePage }    from './pages/camera-expense.js';
import { ShopPage }             from './pages/shop.js';
import { AdminPage }            from './pages/admin.js';
import { SettingsPage }         from './pages/settings.js';
import { BackupPage }           from './pages/backup.js';
import { AuthPage }             from './pages/auth.js';
import { ExpenseMinePage }      from './pages/expense-mine.js';
import { ExpenseDetailPage }    from './pages/expense-detail.js';
import { ExpenseAnalysisPage }  from './pages/expense-analysis.js';
import { ChartPage }            from './pages/chart.js';   // ✅ 新增統計頁

// ----------------------------------------------------
// Formatter
// ----------------------------------------------------
export const fmt = {
  money: (n) =>
    new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'TWD',
    }).format(+n || 0),
};

// ----------------------------------------------------
// Utilities
// ----------------------------------------------------
function q(sel) { return document.querySelector(sel); }

// ----------------------------------------------------
// Routes
// （*不*包含「記帳 book」頁，你已改為外部連結）
// ----------------------------------------------------
const routes = {
  dashboard:       DashboardPage,
  auth:            AuthPage,
  expense:         ExpensePage,
  income:          IncomePage,
  chatbook:        ChatbookPage,
  camera:          CameraExpensePage,   // #camera
  shop:            ShopPage,
  admin:           AdminPage,
  settings:        SettingsPage,
  backup:          BackupPage,
  acct_mine:       ExpenseMinePage,
  acct_detail:     ExpenseDetailPage,
  acct_analysis:   ExpenseAnalysisPage,

  // ✅ 統計頁路由
  chart:           ChartPage,
  charts:          ChartPage,           // 別名，避免拼法不同
};

// ----------------------------------------------------
// Router
// ----------------------------------------------------
function render() {
  const hash = (location.hash || '').replace('#', '') || 'dashboard';
  const Page = routes[hash] || DashboardPage;

  const app = document.getElementById('app');
  if (!app) return; // 頁面沒有 #app 容器時直接跳出（避免外部頁面引入）

  app.innerHTML = '';
  const el = Page();
  if (el && typeof el.then === 'function') {
    // 支援 async component
    el.then((node) => node && app.appendChild(node));
  } else if (el instanceof Node) {
    app.appendChild(el);
  }
}

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', render);

// 支援 data-route 點擊導覽（header / 按鈕）
// ✅ 使用 closest，可點擊到按鈕內層元素也能導頁
document.addEventListener('click', (e) => {
  const t = e.target && e.target.closest && e.target.closest('[data-route]');
  if (t) {
    const r = t.getAttribute('data-route');
    if (r) {
      location.hash = '#' + r;
      e.preventDefault();
    }
  }
});

// ----------------------------------------------------
// FAB 快捷
// ----------------------------------------------------
const fabExpense = q('#fabExpense');
if (fabExpense) {
  fabExpense.addEventListener('click', () => (location.hash = '#expense'));
}
const fabShop = q('#fabShop');
if (fabShop) {
  fabShop.addEventListener('click', () => (location.hash = '#shop'));
}

// ----------------------------------------------------
// Session Helpers
// ----------------------------------------------------
export function currentUser() {
  try {
    return JSON.parse(localStorage.getItem('session_user') || 'null');
  } catch {
    return null;
  }
}

export function requireLogin() {
  const u = currentUser();
  if (!u) {
    location.hash = '#auth';
    throw new Error('login required');
  }
  return u;
}

export function isAdmin() {
  const u = currentUser();
  if (!u) return false;
  // 允許用 email 或顯示名稱比對管理員清單
  return (
    (u.email && ADMIN_EMAILS.includes(u.email)) ||
    ADMIN_EMAILS.includes(u.name || '')
  );
}
