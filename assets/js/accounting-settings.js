// assets/js/pages/accounting-settings.js
// 設定頁（帳本/預算/類型/貨幣、聊天設定、匯入/匯出、每日提醒）
// ★ 支援「未登入時的展示模式(Demo)」：資料存在記憶體，操作會即時反映（重整後回到預設）

import { auth, db } from '../firebase.js';
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp,
  collection, addDoc, deleteDoc, query, orderBy, getDocs
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

// ---------- 小工具 ----------
const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
const toast = (m)=>alert(m);
const mount = $('#app') || document.body;

// ---------- 頂部膠囊按鈕樣式（與主頁一致） ----------
(function injectTopbarButtons(){
  const css = document.createElement('style');
  css.textContent = `
  #accset .topbar-banner{
    background:rgba(255,255,255,.08); border:1px dashed rgba(255,255,255,.25);
    color:#fff; padding:10px 12px; border-radius:12px; margin:10px 0 16px;
    font-size:.95rem; display:flex; align-items:center; gap:8px;
  }
  #accset .topbar-btn{
    -webkit-appearance:none;appearance:none;display:inline-flex;align-items:center;justify-content:center;
    gap:8px;padding:10px 14px;border-radius:999px;background:transparent;
    border:1px solid rgba(255,255,255,.22);color:#fff;font-weight:600;line-height:1;cursor:pointer;
    transition:background .15s ease,border-color .15s ease,transform .02s ease;user-select:none;text-decoration:none;
  }
  #accset .topbar-btn:hover{background:rgba(255,255,255,.08)}
  #accset .topbar-btn:active{transform:translateY(1px)}
  #accset .topbar-btn.-primary{background:linear-gradient(180deg,#ff7ab6,#ff4d6d);border-color:transparent;color:#fff}
  #accset .topbar-btn.-primary:hover{filter:saturate(1.05) brightness(1.05)}
  #accset .topbar-btn.-danger{background:#ef4444;border-color:transparent;color:#fff}
  #accset .topbar-btn.-danger:hover{filter:brightness(1.05)}
  #accset .topbar-btn.-secondary{background:rgba(255,255,255,.10);border-color:rgba(255,255,255,.10)}
  #accset .topbar-btn.-ghost{background:transparent;border-color:rgba(255,255,255,.22)}
  #accset .topbar-btn.-sm{padding:6px 10px;font-size:.92rem}
  `;
  document.head.appendChild(css);
})();

