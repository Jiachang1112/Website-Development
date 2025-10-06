// 「我的」頁：改為顯示「記帳設定」

import { mountAccountingSettings } from './accounting-settings.js';

export function ExpenseMinePage(rootId = 'app') {
  // 第一次進來如果沒有合法 hash，就帶到 ledgers
  const tabs = ['ledgers','budget','currency','categories','chat','general'];
  const h = (location.hash || '').replace('#', '');
  if (!tabs.includes(h)) {
    history.replaceState(null, '', '#ledgers');
  }

  // 掛載到 #app（路由場景）
  mountAccountingSettings(rootId);
}
