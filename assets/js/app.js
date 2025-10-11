import { GOOGLE_CLIENT_ID, ADMIN_EMAILS } from './config.js';
import { getAll } from './db.js';
import { DashboardPage } from './pages/dashboard.js';
import { ExpensePage } from './pages/expense.js';
import { IncomePage } from './pages/income.js';
import { ChatbookPage } from './pages/chatbook.js';
import { CameraExpensePage } from './pages/camera-expense.js';
import { ShopPage } from './pages/shop.js';
import { AdminPage } from './pages/admin.js';
import { SettingsPage } from './pages/settings.js';
import { BackupPage } from './pages/backup.js';
import { AuthPage } from './pages/auth.js';
import { ExpenseMinePage } from './pages/expense-mine.js';
import { ExpenseDetailPage } from './pages/expense-detail.js';
import { ExpenseAnalysisPage } from './pages/expense-analysis.js';
import { BookPage } from './pages/book.js';   // ✅ 新增記帳首頁

export const fmt = {
  money: (n) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'TWD' }).format(+n || 0)
};

function q(sel) { return document.querySelector(sel); }

// === Router 定義 ===
const routes = {
  dashboard: DashboardPage,
  book: BookPage,                     // ✅ 新增記帳首頁
  auth: AuthPage,
  expense: ExpensePage,
  income: IncomePage,
  chatbook: ChatbookPage,
  "camera-expense": CameraExpensePage, // ✅ 統一命名
  shop: ShopPage,
  admin: AdminPage,
  settings: SettingsPage,
  backup: BackupPage,
  acct_mine: ExpenseMinePage,
  acct_detail: ExpenseDetailPage,
  acct_analysis: ExpenseAnalysisPage
};

// === Render ===
function render() {
  const hash = location.hash.replace('#', '') || 'dashboard';
  const Page = routes[hash] || DashboardPage;
  const app = document.getElementById('app');
  app.innerHTML = '';
  const el = Page();
  if (el.then) { el.then(node => app.appendChild(node)); }
  else { app.appendChild(el); }
}

window.addEventListener('hashchange', render);

// 點擊導覽列的自動路由
document.addEventListener('click', (e) => {
  const r = e.target && e.target.getAttribute && e.target.getAttribute('data-route');
  if (r) { location.hash = '#' + r; }
});

render();

// === FAB 快捷鍵 ===
q('#fabExpense').addEventListener('click', () => location.hash = '#book');   // ✅ 改成記帳首頁
q('#fabShop').addEventListener('click', () => location.hash = '#shop');

// === Session Helper ===
export function currentUser() {
  try { return JSON.parse(localStorage.getItem('session_user') || 'null'); }
  catch { return null; }
}

export function requireLogin() {
  const u = currentUser();
  if (!u) { location.hash = '#auth'; throw new Error('login required'); }
  return u;
}

export function isAdmin() {
  const u = currentUser();
  if (!u) return false;
  return (u.email && ADMIN_EMAILS.includes(u.email)) || ADMIN_EMAILS.includes(u.name || '');
}
