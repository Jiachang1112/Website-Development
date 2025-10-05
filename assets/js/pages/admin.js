// assets/js/pages/admin.js
// 首頁三選項：用戶記帳｜用戶登入（用戶 / 管理員 兩選項）｜訂單管理

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
  collection, query, orderBy, limit, onSnapshot,
  addDoc, serverTimestamp, where, getDocs, Timestamp,
  doc, getDoc, updateDoc
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

/* ───────── 共用工具 ───────── */
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const toTW = ts => {
  try {
    const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
    return d ? d.toLocaleString('zh-TW',{hour12:false}) : '-';
  } catch { return '-'; }
};

/* ───────── 管理員白名單 ───────── */
const ADMIN_EMAILS = ['bruce9811123@gmail.com'].map(s=>s.trim().toLowerCase());
const ADMIN_UIDS   = []; // 如需以 UID 白名單，可補上

function isAdmin(user){
  if(!user) return false;
  const email = (user.email||'').trim().toLowerCase();
  return ADMIN_EMAILS.includes(email) || ADMIN_UIDS.includes(user.uid||'');
}

/* ───────── 首頁樣式（簡潔、不要把整站變黑） ───────── */
function ensureHomeStyles(){
  if ($('#home-css')) return;
  const css = document.createElement('style');
  css.id = 'home-css';
  css.textContent = `
  :root{--bg:#0f1318;--fg:#e6e6e6;--border:#2a2f37;--card:#151a21}
  body{background:var(--bg);color:var(--fg);margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto}
  .admin-shell{max-width:1000px;margin:auto;padding:28px}
  .hero{background:linear-gradient(135deg, rgba(59,130,246,.15), rgba(168,85,247,.10));
        border:1px solid var(--border);border-radius:18px;padding:20px;
        display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}
  .hero h5{margin:0;font-weight:800}
  .muted{color:#9aa3af}
  .btn{background:none;border:1px solid #e6e6e6;color:#e6e6e6;border-radius:10px;padding:6px 12px;cursor:pointer}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
  .card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px;cursor:pointer;transition:.2s}
  .card:hover{border-color:#60a5fa;transform:translateY(-2px)}
  .card h4{margin:0 0 6px 0}
  .backbar{display:flex;gap:8px;margin-bottom:12px}
  .table-wrap{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:14px}
  .toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 14px}
  input, select{background:#0f1318;border:1px solid #2a2f37;color:#e6e6e6;border-radius:8px;padding:6px 10px}
  .chip{border:1px solid #2a2f37;border-radius:999px;padding:.25rem .7rem;background:#0b1220}
  table{width:100%;border-collapse:collapse}
  th,td{border-bottom:1px solid #2a2f37;padding:8px 10px;text-align:left}
  th{color:#9aa3af;font-weight:700}
  .tabs{display:flex;gap:8px}
  .tab{border:1px solid var(--border);border-radius:999px;padding:.35rem .8rem;cursor:pointer}
  .tab.active{outline:2px solid rgba(255,255,255,.25)}
  `;
  document.head.appendChild(css);
}

/* ───────── 登入畫面 ───────── */
function showLogin(root){
  const el = document.createElement('div');
  el.className = 'admin-shell';
  el.innerHTML = `
    <div class="card" style="text-align:center">
      <h3>管理員登入</h3>
      <p class="muted">請使用 Google 登入進入後台</p>
      <button id="googleLogin" class="btn">使用 Google 登入</button>
      <div id="loginErr" class="muted" style="margin-top:8px;color:#ef4444"></div>
    </div>
  `;
  root.replaceChildren(el);

  const provider = new GoogleAuthProvider();
  $('#googleLogin', el)?.addEventListener('click', async ()=>{
    try{ await signInWithPopup(auth, provider); }
    catch(err){
      if(err?.code==='auth/popup-blocked' || err?.code==='auth/cancelled-popup-request'){
        await signInWithRedirect(auth, provider);
      }else{
        $('#loginErr', el).textContent = err.message || '登入失敗';
      }
    }
  });
}

