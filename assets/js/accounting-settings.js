// assets/js/pages/accounting-settings.js
// 設定頁（帳本/預算/類型/貨幣、聊天設定、匯入/匯出、每日提醒）

import { auth, db } from '../firebase.js';
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp,
  collection, addDoc, deleteDoc, query, orderBy, getDocs
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

// ---------- 小工具 ----------
const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
const toast = (m)=>{
  const div = document.createElement('div');
  div.textContent = m;
  div.style.cssText = 'position:fixed;top:80px;right:20px;background:#1f2937;color:#fff;padding:12px 20px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.5);z-index:9999;';
  document.body.appendChild(div);
  setTimeout(()=>div.remove(), 2500);
};
const mount = $('#app') || document.body;

console.log('🚀 accounting-settings.js 載入完成');
console.log('📦 Firebase Auth:', typeof auth);
console.log('📦 Firebase DB:', typeof db);

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
    <li class="nav-item"><button class="topbar-btn -secondary active" data-bs-toggle="tab" data-bs-target="#tab-ledger" type="button">管理帳本</button></li>
    <li class="nav-item"><button class="topbar-btn -ghost" data-bs-toggle="tab" data-bs-target="#tab-budget" type="button">管理預算</button></li>
    <li class="nav-item"><button class="topbar-btn -ghost" data-bs-toggle="tab" data-bs-target="#tab-category" type="button">管理類型</button></li>
    <li class="nav-item"><button class="topbar-btn -ghost" data-bs-toggle="tab" data-bs-target="#tab-currency" type="button">管理貨幣</button></li>
    <li class="nav-item"><button class="topbar-btn -ghost" data-bs-toggle="tab" data-bs-target="#tab-chat" type="button">聊天設定</button></li>
    <li class="nav-item"><button class="topbar-btn -ghost" data-bs-toggle="tab" data-bs-target="#tab-general" type="button">一般設定</button></li>
  </ul>

  <div class="tab-content border border-top-0 rounded-bottom p-3" style="border-color:rgba(255,255,255,.12);background:rgba(0,0,0,0.2)">
    <!-- 帳本 -->
    <div class="tab-pane fade show active" id="tab-ledger">
      <div class="card" style="background:rgba(255,255,255,0.05);border-color:rgba(255,255,255,0.1)">
        <div class="card-header" style="background:rgba(255,255,255,0.05);color:#fff">管理帳本</div>
        <div class="card-body">
          <div class="mb-2 d-flex gap-2">
            <input id="newLedgerName" class="form-control" placeholder="帳本名稱（例如：個人）" style="background:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.2);color:#fff">
            <button id="addLedger" class="topbar-btn -primary">新增</button>
          </div>
          <div id="ledgerList" class="list-group small"></div>
        </div>
      </div>
    </div>

    <!-- 預算 -->
    <div class="tab-pane fade" id="tab-budget">
      <div class="card" style="background:rgba(255,255,255,0.05);border-color:rgba(255,255,255,0.1)">
        <div class="card-header" style="background:rgba(255,255,255,0.05);color:#fff">管理預算（目前帳本）</div>
        <div class="card-body">
          <div class="row g-2 mb-2">
            <div class="col-md-4"><input id="budgetName" class="form-control" placeholder="名稱（如10月餐飲）" style="background:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.2);color:#fff"></div>
            <div class="col-md-3"><input id="budgetAmount" type="number" class="form-control" placeholder="金額" style="background:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.2);color:#fff"></div>
            <div class="col-md-5 d-flex gap-2">
              <input id="budgetStart" type="date" class="form-control" style="background:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.2);color:#fff">
              <input id="budgetEnd" type="date" class="form-control" style="background:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.2);color:#fff">
              <button id="addBudget" class="topbar-btn -primary">新增</button>
            </div>
          </div>
          <div id="budgetList" class="list-group small"></div>
        </div>
      </div>
    </div>

    <!-- 類型 -->
    <div class="tab-pane fade" id="tab-category">
      <div class="card" style="background:rgba(255,255,255,0.05);border-color:rgba(255,255,255,0.1)">
        <div class="card-header" style="background:rgba(255,255,255,0.05);color:#fff">管理類型（目前帳本）</div>
        <div class="card-body">
          <div class="mb-2 d-flex gap-2">
            <select id="catType" class="form-select" style="max-width:140px;background:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.2);color:#fff">
              <option value="expense">支出</option>
              <option value="income">收入</option>
            </select>
            <input id="newCatName" class="form-control" placeholder="新增類型名稱…" style="background:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.2);color:#fff">
            <button id="addCat" class="topbar-btn -primary">新增</button>
          </div>
          <div id="catList" class="list-group small"></div>
        </div>
      </div>
    </div>

    <!-- 貨幣 -->
    <div class="tab-pane fade" id="tab-currency">
      <div class="card" style="background:rgba(255,255,255,0.05);border-color:rgba(255,255,255,0.1)">
        <div class="card-header" style="background:rgba(255,255,255,0.05);color:#fff">管理貨幣（目前帳本）</div>
        <div class="card-body">
          <div class="row g-2 align-items-center mb-2">
            <div class="col-auto" style="color:#fff">主貨幣：</div>
            <div class="col-auto"><input id="baseCurrency" class="form-control" style="width:120px;background:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.2);color:#fff" placeholder="TWD"></div>
            <div class="col-auto"><button id="saveBaseCurrency" class="topbar-btn -ghost">儲存</button></div>
          </div>
          <div class="row g-2 mb-2">
            <div class="col-md-3"><input id="rateCode" class="form-control" placeholder="幣別（USD）" style="background:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.2);color:#fff"></div>
            <div class="col-md-3"><input id="rateValue" class="form-control" placeholder="對主幣匯率（如 32.1）" style="background:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.2);color:#fff"></div>
            <div class="col-md-2"><button id="addRate" class="topbar-btn -primary">新增匯率</button></div>
          </div>
          <div id="rateList" class="list-group small"></div>
        </div>
      </div>
    </div>

    <!-- 聊天設定 -->
    <div class="tab-pane fade" id="tab-chat">
      <div class="card" style="background:rgba(255,255,255,0.05);border-color:rgba(255,255,255,0.1)">
        <div class="card-header" style="background:rgba(255,255,255,0.05);color:#fff">專屬角色與指令</div>
        <div class="card-body">
          <div class="row g-2 mb-3">
            <div class="col-md-4">
              <label class="form-label" style="color:#fff">角色（Persona）</label>
              <select id="persona" class="form-select" style="background:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.2);color:#fff">
                <option value="minimal_accountant">極簡會計師（精簡、重點）</option>
                <option value="friendly_helper">溫暖助手（鼓勵、貼心）</option>
                <option value="strict_coach">節制教練（嚴謹、控管）</option>
              </select>
            </div>
            <div class="col-md-8">
              <label class="form-label" style="color:#fff">自定義描述（可留白）</label>
              <textarea id="personaCustom" class="form-control" rows="3" placeholder="描述語氣、風格、輸出格式重點…" style="background:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.2);color:#fff"></textarea>
            </div>
          </div>
          <div class="form-check form-switch mb-3">
            <input id="cmdEnabled" class="form-check-input" type="checkbox">
            <label class="form-check-label" for="cmdEnabled" style="color:#fff">啟用記帳快速指令（/add /sum /budget…）</label>
          </div>
          <button id="saveChat" class="topbar-btn -primary">儲存聊天設定</button>
        </div>
      </div>
    </div>

    <!-- 一般設定 -->
    <div class="tab-pane fade" id="tab-general">
      <div class="card" style="background:rgba(255,255,255,0.05);border-color:rgba(255,255,255,0.1)">
        <div class="card-header" style="background:rgba(255,255,255,0.05);color:#fff">每日提醒</div>
        <div class="card-body">
          <div class="form-check form-switch mb-2">
            <input id="remindEnable" class="form-check-input" type="checkbox">
            <label class="form-check-label" for="remindEnable" style="color:#fff">啟用每日提醒</label>
          </div>
          <div class="d-flex gap-2">
            <input id="remindTime" type="time" class="form-control" style="max-width:160px;background:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.2);color:#fff" value="21:00">
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
  listEl.innerHTML = '<div class="list-group-item" style="background:rgba(255,255,255,0.05);color:#fff;border-color:rgba(255,255,255,0.1)">載入中…</div>';

  let rows = [];
  if (DEMO) {
    rows = [...DEMO_STORE.ledgers].sort((a,b)=>b.createdAt - a.createdAt);
  } else {
    const qy = query(collection(db, 'users', UID, 'ledgers'), orderBy('createdAt','desc'));
    const snap = await getDocs(qy);
    rows = snap.docs.map(d=>({ id:d.id, ...d.data() }));
  }

  if (!rows.length){ 
    listEl.innerHTML = '<div class="list-group-item text-muted" style="background:rgba(255,255,255,0.05);color:#aaa;border-color:rgba(255,255,255,0.1)">尚無帳本</div>'; 
    return; 
  }

  listEl.innerHTML = '';
  rows.forEach(v=>{
    const row = document.createElement('div');
    row.className = 'list-group-item d-flex justify-content-between align-items-center';
    row.style.cssText = 'background:rgba(255,255,255,0.05);border-color:rgba(255,255,255,0.1);color:#fff';
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
  if (!currentLedgerId && rows.length) { 
    currentLedgerId = rows[0].id;
    console.log('✅ 預設選擇帳本:', currentLedgerId);
  }
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
  if (!currentLedgerId){ 
    el.innerHTML = '<div class="list-group-item" style="background:rgba(255,255,255,0.05);color:#aaa;border-color:rgba(255,255,255,0.1)">尚未選擇帳本</div>'; 
    return; 
  }
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
    <div class="list-group-item d-flex justify-content-between align-items-center" style="background:rgba(255,255,255,0.05);border-color:rgba(255,255,255,0.1);color:#fff">
      <div><span class="badge me-2" style="background:${v.color||'#ccc'}">&nbsp;</span>${v.name}</div>
      <button class="topbar-btn -sm -danger" data-id="${v.id}">刪除</button>
    </div>
  `).join('') || '<div class="list-group-item text-muted" style="background:rgba(255,255,255,0.05);color:#aaa;border-color:rgba(255,255,255,0.1)">尚無類型</div>';

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
  if (!currentLedgerId){ 
    el.innerHTML = '<div class="list-group-item" style="background:rgba(255,255,255,0.05);color:#aaa;border-color:rgba(255,255,255,0.1)">尚未選擇帳本</div>'; 
    return; 
  }
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
    <div class="list-group-item d-flex justify-content-between align-items-center" style="background:rgba(255,255,255,0.05);border-color:rgba(255,255,255,0.1);color:#fff">
      <div><b>${v.name}</b>｜金額 ${v.amount}｜${v.startAt} ~ ${v.endAt}</div>
      <button class="topbar-btn -sm -danger" data-id="${v.id}">刪除</button>
    </div>
  `).join('') || '<div class="list-group-item text-muted" style="background:rgba(255,255,255,0.05);color:#aaa;border-color:rgba(255,255,255,0.1)">尚無預算</div>';

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
    <div class="
