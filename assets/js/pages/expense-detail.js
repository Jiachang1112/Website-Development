// assets/js/pages/expense-detail.js
import { fmt } from '../app.js';
import { getEntriesRangeForEmail } from '../entries.js';
import { currentUser } from '../app.js';

function pad2(n){ return String(n).padStart(2,'0'); }
function daysInMonth(y, m){ return new Date(y, m, 0).getDate(); } // m: 1..12
function yyyyMmDd(y, m, d){ return `${y}-${pad2(m)}-${pad2(d)}`; }
// 讓 createdAt（Firestore Timestamp 或 Date 或字串）可比較
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

  el.innerHTML=`<section class="card"><h3>記帳｜明細</h3>
  <div class="row" style="gap:6px;align-items:center;flex-wrap:wrap">
    <label class="small">日期</label>
    <select id="y" class="form-control" style="min-width:110px"></select>
    <select id="m" class="form-control" style="min-width:90px"></select>
    <select id="d" class="form-control" style="min-width:90px"></select>
  </div>
  <div class="row"><span class="badge">當日結餘：<b id="bal"></b></span><span class="badge">當日支出：<b id="out"></b></span><span class="badge">當日收入：<b id="inc"></b></span></div>
  <div id="list"></div></section>`;

  const ySel = el.querySelector('#y');
  const mSel = el.querySelector('#m');
  const dSel = el.querySelector('#d');
  const outEl= el.querySelector('#out');
  const incEl= el.querySelector('#inc');
  const balEl= el.querySelector('#bal');
  const list = el.querySelector('#list');

  // ===== 填年 2020~3000 =====
  (function fillYears(){
    const frag = document.createDocumentFragment();
    for(let y=2020;y<=3000;y++){
      const o=document.createElement('option');
      o.value=String(y); o.textContent=String(y);
      frag.appendChild(o);
    }
    ySel.appendChild(frag);
  })();

  // ===== 填月 01~12 =====
  (function fillMonths(){
    const frag = document.createDocumentFragment();
    for(let m=1;m<=12;m++){
      const o=document.createElement('option');
      o.value=pad2(m); o.textContent=pad2(m);
      frag.appendChild(o);
    }
    mSel.appendChild(frag);
  })();

  // ===== 依年/月填日 =====
  function fillDays(y, m){
    dSel.innerHTML='';
    const max = daysInMonth(Number(y), Number(m));
    const frag = document.createDocumentFragment();
    for(let d=1; d<=max; d++){
      const o=document.createElement('option');
      o.value=pad2(d); o.textContent=pad2(d);
      frag.appendChild(o);
    }
    dSel.appendChild(frag);
  }

  // 初始化今天
  ySel.value = String(y0);
  mSel.value = pad2(m0);
  fillDays(ySel.value, mSel.value);
  dSel.value = pad2(d0);

  // 年/月變更時重建天數並盡量保留目前日
  function syncDaysAndRender(){
    const keep = Number(dSel.value || '1');
    fillDays(ySel.value, mSel.value);
    const last = Number(dSel.options[dSel.options.length-1].value);
    dSel.value = pad2(Math.min(keep, last));
    render();
  }
  ySel.addEventListener('change', syncDaysAndRender);
  mSel.addEventListener('change', syncDaysAndRender);
  dSel.addEventListener('change', render);

  async function render(){
    const u = currentUser();
    if (!u?.email) {
      list.innerHTML = `<p class="small">請先登入帳號再查看明細。</p>`;
      outEl.textContent = incEl.textContent = balEl.textContent = fmt.money(0);
      return;
    }

    const dateStr = yyyyMmDd(ySel.value, mSel.value, dSel.value);

    // 讀取「當天」範圍（from = to = 當天）
    const rows = await getEntriesRangeForEmail(u.email, dateStr, dateStr);

    const outs = rows.filter(r => r.type === 'expense');
    const ins  = rows.filter(r => r.type === 'income');

    const totalOut = outs.reduce((s, a) => s + (Number(a.amount) || 0), 0);
    const totalIn  = ins.reduce((s, a) => s + (Number(a.amount) || 0), 0);

    outEl.textContent = fmt.money(totalOut);
    incEl.textContent = fmt.money(totalIn);
    balEl.textContent = fmt.money(totalIn - totalOut);

    // 排序：createdAt desc → date desc（新到舊）
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
      }).join('') || '<p class="small">這天沒有紀錄</p>';
  }

  render();
  return el;
}
