/**
 * SuperTool 記帳設定（純前端 Demo 版）
 * 完全不需 Firebase：所有資料存 localStorage（key: st_acc_settings_v1）
 * 分頁：管理帳本 / 管理預算 / 管理類型 / 管理貨幣 / 聊天設定 / 一般設定
 */

console.log('[acc-settings DEMO] start', new Date().toISOString());

/* ============= 持久層（localStorage） ============= */
const STORE_KEY = 'st_acc_settings_v1';

const seed = () => ({
  ledgers: [
    { id: 'L1', name: '個人', currency: 'TWD', createdAt: Date.now() },
    { id: 'L2', name: '家庭', currency: 'TWD', createdAt: Date.now() - 1000 }
  ],
  currentLedgerId: 'L1',
  categories: {
    L1: [
      { id: 'c1', name: '餐飲', type: 'expense', order: 1 },
      { id: 'c2', name: '交通', type: 'expense', order: 2 },
      { id: 'c3', name: '薪資', type: 'income', order: 3 }
    ],
    L2: []
  },
  budgets: {
    L1: [
      { id: 'b1', name: '10月餐飲', amount: 5000, startAt: '2025-10-01', endAt: '2025-10-31' }
    ],
    L2: []
  },
  settings: {
    currencies: { base: 'TWD', rates: { USD: 32.1, JPY: 0.22 } },
    chat: { persona: 'minimal_accountant', custom: '', commandsEnabled: true },
    general: { reminderEnabled: true, reminderTime: '21:00' }
  }
});

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return seed();
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : seed();
  } catch {
    return seed();
  }
}
function saveState(s) {
  localStorage.setItem(STORE_KEY, JSON.stringify(s));
}
let S = loadState();
const gid = () => '_' + Math.random().toString(36).slice(2, 9);

/* ============= DOM helpers ============= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const money = n => (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 0 });

/* ============= 外觀樣式 ============= */
(function injectStyle() {
  const css = document.createElement('style');
  css.textContent = `
  .card{background:rgba(15,23,42,.9);border:1px solid rgba(255,255,255,.1);border-radius:16px;color:#fff;margin-bottom:16px}
  .card-header{padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.12);font-weight:700}
  .card-body{padding:16px}
  .row{display:flex;gap:8px;flex-wrap:wrap}
  .list{display:grid;gap:8px}
  .item{display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 12px}
  .btn{border:none;border-radius:10px;padding:10px 14px;background:#2563eb;color:#fff;font-weight:700;cursor:pointer}
  .btn.ghost{background:rgba(255,255,255,.1)}
  .btn.danger{background:#ef4444}
  .btn:disabled{opacity:.6;cursor:not-allowed}
  input,select,textarea{background:rgba(30,41,59,.6);border:1px solid rgba(148,163,184,.3);border-radius:10px;color:#fff;padding:10px 12px}
  label.small{opacity:.8;font-size:12px}
  `;
  document.head.appendChild(css);
})();

/* ============= 殼 ============= */
const mount = document.getElementById('app') || document.body;
mount.innerHTML = `
  <div id="banner" class="card" style="border-style:dashed">
    <div class="card-body">🟡 <b>展示模式</b>：此頁為<strong>純前端</strong>版本，資料儲存在瀏覽器 <code>localStorage</code>。</div>
  </div>

  <section id="view-ledgers"></section>
  <section id="view-budgets" style="display:none"></section>
  <section id="view-categories" style="display:none"></section>
  <section id="view-currency" style="display:none"></section>
  <section id="view-chat" style="display:none"></section>
  <section id="view-general" style="display:none"></section>
`;

/* ============= Tabs：用 URL hash 控制顯示 ============= */
const tabs = ['ledgers', 'budgets', 'categories', 'currency', 'chat', 'general'];
function showTab(name) {
  tabs.forEach(t => {
    const on = t === name;
    const el = document.getElementById('view-' + t);
    if (el) el.style.display = on ? 'block' : 'none';
  });
  // 按鈕 active（使用你 HTML 上方那排）
  document.querySelectorAll('.tabs button').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === name);
  });
  // 渲染當前頁
  if (name === 'ledgers') renderLedgers();
  if (name === 'budgets') renderBudgets();
  if (name === 'categories') renderCategories();
  if (name === 'currency') renderCurrency();
  if (name === 'chat') renderChat();
  if (name === 'general') renderGeneral();
}
window.addEventListener('hashchange', () => showTab((location.hash || '#ledgers').slice(1)));
showTab((location.hash || '#ledgers').slice(1));

