// 「我的」頁：被路由呼叫時，改成渲染「記帳設定」

import { mountAccountingSettings } from './accounting-settings.js';

// 給路由用的具名匯出（很重要）
export function ExpenseMinePage(rootId = 'app') {
  // 第一次開、若沒有或是奇怪的 hash，導向「管理帳本」
  const ok = ['ledgers','budget','currency','categories','chat','general'];
  const h = (location.hash || '').replace('#','');
  if (!ok.includes(h)) {
    history.replaceState(null, '', '#ledgers');
  }

  // 掛載記帳設定 UI 到指定 root（預設 #app）
  mountAccountingSettings(rootId);

  // （可選）改一下標題
  document.title = '記帳設定｜我的';
}
