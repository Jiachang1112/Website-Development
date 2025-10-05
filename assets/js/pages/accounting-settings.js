// /assets/js/pages/accounting-settings.js
// 記帳設定（帳本 / 預算 / 類型）+ Firestore CRUD

import { auth, db } from '../firebase.js';
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc, getDoc,
  onSnapshot, serverTimestamp, query, orderBy
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

// 小工具
const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
const toast = (m)=>alert(m);

// ======= 畫面模板（右側） =======
const templates = {
  ledgers: `
    <div class="card p-3">
      <h5 class="mb-3">管理帳本</h5>
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label">新增帳本</label>
          <div class="input-group">
            <input id="in-ledger-name" class="form-control" placeholder="例如：主帳本"/>
            <button class="btn btn-primary" id="btn-add-ledger">新增</button>
          </div>
          <div class="small muted mt-2">點選名稱可直接重新命名；垃圾桶可刪除。</div>
        </div>
      </div>
      <hr class="border-secondary">
      <ul class="list-group" id="list-ledgers"></ul>
    </div>
  `,
  budget: `
    <div class="card p-3">
      <h5 class="mb-3">管理預算</h5>

      <div class="mb-3">
        <label class="form-label">每月總預算</label>
        <div class="input-group" style="max-width:420px">
          <span class="input-group-text">NT$</span>
          <input id="in-month-budget" type="number" min="0" class="form-control" placeholder="30000"/>
          <button class="btn btn-primary" id="btn-save-month-budget">儲存</button>
        </div>
      </div>

      <hr class="border-secondary">

      <div class="row g-3">
        <div class="col-md-7">
          <label class="form-label">新增分類預算</label>
          <div class="input-group">
            <select id="sel-budget-cat" class="form-select" style="max-width: 280px"></select>
            <span class="input-group-text">NT$</span>
            <input id="in-budget-amt" type="number" min="0" class="form-control" placeholder="5000"/>
            <button class="btn btn-outline-primary" id="btn-add-cat-budget">新增/更新</button>
          </div>
          <div class="small muted mt-2">選擇類別後填金額，點「新增/更新」；下方清單可編輯或刪除。</div>
        </div>
      </div>

      <div class="mt-3">
        <h6 class="mb-2">分類預算清單</h6>
        <ul class="list-group" id="list-cat-budgets"></ul>
      </div>
    </div>
  `,
  categories: `
    <div class="card p-3">
      <h5 class="mb-3">管理類型</h5>
      <div class="row g-3">
        <div class="col-md-7">
          <label class="form-label">新增分類</label>
          <div class="input-group">
            <select id="sel-cat-type" class="form-select" style="max-width:160px">
              <option value="expense">支出</option>
              <option value="income">收入</option>
            </select>
            <input id="in-cat-name" class="form-control" placeholder="分類名稱（例如：餐飲）"/>
            <button class="btn btn-primary" id="btn-add-cat">新增</button>
          </div>
        </div>
      </div>
      <hr class="border-secondary">
      <div class="row">
        <div class="col-md-6">
          <h6>支出</h6>
          <ul class="list-group" id="list-expense-cats"></ul>
        </div>
        <div class="col-md-6">
          <h6>收入</h6>
          <ul class="list-group" id="list-income-cats"></ul>
        </div>
      </div>
    </div>
  `
};

// ======= 版面骨架（左側清單 + 右側畫面） =======
function renderShell(root){
  root.innerHTML = `
    <div class="mb-3 d-flex align-items-center justify-content-between">
      <div>
        <h3 class="m-0">記帳設定</h3>
        <div class="muted">請選擇左側功能進行設定</div>
      </div>
    </div>

    <div class="row g-3">
      <aside class="col-md-3">
        <div class="list-group" id="menu">
          <button class="list-group-item list-group-item-action" data-screen="ledgers">管理帳本</button>
          <button class="list-group-item list-group-item-action" data-screen="budget">管理預算</button>
          <button class="list-group-item list-group-item-action" data-screen="categories">管理類型</button>
        </div>
      </aside>
      <main class="col-md-9">
        <div id="screen"></div>
      </main>
    </div>
  `;
}

// ======= Route / 內容切換 =======
function show(screen){
  const valid = ['ledgers','budget','categories'];
  if (!valid.includes(screen)) screen = 'ledgers';

  $$('#menu .list-group-item').forEach(b=>b.classList.toggle('active', b.dataset.screen===screen));
  $('#screen').innerHTML = templates[screen];
  if (location.hash !== '#'+screen) history.replaceState(null,'','#'+screen);

  // 綁定每個畫面 & 初始讀取
  if (screen==='ledgers')     initLedgers();
  if (screen==='categories')  initCategories();
  if (screen==='budget')      initBudget();
}