// ---------- 畫面骨架 ----------
function renderShell(demo=false){
  const el = document.createElement('div');
  el.id = 'accset';
  el.className = 'container py-4';
  el.innerHTML = `
  <h3 class="mb-2">記帳設定</h3>

  ${demo ? `
  <div class="topbar-banner">🟡 目前為 <b>展示模式（未登入）</b>：可新增/刪除/切換，資料只存在此頁，重新整理會回到初始示範。</div>
  ` : ''}

  <ul class="nav nav-tabs" id="setTabs" role="tablist" style="border-color:rgba(255,255,255,.12)">
    <li class="nav-item"><button class="topbar-btn -secondary" data-bs-toggle="tab" data-bs-target="#tab-ledger" type="button">管理帳本</button></li>
    <li class="nav-item"><button class="topbar-btn -ghost" data-bs-toggle="tab" data-bs-target="#tab-budget" type="button">管理預算</button></li>
    <li class="nav-item"><button class="topbar-btn -ghost" data-bs-toggle="tab" data-bs-target="#tab-category" type="button">管理類型</button></li>
    <li class="nav-item"><button class="topbar-btn -ghost" data-bs-toggle="tab" data-bs-target="#tab-currency" type="button">管理貨幣</button></li>
    <li class="nav-item"><button class="topbar-btn -ghost" data-bs-toggle="tab" data-bs-target="#tab-chat" type="button">聊天設定</button></li>
    <li class="nav-item"><button class="topbar-btn -ghost" data-bs-toggle="tab" data-bs-target="#tab-general" type="button">一般設定</button></li>
  </ul>

  <div class="tab-content border border-top-0 rounded-bottom p-3" style="border-color:rgba(255,255,255,.12)">
    <!-- 帳本 -->
    <div class="tab-pane fade show active" id="tab-ledger">
      <div class="card">
        <div class="card-header">管理帳本</div>
        <div class="card-body">
          <div class="mb-2 d-flex gap-2">
            <input id="newLedgerName" class="form-control" placeholder="帳本名稱（例如：個人）">
            <button id="addLedger" class="topbar-btn -primary">新增</button>
          </div>
          <div id="ledgerList" class="list-group small"></div>
        </div>
      </div>
    </div>

    <!-- 預算 -->
    <div class="tab-pane fade" id="tab-budget">
      <div class="card">
        <div class="card-header">管理預算（目前帳本）</div>
        <div class="card-body">
          <div class="row g-2 mb-2">
            <div class="col-md-4"><input id="budgetName" class="form-control" placeholder="名稱（如10月餐飲）"></div>
            <div class="col-md-3"><input id="budgetAmount" type="number" class="form-control" placeholder="金額"></div>
            <div class="col-md-5 d-flex gap-2">
              <input id="budgetStart" type="date" class="form-control">
              <input id="budgetEnd" type="date" class="form-control">
              <button id="addBudget" class="topbar-btn -primary">新增</button>
            </div>
          </div>
          <div id="budgetList" class="list-group small"></div>
        </div>
      </div>
    </div>

    <!-- 類型 -->
    <div class="tab-pane fade" id="tab-category">
      <div class="card">
        <div class="card-header">管理類型（目前帳本）</div>
        <div class="card-body">
          <div class="mb-2 d-flex gap-2">
            <select id="catType" class="form-select" style="max-width:140px">
              <option value="expense">支出</option>
              <option value="income">收入</option>
            </select>
            <input id="newCatName" class="form-control" placeholder="新增類型名稱…">
            <button id="addCat" class="topbar-btn -primary">新增</button>
          </div>
          <div id="catList" class="list-group small"></div>
        </div>
      </div>
    </div>

    <!-- 貨幣 -->
    <div class="tab-pane fade" id="tab-currency">
      <div class="card">
        <div class="card-header">管理貨幣（目前帳本）</div>
        <div class="card-body">
          <div class="row g-2 align-items-center mb-2">
            <div class="col-auto">主貨幣：</div>
            <div class="col-auto"><input id="baseCurrency" class="form-control" style="width:120px" placeholder="TWD"></div>
            <div class="col-auto"><button id="saveBaseCurrency" class="topbar-btn -ghost">儲存</button></div>
          </div>
          <div class="row g-2 mb-2">
            <div class="col-md-3"><input id="rateCode" class="form-control" placeholder="幣別（USD）"></div>
            <div class="col-md-3"><input id="rateValue" class="form-control" placeholder="對主幣匯率（如 32.1）"></div>
            <div class="col-md-2"><button id="addRate" class="topbar-btn -primary">新增匯率</button></div>
          </div>
          <div id="rateList" class="list-group small"></div>
        </div>
      </div>
    </div>

    <!-- 聊天設定 -->
    <div class="tab-pane fade" id="tab-chat">
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
          <button id="saveChat" class="topbar-btn -primary">儲存聊天設定</button>
        </div>
      </div>
    </div>

    <!-- 一般設定 -->
    <div class="tab-pane fade" id="tab-general">
      <div class="card">
        <div class="card-header">每日提醒</div>
        <div class="card-body">
          <div class="form-check form-switch mb-2">
            <input id="remindEnable" class="form-check-input" type="checkbox">
            <label class="form-check-label" for="remindEnable">啟用每日提醒</label>
          </div>
          <div class="d-flex gap-2">
            <input id="remindTime" type="time" class="form-control" style="max-width:160px" value="21:00">
            <button id="saveRemind" class="topbar-btn -primary">儲存</button>
          </div>
          <div class="text-muted small mt-2">（展示模式也能切換，重整即恢復預設）</div>
        </div>
      </div>
    </div>
  </div>`;
  return el;
}

