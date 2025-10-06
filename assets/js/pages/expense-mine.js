// /assets/js/pages/mine.js
// 我的 => 完全改成顯示「記帳設定」

// 直接載入記帳設定（它會自動把 UI 掛到 #app）
import './accounting-settings.js';

// 可選：第一次打開「我的」時，沒有 hash 就帶去「管理帳本」
if (!location.hash) {
  history.replaceState(null, '', '#ledgers');
}
