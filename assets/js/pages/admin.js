// assets/js/pages/admin.js
import { db } from '../firebase.js';
import { ADMIN_EMAILS } from '../config.js';
import {
  collection, getDocs, query, orderBy, limit
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

/* 讀取目前登入使用者（localStorage） */
function currentUser() {
  try {
    return JSON.parse(localStorage.getItem('session_user') || 'null');
  } catch {
    return null;
  }
}

/* 確認是否為管理員（在 config.js 的 ADMIN_EMAILS 名單內） */
function isAdmin() {
  const u = currentUser();
  return !!(u && (ADMIN_EMAILS || []).includes(u.email));
}

/* 產生使用者表格 HTML */
function renderUsersTable(list) {
  let html = `
  <table style="width:100%; border-collapse:collapse; margin-top:10px;">
    <thead>
      <tr>
        <th style="text-align:left; padding:6px; border-bottom:1px solid #333;">UID</th>
        <th style="text-align:left; padding:6px; border-bottom:1px solid #333;">名稱</th>
        <th style="text-align:left; padding:6px; border-bottom:1px solid #333;">Email</th>
        <th style="text-align:left; padding:6px; border-bottom:1px solid #333;">頭像</th>
        <th style="text-align:left; padding:6px; border-bottom:1px solid #333;">更新時間</th>
      </tr>
    </thead>
    <tbody>`;
  list.forEach(u => {
    const t = u.updatedAt?.toDate ? u.updatedAt.toDate().toLocaleString() : '';
    html += `
      <tr>
        <td style="padding:6px; border-bottom:1px solid #222;">${u.uid || u.id || ''}</td>
        <td style="padding:6px; border-bottom:1px solid #222;">${u.name || ''}</td>
        <td style="padding:6px; border-bottom:1px solid #222;">${u.email || ''}</td>
        <td style="padding:6px; border-bottom:1px solid #222;">
          ${u.picture ? `<img src="${u.picture}" style="width:32px;height:32px;border-radius:50%;object-fit:cover" />` : ''}
        </td>
        <td style="padding:6px; border-bottom:1px solid #222;">${t}</td>
      </tr>`;
  });
  html += `</tbody></table>`;
  return html;
}

/* 頁面主函式 */
export default async function AdminPage() {
  const el = document.createElement('div');
  el.className = 'container card';
  el.innerHTML = `<h3>後台</h3>`;

  if (!isAdmin()) {
    el.innerHTML += `
      <p class="small">只有管理員可以進入此頁。</p>
      <a class="ghost" href="#auth">前往登入</a>`;
    return el;
  }

  el.innerHTML += `
    <p class="small">你已是管理員，可檢視使用者清單。</p>
    <div id="usersPanel">讀取中…</div>
  `;

  async function loadUsers() {
    const panel = el.querySelector('#usersPanel');
    panel.textContent = '讀取中…';

    try {
      // 依更新時間由新到舊，最多 100 筆
      const q = query(collection(db, 'users'), orderBy('updatedAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      panel.innerHTML = renderUsersTable(list);
    } catch (err) {
      panel.innerHTML = `<p class="error">讀取失敗：${err.message}</p>`;
    }
  }

  await loadUsers();
  return el;
}
