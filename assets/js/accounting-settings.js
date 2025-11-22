// assets/js/pages/accounting-settings.js
// 設定頁（帳本 / 預算 / 類型 / 貨幣 / 聊天設定 / 一般設定）

import { auth, db } from '../firebase.js';
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp,
  collection, addDoc, deleteDoc, query, orderBy, getDocs, where
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

// -------------------- 工具函式 --------------------
const $ = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
const toast = (m)=>{
  const div = document.createElement('div');
  div.textContent = m;
  div.style.cssText = 'position:fixed;top:20px;right:20px;background:#1f2937;color:#fff;padding:12px 20px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:9999;animation:slideIn 0.3s;';
  document.body.appendChild(div);
  setTimeout(()=>div.remove(), 3000);
};
const mount = $('#app') || document.body;

// ===============================
// 畫面骨架
// ===============================
function renderShell(){
  const el = document.createElement('div');
  el.className = 'container-fluid p-0';
  el.innerHTML = `
  <div class="row g-0">
    <div class="col-12">
      <div id="pageHost"></div>
    </div>
  </div>`;
  return el;
}

// ===============================
// 狀態
// ===============================
let UID = null;
let currentLedgerId = null;

// ===============================
// Firestore 共用工具
// ===============================
async function getUserDoc(){
  if(!UID) return {};
  const ref = doc(db, 'users', UID);
  const snap = await getDoc(ref);
  if (!snap.exists()){
    await setDoc(ref, { createdAt: serverTimestamp() }, { merge: true });
  }
  return (await getDoc(ref)).data() || {};
}

async function getDefaultLedger(){
  if(!UID) return null;
  const qy = query(collection(db, 'users', UID, 'ledgers'), where('isDefault', '==', true));
  const snap = await getDocs(qy);
  if(!snap.empty) return snap.docs[0].id;
  
  // 如果沒有預設，取第一本
  const qy2 = query(collection(db, 'users', UID, 'ledgers'), orderBy('createdAt','asc'));
  const snap2 = await getDocs(qy2);
  return snap2.empty ? null : snap2.docs[0].id;
}

// ===============================
// 管理帳本
// ===============================
function renderLedgersView(){
  const host = $('#pageHost', mount);
  if(!host) return;
  
  host.innerHTML = `
    <section class="content-card">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px">
        <h2 style="margin:0">管理帳本</h2>
        <span class="muted swipe-hint">（手機：向左滑卡片可刪除）</span>
      </div>
      <div id="ledgerGrid" class="ledger-grid"></div>
    </section>
  `;
  listLedgers();
}

