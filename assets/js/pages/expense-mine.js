// /assets/js/pages/expense-mine.js
// 「我的」頁面 => 直接顯示「記帳設定」，避免黑畫面 + 強韌載入

(function () {
  // ========== 1) 保證有 #app 容器 ==========
  function ensureAppContainer() {
    let root = document.querySelector('#app');
    if (root) return root;

    // 優先把現有的主要容器換成 #app；找不到就直接塞進 body
    const host = document.querySelector('#app, main, .container, #root, body');
    if (host && host !== document.body) {
      host.innerHTML = '<div id="app" class="container py-4"></div>';
      return document.querySelector('#app');
    }
    if (!host || host === document.body) {
      const el = document.createElement('div');
      el.id = 'app';
      el.className = 'container py-4';
      document.body.appendChild(el);
      return el;
    }
  }

  const app = ensureAppContainer();

  // 先給個載入中的提示，避免全黑
  if (app) {
    app.innerHTML = `
      <div class="text-center py-5">
        <div class="spinner-border text-light" role="status"></div>
        <div class="mt-3">正在載入記帳設定…</div>
      </div>
    `;
  }

  // ========== 2) 以模組自身網址，安全組出 accounting-settings.js 的路徑 ==========
  const base = new URL('.', import.meta.url).href; // 指向 /assets/js/pages/
  const settingsUrl = `${base}accounting-settings.js`;

  // ========== 3) 載入、保底錯誤處理 ==========
  (async () => {
    try {
      await import(settingsUrl);

      // 如果成功載入，但 1 秒內沒掛上（沒設定 flag），主動顯示錯誤避免全黑
      setTimeout(() => {
        if (!window.__ACC_SETTINGS_LOADED__) {
          app.innerHTML = `
            <div class="alert alert-danger">
              記帳設定載入後未完成掛載（__ACC_SETTINGS_LOADED__ 未設定）。
              請檢查 /assets/js/pages/accounting-settings.js。
            </div>
          `;
        }
      }, 1000);

      // 第一次進來沒有 hash 時，預設到 #ledgers（管理帳本）
      if (!location.hash) {
        history.replaceState(null, '', '#ledgers');
      }
    } catch (err) {
      console.error('載入記帳設定失敗：', err);
      if (app) {
        app.innerHTML = `
          <div class="alert alert-danger">
            無法載入 <code>${settingsUrl}</code>。<br>
            可能是路徑 404 或快取造成。請清除快取後重試（Ctrl+F5），
            或在控制台查看詳細錯誤。
          </div>
        `;
      }
    }
  })();
})();
