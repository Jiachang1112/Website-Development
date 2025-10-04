// assets/js/pages/admin.js
// 後台頁（先做權限檢查與簡單內容，之後再接 Firestore）

import { ADMIN_EMAILS } from '../config.js';

function readSession() {
  try { return JSON.parse(localStorage.getItem('session_user') || 'null'); }
  catch { return null; }
}
function isAdminLocal() {
  const u = readSession();
  return !!u && (ADMIN_EMAILS.includes(u.email || '') || ADMIN_EMAILS.includes(u.name || ''));
}

export default function AdminPage() {
  const el = document.createElement('div');
  el.className = 'container card';

  if (!isAdminLocal()) {
    el.innerHTML = `
      <h3>後台</h3>
      <p class="small">只有管理員可以查看此頁面。</p>
      <a class="ghost" href="#auth">前往登入</a>
    `;
    return el;
  }

  // 之後這裡你再接 Firestore 訂單 / 商品 / 使用者等等
  el.innerHTML = `
    <h3>後台儀表板</h3>
    <p class="small">（這裡之後再接 Firestore 訂單/商品清單）</p>
  `;
  return el;
}
