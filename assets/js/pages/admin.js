// assets/js/pages/admin.js
// 後台（需要 Google 登入 + 指定管理員信箱）
// 依賴：assets/js/firebase.js

import { db, auth } from '../firebase.js';
import {
  collection, query, orderBy, limit, onSnapshot,
  doc, getDoc, updateDoc, serverTimestamp,
  where, getDocs, Timestamp
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';

/* ====== 參數：允許進入後台的管理員 Email ====== */
const ADMIN_EMAIL = 'bruce9811123@gmail.com';

/* ====== 小工具 ====== */
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const money = n => 'NT$ ' + (n || 0).toLocaleString();
const zh = { pending:'待付款', paid:'已付款', shipped:'已出貨', canceled:'已取消' };
const en = { '待付款':'pending', '已付款':'paid', '已出貨':'shipped', '已取消':'canceled' };
const shortId = id => (id||'').slice(0,10);
const toTW = ts => {
  try {
    const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
    return d ? d.toLocaleString('zh-TW',{hour12:false}) : '-';
  } catch { return '-'; }
};
const startOfToday = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const endOfToday   = () => { const d = new Date(); d.setHours(23,59,59,999); return d; };

/* ====== 樣式（只注入一次） ====== */
function ensureAdminStyles(){
  if ($('#admin-css')) return;
  const css = document.createElement('style');
  css.id = 'admin-css';
  css.textContent = `
  :root{
    --bg:#0f1318; --fg:#e6e6e6; --muted:#9aa3af;
    --card:#151a21; --border:#2a2f37; --shadow:0 6px 24px rgba(0,0,0,.25), 0 2px 8px rgba(0,0,0,.2);
    --chip:#0b1220;
  }
  body.light{
    --bg:#f6f8fc; --fg:#111; --muted:#6b7280;
    --card:#ffffff; --border:#e5e7eb; --shadow:0 12px 24px rgba(17,24,39,.06);
    --chip:#eef2ff;
  }
  .admin-shell{max-width:1200px;margin-inline:auto;padding:20px}

  .hero{background:linear-gradient(135deg, rgba(59,130,246,.15), rgba(168,85,247,.10));
        border:1px solid var(--border); border-radius:18px; padding:18px;
        display:flex; justify-content:space-between; align-items:center; margin-bottom:14px}
  .hero h5{margin:0; font-weight:800}
  .hero .sub{color:var(--muted)}
  .hero .act{display:flex; align-items:center; gap:10px}
  .hero .user{display:flex; align-items:center; gap:8px; color:var(--muted)}
  .hero .user img{width:32px;height:32px;border-radius:50%}

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

  .olist{display:flex;flex-direction:column;gap:12px}
  .orow{display:flex;align-items:center;justify-content:space-between; padding:16px;border:1px solid var(--border);border-radius:14px;cursor:pointer; transition:transform .15s ease, box-shadow .2s ease}
  .orow:hover{transform:translateY(-1px); box-shadow:0 10px 28px rgba(0,0,0,.3)}
  .o-left{display:flex;flex-direction:column;gap:4px}
  .o-line{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .o-id{font-weight:700}
  .o-badge{font-size:12px;border:1px solid var(--border);padding:.2rem .55rem;border-radius:999px;color:var(--muted)}
  .o-sub{color:var(--muted);font-size:13px}
  .o-time{font-size:12px;border:1px solid var(--border);background:var(--chip);color:var(--muted); padding:.25rem .6rem; border-radius:999px}

  .detail-title{font-weight:800;margin-bottom:6px}
  .kv{display:grid;grid-template-columns:120px 1fr; gap:6px 12px; margin-bottom:8px}
  .kv .k{color:var(--muted)}
  .table{margin-top:8px}

  .login-card{max-width:520px;margin:32px auto;padding:20px}
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
    if ((v.status||'')==='paid') waitShip += 1; // 已付款視為待出貨
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

/* ====== 主頁面（已登入且授權通過） ====== */
function renderAdminUI(user){
  ensureAdminStyles();

  const el = document.createElement('div');
  el.className = 'admin-shell';
  el.innerHTML = `
    <div class="hero">
      <div>
        <h5>歡迎回來 👋</h5>
        <div class="sub">快速存取你的常用工具與最新狀態</div>
      </div>
      <div class="act">
        <div class="user">
          <img src="${user.photoURL || ''}" alt="avatar">
          <span>${user.displayName || user.email}</span>
        </div>
        <button class="btn btn-outline-light" id="themeToggle"><i class="bi bi-brightness-high me-1"></i>切換亮/暗</button>
        <button class="btn btn-outline-light" data-go="#dashboard"><i class="bi bi-grid me-1"></i> 回首頁</button>
        <button class="btn btn-outline-danger" id="logoutBtn">登出</button>
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
        <div id="orderList" class="olist"><div class="o-sub">載入中…</div></div>
      </section>

      <section class="kcard kpad">
        <div class="hd"><div class="hd-title">訂單詳細</div></div>
        <div id="orderDetail" class="o-sub">左側點一筆查看</div>
      </section>
    </div>
  `;

  // 導航
  el.addEventListener('click', e=>{
    const go = e.target.closest('[data-go]');
    if (go) location.hash = go.getAttribute('data-go');
  });

  // 切換主題 & 顯示時間
  initThemeToggle(el);
  $('#dashTime', el).textContent = new Date().toLocaleString('zh-TW',{hour12:false});

  // 今日統計
  computeTodayStats({
    orders: n => $('#statOrders', el).textContent  = `${n} 筆`,
    revenue:n => $('#statRevenue', el).textContent = money(n),
    ship:   n => $('#statShip', el).textContent    = `${n} 筆`,
    users:  n => $('#statUsers', el).textContent   = `${n} 位`
  }).catch(()=>{});

  // 監聽訂單
  const listEl = $('#orderList', el);
  const detailEl = $('#orderDetail', el);
  const qOrders = query(collection(db,'orders'), orderBy('createdAt','desc'), limit(50));

  onSnapshot(qOrders, snap=>{
    if (snap.empty){ listEl.innerHTML = '<div class="o-sub">目前沒有訂單</div>'; return; }
    listEl.innerHTML = snap.docs.map(d=>{
      const v = d.data()||{};
      const itemsCount = (v.items||[]).reduce((s,i)=>s+(i.qty||0),0);
      const total = money(v?.amounts?.total||0);
      return `
        <div class="orow" data-id="${d.id}">
          <div class="o-left">
            <div class="o-line">
              <span class="o-id">#${shortId(d.id)}</span>
              <span class="o-badge">${zh[v.status||'pending']||'-'}</span>
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
  }, err=>{
    listEl.innerHTML = `<div class="text-danger">讀取失敗：${err.message}</div>`;
  });

  // 詳細
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

      detailEl.innerHTML = `
        <div class="detail-title">#${snap.id}</div>
        <div class="kv">
          <div class="k">建立時間</div><div>${toTW(v.createdAt)}</div>
          <div class="k">狀態</div>
          <div>
            <select id="stateSel" class="form-select form-select-sm" style="max-width:160px;display:inline-block">
              ${['待付款','已付款','已出貨','已取消'].map(t=>{
                const sel = (zh[v.status||'pending']===t) ? 'selected' : '';
                return `<option ${sel}>${t}</option>`;
              }).join('')}
            </select>
            <button id="saveState" class="btn btn-sm btn-primary ms-2">儲存</button>
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

      // 儲存狀態
      $('#saveState', detailEl).addEventListener('click', async ()=>{
        const zhVal = $('#stateSel', detailEl).value;
        const newState = en[zhVal] || 'pending';
        try{
          await updateDoc(ref, { status:newState, updatedAt: serverTimestamp() });
          const row = $(`.orow[data-id="${id}"]`, listEl);
          if (row) row.querySelector('.o-badge').textContent = zh[newState];
          alert('狀態已更新');
        }catch(err){
          alert('更新失敗：'+err.message);
        }
      });

    }catch(err){
      detailEl.innerHTML = `<div class="text-danger">讀取失敗：${err.message}</div>`;
    }
  }

  // 登出
  $('#logoutBtn', el)?.addEventListener('click', ()=>{
    signOut(auth).finally(()=> location.hash = '#dashboard');
  });

  return el;
}

/* ====== 登入頁（未登入） ====== */
function renderLoginUI(errorText=''){
  ensureAdminStyles();
  const box = document.createElement('div');
  box.className = 'admin-shell';
  box.innerHTML = `
    <div class="kcard login-card">
      <h5 class="mb-2">請先使用 Google 登入才能進入後台</h5>
      <div class="d-flex align-items-center gap-2 mb-3">
        <button class="btn btn-light" id="googleSignin">
          <i class="bi bi-google me-1"></i> 使用 Google 登入
        </button>
        <a class="ms-2" href="#dashboard">回首頁</a>
      </div>
      <div id="loginErr" class="text-danger small">${errorText||''}</div>
    </div>
  `;

  $('#googleSignin', box)?.addEventListener('click', async ()=>{
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try{
      await signInWithPopup(auth, provider);
      // onAuthStateChanged 會接手
    }catch(err){
      const msg = `Firebase: ${err.message || err.code || '登入失敗'}`;
      $('#loginErr', box).textContent = msg;
    }
  });

  return box;
}

/* ====== 導出：主入口 ====== */
export function AdminPage(){
  const container = document.createElement('div');

  onAuthStateChanged(auth, user=>{
    container.innerHTML = ''; // 清空
    if (!user){
      container.appendChild(renderLoginUI());
      return;
    }

    // 僅允許指定 Email
    if ((user.email || '').toLowerCase() !== ADMIN_EMAIL.toLowerCase()){
      // 登出 + 提示 + 導回首頁
      const warn = document.createElement('div');
      warn.className = 'admin-shell';
      warn.innerHTML = `
        <div class="kcard login-card">
          <h5 class="mb-2">你不符合管理員帳號資格</h5>
          <div class="text-muted mb-2">${user.email || ''}</div>
          <a href="#dashboard">回首頁</a>
        </div>`;
      container.appendChild(warn);
      signOut(auth).finally(()=>{
        setTimeout(()=> location.hash = '#dashboard', 1500);
      });
      return;
    }

    // 已登入且授權通過 → 顯示後台
    container.appendChild(renderAdminUI(user));
  }, err=>{
    container.innerHTML = '';
    container.appendChild(renderLoginUI(`Firebase: ${err.message || err.code}`));
  });

  return container;
}