async function addLedger(name){
  if (!UID) return toast('請先登入');
  const ref = collection(db, 'users', UID, 'ledgers');
  const qy = query(ref, orderBy('createdAt','asc'));
  const snap = await getDocs(qy);
  const isFirst = snap.empty;

  await addDoc(ref, {
    name,
    currency: 'TWD',
    members: { [UID]: 'owner' },
    owner: UID, // 記錄擁有者
    isDefault: isFirst,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

async function listLedgers(){
  const grid = $('#ledgerGrid', mount);
  if(!grid) return;
  if(!UID){ 
    grid.innerHTML = '<div class="muted">請先登入帳號</div>'; 
    return; 
  }
  grid.innerHTML = '<div class="muted">載入中…</div>';

  const qy = query(collection(db, 'users', UID, 'ledgers'), orderBy('createdAt','asc'));
  const snap = await getDocs(qy);

  if (snap.empty){
    await addLedger('預設帳本');
    return listLedgers();
  }

  const cards = [];
  snap.forEach(d=>{
    cards.push(ledgerCardTpl({ id:d.id, ...d.data() }));
  });
  cards.push(addCardTpl());
  grid.innerHTML = cards.join('');
  bindLedgerCardEvents(grid);
}

function ledgerCardTpl({ id, name, isDefault, members, owner }){
  const memberCount = members ? Object.keys(members).length : 1;
  const isSharedWithMe = owner && owner !== UID; 
  
  return `
  <div class="ledger-card" data-id="${id}" data-owner="${owner || UID}">
    <div class="cover" style="${isSharedWithMe ? 'background:linear-gradient(135deg,#6366f1,#8b5cf6)' : ''}"></div>
    <div class="body">
      <div style="min-width:0">
        <div class="ledger-name">${escapeHtml(name || '(未命名)')}</div>
        <div style="margin-top:6px; display:flex; gap:4px; flex-wrap:wrap;">
          ${isDefault ? `<div class="badge-default">預設</div>`:''}
          ${isSharedWithMe ? `<div class="badge-default" style="background:#8b5cf6;">來自分享</div>` : ''}
          ${memberCount > 1 ? `<div class="badge-default" style="background:#3b82f6;">${memberCount} 人共用</div>` : ''}
        </div>
      </div>
      <div class="ledger-actions">
        <button class="btn act-members" title="成員管理"><i class="bi bi-people-fill"></i></button>
        <button class="btn act-rename" title="重新命名"><i class="bi bi-pencil"></i></button>
        <button class="btn act-delete" title="刪除"><i class="bi bi-trash"></i></button>
      </div>
    </div>
  </div>`;
}

function addCardTpl(){
  return `
  <div class="ledger-card add">
    <div class="add-inner" style="width:100%">
      <div class="big">＋ 新增帳本</div>
      <input id="newLedgerName" placeholder="輸入新帳本名稱">
      <button id="btnAddLedger" class="btn">新增</button>
    </div>
  </div>`;
}

function bindLedgerCardEvents(grid){
  $('#btnAddLedger', grid)?.addEventListener('click', async ()=>{
    const name = ($('#newLedgerName', grid)?.value || '').trim();
    if(!name) return toast('請輸入帳本名稱');
    await addLedger(name);
    listLedgers();
  });

  $$('.act-rename', grid).forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const card = btn.closest('.ledger-card');
      const id = card.dataset.id;
      const owner = card.dataset.owner; 
      
      if(owner && owner !== UID) return toast('僅擁有者可重新命名');

      const titleEl = card.querySelector('.ledger-name');
      const old = titleEl.textContent.trim();
      card.querySelector('.ledger-actions').style.display='none';
      const wrap = document.createElement('div');
      wrap.className='rename-wrap';
      wrap.innerHTML = `
        <input value="${escapeHtmlAttr(old)}" placeholder="帳本名稱">
        <button class="btn btn-save">儲存</button>
        <button class="btn btn-cancel">取消</button>
      `;
      titleEl.replaceWith(wrap);
      wrap.querySelector('.btn-cancel').onclick = ()=>listLedgers();
      wrap.querySelector('.btn-save').onclick = async ()=>{
        const val = wrap.querySelector('input').value.trim();
        if(!val) return toast('請輸入帳本名稱');
        await updateDoc(doc(db,'users',UID,'ledgers',id), { name: val, updatedAt: serverTimestamp() });
        listLedgers();
      };
    });
  });

  $$('.act-members', grid).forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const card = btn.closest('.ledger-card');
      const id = card.dataset.id;
      const owner = card.dataset.owner || UID;
      
      try {
        const ref = doc(db, 'users', owner, 'ledgers', id);
        const snap = await getDoc(ref);
        if(snap.exists()) {
          manageMembers(id, snap.data(), owner);
        } else {
          toast('無法讀取帳本資訊');
        }
      } catch(e) {
        console.error(e);
        toast('權限不足或讀取失敗');
      }
    });
  });

  $$('.act-delete', grid).forEach(btn=>{
    btn.addEventListener('click', ()=> tryDeleteByCard(btn.closest('.ledger-card')));
  });
}

