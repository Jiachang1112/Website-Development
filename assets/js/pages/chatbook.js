// assets/js/pages/chatbook.js
import { requireLogin } from '../app.js';
import { saveExpense } from '../entries.js';

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/** 將「早餐 65」/「午餐 120 便當」等句子拆成 {item, amount, category} */
function parseLine(str) {
  const s = (str || '').trim();
  if (!s) return null;
  // 取最後一個數字視為金額，其餘當品項；若句中有 #分類 也一起抓
  const catMatch = s.match(/#([^\s#]+)/);
  const category = catMatch ? catMatch[1] : '';
  const withoutCat = s.replace(/#([^\s#]+)/g, '').trim();

  const nums = withoutCat.match(/(\d+)(?!.*\d)/); // 最後一個整數
  if (!nums) return null;

  const amount = Number(nums[1]);
  const item = withoutCat.replace(nums[1], '').trim().replace(/\s+/g, ' ');
  return { item: item || '未命名', amount, category };
}

export function ChatbookPage() {
  const $root = el(`
    <div class="p-3">
      <h3 class="mb-2">聊天記帳</h3>
      <div class="text-muted mb-3">輸入範例：<code>早餐 65</code>、<code>飲料 55 #餐飲</code>，按 Enter 或「送出」即可寫入。</div>

      <div class="d-flex gap-2">
        <input id="line" class="form-control" placeholder="輸入：早餐 65 或 午餐 120 #餐飲">
        <button id="send" class="btn btn-primary">送出</button>
      </div>
      <div id="msg" class="small text-muted mt-2"></div>
    </div>
  `);

  async function send() {
    const input = $root.querySelector('#line');
    const msg = $root.querySelector('#msg');
    const p = parseLine(input.value);
    if (!p) { msg.textContent = '請輸入「品項 金額」，可加 #分類'; return; }

    try {
      const u = requireLogin();
      await saveExpense(u, {
        item: p.item,
        category: p.category || '',
        amount: p.amount,
        source: 'chat',
        ts: new Date(),
      });
      msg.textContent = `✅ 已記錄：${p.item} ${p.amount}`;
      input.value = '';
      setTimeout(() => (msg.textContent = ''), 1200);
    } catch (err) {
      console.error(err);
      msg.textContent = '❌ 失敗：' + err.message;
    }
  }

  $root.querySelector('#send').addEventListener('click', send);
  $root.querySelector('#line').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); send(); }
  });

  return $root;
}