/* ───────── 首頁（3 選項）───────── */
function renderHome(root){
  ensureHomeStyles();
  const el = document.createElement('div');
  el.className = 'admin-shell';
  el.innerHTML = `
    <div class="hero">
      <div>
        <h5>歡迎回來 👋</h5>
        <div class="muted">請選擇要進入的管理項目</div>
      </div>
      <button id="logoutBtn" class="btn">登出</button>
    </div>

    <div class="grid">
      <div class="card" id="ledgerCard">
        <h4>用戶記帳</h4>
        <div class="muted">查看或管理用戶的記帳紀錄</div>
      </div>

      <div class="card" id="loginLogCard">
        <h4>用戶登入</h4>
        <div class="muted">查看誰在何時登入此平台（用戶 / 管理員）</div>
      </div>

      <div class="card" id="ordersCard">
        <h4>訂單管理</h4>
        <div class="muted">查看與管理用戶訂單</div>
      </div>
    </div>
  `;

  // 登出
  $('#logoutBtn', el)?.addEventListener('click', async ()=>{
    if(confirm('確定要登出嗎？')){
      try{ await signOut(auth); }catch(e){ alert('登出失敗：'+e.message); }
    }
  });

  // 用戶記帳（先佔位）
  $('#ledgerCard', el)?.addEventListener('click', ()=>{
    alert('👉 用戶記帳：之後幫你接功能');
  });

  // 用戶登入紀錄
  $('#loginLogCard', el)?.addEventListener('click', ()=>{
    mountLoginLogModule(root);
  });

  // 訂單管理（載入原頁）
  $('#ordersCard', el)?.addEventListener('click', ()=>{
    mountOrdersModule(root);
  });

  root.replaceChildren(el);
}

/* ───────── 登入紀錄：寫入（新增 kind） ───────── */
async function logUserLogin(user, kind='admin'){
  try{
    const payload = {
      kind, // 'user' | 'admin'
      uid: user?.uid || '',
      email: user?.email || '',
      displayName: user?.displayName || '',
      providerId: user?.providerData?.[0]?.providerId || 'google',
      userAgent: navigator.userAgent || '',
      createdAt: serverTimestamp()
    };
    await addDoc(collection(db,'login_logs'), payload);
  }catch(e){
    console.warn('login log write failed', e);
  }
}