// ===============================
// 👥 成員管理功能
// ===============================
function manageMembers(ledgerId, data, ownerId) {
  const members = data.members || {};
  const isOwner = (ownerId === UID);

  const modal = document.createElement('div');
  modal.className = 'modal-mask show';
  modal.style.zIndex = '9999';
  modal.innerHTML = `
    <div class="modal-card" style="max-width:500px;">
      <div class="modal-hd">
        <span style="color:#1f2937;">成員管理 - ${escapeHtml(data.name)}</span>
        <button id="btnCloseMember" style="border:none;background:none;cursor:pointer;font-size:1.2rem;color:#1f2937;">✕</button>
      </div>
      <div class="modal-bd">
        ${isOwner ? `
          <div style="margin-bottom:16px; display:flex; gap:8px;">
            <input id="inviteEmail" class="form-ctl" placeholder="輸入對方 Email 邀請" style="margin:0; color:#1f2937;">
            <button id="btnInvite" class="btn-primary" style="white-space:nowrap;">邀請</button>
          </div>
          <hr style="border:0; border-top:1px solid #eee; margin:16px 0;">
        ` : `<div class="muted" style="margin-bottom:10px">您是協作者，僅擁有者可邀請成員。</div>`}
        
        <div id="memberList" style="display:grid; gap:10px; color:#1f2937;"></div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);

  const renderList = async () => {
    const listEl = modal.querySelector('#memberList');
    listEl.innerHTML = '<div class="muted">載入中...</div>';
    
    const items = Object.keys(members).map(uid => {
      const isMe = (uid === UID);
      const isRowOwner = (uid === ownerId);
      
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; background:#f8fafc; border-radius:8px;">
          <div>
            <div style="font-weight:600; font-size:0.9rem; color:#1f2937;">${isMe ? '(我)' : uid.slice(0,6)+'...'}</div>
            <div class="muted" style="font-size:0.8rem;">${isRowOwner ? '👑 擁有者' : '協作者'}</div>
          </div>
          ${isOwner && !isRowOwner ? `<button class="btn-line" style="padding:4px 8px; color:#ef4444; border-color:#ef4444;" onclick="window.removeMember('${ledgerId}', '${uid}')">移除</button>` : ''}
        </div>
      `;
    });
    listEl.innerHTML = items.join('');
  };
  renderList();
  
  const close = () => modal.remove();
  modal.querySelector('#btnCloseMember').addEventListener('click', close);
  
  if(isOwner) {
    modal.querySelector('#btnInvite').addEventListener('click', async () => {
      const btn = modal.querySelector('#btnInvite');
      const input = modal.querySelector('#inviteEmail');
      const email = input.value.trim().toLowerCase();
      
      if(!email) return toast('請輸入 Email');
      
      btn.disabled = true;
      btn.textContent = '查詢中...';

      try {
        const pubRef = doc(db, 'public_users', email);
        const pubSnap = await getDoc(pubRef);
        
        if(!pubSnap.exists()) {
          toast('找不到此用戶 (請確認對方已登入過網站)');
          btn.disabled = false;
          btn.textContent = '邀請';
          return;
        }
        
        const targetUid = pubSnap.data().uid;
        if(members[targetUid]) {
          toast('該用戶已在成員名單中');
          btn.disabled = false;
          btn.textContent = '邀請';
          return;
        }

        const ledgerRef = doc(db, 'users', UID, 'ledgers', ledgerId);
        await updateDoc(ledgerRef, {
          [`members.${targetUid}`]: 'editor'
        });
        
        const targetLedgerRef = doc(db, 'users', targetUid, 'ledgers', ledgerId);
        await setDoc(targetLedgerRef, {
          name: data.name,
          owner: UID,
          isDefault: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          members: { ...members, [targetUid]: 'editor' }
        }, { merge: true });

        toast('邀請成功！對方將看到此帳本');
        input.value = '';
        members[targetUid] = 'editor';
        renderList();

      } catch(e) {
        console.error(e);
        toast('邀請失敗：' + e.message);
      } finally {
        btn.disabled = false;
        btn.textContent = '邀請';
      }
    });

    window.removeMember = async (lId, targetUid) => {
      if(!confirm('確定移除？對方將無法存取。')) return;
      try {
        const ledgerRef = doc(db, 'users', UID, 'ledgers', lId);
        const newMems = { ...members };
        delete newMems[targetUid];
        await updateDoc(ledgerRef, { members: newMems });

        const targetRef = doc(db, 'users', targetUid, 'ledgers', lId);
        await deleteDoc(targetRef);

        toast('已移除成員');
        delete members[targetUid];
        renderList();
      } catch(e) {
        console.error(e);
        toast('移除失敗');
      }
    };
  }
}

