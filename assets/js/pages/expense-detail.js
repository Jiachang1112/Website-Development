// assets/js/pages/expense-detail.js
import { fmt } from '../app.js';
import { getEntriesRangeForEmail } from '../entries.js';
import { currentUser } from '../app.js';

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

  // 工具：讓畫面先 paint，再跑資料；同時具備防抖與競態保護
  let latestJob = 0;
  let debounceTimer = null;
  function scheduleRender(wait = 120){
    const job = ++latestJob;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(()=>{
      const run = () => {
        if (job !== latestJob) return; // 有更新就取消舊任務
        render(job);
      };
      if ('requestIdleCallback' in window) {
        requestIdleCallback(run, { timeout: 1200 });
      } else {
        // 兩層 rAF：確保 DOM 先繪製，再進行資料抓取
        requestAnimationFrame(()=> requestAnimationFrame(run));
      }
    }, wait);
  }

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
    const isDay = Boolean(ySel.value && mSel.value && dSel.value);
    const txt = isDay ? '當日' : '期間';
    cap.textContent = txt; cap2.textContent = txt; cap3.textContent = txt;
  }

  function syncDaysAndSchedule(){
    const keep = dSel.value || '';
    fillDays(ySel.value, mSel.value);
    if (mSel.value === ''){
      dSel.value = '';
    }else{
      const lastOpt = dSel.options[dSel.options.length-1];
      const lastDay = lastOpt ? lastOpt.value : '';
      if (keep && keep !== '' && keep <= lastDay) dSel.value = keep;
    }
    updateBadgeCaption();
    list.innerHTML = `<div class="small">載入中…</div>`; // 立即回饋
    scheduleRender(120);
  }
  ySel.addEventListener('change', syncDaysAndSchedule);
  mSel.addEventListener('change', syncDaysAndSchedule);
  dSel.addEventListener('change', ()=>{ updateBadgeCaption(); list.innerHTML = `<div class="small">載入中…</div>`; scheduleRender(60); });

  async function render(jobId){
    const u = currentUser();
    if (!u?.email) {
      list.innerHTML = `<p class="small">請先登入帳號再查看明細。</p>`;
      outEl.textContent = incEl.textContent = balEl.textContent = fmt.money(0);
      return;
    }

    const y = ySel.value;
    const m = mSel.value;   // '' or '01'..'12'
    const d = dSel.value;   // '' or '01'..'31'

    let from, to;
    if (!m){
      from = `${y}-01-01`; to = `${y}-12-31`;
    }else if (!d){
      const ym = `${y}-${m}`;
      from = firstDayOfMonth(ym); to = lastDayOfMonth(ym);
    }else{
      from = yyyyMmDd(y, m, d); to = from;
    }

    // 顯示載入中（避免空白）
    list.innerHTML = `<div class="small">載入中…</div>`;

    const rows = await getEntriesRangeForEmail(u.email, from, to);

    // 若中途又切換日期，丟棄舊結果
    if (jobId !== latestJob) return;

    const outs = rows.filter(r => r.type === 'expense');
    const ins  = rows.filter(r => r.type === 'income');

    const totalOut = outs.reduce((s, a) => s + (Number(a.amount) || 0), 0);
    const totalIn  = ins.reduce((s, a) => s + (Number(a.amount) || 0), 0);

    outEl.textContent = fmt.money(totalOut);
    incEl.textContent = fmt.money(totalIn);
    balEl.textContent = fmt.money(totalIn - totalOut);

    // 排序：createdAt desc → date desc（讓最新紀錄在最上）
    const all = [...rows].sort((a,b)=>{
      const tb = ts(b.createdAt), ta = ts(a.createdAt);
      if (tb !== ta) return tb - ta;
      const db = b.date || '', da = a.date || '';
      return db.localeCompare(da);
    });

    list.innerHTML =
      all.map(r => {
        const typeTxt = r.type === 'income' ? '收入' : '支出';
        const cat  = r.categoryId || '';
        const note = r.note || '';
        const amt  = r.type === 'income' ? +r.amount : -Math.abs(+r.amount || 0);
        return `
          <div class="order-row">
            <div>
              <b>${r.date || ''}</b>
              <span class="badge">${typeTxt}</span>
              <div class="small">${cat}｜${note}</div>
            </div>
            <div>${fmt.money(amt)}</div>
          </div>
        `;
      }).join('') || '<p class="small">這段期間沒有紀錄</p>';
  }

  // 初始化：先更新標籤，**延後**載入資料，讓畫面先出來
  updateBadgeCaption();
  list.innerHTML = `<div class="small">載入中…</div>`;
  scheduleRender(120); // 延後一點，避免阻塞首屏繪製

  return el;
}