// ---------- 狀態 ----------
let UID = null;
let DEMO = false;
let currentLedgerId = null;

// ---------- 展示模式：種子資料（記憶體） ----------
const DEMO_STORE = {
  user: {
    settings: {
      currencies: { base: 'TWD', rates: { USD: 32.1, JPY: 0.22 } },
      chat: { persona: 'minimal_accountant', custom: '', commandsEnabled: true },
      general: { reminderEnabled: true, reminderTime: '21:00' }
    }
  },
  ledgers: [
    { id: 'demo-ledger-1', name: '個人', currency: 'TWD', createdAt: Date.now() },
    { id: 'demo-ledger-2', name: '家庭', currency: 'TWD', createdAt: Date.now()-1000 }
  ],
  categories: {
    'demo-ledger-1': [
      { id: 'c1', name: '餐飲', type: 'expense', color: '#60a5fa', order: 1 },
      { id: 'c2', name: '交通', type: 'expense', color: '#34d399', order: 2 },
      { id: 'c3', name: '薪資', type: 'income',  color: '#fbbf24', order: 3 }
    ],
    'demo-ledger-2': []
  },
  budgets: {
    'demo-ledger-1': [
      { id: 'b1', name: '10月餐飲', amount: 5000, startAt: '2025-10-01', endAt: '2025-10-31' }
    ]
  }
};

// ================== 共用：取得使用者設定 ==================
async function getUserDoc(){
  if (DEMO) {
    return JSON.parse(JSON.stringify(DEMO_STORE.user));
  }
  const ref = doc(db, 'users', UID);
  const snap = await getDoc(ref);
  if (!snap.exists()) await setDoc(ref, { createdAt: serverTimestamp() }, { merge: true });
  return (await getDoc(ref)).data() || {};
}

