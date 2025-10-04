// assets/js/pages/admin.js
// 後台：總覽（把首頁的卡片搬來）+ 訂單管理（可改中文狀態）
// 依賴：assets/js/firebase.js、assets/js/auth-utils.js、Bootstrap 樣式（你的頁面已載）

import { db } from '../firebase.js';
import {
  collection, collectionGroup, doc,
  query, orderBy, where, limit,
  onSnapshot, getDoc, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

import { isAdmin } from '../auth-utils.js';

// ---------- 小工具 ----------
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

// 依你目前寫單的 createdAt=serverTimestamp()，這裡用本地時段計算今日
function getTodayRange(){
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0,0,0,0);
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23,59,59,999);
  return { start, end };
}

// 中文/英文狀態互轉（Firestore 存英文、UI 顯示中文）
const STATE_ZH = ['待付款','已付款','已出貨','已取消'];
const STATE_EN = ['pending','paid','shipped','canceled'];
const en2zh = en => STATE_ZH[STATE_EN.indexOf(en)] || '待付款';
const zh2en = zh => STATE_EN[STATE_ZH.indexOf(zh)] || 'pending';

export function AdminPage(){
  const el = document.createElement('div');
  el.className = 'container';
  
  // 權限檢查
  if (!isAdmin()){
    el.innerHTML = `
      <div class="card p-4 my-4">
        <h3 class="mb-2">⛔ 無權限</h3>
        <p class="text-muted mb-3">只有管理員可以進入後台。</p>
        <a class="btn btn-secondary" href="#auth">前往登入</a>
      </div>`;
    return el;
  }

  // ---------- 版面 ----------
  el.innerHTML = `
    <h3 class="my-3">後台管理</h3>

    <ul class="nav nav-pills mb-3" role="tablist">
      <li class="nav-item" role="presentation">
        <button class="nav-link active" data-bs-toggle="pill" data-bs-target="#paneOverview" type="button" role="tab">
          總覽
        </button>
      </li>
      <li class="nav-item" role="presentation">
        <button class="nav-link" data-bs-toggle="pill" data-bs-target="#paneOrders" type="button" role="tab">
          訂單管理
        </button>
      </li>
    </ul>

    <div class="tab-content">

      <!-- 總覽 -->
      <div class="tab-pane fade show active" id="paneOverview" role="tabpanel">
        
        <!-- 今日摘要 -->
        <div class="row g-3">
          <div class="col-md-3">
            <div class="card p-3 h-100">
              <div class="text-muted">今日訂單</div>
              <div id="ovTodayOrders" class="display-6">0 筆</div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="card p-3 h-100">
              <div class="text-muted">今日營收</div>
              <div id="ovTodayRevenue" class="display-6">NT$ 0</div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="card p-3 h-100">
              <div class="text-muted">待出貨</div>
              <div id="ovToShip" class="display-6">0 筆</div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="card p-3 h-100">
              <div class="text-muted">常用客戶</div>
              <div id="ovUsers" class="display-6">0 位</div>
            </div>
          </div>
        </div>

        <!-- 快速功能 -->
        <div class="card p-3 my-3">
          <div class="text-muted mb-2">快速功能</div>
          <div class="row g-2">
            <div class="col-6 col-md-3">
              <a href="#shop" class="btn btn-outline-secondary w-100">線上下單</a>
            </div>
            <div class="col-6 col-md-3">
              <a href="#admin" class="btn btn-outline-secondary w-100">後台（此頁）</a>
            </div>
            <div class="col-6 col-md-3">
              <a href="#expense" class="btn btn-outline-secondary w-100">支出記帳</a>
            </div>
            <div class="col-6 col-md-3">
              <a href="#settings" class="btn btn-outline-secondary w-100">設定</a>
            </div>
          </div>
        </div>

        <!-- 最近活動（最新訂單） -->
        <div class="card p-3">
          <div class="d-flex justify-content-between align-items-center">
            <div class="text-muted">最近活動</div>
            <a href="#admin" class="small text-decoration-none">查看更多</a>
          </div>
          <div id="ovRecent" class="mt-2 small text-muted">載入中…</div>
        </div>
      </div>

      <!-- 訂單管理 -->
      <div class="tab-pane fade" id="paneOrders" role="tabpanel">
        <div class="row g-3">
          <div class="col-lg-6">
            <div class="card p-3 h-100">
              <div class="d-flex justify-content-between align-items-center">
                <h5 class="m-0">訂單列表</h5>
                <select id="orderFilter" class="form-select form-select-sm" style="width:auto">
                  <option value="">全部狀態</option>
                  <option value="pending">待付款</option>
                  <option value="paid">已付款</option>
                  <option value="shipped">已出貨</option>
                  <option value="canceled">已取消</option>
                </select>
              </div>
              <div id="orderList" class="mt-2 small">載入中…</div>
            </div>
          </div>
          <div class="col-lg-6">
            <div class="card p-3 h-100">
              <h5 class="m-0">訂單詳細</h5>
              <div id="orderDetail" class="mt-2 small text-muted">左側點一筆查看</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  `;

  // ---------- 總覽：資料綁定 ----------
  const $ovTodayOrders  = $('#ovTodayOrders', el);
  const $ovTodayRevenue = $('#ovTodayRevenue', el);
  const $ovToShip       = $('#ovToShip', el);
  const $ovUsers        = $('#ovUsers', el);
  const $ovRecent       = $('#ovRecent', el);

  // 今日訂單、今日營收（client 端統計）
  {
    const { start, end } = getTodayRange();
    const qToday = query(
      collection(db, 'orders'),
      where('createdAt','>=', start),
      where('createdAt','<=', end),
      orderBy('createdAt','desc')
    );
    onSnapshot(qToday, snap=>{
      let count = 0, revenue = 0;
      const emails = new Set();
      const rows = [];

      snap.forEach(d=>{
        const v = d.data();
        count += 1;
        revenue += (v?.amounts?.total) || 0;
        if (v?.customer?.email) emails.add(v.customer.email);
        rows.push([
          `<b>#${d.id.slice(0,10)}</b>`,
          en2zh(v?.status||'pending'),
          money(v?.amounts?.total||0),
          dt(v.createdAt)
        ]);
      });

      $ovTodayOrders.textContent  = `${count} 筆`;
      $ovTodayRevenue.textContent = money(revenue);
      $ovUsers.textContent        = `${emails.size} 位`;

      $ovRecent.innerHTML = rows.length
        ? rows.map(r => `
          <div class="py-2 border-bottom border-secondary text-reset">
            <div>${r[0]}｜${r[1]}｜${r[2]}</div>
            <div class="text-muted">${r[3]}</div>
          </div>`).join('')
        : '<div class="text-muted">尚無資料</div>';
    });
  }

  // 待出貨（狀態=shipped 之前的交付項，這裡以 shipped 當出貨完成）
  {
    const qShip = query(
      collection(db,'orders'),
      where('status','==','paid')
    );
    onSnapshot(qShip, snap=>{
      $ovToShip.textContent = `${snap.size} 筆`;
    });
  }

  // ---------- 訂單管理：列表 + 詳細 + 狀態更新（中文介面） ----------
  let ordersUnsub = null;
  const orderListEl = $('#orderList', el);
  const orderDetailEl = $('#orderDetail', el);

  function bindOrders(){
    if (ordersUnsub) { ordersUnsub(); ordersUnsub = null; }
    const state = $('#orderFilter', el).value;   // 英文值

    let qO = query(collection(db,'orders'), orderBy('createdAt','desc'), limit(100));
    if (state) {
      qO = query(collection(db,'orders'), where('status','==',state), orderBy('createdAt','desc'), limit(100));
    }
    ordersUnsub = onSnapshot(qO, snap=>{
      if (snap.empty){ orderListEl.innerHTML = '<div class="text-muted">沒有資料</div>'; return; }
      orderListEl.innerHTML = snap.docs.map(d=>{
        const v = d.data();
        const count = (v.items||[]).reduce((s,i)=>s+i.qty,0);
        const id = d.id.slice(0,10);
        return `
          <button class="w-100 text-start py-3 px-2 border-0 border-bottom border-secondary bg-transparent list-item" data-id="${d.id}">
            <div class="d-flex justify-content-between align-items-center">
              <div class="fw-semibold">#${id}</div>
              <span class="badge bg-secondary">${en2zh(v?.status||'pending')}</span>
            </div>
            <div class="small text-muted">${dt(v.createdAt)}</div>
            <div class="mt-1">
              客戶：${(v?.customer?.name||'-')} ｜ ${count} 件 ｜ ${money(v?.amounts?.total||0)}
            </div>
          </button>`;
      }).join('');

      $$('.list-item', orderListEl).forEach(li=>{
        li.addEventListener('click', ()=>showOrderDetail(li.dataset.id));
      });
    }, err=>{
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

      // 狀態選擇（中文）
      const optZh = STATE_ZH.map(zh => {
        const selected = (en2zh(v?.status||'pending')===zh) ? 'selected' : '';
        return `<option ${selected}>${zh}</option>`;
      }).join('');

      orderDetailEl.innerHTML = `
        <div class="mb-2"><small class="text-muted">訂單編號</small><div><code>${d.id}</code></div></div>

        <div class="row g-2">
          <div class="col-md-6">
            <div><small class="text-muted">建立時間</small></div>
            <div>${dt(v.createdAt)}</div>
          </div>
          <div class="col-md-6">
            <div><small class="text-muted">狀態</small></div>
            <div class="d-flex gap-2 align-items-center">
              <select id="orderStateZh" class="form-select form-select-sm" style="max-width:160px">${optZh}</select>
              <button id="btnSaveState" class="btn btn-sm btn-primary">儲存</button>
            </div>
          </div>
        </div>

        <hr class="my-2">
        <div><small class="text-muted">客戶資料</small></div>
        <div class="mb-2">
          <div>${v?.customer?.name || '-'}</div>
          <div>${v?.customer?.phone || '-'}</div>
          <div>${v?.customer?.email || '-'}</div>
          <div>${v?.customer?.shipping || '-'} ｜ ${v?.customer?.address || '-'}</div>
          <div>付款：${v?.customer?.payment || '-'}</div>
          <div>備註：${v?.customer?.note || ''}</div>
        </div>

        <div><small class="text-muted">品項</small></div>
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
        const zh = $('#orderStateZh', orderDetailEl).value;
        const en = zh2en(zh);
        try{
          await updateDoc(doc(db,'orders',id), { status: en, updatedAt: serverTimestamp() });
          alert('狀態已更新');
        }catch(err){
          alert('更新失敗：' + err.message);
        }
      });
    }catch(err){
      orderDetailEl.innerHTML = `<div class="text-danger">讀取失敗：${err.message}</div>`;
    }
  }

  $('#orderFilter', el).addEventListener('change', bindOrders);
  bindOrders();

  return el;
}
