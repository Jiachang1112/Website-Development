// assets/js/pages/expense-detail.js
// 以「年 / 月 / 日」選擇當天，顯示該日明細（最新在最上）
// 資料來源：getEntriesRangeForEmail(email, from, to)
// 登入：先用 currentUser()，不行再等 Firebase Auth ready

import { fmt } from '../app.js';
import { getEntriesRangeForEmail } from '../entries.js';
import { currentUser } from '../app.js';

// 追加：等 Firebase Auth 就緒（避免已登入卻被判定尚未登入）
import { auth } from '../firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';

function pad2(n){ return String(n).padStart(2,'0'); }
function daysInMonth(y,m){ return new Date(y, m, 0).getDate(); } // m: 1..12

function yyyyMmDd(y,m,d){
  return `${y}-${pad2(m)}-${pad2(d)}`;
}
function firstMomentOf(dateStr){ return dateStr; }           // 'YYYY-MM-DD'
function lastMomentOf(dateStr){ return dateStr; }            // 同一天查詢，from=to=同日

async function waitActiveEmail(timeoutMs = 2000){
  const u1 = currentUser();
  if (u1?.email) return u1.email;

  return new Promise(resolve=>{
    let done = false;
    const unsub = onAuthStateChanged(auth, u=>{
      if (done) return;
      if (u?.email){ done = true; try{unsub();}catch{} resolve(u.email); }
    });
    setTimeout(()=>{
      if (done) return;
      done = true;
      try{unsub();}catch{}
      const u2 = currentUser();
      resolve(u2?.email || null);
    }, timeoutMs);
  });
}

export function ExpenseDetailPage(){
  const el = document.createElement('div');
  el.className = 'container';

  const now = new Date();
  const y0 = now.getFullYear();
  const m0 = now.getMonth()+1;
  const d0 = now.getDate();

  el.innerHTML = `
    <section class="card">
      <h3>記帳｜明細</h3>

      <div class="row" style="gap:6px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
        <label class="small">日期</label>
        <select id="y" class="form-control" style="min-width:100px"></select>
        <select id="m" class="form-control" style="min-width:90px"></select>
        <select id="d" class="form-control" style="min-width:90px"></select>
        <button id="load" class="btn btn-primary">載入當天紀錄</button>
      </div>

      <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:6px">
        <span class="badge">當日結餘：<b id="bal"></b></span>
        <span class="badge">當日支出：<b id="out"></b></span>
        <span class="badge">當日收入：<b id="inc"></b></span>
      </div>

      <div id="list"></div>
    </section>
  `;

  const ySel = el.querySelector('#y');
  const mSel = el.querySelector('#m');
  const dSel = el.querySelector('#d');
  const btn  = el.querySelector('#load');
  const outEl= el.querySelector('#out');
  const incEl= el.querySelector('#inc');
  const balEl= el.querySelector('#bal');
  const list = el.querySelector('#list');

  // ===== 年/月/日選單 =====
  (function fillYears(){
    const frag = document.createDocumentFragment();
    for(let y=2020;y<=3000;y++){
      const o=document.createElement('option');
      o.value=o.textContent=String(y);
      frag.appendChild(o);
    }
    ySel.appendChild(frag);
  })();

  (function fillMonths(){
    const frag=document.createDocumentFragment();
    for(let m=1;m<=12;m++){
      const o=document.createElement('option');
      o.value=o.textContent=pad2(m);
      frag.appendChild(o);
    }
    mSel.appendChild(frag);
  })();

  function fillDays(y,m){
    dSel.innerHTML='';
    const max=daysInMonth(Number(y), Number(m));
    const frag=document.createDocumentFragment();
    for(let d=1; d<=max; d++){
      const o=document.createElement('option');
      o.value=o.textContent=pad2(d);
      frag.appendChild(o);
    }
    dSel.appendChild(frag);
  }

  // 初始化今天
  ySel.value = String(y0);
  mSel.value = pad2(m0);
  fillDays(ySel.value, mSel.value);
  dSel.value = pad2(d0);

  // 年/月變更時重建天數，並保留/調整選中的日
  function syncDays(){
    const keep = Number(dSel.value || '1');
    fillDays(ySel.value, mSel.value);
    const last = Number(dSel.options[dSel.options.length-1].value);
    dSel.value = pad2(Math.min(keep, last));
  }
  ySel.addEventListener('change', syncDays);
  mSel.addEventListener('change', syncDays);

  // ===== 載入資料 =====
  async function render(){
    list.innerHTML = `<p class="small">載入中...</p>`;
    const email = await waitActiveEmail();
    if (!email){
      list.innerHTML = `<p class="small">請先登入帳號再查看明細。</p>`;
      outEl.textContent = incEl.textContent = balEl.textContent = fmt.money(0);
      return;
    }

    const dateStr = yyyyMmDd(ySel.value, mSel.value, dSel.value);
    const from = firstMomentOf(dateStr);
    const to   = lastMomentOf(dateStr);

    // 讀當天（from=to）
    const rows = await getEntriesRangeForEmail(email, from, to);

    // 當天收入/支出加總
    const outs = rows.filter(r => r.type === 'expense');
    const ins  = rows.filter(r => r.type === 'income');
    const totalOut = outs.reduce((s,a)=> s + (Number(a.amount)||0), 0);
    const totalIn  = ins.reduce((s,a)=> s + (Number(a.amount)||0), 0);

    outEl.textContent = fmt.money(totalOut);
    incEl.textContent = fmt.money(totalIn);
    balEl.textContent = fmt.money(totalIn - totalOut);

    // 排序：先以 createdAt desc；沒有 createdAt 就以 date desc、再以 amount/id 當 tiebreaker
    const toTs = v => {
      if (!v) return 0;
      try{ if (typeof v.toDate === 'function') return v.toDate().getTime(); }catch{}
      const s = typeof v === 'string' ? v : String(v);
      const t = Date.parse(s);
      return Number.isFinite(t) ? t : 0;
    };

    const all = [...rows].sort((a,b)=>{
      const ta = toTs(a.createdAt), tb = toTs(b.createdAt);
      if (tb !== ta) return tb - ta;                      // createdAt 新→舊
      const da = a.date || '', db = b.date || '';
      if (db !== da) return db.localeCompare(da);         // 其次用 date 新→舊
      return (b.amount||0) - (a.amount||0);               // 再用金額
    });

    list.innerHTML =
      (all.map(r=>{
        const typeTxt = r.type === 'income' ? '收入' : '支出';
        const cat  = r.categoryId || r.category || '';
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
      }).join(''))) || '<p class="small">這天沒有紀錄</p>';
  }

  btn.addEventListener('click', render);
  // 預設自動載入今天
  render();

  return el;
}