async function tryDeleteByCard(card){
  if(!card) return;
  const id = card.dataset.id;
  const owner = card.dataset.owner || UID;
  
  if(owner !== UID) {
    if(!confirm('確定退出此共用帳本？')) return;
    await deleteDoc(doc(db, 'users', UID, 'ledgers', id));
    toast('已退出共用');
    listLedgers();
    return;
  }

  const ref = doc(db,'users',UID,'ledgers',id);
  const data = (await getDoc(ref)).data();
  const isDefault = !!data?.isDefault;
  if(!confirm(`確定刪除「${data?.name||'未命名'}」？所有成員都將失去存取權。`)) return;
  
  await deleteDoc(ref);
  
  if(isDefault){
    const qy = query(collection(db,'users',UID,'ledgers'), orderBy('createdAt','asc'));
    const snap = await getDocs(qy);
    if(!snap.empty){
      const first = snap.docs[0];
      await updateDoc(doc(db,'users',UID,'ledgers', first.id), { isDefault:true, updatedAt: serverTimestamp() });
    }
  }
  listLedgers();
}

// ===============================
// 管理預算 (字體顏色修正版)
// ===============================
async function listBudgets(){ 
  const host = $('#pageHost', mount);
  if(!host) return;
  
  if(!UID){
    host.innerHTML = `<section class="content-card"><h2>管理預算</h2><div class="muted">請先登入</div></section>`;
    return;
  }
  
  const ledgerId = await getDefaultLedger();
  if(!ledgerId){
    host.innerHTML = `<section class="content-card"><h2>管理預算</h2><div class="muted">請先建立帳本</div></section>`;
    return;
  }
  
  currentLedgerId = ledgerId;
  
  // ✅ 修正：input 加上 style="color:#1f2937" (深灰)
  host.innerHTML = `
    <section class="content-card">
      <h2>管理預算</h2>
      <div class="budget-form" style="background:#f8fafc;padding:16px;border-radius:8px;margin-bottom:20px">
        <div style="display:grid;gap:12px">
          <input id="budgetName" placeholder="預算名稱（例如：9月生活費）" style="padding:8px;border:1px solid #cbd5e1;border-radius:6px;color:#1f2937;">
          <input id="budgetAmount" type="number" placeholder="金額" style="padding:8px;border:1px solid #cbd5e1;border-radius:6px;color:#1f2937;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <input id="budgetStart" type="date" style="padding:8px;border:1px solid #cbd5e1;border-radius:6px;color:#1f2937;">
            <input id="budgetEnd" type="date" style="padding:8px;border:1px solid #cbd5e1;border-radius:6px;color:#1f2937;">
          </div>
          <button id="btnAddBudget" class="btn" style="background:#3b82f6;color:white;padding:10px;border-radius:6px;border:none;cursor:pointer">新增預算</button>
        </div>
      </div>
      <div id="budgetList" style="display:grid;gap:12px"></div>
    </section>
  `;
  
  loadBudgetList();
  
  $('#btnAddBudget', host).addEventListener('click', async ()=>{
    const name = $('#budgetName', host).value.trim();
    const amount = $('#budgetAmount', host).value.trim();
    const start = $('#budgetStart', host).value;
    const end = $('#budgetEnd', host).value;
    
    if(!name || !amount || !start || !end) return toast('請填寫完整資訊');
    
    await addDoc(collection(db, 'users', UID, 'ledgers', currentLedgerId, 'budgets'), {
      name,
      amount: Number(amount),
      period: 'custom',
      startAt: new Date(start+'T00:00:00'),
      endAt: new Date(end+'T23:59:59'),
      currency: 'TWD',
      rollover: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    $('#budgetName', host).value = '';
    $('#budgetAmount', host).value = '';
    $('#budgetStart', host).value = '';
    $('#budgetEnd', host).value = '';
    toast('預算已新增');
    loadBudgetList();
  });
}

async function loadBudgetList(){
  const list = $('#budgetList', mount);
  if(!list) return;
  list.innerHTML = '<div class="muted">載入中…</div>';
  
  const qy = query(collection(db, 'users', UID, 'ledgers', currentLedgerId, 'budgets'), orderBy('createdAt','desc'));
  const snap = await getDocs(qy);
  
  if(snap.empty){
    list.innerHTML = '<div class="muted">尚無預算，請先新增</div>';
    return;
  }
  
  const items = [];
  snap.forEach(d=>{
    const v = d.data();
    const start = v.startAt?.toDate?.()?.toLocaleDateString('zh-TW') || '---';
    const end = v.endAt?.toDate?.()?.toLocaleDateString('zh-TW') || '---';
    // ✅ 修正：列表文字顏色也改為深色
    items.push(`
      <div class="budget-item" data-id="${d.id}" style="background:white;padding:16px;border-radius:8px;border:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;color:#1f2937;">
        <div>
          <div style="font-weight:600;margin-bottom:4px">${escapeHtml(v.name)}</div>
          <div class="muted" style="font-size:14px;color:#64748b;">NT$ ${v.amount?.toLocaleString()} | ${start} ~ ${end}</div>
        </div>
        <button class="btn act-del-budget" style="color:#ef4444"><i class="bi bi-trash"></i></button>
      </div>
    `);
  });
  
  list.innerHTML = items.join('');
  
  $$('.act-del-budget', list).forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const item = btn.closest('.budget-item');
      const id = item.dataset.id;
      if(!confirm('確定刪除此預算？')) return;
      await deleteDoc(doc(db, 'users', UID, 'ledgers', currentLedgerId, 'budgets', id));
      toast('預算已刪除');
      loadBudgetList();
    });
  });
}

