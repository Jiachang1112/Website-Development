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

export const fmt={
  money:(n)=> new Intl.NumberFormat(undefined,{style:'currency',currency:'TWD'}).format(+n||0)
};

function q(sel){return document.querySelector(sel);}

const routes={
  dashboard:DashboardPage, auth:AuthPage, expense:ExpensePage, income:IncomePage,
  chatbook:ChatbookPage, camera:CameraExpensePage, shop:ShopPage, admin:AdminPage,
  settings:SettingsPage, backup:BackupPage,
  acct_mine:ExpenseMinePage, acct_detail:ExpenseDetailPage, acct_analysis:ExpenseAnalysisPage
};

function render() {
  const root = document.getElementById('app');
  try {
    const hash = (location.hash || '#dashboard').replace('#', '');
    const Page = routes[hash] || DashboardPage;
    root.innerHTML = '';
    const el = Page();
    if (el?.then) {
      el.then(n => root.appendChild(n));
    } else {
      root.appendChild(el);
    }
  } catch (e) {
    console.error(e);
    root.innerHTML = `<pre style="color:#f88;white-space:pre-wrap">Render error:\n${e.stack || e}</pre>`;
  }
}

window.addEventListener('hashchange', render);
document.addEventListener('click', (e)=>{
  const r=e.target && e.target.getAttribute && e.target.getAttribute('data-route'); if(r){ location.hash='#'+r; }
});
render();

// FABs
q('#fabExpense').addEventListener('click',()=> location.hash='#expense');
q('#fabShop').addEventListener('click',()=> location.hash='#shop');

// Google ID (simple button rendered in AuthPage).

// session helper
export function currentUser(){ try{return JSON.parse(localStorage.getItem('session_user')||'null');}catch{return null;} }
export function requireLogin(){
  const u=currentUser(); if(!u){ location.hash='#auth'; throw new Error('login required'); }
  return u;
}
export function isAdmin(){
  const u=currentUser(); if(!u) return false; return (u.email && ADMIN_EMAILS.includes(u.email)) || ADMIN_EMAILS.includes(u.name||''); 
}
