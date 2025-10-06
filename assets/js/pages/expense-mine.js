// /assets/js/pages/expense-mine.js
// 「我的」頁 => 直接顯示記帳設定

import { mountAccountingSettings } from './accounting-settings.js';

export function ExpenseMinePage(rootId = 'app') {
  // 沒帶 hash 就預設到 ledgers，避免空白
  const valid = ['ledgers', 'budget', 'currency', 'categories', 'chat', 'general'];
  const h = (location.hash || '').replace('#', '');
  if (!valid.includes(h)) {
    history.replaceState(null, '', '#ledgers');
  }

  // 掛到 #app（路由場景）
  mountAccountingSettings(rootId);
}
