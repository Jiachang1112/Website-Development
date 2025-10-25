// assets/js/pages/accounting-settings.js
// 設定頁（帳本/預算/類型/貨幣、聊天設定、匯入/匯出、每日提醒）

import { auth, db } from '../firebase.js';
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp,
  collection, addDoc, deleteDoc, onSnapshot, query, orderBy, getDocs
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

// 小工具
const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
const toast = (m)=>alert(m);

// 根元素（請在 admin/設定 頁，放一個<div id="app">）
const mount = $('#app') || document.body;

/* ========== 本頁專用：頂部膠囊按鈕樣式（與主頁一致風格） ========== */
(function injectTopbarButtons(){
  const css = document.createElement('style');
  css.textContent = `
  /* 容器作用域，避免影響其它頁 */
  #accset .topbar-btn{
    -webkit-appearance: none; appearance: none;
    display:inline-flex; align-items:center; justify-content:center;
    gap:8px;
    padding:10px 14px; border-radius:999px;
    background:transparent;
    border:1px solid rgba(255,255,255,.22);
    color:#fff; font-weight:600; line-height:1; cursor:pointer;
    transition:background .15s ease, border-color .15s ease, transform .02s ease;
    user-select:none; text-decoration:none;
  }
  #accset .topbar-btn:hover{ background:rgba(255,255,255,.08); }
  #accset .topbar-btn:active{ transform:translateY(1px); }
  #accset .topbar-btn.-primary{
    background:linear-gradient(180deg,#ff7ab6,#ff4d6d);
    border-color:transparent; color:#fff;
  }
  #accset .topbar-btn.-primary:hover{
    filter:saturate(1.05) brightness(1.05);
  }
  #accset .topbar-btn.-danger{
    background:#ef4444; border-color:transparent; color:#fff;
  }
  #accset .topbar-btn.-danger:hover{ filter:brightness(1.05); }
  #accset .topbar-btn.-secondary{
    background:rgba(255,255,255,.10); border-color:rgba(255,255,255,.10);
  }
  #accset .topbar-btn.-ghost{
    background:transparent; border-color:rgba(255,255,255,.22);
  }
  /* 小尺寸（列表右側的操作鍵） */
  #accset .topbar-btn.-sm{ padding:6px 10px; font-size:.92rem; }
  `;
  document.head.appendChild(css);
})();

// ========== 畫面骨架 ==========
function renderShell(){
  const el = document.createElement('div');
  el.id = 'accset';
  el.className = 'container py-4';
  el.innerHTML = `
  <h3 class="mb-3">記帳設定</h3>

  <!-- 頁籤仍用 Bootstrap 行為，但按鈕換成 topbar 風格 -->
  <ul class="nav nav-tabs" id="setTabs" role="tablist" style="border-color:rgba(255,255,255,.12)">
    <li class="nav-item">
      <button class="topbar-btn -secondary" data-bs-toggle="tab" data-bs-target="#tab-ledger" type="button">記帳設定</button>
    </li>
    <li class="nav-item">
      <button class="topbar-btn -ghost" data-bs-toggle="tab" data-bs-target="#tab-chat" type="button">聊天設定</button>
    </li>
    <li class="nav-item">
      <button class="topbar-btn -ghost" data-bs-toggle="tab" data-bs-target="#tab-general" type="button">一般設定</button>
    </li>
  </ul>

  <div class="tab-content border border-top-0 rounded-bottom p-3" style="border-color:rgba(255,255,255,.12)">
    <!-- 記帳設定 -->
    <div class="tab-pane fade show active" id="tab-ledger">
      <div class="row g-3">
        <div class="col-lg-6">
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

        <div class="col-lg-6">
          <div class="card mb-3">
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

        <div class="col-12">
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
      <div class="row g-3">
        <div class="col-lg-6">
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
              <div class="text-muted small mt-2">（前端提醒版：使用者回到網頁會提示；之後可升級成 Cloud Functions/FCM 推播）</div>
            </div>
          </div>
        </div>

        <div class="col-lg-6">
          <div class="card">
            <div class="card-header">匯入 / 匯出</div>
            <div class="card-body">
              <div class="mb-2">
                <button id="exportJson" class="topbar-btn -ghost" style="margin-right:.5rem">匯出 JSON（目前帳本）</button>
                <input id="importFile" type="file" accept=".json,.csv" class="form-control" style="max-width:320px;display:inline-block">
                <button id="importBtn" class="topbar-btn -primary" style="margin-left:.5rem">匯入</button>
              </div>
              <div class="text-muted small">建議先匯出一次查看格式；匯入支援 JSON（完整資料）與簡易 CSV。</div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>`;
  return el;
}

// ========== 狀態 ==========
let UID = null;
let currentLedgerId = null;

// 取得使用者 settings 文檔
async function getUserDoc(){
  const ref = doc(db, 'users', UID);
  const snap = await getDoc(ref);
  if (!snap.exists()) await setDoc(ref, { createdAt: serverTimestamp() }, { merge: true });
  return (await getDoc(ref)).data() || {};
}

