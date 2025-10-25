// assets/js/pages/expense-detail.js
import { fmt } from '../app.js';
import { getEntriesRangeForEmail } from '../entries.js';
import { currentUser } from '../app.js';

// Firestore 刪除工具
import { db } from '../firebase.js';
import { doc, getDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

/* ========= 工具函式 ========= */
function pad2(n){ return String(n).padStart(2,'0'); }
function daysInMonth(y, m){ return new Date(y, m, 0).getDate(); }
function yyyyMmDd(y, m, d){ return `${y}-${pad2(m)}-${pad2(d)}`; }
function firstDayOfMonth(ym){ return ym + '-01'; }
function lastDayOfMonth(ym){
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 0);
  return d.toISOString().slice(0, 10);
}
function ts(v){
  if (!v) return 0;
  try{ if (typeof v.toDate === 'function') return v.toDate().getTime(); }catch{}
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : 0;
}
const TX_CACHE = new Map();

/* ========= 刪除 Modal ========= */
(function injectModalStyle(){
  const css = document.createElement('style');
  css.textContent = `
  .tx-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);display:none;z-index:1000}
  .tx-modal{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);
    width:min(520px,92vw);background:#1f2937;color:#fff;border-radius:14px;
    box-shadow:0 10px 30px rgba(0,0,0,.35);display:none;z-index:1001}
  .tx-modal header{padding:14px 16px;border-bottom:1px solid #374151;
    display:flex;justify-content:space-between;align-items:center}
  .tx-modal main{padding:14px 16px;display:grid;gap:10px}
  .tx-modal footer{padding:14px 16px;border-top:1px solid #374151;
    display:flex;justify-content:flex-end;gap:8px}
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
        <button class="tx-btn ghost" id="txd-close">關閉</button>
      </header>
      <main>
        <div><small>日期</small><div id="txd-date">-</div></div>
        <div><small>類型</small><div id="txd-type">-</div></div>
        <div><small>分類</small><div id="txd-cat">-</div></div>
        <div><small>金額</small><div id="txd-amt">-</div></div>
        <div><small>備註</small><div id="txd-note">—</div></div>
      </main>
      <footer>
        <button class="tx-btn ghost" id="txd-cancel">返回</button>
        <button class="tx-btn danger" id="txd-delete">刪除</button>
      </footer>
    `;
    document.body.appendChild(modal);

    const close = ()=>{ modal.style.display='none'; backdrop.style.display='none'; };
    backdrop.addEventListener('click', close);
    modal.querySelector('#txd-close').addEventListener('click', close);
    modal.querySelector('#txd-cancel').addEventListener('click', close);

    // 刪除按鈕事件
    modal.querySelector('#txd-delete').addEventListener('click', async ()=>{
      const id = modal.dataset.id || '';
      const uid = modal.dataset.uid || '';
      const bookId = modal.dataset.bookId || '';
      const path = modal.dataset.path || '';
      const email = modal.dataset.email || '';

      if (!confirm('確定要刪除此筆紀錄嗎？')) return;

      const btn = modal.querySelector('#txd-delete');
      btn.disabled = true;
      try {
        await smartDelete({ id, uid, bookId, path, email });
        close();
        // 直接從列表移除
        document.querySelector(`[data-path="${path}"]`)?.remove();
        if (typeof window.__expense_detail_scheduleRender === 'function')
          window.__expense_detail_scheduleRender(0);
      } catch (err) {
        alert('刪除失敗：' + (err.message || err));
        btn.disabled = false;
      }
    });
  }
  return { backdrop, modal };
}

function openTxModal(row, uid){
  const { backdrop, modal } = ensureTxModal();
  const isIncome = String(row.type||'').toLowerCase()==='income';

  modal.dataset.id     = row.id || '';
  modal.dataset.uid    = uid || '';
  modal.dataset.bookId = row.bookId || '';
  modal.dataset.path   = row.__path || row.path || '';
  modal.dataset.email  = row.__email || '';

  modal.querySelector('#txd-title').textContent = `明細｜${isIncome?'收入':'支出'}`;
  modal.querySelector('#txd-date').textContent  = row.date || '';
  modal.querySelector('#txd-type').textContent  = isIncome ? '收入' : '支出';
  modal.querySelector('#txd-cat').textContent   = row.categoryId || row.categoryName || '其他';
  modal.querySelector('#txd-amt').textContent   = fmt.money(Number(row.amount)||0);
  modal.querySelector('#txd-note').textContent  = row.note || '—';

  backdrop.style.display='block';
  modal.style.display='block';
}

/* ========= 智慧刪除 ========= */
async function smartDelete({ id, uid='', bookId='', path='', email='' }) {
  if (path) {
    await deleteDoc(doc(db, path));
    return true;
  }
  if (email && id) {
    const p = `expenses/${email}/entries/${id}`;
    await deleteDoc(doc(db, p));
    return true;
  }
  const candidates = [
    id ? `entries/${id}` : null,
    id ? `expenses/${id}` : null,
    id ? `incomes/${id}` : null,
  ].filter(Boolean);
  for (const p of candidates) {
    const ref = doc(db, p);
    const s = await getDoc(ref).catch(()=>null);
    if (s && s.exists()) {
      await deleteDoc(ref);
      return true;
    }
  }
  throw new Error('找不到可刪除的雲端文件（缺少 path 或 email+id）');
}

