// /assets/js/pages/expense-mine.js
// 「我的」頁 → 直接掛載 記帳設定 到 #app

import { mountAccountingSettings } from './accounting-settings.js';

// 第一次開、若沒有 hash，導向「管理帳本」
if (!location.hash) {
  history.replaceState(null, '', '#ledgers');
}

// 掛載
mountAccountingSettings('app');
