<!doctype html>
<html lang="zh-Hant" data-theme="dark">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>SuperTool｜記帳設定</title>
  <link rel="icon" href="/Website-Development/assets/img/favicon.svg" type="image/svg+xml"/>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body {
      font-family: system-ui, "Noto Sans TC", sans-serif;
      background: linear-gradient(160deg, #1e1b4b, #581c87, #831843);
      min-height: 100vh;
      color: #fff;
    }
    h3 { font-weight: 700; }
    .nav-tabs { border: none; display: flex; gap: 8px; flex-wrap: wrap; }
    .nav-tabs .topbar-btn {
      border-radius: 999px; padding: 10px 14px; font-weight: 600;
      border: 1px solid rgba(255,255,255,.2); background: rgba(255,255,255,.1);
      color: #fff; transition: .15s ease;
    }
    .nav-tabs .topbar-btn:hover { background: rgba(255,255,255,.2); }
    .nav-tabs .active { background: linear-gradient(90deg,#ff7ab6,#ff4d6d); border: none; }
    .card { background: rgba(0,0,0,.35); border: 1px solid rgba(255,255,255,.08); color: #fff; }
    .card-header { border-bottom: 1px solid rgba(255,255,255,.1); font-weight: 600; }
    .list-group-item { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); color: #fff; }
    .btn, .topbar-btn.-primary {
      background: linear-gradient(90deg,#ff7ab6,#ff4d6d); border: none; color: #fff; font-weight: 600;
    }
    .btn:hover, .topbar-btn.-primary:hover { filter: brightness(1.1); }
  </style>
</head>
<body>
  <nav class="p-3 text-center fw-bold" style="font-size:1.3rem;background:rgba(0,0,0,.2);backdrop-filter:blur(6px);">
    <span style="color:#ffd166;">SuperTool</span> 記帳設定
  </nav>

  <main id="app" class="container py-4"></main>

  <!-- 🟡 強制 Demo + 動態載入，確保不登入也能操作 -->
  <script>
    window.__FORCE_DEMO = true; // <— 這行可保證進入展示模式（不需登入）
    const v = '20251025-demo3'; // 每次改可換版本號破快取

    const candidates = [
      '/Website-Development/assets/js/pages/accounting-settings.js',
      '/Website-Development/assets/js/accounting-settings.js',
      '/assets/js/pages/accounting-settings.js',
      '/assets/js/accounting-settings.js'
    ];

    (async () => {
      let loaded = false, lastErr = null;
      for (const p of candidates) {
        const url = p + '?v=' + v;
        try {
          await import(url);
          console.log('[SuperTool 記帳設定] loaded from', url);
          loaded = true;
          break;
        } catch (e) {
          console.warn('[SuperTool 記帳設定] failed import', url, e);
          lastErr = e;
        }
      }
      if (!loaded) {
        document.body.insertAdjacentHTML('beforeend', `
          <div style="background:#7f1d1d;color:#fff;padding:16px;border-radius:12px;margin:20px;">
            ❌ 無法載入 accounting-settings.js<br>
            請確認 JS 檔案存在於以下任一路徑：<br>
            <code>${candidates.join('<br>')}</code><br>
            詳見 Console 訊息。
          </div>`);
        throw lastErr;
      }
    })();
  </script>
</body>
</html>