/* ───────── 登入紀錄：瀏覽模組（兩選項） ───────── */
function mountLoginLogModule(root){
  ensureHomeStyles();
  const el = document.createElement('div');
  el.className = 'admin-shell';
  el.innerHTML = `
    <div class="backbar">
      <button id="backHome" class="btn">&larr; 返回選單</button>
    </div>

    <div class="hero">
      <div>
        <h5>用戶登入紀錄</h5>
        <div class="muted">即時顯示最近登入的使用者（最多 500 筆）</div>
      </div>
      <div class="tabs">
        <div class="tab active" data-kind="user">用戶登入</div>
        <div class="tab" data-kind="admin">管理員登入</div>
      </div>
    </div>

    <div class="table-wrap">
      <div class="toolbar">
        <input id="kw" placeholder="搜尋：姓名 / Email / UID">
        <input id="from" type="date">
        <span class="muted">～</span>
        <input id="to" type="date">
        <button id="btnReset" class="btn">清除</button>
        <div style="flex:1"></div>
        <button id="btnCSV" class="btn">匯出 CSV</button>
      </div>

      <div style="overflow:auto">
        <table>
          <thead>
            <tr>
              <th>時間</th>
              <th>姓名</th>
              <th>Email</th>
              <th>UID</th>
              <th>Provider</th>
              <th>User-Agent</th>
            </tr>
          </thead>
          <tbody id="rows"><tr><td colspan="6" class="muted">載入中…</td></tr></tbody>
        </table>
      </div>
    </div>
  `;

  $('#backHome', el)?.addEventListener('click', ()=> renderHome(root));
  root.replaceChildren(el);

  const refs = {
    kw:   $('#kw', el),
    from: $('#from', el),
    to:   $('#to', el),
    btnReset: $('#btnReset', el),
    btnCSV:   $('#btnCSV', el),
    rows: $('#rows', el),
    tabs: $$('.tab', el),
  };

  let cache = []; // {id, v}
  let currentKind = 'user';
  let unsub = null;

  function bind(){
    if (unsub){ unsub(); unsub = null; }
    refs.rows.innerHTML = `<tr><td colspan="6" class="muted">載入中…</td></tr>`;

    // 依 kind 查詢
    const wheres = [ where('kind','==', currentKind) ];
    const qBase = query(collection(db,'login_logs'), ...wheres, orderBy('createdAt','desc'), limit(500));

    unsub = onSnapshot(qBase, (snap)=>{
      cache = snap.docs.map(d=>({id:d.id, v:d.data()||{}}));
      render();
    }, (err)=>{
      refs.rows.innerHTML = `<tr><td colspan="6" style="color:#ef4444">讀取失敗：${err.message}</td></tr>`;
    });
  }

  function render(){
    let arr = cache;
    const kw = (refs.kw.value||'').trim().toLowerCase();
    if (kw){
      arr = arr.filter(({v})=>{
        return (v.displayName||'').toLowerCase().includes(kw) ||
               (v.email||'').toLowerCase().includes(kw) ||
               (v.uid||'').toLowerCase().includes(kw);
      });
    }
    const from = refs.from.value ? new Date(refs.from.value+'T00:00:00') : null;
    const to   = refs.to.value   ? new Date(refs.to.value  +'T23:59:59') : null;
    if (from) arr = arr.filter(({v})=> (v.createdAt?.toDate?.()||new Date(0)) >= from);
    if (to)   arr = arr.filter(({v})=> (v.createdAt?.toDate?.()||new Date(0)) <= to);

    if (!arr.length){
      refs.rows.innerHTML = `<tr><td colspan="6" class="muted">沒有符合條件的資料</td></tr>`;
      refs.btnCSV.onclick = ()=> exportCSV([]);
      return;
    }

    refs.rows.innerHTML = arr.map(({v})=>`
      <tr>
        <td>${toTW(v.createdAt)}</td>
        <td>${escapeHTML(v.displayName||'-')}</td>
        <td>${escapeHTML(v.email||'-')}</td>
        <td style="font-family:ui-monospace,Consolas">${escapeHTML(v.uid||'-')}</td>
        <td>${escapeHTML(v.providerId||'-')}</td>
        <td>${escapeHTML((v.userAgent||'').slice(0,120))}</td>
      </tr>
    `).join('');

    refs.btnCSV.onclick = ()=> exportCSV(arr);
  }

  function exportCSV(rows){
    const header = ['時間','姓名','Email','UID','Provider','UserAgent','Kind'];
    const data = rows.map(({v})=>[
      toTW(v.createdAt), v.displayName||'', v.email||'', v.uid||'', v.providerId||'', v.userAgent||'', v.kind||''
    ]);
    const csv = [header, ...data].map(r=>r.map(x=>{
      const s = (x===undefined||x===null) ? '' : String(x);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
    }).join(',')).join('\n');

    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    a.download = `login-logs-${currentKind}-${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
  }

  function escapeHTML(s){
    return String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  }

  // 事件
  refs.kw.addEventListener('input', render);
  refs.from.addEventListener('change', render);
  refs.to.addEventListener('change', render);
  refs.btnReset.addEventListener('click', ()=>{
    refs.kw.value = '';
    refs.from.value = '';
    refs.to.value = '';
    render();
  });
  refs.tabs.forEach(t=>{
    t.addEventListener('click', ()=>{
      refs.tabs.forEach(x=>x.classList.remove('active'));
      t.classList.add('active');
      currentKind = t.dataset.kind;
      bind();
    });
  });

  bind(); // 預設顯示用戶登入(user)
}

/* ───────── 訂單管理模組（保留你的原程式）───────── */
function mountOrdersModule(root){
  // === 你的原「訂單管理」完整程式碼（維持不動） ===
  const money = n => 'NT$ ' + (n || 0).toLocaleString();
  const zh   = { pending:'待付款', paid:'已付款', shipped:'已出貨', canceled:'已取消' };
  const shortId = id => (id||'').slice(0,10);
  const toTW = ts => {
    try {
      const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
      return d ? d.toLocaleString('zh-TW',{hour12:false}) : '-';
    } catch { return '-'; }
  };
  const startOfToday = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
  const endOfToday   = () => { const d = new Date(); d.setHours(23,59,59,999); return d; };

  function ensureAdminStyles(){
    if ($('#admin-css')) return;
    const css = document.createElement('style');
    css.id = 'admin-css';
    css.textContent = `
    :root{
      --bg:#0f1318; --fg:#e6e6e6; --muted:#9aa3af;
      --card:#151a21; --border:#2a2f37; --shadow:0 6px 24px rgba(0,0,0,.25), 0 2px 8px rgba(0,0,0,.2);
      --chip:#0b1220;
      --chip-pending:   rgba(245,158,11,.20);
      --chip-paid:      rgba(34,197,94,.20);
      --chip-shipped:   rgba(59,130,246,.20);
      --chip-canceled:  rgba(239,68,68,.22);
      --chip-ring:      rgba(255,255,255,.25);
    }
    body.light{
      --bg:#f6f8fc; --fg:#111; --muted:#6b7280;
      --card:#ffffff; --border:#e5e7eb; --shadow:0 12px 24px rgba(17,24,39,.06);
      --chip:#eef2ff;
      --chip-ring: rgba(0,0,0,.15);
    }
    .admin-shell{max-width:1200px;margin-inline:auto;padding:20px}
    .hero{background:linear-gradient(135deg, rgba(59,130,246,.15), rgba(168,85,247,.10));
          border:1px solid var(--border); border-radius:18px; padding:18px;
          display:flex; justify-content:space-between; align-items:center; margin-bottom:14px}
    .hero h5{margin:0; font-weight:800}
    .hero .sub{color:var(--muted)}
    .hero .act .btn{border-radius:12px}
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
    .admin-grid{display:grid;grid-template-columns:1fr 1fr; gap:18px}
    @media(max-width: 992px){ .admin-grid{grid-template-columns:1fr} }
    .kpad{padding:16px}
    .hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
    .hd-title{font-weight:800}
    .toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
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
    .o-time{font-size:12px;border:1px solid var(--border);background:#0b1220;color:var(--muted); padding:.25rem .6rem; border-radius:999px}
    .detail-title{font-weight:800;margin-bottom:6px}
    .kv{display:grid;grid-template-columns:120px 1fr; gap:6px 12px; margin-bottom:8px}
    .kv .k{color:var(--muted)}
    .table{margin-top:8px}
    .chips{display:flex;gap:8px;flex-wrap:wrap}
    .chip{border:1px solid var(--border);border-radius:999px;padding:.25rem .7rem; cursor:pointer; user-select:none; font-size:13px;background:#0b1220; color:var(--fg)}
    .chip:hover{transform:translateY(-1px)}
    .chip.active{outline:2px solid rgba(255,255,255,.25)}
    `;
    document.head.appendChild(css);
  }

  function initThemeToggle(rootEl){
    const btn = $('#themeToggle', rootEl);
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
      if ((v.status||'')==='paid') waitShip += 1;
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

  // === 畫面骨架 ===
  ensureAdminStyles();

  const el = document.createElement('div');
  el.className = 'admin-shell';
  el.innerHTML = `
    <div class="backbar">
      <button id="backHome" class="btn">&larr; 返回選單</button>
    </div>

    <div class="hero">
      <div>
        <h5>歡迎回來 👋</h5>
        <div class="sub">快速存取你的常用工具與最新狀態</div>
      </div>
      <div class="act">
        <button class="btn btn-outline-light me-2" id="themeToggle">切換亮/暗</button>
        <button class="btn btn-outline-danger" id="btnLogout">登出</button>
      </div>
    </div>

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
          <button id="btnApply" class="btn btn-sm btn-primary">套用</button>
          <button id="btnReset" class="btn btn-sm btn-outline-secondary">清除</button>
          <div class="flex-grow-1"></div>
          <button id="btnCSV" class="btn btn-sm btn-outline-light">匯出 CSV</button>
        </div>
        <div id="orderList" class="olist"><div class="o-sub">載入中…</div></div>
      </section>

      <section class="kcard kpad">
        <div class="hd"><div class="hd-title">訂單詳細</div></div>
        <div id="orderDetail" class="o-sub">左側點一筆查看</div>
      </section>
    </div>
  `;

  $('#backHome', el)?.addEventListener('click', ()=> renderHome(root));
  $('#btnLogout', el)?.addEventListener('click', async ()=>{
    if(confirm('確定要登出嗎？')){ try{ await signOut(auth); }catch(e){ alert('登出失敗：'+e.message); } }
  });
  initThemeToggle(el);
  $('#dashTime', el).textContent = new Date().toLocaleString('zh-TW',{hour12:false});

  computeTodayStats({
    orders: n => $('#statOrders', el).textContent  = `${n} 筆`,
    revenue:n => $('#statRevenue', el).textContent = money(n),
    ship:   n => $('#statShip', el).textContent    = `${n} 筆`,
    users:  n => $('#statUsers', el).textContent   = `${n} 位`
  }).catch(()=>{});

  // 下面：訂單列表/詳細 + CSV（原邏輯）
  const detailEl = $('#orderDetail', el);
  const listEl   = $('#orderList', el);
  const refs = {
    kw: $('#kw', el), fStatus: $('#fStatus', el),
    from: $('#dateFrom', el), to: $('#dateTo', el),
    btnApply: $('#btnApply', el), btnReset: $('#btnReset', el), btnCSV: $('#btnCSV', el),
  };

  let unsub = null;
  let ordersCache = [];
  let qKey = '';
  const makeKey = ()=>JSON.stringify({s:refs.fStatus.value,f:refs.from.value,t:refs.to.value});

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
      }, err=>{
        console.warn('Query fail, fallback to client filter', err);
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

    $$('.orow', listEl).forEach(r=>{
      r.addEventListener('click', ()=> showDetail(r.dataset.id));
    });

    refs.btnCSV.onclick = ()=> exportCSV(arr);
  }

  async function showDetail(id){
    const ref = doc(db,'orders', id);
    const snap = await getDoc(ref);
    if (!snap.exists()){ detailEl.innerHTML = '查無資料'; return; }
    const v = snap.data()||{};
    const state = v.status || 'pending';
    const itemsRows = (v.items||[]).map(i=>`
      <tr>
        <td>${i.name||''}</td>
        <td>${i.sku||''}</td>
        <td class="text-end">${i.qty||0}</td>
        <td class="text-end">${money(i.price||0)}</td>
        <td class="text-end">${money((i.price||0)*(i.qty||0))}</td>
      </tr>`).join('');

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
        const row = $(`.orow[data-id="${id}"]`);
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
  root.replaceChildren(el);

  function exportCSV(rows){
    const header = ['訂單ID','建立時間','狀態','客戶','Email','電話','品項數','合計'];
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
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
    }).join(',')).join('\n');

    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    a.download = 'orders-' + ts + '.csv';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
  }
}

/* ───────── 導出頁面（含：白名單 + 寫入 admin 登入紀錄） ───────── */
export function AdminPage(){
  ensureHomeStyles();
  const root = document.createElement('div');
  root.innerHTML = '<div class="admin-shell"><p class="muted">載入中...</p></div>';

  getRedirectResult(auth).catch(()=>{});

  onAuthStateChanged(auth, async (user)=>{
    if(!user){ showLogin(root); return; }
    // 白名單驗證
    if(!isAdmin(user)){
      alert('非管理員帳號，無法進入後台。');
      try{ await signOut(auth); }catch{}
      showLogin(root);
      return;
    }
    // 記錄後台登入 → kind: 'admin'
    await logUserLogin(user, 'admin');
    // 顯示三選項首頁
    renderHome(root);
  });

  return root;
}
