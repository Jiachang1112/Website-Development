// assets/js/pages/accounting-settings.js
// 設定頁（帳本/預算/類型/貨幣、聊天設定、匯入/匯出、每日提醒）

import { auth, db } from '../firebase.js';
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp,
  collection, addDoc, deleteDoc, query, orderBy, getDocs
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';

// 小工具
const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
const toast = (m)=>alert(m);

// 根元素
const mount = $('#app') || document.body;

/* ==============================
   畫面骨架
   ============================== */
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

/* ==============================
   狀態
   ============================== */
let UID = null;
let currentLedgerId = null;

/* ==============================
   共用：取得/建立使用者文件
   ============================== */
async function getUserDoc(){
  const ref = doc(db, 'users', UID);
  const snap = await getDoc(ref);
  if (!snap.exists()){
    await setDoc(ref, { createdAt: serverTimestamp() }, { merge: true });
  }
  const data = (await getDoc(ref)).data() || {};
  return data;
}

/* ==============================
   「管理帳本」UI（卡片式）
   ============================== */
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
  listLedgers(); // 初次載入
}

/* Firestore：新增帳本（若是第一本 → 設成預設） */
async function addLedger(name){
  if (!UID) return toast('請先登入');
  try{
    const ref = collection(db, 'users', UID, 'ledgers');
    // 檢查是否第一本
    const qy = query(ref, orderBy('createdAt','asc'));
    const snap = await getDocs(qy);
    const isFirst = snap.empty;

    await addDoc(ref, {
      name,
      currency: 'TWD',
      members: { [UID]: 'owner' },
      isDefault: isFirst ? true : false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }catch(e){
    console.error(e); toast('新增帳本失敗，請稍後再試');
  }
}

/* Firestore：列出帳本並渲染卡片 */
async function listLedgers(){
  const grid = $('#ledgerGrid', mount);
  if(!grid) return;
  if(!UID){ grid.innerHTML = '<div class="muted">請先登入帳號</div>'; return; }
  grid.innerHTML = '<div class="muted">載入中…</div>';

  try{
    const qy = query(collection(db, 'users', UID, 'ledgers'), orderBy('createdAt','asc'));
    const snap = await getDocs(qy);

    // 若沒有任何帳本 → 自動建立「預設帳本」
    if (snap.empty){
      await addLedger('預設帳本');
      const snap2 = await getDocs(qy);
      if (snap2.empty){
        grid.innerHTML = '<div class="muted">建立預設帳本失敗，請重新整理</div>';
        return;
      }
      renderLedgerCards(snap2);
      return;
    }

    renderLedgerCards(snap);
  }catch(e){
    console.error(e);
    grid.innerHTML = '<div class="muted">讀取失敗</div>';
  }
}

function renderLedgerCards(snap){
  const grid = $('#ledgerGrid', mount);
  const cards = [];
  snap.forEach(d=>{
    const v = d.data();
    cards.push(ledgerCardTpl({ id:d.id, ...v }));
  });
  cards.push(addCardTpl());
  grid.innerHTML = cards.join('');
  bindLedgerCardEvents(grid);
}

/* 卡片 HTML 範本：一般帳本 */
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

/* 卡片 HTML 範本：新增帳本 */
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

/* 綁定卡片事件（rename / delete / swipe / add） */
function bindLedgerCardEvents(grid){
  // 新增
  $('#btnAddLedger', grid)?.addEventListener('click', async ()=>{
    const name = ($('#newLedgerName', grid)?.value || '').trim();
    if(!name) return toast('請輸入帳本名稱');
    await addLedger(name);
    listLedgers();
  });

  // 重新命名
  $$('.act-rename', grid).forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const card = btn.closest('.ledger-card');
      if(!card) return;
      const id = card.dataset.id;
      const titleEl = card.querySelector('.ledger-name');

      // 變成輸入模式
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

      wrap.querySelector('.btn-cancel').onclick = ()=>{ listLedgers(); };

      wrap.querySelector('.btn-save').onclick = async ()=>{
        const val = wrap.querySelector('input').value.trim();
        if(!val) return toast('請輸入帳本名稱');
        try{
          await updateDoc(doc(db,'users',UID,'ledgers',id), {
            name: val, updatedAt: serverTimestamp()
          });
          listLedgers();
        }catch(e){
          console.error(e); toast('更新失敗');
        }
      };
    });
  });

  // 刪除（按鈕）
  $$('.act-delete', grid).forEach(btn=>{
    btn.addEventListener('click', ()=> tryDeleteByCard(btn.closest('.ledger-card')));
  });

  // 手機左滑刪除
  $$('.ledger-card', grid).forEach(card=>{
    if(card.classList.contains('add')) return;
    let startX = 0;
    card.addEventListener('touchstart', e=>{
      startX = e.changedTouches[0].clientX;
    }, {passive:true});
    card.addEventListener('touchend', e=>{
      const dx = e.changedTouches[0].clientX - startX;
      if(dx < -70){
        tryDeleteByCard(card);
      }
    });
  });
}

