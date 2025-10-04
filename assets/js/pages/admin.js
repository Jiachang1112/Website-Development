// assets/js/pages/admin.js
// 後台：上方加入「歡迎 / 今日概況 + 4 張統計卡」，下方為卡片風格訂單管理
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
  where, getDocs, Timestamp,
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

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

/* ───────── 白名單 ─────────
   建議同時用 email + uid（uid 最穩，不受 gmail 別名/大小寫影響） */
const ADMIN_EMAILS = ['bruce9811123@gmail.com'].map(s => s.trim().toLowerCase());

// 第一次登入時，畫面會顯示目前 uid，把它貼到這裡就不會誤擋
const ADMIN_UIDS = [
  // 'xxxxxxxxxxxxxxxxxxxxxxxxxxxx',
];

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
  }
  body.light{
    --bg:#f6f8fc; --fg:#111; --muted:#6b7280;
    --card:#ffffff; --border:#e5e7eb; --shadow:0 12px 24px rgba(17,24,39,.06);
    --chip:#eef2ff;
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

  /* 列表卡片（深色卡） */
  .olist{display:flex;flex-direction:column;gap:12px}
  .orow{display:flex;align-items:center;justify-content:space-between; padding:16px;border:1px solid var(--border);border-radius:14px;cursor:pointer; transition:transform .15s ease, box-shadow .2s ease}
  .orow:hover{transform:translateY(-1px); box-shadow:0 10px 28px rgba(0,0,0,.3)}
  .o-left{display:flex;flex-direction:column;gap:4px}
  .o-line{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .o-id{font-weight:700}
  .o-badge{font-size:12px;border:1px solid var(--border);padding:.2rem .55rem;border-radius:999px;color:var(--muted)}
  .o-sub{color:var(--muted);font-size:13px}
  .o-time{font-size:12px;border:1px solid var(--border);background:var(--chip);color:var(--muted); padding:.25rem .6rem; border-radius:999px}

  /* 詳細區 */
  .detail-title{font-weight:800;margin-bottom:6px}
  .kv{display:grid;grid-template-columns:120px 1fr; gap:6px 12px; margin-bottom:8px}
  .kv .k{color:var(--muted)}
  .table{margin-top:8px}
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

/* 今日統計（與首頁相同口徑） */
async function computeTodayStats(setters){
  const start = Timestamp.fromDate(startOfToday());
  const end   = Timestamp.fromDate(endOfToday());

  // 今日所有訂單
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
    // 待出貨定義：已付款但未出貨
    if ((v.status||'')==='paid') waitShip += 1;
  });

  // 最近 30 天常用客戶（去重 email）
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

/* ───────── 登入畫面（Google） ───────── */
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
      // 成功會觸發 onAuthStateChanged，自動進入後台
    }catch(err){
      // 可能是 popup 被擋，改用 redirect
      if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/cancelled-popup-request') {
        try {
          await signInWithRedirect(auth, provider);
        } catch (e2) {
          $('#loginErr', el).textContent = e2.message || '登入失敗';
        }
      } else {
        $('#loginErr', el).textContent = err.message || '登入失敗';
      }
    }
  });
}

/* ───────── 後台主畫面（通過驗證才渲染） ───────── */
function renderUI(){
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
        <button class="btn btn-outline-light" data-go="#dashboard"><i class="bi bi-grid me-1"></i> 回首頁</button>
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
        <div>
          <div class="meta">今日訂單</div>
          <div class="val" id="statOrders">—</div>
        </div>
      </div>

      <div class="kcard stat">
        <div class="ico ico-green"><i class="bi bi-currency-dollar"></i></div>
        <div>
          <div class="meta">今日營收</div>
          <div class="val" id="statRevenue">—</div>
        </div>
      </div>

      <div class="kcard stat">
        <div class="ico ico-amber"><i class="bi bi-receipt"></i></div>
        <div>
          <div class="meta">待出貨</div>
          <div class="val" id="statShip">—</div>
        </div>
      </div>

      <div class="kcard stat">
        <div class="ico ico-purple"><i class="bi bi-people"></i></div>
        <div>
          <div class="meta">常用客戶</div>
          <div class="val" id="statUsers">—</div>
        </div>
      </div>
    </div>

    <!-- 主體：左列表 + 右詳細 -->
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

  // 導航（按鈕 data-go）
  el.addEventListener('click', e=>{
    const go = e.target.closest('[data-go]');
    if (go) location.hash = go.getAttribute('data-go');
  });

  initThemeToggle(el);
  $('#dashTime', el).textContent = new Date().toLocaleString('zh-TW',{hour12:false});

  // 填入今日統計
  computeTodayStats({
    orders: n => $('#statOrders', el).textContent  = `${n} 筆`,
    revenue:n => $('#statRevenue', el).textContent = money(n),
    ship:   n => $('#statShip', el).textContent    = `${n} 筆`,
    users:  n => $('#statUsers', el).textContent   = `${n} 位`
  }).catch(()=>{ /* 靜默失敗即可 */ });

  const listEl = $('#orderList', el);
  const detailEl = $('#orderDetail', el);

  // 監聽訂單（最新 50 筆）
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
      r.addEventListener('click', ()=> showDetail(r.dataset.id));
    });
  }, err=>{
    listEl.innerHTML = `<div class="text-danger">讀取失敗：${err.message}</div>`;
  });

  // 顯示訂單詳細
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

  return el;
}

/* ───────── 導出頁面：處理 Google 登入與白名單 ───────── */
export function AdminPage(){
  ensureAdminStyles();
  const root = document.createElement('div');
  root.innerHTML = '<div class="admin-shell"><div class="kcard kpad">載入中…</div></div>';

  // 先處理 redirect 的結果（若上一動用的是 redirect 登入）
  getRedirectResult(auth).catch(()=>{ /* 忽略即可 */ });

  // 監聽登入狀態
  onAuthStateChanged(auth, (user)=>{
    // 未登入 → 顯示登入畫面
    if (!user) {
      showLogin(root, '請先使用 Google 登入才能進入後台');
      return;
    }
    // 非白名單 → 顯示帳號/UID，並阻擋
    if (!isAdminUser(user)) {
      showLogin(root, '你不符合管理員帳號', user);
      return;
    }
    // 進後台
    const ui = renderUI();
    root.replaceChildren(ui);
  });

  return root;
}
