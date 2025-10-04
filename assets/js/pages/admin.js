// assets/js/pages/admin.js
// 後台首頁：分三個分頁 → 用戶記帳 / 用戶登入 / 訂單管理（保留原功能）
// 依賴：assets/js/firebase.js（同一個 app 實例輸出 auth / db）

import { auth, db } from '../firebase.js';
import {
  // Auth
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';

import {
  // Firestore
  collection, query, orderBy, limit, onSnapshot,
  doc, getDoc, updateDoc, serverTimestamp,
  where, getDocs, Timestamp, addDoc,
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

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

/* ───────── 白名單 ───────── */
const ADMIN_EMAILS = ['bruce9811123@gmail.com'].map(s => s.trim().toLowerCase());
const ADMIN_UIDS = []; // 需要可填 uid

function isAdminUser(user) {
  if (!user) return false;
  const email = (user.email || '').trim().toLowerCase();
  const uid = user.uid || '';
  return ADMIN_UIDS.includes(uid) || ADMIN_EMAILS.includes(email);
}

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
    --chip-pending:   rgba(245,158,11,.20);
    --chip-paid:      rgba(34,197,94,.20);
    --chip-shipped:   rgba(59,130,246,.20);
    --chip-canceled:  rgba(239,68,68,.22);
    --chip-ring:      rgba(255,255,255,.25);
    --tab:#1b2130;
  }
  body.light{
    --bg:#f6f8fc; --fg:#111; --muted:#6b7280;
    --card:#ffffff; --border:#e5e7eb; --shadow:0 12px 24px rgba(17,24,39,.06);
    --chip:#eef2ff;
    --chip-ring: rgba(0,0,0,.15);
    --tab:#f3f5fb;
  }
  .admin-shell{max-width:1200px;margin-inline:auto;padding:20px}

  .hero{background:linear-gradient(135deg, rgba(59,130,246,.15), rgba(168,85,247,.10));
        border:1px solid var(--border); border-radius:18px; padding:18px;
        display:flex; justify-content:space-between; align-items:center; margin-bottom:14px}
  .hero h5{margin:0; font-weight:800}
  .hero .sub{color:var(--muted)}
  .hero .act .btn{border-radius:12px}

  .tabs{display:flex;gap:8px;margin:12px 0}
  .tab{background:var(--tab);border:1px solid var(--border);padding:.5rem .9rem;border-radius:10px;cursor:pointer;user-select:none}
  .tab.active{outline:2px solid rgba(99,102,241,.45)}
  .panel{display:none}
  .panel.active{display:block}

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
  .toolbar .form-control, .toolbar .form-select{min-width:160px}
  .toolbar .btn{white-space:nowrap}

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

/* 匯出 CSV（通用） */
function exportCSVFromObjects(objs, headers){
  const header = headers.map(h=>h.label);
  const data   = objs.map(o => headers.map(h => h.get(o)));
  const csv = [header, ...data].map(r=>r.map(x=>{
    const s = (x===undefined||x===null) ? '' : String(x);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
  }).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
  a.href = url; a.download = 'export-' + ts + '.csv';
  document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); a.remove();
}

/* 今日統計（沿用訂單數據） */
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

/* 登入畫面（Google） */
function showLogin(el, msg='請先使用 Google 登入才能進入後台', currentUser=null){
  const email = (currentUser?.email || '').trim();
  const uid = currentUser?.uid || '';
  el.innerHTML = `
    <div class="admin-shell">
      <div class="kcard kpad" style="max-width:520px">
        <div class="hd-title mb-2">${msg}</div>
        ${email || uid ? `<div class="meta">目前登入：${email || '(無 email)'}　UID：${uid}</div>` : ''}
        <div class="mt-3 d-flex gap-2">
          <button id="googleLogin" class="btn btn-primary">
            <i class="bi bi-google me-1"></i> 使用 Google 登入
          </button>
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
      if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/cancelled-popup-request') {
        try { await signInWithRedirect(auth, provider); }
        catch (e2) { $('#loginErr', el).textContent = e2.message || '登入失敗'; }
      } else {
        $('#loginErr', el).textContent = err.message || '登入失敗';
      }
    }
  });
}

/* ───────── 分頁：用戶登入（Log） ───────── */
function renderLoginLogPanel(root){
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = `
    <div class="kcard kpad">
      <div class="hd">
        <div class="hd-title">用戶登入紀錄</div>
        <div class="toolbar">
          <input id="logKw" class="form-control form-control-sm" placeholder="搜尋：Email / Name / UID">
          <input id="logFrom" type="date" class="form-control form-control-sm" />
          <span class="align-self-center">～</span>
          <input id="logTo" type="date" class="form-control form-control-sm" />
          <button id="logApply" class="btn btn-sm btn-primary"><i class="bi bi-funnel me-1"></i>套用</button>
          <button id="logReset" class="btn btn-sm btn-outline-secondary">清除</button>
          <button id="logCSV" class="btn btn-sm btn-outline-light"><i class="bi bi-download me-1"></i>匯出 CSV</button>
        </div>
      </div>
      <div class="table-responsive">
        <table class="table table-sm align-middle">
          <thead><tr><th>時間</th><th>Email</th><th>名稱</th><th>UID</th><th>IP</th></tr></thead>
          <tbody id="logBody"><tr><td colspan="5" class="text-muted">載入中…</td></tr></tbody>
        </table>
      </div>
    </div>
  `;

  const refs = {
    kw:   $('#logKw', panel),
    from: $('#logFrom', panel),
    to:   $('#logTo', panel),
    apply:$('#logApply', panel),
    reset:$('#logReset', panel),
    csv:  $('#logCSV', panel),
    body: $('#logBody', panel),
  };

  let cache = [];
  let unsub  = null;

  function bind(){
    if (unsub) { unsub(); unsub=null; }
    refs.body.innerHTML = `<tr><td colspan="5" class="text-muted">載入中…</td></tr>`;

    const from = refs.from.value ? new Date(refs.from.value + 'T00:00:00') : null;
    const to   = refs.to.value   ? new Date(refs.to.value   + 'T23:59:59') : null;

    try{
      let qBase = collection(db,'loginLogs');
      const whs = [];
      if (from) whs.push(where('createdAt','>=', Timestamp.fromDate(from)));
      if (to)   whs.push(where('createdAt','<=', Timestamp.fromDate(to)));
      qBase = whs.length ? query(qBase, ...whs, orderBy('createdAt','desc'), limit(500))
                         : query(qBase, orderBy('createdAt','desc'), limit(500));
      unsub = onSnapshot(qBase, snap=>{
        cache = snap.docs.map(d=>({ id:d.id, v:d.data()||{} }));
        render();
      }, _ => { fallback(); });
    }catch(_){ fallback(); }
  }
  function fallback(){
    const baseQ = query(collection(db,'loginLogs'), orderBy('createdAt','desc'), limit(500));
    onSnapshot(baseQ, snap=>{
      cache = snap.docs.map(d=>({ id:d.id, v:d.data()||{} }));
      render();
    });
  }

  function render(){
    const kw = refs.kw.value.trim().toLowerCase();
    let arr = cache;
    if (kw) {
      arr = arr.filter(({v})=>{
        const email = (v.email||'').toLowerCase();
        const name  = (v.name||'').toLowerCase();
        const uid   = (v.uid||'').toLowerCase();
        return email.includes(kw) || name.includes(kw) || uid.includes(kw);
      });
    }
    if (!arr.length){
      refs.body.innerHTML = `<tr><td colspan="5" class="text-muted">沒有符合條件的紀錄</td></tr>`;
      refs.csv.onclick = ()=>exportCSVFromObjects([],[]);
      return;
    }
    refs.body.innerHTML = arr.map(({v})=>`
      <tr>
        <td>${toTW(v.createdAt)}</td>
        <td>${v.email||''}</td>
        <td>${v.name||''}</td>
        <td class="text-muted small">${v.uid||''}</td>
        <td class="text-muted small">${v.ip||''}</td>
      </tr>
    `).join('');

    refs.csv.onclick = ()=>exportCSVFromObjects(
      arr.map(({v})=>v),
      [
        {label:'時間', get:v=>toTW(v.createdAt)},
        {label:'Email', get:v=>v.email||''},
        {label:'名稱', get:v=>v.name||''},
        {label:'UID', get:v=>v.uid||''},
        {label:'IP', get:v=>v.ip||''},
      ]
    );
  }

  refs.apply.addEventListener('click', bind);
  refs.reset.addEventListener('click', ()=>{ refs.kw.value=''; refs.from.value=''; refs.to.value=''; bind(); });
  refs.kw.addEventListener('input', render);

  bind();
  return panel;
}

/* ───────── 分頁：用戶記帳（Accounts） ───────── */
function renderAccountsPanel(root){
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = `
    <div class="kcard kpad">
      <div class="hd">
        <div class="hd-title">用戶記帳</div>
        <div class="toolbar">
          <input id="accKw" class="form-control form-control-sm" placeholder="搜尋：姓名 / Email / 備註">
          <input id="accFrom" type="date" class="form-control form-control-sm" />
          <span class="align-self-center">～</span>
          <input id="accTo" type="date" class="form-control form-control-sm" />
          <button id="accApply" class="btn btn-sm btn-primary"><i class="bi bi-funnel me-1"></i>套用</button>
          <button id="accReset" class="btn btn-sm btn-outline-secondary">清除</button>
          <button id="accCSV" class="btn btn-sm btn-outline-light"><i class="bi bi-download me-1"></i>匯出 CSV</button>
        </div>
      </div>

      <div class="row g-3">
        <div class="col-lg-5">
          <div class="kcard kpad">
            <div class="hd"><div class="hd-title">新增記帳</div></div>
            <div class="row g-2">
              <div class="col-6"><input id="accName" class="form-control form-control-sm" placeholder="姓名"></div>
              <div class="col-6"><input id="accEmail" class="form-control form-control-sm" placeholder="Email"></div>
              <div class="col-6">
                <select id="accType" class="form-select form-select-sm">
                  <option value="income">收入 (+)</option>
                  <option value="expense">支出 (-)</option>
                </select>
              </div>
              <div class="col-6"><input id="accAmount" type="number" step="1" class="form-control form-control-sm" placeholder="金額"></div>
              <div class="col-12"><input id="accNote" class="form-control form-control-sm" placeholder="備註"></div>
              <div class="col-12 d-grid"><button id="accAdd" class="btn btn-sm btn-primary">新增</button></div>
              <div class="col-12"><div id="accErr" class="text-danger small"></div></div>
            </div>
          </div>
        </div>
        <div class="col-lg-7">
          <div class="kcard kpad">
            <div class="hd"><div class="hd-title">紀錄列表</div></div>
            <div class="d-flex gap-3 mb-2">
              <div class="badge rounded-pill text-bg-success">今日：<span id="accToday">NT$ 0</span></div>
              <div class="badge rounded-pill text-bg-secondary">累積：<span id="accTotal">NT$ 0</span></div>
            </div>
            <div class="table-responsive">
              <table class="table table-sm align-middle">
                <thead><tr><th>時間</th><th>姓名</th><th>Email</th><th>類型</th><th class="text-end">金額</th><th>備註</th></tr></thead>
                <tbody id="accBody"><tr><td colspan="6" class="text-muted">載入中…</td></tr></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const refs = {
    kw: $('#accKw', panel), from: $('#accFrom', panel), to: $('#accTo', panel),
    apply: $('#accApply', panel), reset: $('#accReset', panel), csv: $('#accCSV', panel),
    name: $('#accName', panel), email: $('#accEmail', panel), type: $('#accType', panel),
    amount: $('#accAmount', panel), note: $('#accNote', panel), add: $('#accAdd', panel),
    err: $('#accErr', panel), body: $('#accBody', panel),
    tday: $('#accToday', panel), total: $('#accTotal', panel),
  };

  let cache = [];
  let unsub  = null;

  refs.add.addEventListener('click', async ()=>{
    refs.err.textContent = '';
    const name   = (refs.name.value||'').trim();
    const email  = (refs.email.value||'').trim();
    const type   = refs.type.value; // income | expense
    const amount = Number(refs.amount.value||0);
    const note   = (refs.note.value||'').trim();
    if (!amount || !type){ refs.err.textContent = '請輸入正確金額與類型'; return; }
    try{
      await addDoc(collection(db,'accounts'), {
        name, email, type, amount, note,
        createdAt: serverTimestamp()
      });
      refs.name.value=''; refs.email.value=''; refs.amount.value=''; refs.note.value='';
    }catch(err){ refs.err.textContent = '新增失敗：' + err.message; }
  });

  function bind(){
    if (unsub) { unsub(); unsub=null; }
    refs.body.innerHTML = `<tr><td colspan="6" class="text-muted">載入中…</td></tr>`;
    const from = refs.from.value ? new Date(refs.from.value + 'T00:00:00') : null;
    const to   = refs.to.value   ? new Date(refs.to.value   + 'T23:59:59') : null;

    try{
      let qBase = collection(db,'accounts');
      const whs = [];
      if (from) whs.push(where('createdAt','>=', Timestamp.fromDate(from)));
      if (to)   whs.push(where('createdAt','<=', Timestamp.fromDate(to)));
      qBase = whs.length ? query(qBase, ...whs, orderBy('createdAt','desc'), limit(500))
                         : query(qBase, orderBy('createdAt','desc'), limit(500));
      unsub = onSnapshot(qBase, snap=>{
        cache = snap.docs.map(d=>({ id:d.id, v:d.data()||{} }));
        render();
      }, _ => fallback());
    }catch(_){ fallback(); }
  }
  function fallback(){
    const baseQ = query(collection(db,'accounts'), orderBy('createdAt','desc'), limit(500));
    onSnapshot(baseQ, snap=>{
      cache = snap.docs.map(d=>({ id:d.id, v:d.data()||{} }));
      render();
    });
  }
  function render(){
    const kw = refs.kw.value.trim().toLowerCase();
    let arr = cache;
    if (kw){
      arr = arr.filter(({v})=>{
        const name  = (v.name||'').toLowerCase();
        const email = (v.email||'').toLowerCase();
        const note  = (v.note||'').toLowerCase();
        return name.includes(kw) || email.includes(kw) || note.includes(kw);
      });
    }
    if (!arr.length){
      refs.body.innerHTML = `<tr><td colspan="6" class="text-muted">沒有符合條件的紀錄</td></tr>`;
      refs.csv.onclick = ()=>exportCSVFromObjects([],[]);
      refs.tday.textContent = 'NT$ 0'; refs.total.textContent = 'NT$ 0';
      return;
    }
    // 合計
    const today = startOfToday();
    let sumToday = 0, sumTotal = 0;
    arr.forEach(({v})=>{
      const sign = (v.type==='expense') ? -1 : 1;
      const t = v.createdAt?.toDate?.() || new Date(0);
      sumTotal += sign * (v.amount||0);
      if (t >= today) sumToday += sign * (v.amount||0);
    });
    refs.tday.textContent  = money(sumToday);
    refs.total.textContent = money(sumTotal);

    refs.body.innerHTML = arr.map(({v})=>{
      const sign = (v.type==='expense') ? '-' : '+';
      const clr  = (v.type==='expense') ? 'text-danger' : 'text-success';
      return `
        <tr>
          <td>${toTW(v.createdAt)}</td>
          <td>${v.name||''}</td>
          <td>${v.email||''}</td>
          <td>${v.type==='expense'?'支出':'收入'}</td>
          <td class="text-end ${clr}">${sign} ${money(v.amount||0)}</td>
          <td>${v.note||''}</td>
        </tr>
      `;
    }).join('');

    refs.csv.onclick = ()=>exportCSVFromObjects(
      arr.map(({v})=>v),
      [
        {label:'時間', get:v=>toTW(v.createdAt)},
        {label:'姓名', get:v=>v.name||''},
        {label:'Email', get:v=>v.email||''},
        {label:'類型', get:v=>v.type==='expense'?'支出':'收入'},
        {label:'金額', get:v=>v.amount||0},
        {label:'備註', get:v=>v.note||''},
      ]
    );
  }

  refs.apply.addEventListener('click', bind);
  refs.reset.addEventListener('click', ()=>{ refs.kw.value=''; refs.from.value=''; refs.to.value=''; bind(); });
  refs.kw.addEventListener('input', ()=> render());

  bind();
  return panel;
}

/* ───────── 分頁：訂單管理（沿用你的版本，略調整成面板） ───────── */
function renderOrdersPanel(){
  const wrap = document.createElement('div');
  wrap.className = 'panel';
  // 下面這個函式直接重用你原本 renderUI 的主體（我改成面板，避免重複 Hero）
  wrap.appendChild(renderOrdersCore());
  return wrap;
}

function renderOrdersCore(){
  const el = document.createElement('div');
  el.innerHTML = `
    <div class="page-title">
      <h6 class="m-0">訂單管理</h6>
      <span class="badge rounded-pill px-2">更新於 <span id="dashTime2"></span></span>
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
  $('#dashTime2', el).textContent = new Date().toLocaleString('zh-TW',{hour12:false});

  const listEl   = $('#orderList', el);
  const detailEl = $('#orderDetail', el);
  const refs = {
    kw: $('#kw', el), fStatus: $('#fStatus', el),
    from: $('#dateFrom', el), to: $('#dateTo', el),
    btnApply: $('#btnApply', el), btnReset: $('#btnReset', el), btnCSV: $('#btnCSV', el),
  };

  let unsub = null;
  let ordersCache = []; // [{id, v}]
  let qKey = '';
  const makeKey = ()=>JSON.stringify({s:refs.fStatus.value,f:refs.from.value,t:refs.to.value});

  function exportCSV(rows){
    const headers = [
      {label:'訂單ID', get:o=>o.id},
      {label:'建立時間', get:o=>toTW(o.v.createdAt)},
      {label:'狀態', get:o=>zh[o.v.status||'pending']||'-'},
      {label:'客戶', get:o=>o.v?.customer?.name||''},
      {label:'Email', get:o=>o.v?.customer?.email||''},
      {label:'電話', get:o=>o.v?.customer?.phone||''},
      {label:'品項數', get:o=>(o.v.items||[]).reduce((s,i)=>s+(i.qty||0),0)},
      {label:'合計', get:o=>o.v?.amounts?.total||0},
    ];
    exportCSVFromObjects(rows, headers);
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
      }, _=> fallbackClient());
    }catch(_){ fallbackClient(); }
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

    $$('.orow', listEl).forEach(r=> r.addEventListener('click', ()=> showDetail(r.dataset.id)));
    refs.btnCSV.onclick = ()=> exportCSV(arr);
  }

  async function showDetail(id){
    const detailEl = $('#orderDetail', el);
    detailEl.innerHTML = '載入中…';
    try{
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
          const row = $(`.orow[data-id="${id}"]`, el);
          if (row){
            const badge = row.querySelector('.o-badge');
            badge.className = `o-badge ${chosen}`;
            badge.textContent = zh[chosen];
          }
          alert('狀態已更新');
        }catch(err){ alert('更新失敗：'+err.message); }
      });

    }catch(err){
      detailEl.innerHTML = `<div class="text-danger">讀取失敗：${err.message}</div>`;
    }
  }

  // 綁定工具列
  refs.btnApply.addEventListener('click', bindOrders);
  refs.btnReset.addEventListener('click', ()=>{ refs.kw.value=''; refs.fStatus.value=''; refs.from.value=''; refs.to.value=''; bindOrders(); });
  refs.kw.addEventListener('input', ()=> renderList());

  bindOrders();
  return el;
}

/* ───────── 主畫面（有分頁） ───────── */
function renderUI(user){
  ensureAdminStyles();

  const el = document.createElement('div');
  el.className = 'admin-shell';
  el.innerHTML = `
    <div class="hero">
      <div>
        <h5>歡迎回來 👋</h5>
        <div class="sub">快速存取你的工具與最新狀態</div>
      </div>
      <div class="act">
        <button class="btn btn-outline-light me-2" id="themeToggle"><i class="bi bi-brightness-high me-1"></i>切換亮/暗</button>
        <button class="btn btn-outline-danger" id="btnLogout"><i class="bi bi-box-arrow-right me-1"></i> 登出</button>
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

    <div class="tabs">
      <div class="tab active" data-tab="acc">用戶記帳</div>
      <div class="tab" data-tab="logs">用戶登入</div>
      <div class="tab" data-tab="orders">訂單管理</div>
    </div>

    <div id="panel-acc" class="panel active"></div>
    <div id="panel-logs" class="panel"></div>
    <div id="panel-orders" class="panel"></div>
  `;

  initThemeToggle(el);
  $('#dashTime', el).textContent = new Date().toLocaleString('zh-TW',{hour12:false});

  // 今日統計
  computeTodayStats({
    orders: n => $('#statOrders', el).textContent  = `${n} 筆`,
    revenue:n => $('#statRevenue', el).textContent = money(n),
    ship:   n => $('#statShip', el).textContent    = `${n} 筆`,
    users:  n => $('#statUsers', el).textContent   = `${n} 位`
  }).catch(()=>{});

  // 分頁載入
  const accPanel   = renderAccountsPanel(el);
  const logsPanel  = renderLoginLogPanel(el);
  const ordersPanel= renderOrdersPanel();

  $('#panel-acc', el).appendChild(accPanel);
  $('#panel-logs', el).appendChild(logsPanel);
  $('#panel-orders', el).appendChild(ordersPanel);

  // 分頁切換
  el.addEventListener('click', (e)=>{
    const t = e.target.closest('.tab');
    if (!t) return;
    $$('.tab', el).forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    const key = t.dataset.tab;
    $$('.panel', el).forEach(p=>p.classList.remove('active'));
    $('#panel-'+key, el)?.classList.add('active');
  });

  // 登出
  $('#btnLogout', el)?.addEventListener('click', async ()=>{
    if (!confirm('確定要登出嗎？')) return;
    try{ await signOut(auth); }catch(err){ alert('登出失敗：' + err.message); }
  });

  return el;
}

/* 進後台時記錄登入（用於用戶登入分頁） */
async function logAdminVisit(user){
  try{
    await addDoc(collection(db,'loginLogs'), {
      uid: user.uid || '',
      email: user.email || '',
      name: user.displayName || '',
      ip: '', // 若前端無法取 IP，留空或改由 Cloud Functions 寫入
      createdAt: serverTimestamp()
    });
  }catch(_){ /* 靜默失敗即可 */ }
}

/* 導出頁面：處理 Google 登入與白名單 */
export function AdminPage(){
  ensureAdminStyles();
  const root = document.createElement('div');
  root.innerHTML = '<div class="admin-shell"><div class="kcard kpad">載入中…</div></div>';

  getRedirectResult(auth).catch(()=>{});

  onAuthStateChanged(auth, async (user)=>{
    if (!user) {
      showLogin(root, '請先使用 Google 登入才能進入後台');
      return;
    }
    if (!isAdminUser(user)) {
      showLogin(root, '你不符合管理員帳號', user);
      return;
    }
    // 記錄登入
    await logAdminVisit(user);

    // 渲染主畫面（含三個分頁）
    const ui = renderUI(user);
    root.replaceChildren(ui);
  });

  return root;
}
