// assets/js/pages/expense-detail.js
import { fmt, currentUser } from '../app.js';
import {
  getEntriesRangeWithIdsForEmail,
  deleteEntryForEmail
} from '../entries.js';

function firstDayOfMonth(ym) { return ym + '-01'; }
function lastDayOfMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).toISOString().slice(0, 10);
}

export function ExpenseDetailPage() {
  const el = document.createElement('div');
  el.className = 'container';

  const ym = new Date().toISOString().slice(0, 7);
  el.innerHTML = `
    <section class="card">
      <h3>記帳｜明細</h3>
      <div class="row">
        <label class="small">月份</label>
        <input id="m" type="month" value="${ym}" />
      </div>

      <div class="row">
        <span class="badge">月結餘：<b id="bal"></b></span>
        <span class="badge">月支出：<b id="out"></b></span>
        <span class="badge">月收入：<b id="inc"></b></span>
      </div>

      <div id="list"></div>
    </section>

    <style>
      .order-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #e5e7eb;
        padding: 10px 12px;
        background: #fff;
        transition: transform 0.2s ease;
        position: relative;
        user-select: none;
      }
      .delete-actions {
        position: absolute;
        right: 0;
        top: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        gap: 8px;
        background: #fef2f2;
        padding: 0 10px;
        border-left: 1px solid #fca5a5;
      }
      .delete-btn {
        background: #dc2626;
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 6px 12px;
        cursor: pointer;
      }
      .cancel-btn {
        background: #e5e7eb;
        color: #111;
        border: none;
        border-radius: 8px;
        padding: 6px 12px;
        cursor: pointer;
      }
      .confirm-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
      }
      .confirm-box {
        background: #fff;
        border-radius: 10px;
        padding: 20px;
        width: 280px;
        text-align: center;
      }
      .confirm-box button {
        margin-top: 10px;
        margin-inline: 5px;
        padding: 6px 12px;
        border-radius: 6px;
        border: none;
        cursor: pointer;
      }
      .confirm-ok { background: #dc2626; color: #fff; }
      .confirm-cancel { background: #e5e7eb; }
    </style>
  `;

  const m = el.querySelector('#m');
  const out = el.querySelector('#out');
  const inc = el.querySelector('#inc');
  const bal = el.querySelector('#bal');
  const list = el.querySelector('#list');

  async function render() {
    const u = currentUser();
    if (!u?.email) {
      list.innerHTML = `<p class="small">請先登入帳號再查看明細。</p>`;
      out.textContent = inc.textContent = bal.textContent = fmt.money(0);
      return;
    }

    const from = firstDayOfMonth(m.value);
    const to = lastDayOfMonth(m.value);
    const rows = await getEntriesRangeWithIdsForEmail(u.email, from, to);

    const outs = rows.filter(r => r.type === 'expense');
    const ins = rows.filter(r => r.type === 'income');
    const totalOut = outs.reduce((s, a) => s + (Number(a.amount) || 0), 0);
    const totalIn = ins.reduce((s, a) => s + (Number(a.amount) || 0), 0);

    out.textContent = fmt.money(totalOut);
    inc.textContent = fmt.money(totalIn);
    bal.textContent = fmt.money(totalIn - totalOut);

    const all = [...rows].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    list.innerHTML =
      all.map(r => {
        const typeTxt = r.type === 'income' ? '收入' : '支出';
        const cat = r.categoryId || '';
        const note = r.note || '';
        const amt = r.type === 'income' ? +r.amount : -Math.abs(+r.amount || 0);
        return `
          <div class="order-row" data-id="${r.id}">
            <div>
              <b>${r.date || ''}</b>
              <span class="badge">${typeTxt}</span>
              <div class="small">${cat}｜${note}</div>
            </div>
            <div>${fmt.money(amt)}</div>
          </div>
        `;
      }).join('') || '<p class="small">本月尚無記錄</p>';

    // 綁定滑動事件
    list.querySelectorAll('.order-row').forEach(row => {
      let startX = 0, moved = false;
      row.addEventListener('touchstart', e => {
        startX = e.touches[0].clientX;
        moved = false;
      });
      row.addEventListener('touchmove', e => {
        const delta = e.touches[0].clientX - startX;
        if (delta < -30) {
          moved = true;
          showDelete(row);
        }
      });
      row.addEventListener('touchend', () => {
        if (!moved) hideDelete(row);
      });
    });
  }

  // 顯示刪除按鈕
  function showDelete(row) {
    if (row.querySelector('.delete-actions')) return;
    const actions = document.createElement('div');
    actions.className = 'delete-actions';
    actions.innerHTML = `
      <button class="cancel-btn">取消</button>
      <button class="delete-btn">刪除</button>
    `;
    row.appendChild(actions);

    actions.querySelector('.cancel-btn').onclick = () => hideDelete(row);
    actions.querySelector('.delete-btn').onclick = () => confirmDelete(row.dataset.id);
  }

  function hideDelete(row) {
    const a = row.querySelector('.delete-actions');
    if (a) a.remove();
  }

  // 確認刪除視窗
  function confirmDelete(id) {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-box">
        <p>確定刪除此筆記錄？<br><small>刪除後將無法復原。</small></p>
        <div>
          <button class="confirm-cancel">取消</button>
          <button class="confirm-ok">確定刪除</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('.confirm-cancel').onclick = () => overlay.remove();
    overlay.querySelector('.confirm-ok').onclick = async () => {
      await deleteEntryForEmail(id);
      overlay.remove();
      await render();
    };
  }

  m.addEventListener('change', render);
  render();
  return el;
}
