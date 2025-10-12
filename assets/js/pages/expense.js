// assets/js/pages/expense.js
import { requireLogin } from '../app.js';
import { saveExpense } from '../entries.js';

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function ExpensePage() {
  const $root = el(`
    <div class="p-3">
      <h3 class="mb-2">支出記帳</h3>
      <div class="text-muted mb-3">輸入品項、分類與金額，點「新增」後即寫入 Firestore</div>

      <form id="expForm" class="row g-2" autocomplete="off">
        <div class="col-12 col-md-3">
          <label class="form-label">日期</label>
          <input name="date" type="date" class="form-control" required>
        </div>
        <div class="col-12 col-md-3">
          <label class="form-label">品項</label>
          <input name="item" class="form-control" placeholder="例如：早餐" required>
        </div>
        <div class="col-12 col-md-3">
          <label class="form-label">分類</label>
          <input name="category" class="form-control" placeholder="餐飲 / 交通…">
        </div>
        <div class="col-12 col-md-3">
          <label class="form-label">金額</label>
          <input name="amount" type="number" step="1" min="0" class="form-control" required>
        </div>
        <div class="col-12">
          <label class="form-label">備註（可略）</label>
          <input name="note" class="form-control" placeholder="補充說明（可略）">
        </div>
        <div class="col-12 d-flex gap-2">
          <button class="btn btn-primary" type="submit">新增</button>
          <span id="expMsg" class="align-self-center small text-muted"></span>
        </div>
      </form>
    </div>
  `);

  // 預設日期 = 今天
  $root.querySelector('[name="date"]').value = new Date().toISOString().slice(0, 10);

  $root.querySelector('#expForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $root.querySelector('#expMsg');
    msg.textContent = '寫入中…';

    try {
      const u = requireLogin();
      const f = new FormData(e.target);
      const dateStr = f.get('date');
      const data = {
        item: f.get('item')?.trim(),
        category: f.get('category')?.trim(),
        amount: Number(f.get('amount')),
        note: f.get('note')?.trim(),
        source: 'form',
        ts: dateStr ? new Date(dateStr + 'T00:00:00') : new Date(),
      };

      await saveExpense(u, data);
      msg.textContent = '✅ 已寫入';
      e.target.reset();
      // 重設日期為今天（避免清掉）
      $root.querySelector('[name="date"]').value = new Date().toISOString().slice(0, 10);
      setTimeout(() => (msg.textContent = ''), 1200);
    } catch (err) {
      console.error(err);
      msg.textContent = '❌ 失敗：' + err.message;
    }
  });

  return $root;
}
