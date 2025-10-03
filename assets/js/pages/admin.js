// assets/js/pages/admin.js
import { db } from '../firebase.js';
import { isAdmin } from '../auth-utils.js';
import {
  collection, query, orderBy, limit, onSnapshot
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

export default function AdminPage() {
  const el = document.createElement('div');
  el.className = 'container card';
  el.innerHTML = '<h3>後台</h3>';

  // 權限檢查
  if (!isAdmin()) {
    el.innerHTML += `
      <p class="small">只有管理員可以查看此頁面</p>
      <a class="ghost" href="#auth">前往登入</a>
    `;
    return el;
  }

  el.innerHTML += `<p>✅ 歡迎管理員，你可以在這裡顯示 Firestore 的紀錄</p>`;
  return el;
}
