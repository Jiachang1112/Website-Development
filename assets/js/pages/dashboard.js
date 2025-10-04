// assets/js/pages/dashboard.js
import { db } from '../firebase.js';
import {
  collection, query, where, orderBy, limit, onSnapshot, getDocs, Timestamp
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

// ---- 內部工具 ----
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const money = n => 'NT$ ' + (n||0).toLocaleString();
const zh = {
  pending: '待付款',
  paid: '已付款',
  shipped: '已出貨',
  canceled: '已取消'
};
const shortId = id => (id||'').slice(0,10);
const toTW = ts => {
  try {
    const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
    return d ? d.toLocaleString('zh-TW', { hour12:false }) : '-';
  } catch { return '-'; }
};
const startOfToday = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const endOfToday   = () => { const d = new Date(); d.setHours(23,59,59,999); return d; };

// ---- 注入樣式（只注入一次）----
function ensureStyles() {
  if ($('#dash-css')) return;
  const css = document.createElement('style');
  css.id = 'dash-css';
  css.textContent = `
  :root{
    --bg:#0f1318; --fg:#e6e6e6; --muted:#9aa3af;
    --card:#151a21; --border:#2a2f37; --primary:#3b82f6; --shadow:0 6px 24px rgba(0,0,0,.25), 0 2px 8px rgba(0,0,0,.2);
  }
  body.light{
    --bg:#f6f8fc; --fg:#111; --muted:#6b7280;
    --card:#ffffff; --border:#e5e7eb; --shadow:0 12px 24px rgba(17,24,39,.06);
  }
  body{background:var(--bg);color:var(--fg)}
  .shell{max-width:1200px;margin-inline:auto;padding:20px}
  .page-title{display:flex;align-items:center;gap:12px;margin:12px 0 22px}
  .page-title .badge{background:transparent;border:1px dashed var(--border);color:var(--muted)}
  .kcard{background:var(--card);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow)}
  .kcard-hover{transition:transform .16s ease, box-shadow .2s ease}
  .kcard-hover:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(0,0,0,.3)}
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
  .hero{background:linear-gradient(135deg, rgba(59,130,246,.15), rgba(168,85,247,.10)); border:1px solid var(--border);
        border-radius:18px;padding:18px;display:flex;justify-content:space-between;align-items:center}
  .hero h4{margin:0;font-weight:800}
  .hero .sub{color:var(--muted)}
  .hero .act .btn{border-radius:12px}
  `;
  document.head.appendChild(css);
}

// ---- 主題切換（持久化） ----
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

// ---- Firestore 統計與清單 ----
async function computeTodayStats(setters){
  const start = Timestamp.fromDate(startOfToday());
  const end   = Timestamp.fromDate(endOfToday());

  // 今日所有訂單
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
    // 待出貨：這裡定義為「已付款但未出貨」
    if ((v.status||'')==='paid') paidNotShipped += 1;
  });

  // 最近 30 天常用客戶（去重 Email）
  const since = new Date(); since.setDate(since.getDate()-30);
  const q30 = query(collection(db,'orders'), where('createdAt','>=', Timestamp.fromDate(since)), orderBy('createdAt','desc'), limit(200));
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
            <div class="fw-semibold">#${shortId(d.id)}｜${zh[v.status||'pending']||'-'}｜${money(v?.amounts?.total)}</div>
            <div class="meta">${(v?.customer?.name||'-')} ｜ ${items} 件</div>
          </div>
          <span class="chip">${toTW(v.createdAt)}</span>
        </div>`;
    }).join('');
  }, err=>{
    listEl.innerHTML = `<div class="text-danger">讀取失敗：${err.message}</div>`;
  });
}

// ---- 導航：快速卡 / Hero 按鈕 ----
function initGoto(root){
  root.addEventListener('click', e=>{
    const go = e.target.closest('[data-go]');
    if(go){
      location.hash = go.getAttribute('data-go'); // 例如 #shop
    }
  });
}

// ---- 導出頁面 ----
export function DashboardPage(){
  ensureStyles();

  const el = document.createElement('div');
  el.className = 'shell';
  el.innerHTML = `
    <!-- Hero -->
    <div class="hero kcard kcard-hover mb-3">
      <div>
        <h4>歡迎回來 👋</h4>
        <div class="sub">快速存取你的常用工具與最新狀態</div>
      </div>
      <div class="act">
        <button class="btn btn-outline-light me-2" id="themeToggle"><i class="bi bi-brightness-high me-1"></i>切換亮/暗</button>
        <button class="btn btn-primary me-2" data-go="#shop"><i class="bi bi-cart me-1"></i> 立即購物</button>
        <button class="btn btn-outline-light" data-go="#admin"><i class="bi bi-speedometer2 me-1"></i> 後台</button>
      </div>
    </div>

    <!-- 數字卡 -->
    <div class="page-title">
      <h5 class="m-0">今日概況</h5>
      <span class="badge rounded-pill px-2">更新於 <span id="dashTime"></span></span>
    </div>

    <div class="stat-grid mb-3">
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

    <!-- 快捷功能 -->
    <div class="block-hd">
      <h5 class="m-0">快速功能</h5>
      <div class="hint">把常用的入口放在這邊，一鍵進入</div>
    </div>

    <div class="quick-grid mb-3">
      <div class="kcard kcard-hover quick" data-go="#shop">
        <div class="i blue"><i class="bi bi-cart"></i></div>
        <div>
          <div class="t">線上下單</div>
          <div class="s">快速加入購物車</div>
        </div>
      </div>

      <div class="kcard kcard-hover quick" data-go="#admin">
        <div class="i purple"><i class="bi bi-speedometer2"></i></div>
        <div>
          <div class="t">後台</div>
          <div class="s">訂單狀態管理</div>
        </div>
      </div>

      <div class="kcard kcard-hover quick" data-go="#expense">
        <div class="i amber"><i class="bi bi-journal-check"></i></div>
        <div>
          <div class="t">支出記帳</div>
          <div class="s">快速登錄支出</div>
        </div>
      </div>

      <div class="kcard kcard-hover quick" data-go="#camera">
        <div class="i pink"><i class="bi bi-camera"></i></div>
        <div>
          <div class="t">拍照記帳</div>
          <div class="s">拍照上傳憑證</div>
        </div>
      </div>

      <div class="kcard kcard-hover quick" data-go="#chatbook">
        <div class="i slate"><i class="bi bi-chat-dots"></i></div>
        <div>
          <div class="t">聊天記帳</div>
          <div class="s">用對話輸入</div>
        </div>
      </div>

      <div class="kcard kcard-hover quick" data-go="#settings">
        <div class="i green"><i class="bi bi-gear"></i></div>
        <div>
          <div class="t">設定</div>
          <div class="s">偏好與進階</div>
        </div>
      </div>
    </div>

    <!-- 最近活動 -->
    <div class="block-hd">
      <h5 class="m-0">最近活動</h5>
      <a class="btn btn-sm btn-outline-light" data-go="#admin">查看全部</a>
    </div>

    <div class="kcard p-3">
      <div class="list" id="recentList">
        <div class="meta">載入中…</div>
      </div>
    </div>
  `;

  // 初始化 UI 行為
  initGoto(el);
  initThemeToggle(el);

  // 顯示時間
  $('#dashTime', el).textContent = new Date().toLocaleString('zh-TW',{hour12:false});

  // 計算今日統計
  computeTodayStats({
    orders: n => $('#statOrders', el).textContent  = `${n} 筆`,
    revenue:n => $('#statRevenue', el).textContent = money(n),
    ship:   n => $('#statShip', el).textContent    = `${n} 筆`,
    users:  n => $('#statUsers', el).textContent   = `${n} 位`
  }).catch(err=>{
    $('#statOrders', el).textContent = '—';
    $('#statRevenue', el).textContent = '—';
    $('#statShip', el).textContent = '—';
    $('#statUsers', el).textContent = '—';
    console.error(err);
  });

  // 最近活動清單（即時）
  listenRecent(el);

  return el;
}
