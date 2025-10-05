// assets/js/pages/login-logs.js
// 用戶登入紀錄（新增：kind 兩個選項：用戶登入 / 管理員登入）
// 依賴：/assets/js/firebase.js 匯出 db

import { db } from '../firebase.js';
import {
  collection, query, orderBy, limit, onSnapshot,
  where, getDocs, Timestamp
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

/* ───────── 小工具 ───────── */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const toTW = ts => {
  try {
    const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
    return d ? d.toLocaleString('zh-TW',{hour12:false}) : '-';
  } catch { return '-'; }
};

function ensureStyles(){
  if ($('#loginlogs-css')) return;
  const css = document.createElement('style');
  css.id = 'loginlogs-css';
  css.textContent = `
  :root{
    --bg:#0f1318; --fg:#e6e6e6; --muted:#9aa3af; --card:#151a21; --border:#2a2f37;
  }
  body{background:var(--bg); color:var(--fg)}
  .shell{max-width:1200px;margin:18px auto;padding:0 16px}
  .kcard{background:var(--card); border:1px solid var(--border); border-radius:16px}
  .pad{padding:16px}
  .hero{display:flex;justify-content:space-between;align-items:center}
  .badge-pill{border:1px solid var(--border);border-radius:999px;padding:.25rem .7rem;color:var(--muted)}
  .toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
  .toolbar .form-control, .toolbar .form-select{min-width:160px}
  .btn-outline{border:1px solid var(--border); background:transparent; color:var(--fg); border-radius:10px; padding:.4rem .7rem}
  .btn-outline:hover{opacity:.9}
  .chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
  .chip{border:1px solid var(--border);border-radius:999px;padding:.35rem .9rem;cursor:pointer;user-select:none}
  .chip.active{outline:2px solid rgba(255,255,255,.22)}
  .table-wrap{margin-top:10px; overflow:auto}
  table{width:100%; font-size:14px}
  thead th{color:var(--muted); font-weight:600}
  tbody td{border-top:1px solid var(--border); vertical-align:top}
  `;
  document.head.appendChild(css);
}

/* ───────── 畫面 ───────── */
function renderUI(root){
  root.innerHTML = `
    <div class="shell">
      <div class="kcard pad mb-3">
        <div class="hero">
          <div>
            <div class="fw-bold fs-5">用戶登入紀錄</div>
            <div class="text-secondary" style="color:var(--muted)!important">
              即時顯示最近登入的使用者
            </div>
          </div>
          <span class="badge-pill">login_logs</span>
        </div>

        <!-- ✨ 新增：分類 chips -->
        <div class="chips" id="kindChips">
          <span class="chip active" data-kind="user">用戶登入</span>
          <span class="chip" data-kind="admin">管理員登入</span>
        </div>

        <!-- 工具列 -->
        <div class="toolbar">
          <input id="kw" class="form-control form-control-sm" placeholder="搜尋：姓名 / Email / UID">
          <input id="dateFrom" type="date" class="form-control form-control-sm" />
          <span class="align-self-center">～</span>
          <input id="dateTo" type="date" class="form-control form-control-sm" />
          <button id="btnClear" class="btn btn-outline btn-sm">清除</button>
          <div class="flex-grow-1"></div>
          <button id="btnCSV" class="btn btn-outline btn-sm">匯出 CSV</button>
        </div>
      </div>

      <div class="kcard pad">
        <div class="table-wrap">
          <table class="table table-sm align-middle">
            <thead>
              <tr>
                <th style="width:160px">時間</th>
                <th style="width:110px">姓名</th>
                <th style="width:260px">Email</th>
                <th style="width:260px">UID</th>
                <th style="width:120px">Provider</th>
                <th>User-Agent</th>
              </tr>
            </thead>
            <tbody id="tbody"><tr><td colspan="6" class="text-secondary">載入中…</td></tr></tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

/* 匯出 CSV */
function exportCSV(rows){
  const header = ['時間','姓名','Email','UID','Provider','User-Agent'];
  const data = rows.map(v=>[
    toTW(v.ts || v.at), v.displayName || '', v.email || '', v.uid || '',
    v.providerId || '', v.ua || v.userAgent || ''
  ]);
  const csv = [header, ...data].map(r=>r.map(x=>{
    const s = (x===undefined||x===null) ? '' : String(x);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
  }).join(',')).join('\n');

  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
  a.download = 'login-logs-' + ts + '.csv';
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  a.remove();
}

/* ───────── 主程式 ───────── */
(async function main(){
  ensureStyles();
  const root = document.getElementById('app') || document.body.appendChild(document.createElement('div'));
  renderUI(root);

  // 參照 UI
  const refs = {
    chips: $('#kindChips', root),
    kw: $('#kw', root),
    from: $('#dateFrom', root),
    to: $('#dateTo', root),
    btnClear: $('#btnClear', root),
    btnCSV: $('#btnCSV', root),
    tbody: $('#tbody', root),
  };

  // ✨ 新增：目前分類（user / admin）
  let currentKind = 'user';
  let unsub = null;
  let cache = []; // 原始快取（依 kind）

  function bind(){
    if (unsub) { unsub(); unsub = null; }
    refs.tbody.innerHTML = `<tr><td colspan="6" class="text-secondary">載入中…</td></tr>`;

    try{
      // 依 kind 查詢、時間倒序、限制 500 筆（想做無限筆可再做分頁）
      const qBase = query(
        collection(db,'login_logs'),
        where('kind','==', currentKind),
        orderBy('ts','desc'),
        limit(500)
      );

      unsub = onSnapshot(qBase, snap=>{
        cache = snap.docs.map(d=>({ id:d.id, ...d.data() }));
        render();  // 重新套用當前搜尋/日期條件
      }, err=>{
        console.warn('query fail', err);
        refs.tbody.innerHTML = `<tr><td colspan="6" class="text-danger">載入失敗：${err.message}</td></tr>`;
      });
    }catch(err){
      console.warn(err);
      refs.tbody.innerHTML = `<tr><td colspan="6" class="text-danger">查詢建立失敗：${err.message}</td></tr>`;
    }
  }

  function render(){
    // 關鍵字 / 日期 篩選（在 client 端做）
    const kw   = (refs.kw.value||'').trim().toLowerCase();
    const from = refs.from.value ? new Date(refs.from.value + 'T00:00:00') : null;
    const to   = refs.to.value   ? new Date(refs.to.value   + 'T23:59:59') : null;

    let arr = cache;
    if (kw) {
      arr = arr.filter(v=>{
        const name  = (v.displayName||'').toLowerCase();
        const email = (v.email||'').toLowerCase();
        const uid   = (v.uid||'').toLowerCase();
        return name.includes(kw) || email.includes(kw) || uid.includes(kw);
      });
    }
    if (from) {
      arr = arr.filter(v=>{
        const d = (v.ts?.toDate?.() || v.at?.toDate?.() || new Date(0));
        return d >= from;
      });
    }
    if (to) {
      arr = arr.filter(v=>{
        const d = (v.ts?.toDate?.() || v.at?.toDate?.() || new Date(0));
        return d <= to;
      });
    }

    if (!arr.length){
      refs.tbody.innerHTML = `<tr><td colspan="6" class="text-secondary">沒有符合條件的資料</td></tr>`;
      refs.btnCSV.onclick = ()=> exportCSV([]);
      return;
    }

    refs.tbody.innerHTML = arr.map(v=>{
      const when = toTW(v.ts || v.at);
      const name = v.displayName || '';
      const email = v.email || '';
      const uid = v.uid || '';
      const provider = v.providerId || '';
      const ua = v.ua || v.userAgent || '';
      return `
        <tr>
          <td>${when}</td>
          <td>${name}</td>
          <td>${email}</td>
          <td style="word-break:break-all">${uid}</td>
          <td>${provider}</td>
          <td style="word-break:break-all">${ua}</td>
        </tr>
      `;
    }).join('');

    refs.btnCSV.onclick = ()=> exportCSV(arr);
  }

  // ✨ 點擊 chips 切換 kind
  refs.chips.addEventListener('click', e=>{
    const c = e.target.closest('.chip[data-kind]');
    if (!c) return;
    $$('.chip', refs.chips).forEach(x=>x.classList.remove('active'));
    c.classList.add('active');
    currentKind = c.dataset.kind;   // 'user' | 'admin'
    bind();                         // 重新綁定資料來源
  });

  // 工具列
  refs.btnClear.addEventListener('click', ()=>{
    refs.kw.value = '';
    refs.from.value = '';
    refs.to.value = '';
    render();
  });
  refs.kw.addEventListener('input', render);
  refs.from.addEventListener('change', render);
  refs.to.addEventListener('change', render);

  // 初始：載入 user
  bind();
})();