/* ============= Ledgers ============= */
function renderLedgers() {
  const el = $('#view-ledgers');
  const rows = [...S.ledgers].sort((a, b) => b.createdAt - a.createdAt);
  el.innerHTML = `
    <div class="card">
      <div class="card-header">管理帳本</div>
      <div class="card-body">
        <div class="row" style="margin-bottom:8px">
          <input id="newLedgerName" placeholder="帳本名稱（例如：個人）" style="min-width:260px">
          <button id="addLedger" class="btn">新增</button>
          <button id="resetDemo" class="btn ghost">重置為預設資料</button>
        </div>
        <div class="list" id="ledgerList"></div>
      </div>
    </div>
  `;
  const list = $('#ledgerList', el);
  list.innerHTML = rows.map(v => `
    <div class="item">
      <div>
        <div style="font-weight:700">${v.name || '(未命名)'}</div>
        <div style="opacity:.8;font-size:12px">主貨幣：${v.currency || 'TWD'}　ID：${v.id}${S.currentLedgerId===v.id?'（目前）':''}</div>
      </div>
      <div class="row">
        <button class="btn ghost" data-use="${v.id}">使用</button>
        <button class="btn danger" data-del="${v.id}">刪除</button>
      </div>
    </div>
  `).join('') || '<div class="item">尚無帳本</div>';

  $('#addLedger', el).onclick = () => {
    const name = $('#newLedgerName', el).value.trim();
    if (!name) return;
    S.ledgers.unshift({ id: gid(), name, currency: 'TWD', createdAt: Date.now() });
    saveState(S); renderLedgers();
  };
  $('#resetDemo', el).onclick = () => {
    S = seed(); saveState(S); showTab('ledgers');
  };
  $$('button[data-use]', el).forEach(b => b.onclick = () => {
    S.currentLedgerId = b.dataset.use; saveState(S);
    renderLedgers(); // refresh
  });
  $$('button[data-del]', el).forEach(b => b.onclick = () => {
    if (!confirm('確定刪除此帳本與其資料？')) return;
    const id = b.dataset.del;
    S.ledgers = S.ledgers.filter(x => x.id !== id);
    delete S.categories[id]; delete S.budgets[id];
    if (S.currentLedgerId === id) S.currentLedgerId = S.ledgers[0]?.id || null;
    saveState(S); renderLedgers();
  });
}

/* ============= Categories ============= */
function renderCategories() {
  const el = $('#view-categories');
  const L = S.currentLedgerId;
  if (!L) { el.innerHTML = '<div class="card"><div class="card-body">請先建立或選擇帳本</div></div>'; return; }
  const cats = S.categories[L] || [];
  el.innerHTML = `
    <div class="card">
      <div class="card-header">管理類型（目前帳本：${S.ledgers.find(x=>x.id===L)?.name||'-'}）</div>
      <div class="card-body">
        <div class="row" style="margin-bottom:8px">
          <select id="catType" style="min-width:120px">
            <option value="expense">支出</option><option value="income">收入</option>
          </select>
          <input id="newCatName" placeholder="新增類型名稱…" style="min-width:240px">
          <button id="addCat" class="btn">新增</button>
        </div>
        <div class="list" id="catList"></div>
      </div>
    </div>
  `;
  const type = $('#catType', el).value = 'expense';
  drawList(type);

  $('#catType', el).onchange = () => drawList($('#catType', el).value);
  $('#addCat', el).onclick = () => {
    const name = $('#newCatName', el).value.trim(); if (!name) return;
    const t = $('#catType', el).value;
    (S.categories[L] ||= []).push({ id: gid(), name, type: t, order: Date.now() });
    saveState(S); $('#newCatName', el).value = ''; drawList(t);
  };

  function drawList(t) {
    const list = $('#catList', el);
    const rows = (S.categories[L] || []).filter(x => x.type === t).sort((a,b)=>a.order-b.order);
    list.innerHTML = rows.map(v => `
      <div class="item">
        <div>${v.name}</div>
        <button class="btn danger" data-id="${v.id}">刪除</button>
      </div>
    `).join('') || '<div class="item">尚無類型</div>';
    $$('button[data-id]', list).forEach(b => b.onclick = () => {
      S.categories[L] = (S.categories[L]||[]).filter(x => x.id !== b.dataset.id);
      saveState(S); drawList(t);
    });
  }
}

