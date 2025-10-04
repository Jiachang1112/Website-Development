// assets/js/app.js
// ---------------------------------------------------
// 主 SPA：路由 + 共用工具 + 安全的 render 防呆
// ---------------------------------------------------

import { GOOGLE_CLIENT_ID, ADMIN_EMAILS } from './config.js';

// 各頁面（如果有的檔案先保留原本的）
import DashboardPage       from './pages/dashboard.js';
import ExpensePage         from './pages/expense.js';
import IncomePage          from './pages/income.js';
import ChatbookPage        from './pages/chatbook.js';
import CameraExpensePage   from './pages/camera-expense.js';
import ShopPage            from './pages/shop.js';
import AdminPage           from './pages/admin.js';
import SettingsPage        from './pages/settings.js';
import BackupPage          from './pages/backup.js';
import ExpenseMinePage     from './pages/expense-mine.js';
import ExpenseDetailPage   from './pages/expense-detail.js';
import ExpenseAnalysisPage from './pages/expense-analysis.js';
import { AuthPage }        from './pages/auth.js';

// --------- 共用小工具 ---------
export const fmt = {
  money: (n) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency: 'TWD' })
      .format(+n || 0),
};

function q(sel) { return document.querySelector(sel); }

export function currentUser() {
  try { return JSON.parse(localStorage.getItem('session_user') || 'null'); }
  catch { return null; }
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
  return ADMIN_EMAILS.includes(u.email || '') || ADMIN_EMAILS.includes(u.name || '');
}

// --------- 路由表（這裡一定要小心逗號/括號） ---------
const routes = {
  dashboard:      DashboardPage,
  auth:           AuthPage,
  expense:        ExpensePage,
  income:         IncomePage,
  chatbook:       ChatbookPage,
  camera:         CameraExpensePage,
  shop:           ShopPage,         // ← 購物頁
  admin:          AdminPage,        // ← 後台頁
  settings:       SettingsPage,
  backup:         BackupPage,
  acct_mine:      ExpenseMinePage,
  acct_detail:    ExpenseDetailPage,
  acct_analysis:  ExpenseAnalysisPage,
};

// --------- 安全的 render（出錯不會整個黑掉） ---------
function render() {
  const root = document.getElementById('app');
  try {
    const hash = (location.hash || '#dashboard').replace('#', '');
    const Page = routes[hash] || DashboardPage;
    root.innerHTML = '';

    const el = Page();

    if (el && typeof el.then === 'function') {
      el.then(node => root.appendChild(node));
    } else if (el instanceof Node) {
      root.appendChild(el);
    } else if (typeof el === 'string') {
      root.innerHTML = el;
    } else if (el) {
      // 其他型別：轉字串顯示
      root.innerHTML = String(el);
    }
  } catch (e) {
    console.error(e);
    root.innerHTML =
      `<pre style="color:#f66;white-space:pre-wrap">Render error:\n${e.stack || e}</pre>`;
  }
}

// 導覽列（有 data-route 的按鈕）事件委派
document.addEventListener('click', (e) => {
  const t = e.target;
  if (t && t.getAttribute && t.getAttribute('data-route')) {
    const r = t.getAttribute('data-route');
    location.hash = `#${r}`;
  }
});

window.addEventListener('hashchange', render);
window.addEventListener('load', render);
