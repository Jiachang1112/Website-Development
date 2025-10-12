// assets/js/pages/expense-detail.js
import { fmt } from '../app.js';
import { getEntriesRangeForEmail } from '../entries.js';

function getSignedEmail() {
  try {
    return JSON.parse(localStorage.getItem('session_user') || 'null')?.email || null;
  } catch {
    return null;
  }
}

function monthStartEnd(ym /* YYYY-MM */) {
  const [y, m] = ym.split('-').map(Number);
  // 取該月最後一天
  const last = new Date(y, m, 0).getDate();
  return [`${ym}-01`, `${ym}-${String(last).padStart(2, '0')}`];
}

export function ExpenseDetailPage() {
  const el = document.createElement('div');
  el.className = 'container';

  const ym = new Date().toISOString().slice(0, 7); // YYYY-MM
  el.innerHTML = `
    <section class="card">
      <h3>記帳｜明細</h3>
      <div class="row">
        <label class="small">月份</label>
        <input id="m" type="month" value="${ym}"/>
      </div>
      <div class="row">
        <span class="badge">月結餘：<b id="bal"></b></span>
        <span class="badge">月支出：<b id="out"></b></span>
        <span class="badge">月收入：<b id="inc"></b></span>
      </div>
      <div id="list"></div>
    </section>
  `;

  const m   = el.querySelector('#m');
  const out = el.querySelector('#out');
  const inc = el.querySelector('#inc');
  const bal = el.querySelector('#bal');
  const list = el.querySelector('#list');

  async function render() {
    const email = getSignedEmail();
    if (!email) {
      list.innerHTML = `<p class="small">請先登入帳號再查看明細。</p>`;
      out.textContent = fmt.money(0);
      inc.textContent = fmt.money(0);
      bal.textContent = fmt.money(0);
      return;
    }

    // 該月起訖
    const [from, to] = monthStartEnd(m.value);

    // 從 Firestore 撈「該帳號」當月的支出 entries
    const exps = await getEntriesRangeForEmail(email, from, to); // [{date, amount, categoryId, note, ...}]

    // 累計
    const totalOut = exps.reduce((s, a) => s + (Number(a.amount) || 0), 0);
    const totalIn = 0; // 目前未串收入集合，先顯示 0

    out.textContent = fmt.money(totalOut);
    inc.textContent = fmt.money(totalIn);
    bal.textContent = fmt.money(totalIn - totalOut);

    // 排序（新到舊）
    exps.sort((a, b) => (a.date > b.date ? -1 : 1));

    // 顯示列表
    list.innerHTML =
      exps
        .map((r) => {
          const typeTxt = '支出';
          const cat = r.categoryId || '';
          const item = r.note || '';
          const amt = -Math.abs(Number(r.amount) || 0);
          return `
          <div class="order-row">
            <div>
              <b>${r.date || ''}</b> 
              <span class="badge">${typeTxt}</span>
              <div class="small">${cat}｜${item}</div>
            </div>
            <div>${fmt.money(amt)}</div>
          </div>`;
        })
        .join('') || '<p class="small">本月尚無記錄</p>';
  }

  m.addEventListener('change', render);
  render();

  return el;
}
