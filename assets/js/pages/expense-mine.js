// /assets/js/pages/expense-mine.js
// 「我的」頁面直接顯示「記帳設定」

(function () {
  // 1) 保證有 #app 容器可以掛載
  let root = document.querySelector('#app');
  if (!root) {
    // 嘗試把舊容器清掉改成 #app
    const host = document.querySelector('#app, main, .container, #root, body');
    if (host) {
      // 若不是 body，就把它的內容改成 #app；若是 body 就直接塞
      if (host !== document.body) {
        host.innerHTML = '<div id="app" class="container py-4"></div>';
      } else {
        const el = document.createElement('div');
        el.id = 'app';
        el.className = 'container py-4';
        document.body.innerHTML = '';
        document.body.appendChild(el);
      }
    }
  }
  // 再拿一次
  root = document.querySelector('#app');
  if (!root) {
    // 最後保險一次
    const el = document.createElement('div');
    el.id = 'app';
    el.className = 'container py-4';
    document.body.appendChild(el);
  }

  // 2) 載入「記帳設定」的 UI（它會自動掛到 #app）
  import('./accounting-settings.js').then(() => {
    // 3) 第一次進來沒有 hash，就預設到「管理帳本」
    if (!location.hash) {
      history.replaceState(null, '', '#ledgers');
    }
  });
})();
