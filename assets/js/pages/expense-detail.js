// assets/js/pages/expense-detail.js
import { fmt } from '../app.js';
import {
  getEntriesRangeWithIdsForEmail,
  deleteEntryForEmail
} from '../entries.js';
import { currentUser } from '../app.js';

function monthRange(ym) {
  // ym = 'YYYY-MM'
  const [y, m] = ym.split('-').map(n=>+n);
  const first = new Date(y, m-1, 1);
  const last  = new Date(y, m, 0);
  const toStr = (d)=> d.toISOString().slice(0,10);
  return { from: toStr(first), to: toStr(last) };
}

export function ExpenseDetailPage(){
  const el = document.createElement('div');
  el.className = 'container';

  const ym = new Date().toISOString().slice(0,7);
  el.innerHTML = `
    <section class="card">
      <h3>記帳｜明細</h3>

      <div class="row">
        <label class="small">月份</label>
        <input id="m" type="month" value="${ym}" />
      </div>

      <div class="row" style="gap:8px;margin-top:6px;flex-wrap:wrap">
        <span class="badge">月結餘：<b id="bal">-</b></span>
        <span class="badge">月支出：<b id="out">-</b></span>
        <span class="badge">月收入：<b id="inc">-</b></span>
      </div>

      <div class="small muted" style="margin-top:8px">
        提示：在列表上<strong>往左滑</strong>可顯示「取消 / 確定刪除」。刪除後不可復原。
      </div>

      <div id="list" style="margin-top:10px"></div>
    </section>
  `;

  // 內嵌樣式（滑動 + 動作列）
  const css = document.createElement('style');
  css.textContent = `
    .slip-row{
      position: relative;
      overflow: hidden;
      border-bottom: 1px solid #ffffff22;
      border-radius: 10px;
      background: #0f1520;
      margin-bottom: 8px;
    }
    .slip-track{
      position: relative;
      display: flex;
      align-items: stretch;
      transition: transform .18s ease;
      will-change: transform;
    }
    .slip-content{
      flex: 1 1 auto;
      padding: 10px 12px;
    }
    .slip-actions{
      flex: 0 0 180px; /* 動作區寬度 */
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 8px;
      background: #1a2230;
      border-left: 1px solid #2b3546;
    }
    .slip-actions .btn-cancel{
      background: #374151; border:1px solid #4b5563; color:#e5e7eb; padding:6px 10px; border-radius:8px; cursor:pointer;
    }
    .slip-actions .btn-del{
      background: #ef4444; border:1px solid #f87171; color:#fff; padding:6px 10px; border-radius:8px; cursor:pointer; font-weight:700;
    }
    .row-top{ display:flex; justify-content:space-between; align-items:center; }
    .row-sub{ color:#9aa3af; font-size:.9rem; margin-top:2px; }
    .type-chip{ font-size:.75rem; border:1px solid #ffffff33; padding:2px 8px; border-radius:999px; margin-left:6px; }
  `;
  document.head.appendChild(css);

  const m    = el.querySelector('#m');
  const out  = el.querySelector('#out');
  const inc  = el.querySelector('#inc');
  const bal  = el.querySelector('#bal');
  const list = el.querySelector('#list');

  let openedRow = null; // 確保同時間只開一列

  function closeOpenedRow(){
    if (openedRow){
      openedRow.track.style.transform = 'translateX(0px)';
      openedRow = null;
    }
  }

  function rowTemplate(doc){
    const sign = doc.type === 'income' ? '+' : '-';
    const_amt = fmt.money(doc.amount || 0);
    return `
      <div class="row-top">
        <div>
          <b>${doc.date || '-'}</b>
          <span class="type-chip">${doc.type === 'income' ? '收入' : '支出'}</span>
          <div class="row-sub">${doc.categoryId || '其他'}｜${doc.note || '(未命名)'}</div>
        </div>
        <div>${sign}${const_amt}</div>
      </div>
    `;
  }

  function bindSwipe(rowEl, data){
    const track = rowEl.querySelector('.slip-track');
    const actionsWidth = 180; // 要跟 CSS 一致

    let startX = 0;
    let currentX = 0;
    let deltaX = 0;
    let isDragging = false;

    const onStart = (x)=>{
      isDragging = true;
      startX = x;
      currentX = 0;
      deltaX = 0;
      // 關閉其他已開的列
      if (openedRow && openedRow.track !== track) closeOpenedRow();
    };
    const onMove = (x)=>{
      if (!isDragging) return;
      deltaX = x - startX;
      // 只允許向左滑
      const tx = Math.max(-actionsWidth, Math.min(0, deltaX));
      track.style.transform = `translateX(${tx}px)`;
    };
    const onEnd = ()=>{
      if (!isDragging) return;
      isDragging = false;
      const shouldOpen = deltaX < -60; // 左滑超過 60px 就展開
      track.style.transform = shouldOpen ? `translateX(${-actionsWidth}px)` : 'translateX(0px)';
      openedRow = shouldOpen ? { el: rowEl, track } : null;
    };

    // 觸控
    rowEl.addEventListener('touchstart', (e)=> onStart(e.touches[0].clientX), {passive:true});
    rowEl.addEventListener('touchmove',  (e)=> onMove(e.touches[0].clientX), {passive:true});
    rowEl.addEventListener('touchend',   onEnd);

    // 滑鼠（桌面）
    rowEl.addEventListener('mousedown', (e)=> onStart(e.clientX));
    window.addEventListener('mousemove', (e)=> onMove(e.clientX));
    window.addEventListener('mouseup', onEnd);

    // 動作按鈕
    rowEl.querySelector('.btn-cancel').addEventListener('click', ()=>{
      track.style.transform = 'translateX(0px)';
      openedRow = null;
    });
    rowEl.querySelector('.btn-del').addEventListener('click', async ()=>{
      // 真的刪除（不可復原）
      try{
        await deleteEntryForEmail(data.id);
        // 刷新列表
        await render();
      }catch(err){
        alert('刪除失敗：' + (err?.message || err));
      }
    });
  }

  async function render(){
    closeOpenedRow();

    const u = currentUser();
    if (!u?.email) {
      list.innerHTML = `<p class="small">請先登入後查看明細。</p>`;
      out.textContent = '-';
      inc.textContent = '-';
      bal.textContent = '-';
      return;
    }

    const { from, to } = monthRange(m.value);
    const rows = await getEntriesRangeWithIdsForEmail(u.email, from, to);

    // 統計
    const spend = rows.filter(r=> r.type !== 'income').reduce((s,r)=> s + (+r.amount||0), 0);
    const income= rows.filter(r=> r.type === 'income').reduce((s,r)=> s + (+r.amount||0), 0);
    out.textContent = fmt.money(spend);
    inc.textContent = fmt.money(income);
    bal.textContent = fmt.money(income - spend);

    if (!rows.length){
      list.innerHTML = `<p class="small">本月尚無記錄</p>`;
      return;
    }

    // 由新到舊（或保留 date asc 也可，這裡用 date desc）
    rows.sort((a,b)=> (a.date > b.date ? -1 : 1));

    list.innerHTML = rows.map(r=>`
      <div class="slip-row" data-id="${r.id}">
        <div class="slip-track">
          <div class="slip-content">
            ${rowTemplate(r)}
          </div>
          <div class="slip-actions">
            <button class="btn-cancel" type="button">取消</button>
            <button class="btn-del" type="button" title="刪除後不能復原">確定刪除</button>
          </div>
        </div>
      </div>
    `).join('');

    // 綁定滑動與刪除按鈕
    list.querySelectorAll('.slip-row').forEach(row=>{
      const id = row.getAttribute('data-id');
      const data = rows.find(x=>x.id === id);
      bindSwipe(row, data);
    });
  }

  m.addEventListener('change', render);
  render();

  // 點頁面其他地方時關閉已展開的列
  document.addEventListener('click', (e)=>{
    if (openedRow && !openedRow.el.contains(e.target)) {
      closeOpenedRow();
    }
  });

  return el;
}
