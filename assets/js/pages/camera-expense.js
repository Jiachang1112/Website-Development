// assets/js/pages/camera-expense.js
import { requireLogin } from '../app.js';
import { saveExpense } from '../entries.js';

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function CameraExpensePage() {
  const $root = el(`
    <div class="p-3">
      <h3 class="mb-2">拍照記帳</h3>
      <div class="text-muted mb-3">可上傳收據照片（OCR 可先略），手動確認金額後新增。</div>

      <div class="mb-3">
        <input id="file" type="file" accept="image/*" class="form-control">
      </div>

      <form id="camForm" class="row g-2">
        <div class="col-12 col-md-4">
          <label class="form-label">品項</label>
          <input name="item" class="form-control" placeholder="例如：超商收據" required>
        </div>
        <div class="col-12 col-md-4">
          <label class="form-label">分類</label>
          <input name="category" class="form-control" placeholder="雜項 / 餐飲…">
        </div>
        <div class="col-12 col-md-4">
          <label class="form-label">金額</label>
          <input name="amount" type="number" min="0" step="1" class="form-control" required>
        </div>
        <div class="col-12">
          <label class="form-label">備註（可略）</label>
          <input name="note" class="form-control" placeholder="補充說明（可略）">
        </div>
        <div class="col-12 d-flex gap-2">
          <button class="btn btn-primary" type="submit">新增</button>
          <span id="camMsg" class="align-self-center small text-muted"></span>
        </div>
      </form>
    </div>
  `);

  $root.querySelector('#camForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $root.querySelector('#camMsg');
    msg.textContent = '寫入中…';

    try {
      const u = requireLogin();
      const f = new FormData(e.target);

      await saveExpense(u, {
        item: f.get('item')?.trim() || '拍照記帳',
        category: f.get('category')?.trim() || '',
        amount: Number(f.get('amount')),
        note: f.get('note')?.trim() || '',
        source: 'camera',
        ts: new Date(),
      });

      msg.textContent = '✅ 已寫入';
      e.target.reset();
      setTimeout(() => (msg.textContent = ''), 1200);
    } catch (err) {
      console.error(err);
      msg.textContent = '❌ 失敗：' + err.message;
    }
  });

  return $root;
}
