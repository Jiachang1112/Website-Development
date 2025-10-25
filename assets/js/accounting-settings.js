// assets/js/accounting-settings.js
// SuperTool | 記帳設定頁
// - 內建「未登入自動 Demo」：在記憶體運作，重整回種子資料
// - 登入後自動切回 Firestore 真資料
// - 功能：管理帳本、預算、類型、貨幣、聊天設定、一般設定

/* =========================
 * Imports（僅在 Firestore 模式會用到）
 * ========================= */
import { auth, db } from '../firebase.js';
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp,
  collection, addDoc, deleteDoc, query, orderBy, getDocs
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

/* =========================
 * 小工具 & 風格
 * ========================= */
const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
const toast = (m)=>alert(m);

(function injectStyle(){
  const css = document.createElement('style');
  css.textContent = `
  .topbar { display:flex; gap:8px; flex-wrap:wrap; margin:12px 0 16px; }
  .pill {
    -webkit-appearance:none; appearance:none; border-radius:999px;
    padding:10px 14px; font-weight:700; cursor:pointer; line-height:1;
    border:1px solid rgba(255,255,255,.22); color:#fff; background:rgba(255,255,255,.10);
    transition:.15s ease;
  }
  .pill:hover { background:rgba(255,255,255,.18); }
  .pill.active { background:linear-gradient(90deg,#ff7ab6,#ff4d6d); border-color:transparent; }
  .card { background:rgba(0,0,0,.35); color:#fff; border:1px solid rgba(255,255,255,.12); }
  .card-header { border-bottom:1px solid rgba(255,255,255,.12); font-weight:700; }
  .list-group-item { background:rgba(255,255,255,.05); color:#fff; border:1px solid rgba(255,255,255,.1); }
  .btn-grad { background:linear-gradient(90deg,#ff7ab6,#ff4d6d); border:none; color:#fff; font-weight:700; }
  .btn-ghost { background:rgba(255,255,255,.10); border:1px solid rgba(255,255,255,.2); color:#fff; }
  .btn-danger { background:#ef4444; border:none; color:#fff; font-weight:700; }
  .banner { background:rgba(255,255,255,.10); border:1px dashed rgba(255,255,255,.25);
            border-radius:12px; padding:10px 12px; margin:10px 0 16px; }
  `;
  document.head.appendChild(css);
})();

/* =========================
 * Demo 種子資料（未登入使用）
 * ========================= */
const DEMO = {
  user: {
    settings: {
      currencies: { base:'TWD', rates:{ USD:32.1, JPY:0.22 } },
      chat:      { persona:'minimal_accountant', custom:'', commandsEnabled:true },
      general:   { reminderEnabled:true, reminderTime:'21:00' }
    }
  },
  ledgers: [
    { id:'demo-L1', name:'個人',  currency:'TWD', createdAt:Date.now() },
    { id:'demo-L2', name:'家庭',  currency:'TWD', createdAt:Date.now()-1000 }
  ],
  categories: {
    'demo-L1': [
      { id:'c1', name:'餐飲', type:'expense', color:'#60a5fa', order:1 },
      { id:'c2', name:'交通', type:'expense', color:'#34d399', order:2 },
      { id:'c3', name:'薪資', type:'income',  color:'#fbbf24', order:3 },
    ],
    'demo-L2': []
  },
  budgets: {
    'demo-L1': [
      { id:'b1', name:'10月餐飲', amount:5000, startAt:'2025-10-01', endAt:'2025-10-31' }
    ],
    'demo-L2': []
  },
  currentLedgerId: 'demo-L1'
};
const gid = ()=>'_'+Math.random().toString(36).slice(2,9);

/* =========================
 * Model 狀態（兩模式共用）
 * ========================= */
let MODE = 'demo';          // 'demo' | 'firestore'
let UID  = 'demo';
let currentLedgerId = null; // 目前選取帳本 id（兩模式共用引用）

/* =========================
 * View：骨架
 * ========================= */
