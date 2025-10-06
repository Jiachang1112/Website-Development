// /assets/js/pages/accounting-settings.js
// 記帳設定（可獨立頁，也可嵌入其他頁）—— 完整 admin 版面

// 小工具
const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

// 樣式（對齊你後台 accounting-settings.html）
const style = document.createElement('style');
style.textContent = `
  .acc-wrap { max-width: 1280px; margin: 32px auto 80px; padding: 0 20px; }
  .acc-title { font-size: 28px; font-weight: 700; color:#f5f5f5; }
  .acc-sub { color:#cfcfcf; }

  .acc-shell { margin-top: 16px; }
  .acc-shell .card { background:#181a1e; border:1px solid #2a2d33; color:#eaeaea; }
  .acc-shell .list-group-item { background:#1c1f24; border-color:#2b2e35; color:#eaeaea; }
  .acc-shell .list-group-item.active { background:#0d6efd; color:#fff; border-color:#0d6efd; }

  .acc-shell input, .acc-shell select, .acc-shell textarea {
    background:#111418 !important; color:#eaeaea !important; border-color:#333 !important;
  }
  .acc-shell input::placeholder { color:#888 !important; }
`;
document.head.appendChild(style);

// 右側內容模板
const templates = {
  ledgers: `
    <div class="card p-3">
      <h5 class="mb-2">管理帳本</h5>
      <p class="acc-sub">用來新增 / 編輯 / 刪除帳本，並設定預設帳本。</p>
      <div class="row g-2">
        <div class="col-md-6">
          <label class="form-label">新增帳本名稱</label>
          <div class="input-group">
            <input id="in-ledger-name" class="form-control" placeholder="例如：我的主帳本"/>
            <button class="btn btn-primary" id="btn-add-ledger">新增</button>
          </div>
          <div class="small mt-2 acc-sub">（示意：目前僅作前端佔位，之後接 Firestore）</div>
        </div>
        <div class="col-md-6">
          <label class="form-label">現有帳本</label>
          <ul class="list-group" id="list-ledgers">
            <li class="list-group-item">Demo 帳本 A</li>
            <li class="list-group-item">Demo 帳本 B</li>
          </ul>
        </div>
      </div>
    </div>
  `,
  budget: `
    <div class="card p-3">
      <h5 class="mb-2">管理預算</h5>
      <p class="acc-sub">設定每月/每分類的預算、提醒等。</p>
      <div class="row g-2">
        <div class="col-md-6">
          <label class="form-label">每月總預算</label>
          <div class="input-group">
            <span class="input-group-text bg-dark text-light">NT$</span>
            <input class="form-control" id="in-month-budget" type="number" min="0" placeholder="30000"/>
            <button class="btn btn-primary" id="btn-save-budget">儲存</button>
          </div>
        </div>
        <div class="col-md-6">
          <label class="form-label">分類預算（示意）</label>
          <ul class="list-group">
            <li class="list-group-item d-flex justify-content-between align-items-center">
              餐飲 <span class="badge bg-secondary">NT$ 5000</span>
            </li>
            <li class="list-group-item d-flex justify-content-between align-items-center">
              交通 <span class="badge bg-secondary">NT$ 2000</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  `,
  currency: `
    <div class="card p-3">
      <h5 class="mb-2">管理貨幣</h5>
      <p class="acc-sub">設定顯示貨幣與符號、換算等（示意）。</p>
      <div class="row g-2">
        <div class="col-md-6">
          <label class="form-label">顯示貨幣</label>
          <select class="form-select" id="sel-currency">
            <option value="TWD">TWD（新台幣）</option>
            <option value="USD">USD（美元）</option>
            <option value="JPY">JPY（日圓）</option>
          </select>
        </div>
        <div class="col-md-6">
          <label class="form-label">千分位 / 小數位</label>
          <div class="input-group">
            <select class="form-select">
              <option selected>千分位顯示</option>
              <option>不顯示</option>
            </select>
            <select class="form-select">
              <option>0</option><option selected>2</option><option>4</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  `,
  categories: `
    <div class="card p-3">
      <h5 class="mb-2">管理類型</h5>
      <p class="acc-sub">新增、調整「支出 / 收入」分類（示意）。</p>
      <div class="row g-2">
        <div class="col-md-6">
          <label class="form-label">新增分類</label>
          <div class="input-group">
            <select class="form-select" id="sel-cat-type">
              <option value="expense">支出</option>
              <option value="income">收入</option>
            </select>
            <input class="form-control" id="in-cat-name" placeholder="分類名稱"/>
            <button class="btn btn-primary" id="btn-add-cat">新增</button>
          </div>
        </div>
        <div class="col-md-6">
          <label class="form-label">現有分類</label>
          <ul class="list-group">
            <li class="list-group-item">餐飲（支出）</li>
            <li class="list-group-item">薪資（收入）</li>
          </ul>
        </div>
      </div>
    </div>
  `,
  chat: `
    <div class="card p-3">
      <h5 class="mb-2">聊天設定</h5>
      <p class="acc-sub">設定專屬角色、記帳指令（示意）。</p>
      <div class="row g-2">
        <div class="col-md-6">
          <label class="form-label">專屬角色</label>
          <input class="form-control" id="in-role" placeholder="例如：小幫手 Bee"/>
        </div>
        <div class="col-md-6">
          <label class="form-label">記帳指令</label>
          <input class="form-control" id="in-command" placeholder="例如：記 50 早餐"/>
        </div>
      </div>
      <div class="mt-3">
        <button class="btn btn-primary" id="btn-save-chat">儲存</button>
        <span class="small acc-sub ms-2">（示意：先存於本地或 Firestore 的 users/{uid}/settings.chat）</span>
      </div>
    </div>
  `,
  general: `
    <div class="card p-3">
      <h5 class="mb-2">一般設定</h5>
      <p class="acc-sub">每日提醒、匯入帳本、匯出帳本（示意）。</p>
      <div class="row g-2">
        <div class="col-md-4">
          <label class="form-label">每日提醒時間</label>
          <input type="time" class="form-control" id="in-remind-at" value="21:00"/>
        </div>
        <div class="col-md-8 d-flex align-items-end gap-2">
          <button class="btn btn-outline-light" id="btn-enable-remind">啟用提醒</button>
          <button class="btn btn-outline-secondary" id="btn-disable-remind">停用提醒</button>
        </div>
      </div>
      <hr class="border-secondary">
      <div class="d-flex gap-2">
        <button class="btn btn-outline-primary" id="btn-export">匯出帳本（CSV / JSON）</button>
        <label class="btn btn-outline-success mb-0">
          匯入帳本（JSON）
          <input id="file-import" type="file" accept="application/json" hidden/>
        </label>
      </div>
    </div>
  `,
};

