// assets/js/pages/admin.js
// 後台（AdminPage）：使用與 dashboard.js 相同風格的 UI（kcard/rowi/hero）
// 不動首頁，亦不需要 import { DashboardPage } ...。
// Firestore：orders/ 狀態以英文存（pending/paid/shipped/canceled），UI 顯示中文。

import { db } from '../firebase.js';
import {
  collection, query, where, orderBy, limit, onSnapshot,
  doc, getDoc, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

// ---------- 工具 ----------
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const money = n => 'NT$ ' + (n||0).toLocaleString();
const shortId = id => (id||'').slice(0,10);
const toTW = ts => {
  try {
    const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
    return d ? d.toLocaleString('zh-TW', { hour12:false }) : '-';
  } catch { return '-'; }
};

// 狀態：中文 <-> 英文
const STATE_ZH = ['待付款','已付款','已出貨','已取消'];
const STATE_EN = ['pending','paid','shipped','canceled'];
const en2zh = en => STATE_ZH[STATE_EN.indexOf(en)] || '待付款';
const zh2en = zh => STATE_EN[STATE_ZH.indexOf(zh)] || 'pending';

// ---------- 樣式注入：沿用 dashboard.js 的 CSS ----------
// 若 dashboard 已注入 id="dash-css"，則不會重覆注入
function ensureStyles() {
  if ($('#dash-css')) return;
  const css = document.createElement('style');
  css.id = 'dash-css';
  css.textContent = `
  :root{
    --bg:#0f1318; --fg:#e6e6e6; --muted:#9aa3af;
    --card:#151a21; --border:#2a2f37; --primary:#3b82f6; 
    --shadow:0 6px 24px rgba(0,0,0,.25), 0 2px 8px rgba(0,0,0,.2);
  }
  body.light{
    --bg:#f6f8fc; --fg:#111; --muted:#6b7280;
    --card:#ffffff; --border:#e5e7eb; 
    --shadow:0 12px 24px rgba(17,24,39,.06);
  }
  body{background:var(--bg);color:var(--fg)}
  .shell{max-width:1200px;margin-inline:auto;padding:20px}
  .kcard{background:var(--card);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow)}
  .kcard-hover{transition:transform .16s ease, box-shadow .2s ease}
  .kcard-hover:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(0,0,0,.3)}
  .hero{background:linear-gradient(135deg, rgba(59,130,246,.15), rgba(168,85,247,.10)); border:1px solid var(--border);
        border-radius:18px;padding:18px;display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
  .hero h4{margin:0;font-weight:800}
  .hero .sub{color:var(--muted)}
  .hero .act .btn{border-radius:12px}

  .admin-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  @media (max-width:900px){ .admin-grid{grid-template-columns:1fr} }

  .rowi{display:flex;justify-content:space-between;align-items:center;padding:12px;border-radius:12px;border:1px solid var(--border)}
  .rowi .meta{color:var(--muted);font-size:13px}
  .chip{padding:.25rem .6rem;border-radius:999px;border:1px solid var(--border);color:var(--muted);font-size:12px}

  .pill {display:inline-flex;gap:8px;flex-wrap:wrap}
  .pill .p {padding:.35rem .7rem;border:1px solid var(--border);border-radius:999px;cursor:pointer;color:var(--muted)}
  .pill .p.active {background:rgba(59,130,246,.15); border-color:rgba(59,130,246,.35); color:#93c5fd}
  `;
  document.head.appendChild(css);
}

// ---------- 後台頁面 ----------
export function AdminPage(){
  ensureStyles();

  const el = document.createElement('div');
  el.className = 'shell';
  el.innerHTML = `
    <!-- 頂部 hero -->
    <div class="hero kcard kcard-hover">
      <div>
        <h4>後台管理</h4>
        <div class="sub">管理你的訂單與狀態 — 支援即時更新</div>
      </div>
      <div class="act">
        <button class="btn btn-outline-light me-2" data-go="#index"><i class="bi bi-house me-1"></i>回首頁</button>
        <button class="btn btn-primary" data-go="#shop"><i class="bi bi-cart me-1"></i>線上下單</button>
      </div>
    </div>

    <!-- 篩選 pills -->
    <div class="kcard p-3 mb-3">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div class="pill" id="statePills">
          <button class="p active" data-state="">全部</button>
          <button class="p" data-state="pending">待付款</button>
          <button class="p" data-state="paid">已付款</button>
          <button class="p" data-state="shipped">已出貨</button>
          <button class="p" data-state="canceled">已取消</button>
        </div>
        <small class="text-muted">最多顯示 100 筆（依建立時間新到舊）</small>
      </div>
    </div>

    <!-- 兩欄：左清單、右詳情 -->
    <div class="admin-grid">
      <div class="kcard p-3">
        <h5 class="mb-2">訂單列表</h5>
        <div id="orderList" class="list">載入中…</div>
      </div>

      <div class="kcard p-3">
        <h5 class="mb-2">訂單詳細</h5>
        <div id="orderDetail" class="small text-muted">左側點一筆查看</div>
      </div>
    </div>
  `;

  // 簡單路由跳轉（與你的 dashboard 相同寫法）
  el.addEventListener('click', e=>{
    const go = e.target.closest('[data-go]');
    if (go) location.hash = go.getAttribute('data-go');
  });

  // ---------- 訂單列表 + 篩選 ----------
  let ordersUnsub = null;
  let currentState = '';

  function bindOrders(){
    if (ordersUnsub) { ordersUnsub(); ordersUnsub = null; }

    // 依狀態建構 query
    let qO = query(collection(db,'orders'), orderBy('createdAt','desc'), limit(100));
    if (currentState) {
      qO = query(collection(db,'orders'), where('status','==', currentState), orderBy('createdAt','desc'), limit(100));
    }

    const orderListEl = $('#orderList', el);
    ordersUnsub = onSnapshot(qO, snap=>{
      if (snap.empty){ orderListEl.innerHTML = '<div class="meta">沒有資料</div>'; return; }

      orderListEl.innerHTML = snap.docs.map(d=>{
        const v = d.data()||{};
        const items = (v.items||[]).reduce((s,i)=> s + (i.qty||0), 0);
        return `
          <button class="w-100 text-start bg-transparent border-0 rowi list-item" data-id="${d.id}">
            <div>
              <div class="fw-semibold">#${shortId(d.id)}｜${en2zh(v.status||'pending')}｜${money(v?.amounts?.total)}</div>
              <div class="meta">${(v?.customer?.name||'-')} ｜ ${items} 件</div>
            </div>
            <span class="chip">${toTW(v.createdAt)}</span>
          </button>`;
      }).join('');

      $$('.list-item', orderListEl).forEach(btn=>{
        btn.addEventListener('click', ()=>showOrderDetail(btn.dataset.id));
      });
    }, err=>{
      orderListEl.innerHTML = `<div class="text-danger">讀取失敗：${err.message}</div>`;
    });
  }

  // 點篩選 pill
  $('#statePills', el).addEventListener('click', e=>{
    const p = e.target.closest('.p');
    if (!p) return;
    $$('.p', $('#statePills', el)).forEach(x=>x.classList.remove('active'));
    p.classList.add('active');
    currentState = p.dataset.state || '';
    bindOrders();
  });

  // ---------- 訂單詳細 ----------
  async function showOrderDetail(id){
    const wrap = $('#orderDetail', el);
    wrap.innerHTML = '載入中…';

    try{
      const ref = doc(db,'orders',id);
      const d = await getDoc(ref);
      if (!d.exists()) { wrap.innerHTML = '查無資料'; return; }
      const v = d.data();

      // 狀態選單（中文）
      const optZh = STATE_ZH.map(zh=>{
        const selected = (en2zh(v?.status||'pending')===zh) ? 'selected' : '';
        return `<option ${selected}>${zh}</option>`;
      }).join('');

      const itemsHtml = (v.items||[]).map(i=>`
        <div class="rowi mb-2">
          <div>
            <div class="fw-semibold">${i.name}</div>
            <div class="meta">${i.sku||''}</div>
          </div>
          <div class="text-end">
            <div>${i.qty} × ${money(i.price)}</div>
            <div class="meta">${money((i.qty||0)*(i.price||0))}</div>
          </div>
        </div>
      `).join('') || '<div class="meta">無品項</div>';

      wrap.innerHTML = `
        <div class="mb-2"><small class="text-muted">訂單編號</small><div><code>${d.id}</code></div></div>

        <div class="row g-2">
          <div class="col-md-6">
            <div><small class="text-muted">建立時間</small></div>
            <div>${toTW(v.createdAt)}</div>
          </div>
          <div class="col-md-6">
            <div><small class="text-muted">狀態</small></div>
            <div class="d-flex gap-2 align-items-center">
              <select id="stateSelZh" class="form-select form-select-sm" style="max-width:160px">${optZh}</select>
              <button id="btnSave" class="btn btn-sm btn-primary">儲存</button>
            </div>
          </div>
        </div>

        <hr class="my-2">

        <div class="mb-2">
          <div><small class="text-muted">客戶資料</small></div>
          <div class="rowi">
            <div>
              <div class="fw-semibold">${v?.customer?.name || '-'}</div>
              <div class="meta">${v?.customer?.email || '-'}</div>
            </div>
            <div class="text-end">
              <div>${v?.customer?.phone || '-'}</div>
              <div class="meta">${v?.customer?.shipping || '-'}｜${v?.customer?.address || '-'}</div>
            </div>
          </div>
          <div class="mt-2 meta">付款方式：${v?.customer?.payment || '-'}</div>
          <div class="meta">備註：${v?.customer?.note || ''}</div>
        </div>

        <div class="mt-2"><small class="text-muted">品項</small></div>
        <div>${itemsHtml}</div>

        <div class="rowi mt-2">
          <div class="fw-semibold">小計</div>
          <div>${money(v?.amounts?.subtotal)}</div>
        </div>
        <div class="rowi mt-2">
          <div class="fw-semibold">運費</div>
          <div>${money(v?.amounts?.shipping)}</div>
        </div>
        <div class="rowi mt-2">
          <div class="fw-semibold">合計</div>
          <div>${money(v?.amounts?.total)}</div>
        </div>
      `;

      // 儲存狀態
      $('#btnSave', wrap).addEventListener('click', async ()=>{
        const zh = $('#stateSelZh', wrap).value;
        const en = zh2en(zh);
        try{
          await updateDoc(ref, { status: en, updatedAt: serverTimestamp() });
          alert('狀態已更新');
        }catch(err){
          alert('更新失敗：' + err.message);
        }
      });

    }catch(err){
      wrap.innerHTML = `<div class="text-danger">讀取失敗：${err.message}</div>`;
    }
  }

  // 初次載入
  bindOrders();
  return el;
}