// ======= 驗證登入 =======
function needUid(){
  const uid = auth.currentUser?.uid || null;
  if (!uid){
    toast('請先登入（此頁僅限登入使用者）');
    return null;
  }
  return uid;
}

// ==================== 帳本：CRUD ====================
let unsubLedgers = null;
function initLedgers(){
  const uid = needUid(); if (!uid) return;

  // 新增
  $('#btn-add-ledger')?.addEventListener('click', async ()=>{
    const name = $('#in-ledger-name').value.trim();
    if (!name) return toast('請輸入帳本名稱');
    await addDoc(collection(db,'users',uid,'ledgers'), {
      name, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    $('#in-ledger-name').value = '';
  });

  // 即時串流清單
  unsubLedgers && unsubLedgers();
  const q = query(collection(db,'users',uid,'ledgers'), orderBy('createdAt','asc'));
  unsubLedgers = onSnapshot(q, snap=>{
    const ul = $('#list-ledgers');
    ul.innerHTML = '';
    if (snap.empty){
      ul.innerHTML = `<li class="list-group-item muted">尚無帳本</li>`;
      return;
    }
    snap.forEach(d=>{
      const v = d.data()||{};
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-center gap-2';
      li.innerHTML = `
        <input class="form-control form-control-sm bg-transparent text-light border-0" value="${escapeHTML(v.name||'')}" />
        <div class="btn-group">
          <button class="btn btn-sm btn-outline-primary">重新命名</button>
          <button class="btn btn-sm btn-outline-danger">刪除</button>
        </div>
      `;
      const input = li.querySelector('input');
      li.querySelector('.btn-outline-primary').onclick = async ()=>{
        const newName = input.value.trim();
        if (!newName) return toast('名稱不可為空');
        await updateDoc(doc(db,'users',uid,'ledgers',d.id), { name:newName, updatedAt: serverTimestamp() });
        toast('已更新名稱');
      };
      li.querySelector('.btn-outline-danger').onclick = async ()=>{
        if (!confirm('確定要刪除此帳本？（僅刪帳本，不影響你的紀錄資料）')) return;
        await deleteDoc(doc(db,'users',uid,'ledgers',d.id));
      };
      $('#list-ledgers').appendChild(li);
    });
  }, err=>{
    $('#list-ledgers').innerHTML = `<li class="list-group-item text-danger">載入失敗：${err.message}</li>`;
  });
}

// ==================== 類型：CRUD ====================
let unsubCats = null;
let cachedCats = []; // 供預算下拉使用

function initCategories(){
  const uid = needUid(); if (!uid) return;

  // 新增分類
  $('#btn-add-cat')?.addEventListener('click', async ()=>{
    const type = $('#sel-cat-type').value;
    const name = $('#in-cat-name').value.trim();
    if (!name) return toast('請輸入分類名稱');
    await addDoc(collection(db,'users',uid,'categories'), {
      name, type, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    $('#in-cat-name').value = '';
  });

  // 串流
  unsubCats && unsubCats();
  const q = query(collection(db,'users',uid,'categories'), orderBy('createdAt','asc'));
  unsubCats = onSnapshot(q, snap=>{
    cachedCats = snap.docs.map(d=>({ id:d.id, ...(d.data()||{}) }));
    const expenseUL = $('#list-expense-cats');  expenseUL.innerHTML = '';
    const incomeUL  = $('#list-income-cats');   incomeUL.innerHTML  = '';

    if (snap.empty){
      expenseUL.innerHTML = `<li class="list-group-item muted">尚無分類</li>`;
      incomeUL.innerHTML  = `<li class="list-group-item muted">尚無分類</li>`;
      return;
    }

    snap.forEach(d=>{
      const v = d.data()||{};
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-center';
      li.innerHTML = `
        <span>${escapeHTML(v.name||'-')}</span>
        <button class="btn btn-sm btn-outline-danger">刪除</button>
      `;
      li.querySelector('button').onclick = async ()=>{
        if (!confirm(`刪除分類「${v.name}」？`)) return;
        await deleteDoc(doc(db,'users',uid,'categories',d.id));
      };
      (v.type==='income' ? incomeUL : expenseUL).appendChild(li);
    });
  }, err=>{
    $('#list-expense-cats').innerHTML = `<li class="list-group-item text-danger">載入失敗：${err.message}</li>`;
    $('#list-income-cats').innerHTML  = `<li class="list-group-item text-danger">載入失敗：${err.message}</li>`;
  });
}

// ==================== 預算：每月總額 + 分類預算 ====================
let unsubCatBudgets = null;

async function initBudget(){
  const uid = needUid(); if (!uid) return;

  // 1) 每月總預算（users/{uid}.settings.budget.monthly）
  await loadMonthlyBudget(uid);
  $('#btn-save-month-budget')?.addEventListener('click', async ()=>{
    const n = Number($('#in-month-budget').value||0);
    const uref = doc(db,'users',uid);
    await setDoc(uref, { settings:{ budget:{ monthly:n } } }, { merge:true });
    toast('已儲存每月總預算');
  });

  // 2) 分類下拉（來自 categories 的 cachedCats，如果還沒載到，等 categories 流完成）
  //   為避免 race condition，這裡多跑一次 get 最新 categories（簡化）
  const qCats = query(collection(db,'users',uid,'categories'), orderBy('createdAt','asc'));
  onSnapshot(qCats, snap=>{
    cachedCats = snap.docs.map(d=>({ id:d.id, ...(d.data()||{}) }));
    renderCatOptions();
  });

  // 3) 新增/更新分類預算
  $('#btn-add-cat-budget')?.addEventListener('click', async ()=>{
    const catId = $('#sel-budget-cat').value;
    if (!catId) return toast('請先建立類別');
    const amt = Number($('#in-budget-amt').value||0);
    if (amt < 0) return toast('金額需為非負數');

    // 用「類別ID」當唯一鍵：若存在就更新，不存在就新增
    // 為了簡單，docId 也使用 catId（同一類別只有一筆）
    const bref = doc(db,'users',uid,'category_budgets',catId);
    await setDoc(bref, {
      categoryId: catId,
      amount: amt,
      updatedAt: serverTimestamp(),
      // createdAt 只在新建時寫入
    }, { merge:true });

    // 若是新建，補 createdAt（merge 時不覆蓋）
    const now = await getDoc(bref);
    if (!now.data()?.createdAt){
      await updateDoc(bref, { createdAt: serverTimestamp() });
    }
  });

  // 4) 串流分類預算清單
  unsubCatBudgets && unsubCatBudgets();
  const qBud = query(collection(db,'users',uid,'category_budgets'), orderBy('createdAt','asc'));
  unsubCatBudgets = onSnapshot(qBud, snap=>{
    const ul = $('#list-cat-budgets'); ul.innerHTML = '';
    if (snap.empty){
      ul.innerHTML = `<li class="list-group-item muted">尚無分類預算</li>`;
      return;
    }
    snap.forEach(d=>{
      const v = d.data()||{};
      const catName = cachedCats.find(c=>c.id===v.categoryId)?.name || '(未知類別)';
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-center gap-2';
      li.innerHTML = `
        <div class="d-flex align-items-center gap-2 flex-wrap">
          <span class="badge text-bg-secondary">${escapeHTML(catName)}</span>
          <div class="input-group input-group-sm" style="max-width:220px">
            <span class="input-group-text">NT$</span>
            <input class="form-control" type="number" min="0" value="${v.amount||0}">
          </div>
        </div>
        <div class="btn-group">
          <button class="btn btn-sm btn-outline-primary">儲存</button>
          <button class="btn btn-sm btn-outline-danger">刪除</button>
        </div>
      `;
      const input = li.querySelector('input');
      li.querySelector('.btn-outline-primary').onclick = async ()=>{
        const val = Number(input.value||0);
        await updateDoc(doc(db,'users',uid,'category_budgets',d.id), {
          amount: val, updatedAt: serverTimestamp()
        });
        toast('已更新');
      };
      li.querySelector('.btn-outline-danger').onclick = async ()=>{
        if (!confirm(`刪除「${catName}」的分類預算？`)) return;
        await deleteDoc(doc(db,'users',uid,'category_budgets',d.id));
      };
      ul.appendChild(li);
    });
  }, err=>{
    $('#list-cat-budgets').innerHTML = `<li class="list-group-item text-danger">載入失敗：${err.message}</li>`;
  });
}

async function loadMonthlyBudget(uid){
  const snap = await getDoc(doc(db,'users',uid));
  const v = snap.data()?.settings?.budget?.monthly ?? '';
  $('#in-month-budget').value = (v || v===0) ? v : '';
}

function renderCatOptions(){
  const sel = $('#sel-budget-cat'); if (!sel) return;
  sel.innerHTML = '';
  if (!cachedCats.length){
    sel.innerHTML = `<option value="">（請先建立類別）</option>`;
    return;
  }
  cachedCats.forEach(c=>{
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = c.name + (c.type==='income'?'（收入）':'（支出）');
    sel.appendChild(opt);
  });
}

// ======= 輔助 =======
function escapeHTML(s){
  return String(s||'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}

// ======= 掛載 =======
(function mount(){
  const root = $('#app');
  renderShell(root);

  $$('#menu .list-group-item').forEach(btn=>{
    btn.addEventListener('click', ()=> show(btn.dataset.screen));
  });

  const go = ()=> show((location.hash||'').replace('#','') || 'ledgers');
  window.addEventListener('hashchange', go);
  go();
})();
