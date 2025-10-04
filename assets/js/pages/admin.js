// assets/js/pages/admin.js
// 後台：登入門檻（內嵌表單） + 上方概況 + 卡片風格訂單管理
// 依賴：assets/js/firebase.js（初始化 app / db）

import { db } from '../firebase.js';
import {
  collection, query, orderBy, limit, onSnapshot,
  doc, getDoc, updateDoc, serverTimestamp,
  where, getDocs, Timestamp
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';

/* ───────── 小工具 ───────── */
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
  }
  body.light{
    --bg:#f6f8fc; --fg:#111; --muted:#6b7280;
    --card:#ffffff; --border:#e5e7eb; --shadow:0 12px 24px rgba(17,24,39,.06);
    --chip:#eef2ff;
  }
  .admin-shell{max-width:1200px;margin-inline:auto;padding:20px}
  .kcard{background:var(--card);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow)}
  .kpad{padding:16px}
  .hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
  .hd-title{font-weight:800}
  .meta{color:var(--muted)}
  .btn-pill{border-radius:12px}

  /* Hero */
  .hero{background:linear-gradient(135deg, rgba(59,130,246,.15), rgba(168,85,247,.10));
        border:1px solid var(--border); border-radius:18px; padding:18px;
        display:flex; justify-content:space-between; align-items:center; margin-bottom:14px}
  .hero h5{margin:0; font-weight:800}
  .hero .sub{color:var(--muted)}

  /* 今日概況 */
  .page-title{display:flex;align-items:center;gap:12px;margin:12px 0 12px}
  .page-title .badge{background:transparent;border:1px dashed var(--border);color:var(--muted)}
  .stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}
  @media (max-width:1200px){.stat-grid{grid-template-columns:repeat(2,1fr)}}
  @media (max-width:640px){.stat-grid{grid-template-columns:1fr}}
  .stat{padding:16px;border-radius:14px;display:flex;gap:14px;align-items:center}
  .ico{width:44px;height:44px;border-radius:10px;display:grid;place-items:center;font-size:20px}
  .ico-blue{background:rgba(59,130,246,.15);color:#93c5fd;border:1px solid rgba(59,130,246,.25)}
  .ico-green{background:rgba(34,197,94,.15);color:#86efac;border:1px solid rgba(34,197,94,.25)}
  .ico-amber{background:rgba(245,158,11,.15);color:#fcd34d;border:1px solid rgba(245,158,11,.25)}
  .ico-purple{background:rgba(168,85,247,.15);color:#e9d5ff;border:1px solid rgba(168,85,247,.25)}
  .val{font-weight:800;font-size:20px;color:var(--fg)}

  /* 列表卡片 */
  .olist{display:flex;flex-direction:column;gap:12px}
  .orow{display:flex;align-items:center;justify-content:space-between; padding:16px;border:1px solid var(--border);border-radius:14px;cursor:pointer; transition:transform .15s ease, box-shadow .2s ease}
  .orow:hover{transform:translateY(-1px); box-shadow:0 10px 28px rgba(0,0,0,.3)}
  .o-left{display:flex;flex-direction:column;gap:4px}
  .o-line{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .o-id{font-weight:700}
  .o-badge{font-size:12px;border:1px solid var(--border);padding:.2rem .55rem;border-radius:999px;color:var(--muted)}
  .o-sub{color:var(--muted);font-size:13px}
  .o-time{font-size:12px;border:1px solid var(--border);background:var(--chip);color:var(--muted); padding:.25rem .6rem; border-radius:999px}

  /* 登入表單 */
  .auth-wrap{display:flex; flex-direction:column; gap:10px; max-width:360px}
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

  const qToday = query(
    collection(db,'orders'),
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
  const q30 = query(
    collection(db,'orders'),
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

/* ───────── 主頁面（含登入表單門檻） ───────── */
export function AdminPage(){
  ensureAdminStyles();

  const el = document.createElement('div');
  el.className = 'admin-shell';
  el.innerHTML = `
    <div class="kcard kpad">
      <div class="hd-title">驗證中...</div>
      <div class="meta">請稍候</div>
    </div>
  `;

  const ADMIN_EMAIL = 'bruce9811123@gmail.com';
  const ADMIN_PASS  = '0900564233';
  const auth = getAuth();

  const showLogin = (msg='請先登入才能進入後台')=>{
    el.innerHTML = `
      <div class="kcard kpad" style="max-width:520px">
        <div class="hd-title mb-2">${msg}</div>
        <form id="adminLogin" class="auth-wrap">
          <div>
            <label class="form-label">帳號（Email）</label>
            <input id="loginEmail" type="email" class="form-control" placeholder="bruce9811123@gmail.com" required>
          </div>
          <div>
            <label class="form-label">密碼</label>
            <input id="loginPass" type="password" class="form-control" placeholder="******" required>
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-primary btn-pill" type="submit">登入</button>
            <a class="btn btn-outline-light btn-pill" href="#dashboard">回首頁</a>
          </div>
          <div id="loginErr" class="text-danger small"></div>
        </form>
      </div>
    `;

    $('#loginEmail', el).value = ADMIN_EMAIL;
    $('#loginPass', el).value  = '';

    $('#adminLogin', el).addEventListener('submit', async (e)=>{
      e.preventDefault();
      const email = $('#loginEmail', el).value.trim();
      const pass  = $('#loginPass',  el).value.trim();
      try{
        const cred = await signInWithEmailAndPassword(auth, email, pass);
        const ok = (cred.user?.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase();
        if (!ok) throw new Error('not-admin');
        // 通過 → 渲染後台
        renderAdminUI(el);
      }catch(err){
        $('#loginErr', el).textContent = '管理員帳號錯誤，將自動返回首頁…';
        setTimeout(()=>{ location.hash = '#dashboard'; }, 2000);
        try{ await signOut(auth); }catch{}
      }
    });
  };

  onAuthStateChanged(auth, (user)=>{
    if (!user) { showLogin(); return; }
    const ok = (user.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase();
    if (!ok) {
      showLogin('你不符合管理員帳號，請使用管理員帳號登入');
      return;
    }
    renderAdminUI(el);
  });

  return el;
}

/* 渲染真正後台 UI，並綁定行為 */
function renderAdminUI(el){
  el.innerHTML = `
    <div class="hero">
      <div>
        <h5>歡迎回來 👋</h5>
        <div class="sub">快速存取你的常用工具與最新狀態</div>
      </div>
      <div class="act">
        <button class="btn btn-outline-light me-2 btn-pill" id="themeToggle">
          <i class="bi bi-brightness-high me-1"></i>切換亮/暗
        </button>
        <button class="btn btn-outline-light btn-pill" data-go="#dashboard">
          <i class="bi bi-grid me-1"></i> 回首頁
        </button>
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

  el.addEventListener('click', e=>{
    const go = e.target.closest('[data-go]');
    if (go) location.hash = go.getAttribute('data-go');
  });

  initThemeToggle(el);
  $('#dashTime', el).textContent = new Date().toLocaleString('zh-TW',{hour12:false});

  computeTodayStats({
    orders: n => $('#statOrders', el).textContent  = `${n} 筆`,
    revenue:n => $('#statRevenue', el).textContent = money(n),
    ship:   n => $('#statShip', el).textContent    = `${n} 筆`,
    users:  n => $('#statUsers', el).textContent   = `${n} 位`
  }).catch(()=>{});

  const listEl = $('#orderList', el);
  const detailEl = $('#orderDetail', el);

  const q = query(collection(db,'orders'), orderBy('createdAt','desc'), limit(50));
  onSnapshot(q, snap=>{
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
      r.addEventListener('click', ()=> showDetail(r.dataset.id, detailEl, listEl));
    });
  }, err=>{
    listEl.innerHTML = `<div class="text-danger">讀取失敗：${err.message}</div>`;
  });
}

async function showDetail(id, detailEl, listEl){
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

    $('#saveState', detailEl).addEventListener('click', async ()=>{
      const zhVal = $('#stateSel', detailEl).value;
      const newState = en[zhVal] || 'pending';
      try{
        await updateDoc(ref, { status:newState, updatedAt: serverTimestamp() });
        const row = listEl?.querySelector(`.orow[data-id="${id}"]`);
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
