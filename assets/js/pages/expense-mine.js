// /assets/js/pages/expense-mine.js
// 「我的」頁 → 原封不動顯示「記帳設定」

import { mountAccountingSettings } from './accounting-settings.js';

export function ExpenseMinePage(rootId = 'app') {
  const root = document.getElementById(rootId);
  if (!root) return;

  // 清空「我的」原內容，塞一個跟獨立頁相同的容器骨架
  root.innerHTML = `
    <div class="container py-4">
      <div id="acc-page"></div>
    </div>
  `;

  // 沒帶 hash 就預設到 ledgers，避免空白
  const valid = ['ledgers','budget','currency','categories','chat','general'];
  const h = (location.hash || '').replace('#', '');
  if (!valid.includes(h)) {
    history.replaceState(null, '', '#ledgers');
  }

  // 把記帳設定掛到 #acc-page（而不是整個 #app）
  mountAccountingSettings('acc-page');
}
