// assets/js/pages/dashboard.js
// 首頁：純介紹頁（無 Firestore、無統計卡/快捷卡/最近活動）

// 小工具
const $ = (sel, root = document) => root.querySelector(sel);

// 一次性注入樣式
function ensureStyles() {
  if (document.getElementById('dash-css')) return;
  const css = document.createElement('style');
  css.id = 'dash-css';
  css.textContent = `
  :root{
    --bg:#0f1318; --fg:#e6e6e6; --muted:#9aa3af;
    --card:#151a21; --border:#2a2f37; --shadow:0 6px 24px rgba(0,0,0,.25), 0 2px 8px rgba(0,0,0,.2);
    --brand:#3b82f6; --brand-weak:rgba(59,130,246,.15);
  }
  body.light{
    --bg:#f6f8fc; --fg:#111; --muted:#6b7280;
    --card:#ffffff; --border:#e5e7eb; --shadow:0 12px 24px rgba(17,24,39,.06);
    --brand:#1d4ed8; --brand-weak:rgba(29,78,216,.10);
  }

  .shell{max-width:1100px;margin-inline:auto;padding:24px}
  .kcard{background:var(--card);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow)}
  .kpad{padding:22px}

  /* Hero */
  .hero{display:flex;justify-content:space-between;align-items:center;gap:18px}
  .hero h2{margin:0;font-weight:800}
  .hero .sub{color:var(--muted)}
  .hero .cta{display:flex;gap:10px;flex-wrap:wrap}
  .hero .badge{
    border:1px dashed var(--border);
    color:var(--muted);
    border-radius:999px;
    padding:.25rem .6rem;
    font-size:.9rem;
  }

  /* 區塊標題 */
  .block-hd{display:flex;justify-content:space-between;align-items:end;margin:22px 0 10px}
  .block-hd .hint{color:var(--muted);font-size:.95rem}

  /* 三欄特色 */
  .grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
  @media (max-width: 992px){ .grid-3{grid-template-columns:repeat(2,1fr)} }
  @media (max-width: 640px){ .grid-3{grid-template-columns:1fr} }
  .feature{padding:16px;border:1px solid var(--border);border-radius:14px}
  .feature .ico{width:40px;height:40px;border-radius:10px;display:grid;place-items:center;background:var(--brand-weak);color:#93c5fd;font-size:20px;margin-bottom:8px}
  .feature .title{font-weight:700}
  .feature .desc{color:var(--muted);font-size:.95rem}

  /* 使用步驟 */
  .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
  @media (max-width: 992px){ .steps{grid-template-columns:repeat(2,1fr)} }
  @media (max-width: 640px){ .steps{grid-template-columns:1fr} }
  .step{padding:16px;border:1px dashed var(--border);border-radius:14px}
  .step .num{font-weight:800;margin-bottom:6px;color:var(--muted)}
  .step .t{font-weight:700}
  .step .d{color:var(--muted);font-size:.95rem}

  /* FAQ */
  .faq{display:flex;flex-direction:column;gap:10px}
  .qa{border:1px solid var(--border);border-radius:14px;padding:14px}
  .qa .q{font-weight:700}
  .qa .a{color:var(--muted);margin-top:4px}

  /* CTA 按鈕微調 */
  .btn-round{border-radius:12px}
  `;
  document.head.appendChild(css);
}

// 亮/暗模式切換（持久化）
function initThemeToggle(root) {
  const btn = root.querySelector('#themeToggle');
  const apply = (mode) => {
    document.body.classList.toggle('light', mode === 'light');
    document.documentElement.classList.toggle('light', mode === 'light');
  };
  apply(localStorage.getItem('theme') || 'dark');
  btn?.addEventListener('click', () => {
    const now = document.body.classList.contains('light') ? 'dark' : 'light';
    apply(now);
    localStorage.setItem('theme', now);
  });
}

// 導航：按鈕跳轉到既有路由（#shop / #admin）
function initGoto(root){
  root.addEventListener('click', e=>{
    const go = e.target.closest('[data-go]');
    if(!go) return;
    location.hash = go.getAttribute('data-go');
  });
}