// 畫面骨架（左側清單 + 右側內容）
function renderShell(root) {
  root.innerHTML = `
    <div class="acc-wrap">
      <div class="acc-title">記帳設定</div>
      <div class="acc-sub">請選擇左側功能進行設定</div>

      <div class="acc-shell row g-3">
        <aside class="col-md-3">
          <div class="list-group" id="menu">
            <button class="list-group-item list-group-item-action" data-screen="ledgers">管理帳本</button>
            <button class="list-group-item list-group-item-action" data-screen="budget">管理預算</button>
            <button class="list-group-item list-group-item-action" data-screen="currency">管理貨幣</button>
            <button class="list-group-item list-group-item-action" data-screen="categories">管理類型</button>
            <button class="list-group-item list-group-item-action" data-screen="chat">聊天設定</button>
            <button class="list-group-item list-group-item-action" data-screen="general">一般設定</button>
          </div>
        </aside>

        <main class="col-md-9">
          <div id="screen"></div>
        </main>
      </div>
    </div>
  `;
}

// 切換畫面
function show(screen) {
  const valid = ['ledgers','budget','currency','categories','chat','general'];
  if (!valid.includes(screen)) screen = 'ledgers';

  $$('#menu .list-group-item').forEach(b=>{
    b.classList.toggle('active', b.dataset.screen === screen);
  });

  $('#screen').innerHTML = templates[screen] || '<div class="card p-3">N/A</div>';

  bindScreenEvents(screen);
}

// 綁事件
function bindScreenEvents(screen) {
  if (screen === 'ledgers') {
    $('#btn-add-ledger')?.addEventListener('click',()=>{
      const name = ($('#in-ledger-name')?.value || '').trim();
      if (!name) return alert('請輸入帳本名稱');
      const li = document.createElement('li');
      li.className = 'list-group-item';
      li.textContent = name + '（本地示意）';
      $('#list-ledgers').appendChild(li);
      $('#in-ledger-name').value = '';
    });
  }

  if (screen === 'budget') {
    $('#btn-save-budget')?.addEventListener('click',()=>{
      const v = Number($('#in-month-budget')?.value || 0);
      alert('（示意）已儲存每月總預算：NT$ ' + v.toLocaleString());
    });
  }

  if (screen === 'chat') {
    $('#btn-save-chat')?.addEventListener('click',()=>{
      const role = ($('#in-role')?.value || '').trim();
      const cmd  = ($('#in-command')?.value || '').trim();
      alert(`（示意）已儲存聊天設定：\n角色：${role || '未填'}\n指令：${cmd || '未填'}`);
    });
  }

  if (screen === 'general') {
    $('#btn-enable-remind')?.addEventListener('click',()=>{
      const t = $('#in-remind-at')?.value || '21:00';
      alert('（示意）已啟用每日提醒，時間：' + t);
    });
    $('#btn-disable-remind')?.addEventListener('click',()=>alert('（示意）已停用每日提醒'));
    $('#btn-export')?.addEventListener('click',()=>alert('（示意）匯出帳本…'));
    $('#file-import')?.addEventListener('change',(e)=>{
      const f = e.target.files?.[0];
      if (!f) return;
      alert('（示意）已選擇匯入檔案：' + f.name);
      e.target.value = '';
    });
  }
}

/** 對外：掛載到 host（元素或元素 id）
 *  @param {HTMLElement|string} host
 *  @param {{useHash?: boolean}} opts
 */
export function mountAccountingSettings(host, opts = {}) {
  const el = (typeof host === 'string') ? document.getElementById(host) : host;
  if (!el) return console.warn('[accounting-settings] host not found');

  renderShell(el);

  $$('#menu .list-group-item').forEach(btn=>{
    btn.addEventListener('click',()=> {
      const s = btn.dataset.screen;
      show(s);
      if (opts.useHash) history.replaceState(null, '', '#' + s);
    });
  });

  const init = (opts.useHash && location.hash) ? location.hash.replace('#','') : 'ledgers';
  show(init);
}