/* ============= Budgets ============= */
function renderBudgets() {
  const el = $('#view-budgets');
  const L = S.currentLedgerId;
  if (!L) { el.innerHTML = '<div class="card"><div class="card-body">請先建立或選擇帳本</div></div>'; return; }
  const rows = S.budgets[L] || [];
  el.innerHTML = `
    <div class="card">
      <div class="card-header">管理預算（目前帳本）</div>
      <div class="card-body">
        <div class="row" style="margin-bottom:8px">
          <input id="bName" placeholder="名稱（如10月餐飲）" style="min-width:220px">
          <input id="bAmt" type="number" placeholder="金額" style="width:140px">
          <input id="bStart" type="date">
          <input id="bEnd" type="date">
          <button id="bAdd" class="btn">新增</button>
        </div>
        <div class="list" id="bList"></div>
      </div>
    </div>
  `;
  const list = $('#bList', el);
  list.innerHTML = rows.map(v => `
    <div class="item">
      <div><b>${v.name}</b>｜金額 ${money(v.amount)}｜${v.startAt} ~ ${v.endAt}</div>
      <button class="btn danger" data-id="${v.id}">刪除</button>
    </div>
  `).join('') || '<div class="item">尚無預算</div>';
  $('#bAdd', el).onclick = () => {
    const name = $('#bName', el).value.trim();
    const amount = Number($('#bAmt', el).value || 0);
    const s = $('#bStart', el).value, e = $('#bEnd', el).value;
    if (!name || !amount || !s || !e) return alert('請完整填寫');
    (S.budgets[L] ||= []).unshift({ id: gid(), name, amount, startAt: s, endAt: e });
    saveState(S); renderBudgets();
  };
  $$('button[data-id]', list).forEach(b => b.onclick = () => {
    S.budgets[L] = (S.budgets[L]||[]).filter(x => x.id !== b.dataset.id);
    saveState(S); renderBudgets();
  });
}

/* ============= Currency（使用者設定 + 帳本主幣） ============= */
function renderCurrency() {
  const el = $('#view-currency');
  const L = S.currentLedgerId;
  if (!L) { el.innerHTML = '<div class="card"><div class="card-body">請先建立或選擇帳本</div></div>'; return; }
  const ledger = S.ledgers.find(x => x.id === L);
  const cur = S.settings.currencies || { base: 'TWD', rates: {} };

  el.innerHTML = `
    <div class="card">
      <div class="card-header">管理貨幣（目前帳本：${ledger?.name || '-' }）</div>
      <div class="card-body">
        <div class="row" style="margin-bottom:10px">
          <label class="small">主貨幣</label>
          <input id="baseCurrency" value="${cur.base || 'TWD'}" style="width:120px">
          <button id="saveBase" class="btn ghost">儲存</button>
        </div>

        <div class="row" style="margin-bottom:8px">
          <input id="rateCode" placeholder="幣別（USD）" style="width:140px">
          <input id="rateVal"  placeholder="對主幣匯率（如 32.1）" style="width:180px">
          <button id="addRate" class="btn">新增匯率</button>
        </div>
        <div class="list" id="rateList"></div>

        <hr style="border-color:rgba(255,255,255,.12);margin:16px 0">
        <div class="row">
          <label class="small">帳本主貨幣</label>
          <input id="ledgerCur" value="${ledger?.currency || 'TWD'}" style="width:120px">
          <button id="saveLedgerCur" class="btn ghost">儲存帳本</button>
        </div>
      </div>
    </div>
  `;

  const list = $('#rateList', el);
  const rates = Object.entries(cur.rates || {});
  list.innerHTML = rates.map(([k, v]) => `
    <div class="item">
      <div>${k} → ${v}</div>
      <button class="btn danger" data-k="${k}">刪除</button>
    </div>
  `).join('') || '<div class="item">尚無匯率</div>';

  $('#saveBase', el).onclick = () => {
    const base = ($('#baseCurrency', el).value || 'TWD').toUpperCase();
    S.settings.currencies = { base, rates: cur.rates || {} };
    saveState(S); renderCurrency();
  };
  $('#addRate', el).onclick = () => {
    const k = ($('#rateCode', el).value || '').trim().toUpperCase();
    const v = Number($('#rateVal', el).value || 0);
    if (!k || !Number.isFinite(v) || v <= 0) return;
    const next = { ...(S.settings.currencies.rates || {}) }; next[k] = v;
    S.settings.currencies = { base: $('#baseCurrency', el).value || 'TWD', rates: next };
    saveState(S); renderCurrency();
  };
  $$('button[data-k]', list).forEach(b => b.onclick = () => {
    const next = { ...(S.settings.currencies.rates || {}) }; delete next[b.dataset.k];
    S.settings.currencies = { base: $('#baseCurrency', el).value || 'TWD', rates: next };
    saveState(S); renderCurrency();
  });

  $('#saveLedgerCur', el).onclick = () => {
    const code = ($('#ledgerCur', el).value || 'TWD').toUpperCase();
    const idx = S.ledgers.findIndex(x => x.id === L);
    if (idx >= 0) S.ledgers[idx].currency = code;
    saveState(S); renderCurrency();
  };
}

