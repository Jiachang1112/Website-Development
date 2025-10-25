// assets/js/pages/expense-detail.js
import { fmt } from '../app.js';
import { getEntriesRangeForEmail } from '../entries.js';
import { currentUser } from '../app.js';

// Firestore：刪除用
import { db } from '../firebase.js';
import { doc, getDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

/* -------------------- 工具 -------------------- */
function pad2(n){ return String(n).padStart(2,'0'); }
function daysInMonth(y, m){ return new Date(y, m, 0).getDate(); } // m: 1..12
function yyyyMmDd(y, m, d){ return `${y}-${pad2(m)}-${pad2(d)}`; }
function firstDayOfMonth(ym) { return ym + '-01'; }
function lastDayOfMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 0);
  return d.toISOString().slice(0, 10);
}
// 讓 createdAt（Firestore Timestamp/Date/ISO）可比較
function ts(v){
  if (!v) return 0;
  try{ if (typeof v.toDate === 'function') return v.toDate().getTime(); }catch{}
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : 0;
}
const TX_CACHE = new Map(); // { (id or path) -> row }

/* -------------------- 內頁 Modal -------------------- */
(function injectModalStyle(){
  const css = document.createElement('style');
  css.textContent = `
  .tx-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.5);display:none;z-index:1000}
  .tx-modal{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);
            width:min(520px,92vw);background:#1f2937;color:#fff;border-radius:14px;
            box-shadow:0 10px 30px rgba(0,0,0,.35);display:none;z-index:1001}
  .tx-modal header{padding:14px 16px;border-bottom:1px solid #374151;display:flex;justify-content:space-between;align-items:center}
  .tx-modal main{padding:14px 16px;display:grid;gap:10px}
  .tx-modal footer{padding:14px 16px;border-top:1px solid #374151;display:flex;justify-content:flex-end;gap:8px}
  .tx-btn{border:none;border-radius:10px;padding:10px 14px;cursor:pointer}
  .tx-btn.ghost{background:#374151;color:#fff}
  .tx-btn.danger{background:#ef4444;color:#fff}
  `;
  document.head.appendChild(css);
})();

function ensureTxModal(){
  let backdrop = document.querySelector('.tx-modal-backdrop');
  let modal = document.querySelector('.tx-modal');
  if(!backdrop){
    backdrop = document.createElement('div');
    backdrop.className = 'tx-modal-backdrop';
    document.body.appendChild(backdrop);
  }
  if(!modal){
    modal = document.createElement('div');
    modal.className = 'tx-modal';
    modal.innerHTML = `
      <header>
        <strong id="txd-title">明細</strong>
        <button class="tx-btn ghost" id="txd-close" aria-label="關閉">關閉</button>
      </header>
      <main>
        <div><small class="muted">日期</small><div id="txd-date">-</div></div>
        <div><small class="muted">類型</small><div id="txd-type">-</div></div>
        <div><small class="muted">分類</small><div id="txd-cat">-</div></div>
        <div><small class="muted">金額</small><div id="txd-amt">-</div></div>
        <div><small class="muted">備註</small><div id="txd-note">—</div></div>
      </main>
      <footer>
        <button class="tx-btn ghost"  id="txd-cancel">返回</button>
        <button class="tx-btn danger" id="txd-delete">刪除</button>
      </footer>
    `;
    document.body.appendChild(modal);

    const close = ()=>{ modal.style.display='none'; backdrop.style.display='none'; };
    backdrop.addEventListener('click', close);
    modal.querySelector('#txd-close').addEventListener('click', close);
    modal.querySelector('#txd-cancel').addEventListener('click', close);

    // 刪除按鈕
    modal.querySelector('#txd-delete').addEventListener('click', async ()=>{
      const id     = modal.dataset.id    || '';
      const uid    = modal.dataset.uid   || '';
      const bookId = modal.dataset.bookId|| '';
      const path   = modal.dataset.path  || '';
      const email  = modal.dataset.email || '';

      if (!confirm('確定要刪除此筆紀錄嗎？')) return;

      const btn = modal.querySelector('#txd-delete');
      btn.disabled = true;
      try{
        await smartDelete({ id, uid, bookId, path, email });
        close();

        // 從列表移除該列（id+path 皆嘗試）
        const sel = `.order-row${id ? `[data-id="${CSS.escape(id)}"]` : ''}${path ? `[data-path="${CSS.escape(path)}"]` : ''}`;
        document.querySelector(sel)?.remove();

        // 重新拉資料重算（穩妥）
        if (typeof window.__expense_detail_scheduleRender === 'function') {
          window.__expense_detail_scheduleRender(0);
        }
      }catch(err){
        alert('刪除失敗：' + (err?.message || err));
        btn.disabled = false;
      }
    });

    // ESC
    document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') close(); });
  }
  return { backdrop, modal };
}

function openTxModal(row, uid){
  const { backdrop, modal } = ensureTxModal();
  const isIncome = String(row.type||'').toLowerCase()==='income';

  // 把識別資訊塞進 dataset（刪除時用）
  modal.dataset.id     = row.id || '';
  modal.dataset.uid    = uid || '';
  modal.dataset.bookId = row.bookId || '';
  modal.dataset.path   = row.__path || row.path || '';
  modal.dataset.email  = row.__email || '';

  modal.querySelector('#txd-title').textContent = `明細｜${isIncome?'收入':'支出'}`;
  modal.querySelector('#txd-date').textContent  = row.date || '';
  modal.querySelector('#txd-type').textContent  = isIncome ? '收入' : '支出';
  modal.querySelector('#txd-cat').textContent   = row.categoryId || row.categoryName || row.cat || '其他';
  modal.querySelector('#txd-amt').textContent   = fmt.money(Number(row.amount)||0);
  modal.querySelector('#txd-note').textContent  = row.note || row.memo || '—';
  backdrop.style.display='block';
  modal.style.display='block';
}

