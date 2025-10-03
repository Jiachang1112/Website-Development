// assets/js/app.js

// ---- 設定與頁面匯入 -------------------------------------------------
import { GOOGLE_CLIENT_ID, ADMIN_EMAILS } from './config.js';

// 依你現有寫法：DashboardPage / AuthPage 大多是「具名匯出」；Admin / Shop 多半是「預設匯出」
import { DashboardPage } from './pages/dashboard.js';
import { AuthPage } from './pages/auth.js';
import ShopPage from './pages/shop.js';         // ✅ 新增：商城頁
import AdminPage from './pages/admin.js';       // 後台頁面

// （如果還有其他頁，可照這樣解除註解加上）
// import { ExpensePage } from './pages/expense.js';
// import { ExpenseMinePage } from './pages/expense-mine.js';
// import { ExpenseDetailPage } from './pages/expense-detail.js';
// import { ExpenseAnalysisPage } from './pages/expense-analysis.js';
// import { SettingsPage } from './pages/settings.js';
// import { ChatbookPage } from './pages/chatbook.js';
// import { CameraExpensePage } from './pages/camera-expense.js';

// ---- 路由表 ----------------------------------------------------------
const routes = {
  dashboard: DashboardPage,
  auth: AuthPage,
  shop: ShopPage,          // ✅ 已接上商城
  admin: AdminPage,        // 後台
  // acct_mine: ExpenseMinePage,
  // acct_detail: ExpenseDetailPage,
  // acct_analysis: ExpenseAnalysisPage,
  // expense: ExpensePage,
  // settings: SettingsPage,
  // chatbook: ChatbookPage,
  // camera: CameraExpensePage,
};

// ---- 共用工具（保留你之前的邏輯） ------------------------------------
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
  // 比對 email 或 name 是否在白名單
  return (u.email && ADMIN_EMAILS.includes(u.email)) || ADMIN_EMAILS.includes(u.name || '');
}

// ---- 主渲染（含錯誤保護） --------------------------------------------
function render() {
  const root = document.getElementById('app');
  try {
    const hash = (location.hash || '#dashboard').replace('#', '');
    const Page = routes[hash] || DashboardPage;
    root.innerHTML = '';
    const el = Page();

    // 允許頁面回傳 Promise（例如有 async 初始化）
    if (el && typeof el.then === 'function') {
      el.then(node => node && root.appendChild(node));
    } else {
      el && root.appendChild(el);
    }
  } catch (e) {
    console.error(e);
    root.innerHTML = `<pre style="color:#f88;white-space:pre-wrap">Render error:\n${e.stack || e}</pre>`;
  }
}

// ---- 導覽點擊（支援 data-route 切頁） ---------------------------------
document.addEventListener('click', (e) => {
  const r = e.target?.getAttribute?.('data-route');
  if (r) {
    e.preventDefault();
    location.hash = '#' + r;
  }
});

// ---- 快速加入行為（若你的 FAB 還在畫面，保留） -------------------------
document.getElementById('fabExpense')?.addEventListener('click', () => (location.hash = '#expense'));
document.getElementById('fabShop')?.addEventListener('click', () => (location.hash = '#shop'));

// ---- 啟動 ------------------------------------------------------------
window.addEventListener('hashchange', render);
window.addEventListener('load', render);