// ========== 帳本 CRUD ==========
async function addLedger(name){
  const ref = collection(db, 'users', UID, 'ledgers');
  await addDoc(ref, { name, currency: 'TWD', members: { [UID]: 'owner' }, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}
async function listLedgers(){
  const listEl = $('#ledgerList', mount);
  listEl.innerHTML = '<div class="list-group-item">載入中…</div>';

  const q = query(collection(db, 'users', UID, 'ledgers'), orderBy('createdAt','desc'));
  const snap = await getDocs(q);
  if (snap.empty){ listEl.innerHTML = '<div class="list-group-item text-muted">尚無帳本</div>'; return; }

  listEl.innerHTML = '';
  snap.forEach(d=>{
    const v = d.data();
    const row = document.createElement('div');
    row.className = 'list-group-item d-flex justify-content-between align-items-center';
    row.innerHTML = `
      <div>
        <div class="fw-bold">${v.name || '(未命名)'}</div>
        <div class="text-muted small">主貨幣：${v.currency || 'TWD'}　ID：${d.id}</div>
      </div>
      <div class="d-flex gap-2">
        <button data-id="${d.id}" class="topbar-btn -sm -secondary pick-ledger">使用</button>
        <button data-id="${d.id}" class="topbar-btn -sm -danger del-ledger">刪除</button>
      </div>`;
    listEl.appendChild(row);
  });

  // 事件
  $$('.pick-ledger', listEl).forEach(b=>{
    b.onclick = ()=>{ currentLedgerId = b.dataset.id; toast(`已切換帳本：${currentLedgerId}`); refreshForLedger(); };
  });
  $$('.del-ledger', listEl).forEach(b=>{
    b.onclick = async ()=>{
      if (!confirm('確定要刪除此帳本與其資料？')) return;
      await deleteDoc(doc(db, 'users', UID, 'ledgers', b.dataset.id));
      toast('已刪除帳本'); listLedgers();
    };
  });
}

// ========== 類別 ==========
async function addCategory(type, name){
  if (!currentLedgerId) return toast('請先選帳本');
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

  const q = query(collection(db, 'users', UID, 'ledgers', currentLedgerId, 'categories'), orderBy('order','asc'));
  const snap = await getDocs(q);

  const rows = [];
  snap.forEach(d=>{
    const v = d.data(); if (v.type !== type) return;
    rows.push(`<div class="list-group-item d-flex justify-content-between align-items-center">
      <div><span class="badge me-2" style="background:${v.color||'#ccc'}">&nbsp;</span>${v.name}</div>
      <button class="topbar-btn -sm -danger" data-id="${d.id}">刪除</button>
    </div>`);
  });
  el.innerHTML = rows.join('') || '<div class="list-group-item text-muted">尚無類型</div>';

  $$('button[data-id]', el).forEach(b=>{
    b.onclick = async ()=>{ await deleteDoc(doc(db,'users', UID, 'ledgers', currentLedgerId, 'categories', b.dataset.id)); listCategories(); };
  });
}

// ========== 預算 ==========
async function addBudget({ name, amount, start, end }){
  if (!currentLedgerId) return toast('請先選帳本');
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
  const q = query(collection(db, 'users', UID, 'ledgers', currentLedgerId, 'budgets'), orderBy('createdAt','desc'));
  const snap = await getDocs(q);

  const rows = [];
  snap.forEach(d=>{
    const v = d.data();
    const s = (v.startAt?.toDate?.() || new Date(v.startAt)).toISOString().slice(0,10);
    const e = (v.endAt?.toDate?.() || new Date(v.endAt)).toISOString().slice(0,10);
    rows.push(`<div class="list-group-item d-flex justify-content-between align-items-center">
      <div><b>${v.name}</b>｜金額 ${v.amount}｜${s} ~ ${e}</div>
      <button class="topbar-btn -sm -danger" data-id="${d.id}">刪除</button>
    </div>`);
  });
  el.innerHTML = rows.join('') || '<div class="list-group-item text-muted">尚無預算</div>';

  $$('button[data-id]', el).forEach(b=>{
    b.onclick = async ()=>{ await deleteDoc(doc(db,'users', UID, 'ledgers', currentLedgerId, 'budgets', b.dataset.id)); listBudgets(); };
  });
}

// ========== 貨幣 ==========
async function saveBaseCurrency(code){
  if (!currentLedgerId) return toast('請先選帳本');
  await updateDoc(doc(db,'users', UID, 'ledgers', currentLedgerId), { currency: code, updatedAt: serverTimestamp() });
  toast('主貨幣已更新');
}
async function addRate(code, value){
  if (!currentLedgerId) return toast('請先選帳本');
  const userRef = doc(db, 'users', UID);
  const snap = await getDoc(userRef);
  const settings = snap.data()?.settings || {};
  const rates = settings.currencies?.rates || {};
  rates[code.toUpperCase()] = Number(value)||0;

  await updateDoc(userRef, {
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
      const userRef = doc(db,'users', UID);
      const snap = await getDoc(userRef);
      const cur = snap.data()?.settings?.currencies || {};
      if (cur.rates) delete cur.rates[b.dataset.k];
      await updateDoc(userRef, { 'settings.currencies': cur, updatedAt: serverTimestamp() });
      listRates();
    };
  });

  // 也把 base 帶回 input
  $('#baseCurrency', mount).value = user.settings?.currencies?.base || 'TWD';
}

// ========== 聊天設定 ==========
async function loadChat(){
  const u = await getUserDoc();
  const chat = u.settings?.chat || {};
  $('#persona', mount).value = chat.persona || 'minimal_accountant';
  $('#personaCustom', mount).value = chat.custom || '';
  $('#cmdEnabled', mount).checked = !!chat.commandsEnabled;
}
async function saveChat(){
  await updateDoc(doc(db,'users', UID), {
    'settings.chat': {
      persona: $('#persona', mount).value,
      custom: $('#personaCustom', mount).value,
      commandsEnabled: $('#cmdEnabled', mount).checked
    },
    updatedAt: serverTimestamp()
  });
  toast('已儲存聊天設定');
}

// ========== 一般設定：每日提醒、匯入/匯出 ==========
async function loadGeneral(){
  const u = await getUserDoc();
  $('#remindEnable', mount).checked = !!u.settings?.general?.reminderEnabled;
  $('#remindTime', mount).value   = u.settings?.general?.reminderTime || '21:00';
}
async function saveRemind(){
  await updateDoc(doc(db,'users', UID), {
    'settings.general': {
      reminderEnabled: $('#remindEnable', mount).checked,
      reminderTime: $('#remindTime', mount).value || '21:00'
    },
    updatedAt: serverTimestamp()
  });
  toast('已儲存每日提醒設定');
}

// 匯出目前帳本（JSON）
async function exportJson(){
  if (!currentLedgerId) return toast('請先選帳本');
  // 拉帳本、類別、預算、entries
  const pack = { ledgerId: currentLedgerId };

  const getAll = async (sub)=>{
    const q = query(collection(db,'users',UID,'ledgers',currentLedgerId, sub));
    const snap = await getDocs(q);
    return snap.docs.map(d=>({ id:d.id, ...d.data() }));
  };

  pack.ledger    = (await getDoc(doc(db,'users',UID,'ledgers',currentLedgerId))).data();
  pack.categories = await getAll('categories');
  pack.budgets    = await getAll('budgets');
  pack.entries    = await getAll('entries');

  const blob = new Blob([JSON.stringify(pack,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `ledger-${currentLedgerId}.json`; a.click(); a.remove(); URL.revokeObjectURL(url);
}

// 匯入（簡版：只支援 JSON pack）
async function importFile(files){
  if (!files?.length) return;
  const file = files[0];
  const text = await file.text();
  let json;
  try{ json = JSON.parse(text); }catch{ return toast('不是有效的 JSON'); }
  if (!currentLedgerId) { return toast('請先選帳本後再匯入'); }

  // 類別
  for (const c of (json.categories || [])){
    await setDoc(doc(collection(db,'users',UID,'ledgers',currentLedgerId,'categories')), {
      ...c, id: undefined, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
  }
  // 預算
  for (const b of (json.budgets || [])){
    await setDoc(doc(collection(db,'users',UID,'ledgers',currentLedgerId,'budgets')), {
      ...b, id: undefined, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
  }
  // 交易
  for (const e of (json.entries || [])){
    await setDoc(doc(collection(db,'users',UID,'ledgers',currentLedgerId,'entries')), {
      ...e, id: undefined, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
  }
  toast('匯入完成');
  refreshForLedger();
}

// ========== 依帳本刷新區塊 ==========
async function refreshForLedger(){
  await listCategories();
  await listBudgets();
  await listRates();
}

// ========== 啟動 ==========
(async function init(){
  // 登入就緒
  const unsub = auth.onAuthStateChanged(async (user)=>{
    if (!user){ mount.innerHTML = '<div class="p-4">請先登入</div>'; return; }
    UID = user.uid;

    // 畫面
    const shell = renderShell();
    mount.replaceChildren(shell);

    // 載入清單
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
      listLedgers(); // 讓帳本卡片也更新
    };
    $('#addRate', mount).onclick = async ()=>{
      const code = $('#rateCode', mount).value.trim();
      const val  = $('#rateValue', mount).value;
      if (!code || !val) return;
      await addRate(code, val);
      $('#rateCode', mount).value = ''; $('#rateValue', mount).value = '';
    };

    // 事件：聊天
    $('#saveChat', mount).onclick = saveChat;

    // 事件：一般設定
    $('#saveRemind', mount).onclick = saveRemind;
    $('#exportJson', mount).onclick = exportJson;
    $('#importBtn', mount).onclick = ()=> importFile($('#importFile', mount).files);
  });
})();