// 導出首頁
export function DashboardPage(){
  ensureStyles();

  const el = document.createElement('div');
  el.className = 'shell';
  el.innerHTML = `
    <!-- Hero -->
    <section class="kcard kpad hero mb-3">
      <div>
        <div class="badge mb-2">歡迎回來</div>
        <h2>SuperTool – 你的日常工作面板</h2>
        <div class="sub">集中管理記帳、訂單與日常工具，介面簡潔、上手快速。</div>
      </div>
      <div class="cta">
        <button class="btn btn-primary btn-round" data-go="#shop">
          <i class="bi bi-cart me-1"></i>開始購物
        </button>
        <button class="btn btn-outline-light btn-round" data-go="#admin">
          <i class="bi bi-speedometer2 me-1"></i>管理後台
        </button>
        <button class="btn btn-outline-light btn-round" id="themeToggle">
          <i class="bi bi-brightness-high me-1"></i>切換亮/暗
        </button>
      </div>
    </section>

    <!-- 特色介紹 -->
    <div class="block-hd">
      <h5 class="m-0">為什麼選擇 SuperTool？</h5>
      <div class="hint">一站式工作面板，省時又省力</div>
    </div>
    <section class="grid-3">
      <div class="kcard feature">
        <div class="ico"><i class="bi bi-lightning-charge"></i></div>
        <div class="title">極速上手</div>
        <div class="desc">不需要學習成本，登入就能用；常見功能一鍵直達。</div>
      </div>
      <div class="kcard feature">
        <div class="ico"><i class="bi bi-shield-check"></i></div>
        <div class="title">安全穩定</div>
        <div class="desc">採用雲端資料儲存（Firestore），訂單資料安全可靠。</div>
      </div>
      <div class="kcard feature">
        <div class="ico"><i class="bi bi-columns-gap"></i></div>
        <div class="title">介面友善</div>
        <div class="desc">淺色/深色主題可切換，行動／桌面都能舒適瀏覽。</div>
      </div>
    </section>

    <!-- 使用步驟 -->
    <div class="block-hd">
      <h5 class="m-0">怎麼開始使用？</h5>
      <div class="hint">三步驟完成設定，立即投入日常</div>
    </div>
    <section class="steps">
      <div class="kcard step">
        <div class="num">Step 1</div>
        <div class="t">新增商品到購物車</div>
        <div class="d">前往「購物」頁挑選商品，加入購物車、準備結帳。</div>
      </div>
      <div class="kcard step">
        <div class="num">Step 2</div>
        <div class="t">完成下單</div>
        <div class="d">填寫收件資料與付款方式，提交訂單後可在後台查看。</div>
      </div>
      <div class="kcard step">
        <div class="num">Step 3</div>
        <div class="t">後台管理訂單</div>
        <div class="d">到「後台」查看訂單詳情、更新狀態（待付款／已付款／已出貨／已取消）。</div>
      </div>
    </section>

    <!-- FAQ -->
    <div class="block-hd">
      <h5 class="m-0">常見問題</h5>
      <div class="hint">若有其他問題，隨時和我們聯繫</div>
    </div>
    <section class="faq">
      <div class="kcard qa">
        <div class="q">可以切換亮/暗模式嗎？</div>
        <div class="a">可以！右上角或本頁的「切換亮/暗」按鈕即可，偏好會自動記住。</div>
      </div>
      <div class="kcard qa">
        <div class="q">訂單資料在哪裡查看？</div>
        <div class="a">在「後台」即可查看最新訂單，還能變更訂單狀態與檢視詳細內容。</div>
      </div>
      <div class="kcard qa">
        <div class="q">要怎麼開始下單？</div>
        <div class="a">點「開始購物」直接前往商店頁，將商品加入購物車、填寫資料即可。</div>
      </div>
    </section>
  `;

  initThemeToggle(el);
  initGoto(el);
  return el;
}
