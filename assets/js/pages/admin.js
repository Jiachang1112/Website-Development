// assets/js/pages/admin.js
// 後台：訂單列表（卡片） + 右側詳細
// 依賴：assets/js/firebase.js

import { db } from '../firebase.js';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

// 具名匯出，供 app.js import { AdminPage } 使用
export function AdminPage() {
  const el = document.createElement('div');
  el.className = 'container card p-3';
  el.innerHTML = `
    <h3 class="mb-3">後台訂單管理</h3>

    <div class="row g-3">
      <div class="col-lg-6">
        <div class="card p-2" style="min-height:360px">
          <h5 class="m-0">訂單列表</h5>
          <div id="orders" class="mt-2">載入中…</div>
        </div>
      </div>

      <div class="col-lg-6">
        <div class="card p-2" style="min-height:360px">
          <h5 class="m-0">訂單詳細</h5>
          <div id="orderDetail" class="mt-2 small text-muted">左側點一筆查看</div>
        </div>
      </div>
    </div>
  `;

  // 小工具
  const $ = (s, r = el) => r.querySelector(s);
  const money = n => 'NT$ ' + (n || 0).toLocaleString();
  const dt = ts => {
    try {
      const d = ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
      return d ? d.toLocaleString('zh-TW', { hour12: false }) : '(未記錄時間)';
    } catch { return '(未記錄時間)'; }
  };

  const listBox = $('#orders');
  const detailBox = $('#orderDetail');

  // 訂單列表（卡片）
  const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
  onSnapshot(q, snap => {
    if (snap.empty) {
      listBox.innerHTML = '<div class="text-muted">尚無訂單</div>';
      return;
    }

    listBox.innerHTML = snap.docs.map(d => {
      const o = d.data() || {};
      const total = o?.amounts?.total ?? 0;
      const name = o?.customer?.name ?? '';
      const email = o?.customer?.email ?? '';
      const count = (o?.items || []).reduce((s, i) => s + (i.qty || 0), 0);
      const ts = dt(o.createdAt);
      const status = (o.status || 'pending');
      const badge =
        status === 'paid'     ? 'success'   :
        status === 'shipped'  ? 'info'      :
        status === 'canceled' ? 'secondary' : 'warning'; // pending

      return `
        <div class="card mb-2 p-2 list-item" data-id="${d.id}" style="cursor:pointer">
          <div class="d-flex justify-content-between align-items-center">
            <div class="fw-semibold">
              <span class="text-info">#${d.id.slice(0,10)}</span>
              <span class="badge bg-${badge} ms-1">${status}</span>
            </div>
            <div class="fw-bold text-primary">${money(total)}</div>
          </div>
          <div class="small text-muted">${ts}</div>
          <div class="mt-1">客戶：${name} ｜ ${email}</div>
          <div class="text-muted small">品項：${count} 件</div>
        </div>
      `;
    }).join('');

    // 點卡片 → 顯示右側詳細
    listBox.querySelectorAll('.list-item').forEach(row => {
      row.addEventListener('click', () => showOrderDetail(row.dataset.id));
    });
  }, err => {
    listBox.innerHTML = `<span class="text-danger">讀取失敗：</span>${err.message}`;
  });

  // 右側詳細
  async function showOrderDetail(id) {
    detailBox.innerHTML = '載入中…';
    try {
      const snap = await getDoc(doc(db, 'orders', id));
      if (!snap.exists()) { detailBox.innerHTML = '查無資料'; return; }
      const o = snap.data();

      const items = (o.items || []).map(i => `
        <tr>
          <td>${i.name}</td>
          <td>${i.sku || ''}</td>
          <td class="text-end">${i.qty}</td>
          <td class="text-end">${money(i.price)}</td>
          <td class="text-end">${money((i.price || 0) * (i.qty || 0))}</td>
        </tr>
      `).join('');

      const status = o.status || 'pending';
      const ship = o?.customer?.shipping || '-';

      detailBox.innerHTML = `
        <div class="small text-muted">訂單編號</div>
        <div class="mb-2"><code>${id}</code></div>

        <div class="row g-2">
          <div class="col-md-6">
            <div class="small text-muted">建立時間</div>
            <div>${dt(o.createdAt)}</div>
          </div>
          <div class="col-md-6">
            <div class="small text-muted">狀態</div>
            <div><span class="badge bg-secondary">${status}</span></div>
          </div>
        </div>

        <hr class="my-2">

        <div class="small text-muted">客戶資料</div>
        <div class="mb-2">
          <div>${o?.customer?.name || '-'}</div>
          <div>${o?.customer?.phone || '-'}</div>
          <div>${o?.customer?.email || '-'}</div>
          <div>${ship} ｜ ${o?.customer?.address || '-'}</div>
          <div>付款：${o?.customer?.payment || '-'}</div>
          <div>備註：${o?.customer?.note || ''}</div>
        </div>

        <div class="small text-muted">品項</div>
        <div class="table-responsive">
          <table class="table table-sm align-middle">
            <thead>
              <tr>
                <th>名稱</th><th>SKU</th>
                <th class="text-end">數量</th>
                <th class="text-end">單價</th>
                <th class="text-end">小計</th>
              </tr>
            </thead>
            <tbody>${items}</tbody>
            <tfoot>
              <tr>
                <th colspan="4" class="text-end">小計</th>
                <th class="text-end">${money(o?.amounts?.subtotal)}</th>
              </tr>
              <tr>
                <th colspan="4" class="text-end">運費</th>
                <th class="text-end">${money(o?.amounts?.shipping)}</th>
              </tr>
              <tr>
                <th colspan="4" class="text-end">合計</th>
                <th class="text-end">${money(o?.amounts?.total)}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    } catch (e) {
      detailBox.innerHTML = `<span class="text-danger">讀取失敗：</span>${e.message}`;
    }
  }

  return el;
}