function renderShell(){
  const root = $('#app') || document.body;
  const el = document.createElement('div');
  el.className = 'container py-4';
  el.innerHTML = `
    <h3 class="mb-2">記帳設定</h3>
    <div id="modeBanner" class="banner" style="display:none"></div>

    <div class="topbar" id="tabs">
      <button class="pill active" data-tab="ledgers">管理帳本</button>
      <button class="pill" data-tab="budgets">管理預算</button>
      <button class="pill" data-tab="categories">管理類型</button>
      <button class="pill" data-tab="currency">管理貨幣</button>
      <button class="pill" data-tab="chat">聊天設定</button>
      <button class="pill" data-tab="general">一般設定</button>
    </div>

    <section id="view-ledgers"></section>
    <section id="view-budgets" style="display:none"></section>
    <section id="view-categories" style="display:none"></section>
    <section id="view-currency" style="display:none"></section>
    <section id="view-chat" style="display:none"></section>
    <section id="view-general" style="display:none"></section>
  `;
  root.replaceChildren(el);

  // Tabs
  $('#tabs').addEventListener('click', (e)=>{
    const b = e.target.closest('[data-tab]'); if(!b) return;
    $$('#tabs .pill').forEach(p=>p.classList.toggle('active', p===b));
    ['ledgers','budgets','categories','currency','chat','general'].forEach(id=>{
      $('#view-'+id).style.display = (b.dataset.tab===id)?'block':'none';
    });
    // 依 tab 重畫
    if (b.dataset.tab==='ledgers')    renderLedgers();
    if (b.dataset.tab==='budgets')    renderBudgets();
    if (b.dataset.tab==='categories') renderCategories();
    if (b.dataset.tab==='currency')   renderCurrency();
    if (b.dataset.tab==='chat')       renderChat();
    if (b.dataset.tab==='general')    renderGeneral();
  });
}

/* =========================
 * 讀寫層：Demo 與 Firestore 的抽象
 * ========================= */

// ---- user doc 相關 ----
async function getUserDoc(){
  if (MODE==='demo') return structuredClone(DEMO.user);
  const ref = doc(db, 'users', UID);
  const snap = await getDoc(ref);
  if (!snap.exists()) await setDoc(ref, { createdAt: serverTimestamp() }, { merge: true });
  return (await getDoc(ref)).data() || {};
}
async function setUserSettings(path, value){
  if (MODE==='demo'){
    // path like 'settings.chat' or 'settings.currencies'
    const keys = path.split('.');
    let cur = DEMO.user;
    while (keys.length > 1) { const k = keys.shift(); cur = (cur[k] ||= {}); }
    cur[keys[0]] = value;
    return;
  }
  await updateDoc(doc(db,'users',UID), { [path]: value, updatedAt: serverTimestamp() });
}

