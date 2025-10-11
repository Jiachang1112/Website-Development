<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SuperTool｜股票中心</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body { font-family: system-ui, "PingFang TC","Microsoft JhengHei", Arial; background:#f8fafc; }
    .stock-card{border:1px solid #e5e7eb;border-radius:12px;padding:12px;height:100%;background:#fff}
    .stock-symbol{font-weight:700}
    .chip{padding:2px 8px;border-radius:999px;font-size:12px}
    .chip.up{background:#e6f4ea;color:#137333}
    .chip.down{background:#fce8e6;color:#c5221f}
    .mini-chart{width:100%;height:80px}
    .section-title{font-weight:600;color:#475569}
    .news-item:hover{background:#f8fafc}
  </style>
</head>
<body class="p-4">
  <header class="d-flex justify-content-between align-items-center mb-4">
    <h3 class="mb-0">📈 股票中心（即時＋新聞＋CSV）</h3>
    <a href="https://jiachang1112.github.io/Website-Development/index.html" class="btn btn-outline-secondary">返回首頁</a>
  </header>

  <!-- 搜尋 & 工具列 -->
  <div class="d-flex flex-wrap gap-2 mb-3">
    <div class="input-group" style="max-width:520px;">
      <input id="stockSearch" type="text" class="form-control" placeholder="搜尋：名稱或代號（例如 2330.TW / AAPL）">
      <button id="stockSearchBtn" class="btn btn-outline-secondary">搜尋</button>
    </div>
    <div class="ms-auto d-flex gap-2">
      <select id="sortSelect" class="form-select">
        <option value="symbol">依代號</option>
        <option value="name">依名稱</option>
        <option value="priceDesc">價格↓</option>
        <option value="priceAsc">價格↑</option>
        <option value="changeDesc">漲跌幅↓</option>
        <option value="changeAsc">漲跌幅↑</option>
      </select>
      <button id="refreshAll" class="btn btn-outline-primary">全部更新</button>
    </div>
  </div>

  <!-- CSV 區塊 -->
  <div class="card shadow-sm mb-3">
    <div class="card-body d-flex flex-wrap gap-3 align-items-center">
      <div class="fw-semibold">📦 CSV 匯入/匯出</div>
      <input id="csvFile" type="file" accept=".csv" class="form-control" style="max-width:300px;">
      <button id="importCsvBtn" class="btn btn-success">匯入 CSV</button>
      <button id="exportCsvBtn" class="btn btn-outline-secondary">匯出自選 CSV</button>
      <a id="sampleCsvBtn" class="btn btn-link" download="symbols-sample.csv">下載範例</a>
      <small class="text-muted">支援：<code>symbol,name</code>（含標題或不含皆可；每行一檔）</small>
    </div>
  </div>

  <!-- 搜尋結果 -->
  <div class="mb-2 section-title">搜尋結果</div>
  <div id="searchResults" class="row g-3"></div>

  <hr class="my-4">

  <!-- 自選清單 -->
  <div class="d-flex align-items-center mb-2">
    <div class="section-title me-3 mb-0">自選清單</div>
    <small class="text-muted">已儲存於本機（localStorage）</small>
  </div>
  <div id="watchlist" class="row g-3"></div>

  <!-- 自選統計 -->
  <div id="statsSection" class="mt-4" style="display:none;">
    <div class="section-title mb-2">自選整體概況</div>
    <div class="row g-3">
      <div class="col-12 col-lg-5">
        <div class="card shadow-sm">
          <div class="card-body">
            <div class="card-title fw-semibold">上漲 / 下跌 / 持平</div>
            <canvas id="distChart" height="240"></canvas>
          </div>
        </div>
      </div>
      <div class="col-12 col-lg-7">
        <div class="card shadow-sm">
          <div class="card-body">
            <div class="card-title fw-semibold">漲跌幅 TOP 5</div>
            <canvas id="moversChart" height="240"></canvas>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 詳細視窗（全螢幕圖表＋即時 1m ＋ 新聞） -->
  <div id="stockModal" class="modal fade" tabindex="-1">
    <div class="modal-dialog modal-xl modal-dialog-centered modal-fullscreen-lg-down">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="modalTitle">股票詳情</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <div class="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
            <div>
              <h4 id="modalPrice" class="fw-bold mb-0">--</h4>
              <div id="modalChange" class="small text-muted"></div>
            </div>
            <div class="d-flex gap-2 align-items-center">
              <div class="btn-group">
                <button class="btn btn-outline-secondary btn-sm" data-range="1d" data-intv="1m">即時 1分</button>
                <button class="btn btn-outline-secondary btn-sm" data-range="5d" data-intv="5m">1週</button>
                <button class="btn btn-outline-secondary btn-sm active" data-range="1mo" data-intv="1d">1月</button>
                <button class="btn btn-outline-secondary btn-sm" data-range="6mo" data-intv="1d">6月</button>
                <button class="btn btn-outline-secondary btn-sm" data-range="1y" data-intv="1d">1年</button>
              </div>
              <div class="form-check ms-2">
                <input class="form-check-input" type="checkbox" id="liveToggle">
                <label class="form-check-label small" for="liveToggle">自動更新(30s)</label>
              </div>
            </div>
          </div>
          <canvas id="modalChart" height="340"></canvas>

          <hr class="my-4">

          <div class="d-flex align-items-center mb-2">
            <div class="section-title me-3 mb-0">最新新聞</div>
            <small class="text-muted" id="newsHint">來源：Yahoo Finance</small>
          </div>
          <div id="newsList" class="list-group"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- JS libraries -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <!-- App -->
  <script src="stocks.js"></script>
</body>
</html>
