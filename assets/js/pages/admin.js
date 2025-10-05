// assets/js/pages/admin.js
// 後台首頁（Hero 保留）＋ 三個大卡片切換模組：用戶記帳 / 用戶登入紀錄 / 訂單管理
// 依賴：assets/js/firebase.js（輸出 auth / db）

import { auth, db } from '../firebase.js';
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';

import {
  collection, addDoc, query, orderBy, limit, onSnapshot,
  doc, getDoc, updateDoc, serverTimestamp,
  where, getDocs, Timestamp,
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

/* ───────── 小工具 ───────── */
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const money = n => 'NT$ ' + (Number(n) || 0).toLocaleString();
const zh   = { pending:'待付款', paid:'已付款', shipped:'已出貨', canceled:'已取消' };
const shortId = id => (id||'').slice(0,10);
const toTW = ts => {
  try {
    const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
    return d ? d.toLocaleString('zh-TW',{hour12:false}) : '-';
  } catch { return '-'; }
};

/* ───────── 白名單 ───────── */
const ADMIN_EMAILS = ['bruce9811123@gmail.com'].map(s => s.trim().toLowerCase());
const ADMIN_UIDS = []; // 需要可填 uid

function isAdminUser(user) {
  if (!user) return false;
  const email = (user.email || '').trim().toLowerCase();
  const uid = user.uid || '';
  return ADMIN_UIDS.includes(uid) || ADMIN_EMAILS.includes(email);
}

/* ───────── 樣式（首頁 + 卡片 + 模組容器） ───────── */
function ensureAdminStyles(){
  if ($('#admin-css')) return;
  const css = document.createElement('style');
  css.id = 'admin-css';
  css.textContent = `
  :root{
    --bg:#0f1318; --fg:#e6e6e6; --muted:#9aa3af;
    --card:#151a21; --border:#2a2f37; --shadow:0 6px 24px rgba(0,0,0,.25), 0 2px 8px rgba(0,0,0,.2);
    --chip:#0b1220;
    --chip-pending:rgba(245,158,11,.20);
    --chip-paid:rgba(34,197,94,.20);
    --chip-shipped:rgba(59,130,246,.20);
    --chip-canceled:rgba(239,68,68,.22);
    --chip-ring:rgba(255,255,255,.25);
  }
  body,html{ background:var(--bg); color:var(--fg); }
  body.light{
    --bg:#f6f8fc; --fg:#111; --muted:#6b7280;
    --card:#ffffff; --border:#e5e7eb; --shadow:0 12px 24px rgba(17,24,39,.06);
    --chip:#eef2ff; --chip-ring:rgba(0,0,0,.15);
  }
  .admin-shell{max-width:1200px;margin-inline:auto;padding:20px}

  /* Hero */
  .hero{
    background:linear-gradient(135deg, rgba(59,130,246,.15), rgba(168,85,247,.10));
    border:1px solid var(--border); border-radius:18px; padding:18px;
    display:flex; justify-content:space-between; align-items:center; margin-bottom:14px
  }
  .hero h5{margin:0;font-weight:800}
  .hero .sub{color:var(--muted)}
  .hero .act .btn{border-radius:12px}

  /* 三大選項卡片（模組入口） */
  .why-wrap{margin:14px 0 18px}
  .why-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
  .why-title{font-weight:800;font-size:18px}
  .why-sub{color:var(--muted);font-size:14px}
  .why-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
  @media(max-width:992px){.why-grid{grid-template-columns:1fr}}
  .feature{
    background:var(--card); border:1px solid var(--border); border-radius:16px;
    box-shadow:var(--shadow); padding:18px; transition:all .2s ease; cursor:pointer
  }
  .feature:hover{ transform:translateY(-2px); box-shadow:0 8px 20px rgba(0,0,0,.3) }
  .feature.active{ outline:2px solid var(--chip-ring) }
  .f-ico{
    width:48px;height:48px;border-radius:12px;display:grid;place-items:center;font-size:22px;
    background:rgba(148,163,184,.15); color:#cbd5e1; border:1px solid rgba(148,163,184,.25)
  }
  .f-title{margin:10px 0 6px;font-weight:800}
  .f-desc{color:var(--muted);line-height:1.7}

  /* 內頁容器 */
  .module-host{ margin-top:16px }
  .kcard{background:var(--card);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow)}
  .kpad{padding:16px}
  .hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
  .hd-title{font-weight:800}

  /* 訂單 chips、列表等（沿用原樣式） */
  .olist{display:flex;flex-direction:column;gap:12px}
  .orow{display:flex;align-items:center;justify-content:space-between; padding:16px;border:1px solid var(--border);border-radius:14px;cursor:pointer; transition:transform .15s ease, box-shadow .2s ease}
  .orow:hover{transform:translateY(-1px); box-shadow:0 10px 28px rgba(0,0,0,.3)}
  .o-left{display:flex;flex-direction:column;gap:4px}
  .o-line{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .o-id{font-weight:700}
  .o-badge{font-size:12px;border:1px solid var(--border);padding:.2rem .55rem;border-radius:999px;color:var(--fg)}
  .o-badge.pending  {background:var(--chip-pending)}
  .o-badge.paid     {background:var(--chip-paid)}
  .o-badge.shipped  {background:var(--chip-shipped)}
  .o-badge.canceled {background:var(--chip-canceled)}
  .o-sub{color:var(--muted);font-size:13px}
  .o-time{font-size:12px;border:1px solid var(--border);background:var(--chip);color:var(--muted); padding:.25rem .6rem; border-radius:999px}
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

/* 登入畫面（Google） */
function showLogin(el, msg='請先使用 Google 登入才能進入後台', currentUser=null){
  const email = (currentUser?.email || '').trim();
  const uid = currentUser?.uid || '';
  el.innerHTML = `
    <div class="admin-shell">
      <div class="kcard kpad" style="max-width:520px">
        <div class="hd-title mb-2">${msg}</div>
        ${email || uid ? `<div class="text-body-secondary">目前登入：${email || '(無 email)'}　UID：${uid}</div>` : ''}
        <div class="mt-3 d-flex gap-2">
          <button id="googleLogin" class="btn btn-primary">使用 Google 登入</button>
          <a class="btn btn-outline-light" href="#dashboard">回首頁</a>
        </div>
        <div id="loginErr" class="text-danger small mt-2"></div>
      </div>
    </div>
  `;
  const provider = new GoogleAuthProvider();
  $('#googleLogin', el)?.addEventListener('click', async ()=>{
    $('#loginErr', el).textContent = '';
    try{
      await signInWithPopup(auth, provider);
    }catch(err){
      if (['auth/popup-blocked','auth/cancelled-popup-request'].includes(err?.code)) {
        try { await signInWithRedirect(auth, provider); }
        catch (e2) { $('#loginErr', el).textContent = e2.message || '登入失敗'; }
      } else {
        $('#loginErr', el).textContent = err.message || '登入失敗';
      }
    }
  });
}

/* ───────── 模組：用戶登入紀錄 ───────── */
function renderLoginLogModule(){
  const el = document.createElement('section');
  el.className = 'kcard kpad';
  el.innerHTML = `
    <div class="hd"><div class="hd-title">用戶登入紀錄</div></div>
    <div class="table-responsive">
      <table class="table table-sm align-middle">
        <thead><tr><th>時間</th><th>姓名</th><th>Email</th><th>UID</th><th>來源</th></tr></thead>
        <tbody id="logRows"><tr><td colspan="5">載入中…</td></tr></tbody>
      </table>
    </div>
  `;

  const rows = $('#logRows', el);
  const qy = query(collection(db,'admin_logins'), orderBy('at','desc'), limit(200));
  onSnapshot(qy, snap=>{
    if (snap.empty){ rows.innerHTML = `<tr><td colspan="5">尚無資料</td></tr>`; return; }
    rows.innerHTML = snap.docs.map(d=>{
      const v = d.data()||{};
      return `<tr>
        <td>${toTW(v.at)}</td>
        <td>${v.name||'-'}</td>
        <td>${v.email||'-'}</td>
        <td class="text-truncate" style="max-width:220px">${v.uid||''}</td>
        <td>${v.path||'-'}</td>
      </tr>`;
    }).join('');
  });

  return el;
}

/* ───────── 模組：用戶記帳（簡易入/出帳 + 最近紀錄） ───────── */
function renderLedgerModule(){
  const el = document.createElement('section');
  el.className = 'kcard kpad';
  el.innerHTML = `
    <div class="hd"><div class="hd-title">用戶記帳</div></div>
    <form id="ledgerForm" class="row g-2">
      <div class="col-md-3"><input name="customer" class="form-control form-control-sm" placeholder="客戶名稱" required></div>
      <div class="col-md-2">
        <select name="type" class="form-select form-select-sm">
          <option value="in">收入</option>
          <option value="out">支出</option>
        </select>
      </div>
      <div class="col-md-2"><input name="amount" type="number" step="1" class="form-control form-control-sm" placeholder="金額" required></div>
      <div class="col-md-4"><input name="note" class="form-control form-control-sm" placeholder="備註（可空）"></div>
      <div class="col-md-1 d-grid"><button class="btn btn-sm btn-primary">新增</button></div>
    </form>

    <div class="table-responsive mt-3">
      <table class="table table-sm align-middle">
        <thead><tr><th>時間</th><th>客戶</th><th>類型</th><th class="text-end">金額</th><th>備註</th><th>建立者</th></tr></thead>
        <tbody id="ledgerRows"><tr><td colspan="6">載入中…</td></tr></tbody>
      </table>
    </div>
  `;

  // 新增
  $('#ledgerForm', el).addEventListener('submit', async (e)=>{
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target).entries());
    const user = auth.currentUser || {};
    await addDoc(collection(db,'ledger'), {
      customer: f.customer || '',
      type: f.type || 'in',
      amount: Number(f.amount)||0,
      note: f.note || '',
      at: serverTimestamp(),
      by: { uid:user.uid||'', name:user.displayName||'', email:user.email||'' }
    });
    e.target.reset();
  });

  // 列表
  const rows = $('#ledgerRows', el);
  const qy = query(collection(db,'ledger'), orderBy('at','desc'), limit(100));
  onSnapshot(qy, snap=>{
    if (snap.empty){ rows.innerHTML = `<tr><td colspan="6">尚無資料</td></tr>`; return; }
    rows.innerHTML = snap.docs.map(d=>{
      const v = d.data()||{};
      const sign = v.type==='out' ? '-' : '+';
      return `<tr>
        <td>${toTW(v.at)}</td>
        <td>${v.customer||'-'}</td>
        <td>${v.type==='out'?'支出':'收入'}</td>
        <td class="text-end">${sign}${money(Math.abs(v.amount||0))}</td>
        <td>${v.note||''}</td>
        <td>${(v.by?.name||'') || (v.by?.email||'')}</td>
      </tr>`;
    }).join('');
  });

  return el;
}

/* ───────── 模組：訂單管理（將你原本的程式碼「原封不動」包成函式） ───────── */
function renderOrdersModule(){
  const el = document.createElement('div');

  // ======= 以下是你給的訂單管理程式碼，除了外層包起來，其餘「原封不動」=======
  // 只有少數地方把目標 root 改為 el（不影響功能），其餘邏輯/樣式不動

  // 今日統計
  const startOfToday = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
  const endOfToday   = () => { const d = new Date(); d.setHours(23,59,59,999); return d; };
  async function computeTodayStats(setters){
    const start = Timestamp.fromDate(startOfToday());
    const end   = Timestamp.fromDate(endOfToday());
    const qToday = query(collection(db,'orders'), where('createdAt','>=',start), where('createdAt','<=',end));
    const sToday = await getDocs(qToday);
    let ordersCnt = 0, revenue = 0, waitShip = 0;
    sToday.forEach(d=>{
      const v = d.data()||{};
      ordersCnt += 1;
      revenue   += (v?.amounts?.total || 0);
      if ((v.status||'')==='paid') waitShip += 1;
    });
    const since = new Date(); since.setDate(since.getDate()-30);
    const q30 = query(collection(db,'orders'), where('createdAt','>=', Timestamp.fromDate(since)), orderBy('createdAt','desc'), limit(200));
    const s30 = await getDocs(q30);
    const uniq = new Set();
    s30.forEach(d=>{ const email = d.data()?.customer?.email || ''; if (email) uniq.add(email.toLowerCase()); });
    setters.orders(ordersCnt); setters.revenue(revenue); setters.ship(waitShip); setters.users(uniq.size);
  }

  // UI（保留原結構）
  el.innerHTML = `
    <!-- 今日概況 -->
    <div class="page-title">
      <h6 class="m-0">今日概況</h6>
      <span class="badge rounded-pill px-2">更新於 <span id="dashTime"></span></span>
    </div>
    <div class="stat-grid">
      <div class="kcard kpad stat"><div class="ico" style="background:rgba(59,130,246,.15);color:#93c5fd;border:1px solid rgba(59,130,246,.25)"><i class="bi bi-bag-check"></i></div><div><div class="text-body-secondary">今日訂單</div><div class="fw-bold fs-5" id="statOrders">—</div></div></div>
      <div class="kcard kpad stat"><div class="ico" style="background:rgba(34,197,94,.15);color:#86efac;border:1px solid rgba(34,197,94,.25)"><i class="bi bi-currency-dollar"></i></div><div><div class="text-body-secondary">今日營收</div><div class="fw-bold fs-5" id="statRevenue">—</div></div></div>
      <div class="kcard kpad stat"><div class="ico" style="background:rgba(245,158,11,.15);color:#fcd34d;border:1px solid rgba(245,158,11,.25)"><i class="bi bi-receipt"></i></div><div><div class="text-body-secondary">待出貨</div><div class="fw-bold fs-5" id="statShip">—</div></div></div>
      <div class="kcard kpad stat"><div class="ico" style="background:rgba(168,85,247,.15);color:#e9d5ff;border:1px solid rgba(168,85,247,.25)"><i class="bi bi-people"></i></div><div><div class="text-body-secondary">常用客戶</div><div class="fw-bold fs-5" id="statUsers">—</div></div></div>
    </div>

    <!-- 主體：左列表 + 右詳細 -->
    <div class="admin-grid">
      <section class="kcard kpad">
        <div class="hd"><div class="hd-title">訂單列表</div></div>
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

  $('#dashTime', el).textContent = new Date().toLocaleString('zh-TW',{hour12:false});
  computeTodayStats({
    orders:n=>$('#statOrders', el).textContent=`${n} 筆`,
    revenue:n=>$('#statRevenue', el).textContent=money(n),
    ship:n=>$('#statShip', el).textContent=`${n} 筆`,
    users:n=>$('#statUsers', el).textContent=`${n} 位`,
  });

  const refs = {
    kw: $('#kw', el), fStatus: $('#fStatus', el),
    from: $('#dateFrom', el), to: $('#dateTo', el),
    btnApply: $('#btnApply', el), btnReset: $('#btnReset', el), btnCSV: $('#btnCSV', el),
  };
  const listEl   = $('#orderList', el);
  const detailEl = $('#orderDetail', el);
  let unsub = null; let ordersCache = []; let qKey = '';
  const makeKey = ()=>JSON.stringify({s:refs.fStatus.value,f:refs.from.value,t:refs.to.value});

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
      refs.btnCSV.onclick = ()=> exportCSV([]);
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
    $$('.orow', listEl).forEach(r=>r.addEventListener('click', ()=> showDetail(r.dataset.id)));
    refs.btnCSV.onclick = ()=> exportCSV(arr);
  }

  function exportCSV(rows){
    const header = ['訂單ID','建立時間','狀態','客戶','Email','電話','品項數','合計'];
    const data = rows.map(({id,v})=>{
      const items = (v.items||[]).reduce((s,i)=>s+(i.qty||0),0);
      return [ id, toTW(v.createdAt), zh[v.status||'pending']||'-',
        v?.customer?.name||'', v?.customer?.email||'', v?.customer?.phone||'',
        items, (v?.amounts?.total||0) ];
    });
    const csv = [header, ...data].map(r=>r.map(x=>{
      const s = (x===undefined||x===null) ? '' : String(x);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
    }).join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'}); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-'); a.download = 'orders-' + ts + '.csv';
    document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); a.remove();
  }

  async function showDetail(id){
    detailEl.innerHTML = '載入中…';
    try{
      const ref = doc(db,'orders', id);
      const snap = await getDoc(ref);
      if (!snap.exists()){ detailEl.innerHTML = '查無資料'; return; }
      const v = snap.data()||{}; const state = v.status || 'pending';
      const itemsRows = (v.items||[]).map(i=>`
        <tr>
          <td>${i.name||''}</td><td>${i.sku||''}</td>
          <td class="text-end">${i.qty||0}</td>
          <td class="text-end">${money(i.price||0)}</td>
          <td class="text-end">${money((i.price||0)*(i.qty||0))}</td>
        </tr>`).join('');
      detailEl.innerHTML = `
        <div class="fw-bold mb-1">#${snap.id}</div>
        <div class="mb-2 text-body-secondary">建立時間：${toTW(v.createdAt)}</div>
        <div class="mb-2">
          <div class="chips" id="stateChips">
            ${['pending','paid','shipped','canceled'].map(s=>`
              <span class="o-badge ${s} ${s===state?'active':''}" data-state="${s}" style="cursor:pointer">${zh[s]}</span>`).join('')}
            <button id="saveState" class="btn btn-sm btn-primary ms-2">儲存</button>
          </div>
        </div>
        <div class="mb-2">客戶：${v?.customer?.name||'-'}　電話：${v?.customer?.phone||'-'}　Email：${v?.customer?.email||'-'}</div>
        <div class="mb-2">配送：${v?.customer?.shipping||'-'} ｜ ${v?.customer?.address||'-'}</div>
        <div class="mb-2">付款：${v?.customer?.payment||'-'}</div>
        <div class="mb-3">備註：${v?.customer?.note||''}</div>
        <div class="table-responsive">
          <table class="table table-sm align-middle">
            <thead><tr><th>名稱</th><th>SKU</th><th class="text-end">數量</th><th class="text-end">單價</th><th class="text-end">小計</th></tr></thead>
            <tbody>${itemsRows}</tbody>
            <tfoot>
              <tr><th colspan="4" class="text-end">小計</th><th class="text-end">${money(v?.amounts?.subtotal||0)}</th></tr>
              <tr><th colspan="4" class="text-end">運費</th><th class="text-end">${money(v?.amounts?.shipping||0)}</th></tr>
              <tr><th colspan="4" class="text-end">合計</th><th class="text-end">${money(v?.amounts?.total||0)}</th></tr>
            </tfoot>
          </table>
        </div>`;
      let chosen = state;
      $$('#stateChips .o-badge', detailEl).forEach(c=>{
        c.addEventListener('click', ()=>{ $$('#stateChips .o-badge', detailEl).forEach(x=>x.classList.remove('active')); c.classList.add('active'); chosen = c.dataset.state; });
      });
      $('#saveState', detailEl).addEventListener('click', async ()=>{
        try{
          await updateDoc(ref, { status:chosen, updatedAt: serverTimestamp() });
          const row = $(`.orow[data-id="${id}"]`, el);
          if (row){ const badge = row.querySelector('.o-badge'); badge.className = `o-badge ${chosen}`; badge.textContent = zh[chosen]; }
          alert('狀態已更新');
        }catch(err){ alert('更新失敗：'+err.message); }
      });
    }catch(err){ detailEl.innerHTML = `<div class="text-danger">讀取失敗：${err.message}</div>`; }
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
      qBase = wheres.length
        ? query(qBase, ...wheres, orderBy('createdAt','desc'), limit(300))
        : query(qBase, orderBy('createdAt','desc'), limit(300));

      qKey = makeKey();
      unsub = onSnapshot(qBase, snap=>{
        if (makeKey() !== qKey) return;
        ordersCache = snap.docs.map(d=>({ id:d.id, v:d.data()||{} }));
        renderList();
      }, ()=>{
        // backup
        const baseQ = query(collection(db,'orders'), orderBy('createdAt','desc'), limit(300));
        onSnapshot(baseQ, sp=>{
          let arr = sp.docs.map(d=>({ id:d.id, v:d.data()||{} }));
          if (status) arr = arr.filter(x => (x.v.status||'')===status);
          if (from)   arr = arr.filter(x => (x.v.createdAt?.toDate?.()||new Date(0)) >= from);
          if (toDate) arr = arr.filter(x => (x.v.createdAt?.toDate?.()||new Date(0)) <= toDate);
          ordersCache = arr; renderList();
        });
      });
    }catch{
      const baseQ = query(collection(db,'orders'), orderBy('createdAt','desc'), limit(300));
      onSnapshot(baseQ, snap=>{ ordersCache = snap.docs.map(d=>({ id:d.id, v:d.data()||{} })); renderList(); });
    }
  }

  const makeKey = ()=>JSON.stringify({s:refs.fStatus.value,f:refs.from.value,t:refs.to.value});
  refs.btnApply.addEventListener('click', bindOrders);
  refs.btnReset.addEventListener('click', ()=>{ refs.kw.value=''; refs.fStatus.value=''; refs.from.value=''; refs.to.value=''; bindOrders(); });
  refs.kw.addEventListener('input', ()=> renderList());
  bindOrders();

  return el;
}