// ---- ledgers ----
async function listLedgers(){
  if (MODE==='demo'){
    return [...DEMO.ledgers].sort((a,b)=>b.createdAt-a.createdAt);
  }
  const qy = query(collection(db,'users',UID,'ledgers'), orderBy('createdAt','desc'));
  const snap = await getDocs(qy);
  return snap.docs.map(d=>({ id:d.id, ...d.data() }));
}
async function addLedger(name){
  if (MODE==='demo'){
    DEMO.ledgers.unshift({ id:gid(), name, currency:'TWD', createdAt:Date.now() });
    return;
  }
  await addDoc(collection(db,'users',UID,'ledgers'), {
    name, currency:'TWD', members:{ [UID]:'owner' },
    createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
}
async function deleteLedger(id){
  if (MODE==='demo'){
    DEMO.ledgers = DEMO.ledgers.filter(x=>x.id!==id);
    delete DEMO.categories[id]; delete DEMO.budgets[id];
    return;
  }
  await deleteDoc(doc(db,'users',UID,'ledgers', id));
}

// ---- categories ----
async function listCategories(ledgerId){
  if (MODE==='demo') return [...(DEMO.categories[ledgerId]||[])];
  const qy = query(collection(db,'users',UID,'ledgers',ledgerId,'categories'), orderBy('order','asc'));
  const snap = await getDocs(qy);
  return snap.docs.map(d=>({ id:d.id, ...d.data() }));
}
async function addCategory(ledgerId, { type, name }){
  if (MODE==='demo'){
    (DEMO.categories[ledgerId] ||= []).push({ id:gid(), name, type, color:'#60a5fa', order:Date.now() });
    return;
  }
  await addDoc(collection(db,'users',UID,'ledgers',ledgerId,'categories'), {
    name, type, color:'#60a5fa', order: Date.now(), parentId:null,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
}
async function deleteCategory(ledgerId, catId){
  if (MODE==='demo'){
    DEMO.categories[ledgerId] = (DEMO.categories[ledgerId]||[]).filter(x=>x.id!==catId);
    return;
  }
  await deleteDoc(doc(db,'users',UID,'ledgers',ledgerId,'categories', catId));
}

// ---- budgets ----
async function listBudgets(ledgerId){
  if (MODE==='demo') return [...(DEMO.budgets[ledgerId]||[])];
  const qy = query(collection(db,'users',UID,'ledgers',ledgerId,'budgets'), orderBy('createdAt','desc'));
  const snap = await getDocs(qy);
  return snap.docs.map(d=>{
    const v=d.data();
    const s=(v.startAt?.toDate?.()||new Date(v.startAt)).toISOString().slice(0,10);
    const e=(v.endAt?.toDate?.()||new Date(v.endAt)).toISOString().slice(0,10);
    return { id:d.id, name:v.name, amount:v.amount, startAt:s, endAt:e };
  });
}
async function addBudget(ledgerId, { name, amount, startAt, endAt }){
  if (MODE==='demo'){
    (DEMO.budgets[ledgerId] ||= []).unshift({ id:gid(), name, amount:Number(amount)||0, startAt, endAt });
    return;
  }
  await addDoc(collection(db,'users',UID,'ledgers',ledgerId,'budgets'), {
    name, amount:Number(amount)||0, period:'custom',
    startAt:new Date(startAt+'T00:00:00'), endAt:new Date(endAt+'T23:59:59'),
    currency:'TWD', rollover:false, createdAt:serverTimestamp(), updatedAt:serverTimestamp()
  });
}
async function deleteBudget(ledgerId, id){
  if (MODE==='demo'){
    DEMO.budgets[ledgerId] = (DEMO.budgets[ledgerId]||[]).filter(x=>x.id!==id);
    return;
  }
  await deleteDoc(doc(db,'users',UID,'ledgers',ledgerId,'budgets', id));
}

// ---- currencies (user.settings.currencies, ledger.currency) ----
async function setLedgerCurrency(ledgerId, code){
  if (MODE==='demo'){
    const row = DEMO.ledgers.find(x=>x.id===ledgerId); if (row) row.currency = code;
    return;
  }
  await updateDoc(doc(db,'users',UID,'ledgers',ledgerId), { currency:code, updatedAt:serverTimestamp() });
}

/* =========================
 * Views：各分頁
 * ========================= */

// ---- Ledgers ----
async function renderLedgers(){
  const el = $('#view-ledgers');
  const rows = await listLedgers();
  if (!currentLedgerId) currentLedgerId = (MODE==='demo'?DEMO.currentLedgerId:rows[0]?.id)||null;

  el.innerHTML = `
    <div class="card">
      <div class="card-header">管理帳本</div>
      <div class="card-body">
        <div class="mb-2 d-flex gap-2">
          <input id="newLedgerName" class="form-control" placeholder="帳本名稱（例如：個人）">
          <button id="addLedger" class="btn-grad btn">新增</button>
        </div>
        <div id="ledgerList" class="list-group small"></div>
      </div>
    </div>
  `;
  const list = $('#ledgerList');
  list.innerHTML = rows.map(v=>`
    <div class="list-group-item d-flex justify-content-between align-items-center">
      <div>
        <div class="fw-bold">${v.name || '(未命名)'}</div>
        <div class="text-muted">主貨幣：${v.currency || 'TWD'}　ID：${v.id}${currentLedgerId===v.id?'（目前）':''}</div>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-ghost btn-sm" data-use="${v.id}">使用</button>
        <button class="btn btn-danger btn-sm" data-del="${v.id}">刪除</button>
      </div>
    </div>
  `).join('') || '<div class="list-group-item text-muted">尚無帳本</div>';

  $('#addLedger').onclick = async ()=>{
    const name = $('#newLedgerName').value.trim(); if (!name) return;
    await addLedger(name); $('#newLedgerName').value='';
    renderLedgers(); // refresh
  };
  $$('button[data-use]', list).forEach(b=> b.onclick=()=>{
    currentLedgerId = b.dataset.use;
    if (MODE==='demo') DEMO.currentLedgerId = currentLedgerId;
    renderLedgers(); renderCategories(); renderBudgets(); renderCurrency();
  });
  $$('button[data-del]', list).forEach(b=> b.onclick=async ()=>{
    if (!confirm('確定要刪除此帳本與其資料？')) return;
    await deleteLedger(b.dataset.del);
    if (currentLedgerId === b.dataset.del) currentLedgerId = null;
    renderLedgers(); renderCategories(); renderBudgets(); renderCurrency();
  });
}

// ---- Categories ----
async function renderCategories(){
  const el = $('#view-categories');
  if (!currentLedgerId){ el.innerHTML = '<div class="card"><div class="card-body">請先建立或選擇帳本</div></div>'; return; }

  const rows = await listCategories(currentLedgerId);
  el.innerHTML = `
    <div class="card">
      <div class="card-header">管理類型（目前帳本：${(MODE==='demo'?DEMO.ledgers:await listLedgers()).find(x=>x.id===currentLedgerId)?.name || '-' }）</div>
      <div class="card-body">
        <div class="mb-2 d-flex gap-2">
          <select id="catType" class="form-select" style="max-width:140px">
            <option value="expense">支出</option><option value="income">收入</option>
          </select>
          <input id="newCatName" class="form-control" placeholder="新增類型名稱…">
          <button id="addCat" class="btn btn-grad">新增</button>
        </div>
        <div id="catList" class="list-group small"></div>
      </div>
    </div>
  `;
  const type = $('#catType').value || 'expense';
  const list = $('#catList');
  const filtered = rows.filter(v=>v.type===type).sort((a,b)=>a.order-b.order);
  list.innerHTML = filtered.map(v=>`
    <div class="list-group-item d-flex justify-content-between align-items-center">
      <div>${v.name}</div>
      <button class="btn btn-danger btn-sm" data-id="${v.id}">刪除</button>
    </div>
  `).join('') || '<div class="list-group-item text-muted">尚無類型</div>';

  $('#catType').onchange = renderCategories;
  $('#addCat').onclick = async ()=>{
    const name = $('#newCatName').value.trim(); if (!name) return;
    await addCategory(currentLedgerId, { type: $('#catType').value, name });
    $('#newCatName').value = '';
    renderCategories();
  };
  $$('button[data-id]', list).forEach(b=> b.onclick=async ()=>{
    await deleteCategory(currentLedgerId, b.dataset.id);
    renderCategories();
  });
}

// ---- Budgets ----
async function renderBudgets(){
  const el = $('#view-budgets');
  if (!currentLedgerId){ el.innerHTML = '<div class="card"><div class="card-body">請先建立或選擇帳本</div></div>'; return; }

  const rows = await listBudgets(currentLedgerId);
  el.innerHTML = `
    <div class="card">
      <div class="card-header">管理預算（目前帳本）</div>
      <div class="card-body">
        <div class="row g-2 mb-2">
          <div class="col-md-4"><input id="bName" class="form-control" placeholder="名稱（如10月餐飲）"></div>
          <div class="col-md-3"><input id="bAmt" type="number" class="form-control" placeholder="金額"></div>
          <div class="col-md-5 d-flex gap-2">
            <input id="bStart" type="date" class="form-control">
            <input id="bEnd" type="date" class="form-control">
            <button id="bAdd" class="btn btn-grad">新增</button>
          </div>
        </div>
        <div id="bList" class="list-group small"></div>
      </div>
    </div>
  `;
  const list = $('#bList');
  list.innerHTML = rows.map(v=>`
    <div class="list-group-item d-flex justify-content-between align-items-center">
      <div><b>${v.name}</b>｜金額 ${v.amount}｜${v.startAt} ~ ${v.endAt}</div>
      <button class="btn btn-danger btn-sm" data-id="${v.id}">刪除</button>
    </div>
  `).join('') || '<div class="list-group-item text-muted">尚無預算</div>';

  $('#bAdd').onclick = async ()=>{
    const name=$('#bName').value.trim(), amt=$('#bAmt').value;
    const s=$('#bStart').value, e=$('#bEnd').value;
    if (!name || !amt || !s || !e) return toast('請完整填寫');
    await addBudget(currentLedgerId, { name, amount:amt, startAt:s, endAt:e });
    $('#bName').value=''; $('#bAmt').value=''; $('#bStart').value=''; $('#bEnd').value='';
    renderBudgets();
  };
  $$('button[data-id]', list).forEach(b=> b.onclick=async ()=>{
    await deleteBudget(currentLedgerId, b.dataset.id);
    renderBudgets();
  });
}

// ---- Currency ----
async function renderCurrency(){
  const el = $('#view-currency');
  if (!currentLedgerId){ el.innerHTML = '<div class="card"><div class="card-body">請先建立或選擇帳本</div></div>'; return; }

  const u = await getUserDoc();
  const cur = u.settings?.currencies || { base:'TWD', rates:{} };
  const ledgers = (MODE==='demo'?DEMO.ledgers:await listLedgers());
  const nowLedger = ledgers.find(l=>l.id===currentLedgerId);

  el.innerHTML = `
    <div class="card">
      <div class="card-header">管理貨幣（目前帳本：${nowLedger?.name || '-'}）</div>
      <div class="card-body">
        <div class="row g-2 align-items-center mb-2">
          <div class="col-auto">主貨幣：</div>
          <div class="col-auto">
            <input id="baseCurrency" class="form-control" style="width:120px" value="${cur.base || 'TWD'}">
          </div>
          <div class="col-auto"><button id="saveBase" class="btn btn-ghost">儲存</button></div>
        </div>

        <div class="row g-2 mb-2">
          <div class="col-md-3"><input id="rateCode" class="form-control" placeholder="幣別（USD）"></div>
          <div class="col-md-3"><input id="rateVal"  class="form-control" placeholder="對主幣匯率（如 32.1）"></div>
          <div class="col-md-2"><button id="addRate" class="btn btn-grad">新增匯率</button></div>
        </div>

        <div id="rateList" class="list-group small mb-3"></div>

        <div class="row g-2 align-items-center">
          <div class="col-auto">帳本主貨幣：</div>
          <div class="col-auto"><input id="ledgerCur" class="form-control" style="width:120px" value="${nowLedger?.currency || 'TWD'}"></div>
          <div class="col-auto"><button id="saveLedgerCur" class="btn btn-ghost">儲存帳本</button></div>
        </div>
      </div>
    </div>
  `;

  const rateList = $('#rateList');
  const rates = Object.entries(cur.rates||{}).map(([k,v])=>({k,v}));
  rateList.innerHTML = rates.map(r=>`
    <div class="list-group-item d-flex justify-content-between align-items-center">
      <div>${r.k} → ${r.v}</div>
      <button class="btn btn-danger btn-sm" data-k="${r.k}">刪除</button>
    </div>
  `).join('') || '<div class="list-group-item text-muted">尚無匯率</div>';

  // events
  $('#saveBase').onclick = async ()=>{
    const base = ($('#baseCurrency').value || 'TWD').toUpperCase();
    await setUserSettings('settings.currencies', { base, rates: cur.rates||{} });
    toast(MODE==='demo'?'（Demo）主貨幣已更新':'主貨幣已更新');
    renderCurrency();
  };
  $('#addRate').onclick = async ()=>{
    const k = ($('#rateCode').value||'').trim().toUpperCase();
    const v = Number($('#rateVal').value||0);
    if (!k || !Number.isFinite(v) || v<=0) return;
    const next = { base: $('#baseCurrency').value || 'TWD', rates: { ...(cur.rates||{}), [k]: v } };
    await setUserSettings('settings.currencies', next);
    renderCurrency();
  };
  $$('button[data-k]', rateList).forEach(b=> b.onclick = async ()=>{
    const k = b.dataset.k;
    const nextRates = { ...(cur.rates||{}) }; delete nextRates[k];
    await setUserSettings('settings.currencies', { base: cur.base||'TWD', rates: nextRates });
    renderCurrency();
  });

  $('#saveLedgerCur').onclick = async ()=>{
    const code = ($('#ledgerCur').value||'TWD').toUpperCase();
    await setLedgerCurrency(currentLedgerId, code);
    toast(MODE==='demo'?'（Demo）帳本主貨幣已更新':'帳本主貨幣已更新');
    renderCurrency();
  };
}

// ---- Chat ----
async function renderChat(){
  const el = $('#view-chat');
  const u = await getUserDoc();
  const chat = u.settings?.chat || { persona:'minimal_accountant', custom:'', commandsEnabled:true };

  el.innerHTML = `
    <div class="card">
      <div class="card-header">專屬角色與指令</div>
      <div class="card-body">
        <div class="row g-2 mb-3">
          <div class="col-md-4">
            <label class="form-label">角色（Persona）</label>
            <select id="persona" class="form-select">
              <option value="minimal_accountant">極簡會計師（精簡、重點）</option>
              <option value="friendly_helper">溫暖助手（鼓勵、貼心）</option>
              <option value="strict_coach">節制教練（嚴謹、控管）</option>
            </select>
          </div>
          <div class="col-md-8">
            <label class="form-label">自定義描述（可留白）</label>
            <textarea id="personaCustom" class="form-control" rows="3" placeholder="描述語氣、風格、輸出格式重點…"></textarea>
          </div>
        </div>
        <div class="form-check form-switch mb-3">
          <input id="cmdEnabled" class="form-check-input" type="checkbox">
          <label class="form-check-label" for="cmdEnabled">啟用記帳快速指令（/add /sum /budget…）</label>
        </div>
        <button id="saveChat" class="btn btn-grad">儲存聊天設定</button>
      </div>
    </div>
  `;
  $('#persona').value = chat.persona || 'minimal_accountant';
  $('#personaCustom').value = chat.custom || '';
  $('#cmdEnabled').checked = !!chat.commandsEnabled;

  $('#saveChat').onclick = async ()=>{
    const next = {
      persona: $('#persona').value,
      custom: $('#personaCustom').value,
      commandsEnabled: $('#cmdEnabled').checked
    };
    await setUserSettings('settings.chat', next);
    toast(MODE==='demo'?'（Demo）已儲存聊天設定':'已儲存聊天設定');
  };
}

// ---- General ----
async function renderGeneral(){
  const el = $('#view-general');
  const u = await getUserDoc();
  const g = u.settings?.general || { reminderEnabled:true, reminderTime:'21:00' };

  el.innerHTML = `
    <div class="card">
      <div class="card-header">每日提醒</div>
      <div class="card-body">
        <div class="form-check form-switch mb-2">
          <input id="remindEnable" class="form-check-input" type="checkbox">
          <label class="form-check-label" for="remindEnable">啟用每日提醒</label>
        </div>
        <div class="d-flex gap-2">
          <input id="remindTime" type="time" class="form-control" style="max-width:160px">
          <button id="saveRemind" class="btn btn-grad">儲存</button>
        </div>
        <div class="text-muted small mt-2">${MODE==='demo'?'（Demo：設定只在此頁有效）':'（登入模式：將儲存至雲端）'}</div>
      </div>
    </div>
  `;
  $('#remindEnable').checked = !!g.reminderEnabled;
  $('#remindTime').value   = g.reminderTime || '21:00';

  $('#saveRemind').onclick = async ()=>{
    const next = { reminderEnabled: $('#remindEnable').checked, reminderTime: $('#remindTime').value || '21:00' };
    await setUserSettings('settings.general', next);
    toast(MODE==='demo'?'（Demo）已儲存每日提醒設定':'已儲存每日提醒設定');
  };
}

/* =========================
 * Init：自動判定模式（可強制 Demo）
 * ========================= */
function qsHasDemo(){ return /(^|[?#&])demo(=1|$)/i.test(location.search+location.hash); }

async function waitForAuth(timeoutMs=4000){
  // 若外部強制 Demo（window.__FORCE_DEMO 或 ?demo=1），直接回 null
  if (window.__FORCE_DEMO || qsHasDemo()) return null;

  try { if (typeof auth?.authStateReady==='function') { await auth.authStateReady(); return auth.currentUser; } } catch {}
  return await new Promise((resolve)=>{
    let done=false;
    const t=setTimeout(()=>{ if(done) return; done=true; resolve(auth?.currentUser||null); }, timeoutMs);
    try{
      const unsub = auth.onAuthStateChanged((u)=>{ if(done) return; done=true; clearTimeout(t); unsub&&unsub(); resolve(u||null); });
    }catch{ clearTimeout(t); resolve(null); }
  });
}

(async function start(){
  // 畫外殼
  renderShell();

  // 判定模式
  const user = await waitForAuth();
  if (user){
    MODE='firestore'; UID=user.uid;
    $('#modeBanner').style.display='none';
  }else{
    MODE='demo'; UID='demo';
    $('#modeBanner').style.display='block';
    $('#modeBanner').innerHTML = '🟡 目前為 <b>展示模式（未登入）</b>：可新增/刪除/切換，資料只存在此頁。';
  }

  // 初始 currentLedgerId
  if (MODE==='demo'){
    currentLedgerId = DEMO.currentLedgerId;
  }else{
    const rows = await listLedgers();
    currentLedgerId = rows[0]?.id || null;
  }

  // 首次渲染
  await renderLedgers();
  await renderBudgets();
  await renderCategories();
  await renderCurrency();
  await renderChat();
  await renderGeneral();
})();
