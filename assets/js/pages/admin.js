// assets/js/pages/admin.js
// 後台：歡迎/統計 + 進階訂單管理（搜尋／篩選／匯出 CSV），並將狀態改為彩色 Chips
// 依賴：assets/js/firebase.js

import { db, auth } from '../firebase.js'; // ← 加上 auth
import {
  collection, query, orderBy, limit, onSnapshot,
  doc, getDoc, updateDoc, serverTimestamp,
  where, getDocs, Timestamp, startAt, endAt
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';
import {
  signOut // ← 匯入登出
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';

/* ───────── 小工具 ───────── */
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const money = n => 'NT$ ' + (n || 0).toLocaleString();
const zh   = { pending:'待付款', paid:'已付款', shipped:'已出貨', canceled:'已取消' };
const en   = { '待付款':'pending', '已付款':'paid', '已出貨':'shipped', '已取消':'canceled' };
const shortId = id => (id||'').slice(0,10);
const toTW = ts => {
  try {
    const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
    return d ? d.toLocaleString('zh-TW',{hour12:false}) : '-';
  } catch { return '-'; }
};
const startOfToday = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const endOfToday   = () => { const d = new Date(); d.setHours(23,59,59,999); return d; };

/* ───────── 樣式（一次） ───────── */
function ensureAdminStyles(){
  if ($('#admin-css')) return;
  const css = document.createElement('style');
  css.id = 'admin-css';
  css.textContent = `
  :root{
    --bg:#0f1318; --fg:#e6e6e6; --muted:#9aa3af;
    --card:#151a21; --border:#2a2f37; --shadow:0 6px 24px rgba(0,0,0,.25), 0 2px 8px rgba(0,0,0,.2);
    --chip:#0b1220;
    --chip-pending:   rgba(245,158,11,.18);
    --chip-paid:      rgba(34,197,94,.20);
    --chip-shipped:   rgba(59,130,246,.20);
    --chip-canceled:  rgba(239,68,68,.18);
    --chip-ring:      rgba(255,255,255,.25);
  }
  body.light{
    --bg:#f6f8fc; --fg:#111; --muted:#6b7280;
    --card:#ffffff; --border:#e5e7eb; --shadow:0 12px 24px rgba(17,24,39,.06);
    --chip:#eef2ff;
    --chip-ring: rgba(0,0,0,.2);
  }
  .admin-shell{max-width:1200px;margin-inline:auto;padding:20px}

  /* Hero */
  .hero{background:linear-gradient(135deg, rgba(59,130,246,.15), rgba(168,85,247,.10));
        border:1px solid var(--border); border-radius:18px; padding:18px;
        display:flex; justify-content:space-between; align-items:center; margin-bottom:14px}
  .hero h5{margin:0; font-weight:800}
  .hero .sub{color:var(--muted)}
  .hero .act .btn{border-radius:12px}

  /* 今日概況 */
  .page-title{display:flex;align-items:center;gap:12px;margin:12px 0 12px}
  .page-title .badge{background:transparent;border:1px dashed var(--border);color:var(--muted)}
  .stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}
  @media (max-width:1200px){.stat-grid{grid-template-columns:repeat(2,1fr)}}
  @media (max-width:640px){.stat-grid{grid-template-columns:1fr}}
  .kcard{background:var(--card);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow)}
  .stat{padding:16px;border-radius:14px;display:flex;gap:14px;align-items:center}
  .ico{width:44px;height:44px;border-radius:10px;display:grid;place-items:center;font-size:20px}
  .ico-blue{background:rgba(59,130,246,.15);color:#93c5fd;border:1px solid rgba(59,130,246,.25)}
  .ico-green{background:rgba(34,197,94,.15);color:#86efac;border:1px solid rgba(34,197,94,.25)}
  .ico-amber{background:rgba(245,158,11,.15);color:#fcd34d;border:1px solid rgba(245,158,11,.25)}
  .ico-purple{background:rgba(168,85,247,.15);color:#e9d5ff;border:1px solid rgba(168,85,247,.25)}
  .meta{color:var(--muted);font-size:14px}
  .val{font-weight:800;font-size:20px;color:var(--fg)}

  /* 主體兩欄 */
  .admin-grid{display:grid;grid-template-columns:1fr 1fr; gap:18px}
  @media(max-width: 992px){ .admin-grid{grid-template-columns:1fr} }
  .kpad{padding:16px}
  .hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
  .hd-title{font-weight:800}

  /* 工具列（搜尋/篩選/匯出） */
  .toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
  .toolbar .form-control, .toolbar .form-select{min-width:160px}
  .toolbar .btn{white-space:nowrap}

  /* 列表卡片（深色卡） */
  .olist{display:flex;flex-direction:column;gap:12px}
  .orow{display:flex;align-items:center;justify-content:space-between; padding:16px;border:1px solid var(--border);border-radius:14px;cursor:pointer; transition:transform .15s ease, box-shadow .2s ease}
  .orow:hover{transform:translateY(-1px); box-shadow:0 10px 28px rgba(0,0,0,.3)}
  .o-left{display:flex;flex-direction:column;gap:4px}
  .o-line{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .o-id{font-weight:700}
  .o-badge{font-size:12px;border:1px solid var(--border);padding:.2rem .55rem;border-radius:999px;color:var(--muted)}
  .o-badge.pending  {background:var(--chip-pending); border-color:var(--chip-ring)}
  .o-badge.paid     {background:var(--chip-paid);    border-color:var(--chip-ring)}
  .o-badge.shipped  {background:var(--chip-shipped); border-color:var(--chip-ring)}
  .o-badge.canceled {background:var(--chip-canceled);border-color:var(--chip-ring)}
  .o-sub{color:var(--muted);font-size:13px}
  .o-time{font-size:12px;border:1px solid var(--border);background:var(--chip);color:var(--muted); padding:.25rem .6rem; border-radius:999px}

  /* 詳細區 + 狀態 Chips */
  .detail-title{font-weight:800;margin-bottom:6px}
  .kv{display:grid;grid-template-columns:120px 1fr; gap:6px 12px; margin-bottom:8px}
  .kv .k{color:var(--muted)}
  .table{margin-top:8px}

  .chips{display:flex;gap:8px;flex-wrap:wrap}
  .chip{
    border:1px solid var(--border);border-radius:999px;
    padding:.25rem .7rem; cursor:pointer; user-select:none; font-size:13px;
    background:var(--chip); color:var(--fg); transition:transform .06s ease;
  }
  .chip:hover{transform:translateY(-1px)}
  .chip.active{outline:2px solid var(--chip-ring)}
  .chip.pending  {background:var(--chip-pending)}
  .chip.paid     {background:var(--chip-paid)}
  .chip.shipped  {background:var(--chip-shipped)}
  .chip.canceled {background:var(--chip-canceled)}
  `;
  document.head.appendChild(css);
}

/* 亮/暗切換 */
function initThemeToggle(root){
  const btn = $('#themeToggle', root);
  const apply = mode => {
    document.body.classList.toggle('light', mode==='light');
    document.documentElement.classList.toggle('light', mode==='light');
  };
  const saved = localStorage.getItem('theme') || 'dark';
  apply(saved);
  btn?.addEventListener('click', ()=>{
    const now = document.body.classList.contains('light') ? 'dark' : 'light';
    apply(now);
    localStorage.setItem('theme', now);
  });
}

/* 登出（Google/Firebase） */
function initLogout(root){
  const btn = $('#btnLogout', root);
  if (!btn) return;
  btn.addEventListener('click', async ()=>{
    if (!confirm('確定要登出管理員帳號嗎？')) return;
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>登出中…';
    try{
      await signOut(auth);
      alert('已成功登出');
      location.hash = '#dashboard';
      location.reload();
    }catch(err){
      alert('登出失敗：' + err.message);
      btn.disabled = false;
      btn.innerHTML = original;
    }
  });
}

/* 今日統計 */
async function computeTodayStats(setters){
  const start = Timestamp.fromDate(startOfToday());
  const end   = Timestamp.fromDate(endOfToday());

  const qToday = query(collection(db,'orders'),
    where('createdAt','>=',start),
    where('createdAt','<=',end)
  );
  const sToday = await getDocs(qToday);
  let ordersCnt = 0, revenue = 0, waitShip = 0;
  sToday.forEach(d=>{
    const v = d.data()||{};
    ordersCnt += 1;
    revenue   += (v?.amounts?.total || 0);
    if ((v.status||'')==='paid') waitShip += 1; // 已付未出貨
  });

  const since = new Date(); since.setDate(since.getDate()-30);
  const q30 = query(collection(db,'orders'),
    where('createdAt','>=', Timestamp.fromDate(since)),
    orderBy('createdAt','desc'), limit(200)
  );
  const s30 = await getDocs(q30);
  const uniq = new Set();
  s30.forEach(d=>{
    const email = d.data()?.customer?.email || '';
    if (email) uniq.add(email.toLowerCase());
  });

  setters.orders(ordersCnt);
  setters.revenue(revenue);
  setters.ship(waitShip);
  setters.users(uniq.size);
}

/* 匯出 CSV（目前列表結果） */
function exportCSV(rows){
  const header = [
    '訂單ID','建立時間','狀態','客戶','Email','電話','品項數','合計'
  ];
  const data = rows.map(({id,v})=>{
    const items = (v.items||[]).reduce((s,i)=>s+(i.qty||0),0);
    return [
      id, toTW(v.createdAt), zh[v.status||'pending']||'-',
      v?.customer?.name||'', v?.customer?.email||'', v?.customer?.phone||'',
      items, (v?.amounts?.total||0)
    ];
  });
  const csv = [header, ...data].map(r=>r.map(x=>{
    const s = (x===undefined||x===null) ? '' : String(x);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  }).join(',')).join('\n');

  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
  a.download = `orders-${ts}.csv`;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  a.remove();
}

/* ───────── 版面與行為 ───────── */
export function AdminPage(){
  ensureAdminStyles();

  const el = document.createElement('div');
  el.className = 'admin-shell';
  el.innerHTML = `
    <!-- Hero（歡迎 + 按鈕） -->
    <div class="hero">
      <div>
        <h5>歡迎回來 👋</h5>
        <div class="sub">快速存取你的常用工具與最新狀態</div>
      </div>
      <div class="act">
        <button class="btn btn-outline-light me-2" id="themeToggle"><i class="bi bi-brightness-high me-1"></i>切換亮/暗</button>
        <button class="btn btn-outline-light me-2" data-go="#dashboard"><i class="bi bi-grid me-1"></i> 回首頁</button>
        <button class="btn btn-outline-danger" id="btnLogout"><i class="bi bi-box-arrow-right me-1"></i> 登出</button>
      </div>
    </div>

    <!-- 今日概況 -->
    <div class="page-title">
      <h6 class="m-0">今日概況</h6>
      <span class="badge rounded-pill px-2">更新於 <span id="dashTime"></span></span>
    </div>

    <div class="stat-grid">
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

    <!-- 主體：左列表 + 右詳細 -->
    <div class="admin-grid">

      <section class="kcard kpad">
        <div class="hd"><div class="hd-title">訂單列表</div></div>

        <!-- 工具列 -->
        <div class="toolbar">
          <input id="kw" class="form-control form-control-sm" placeholder="搜尋：訂單ID / 客戶 / Email">
          <select id="fStatus" class="form-select form-select-sm">
            <option value="">全部狀態</option>
            <option value="pending">待付款</option>
            <option value="paid">已付款</option>
            <option value="shipped">已出貨</option>
            <option value="canceled">已取消</option>
          </select>
          <input id="dateFrom" type="date" class="form-control form-control-sm" />
          <span class="align-self-center">～</span>
          <input id="dateTo" type="date" class="form-control form-control-sm" />
          <button id="btnApply" class="btn btn-sm btn-primary"><i class="bi bi-funnel me-1"></i>套用</button>
          <button id="btnReset" class="btn btn-sm btn-outline-secondary">清除</button>
          <div class="flex-grow-1"></div>
          <button id="btnCSV" class="btn btn-sm btn-outline-light"><i class="bi bi-download me-1"></i>匯出 CSV</button>
        </div>

        <div id="orderList" class="olist"><div class="o-sub">載入中…</div></div>
      </section>

      <section class="kcard kpad">
        <div class="hd"><div class="hd-title">訂單詳細</div></div>
        <div id="orderDetail" class="o-sub">左側點一筆查看</div>
      </section>

    </div>
  `;

  // 導航（按鈕 data-go）
  el.addEventListener('click', e=>{
    const go = e.target.closest('[data-go]');
    if (go) location.hash = go.getAttribute('data-go');
  });

  initThemeToggle(el);
  initLogout(el); // ← 綁定登出
  $('#dashTime', el).textContent = new Date().toLocaleString('zh-TW',{hour12:false});

  // 今日統計
  computeTodayStats({
    orders: n => $('#statOrders', el).textContent  = `${n} 筆`,
    revenue:n => $('#statRevenue', el).textContent = money(n),
    ship:   n => $('#statShip', el).textContent    = `${n} 筆`,
    users:  n => $('#statUsers', el).textContent   = `${n} 位`
  }).catch(()=>{});

  const listEl   = $('#orderList', el);
  const detailEl = $('#orderDetail', el);

  // 狀態 / 日期 / 關鍵字
  const refs = {
    kw: $('#kw', el),
    fStatus: $('#fStatus', el),
    from: $('#dateFrom', el),
    to: $('#dateTo', el),
    btnApply: $('#btnApply', el),
    btnReset: $('#btnReset', el),
    btnCSV: $('#btnCSV', el)
  };

  let unsub = null;
  let ordersCache = []; // [{id, v}]
  let currentQueryKey = '';

  function keyForQuery({status, from, to}){
    return JSON.stringify({status, from, to});
  }

  function bindOrders(){
    const status = refs.fStatus.value || '';
    const from   = refs.from.value ? new Date(refs.from.value + 'T00:00:00') : null;
    const toDate = refs.to.value   ? new Date(refs.to.value   + 'T23:59:59') : null;

    if (unsub){ unsub(); unsub = null; }
    listEl.innerHTML = '<div class="o-sub">載入中…</div>';

    try{
      let qBase = collection(db,'orders');

      const wheres = [];
      if (status) wheres.push(where('status','==',status));
      if (from)   wheres.push(where('createdAt','>=', Timestamp.fromDate(from)));
      if (toDate) wheres.push(where('createdAt','<=', Timestamp.fromDate(toDate)));

      if (wheres.length){
        qBase = query(qBase, ...wheres, orderBy('createdAt','desc'), limit(300));
      }else{
        qBase = query(qBase, orderBy('createdAt','desc'), limit(300));
      }

      const qKey = keyForQuery({status, from: refs.from.value, to: refs.to.value});
      currentQueryKey = qKey;

      unsub = onSnapshot(qBase, snap=>{
        if (currentQueryKey !== qKey) return;
        ordersCache = snap.docs.map(d=>({ id:d.id, v:d.data()||{} }));
        renderList();
      }, err=>{
        console.warn('Query failed, fallback to client filter', err);
        fallbackClient();
      });
    }catch(err){
      console.warn('Query build error, fallback', err);
      fallbackClient();
    }
  }

  function fallbackClient(){
    (unsub && unsub()); unsub = null;
    const baseQ = query(collection(db,'orders'), orderBy('createdAt','desc'), limit(300));
    onSnapshot(baseQ, snap=>{
      let arr = snap.docs.map(d=>({ id:d.id, v:d.data()||{} }));
      const status = refs.fStatus.value || '';
      const from   = refs.from.value ? new Date(refs.from.value + 'T00:00:00') : null;
      const toDate = refs.to.value   ? new Date(refs.to.value   + 'T23:59:59') : null;

      if (status) arr = arr.filter(x => (x.v.status||'')===status);
      if (from)   arr = arr.filter(x => (x.v.createdAt?.toDate?.()||new Date(0)) >= from);
      if (toDate) arr = arr.filter(x => (x.v.createdAt?.toDate?.()||new Date(0)) <= toDate);

      ordersCache = arr;
      renderList();
    });
  }

  function renderList(){
    const kw = refs.kw.value.trim().toLowerCase();
    let arr = ordersCache;
    if (kw){
      arr = arr.filter(({id,v})=>{
        const name  = (v?.customer?.name||'').toLowerCase();
        const email = (v?.customer?.email||'').toLowerCase();
        return id.toLowerCase().includes(kw) || name.includes(kw) || email.includes(kw);
      });
    }

    if (!arr.length){
      listEl.innerHTML = '<div class="o-sub">沒有符合條件的訂單</div>';
      return;
    }

    listEl.innerHTML = arr.map(({id,v})=>{
      const itemsCount = (v.items||[]).reduce((s,i)=>s+(i.qty||0),0);
      const total = money(v?.amounts?.total||0);
      const state = v.status||'pending';
      return `
        <div class="orow" data-id="${id}">
          <div class="o-left">
            <div class="o-line">
              <span class="o-id">#${shortId(id)}</span>
              <span class="o-badge ${state}">${zh[state]||'-'}</span>
              <span class="o-id">${total}</span>
            </div>
            <div class="o-sub">${v?.customer?.name||'-'} ｜ ${itemsCount} 件</div>
          </div>
          <span class="o-time">${toTW(v.createdAt)}</span>
        </div>`;
    }).join('');

    $$('.orow', listEl).forEach(r=>{
      r.addEventListener('click', ()=> showDetail(r.dataset.id));
    });

    refs.btnCSV.onclick = ()=> exportCSV(arr);
  }

  async function showDetail(id){
    detailEl.innerHTML = '載入中…';
    try{
      const ref = doc(db,'orders', id);
      const snap = await getDoc(ref);
      if (!snap.exists()){ detailEl.innerHTML = '查無資料'; return; }
      const v = snap.data()||{};

      const itemsRows = (v.items||[]).map(i=>`
        <tr>
          <td>${i.name||''}</td>
          <td>${i.sku||''}</td>
          <td class="text-end">${i.qty||0}</td>
          <td class="text-end">${money(i.price||0)}</td>
          <td class="text-end">${money((i.price||0)*(i.qty||0))}</td>
        </tr>`).join('');

      const state = v.status || 'pending';

      detailEl.innerHTML = `
        <div class="detail-title">#${snap.id}</div>

        <div class="kv">
          <div class="k">建立時間</div><div>${toTW(v.createdAt)}</div>

          <div class="k">狀態</div>
          <div>
            <div class="chips" id="stateChips">
              ${['pending','paid','shipped','canceled'].map(s=>`
                <span class="chip ${s} ${s===state?'active':''}" data-state="${s}">${zh[s]}</span>
              `).join('')}
              <button id="saveState" class="btn btn-sm btn-primary ms-2">儲存</button>
            </div>
          </div>

          <div class="k">客戶</div><div>${v?.customer?.name||'-'}</div>
          <div class="k">電話</div><div>${v?.customer?.phone||'-'}</div>
          <div class="k">Email</div><div>${v?.customer?.email||'-'}</div>
          <div class="k">配送</div><div>${v?.customer?.shipping||'-'} ｜ ${v?.customer?.address||'-'}</div>
          <div class="k">付款</div><div>${v?.customer?.payment||'-'}</div>
          <div class="k">備註</div><div>${v?.customer?.note||''}</div>
        </div>

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
            <tbody>${itemsRows}</tbody>
            <tfoot>
              <tr><th colspan="4" class="text-end">小計</th><th class="text-end">${money(v?.amounts?.subtotal||0)}</th></tr>
              <tr><th colspan="4" class="text-end">運費</th><th class="text-end">${money(v?.amounts?.shipping||0)}</th></tr>
              <tr><th colspan="4" class="text-end">合計</th><th class="text-end">${money(v?.amounts?.total||0)}</th></tr>
            </tfoot>
          </table>
        </div>
      `;

      let chosen = state;
      $$('#stateChips .chip', detailEl).forEach(c=>{
        c.addEventListener('click', ()=>{
          $$('#stateChips .chip', detailEl).forEach(x=>x.classList.remove('active'));
          c.classList.add('active');
          chosen = c.dataset.state;
        });
      });

      $('#saveState', detailEl).addEventListener('click', async ()=>{
        try{
          await updateDoc(ref, { status:chosen, updatedAt: serverTimestamp() });
          const row = $(`.orow[data-id="${id}"]`, listEl);
          if (row){
            const badge = row.querySelector('.o-badge');
            badge.className = `o-badge ${chosen}`;
            badge.textContent = zh[chosen];
          }
          alert('狀態已更新');
        }catch(err){
          alert('更新失敗：'+err.message);
        }
      });

    }catch(err){
      detailEl.innerHTML = `<div class="text-danger">讀取失敗：${err.message}</div>`;
    }
  }

  refs.btnApply.addEventListener('click', bindOrders);
  refs.btnReset.addEventListener('click', ()=>{
    refs.kw.value = '';
    refs.fStatus.value = '';
    refs.from.value = '';
    refs.to.value = '';
    bindOrders();
  });
  refs.kw.addEventListener('input', ()=> renderList());

  bindOrders();
  return el;
}