/* ============= Chat ============= */
function renderChat() {
  const el = $('#view-chat');
  const chat = S.settings.chat || { persona: 'minimal_accountant', custom: '', commandsEnabled: true };
  el.innerHTML = `
    <div class="card">
      <div class="card-header">專屬角色與指令</div>
      <div class="card-body">
        <div class="row" style="margin-bottom:8px">
          <label class="small" style="width:100%">角色（Persona）</label>
          <select id="persona" style="min-width:220px">
            <option value="minimal_accountant">極簡會計師（精簡、重點）</option>
            <option value="friendly_helper">溫暖助手（鼓勵、貼心）</option>
            <option value="strict_coach">節制教練（嚴謹、控管）</option>
          </select>
        </div>
        <div class="row" style="margin-bottom:8px; width:100%">
          <label class="small" style="width:100%">自定義描述（可留白）</label>
          <textarea id="personaCustom" rows="3" style="width:100%" placeholder="描述語氣、風格、輸出格式重點…"></textarea>
        </div>
        <div class="row" style="align-items:center;margin-bottom:8px">
          <input id="cmdEnabled" type="checkbox" ${chat.commandsEnabled ? 'checked' : ''} />
          <label for="cmdEnabled" style="user-select:none">啟用記帳快速指令（/add /sum /budget…）</label>
        </div>
        <button id="saveChat" class="btn">儲存聊天設定</button>
      </div>
    </div>
  `;
  $('#persona', el).value = chat.persona || 'minimal_accountant';
  $('#personaCustom', el).value = chat.custom || '';

  $('#saveChat', el).onclick = () => {
    S.settings.chat = {
      persona: $('#persona', el).value,
      custom: $('#personaCustom', el).value,
      commandsEnabled: $('#cmdEnabled', el).checked
    };
    saveState(S);
    alert('已儲存聊天設定（Demo）');
  };
}

/* ============= General ============= */
function renderGeneral() {
  const el = $('#view-general');
  const g = S.settings.general || { reminderEnabled: true, reminderTime: '21:00' };
  el.innerHTML = `
    <div class="card">
      <div class="card-header">每日提醒</div>
      <div class="card-body">
        <div class="row" style="align-items:center;margin-bottom:8px">
          <input id="remindEnable" type="checkbox" ${g.reminderEnabled ? 'checked' : ''}/>
          <label for="remindEnable" style="user-select:none">啟用每日提醒</label>
        </div>
        <div class="row">
          <input id="remindTime" type="time" value="${g.reminderTime || '21:00'}" style="width:140px">
          <button id="saveRemind" class="btn">儲存</button>
        </div>
        <div style="opacity:.8;margin-top:8px;font-size:12px">（Demo：設定儲存在瀏覽器，不會同步雲端）</div>
      </div>
    </div>
  `;
  $('#saveRemind', el).onclick = () => {
    S.settings.general = {
      reminderEnabled: $('#remindEnable', el).checked,
      reminderTime: $('#remindTime', el).value || '21:00'
    };
    saveState(S);
    alert('已儲存每日提醒設定（Demo）');
  };
}

// 首次顯示（避免 hash 是其他頁時，先讓當頁渲染一次）
showTab((location.hash || '#ledgers').slice(1));
console.log('[acc-settings DEMO] ready');
