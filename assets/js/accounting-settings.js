<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>記帳設定｜SuperTool</title>

  <!-- Favicon：請把你提供的圖檔存成 assets/img/app-favicon.png -->
  <link rel="icon" type="image/png" href="../assets/img/app-favicon.png">

  <!-- 共用樣式 -->
  <link rel="stylesheet" href="../assets/css/style.css" />
  <link rel="manifest" href="../manifest.json" />

  <!-- Google Identity Services（如需登入按鈕時）-->
  <script src="https://accounts.google.com/gsi/client" async defer></script>

  <style>
    /* ===== 上方導覽列（與首頁一致） ===== */
    .top{
      background: var(--panel-dark, #17202a);
      color: #fff;
      padding: .6rem 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border-dark, #2b313a);
      position: sticky;
      top: 0;
      z-index: 20;
    }
    .brand{
      color: inherit; text-decoration: none; font-weight: 700;
      font-size: 20px; cursor: pointer; display:flex; align-items:center; gap:10px;
    }
    .brand img{ height:36px; }
    .brand:hover{ opacity: .85; }
    .nav button{ margin-right:.4rem; }
    .nav .gap{ display:inline-block; width:10px; }

    /* ===== 下面主要背景：與首頁相同的多色漸層 ===== */
    .gradient-wrap{
      background: linear-gradient(135deg,
        #1e3a8a 0%,
        #2563eb 20%,
        #7e22ce 40%,
        #db2777 60%,
        #f97316 80%,
        #fde047 100%
      );
      background-size: 300% 300%;
      animation: gradientShift 10s ease-in-out infinite;
      min-height: calc(100vh - 64px);
      padding-bottom: 64px;
    }
    @keyframes gradientShift{
      0%{ background-position: 0% 50%; }
      50%{ background-position: 100% 50%; }
      100%{ background-position: 0% 50%; }
    }

    /* 內容卡片的立體感（不改你JS輸出的DOM，只做外觀加強） */
    .gradient-wrap .card{
      box-shadow: 0 3px 12px rgba(0,0,0,0.35);
      border-radius: 14px;
    }

    /* ===== 手機版漢堡選單 ===== */
    .hamburger{
      display:none;
      position:relative;
      width:40px; height:34px;
      border:1px solid var(--border-dark, #2b313a);
      border-radius:8px;
      background:#111722;
      cursor:pointer;
      margin-left:8px;
    }
    .hamburger span{
      display:block; height:4px; margin:5px 7px;
      background:#fff; border-radius:999px;
      transition:transform .25s ease, opacity .2s ease;
    }
    .hamburger.active span:nth-child(1){ transform:translateY(9px) rotate(45deg); }
    .hamburger.active span:nth-child(2){ opacity:0; }
    .hamburger.active span:nth-child(3){ transform:translateY(-9px) rotate(-45deg); }

    @media (max-width: 768px){
      .hamburger{ display:inline-block; }
      .top .nav{
        display:none;
        position:absolute; left:0; right:0; top:100%;
        background: var(--panel-dark, #17202a);
        border-top:1px solid var(--border-dark, #2b313a);
        padding:12px;
        box-shadow:0 10px 30px rgba(0,0,0,.35);
      }
      .top .nav.open{
        display:grid;
        grid-template-columns: repeat(3, minmax(0,1fr));
        gap:8px;
      }
      .top .nav.open .gap{ display:none; }
      .top .nav.open button{
        width:100%;
        justify-content:center;
        border-radius:10px;
      }
    }
  </style>
</head>
<body>

<!-- ===== 導覽列（與首頁相同項目） ===== -->
<header class="top">
  <a href="../index.html#dashboard" class="brand">
    <img src="../assets/img/supertool-logo.png" alt="SuperTool">
    <span>SuperTool</span>
  </a>

  <!-- 手機版漢堡 -->
  <button id="menuToggle" class="hamburger" aria-label="開啟選單" aria-controls="mainNav" aria-expanded="false">
    <span></span><span></span><span></span>
  </button>

  <nav class="nav" id="mainNav">
    <button onclick="location.href='../index.html#dashboard'">首頁</button>
    <button onclick="location.href='../index.html#auth'">帳號</button>
    <button onclick="location.href='https://jiachang1112.github.io/Website-Development/book.html'">記帳</button>
    <button onclick="location.href='https://jiachang1112.github.io/Website-Development/admin/accounting-settings.html#ledgers'">我的</button>
    <button onclick="location.href='../index.html#acct_detail'">明細</button>
    <button onclick="location.href='../index.html#acct_analysis'">分析</button>
    <button onclick="location.href='https://jiachang1112.github.io/Website-Development/cart-demo.html'">購物</button>
    <button onclick="location.href='../index.html#admin'">後台</button>
    <button onclick="location.href='../index.html#settings'">設定</button>
    <button onclick="location.href='../index.html#backup'">備份</button>
    <button class="btn btn-primary" onclick="location.href='https://jiachang1112.github.io/Website-Development/stock/stocks.html'">股票</button>
    <span class="gap"></span>
    <button class="btn btn-outline-light" onclick="location.href='../index.html#contact'">聯絡我們</button>
  </nav>
</header>

<!-- ===== 與首頁相同的漸層背景包住應用內容 ===== -->
<div class="gradient-wrap">
  <!-- 這裡留給你的 JS（accounting-settings.js）去掛畫面 -->
  <main id="app" class="container py-4"></main>
</div>

<!-- ===== 漢堡選單行為：僅負責開/關，不碰你的業務邏輯 ===== -->
<script>
  (function(){
    const toggle = document.getElementById('menuToggle');
    const nav = document.getElementById('mainNav');
    if(!toggle || !nav) return;

    const mq = window.matchMedia('(max-width: 768px)');

    function closeMenu(){
      nav.classList.remove('open');
      toggle.classList.remove('active');
      toggle.setAttribute('aria-expanded','false');
    }

    toggle.addEventListener('click', ()=>{
      const opened = nav.classList.toggle('open');
      toggle.classList.toggle('active', opened);
      toggle.setAttribute('aria-expanded', opened ? 'true' : 'false');
    });

    window.addEventListener('resize', ()=>{ if(!mq.matches) closeMenu(); });
    document.addEventListener('click', (e)=>{
      if (!mq.matches) return;
      if (e.target === toggle || toggle.contains(e.target)) return;
      if (!nav.contains(e.target)) closeMenu();
    });
  })();
</script>

<!-- 掛載原本頁面邏輯（完全不動） -->
<script type="module" src="../assets/js/pages/accounting-settings.js"></script>
</body>
</html>
