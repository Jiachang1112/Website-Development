// /assets/js/pages/expense-mine.js
// 「我的」頁面 → 改成直接載入「記帳設定」的完整 UI

import './accounting-settings.js';

// 預設直接打開「管理帳本」畫面（第一次開啟用）
if (!location.hash) {
  history.replaceState(null, '', '#ledgers');
}
