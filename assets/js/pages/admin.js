// assets/js/pages/admin.js
// 後台（AdminPage）：含「首頁儀表板」+「訂單管理」整合版本
// - 今日概況/快速功能/最近活動 -> 從 dashboard 搬過來
// - 訂單列表 + 詳細（中文狀態下拉，寫回英文 pending/paid/shipped/canceled）
// - 樣式與 dashboard 共用（dash-css），只會注入一次

import { db } from '../firebase.js';
import {
  collection, query, where, orderBy, limit, onSnapshot,
  doc, getDoc, updateDoc, serverTimestamp,
  getDocs, Timestamp
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

/* ------------- 共用工具 ------------- */
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const money   = n => 'NT$ ' + (n||0).toLocaleString();
const shortId = id => (id||'').slice(0,10);
const toTW    = ts => {
  try {
    const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
    return d ? d.toLocaleString('zh-TW', { hour12:false }) : '-';
  } catch { return '-'; }
};
const startOfToday = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const endOfToday   = () => { const d = new Date(); d.setHours(23,59,59,999); return d; };

// 狀態：中文 <-> 英文
const STATE_ZH = ['待付款','已付款','已出貨','已取消'];
const STATE_EN = ['pending','paid','shipped','canceled'];
const en2zh = en => STATE_ZH[STATE_EN.indexOf(en)] || '待付款';
const zh2en = zh => STATE_EN[STATE_ZH.indexOf(zh)] || 'pending';

/* ------------- 樣式：與 dashboard 共用 ------------- */
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
    --card:#ffffff; --border:#e5e7eb; --shadow:0 12px 24px rgba(17,24,39,.06);
  }
  body{background:var(--bg);color:var(--fg)}
  .shell{max-width:1200px;margin-inline:auto;padding:20px}

  .kcard{background:var(--card);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow)}
  .kcard-hover{transition:transform .16s ease, box-shadow .2s ease}
  .kcard-hover:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(0,0,0,.3)}

  .hero{background:linear-gradient(135deg, rgba(59,130,246,.15), rgba(168,85,247,.10));
        border:1px solid var(--border);border-radius:18px;padding:18px;
        display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
  .hero h4{margin:0;font-weight:800}
  .hero .sub{color:var(--muted)}
  .hero .act .btn{border-radius:12px}

  .page-title{display:flex;align-items:center;gap:12px;margin:12px 0 22px}
  .page-title .badge{background:transparent;border:1px dashed var(--border);color:var(--muted)}

  .stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
  @media (max-width:1200px){.stat-grid{grid-template-columns:repeat(2,1fr)}}
  @media (max-width:640px){.stat-grid{grid-template-columns:1fr}}
  .stat{padding:16px;border-radius:14px;display:flex;gap:14px;align-items:center}
  .stat .ico{width:44px;height:44px;border-radius:10px;display:grid;place-items:center;font-size:20px}
  .stat .meta{color:var(--muted);font-size:14px}
  .stat .val{font-weight:800;font-size:20px;color:var(--fg)}
  .ico-blue{background:rgba(59,130,246,.15);color:#93c5fd;border:1px solid rgba(59,130,246,.25)}
  .ico-green{background:rgba(34,197,94,.15);color:#86efac;border:1px solid rgba(34,197,94,.25)}
  .ico-amber{background:rgba(245,158,11,.15);color:#fcd34d;border:1px solid rgba(245,158,11,.25)}
  .ico-purple{background:rgba(168,85,247,.15);color:#e9d5ff;border:1px solid rgba(168,85,247,.25)}

  .quick-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}
  @media (max-width:1200px){.quick-grid{grid-template-columns:repeat(3,1fr)}}
  @media (max-width:640px){.quick-grid{grid-template-columns:repeat(2,1fr)}}
  .quick{padding:14px;display:flex;align-items:center;gap:12px;border-radius:14px;cursor:pointer}
  .quick .i{width:40px;height:40px;border-radius:10px;display:grid;place-items:center}
  .quick .t{font-weight:700}
  .quick .s{color:var(--muted);font-size:12px}
  .quick .i.blue{background:rgba(59,130,246,.12);color:#93c5fd;border:1px solid rgba(59,130,246,.25)}
  .quick .i.green{background:rgba(34,197,94,.12);color:#86efac;border:1px solid rgba(34,197,94,.25)}
  .quick .i.amber{background:rgba(245,158,11,.12);color:#fcd34d;border:1px solid rgba(245,158,11,.25)}
  .quick .i.pink{background:rgba(236,72,153,.12);color:#f9a8d4;border:1px solid rgba(236,72,153,.25)}
  .quick .i.purple{background:rgba(139,92,246,.12);color:#d8b4fe;border:1px solid rgba(139,92,246,.25)}
  .quick .i.slate{background:rgba(100,116,139,.12);color:#cbd5e1;border:1px solid rgba(100,116,139,.25)}

  .block-hd{display:flex;justify-content:space-between;align-items:center;margin:18px 0 10px}
  .block-hd .hint{color:var(--muted);font-size:14px}

  .list{display:flex;flex-direction:column;gap:10px}
  .rowi{display:flex;justify-content:space-between;align-items:center;padding:12px;border-radius:12px;border:1px solid var(--border)}
  .rowi .meta{color:var(--muted);font-size:13px}
  .chip{padding:.25rem .6rem;border-radius:999px;border:1px solid var(--border);color:var(--muted);font-size:12px}

  .pill {display:inline-flex;gap:8px;flex-wrap:wrap}
  .pill .p {padding:.35rem .7rem;border:1px solid var(--border);border-radius:999px;cursor:pointer;color:var(--muted)}
  .pill .p.active {background:rgba(59,130,246,.15); border-color:rgba(59,130,246,.35); color:#93c5fd}

  .admin-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  @media (max-width:900px){ .admin-grid{grid-template-columns:1fr} }
  `;
  document.head.appendChild(css);
}

/* ------------- 儀表板：今日統計 & 最近活動 ------------- */
async function computeTodayStats(setters){
  const start = Timestamp.fromDate(startOfToday());
  const end   = Timestamp.fromDate(endOfToday());

  const qToday = query(
    collection(db,'orders'),
    where('createdAt','>=',start),
    where('createdAt','<=',end)
  );
  const snapToday = await getDocs(qToday);
  let ordersCnt = 0, revenue = 0, paidNotShipped = 0;
  snapToday.forEach(d=>{
    const v = d.data()||{};
    ordersCnt += 1;
    revenue   += (v?.amounts?.total || 0);
    if ((v.status||'')==='paid') paidNotShipped += 1; // 已付款待出貨
  });

  // 最近 30 天常用客戶（以 Email 去重）
  const since = new Date(); since.setDate(since.getDate()-30);
  const q30 = query(
    collection(db,'orders'),
    where('createdAt','>=', Timestamp.fromDate(since)),
    orderBy('createdAt','desc'),
    limit(200)
  );
  const s30 = await getDocs(q30);
  const uniq = new Set();
  s30.forEach(d=>{
    const email = d.data()?.customer?.email || '';
    if(email) uniq.add(email.toLowerCase());
  });

  setters.orders(ordersCnt);
  setters.revenue(revenue);
  setters.ship(paidNotShipped);
  setters.users(uniq.size);
}

function listenRecent(el){
  const listEl = $('#recentList', el);
  const qRecent = query(collection(db,'orders'), orderBy('createdAt','desc'), limit(6));
  onSnapshot(qRecent, snap=>{
    if (snap.empty){ listEl.innerHTML = '<div class="meta">最近沒有活動</div>'; return; }
    listEl.innerHTML = snap.docs.map(d=>{
      const v = d.data()||{};
      const items = (v.items||[]).reduce((s,i)=> s + (i.qty||0), 0);
      return `
        <div class="rowi">
          <div>
            <div class="fw-semibold">#${shortId(d.id)}｜${en2zh(v.status||'pending')}｜${money(v?.amounts?.total)}</div>
            <div class="meta">${(v?.customer?.name||'-')} ｜ ${items} 件</div>
          </div>
          <span class="chip">${toTW(v.createdAt)}</span>
        </div>`;
    }).join('');
  }, err=>{
    listEl.innerHTML = `<div class="text-danger">讀取失敗：${err.message}</div>`;
  });
}

/* ------------- Admin 主頁面（含儀表板 + 訂單管理） ------------- */
export function AdminPage(){
  ensureStyles();

  const el = document.createElement('div');
  el.className = 'shell';
  el.innerHTML = `
    <!-- Hero -->
    <div class="hero kcard kcard-hover">
      <div>
        <h4>後台管理</h4>
        <div class="sub">今日概況、快速功能與訂單管理，一頁完成</div>
      </div>
      <div class="act">
        <button class="btn btn-outline-light me-2" data-go="#index"><i class="bi bi-house me-1"></i>回首頁</button>
        <button class="btn btn-primary" data-go="#shop"><i class="bi bi-cart me-1"></i>線上下單</button>
      </div>
    </div>

    <!-- 今日概況 -->
    <div class="page-title">
      <h5 class="m-0">今日概況</h5>
      <span class="badge rounded-pill px-2">更新於 <span id="dashTime"></span></span>
    </div>
    <div class="stat-grid mb-3">
      <div class="kcard stat">
        <div class="ico ico-blue"><i class="bi bi-bag-check"></i></div>
        <div><div class="meta">今日訂單</div><div class="val" id="statOrders">—</div></div>
      </div>
      <div class="kcard stat">
        <div class="ico ico-green"><i class="bi bi-currency-dollar"></i></div>
        <div><div class="meta">今日營收</div><div class="val" id="statRevenue">—</div></div>
      </div>
      <div class="kcard stat">
        <div class="ico ico-amber"><i class="bi bi-receipt"></i></div>
        <div><div class="meta">待出貨</div><div class="val" id="statShip">—</div></div>
      </div>
      <div class="kcard stat">
        <div class="ico ico-purple"><i class="bi bi-people"></i></div>
        <div><div class="meta">常用客戶</div><div class="val" id="statUsers">—</div></div>
      </div>
    </div>

    <!-- 快速功能 -->
    <div class="block-hd">
      <h5 class="m-0">快速功能</h5>
      <div class="hint">把常用的入口放在這邊，一鍵進入</div>
    </div>
    <div class="quick-grid mb-3">
      <div class="kcard kcard-hover quick" data-go="#shop">
        <div class="i blue"><i class="bi bi-cart"></i></div>
        <div><div class="t">線上下單</div><div class="s">快速加入購物車</div></div>
      </div>
      <div class="kcard kcard-hover quick" data-go="#admin">
        <div class="i purple"><i class="bi bi-speedometer2"></i></div>
        <div><div class="t">後台</div><div class="s">訂單狀態管理</div></div>
      </div>
      <div class="kcard kcard-hover quick" data-go="#expense">
        <div class="i amber"><i class="bi bi-journal-check"></i></div>
        <div><div class="t">支出記帳</div><div class="s">快速登錄支出</div></div>
      </div>
      <div class="kcard kcard-hover quick" data-go="#camera">
        <div class="i pink"><i class="bi bi-camera"></i></div>
        <div><div class="t">拍照記帳</div><div class="s">拍照上傳憑證</div></div>
      </div>
      <div class="kcard kcard-hover quick" data-go="#chatbook">
        <div class="i slate"><i class="bi bi-chat-dots"></i></div>
        <div><div class="t">聊天記帳</div><div class="s">用對話輸入</div></div>
      </div>
      <div class="kcard kcard-hover quick" data-go="#settings">
        <div class="i green"><i class="bi bi-gear"></i></div>
        <div><div class="t">設定</div><div class="s">偏好與進階</div></div>
      </div>
    </div>

    <!-- 最近活動 -->
    <div class="block-hd">
      <h5 class="m-0">最近活動</h5>
      <a class="btn btn-sm btn-outline-light" data-go="#admin">查看全部</a>
    </div>
    <div class="kcard p-3 mb-3">
      <div class="list" id="recentList">
        <div class="meta">載入中…</div>
      </div>
    </div>

    <!-- 訂單管理（篩選 + 列表 + 詳細） -->
    <div class="kcard p-3 mb-3">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h5 class="m-0">訂單管理</h5>
        <div class="pill" id="statePills">
          <button class="p active" data-state="">全部</button>
          <button class="p" data-state="pending">待付款</button>
          <button class="p" data-state="paid">已付款</button>
          <button class="p" data-state="shipped">已出貨</button>
          <button class="p" data-state="canceled">已取消</button>
        </div>
      </div>
    </div>

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

  // 簡易 hash 導航（與首頁一致）
  el.addEventListener('click', e=>{
    const go = e.target.closest('[data-go]');
    if (go) location.hash = go.getAttribute('data-go');
  });

  // 顯示時間 + 今日統計 + 最近活動
  $('#dashTime', el).textContent = new Date().toLocaleString('zh-TW',{hour12:false});
  computeTodayStats({
    orders: n => $('#statOrders', el).textContent  = `${n} 筆`,
    revenue:n => $('#statRevenue', el).textContent = money(n),
    ship:   n => $('#statShip', el).textContent    = `${n} 筆`,
    users:  n => $('#statUsers', el).textContent   = `${n} 位`
  }).catch(()=>{ /* 安靜失敗即可 */ });
  listenRecent(el);

  /* ---- 訂單列表 + 篩選 ---- */
  let currentState = '';
  let ordersUnsub = null;

  function bindOrders(){
    if (ordersUnsub) { ordersUnsub(); ordersUnsub = null; }
    let qO = query(collection(db,'orders'), orderBy('createdAt','desc'), limit(100));
    if (currentState) {
      qO = query(collection(db,'orders'),
        where('status','==', currentState),
        orderBy('createdAt','desc'), limit(100));
    }
    const listEl = $('#orderList', el);
    ordersUnsub = onSnapshot(qO, snap=>{
      if (snap.empty){ listEl.innerHTML = '<div class="meta">沒有資料</div>'; return; }
      listEl.innerHTML = snap.docs.map(d=>{
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
      $$('.list-item', listEl).forEach(btn=>{
        btn.addEventListener('click', ()=>showOrderDetail(btn.dataset.id));
      });
    }, err=>{
      listEl.innerHTML = `<div class="text-danger">讀取失敗：${err.message}</div>`;
    });
  }

  $('#statePills', el).addEventListener('click', e=>{
    const p = e.target.closest('.p'); if (!p) return;
    $$('.p', $('#statePills', el)).forEach(x=>x.classList.remove('active'));
    p.classList.add('active');
    currentState = p.dataset.state || '';
    bindOrders();
  });

  /* ---- 訂單詳細（中文狀態下拉，寫回英文） ---- */
  async function showOrderDetail(id){
    const wrap = $('#orderDetail', el);
    wrap.innerHTML = '載入中…';
    try{
      const ref = doc(db,'orders',id);
      const d = await getDoc(ref);
      if (!d.exists()) { wrap.innerHTML = '查無資料'; return; }
      const v = d.data();

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

        <div class="rowi mt-2"><div class="fw-semibold">小計</div><div>${money(v?.amounts?.subtotal)}</div></div>
        <div class="rowi mt-2"><div class="fw-semibold">運費</div><div>${money(v?.amounts?.shipping)}</div></div>
        <div class="rowi mt-2"><div class="fw-semibold">合計</div><div>${money(v?.amounts?.total)}</div></div>
      `;

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

  // 啟動
  bindOrders();
  return el;
}
