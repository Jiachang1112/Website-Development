// assets/js/pages/admin.js
// 後台：訂單管理 + 用戶記帳（只讀）
// 只依賴：assets/js/firebase.js

import { db } from '../firebase.js';
import {
  collection, collectionGroup, doc,
  query, orderBy, limit, where,
  onSnapshot, getDoc, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

// ====== 你自己的管理員 Email（請改成你的）======
const ADMIN_EMAILS = [
  'Bruce9811123@gmail.com'  // ← 改成你的管理員 Email（可放多個）
];
// =================================================

// 小工具
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const money = n => 'NT$ ' + (n || 0).toLocaleString();
const dt = ts => {
  try {
    if (!ts) return '-';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('zh-TW', { hour12:false });
  } catch { return '-'; }
};
const getSessionUser = () => {
  try { return JSON.parse(localStorage.getItem('session_user')||'null'); }
  catch { return null; }
};
const isAdmin = () => {
  const u = getSessionUser();
  return !!(u && ADMIN_EMAILS.includes((u.email||'').toLowerCase()));
};

export default function AdminPage(){
  const el = document.createElement('div');
  el.className = 'container card p-3';

  // 權限檢查（避免整頁黑掉）
  if (!isAdmin()){
    el.innerHTML = `
      <h3 class="mb-3">⛔ 無權限</h3>
      <p class="text-muted">只有管理員可以進入後台。</p>
      <a class="btn btn-secondary" href="#auth">前往登入</a>`;
    return el;
  }

  // 版面（純原生 JS 切分頁，不用 Bootstrap JS）
  el.innerHTML = `
    <h3 class="mb-3">後台</h3>

    <div class="d-flex gap-2 mb-3">
      <button id="tabOrders" class="btn btn-primary btn-sm">訂單管理</button>
      <button id="tabLedger" class="btn btn-outline-secondary btn-sm">用戶記帳</button>
    </div>

    <div id="paneOrders">
      <div class="row g-3">
        <div class="col-lg-6">
          <div class="card p-2" style="min-height:360px">
            <div class="d-flex justify-content-between align-items-center">
              <h5 class="m-0">最近訂單</h5>
              <select id="orderFilter" class="form-select form-select-sm" style="width:auto">
                <option value="">全部狀態</option>
                <option value="pending">pending</option>
                <option value="paid">paid</option>
                <option value="shipped">shipped</option>
                <option value="canceled">canceled</option>
              </select>
            </div>
            <div id="orderList" class="mt-2 small text-muted">載入中…</div>
          </div>
        </div>
        <div class="col-lg-6">
          <div class="card p-2" style="min-height:360px">
            <h5 class="m-0">訂單詳細</h5>
            <div id="orderDetail" class="mt-2 small text-muted">左側點一筆查看</div>
          </div>
        </div>
      </div>
    </div>

    <div id="paneLedger" class="d-none">
      <div class="row g-3">
        <div class="col-lg-6">
          <div class="card p-2" style="min-height:360px">
            <div class="d-flex justify-content-between align-items-center">
              <h5 class="m-0">最近記帳（collectionGroup: expenses）</h5>
              <span class="small text-muted">最多顯示 100 筆</span>
            </div>
            <div id="ledgerList" class="mt-2 small text-muted">載入中…</div>
          </div>
        </div>
        <div class="col-lg-6">
          <div class="card p-2" style="min-height:360px">
            <h5 class="m-0">記帳詳細</h5>
            <div id="ledgerDetail" class="mt-2 small text-muted">左側點一筆查看</div>
          </div>
        </div>
      </div>
    </div>
  `;

  // ====== 分頁切換（無 Bootstrap JS）======
  const tabOrdersBtn = $('#tabOrders', el);
  const tabLedgerBtn = $('#tabLedger', el);
  const paneOrders   = $('#paneOrders', el);
  const paneLedger   = $('#paneLedger', el);

  tabOrdersBtn.addEventListener('click', ()=>{
    tabOrdersBtn.classList.replace('btn-outline-secondary','btn-primary');
    tabLedgerBtn.classList.replace('btn-primary','btn-outline-secondary');
    paneOrders.classList.remove('d-none');
    paneLedger.classList.add('d-none');
  });
  tabLedgerBtn.addEventListener('click', ()=>{
    tabLedgerBtn.classList.replace('btn-outline-secondary','btn-primary');
    tabOrdersBtn.classList.replace('btn-primary','btn-outline-secondary');
    paneLedger.classList.remove('d-none');
    paneOrders.classList.add('d-none');
  });
  // =======================================

  // === 訂單管理：列表 + 詳細 + 狀態更新 ===
  let ordersUnsub = null;
  const orderListEl = $('#orderList', el);
  const orderDetailEl = $('#orderDetail', el);

  function bindOrders() {
    if (ordersUnsub) { ordersUnsub(); ordersUnsub = null; }
    const state = $('#orderFilter', el).value;

    let qy = query(collection(db,'orders'), orderBy('createdAt','desc'), limit(100));
    if (state) {
      // 注意：where + orderBy 可能需要建立索引，若有錯誤會在 console 顯示建立索引連結
      qy = query(collection(db,'orders'),
        where('status','==',state), orderBy('createdAt','desc'), limit(100));
    }

    ordersUnsub = onSnapshot(qy, snap=>{
      if (snap.empty) { orderListEl.innerHTML = '<div class="text-muted">沒有資料</div>'; return; }
      orderListEl.innerHTML = snap.docs.map(d=>{
        const v = d.data();
        const count = (v.items||[]).reduce((s,i)=>s+i.qty,0);
        const id = d.id.slice(0,10);
        return `
          <div class="border-bottom py-2 list-item" data-id="${d.id}" style="cursor:pointer">
            <div class="d-flex justify-content-between">
              <div>
                <span class="text-info">#${id}</span>
                <span class="ms-2">${dt(v.createdAt)}</span>
              </div>
              <div>
                <span class="badge bg-secondary">${v.status||'pending'}</span>
                <span class="ms-2">${count}件｜${money(v?.amounts?.total)}</span>
              </div>
            </div>
            <div class="text-muted">
              ${v?.customer?.name || '-'} ｜ ${v?.customer?.email || '-'}
            </div>
          </div>`;
      }).join('');

      $$('.list-item', orderListEl).forEach(li=>{
        li.addEventListener('click', ()=>showOrderDetail(li.dataset.id));
      });
    }, err=>{
      console.error(err);
      orderListEl.innerHTML = `<div class="text-danger">讀取失敗：${err.message}</div>`;
    });
  }

  async function showOrderDetail(id){
    orderDetailEl.innerHTML = '載入中…';
    try{
      const ref = doc(db,'orders',id);
      const d = await getDoc(ref);
      if (!d.exists()) { orderDetailEl.innerHTML = '查無資料'; return; }
      const v = d.data();
      const items = (v.items||[]).map(i=>`
        <tr>
          <td>${i.name}</td><td>${i.sku||''}</td>
          <td class="text-end">${i.qty}</td>
          <td class="text-end">${money(i.price)}</td>
          <td class="text-end">${money(i.price*i.qty)}</td>
        </tr>`).join('');

      orderDetailEl.innerHTML = `
        <div class="small text-muted">訂單編號</div>
        <div class="mb-2"><code>${d.id}</code></div>

        <div class="row g-2">
          <div class="col-md-6">
            <div class="small text-muted">建立時間</div>
            <div>${dt(v.createdAt)}</div>
          </div>
          <div class="col-md-6">
            <div class="small text-muted">狀態</div>
            <div class="d-flex gap-2 align-items-center">
              <select id="orderState" class="form-select form-select-sm" style="max-width:160px">
                ${['pending','paid','shipped','canceled'].map(s=>`<option ${s==(v.status||'pending')?'selected':''}>${s}</option>`).join('')}
              </select>
              <button id="btnSaveState" class="btn btn-sm btn-primary">儲存</button>
            </div>
          </div>
        </div>

        <hr class="my-2">

        <div class="small text-muted">客戶資料</div>
        <div class="mb-2">
          <div>${v?.customer?.name || '-'}</div>
          <div>${v?.customer?.phone || '-'}</div>
          <div>${v?.customer?.email || '-'}</div>
          <div>${v?.customer?.shipping || '-'} ｜ ${v?.customer?.address || '-'}</div>
          <div>付款：${v?.customer?.payment || '-'}</div>
          <div>備註：${v?.customer?.note || ''}</div>
        </div>

        <div class="small text-muted">品項</div>
        <div class="table-responsive">
          <table class="table table-sm align-middle">
            <thead>
              <tr><th>名稱</th><th>SKU</th><th class="text-end">數量</th><th class="text-end">單價</th><th class="text-end">小計</th></tr>
            </thead>
            <tbody>${items}</tbody>
            <tfoot>
              <tr><th colspan="4" class="text-end">小計</th><th class="text-end">${money(v?.amounts?.subtotal)}</th></tr>
              <tr><th colspan="4" class="text-end">運費</th><th class="text-end">${money(v?.amounts?.shipping)}</th></tr>
              <tr><th colspan="4" class="text-end">合計</th><th class="text-end">${money(v?.amounts?.total)}</th></tr>
            </tfoot>
          </table>
        </div>
      `;

      $('#btnSaveState', orderDetailEl).addEventListener('click', async ()=>{
        const state = $('#orderState', orderDetailEl).value;
        try{
          await updateDoc(doc(db,'orders',id), { status: state, updatedAt: serverTimestamp() });
          alert('狀態已更新');
        }catch(err){
          alert('更新失敗：'+err.message);
        }
      });
    }catch(err){
      console.error(err);
      orderDetailEl.innerHTML = `<div class="text-danger">讀取失敗：${err.message}</div>`;
    }
  }

  $('#orderFilter', el).addEventListener('change', bindOrders);
  bindOrders();

  // === 用戶記帳：用 collectionGroup 抓 expenses ===
  const ledgerListEl = $('#ledgerList', el);
  const ledgerDetailEl = $('#ledgerDetail', el);

  try {
    const cg = query(
      collectionGroup(db,'expenses'),
      orderBy('date','desc'),   // 如果沒有 date，可改 orderBy('createdAt','desc')
      limit(100)
    );

    onSnapshot(cg, snap=>{
      if (snap.empty){ ledgerListEl.innerHTML = '<div class="text-muted">沒有資料</div>'; return; }
      ledgerListEl.innerHTML = snap.docs.map(d=>{
        const v = d.data();
        const amount = v.amount ?? v.price ?? 0;
        const note = (v.note || v.memo || '').toString().slice(0,24);
        return `
          <div class="border-bottom py-2 ledger-item" data-path="${d.ref.path}" style="cursor:pointer">
            <div class="d-flex justify-content-between">
              <div>${dt(v.date || v.createdAt)}</div>
              <div>${money(amount)}</div>
            </div>
            <div class="text-muted">${note}</div>
          </div>`;
      }).join('');

      $$('.ledger-item', ledgerListEl).forEach(li=>{
        li.addEventListener('click', ()=>showLedgerDetail(li.dataset.path));
      });
    }, err=>{
      console.error(err);
      ledgerListEl.innerHTML = `<div class="text-danger">讀取失敗：${err.message}</div>`;
    });
  } catch (err) {
    console.error(err);
    ledgerListEl.innerHTML = `<div class="text-danger">初始化失敗：${err.message}</div>`;
  }

  async function showLedgerDetail(path){
    ledgerDetailEl.innerHTML = '載入中…';
    try{
      const d = await getDoc(doc(db, path));
      if (!d.exists()){ ledgerDetailEl.innerHTML = '查無資料'; return; }
      const v = d.data();
      ledgerDetailEl.innerHTML = `
        <div class="small text-muted">文件路徑</div>
        <div class="mb-2"><code>${path}</code></div>

        <div class="small text-muted">日期</div>
        <div class="mb-2">${dt(v.date || v.createdAt)}</div>

        <div class="small text-muted">金額</div>
        <div class="mb-2">${money(v.amount ?? v.price ?? 0)}</div>

        <div class="small text-muted">內容</div>
        <pre class="mb-0" style="white-space:pre-wrap">${JSON.stringify(v, null, 2)}</pre>
      `;
    }catch(err){
      console.error(err);
      ledgerDetailEl.innerHTML = `<div class="text-danger">讀取失敗：${err.message}</div>`;
    }
  }

  return el;
}