// ================== 帳本 CRUD ==================
async function addLedger(name){
  if (DEMO) {
    const id = 'demo-' + Math.random().toString(36).slice(2, 8);
    DEMO_STORE.ledgers.unshift({ id, name, currency:'TWD', createdAt: Date.now() });
    return;
  }
  const ref = collection(db, 'users', UID, 'ledgers');
  await addDoc(ref, { name, currency: 'TWD', members: { [UID]: 'owner' }, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

async function listLedgers(){
  const listEl = $('#ledgerList', mount);
  listEl.innerHTML = '<div class="list-group-item">載入中…</div>';

  let rows = [];
  if (DEMO) {
    rows = [...DEMO_STORE.ledgers].sort((a,b)=>b.createdAt - a.createdAt);
  } else {
    const qy = query(collection(db, 'users', UID, 'ledgers'), orderBy('createdAt','desc'));
    const snap = await getDocs(qy);
    rows = snap.docs.map(d=>({ id:d.id, ...d.data() }));
  }

  if (!rows.length){ listEl.innerHTML = '<div class="list-group-item text-muted">尚無帳本</div>'; return; }

  listEl.innerHTML = '';
  rows.forEach(v=>{
    const row = document.createElement('div');
    row.className = 'list-group-item d-flex justify-content-between align-items-center';
    row.innerHTML = `
      <div>
        <div class="fw-bold">${v.name || '(未命名)'}</div>
        <div class="text-muted small">主貨幣：${v.currency || 'TWD'}　ID：${v.id}</div>
      </div>
      <div class="d-flex gap-2">
        <button data-id="${v.id}" class="topbar-btn -sm -secondary pick-ledger">使用</button>
        <button data-id="${v.id}" class="topbar-btn -sm -danger del-ledger">刪除</button>
      </div>`;
    listEl.appendChild(row);
  });

  $$('.pick-ledger', listEl).forEach(b=>{
    b.onclick = ()=>{ currentLedgerId = b.dataset.id; toast(`已切換帳本：${currentLedgerId}`); refreshForLedger(); };
  });
  $$('.del-ledger', listEl).forEach(b=>{
    b.onclick = async ()=>{
      if (!confirm('確定要刪除此帳本與其資料？')) return;
      if (DEMO) {
        DEMO_STORE.ledgers = DEMO_STORE.ledgers.filter(x=>x.id!==b.dataset.id);
        delete DEMO_STORE.categories[b.dataset.id];
        delete DEMO_STORE.budgets[b.dataset.id];
      } else {
        await deleteDoc(doc(db, 'users', UID, 'ledgers', b.dataset.id));
      }
      toast('已刪除帳本'); listLedgers();
    };
  });

  // 預設選第一個帳本
  if (!currentLedgerId && rows.length) { currentLedgerId = rows[0].id; }
}

// ================== 類別 ==================
async function addCategory(type, name){
  if (!currentLedgerId) return toast('請先選帳本');
  if (DEMO) {
    const arr = DEMO_STORE.categories[currentLedgerId] ||= [];
    arr.push({ id:'c'+Math.random().toString(36).slice(2,7), name, type, color:'#60a5fa', order: Date.now() });
    return;
  }
  await addDoc(collection(db, 'users', UID, 'ledgers', currentLedgerId, 'categories'), {
    name, type, order: Date.now(), color: '#60a5fa', parentId: null,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
}

async function listCategories(){
  const el = $('#catList', mount);
  if (!currentLedgerId){ el.innerHTML = '<div class="list-group-item">尚未選擇帳本</div>'; return; }
  el.innerHTML = '載入中…';
  const type = $('#catType', mount).value;

  let rows = [];
  if (DEMO) {
    rows = (DEMO_STORE.categories[currentLedgerId]||[]).filter(v=>v.type===type).sort((a,b)=>a.order-b.order);
  } else {
    const qy = query(collection(db, 'users', UID, 'ledgers', currentLedgerId, 'categories'), orderBy('order','asc'));
    const snap = await getDocs(qy);
    rows = snap.docs.map(d=>({ id:d.id, ...d.data() })).filter(v=>v.type===type);
  }

  el.innerHTML = rows.map(v=>`
    <div class="list-group-item d-flex justify-content-between align-items-center">
      <div><span class="badge me-2" style="background:${v.color||'#ccc'}">&nbsp;</span>${v.name}</div>
      <button class="topbar-btn -sm -danger" data-id="${v.id}">刪除</button>
    </div>
  `).join('') || '<div class="list-group-item text-muted">尚無類型</div>';

  $$('button[data-id]', el).forEach(b=>{
    b.onclick = async ()=>{
      if (DEMO) {
        DEMO_STORE.categories[currentLedgerId] =
          (DEMO_STORE.categories[currentLedgerId]||[]).filter(x=>x.id!==b.dataset.id);
      } else {
        await deleteDoc(doc(db,'users', UID, 'ledgers', currentLedgerId, 'categories', b.dataset.id));
      }
      listCategories();
    };
  });
}

// ================== 預算 ==================
async function addBudget({ name, amount, start, end }){
  if (!currentLedgerId) return toast('請先選帳本');
  if (DEMO) {
    const arr = DEMO_STORE.budgets[currentLedgerId] ||= [];
    arr.unshift({ id:'b'+Math.random().toString(36).slice(2,7), name, amount:Number(amount)||0, startAt:start, endAt:end });
    return;
  }
  await addDoc(collection(db, 'users', UID, 'ledgers', currentLedgerId, 'budgets'), {
    name, amount: Number(amount)||0, period: 'custom',
    startAt: new Date(start+'T00:00:00'), endAt: new Date(end+'T23:59:59'),
    currency: 'TWD', rollover: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
}

async function listBudgets(){
  const el = $('#budgetList', mount);
  if (!currentLedgerId){ el.innerHTML = '<div class="list-group-item">尚未選擇帳本</div>'; return; }
  el.innerHTML = '載入中…';

  let rows = [];
  if (DEMO) {
    rows = (DEMO_STORE.budgets[currentLedgerId]||[]);
  } else {
    const qy = query(collection(db, 'users', UID, 'ledgers', currentLedgerId, 'budgets'), orderBy('createdAt','desc'));
    const snap = await getDocs(qy);
    rows = snap.docs.map(d=>{
      const v = d.data();
      return {
        id: d.id,
        name: v.name,
        amount: v.amount,
        startAt: (v.startAt?.toDate?.() || new Date(v.startAt)).toISOString().slice(0,10),
        endAt:   (v.endAt?.toDate?.()   || new Date(v.endAt)).toISOString().slice(0,10)
      };
    });
  }

  el.innerHTML = rows.map(v=>`
    <div class="list-group-item d-flex justify-content-between align-items-center">
      <div><b>${v.name}</b>｜金額 ${v.amount}｜${v.startAt} ~ ${v.endAt}</div>
      <button class="topbar-btn -sm -danger" data-id="${v.id}">刪除</button>
    </div>
  `).join('') || '<div class="list-group-item text-muted">尚無預算</div>';

  $$('button[data-id]', el).forEach(b=>{
    b.onclick = async ()=>{
      if (DEMO) {
        DEMO_STORE.budgets[currentLedgerId] =
          (DEMO_STORE.budgets[currentLedgerId]||[]).filter(x=>x.id!==b.dataset.id);
      } else {
        await deleteDoc(doc(db,'users', UID, 'ledgers', currentLedgerId, 'budgets', b.dataset.id));
      }
      listBudgets();
    };
  });
}

// ================== 貨幣 ==================
async function saveBaseCurrency(code){
  if (!currentLedgerId) return toast('請先選帳本');
  if (DEMO) {
    DEMO_STORE.user.settings.currencies.base = code;
    toast('（展示模式）主貨幣已更新');
    return;
  }
  await updateDoc(doc(db,'users', UID, 'ledgers', currentLedgerId), { currency: code, updatedAt: serverTimestamp() });
  toast('主貨幣已更新');
}

async function addRate(code, value){
  const user = await getUserDoc();
  const rates = user.settings?.currencies?.rates || {};
  rates[code.toUpperCase()] = Number(value)||0;

  if (DEMO) {
    DEMO_STORE.user.settings.currencies.rates = rates;
    await listRates();
    return;
  }
  await updateDoc(doc(db, 'users', UID), {
    'settings.currencies.base': $('#baseCurrency', mount).value || 'TWD',
    'settings.currencies.rates': rates,
    updatedAt: serverTimestamp()
  });
  listRates();
}

async function listRates(){
  const list = $('#rateList', mount);
  const user = await getUserDoc();
  const rates = user.settings?.currencies?.rates || {};
  const rows = Object.keys(rates).map(k=>`
    <div class="list-group-item d-flex justify-content-between align-items-center">
      <div>${k} → ${rates[k]}</div>
      <button class="topbar-btn -sm -danger" data-k="${k}">刪除</button>
    </div>
  `);
  list.innerHTML = rows.join('') || '<div class="list-group-item text-muted">尚無匯率</div>';

  $$('button[data-k]', list).forEach(b=>{
    b.onclick = async ()=>{
      const u = await getUserDoc();
      const cur = u.settings?.currencies || {};
      if (cur.rates) delete cur.rates[b.dataset.k];

      if (DEMO) {
        DEMO_STORE.user.settings.currencies = cur;
      } else {
        await updateDoc(doc(db,'users', UID), { 'settings.currencies': cur, updatedAt: serverTimestamp() });
      }
      listRates();
    };
  });

  // 帶回 base
  $('#baseCurrency', mount).value = user.settings?.currencies?.base || 'TWD';
}

// ================== 聊天設定 ==================
async function loadChat(){
  const u = await getUserDoc();
  const chat = u.settings?.chat || {};
  $('#persona', mount).value = chat.persona || 'minimal_accountant';
  $('#personaCustom', mount).value = chat.custom || '';
  $('#cmdEnabled', mount).checked = !!chat.commandsEnabled;
}
async function saveChat(){
  const data = {
    'settings.chat': {
      persona: $('#persona', mount).value,
      custom: $('#personaCustom', mount).value,
      commandsEnabled: $('#cmdEnabled', mount).checked
    },
    updatedAt: serverTimestamp()
  };
  if (DEMO) {
    DEMO_STORE.user.settings.chat = data['settings.chat'];
    toast('（展示模式）已儲存聊天設定');
    return;
  }
  await updateDoc(doc(db,'users', UID), data);
  toast('已儲存聊天設定');
}

// ================== 一般設定 ==================
async function loadGeneral(){
  const u = await getUserDoc();
  $('#remindEnable', mount).checked = !!u.settings?.general?.reminderEnabled;
  $('#remindTime', mount).value   = u.settings?.general?.reminderTime || '21:00';
}
async function saveRemind(){
  const val = {
    reminderEnabled: $('#remindEnable', mount).checked,
    reminderTime: $('#remindTime', mount).value || '21:00'
  };
  if (DEMO) {
    DEMO_STORE.user.settings.general = val;
    toast('（展示模式）已儲存每日提醒設定');
    return;
  }
  await updateDoc(doc(db,'users', UID), { 'settings.general': val, updatedAt: serverTimestamp() });
  toast('已儲存每日提醒設定');
}

// ================== 匯出 / 匯入（展示模式下：匯出示範 JSON、匯入覆蓋記憶體） ==================
async function exportJson(){
  if (!currentLedgerId) return toast('請先選帳本');
  let pack;
  if (DEMO) {
    pack = {
      ledgerId: currentLedgerId,
      ledger: DEMO_STORE.ledgers.find(x=>x.id===currentLedgerId),
      categories: (DEMO_STORE.categories[currentLedgerId]||[]),
      budgets: (DEMO_STORE.budgets[currentLedgerId]||[]),
      entries: []
    };
  } else {
    const getAll = async (sub)=>{
      const qy = query(collection(db,'users',UID,'ledgers',currentLedgerId, sub));
      const snap = await getDocs(qy);
      return snap.docs.map(d=>({ id:d.id, ...d.data() }));
    };
    pack = {
      ledgerId: currentLedgerId,
      ledger: (await getDoc(doc(db,'users',UID,'ledgers',currentLedgerId))).data(),
      categories: await getAll('categories'),
      budgets: await getAll('budgets'),
      entries: await getAll('entries')
    };
  }
  const blob = new Blob([JSON.stringify(pack,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `ledger-${currentLedgerId}.json`; a.click(); a.remove(); URL.revokeObjectURL(url);
}

async function importFile(files){
  if (!files?.length) return;
  const file = files[0];
  const text = await file.text();
  let json; try{ json = JSON.parse(text); }catch{ return toast('不是有效的 JSON'); }
  if (!currentLedgerId) return toast('請先選帳本後再匯入');

  if (DEMO) {
    DEMO_STORE.categories[currentLedgerId] = (json.categories||[]).map(x=>({ ...x, id: x.id || 'c'+Math.random().toString(36).slice(2,7) }));
    DEMO_STORE.budgets[currentLedgerId] = (json.budgets||[]).map(x=>({ ...x, id: x.id || 'b'+Math.random().toString(36).slice(2,7) }));
    toast('（展示模式）匯入完成');
    refreshForLedger();
    return;
  }

  // 真實模式：寫入 Firestore
  for (const c of (json.categories || [])){
    await setDoc(doc(collection(db,'users',UID,'ledgers',currentLedgerId,'categories')), {
      ...c, id: undefined, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
  }
  for (const b of (json.budgets || [])){
    await setDoc(doc(collection(db,'users',UID,'ledgers',currentLedgerId,'budgets')), {
      ...b, id: undefined, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
  }
  for (const e of (json.entries || [])){
    await setDoc(doc(collection(db,'users',UID,'ledgers',currentLedgerId,'entries')), {
      ...e, id: undefined, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
  }
  toast('匯入完成');
  refreshForLedger();
}

// ================== 依帳本刷新 ==================
async function refreshForLedger(){
  await listCategories();
  await listBudgets();
  await listRates();
}

// ================== 啟動：若未登入 → 啟用展示模式 ==================
async function waitForAuthUser(timeoutMs = 4000){
  try{
    if (typeof auth?.authStateReady === 'function'){ await auth.authStateReady(); return auth.currentUser || null; }
  }catch{}
  return await new Promise((resolve)=>{
    let done=false;
    const t=setTimeout(()=>{ if(done) return; done=true; resolve(auth?.currentUser||null); }, timeoutMs);
    try{
      const unsub = auth.onAuthStateChanged((u)=>{ if(done) return; done=true; clearTimeout(t); unsub&&unsub(); resolve(u||null); });
    }catch{ clearTimeout(t); resolve(null); }
  });
}

(async function init(){
  const user = await waitForAuthUser();
  DEMO = !user;
  UID = user?.uid || 'demo';

  const shell = renderShell(DEMO);
  mount.replaceChildren(shell);

  // 初始清單
  await listLedgers();
  await loadChat();
  await loadGeneral();

  // 事件：帳本
  $('#addLedger', mount).onclick = async ()=>{
    const name = $('#newLedgerName', mount).value.trim();
    if (!name) return;
    await addLedger(name);
    $('#newLedgerName', mount).value = '';
    listLedgers();
  };

  // 事件：類別
  $('#addCat', mount).onclick = async ()=>{
    const type = $('#catType', mount).value;
    const name = $('#newCatName', mount).value.trim();
    if (!name) return;
    await addCategory(type, name);
    $('#newCatName', mount).value = '';
    listCategories();
  };
  $('#catType', mount).onchange = listCategories;

  // 事件：預算
  $('#addBudget', mount).onclick = async ()=>{
    const name = $('#budgetName', mount).value.trim();
    const amount = $('#budgetAmount', mount).value;
    const start = $('#budgetStart', mount).value;
    const end   = $('#budgetEnd', mount).value;
    if (!name || !amount || !start || !end) return toast('請完整填寫');
    await addBudget({ name, amount, start, end });
    $('#budgetName', mount).value = ''; $('#budgetAmount', mount).value = '';
    $('#budgetStart', mount).value = ''; $('#budgetEnd', mount).value = '';
    listBudgets();
  };

  // 事件：貨幣
  $('#saveBaseCurrency', mount).onclick = async ()=>{
    const code = ($('#baseCurrency', mount).value || 'TWD').toUpperCase();
    await saveBaseCurrency(code);
    listLedgers(); // 讓帳本卡片也更新（展示模式下只是視覺）
  };
  $('#addRate', mount).onclick = async ()=>{
    const code = $('#rateCode', mount).value.trim();
    const val  = $('#rateValue', mount).value;
    if (!code || !val) return;
    await addRate(code, val);
    $('#rateCode', mount).value = ''; $('#rateValue', mount).value = '';
  };

  // 事件：聊天 / 一般
  $('#saveChat', mount).onclick = saveChat;
  $('#saveRemind', mount).onclick = saveRemind;

  // 匯出/匯入
  $('#exportJson', mount).onclick = exportJson;
  $('#importBtn', mount).onclick = ()=> importFile($('#importFile', mount).files);
})();
