// assets/js/pages/admin.js
// 後台：含搜尋／篩選／匯出 CSV + 彩色 Chips + Google 登出功能
// 依賴：assets/js/firebase.js

import { db, auth } from '../firebase.js';
import {
  signOut
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';
import {
  collection, query, orderBy, limit, onSnapshot,
  doc, getDoc, updateDoc, serverTimestamp,
  where, getDocs, Timestamp
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
  .hero{background:linear-gradient(135deg, rgba(59,130,246,.15), rgba(168,85,247,.10));
        border:1px solid var(--border); border-radius:18px; padding:18px;
        display:flex; justify-content:space-between; align-items:center; margin-bottom:14px}
  .hero h5{margin:0; font-weight:800}
  .hero .sub{color:var(--muted)}
  .hero .act .btn{border-radius:12px}
  `;
  document.head.appendChild(css);
}

/* ───────── 登出功能 ───────── */
function initLogout(root){
  const btn = $('#btnLogout', root);
  if (!btn) return;
  btn.addEventListener('click', async ()=>{
    if (!confirm('確定要登出管理員帳號嗎？')) return;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>登出中...';
    try {
      await signOut(auth);
      alert('已成功登出');
      location.hash = '#dashboard';  // 導回首頁
      location.reload();              // 強制刷新確保乾淨狀態
    } catch (err) {
      alert('登出失敗：' + err.message);
      btn.disabled = false;
      btn.innerHTML = '登出';
    }
  });
}

/* ───────── 今日統計 ───────── */
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
  setters.orders(ordersCnt);
  setters.revenue(revenue);
  setters.ship(waitShip);
  setters.users(0);
}

/* ───────── 主函式 ───────── */
export function AdminPage(){
  ensureAdminStyles();

  const el = document.createElement('div');
  el.className = 'admin-shell';
  el.innerHTML = `
    <div class="hero">
      <div>
        <h5>管理後台</h5>
        <div class="sub">歡迎使用立國實業後台系統</div>
      </div>
      <div class="act">
        <button class="btn btn-outline-light me-2" id="themeToggle">
          <i class="bi bi-brightness-high me-1"></i>切換亮/暗
        </button>
        <button class="btn btn-outline-danger" id="btnLogout">
          <i class="bi bi-box-arrow-right me-1"></i>登出
        </button>
      </div>
    </div>

    <div class="kcard p-3">
      <h6>訂單管理系統</h6>
      <div id="orderList">載入中…</div>
    </div>
  `;

  // 初始化登出
  initLogout(el);

  return el;
}