/* 嘗試刪除（處理預設帳本交接） */
async function tryDeleteByCard(card){
  if(!card) return;
  const id = card.dataset.id;

  try{
    // 找出是否預設帳本
    const ref = doc(db,'users',UID,'ledgers',id);
    const data = (await getDoc(ref)).data();
    const isDefault = !!data?.isDefault;

    if(!confirm(`確定刪除「${data?.name||'未命名'}」？`)) return;

    // 先刪
    await deleteDoc(ref);

    // 如果刪到預設帳本 → 指派最早的一本為預設
    if(isDefault){
      const qy = query(collection(db,'users',UID,'ledgers'), orderBy('createdAt','asc'));
      const snap = await getDocs(qy);
      if(!snap.empty){
        const first = snap.docs[0];
        await updateDoc(doc(db,'users',UID,'ledgers', first.id), { isDefault:true, updatedAt: serverTimestamp() });
      }
    }
    listLedgers();
  }catch(e){
    console.error(e); toast('刪除失敗');
  }
}

/* ==============================
   其他原功能：分類 / 預算 / 貨幣 / 聊天 / 一般（保留）
   ============================== */
async function addCategory(type, name){
  if (!currentLedgerId) return toast('請先選帳本');
  await addDoc(collection(db, 'users', UID, 'ledgers', currentLedgerId, 'categories'), {
    name, type, order: Date.now(), color: '#60a5fa', parentId: null,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
}
async function listCategories(){
  const el = document.createElement('div');
  el.className = 'content-card';
  el.innerHTML = `
    <h2>管理類型</h2>
    <div class="muted">（保留原本的類型管理 UI 掛載點）</div>`;
  $('#pageHost', mount).replaceChildren(el);
}

async function addBudget({ name, amount, start, end }){
  if (!currentLedgerId) return toast('請先選帳本');
  await addDoc(collection(db, 'users', UID, 'ledgers', currentLedgerId, 'budgets'), {
    name, amount: Number(amount)||0, period: 'custom',
    startAt: new Date(start+'T00:00:00'), endAt: new Date(end+'T23:59:59'),
    currency: 'TWD', rollover: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
}
async function listBudgets(){
  const el = document.createElement('div');
  el.className = 'content-card';
  el.innerHTML = `
    <h2>管理預算</h2>
    <div class="muted">（保留原本的預算 UI 掛載點）</div>`;
  $('#pageHost', mount).replaceChildren(el);
}

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
    'settings.currencies.base': 'TWD',
    'settings.currencies.rates': rates,
    updatedAt: serverTimestamp()
  });
  listRates();
}
async function listRates(){
  const el = document.createElement('div');
  el.className = 'content-card';
  el.innerHTML = `
    <h2>管理貨幣</h2>
    <div class="muted">（保留原本的貨幣 UI 掛載點）</div>`;
  $('#pageHost', mount).replaceChildren(el);
}

async function loadChat(){
  const el = document.createElement('div');
  el.className = 'content-card';
  el.innerHTML = `
    <h2>聊天設定</h2>
    <div class="muted">（保留原本聊天設定掛載點）</div>`;
  $('#pageHost', mount).replaceChildren(el);
}

async function loadGeneral(){
  const el = document.createElement('div');
  el.className = 'content-card';
  el.innerHTML = `
    <h2>一般設定</h2>
    <div class="muted">（保留原本一般設定掛載點）</div>`;
  $('#pageHost', mount).replaceChildren(el);
}

/* ==============================
   依帳本刷新：保留
   ============================== */
async function refreshForLedger(){
  await listRates();
}

/* ==============================
   啟動流程
   ============================== */
(async function init(){
  // 畫面骨架
  const shell = renderShell();
  mount.replaceChildren(shell);

  // 先用 currentUser（已登入就立刻渲染）
  if (auth.currentUser) {
    UID = auth.currentUser.uid;
    renderLedgersView();
  }

  // 標準監聽（避免有些瀏覽器載入時 currentUser 尚未就緒）
  onAuthStateChanged(auth, (user)=>{
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
  });

  // hash 路由（左側選單）
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

/* ==============================
   小工具：escape
   ============================== */
function escapeHtml(s){
  return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeHtmlAttr(s){ return escapeHtml(s).replace(/\n/g,' '); }

