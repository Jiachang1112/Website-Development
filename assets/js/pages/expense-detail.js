// assets/js/pages/expense-detail.js
import { fmt } from '../app.js';
import { getEntriesRangeForEmail } from '../entries.js';
import { currentUser } from '../app.js';

// 🔽 新增：刪除所需的 firestore 函式
import { db } from '../firebase.js';
import { doc, deleteDoc } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

function pad2(n){ return String(n).padStart(2,'0'); }
function daysInMonth(y, m){ return new Date(y, m, 0).getDate(); } // m: 1..12
function yyyyMmDd(y, m, d){ return `${y}-${pad2(m)}-${pad2(d)}`; }
function firstDayOfMonth(ym) { return ym + '-01'; }
function lastDayOfMonth(ym) {
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
  <div id="list"></div></section>`;

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

  // === 內嵌樣式（只注入一次） ===
  if (!document.getElementById('swipe-style')) {
    const st = document.createElement('style');
    st.id = 'swipe-style';
    st.textContent = `
      .swipe-wrap{ position:relative; overflow:hidden; }
      .swipe-delete{
        position:absolute; inset:0 0 0 auto; width:88px; background:#dc2626; color:#fff;
        display:flex; align-items:center; justify-content:center; font-weight:700; border:none; cursor:pointer;
      }
      .swipe-content{ background:transparent; transform: translateX(0); transition: transform .18s ease; }
      .swipe-open .swipe-content{ transform: translateX(88px); }
      .order-row{ display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border-bottom:1px solid rgba(0,0,0,.08); background: rgba(255,255,255,.02); }
      .order-row .small{ opacity:.85 }
    `;
    document.head.appendChild(st);
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

  // 初始化今天
  ySel.value = String(y0);
  mSel.value = pad2(m0);
  fillDays(ySel.value, mSel.value);
  dSel.value = pad2(d0);

  function updateBadgeCaption(){
    const isDay = Boolean(ySel.value && mSel.value && dSel.value);
    const txt = isDay ? '當日' : '期間';
    cap.textContent = txt; cap2.textContent = txt; cap3.textContent = txt;
  }

  function syncDaysAndRender(){
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
    render();
  }
  ySel.addEventListener('change', syncDaysAndRender);
  mSel.addEventListener('change', syncDaysAndRender);
  dSel.addEventListener('change', ()=>{ updateBadgeCaption(); render(); });

  async function render(){
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
    if (!m){ // 整年
      from = `${y}-01-01`;
      to   = `${y}-12-31`;
    }else if (!d){ // 整月
      const ym = `${y}-${m}`;
      from = firstDayOfMonth(ym);
      to   = lastDayOfMonth(ym);
    }else{ // 當天
      from = yyyyMmDd(y, m, d);
      to   = from;
    }

    const rows = await getEntriesRangeForEmail(u.email, from, to);

    const outs = rows.filter(r => r.type === 'expense');
    const ins  = rows.filter(r => r.type === 'income');

    const totalOut = outs.reduce((s, a) => s + (Number(a.amount) || 0), 0);
    const totalIn  = ins.reduce((s, a) => s + (Number(a.amount) || 0), 0);

    outEl.textContent = fmt.money(totalOut);
    incEl.textContent = fmt.money(totalIn);
    balEl.textContent = fmt.money(totalIn - totalOut);

    // 排序：createdAt desc → date desc
    const all = [...rows].sort((a,b)=>{
      const tb = ts(b.createdAt), ta = ts(a.createdAt);
      if (tb !== ta) return tb - ta;
      const db = b.date || '', da = a.date || '';
      return db.localeCompare(da);
    });

    // 建立列表（加上滑動刪除外層）
    list.innerHTML =
      all.map(r => {
        // 嘗試多種欄位名稱拿 docId（請確保你的 entries 有回傳 id）
        const rid = r.id || r.docId || r._id || '';
        const canDelete = !!rid;
        const typeTxt = r.type === 'income' ? '收入' : '支出';
        const cat  = r.categoryId || '';
        const note = r.note || '';
        const amt  = r.type === 'income' ? +r.amount : -Math.abs(+r.amount || 0);
        return `
          <div class="swipe-wrap ${canDelete ? '' : 'no-del'}" data-id="${rid}">
            ${canDelete ? `<button class="swipe-delete" data-id="${rid}" title="刪除">刪除</button>` : ``}
            <div class="swipe-content">
              <div class="order-row">
                <div>
                  <b>${r.date || ''}</b>
                  <span class="badge">${typeTxt}</span>
                  <div class="small">${cat}｜${note}</div>
                </div>
                <div>${fmt.money(amt)}</div>
              </div>
            </div>
          </div>
        `;
      }).join('') || '<p class="small">這段期間沒有紀錄</p>';

    // 綁定刪除按鈕
    list.querySelectorAll('.swipe-delete').forEach(btn=>{
      btn.addEventListener('click', async (e)=>{
        const id = e.currentTarget.getAttribute('data-id');
        if (!id) return;
        if (!confirm('確定要刪除這筆記錄嗎？')) return;
        try{
          await deleteDoc(doc(db, 'expenses', u.email, 'entries', id));
          // 刪除後重新渲染
          render();
        }catch(err){
          console.error(err);
          alert('刪除失敗：' + (err?.message || err));
        }
      });
    });

    // 綁定滑動手勢（向右滑露出刪除）
    attachSwipe(list);
  }

  function attachSwipe(root){
    let startX=0, curX=0, dragging=false, opened=null;

    function onStart(e){
      const wrap = e.target.closest('.swipe-wrap');
      if (!wrap || wrap.classList.contains('no-del')) return;

      dragging = true;
      startX = (e.touches?.[0]?.clientX ?? e.clientX);
      curX = 0;

      // 關閉其它已開
      if (opened && opened !== wrap){
        opened.classList.remove('swipe-open');
        opened = null;
      }

      wrap.addEventListener('touchmove', onMove, {passive:false});
      wrap.addEventListener('mousemove', onMove);
      wrap.addEventListener('touchend', onEnd);
      wrap.addEventListener('mouseup', onEnd);
      wrap.addEventListener('mouseleave', onEnd);
      wrap._startWrapX = 0;
      wrap._curWrap = wrap;
    }
    function onMove(e){
      if(!dragging) return;
      const wrap = e.currentTarget._curWrap;
      const x = (e.touches?.[0]?.clientX ?? e.clientX);
      const dx = Math.max(0, x - startX); // 只允許向右
      curX = Math.min(88, dx);
      const content = wrap.querySelector('.swipe-content');
      if (content){
        content.style.transition = 'none';
        content.style.transform = `translateX(${curX}px)`;
      }
      if (dx>0 && e.cancelable) e.preventDefault();
    }
    function onEnd(e){
      if(!dragging) return;
      dragging = false;
      const wrap = e.currentTarget._curWrap;
      const content = wrap.querySelector('.swipe-content');
      const keepOpen = curX > 44; // 超過一半就打開
      if (content){
        content.style.transition = '';
        content.style.transform = '';
      }
      wrap.classList.toggle('swipe-open', keepOpen);
      opened = keepOpen ? wrap : null;

      w
