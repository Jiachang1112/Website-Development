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
      return /[",\n]/.test(s) ? '"' + s.replace(
