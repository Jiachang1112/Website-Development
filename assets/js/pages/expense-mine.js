// /assets/js/pages/expense-mine.js
// 「我的」=> 直接載入完整的 記帳設定 admin 版面

import { mountAccountingSettings } from './accounting-settings.js';

export function ExpenseMinePage() {
  // 清空並準備容器
  const app = document.getElementById('app');
  app.innerHTML = '<div id="mine-settings"></div>';

  // 掛上完整 admin 版面；不動 URL hash（如果要動，把 useHash: true）
  mountAccountingSettings('mine-settings', { useHash: false });
}