// ===============================
// 管理類型 (字體顏色修正版)
// ===============================
async function listCategories(){ 
  const host = $('#pageHost', mount);
  if(!host) return;
  
  if(!UID){
    host.innerHTML = `<section class="content-card"><h2>管理類型</h2><div class="muted">請先登入</div></section>`;
    return;
  }
  
  const ledgerId = await getDefaultLedger();
  if(!ledgerId){
    host.innerHTML = `<section class="content-card"><h2>管理類型</h2><div class="muted">請先建立帳本</div></section>`;
    return;
  }
  
  currentLedgerId = ledgerId;
  
  // ✅ 修正：input 加上 color:#1f2937
  host.innerHTML = `
    <section class="content-card">
      <h2>管理類型</h2>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
        <div>
          <h3 style="margin:0 0 12px 0;color:#ef4444">支出類型</h3>
          <div class="cat-form" style="background:#fef2f2;padding:12px;border-radius:8px;margin-bottom:12px">
            <input id="expenseName" placeholder="類型名稱" style="width:100%;padding:8px;border:1px solid #fecaca;border-radius:6px;margin-bottom:8px;color:#1f2937;">
            <button id="btnAddExpense" class="btn" style="width:100%;background:#ef4444;color:white;padding:8px;border-radius:6px;border:none">新增支出類型</button>
          </div>
          <div id="expenseList" style="display:grid;gap:8px"></div>
        </div>
        
        <div>
          <h3 style="margin:0 0 12px 0;color:#10b981">收入類型</h3>
          <div class="cat-form" style="background:#f0fdf4;padding:12px;border-radius:8px;margin-bottom:12px">
            <input id="incomeName" placeholder="類型名稱" style="width:100%;padding:8px;border:1px solid #bbf7d0;border-radius:6px;margin-bottom:8px;color:#1f2937;">
            <button id="btnAddIncome" class="btn" style="width:100%;background:#10b981;color:white;padding:8px;border-radius:6px;border:none">新增收入類型</button>
          </div>
          <div id="incomeList" style="display:grid;gap:8px"></div>
        </div>
      </div>
    </section>
  `;
  
  loadCategoryList();
  
  $('#btnAddExpense', host)?.addEventListener('click', async ()=>{
    const name = $('#expenseName', host).value.trim();
    if(!name) return toast('請輸入類型名稱');
    await addCategory('expense', name);
    $('#expenseName', host).value = '';
    toast('支出類型已新增');
    loadCategoryList();
  });
  
  $('#btnAddIncome', host)?.addEventListener('click', async ()=>{
    const name = $('#incomeName', host).value.trim();
    if(!name) return toast('請輸入類型名稱');
    await addCategory('income', name);
    $('#incomeName', host).value = '';
    toast('收入類型已新增');
    loadCategoryList();
  });
}

