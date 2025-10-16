// assets/js/pages/expense-detail.js
import { fmt } from '../app.js';
import { getEntriesRangeForEmail } from '../entries.js';
import { currentUser } from '../app.js';

function firstDayOfMonth(ym) { // ym: 'YYYY-MM'
  return ym + '-01';
}
function lastDayOfMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 0); // 月最後一天
  return d.toISOString().slice(0, 10);
}

export function ExpenseDetailPage(){
  const el=document.createElement('div');
  el.className='container';
  const ym=new Date().toISOString().slice(0,7);
  el.innerHTML=`<section class="card"><h3>記帳｜明細</h3>
  <div class="row"><label class="small">月份</label><input id="m" type="month" value="${ym}"/></div>
  <div class="row"><span class="badge">月結餘：<b id="bal"></b></span><span class="badge">月支出：<b id="out"></b></span><span class="badge">月收入：<b id="inc"></b></span></div>
  <div id="list"></div></section>`;
  const m=el.querySelector('#m'), out=el.querySelector('#out'), inc=el.querySelector('#inc'), bal=el.querySelector('#bal'), list=el.querySelector('#list');
  async function render(){
    const u = currentUser();
    if (!u?.email) {
      list.innerHTML = `<p class="small">請先登入帳號再查看明細。</p>`;
      out.textContent = inc.textContent = bal.textContent = fmt.money(0);
      return;
    }

    const from = firstDayOfMonth(m.value);
    const to   = lastDayOfMonth(m.value);

    // 讀取本月範圍的資料（跨裝置：以 email 底下的 expenses/{email}/entries）
    const rows = await getEntriesRangeForEmail(u.email, from, to);

    // 區分收入/支出
    const outs = rows.filter(r => r.type === 'expense');
    const ins  = rows.filter(r => r.type === 'income');

    const totalOut = outs.reduce((s, a) => s + (Number(a.amount) || 0), 0);
    const totalIn  = ins.reduce((s, a) => s + (Number(a.amount) || 0), 0);

    out.textContent = fmt.money(totalOut);
    inc.textContent = fmt.money(totalIn);
    bal.textContent = fmt.money(totalIn - totalOut);

    // 排序：日期新到舊
    const all = [...rows].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    list.innerHTML =
      all.map(r => {
        const typeTxt = r.type === 'income' ? '收入' : '支出';
        const cat = r.categoryId || '';
        const note = r.note || '';
        const amt = r.type === 'income' ? +r.amount : -Math.abs(+r.amount || 0);
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
      }).join('') || '<p class="small">本月尚無記錄</p>';
  }

  m.addEventListener('change', render);
  render();
  return el;
}
