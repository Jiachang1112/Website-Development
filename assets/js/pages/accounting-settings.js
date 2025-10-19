// assets/js/pages/accounting-settings.js
// 設定頁（帳本 / 預算 / 類型 / 貨幣 / 聊天設定 / 一般設定）

import { auth, db } from '../firebase.js';
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp,
  collection, addDoc, deleteDoc, query, orderBy, getDocs
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';
import { onAuthStateChanged, getAuth } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';

// -------------------- 工具函式 --------------------
const $ = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
const toast = (m)=>alert(m);
const mount = $('#app') || document.body;

// ===============================
// 等待 Firebase Auth 初始化
// ===============================
async function waitForAuthInit() {
  const auth = getAuth();
  return new Promise(resolve => {
    const unsub = onAuthStateChanged(auth, user => {
      unsub();
      resolve(user);
    });
  });
}

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
  const ref = doc(db, 'users', UID);
  const snap = await getDoc(ref);
  if (!snap.exists()){
    await setDoc(ref, { createdAt: serverTimestamp() }, { merge: true });
  }
  return (await getDoc(ref)).data() || {};
}

// ===============================
// 管理帳本
// ===============================
function renderLedgersView(){
  const host = $('#pageHost', mount);
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
    isDefault: isFirst,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

async function listLedgers(){
  const grid = $('#ledgerGrid', mount);
  if(!grid) return;
  if(!UID){ grid.innerHTML = '<div class="muted">請先登入帳號</div>'; return; }
  grid.innerHTML = '<div class="muted">載入中…</div>';

  const qy = query(collection(db, 'users', UID, 'ledgers'), orderBy('createdAt','asc'));
  const snap = await getDocs(qy);

  if (snap.empty){
    await addLedger('預設帳本');
    return listLedgers();
  }

  const cards = [];
  snap.forEach(d=>{
    const v = d.data();
    cards.push(ledgerCardTpl({ id:d.id, ...v }));
  });
  cards.push(addCardTpl());
  grid.innerHTML = cards.join('');
  bindLedgerCardEvents(grid);
}

function ledgerCardTpl({ id, name, isDefault }){
  return `
  <div class="ledger-card" data-id="${id}">
    <div class="cover"></div>
    <div class="body">
      <div style="min-width:0">
        <div class="ledger-name">${escapeHtml(name || '(未命名)')}</div>
        ${isDefault ? `<div class="badge-default" style="display:inline-block;margin-top:6px">預設</div>`:''}
      </div>
      <div class="ledger-actions">
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

  $$('.act-delete', grid).forEach(btn=>{
    btn.addEventListener('click', ()=> tryDeleteByCard(btn.closest('.ledger-card')));
  });
}

async function tryDeleteByCard(card){
  if(!card) return;
  const id = card.dataset.id;
  const ref = doc(db,'users',UID,'ledgers',id);
  const data = (await getDoc(ref)).data();
  const isDefault = !!data?.isDefault;
  if(!confirm(`確定刪除「${data?.name||'未命名'}」？`)) return;
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
// 其他功能保留
// ===============================
async function listCategories(){ const el=document.createElement('div'); el.className='content-card'; el.innerHTML=`<h2>管理類型</h2><div class="muted">（保留原本類型管理掛載點）</div>`; $('#pageHost', mount).replaceChildren(el);}
async function listBudgets(){ const el=document.createElement('div'); el.className='content-card'; el.innerHTML=`<h2>管理預算</h2><div class="muted">（保留原本預算掛載點）</div>`; $('#pageHost', mount).replaceChildren(el);}
async function listRates(){ const el=document.createElement('div'); el.className='content-card'; el.innerHTML=`<h2>管理貨幣</h2><div class="muted">（保留原本貨幣掛載點）</div>`; $('#pageHost', mount).replaceChildren(el);}
async function loadChat(){ const el=document.createElement('div'); el.className='content-card'; el.innerHTML=`<h2>聊天設定</h2><div class="muted">（保留原本聊天設定掛載點）</div>`; $('#pageHost', mount).replaceChildren(el);}
async function loadGeneral(){ const el=document.createElement('div'); el.className='content-card'; el.innerHTML=`<h2>一般設定</h2><div class="muted">（保留原本一般設定掛載點）</div>`; $('#pageHost', mount).replaceChildren(el);}

// ===============================
// 啟動流程
// ===============================
(async function init(){
  const shell = renderShell();
  mount.replaceChildren(shell);

  const user = await waitForAuthInit(); // ✅ 等待登入狀態初始化完成
  if(!user){
    UID = null;
    $('#pageHost', mount).innerHTML = `
      <section class="content-card">
        <h2>管理帳本</h2>
        <div class="muted">請先登入帳號</div>
      </section>`;
    return;
  }

  UID = user.uid;
  renderLedgersView();

  function route(){
    const h = (location.hash||'').replace('#','') || 'ledgers';
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
  window.addEventListener('hashchange', route);
  if(!location.hash) location.hash = '#ledgers';
  else route();
})();

// ===============================
// Escape 工具
// ===============================
function escapeHtml(s){return (s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function escapeHtmlAttr(s){return escapeHtml(s).replace(/\n/g,' ');}