/* ───────── 主畫面（Hero + 三大選項 + 模組容器） ───────── */
function renderUI(user){
  ensureAdminStyles();

  const root = document.createElement('div');
  root.className = 'admin-shell';
  root.innerHTML = `
    <div class="hero">
      <div>
        <h5>歡迎回來 👋</h5>
        <div class="sub">一站式工作面板，省時又省力</div>
      </div>
      <div class="act">
        <button class="btn btn-outline-light me-2" id="themeToggle">切換亮/暗</button>
        <button class="btn btn-outline-light me-2" data-go="#dashboard">回首頁</button>
        <button class="btn btn-outline-danger" id="btnLogout">登出</button>
      </div>
    </div>

    <div class="why-wrap">
      <div class="why-head">
        <div class="why-title">我要做什麼？</div>
        <div class="why-sub">點選下面一張卡片切換功能模組</div>
      </div>
      <div class="why-grid">
        <div class="feature" data-module="ledger">
          <div class="f-ico">🧾</div>
          <div class="f-title">用戶記帳</div>
          <div class="f-desc">快速記錄收入/支出，追蹤最近交易。</div>
        </div>
        <div class="feature" data-module="log">
          <div class="f-ico">🔐</div>
          <div class="f-title">用戶登入紀錄</div>
          <div class="f-desc">查看誰在什麼時間登入平台，含姓名與 Email。</div>
        </div>
        <div class="feature active" data-module="orders">
          <div class="f-ico">📦</div>
          <div class="f-title">訂單管理</div>
          <div class="f-desc">搜尋/篩選/匯出 CSV，更新訂單狀態。</div>
        </div>
      </div>
    </div>

    <div class="module-host" id="moduleHost"></div>
  `;

  initThemeToggle(root);

  $('#btnLogout', root)?.addEventListener('click', async ()=>{
    if (!confirm('確定要登出嗎？')) return;
    try{ await signOut(auth); }catch(err){ alert('登出失敗：' + err.message); }
  });

  // 模組切換
  const host = $('#moduleHost', root);
  const mount = (mod)=>{
    host.innerHTML = '';
    if (mod==='ledger') host.appendChild(renderLedgerModule());
    else if (mod==='log') host.appendChild(renderLoginLogModule());
    else host.appendChild(renderOrdersModule());
    // 切換選中樣式
    $$('.feature', root).forEach(c=>c.classList.toggle('active', c.dataset.module===mod));
  };
  // 預設打開 訂單管理
  mount('orders');

  root.addEventListener('click', (e)=>{
    const card = e.target.closest('.feature');
    if (card) mount(card.dataset.module);
  });

  // 記錄本次登入（一次）
  if (user){
    addDoc(collection(db,'admin_logins'), {
      at: serverTimestamp(),
      uid: user.uid || '',
      email: user.email || '',
      name: user.displayName || '',
      path: location.pathname + location.hash
    }).catch(()=>{});
  }

  return root;
}

/* ───────── 導出口：處理 Google 登入與白名單 ───────── */
export function AdminPage(){
  ensureAdminStyles();
  const root = document.createElement('div');
  root.innerHTML = '<div class="admin-shell"><div class="kcard kpad">載入中…</div></div>';

  getRedirectResult(auth).catch(()=>{});
  onAuthStateChanged(auth, (user)=>{
    if (!user) { showLogin(root, '請先使用 Google 登入才能進入後台'); return; }
    if (!isAdminUser(user)) { showLogin(root, '你不符合管理員帳號', user); return; }
    const ui = renderUI(user);
    root.replaceChildren(ui);
  });

  return root;
}
