// assets/js/pages/admin.js
import { db } from '../firebase.js';
import {
  collection,
  query,
  orderBy,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

// 匯出：具名函式（對應 app.js → import { AdminPage } ...）
export function AdminPage() {
  const el = document.createElement('div');
  el.className = 'container card p-3';
  el.innerHTML = `
    <h3 class="mb-3">後台訂單列表</h3>
    <div id="orders" class="small text-muted">載入中…</div>
  `;

  const box = el.querySelector('#orders');

  try {
    // Firestore 訂單集合（依建立時間排序）
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));

    // 即時監聽訂單
    onSnapshot(q, (snap) => {
      if (snap.empty) {
        box.innerHTML = '<div class="text-muted">尚無訂單</div>';
        return;
      }

      box.innerHTML = snap.docs.map((d) => {
        const o = d.data() || {};
        const total = o?.amounts?.total ?? 0;
        const name = o?.customer?.name ?? '';
        const email = o?.customer?.email ?? '';
        const items = (o?.items ?? []).map(i => `${i.name} × ${i.qty}`).join('、');

        // createdAt 可能沒填或不是 Timestamp，加防呆
        const t = o?.createdAt?.toDate ? o.createdAt.toDate() : null;
        const ts = t ? t.toLocaleString() : '(未記錄時間)';

        return `
          <div class="py-2 border-bottom border-secondary">
            <div><b>#${d.id}</b> ｜ ${name} ｜ ${email} ｜ NT$ ${total.toLocaleString()}</div>
            <div class="text-muted">${ts}</div>
            <div class="mt-1">品項：${items}</div>
          </div>
        `;
      }).join('');
    }, (err) => {
      box.innerHTML = `<span class="text-danger">讀取失敗：</span>${err.message}`;
    });
  } catch (err) {
    box.innerHTML = `<span class="text-danger">初始化失敗：</span>${err.message}`;
  }

  return el;
}