async function addCategory(type, name){
  await addDoc(collection(db, 'users', UID, 'ledgers', currentLedgerId, 'categories'), {
    name,
    type,
    order: Date.now(),
    color: type === 'expense' ? '#ef4444' : '#10b981',
    parentId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

async function loadCategoryList(){
  const expList = $('#expenseList', mount);
  const incList = $('#incomeList', mount);
  if(!expList || !incList) return;
  
  expList.innerHTML = '<div class="muted">載入中…</div>';
  incList.innerHTML = '<div class="muted">載入中…</div>';
  
  const qy = query(collection(db, 'users', UID, 'ledgers', currentLedgerId, 'categories'), orderBy('order','asc'));
  const snap = await getDocs(qy);
  
  const expenses = [];
  const incomes = [];
  
  snap.forEach(d=>{
    const v = d.data();
    // ✅ 修正：列表文字顏色也改為深色
    const html = `
      <div class="cat-item" data-id="${d.id}" style="background:white;padding:10px 12px;border-radius:6px;border:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;color:#1f2937;">
        <span>${escapeHtml(v.name)}</span>
        <button class="btn act-del-cat" style="color:#ef4444;padding:4px 8px"><i class="bi bi-trash"></i></button>
      </div>
    `;
    if(v.type === 'expense') expenses.push(html);
    else incomes.push(html);
  });
  
  expList.innerHTML = expenses.length ? expenses.join('') : '<div class="muted">尚無支出類型</div>';
  incList.innerHTML = incomes.length ? incomes.join('') : '<div class="muted">尚無收入類型</div>';
  
  $$('.act-del-cat').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const item = btn.closest('.cat-item');
      const id = item.dataset.id;
      if(!confirm('確定刪除此類型？')) return;
      await deleteDoc(doc(db, 'users', UID, 'ledgers', currentLedgerId, 'categories', id));
      toast('類型已刪除');
      loadCategoryList();
    });
  });
}

// ===============================
// 管理貨幣 (字體顏色修正版)
// ===============================
async function listRates(){ 
  const host = $('#pageHost', mount);
  if(!host) return;
  
  if(!UID){
    host.innerHTML = `<section class="content-card"><h2>管理貨幣</h2><div class="muted">請先登入</div></section>`;
    return;
  }
  
  // ✅ 修正：input 加上 color:#1f2937
  host.innerHTML = `
    <section class="content-card">
      <h2>管理貨幣與匯率</h2>
      
      <div class="rate-form" style="background:#f8fafc;padding:16px;border-radius:8px;margin-bottom:20px">
        <h3 style="margin:0 0 12px 0;color:#1f2937;">新增匯率</h3>
        <div style="display:grid;grid-template-columns:1fr 2fr auto;gap:8px;align-items:center">
          <input id="currencyCode" placeholder="貨幣代碼" style="padding:8px;border:1px solid #cbd5e1;border-radius:6px;color:#1f2937;" maxlength="3">
          <input id="currencyRate" type="number" step="0.0001" placeholder="對 TWD 匯率（例如：0.033 表示 1 TWD = 0.033 單位）" style="padding:8px;border:1px solid #cbd5e1;border-radius:6px;color:#1f2937;">
          <button id="btnAddRate" class="btn" style="background:#3b82f6;color:white;padding:8px 16px;border-radius:6px;border:none;white-space:nowrap">新增</button>
        </div>
        <div class="muted" style="margin-top:8px;font-size:13px;color:#64748b;">💡 範例：USD 匯率 0.033 表示 1 TWD ≈ 0.033 USD</div>
      </div>
      
      <div id="rateList" style="display:grid;gap:12px"></div>
    </section>
  `;
  
  loadRateList();
  
  $('#btnAddRate', host)?.addEventListener('click', async ()=>{
    const code = $('#currencyCode', host).value.trim().toUpperCase();
    const rate = $('#currencyRate', host).value.trim();
    
    if(!code || !rate) return toast('請填寫完整資訊');
    if(code.length !== 3) return toast('貨幣代碼需為 3 個字元（例如 USD）');
    
    const userRef = doc(db, 'users', UID);
    const snap = await getDoc(userRef);
    const settings = snap.data()?.settings || {};
    const rates = settings.currencies?.rates || {};
    rates[code] = Number(rate);
    
    await updateDoc(userRef, {
      'settings.currencies.base': 'TWD',
      'settings.currencies.rates': rates,
      updatedAt: serverTimestamp()
    });
    
    $('#currencyCode', host).value = '';
    $('#currencyRate', host).value = '';
    toast('匯率已新增');
    loadRateList();
  });
}