// 聰明刪除：優先用完整 path；沒有就用 email+id 組路徑；再退候選
async function smartDelete({ id, uid='', bookId='', path='', email='' }) {
  // 1) 明確 path（最準）
  if (path) {
    await deleteDoc(doc(db, path));
    return true;
  }
  // 2) 依你的實際結構（expenses/{email}/entries/{id}）組路徑
  if (email && id) {
    const p = `expenses/${email}/entries/${id}`;
    await deleteDoc(doc(db, p));
    return true;
  }
  // 3) 其它常見候選（保險）
  const candidates = [
    id ? `entries/${id}` : null,
    (uid && id) ? `users/${uid}/entries/${id}` : null,
    id ? `transactions/${id}` : null,
    id ? `expenses/${id}` : null,
    id ? `incomes/${id}` : null,
    (uid && bookId && id) ? `users/${uid}/books/${bookId}/transactions/${id}` : null
  ].filter(Boolean);

  for (const p of candidates) {
    const ref = doc(db, p);
    const s = await getDoc(ref).catch(()=>null);
    if (s && s.exists()) {
      await deleteDoc(ref);
      return true;
    }
  }
  throw new Error('找不到可刪除的雲端文件：缺少 path 或 email+id');
}

/* -------------------- 主頁面 -------------------- */
export function ExpenseDetailPage(){
  const el=document.createElement('div');
  el.className='container';

  const now = new Date();
  const y0 = now.getFullYear();
  const m0 = now.getMonth()+1;
  const d0 = now.getDate();

  // 先把 UI 畫出來（不等資料）
  el.innerHTML=`<section class="card"><h3>記帳｜明細</h3>
  <div class="row" style="gap:6px;align-items:center;flex-wrap:wrap">
    <label class="small">日期</label>
    <select id="y" class="form-control" style="min-width:110px"></select>
    <select id="m" class="form-control" style="min-width:90px"></select>
    <select id="d" class="form-control" style="min-width:90px"></select>
  </div>
  <div class="row">
    <span class="badge"><span id="cap">當日</span>結餘：<b id="bal"></b></span>
    <span class="badge"><span id="cap2">當日</span>支出：<b id="out"></b></span>
    <span class="badge"><span id="cap3">當日</span>收入：<b id="inc"></b></span>
  </div>
  <div id="list"><div class="small">載入中…</div></div></section>`;

  const ySel = el.querySelector('#y');
  const mSel = el.querySelector('#m');
  const dSel = el.querySelector('#d');
  const outEl= el.querySelector('#out');
  const incEl= el.querySelector('#inc');
  const balEl= el.querySelector('#bal');
  const list = el.querySelector('#list');
  const cap  = el.querySelector('#cap');
  const cap2 = el.querySelector('#cap2');
  const cap3 = el.querySelector('#cap3');

  // 讓畫面先 paint 再跑資料；具備防抖與競態保護
  let latestJob = 0;
  let debounceTimer = null;
  function scheduleRender(wait = 120){
    const job = ++latestJob;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(()=>{
      const run = () => {
        if (job !== latestJob) return;
        render(job);
      };
      if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 1200 });
      else requestAnimationFrame(()=> requestAnimationFrame(run));
    }, wait);
  }
  // 讓刪除後可重新觸發（給 modal 里呼叫）
  window.__expense_detail_scheduleRender = scheduleRender;

  function addNotSpecifiedOption(select, text='不指定'){
    const o = document.createElement('option');
    o.value = '';
    o.textContent = text;
    select.appendChild(o);
  }

  // 年 2020~3000
  (function fillYears(){
    const frag = document.createDocumentFragment();
    for(let y=2020;y<=3000;y++){
      const o=document.createElement('option');
      o.value=String(y); o.textContent=String(y);
      frag.appendChild(o);
    }
    ySel.appendChild(frag);
  })();

  // 月份：不指定 + 01~12
  (function fillMonths(){
    addNotSpecifiedOption(mSel, '不指定月份');
    const frag = document.createDocumentFragment();
    for(let m=1;m<=12;m++){
      const o=document.createElement('option');
      o.value=pad2(m); o.textContent=pad2(m);
      frag.appendChild(o);
    }
    mSel.appendChild(frag);
  })();

  // 日期：依年/月；第一個固定「不指定日期」
  function fillDays(y, m){
    dSel.innerHTML='';
    addNotSpecifiedOption(dSel, '不指定日期');
    if (!m){ return; }
    const max = daysInMonth(Number(y), Number(m));
    const frag = document.createDocumentFragment();
    for(let d=1; d<=max; d++){
      const o=document.createElement('option');
      o.value=pad2(d); o.textContent=pad2(d);
      frag.appendChild(o);
    }
    dSel.appendChild(frag);
  }

  // 初始化今天（但資料載入延後呼叫）
  ySel.value = String(y0);
  mSel.value = pad2(m0);
  fillDays(ySel.value, mSel.value);
  dSel.value = pad2(d0);

  function updateBadgeCaption(){
  