/* ========= 主頁面 ========= */
export function ExpenseDetailPage(){
  const el=document.createElement('div');
  el.className='container';

  const now = new Date();
  const y0 = now.getFullYear();
  const m0 = now.getMonth()+1;
  const d0 = now.getDate();

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

  const ySel=el.querySelector('#y'),mSel=el.querySelector('#m'),
        dSel=el.querySelector('#d'),outEl=el.querySelector('#out'),
        incEl=el.querySelector('#inc'),balEl=el.querySelector('#bal'),
        list=el.querySelector('#list'),cap=el.querySelector('#cap'),
        cap2=el.querySelector('#cap2'),cap3=el.querySelector('#cap3');

  let latestJob=0,debounceTimer=null;
  function scheduleRender(wait=120){
    const job=++latestJob;
    clearTimeout(debounceTimer);
    debounceTimer=setTimeout(()=>{
      const run=()=>{ if(job!==latestJob)return; render(job); };
      requestAnimationFrame(()=>requestAnimationFrame(run));
    },wait);
  }
  window.__expense_detail_scheduleRender = scheduleRender;

  function addNotSpecifiedOption(sel,txt='不指定'){
    const o=document.createElement('option');o.value='';o.textContent=txt;sel.appendChild(o);
  }

  (function fillYears(){
    const frag=document.createDocumentFragment();
    for(let y=2020;y<=3000;y++){const o=document.createElement('option');o.value=String(y);o.textContent=String(y);frag.appendChild(o);}
    ySel.appendChild(frag);
  })();

  (function fillMonths(){
    addNotSpecifiedOption(mSel,'不指定月份');
    const frag=document.createDocumentFragment();
    for(let m=1;m<=12;m++){const o=document.createElement('option');o.value=pad2(m);o.textContent=pad2(m);frag.appendChild(o);}
    mSel.appendChild(frag);
  })();

  function fillDays(y,m){
    dSel.innerHTML='';addNotSpecifiedOption(dSel,'不指定日期');
    if(!m)return;
    const max=daysInMonth(Number(y),Number(m)),frag=document.createDocumentFragment();
    for(let d=1;d<=max;d++){const o=document.createElement('option');o.value=pad2(d);o.textContent=pad2(d);frag.appendChild(o);}
    dSel.appendChild(frag);
  }

  ySel.value=String(y0);mSel.value=pad2(m0);fillDays(ySel.value,mSel.value);dSel.value=pad2(d0);

  function updateCaption(){
    const isDay=!!(ySel.value&&mSel.value&&dSel.value);
    const t=isDay?'當日':'期間';cap.textContent=t;cap2.textContent=t;cap3.textContent=t;
  }
  function syncAndRender(){
    fillDays(ySel.value,mSel.value);
    updateCaption();
    list.innerHTML=`<div class="small">載入中…</div>`;
    scheduleRender(120);
  }
  ySel.onchange=syncAndRender;mSel.onchange=syncAndRender;
  dSel.onchange=()=>{updateCaption();scheduleRender(60);};

  async function render(jobId){
    const u=currentUser();
    if(!u?.email){list.innerHTML=`<p class="small">請先登入帳號</p>`;return;}

    const y=ySel.value,m=mSel.value,d=dSel.value;
    let from,to;
    if(!m){from=`${y}-01-01`;to=`${y}-12-31`;}
    else if(!d){const ym=`${y}-${m}`;from=firstDayOfMonth(ym);to=lastDayOfMonth(ym);}
    else{from=yyyyMmDd(y,m,d);to=from;}

    const rows=await getEntriesRangeForEmail(u.email,from,to);
    if(jobId!==latestJob)return;

    const outs=rows.filter(r=>r.type==='expense');
    const ins=rows.filter(r=>r.type==='income');
    const totalOut=outs.reduce((s,a)=>s+(+a.amount||0),0);
    const totalIn=ins.reduce((s,a)=>s+(+a.amount||0),0);

    outEl.textContent=fmt.money(totalOut);
    incEl.textContent=fmt.money(totalIn);
    balEl.textContent=fmt.money(totalIn-totalOut);

    const all=[...rows].sort((a,b)=>ts(b.createdAt)-ts(a.createdAt));
    list.innerHTML=all.map(r=>{
      const typeTxt=r.type==='income'?'收入':'支出';
      const amt=r.type==='income'?+r.amount:-Math.abs(+r.amount||0);
      const path=r.__path||r.path||'';
      TX_CACHE.set(path,r);
      return `
        <div class="order-row" data-path="${path}" style="cursor:pointer">
          <div><b>${r.date||''}</b>
            <span class="badge">${typeTxt}</span>
            <div class="small">${r.categoryId||''}｜${r.note||''}</div>
          </div>
          <div>${fmt.money(amt)}</div>
        </div>`;
    }).join('')||'<p class="small">沒有紀錄</p>';

    list.querySelectorAll('.order-row').forEach(div=>{
      div.addEventListener('click',()=>{
        const row=TX_CACHE.get(div.dataset.path)||{};
        openTxModal(row,u.uid||'');
      });
    });
  }

  updateCaption();scheduleRender(120);
  return el;
}