async function loadRateList(){
  const list = $('#rateList', mount);
  if(!list) return;
  list.innerHTML = '<div class="muted">載入中…</div>';
  
  const userRef = doc(db, 'users', UID);
  const snap = await getDoc(userRef);
  const rates = snap.data()?.settings?.currencies?.rates || {};
  
  if(Object.keys(rates).length === 0){
    list.innerHTML = '<div class="muted">尚無自訂匯率</div>';
    return;
  }
  
  // ✅ 修正：列表文字顏色也改為深色
  const items = Object.entries(rates).map(([code, rate])=>`
    <div class="rate-item" data-code="${code}" style="background:white;padding:14px;border-radius:8px;border:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;color:#1f2937;">
      <div>
        <span style="font-weight:600;color:#3b82f6;font-size:16px">${code}</span>
        <span class="muted" style="margin-left:12px;color:#64748b;">1 TWD = ${rate} ${code}</span>
      </div>
      <button class="btn act-del-rate" style="color:#ef4444"><i class="bi bi-trash"></i></button>
    </div>
  `);
  
  list.innerHTML = items.join('');
  
  $$('.act-del-rate', list).forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const item = btn.closest('.rate-item');
      const code = item.dataset.code;
      if(!confirm(`確定刪除 ${code} 匯率？`)) return;
      
      const userRef = doc(db, 'users', UID);
      const snap = await getDoc(userRef);
      const rates = snap.data()?.settings?.currencies?.rates || {};
      delete rates[code];
      
      await updateDoc(userRef, {
        'settings.currencies.rates': rates,
        updatedAt: serverTimestamp()
      });
      toast('匯率已刪除');
      loadRateList();
    });
  });
}

// ===============================
// 其他功能保留
// ===============================
async function loadChat(){ 
  const host = $('#pageHost', mount);
  if(!host) return;
  const el=document.createElement('div'); 
  el.className='content-card'; 
  el.innerHTML=`<h2>聊天設定</h2><div class="muted">（保留原本聊天設定掛載點）</div>`; 
  host.replaceChildren(el);
}

async function loadGeneral(){ 
  const host = $('#pageHost', mount);
  if(!host) return;
  const el=document.createElement('div'); 
  el.className='content-card'; 
  el.innerHTML=`<h2>一般設定</h2><div class="muted">（保留原本一般設定掛載點）</div>`; 
  host.replaceChildren(el);
}

// ===============================
// 路由函數
// ===============================
function route(){
  const h = (location.hash||'').replace('#','') || 'ledgers';
  console.log('🔄 切換到:', h, '登入狀態:', !!UID);
  switch(h){
    case 'ledgers':    renderLedgersView(); break;
    case 'budget':     listBudgets(); break;
    case 'currency':   listRates(); break;
    case 'categories': listCategories(); break;
    case 'chat':       loadChat(); break;
    case 'general':    loadGeneral(); break;
    default:           renderLedgersView(); break;
  }
}

// ===============================
// 啟動流程
// ===============================
(async function init(){
  console.log('🚀 初始化設定頁面...');
  
  const shell = renderShell();
  mount.replaceChildren(shell);

  // 等待 Auth 初始化
  let authReady = false;
  
  auth.onAuthStateChanged(async (user)=>{
    console.log('👤 Auth 狀態變更:', user ? `已登入 (${user.uid})` : '未登入');
    
    if(!user){
      UID = null;
      const host = $('#pageHost', mount);
      if(host){
        host.innerHTML = `
          <section class="content-card">
            <h2>設定</h2>
            <div class="muted">請先登入帳號</div>
          </section>`;
      }
      return;
    }

    UID = user.uid;
    console.log('✅ UID 已設定:', UID);
    
    // 首次載入或登入後，執行路由
    if(!authReady){
      authReady = true;
      route();
    }
  });

  // 監聽 hash 變化
  window.addEventListener('hashchange', ()=>{
    if(UID) route(); // 只有登入時才路由
  });
  
  // 初始化 hash
  if(!location.hash) location.hash = '#ledgers';
})();

// ===============================
// Escape 工具
// ===============================
function escapeHtml(s){
  return (s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeHtmlAttr(s){
  return escapeHtml(s).replace(/\n/g,' ');
}
