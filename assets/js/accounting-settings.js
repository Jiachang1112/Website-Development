// assets/js/pages/accounting-settings.js
// 完整記帳設定系統

import { auth, db } from '../firebase.js';
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp,
  collection, addDoc, deleteDoc, query, orderBy, getDocs, where
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';

// ========== 工具函數 ==========
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const toast = (msg, type='info') => {
  const colors = {info:'#3b82f6', success:'#10b981', error:'#ef4444', warning:'#f59e0b'};
  const div = document.createElement('div');
  div.textContent = msg;
  div.style.cssText = `position:fixed;top:80px;right:20px;background:${colors[type]};color:#fff;padding:14px 20px;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,0.4);z-index:9999;font-weight:600;animation:slideIn 0.3s ease;`;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
};

console.log('🚀 記帳設定系統啟動');

// ========== 狀態管理 ==========
let UID = null;
let currentLedgerId = null;

// ========== 取得預設帳本 ==========
async function getDefaultLedger() {
  if (!UID) return null;
  try {
    // 先找 isDefault = true
    const q1 = query(collection(db, 'users', UID, 'ledgers'), where('isDefault', '==', true));
    const snap1 = await getDocs(q1);
    if (!snap1.empty) return snap1.docs[0].id;
    
    // 沒有就取第一本
    const q2 = query(collection(db, 'users', UID, 'ledgers'), orderBy('createdAt', 'asc'));
    const snap2 = await getDocs(q2);
    return snap2.empty ? null : snap2.docs[0].id;
  } catch (error) {
    console.error('取得預設帳本失敗:', error);
    return null;
  }
}

// ========== 1. 管理帳本 ==========
async function renderLedgers() {
  const container = $('#app');
  if(!container) return;

  container.innerHTML = `
    <div class="settings-card">
      <h3>📒 管理帳本</h3>
      <div class="add-form">
        <input id="newLedgerName" placeholder="輸入新帳本名稱" class="form-input">
        <button id="btnAddLedger" class="btn btn-primary">新增帳本</button>
      </div>
      <div id="ledgerList" class="item-list">載入中...</div>
    </div>
  `;

  // 載入帳本列表
  await loadLedgerList();

  // 新增帳本
  $('#btnAddLedger').onclick = async () => {
    if(!UID) return toast('請先登入', 'error');
    const name = $('#newLedgerName').value.trim();
    if (!name) return toast('請輸入帳本名稱', 'warning');
    
    const ref = collection(db, 'users', UID, 'ledgers');
    const q = query(ref, orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);
    const isFirst = snap.empty;

    await addDoc(ref, {
      name,
      currency: 'TWD',
      members: { [UID]: 'owner' },
      isDefault: isFirst,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    $('#newLedgerName').value = '';
    toast('帳本已新增', 'success');
    loadLedgerList();
  };
}

async function loadLedgerList() {
  const list = $('#ledgerList');
  if(!list) return;
  list.innerHTML = '<div class="loading">正在載入帳本...</div>';
  
  if(!UID) {
     list.innerHTML = '<div class="empty">請先登入</div>';
     return;
  }

  try {
    const q = query(collection(db, 'users', UID, 'ledgers'), orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);

    if (snap.empty) {
      list.innerHTML = '<div class="empty">尚無帳本，請新增第一本帳本</div>';
      return;
    }

    list.innerHTML = '';
    snap.forEach(doc => {
      const data = doc.data();
      const item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML = `
        <div class="item-info">
          <div class="item-name">${data.name}</div>
          <div class="item-meta">貨幣: ${data.currency || 'TWD'} ${data.isDefault ? '<span class="badge-default">預設</span>' : ''}</div>
        </div>
        <div class="item-actions">
          <button class="btn-sm btn-secondary" onclick="window.selectLedger('${doc.id}')">選擇</button>
          <button class="btn-sm btn-danger" onclick="window.deleteLedger('${doc.id}', ${data.isDefault})">刪除</button>
        </div>
      `;
      list.appendChild(item);
    });

    // 設定當前帳本
    if (!currentLedgerId && !snap.empty) {
      currentLedgerId = snap.docs[0].id;
    }
  } catch (error) {
    console.error('❌ 載入帳本失敗:', error);
    list.innerHTML = `<div class="empty" style="color:#ef4444">載入失敗: ${error.message}</div>`;
  }
}

window.selectLedger = (id) => {
  currentLedgerId = id;
  toast('已切換帳本', 'success');
};

window.deleteLedger = async (id, isDefault) => {
  if (!confirm('確定刪除此帳本？')) return;
  
  await deleteDoc(doc(db, 'users', UID, 'ledgers', id));
  
  if (isDefault) {
    const q = query(collection(db, 'users', UID, 'ledgers'), orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);
    if (!snap.empty) {
      await updateDoc(doc(db, 'users', UID, 'ledgers', snap.docs[0].id), {
        isDefault: true,
        updatedAt: serverTimestamp()
      });
    }
  }
  
  toast('帳本已刪除', 'success');
  loadLedgerList();
};

// ========== 2. 管理預算 (已修正字體顏色) ==========
async function renderBudgets() {
  if (!currentLedgerId) currentLedgerId = await getDefaultLedger();
  const container = $('#app');
  
  if (!currentLedgerId) {
    container.innerHTML = '<div class="settings-card"><div class="empty">請先建立帳本</div></div>';
    return;
  }

  // ✅ 修正：input 加上 style="color:#1f2937"
  container.innerHTML = `
    <div class="settings-card">
      <h3>💰 管理預算</h3>
      <div class="add-form multi">
        <input id="budgetName" placeholder="預算名稱" class="form-input" style="color:#1f2937">
        <input id="budgetAmount" type="number" placeholder="金額" class="form-input" style="color:#1f2937">
        <input id="budgetStart" type="date" class="form-input" style="color:#1f2937">
        <input id="budgetEnd" type="date" class="form-input" style="color:#1f2937">
        <button id="btnAddBudget" class="btn btn-primary">新增</button>
      </div>
      <div id="budgetList" class="item-list">載入中...</div>
    </div>
  `;

  await loadBudgetList();

  $('#btnAddBudget').onclick = async () => {
    const name = $('#budgetName').value.trim();
    const amount = $('#budgetAmount').value;
    const start = $('#budgetStart').value;
    const end = $('#budgetEnd').value;

    if (!name || !amount || !start || !end) {
      return toast('請填寫完整資訊', 'warning');
    }

    await addDoc(collection(db, 'users', UID, 'ledgers', currentLedgerId, 'budgets'), {
      name,
      amount: Number(amount),
      period: 'custom',
      startAt: new Date(start + 'T00:00:00'),
      endAt: new Date(end + 'T23:59:59'),
      currency: 'TWD',
      rollover: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    $('#budgetName').value = '';
    $('#budgetAmount').value = '';
    $('#budgetStart').value = '';
    $('#budgetEnd').value = '';
    toast('預算已新增', 'success');
    loadBudgetList();
  };
}

async function loadBudgetList() {
  const list = $('#budgetList');
  if(!list) return;
  
  const q = query(collection(db, 'users', UID, 'ledgers', currentLedgerId, 'budgets'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);

  if (snap.empty) {
    list.innerHTML = '<div class="empty">尚無預算</div>';
    return;
  }

  list.innerHTML = '';
  snap.forEach(doc => {
    const data = doc.data();
    const start = data.startAt?.toDate?.()?.toLocaleDateString('zh-TW') || '---';
    const end = data.endAt?.toDate?.()?.toLocaleDateString('zh-TW') || '---';
    
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="item-info">
        <div class="item-name">${data.name}</div>
        <div class="item-meta">NT$ ${data.amount?.toLocaleString()} | ${start} ~ ${end}</div>
      </div>
      <button class="btn-sm btn-danger" onclick="window.deleteBudget('${doc.id}')">刪除</button>
    `;
    list.appendChild(item);
  });
}

window.deleteBudget = async (id) => {
  if (!confirm('確定刪除此預算？')) return;
  await deleteDoc(doc(db, 'users', UID, 'ledgers', currentLedgerId, 'budgets', id));
  toast('預算已刪除', 'success');
  loadBudgetList();
};

// ========== 3. 管理類型 (已修正字體顏色) ==========
async function renderCategories() {
  if (!currentLedgerId) currentLedgerId = await getDefaultLedger();
  const container = $('#app');
  
  if (!currentLedgerId) {
    container.innerHTML = '<div class="settings-card"><div class="empty">請先建立帳本</div></div>';
    return;
  }

  // ✅ 修正：input 加上 style="color:#1f2937"
  container.innerHTML = `
    <div class="settings-card">
      <h3>🏷️ 管理類型</h3>
      <div class="category-tabs">
        <button class="tab-btn active" data-type="expense">支出類型</button>
        <button class="tab-btn" data-type="income">收入類型</button>
      </div>
      <div class="add-form">
        <input id="categoryName" placeholder="類型名稱" class="form-input" style="color:#1f2937">
        <button id="btnAddCategory" class="btn btn-primary">新增</button>
      </div>
      <div id="categoryList" class="item-list">載入中...</div>
    </div>
  `;

  let currentType = 'expense';

  const loadList = async () => {
    const list = $('#categoryList');
    const q = query(collection(db, 'users', UID, 'ledgers', currentLedgerId, 'categories'), orderBy('order', 'asc'));
    const snap = await getDocs(q);

    const filtered = snap.docs.filter(doc => doc.data().type === currentType);

    if (filtered.length === 0) {
      list.innerHTML = '<div class="empty">尚無類型</div>';
      return;
    }

    list.innerHTML = '';
    filtered.forEach(doc => {
      const data = doc.data();
      const item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML = `
        <div class="item-info">
          <span class="color-dot" style="background:${data.color || '#60a5fa'}"></span>
          <div class="item-name">${data.name}</div>
        </div>
        <button class="btn-sm btn-danger" onclick="window.deleteCategory('${doc.id}')">刪除</button>
      `;
      list.appendChild(item);
    });
  };

  await loadList();

  // 切換分頁
  $$('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      $$('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentType = btn.dataset.type;
      loadList();
    };
  });

  // 新增類型
  $('#btnAddCategory').onclick = async () => {
    const name = $('#categoryName').value.trim();
    if (!name) return toast('請輸入類型名稱', 'warning');

    await addDoc(collection(db, 'users', UID, 'ledgers', currentLedgerId, 'categories'), {
      name,
      type: currentType,
      order: Date.now(),
      color: currentType === 'expense' ? '#ef4444' : '#10b981',
      parentId: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    $('#categoryName').value = '';
    toast('類型已新增', 'success');
    loadList();
  };

  window.deleteCategory = async (id) => {
    if (!confirm('確定刪除此類型？')) return;
    await deleteDoc(doc(db, 'users', UID, 'ledgers', currentLedgerId, 'categories', id));
    toast('類型已刪除', 'success');
    loadList();
  };
}

// ========== 4. 管理貨幣 (已修正字體顏色) ==========
async function renderCurrency() {
  const container = $('#app');
  container.innerHTML = `
    <div class="settings-card">
      <h3>💱 管理貨幣</h3>
      <div class="add-form multi">
        <input id="currencyCode" placeholder="幣別代碼 (USD)" class="form-input" maxlength="3" style="color:#1f2937">
        <input id="currencyRate" type="number" step="0.0001" placeholder="對 TWD 匯率 (例: 0.033)" class="form-input" style="color:#1f2937">
        <button id="btnAddRate" class="btn btn-primary">新增匯率</button>
      </div>
      <div class="tip">💡 範例：USD 匯率 0.033 表示 1 TWD ≈ 0.033 USD</div>
      <div id="rateList" class="item-list">載入中...</div>
    </div>
  `;

  await loadRateList();

  $('#btnAddRate').onclick = async () => {
    const code = $('#currencyCode').value.trim().toUpperCase();
    const rate = $('#currencyRate').value.trim();

    if (!code || !rate) return toast('請填寫完整資訊', 'warning');
    if (code.length !== 3) return toast('幣別代碼需為 3 個字元', 'warning');

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

    $('#currencyCode').value = '';
    $('#currencyRate').value = '';
    toast('匯率已新增', 'success');
    loadRateList();
  };
}

async function loadRateList() {
  const list = $('#rateList');
  if (!UID) { list.innerHTML = '<div class="empty">請先登入</div>'; return; }

  const userRef = doc(db, 'users', UID);
  const snap = await getDoc(userRef);
  const rates = snap.data()?.settings?.currencies?.rates || {};

  if (Object.keys(rates).length === 0) {
    list.innerHTML = '<div class="empty">尚無自訂匯率</div>';
    return;
  }

  list.innerHTML = '';
  Object.entries(rates).forEach(([code, rate]) => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="item-info">
        <div class="item-name">${code}</div>
        <div class="item-meta">1 TWD = ${rate} ${code}</div>
      </div>
      <button class="btn-sm btn-danger" onclick="window.deleteRate('${code}')">刪除</button>
    `;
    list.appendChild(item);
  });

  window.deleteRate = async (code) => {
    if (!confirm(`確定刪除 ${code} 匯率？`)) return;
    
    const userRef = doc(db, 'users', UID);
    const snap = await getDoc(userRef);
    const rates = snap.data()?.settings?.currencies?.rates || {};
    delete rates[code];

    await updateDoc(userRef, {
      'settings.currencies.rates': rates,
      updatedAt: serverTimestamp()
    });

    toast('匯率已刪除', 'success');
    loadRateList();
  };
}

// ========== 5. 聊天設定 ==========
async function renderChat() {
  const container = $('#app');
  container.innerHTML = `
    <div class="settings-card">
      <h3>💬 聊天設定</h3>
      <div class="form-group">
        <label>AI 角色</label>
        <select id="persona" class="form-select" style="color:#1f2937">
          <option value="minimal">極簡會計師</option>
          <option value="friendly">溫暖助手</option>
          <option value="strict">嚴格教練</option>
        </select>
      </div>
      <div class="form-group">
        <label>自訂描述</label>
        <textarea id="personaCustom" class="form-textarea" rows="3" placeholder="可選填，描述語氣、風格..." style="color:#1f2937"></textarea>
      </div>
      <div class="form-check">
        <input type="checkbox" id="cmdEnabled">
        <label for="cmdEnabled">啟用快速指令 (/add /sum /budget)</label>
      </div>
      <button id="btnSaveChat" class="btn btn-primary">儲存設定</button>
    </div>
  `;

  const userRef = doc(db, 'users', UID);
  const snap = await getDoc(userRef);
  const chat = snap.data()?.settings?.chat || {};

  $('#persona').value = chat.persona || 'minimal';
  $('#personaCustom').value = chat.custom || '';
  $('#cmdEnabled').checked = chat.commandsEnabled !== false;

  $('#btnSaveChat').onclick = async () => {
    await updateDoc(userRef, {
      'settings.chat': {
        persona: $('#persona').value,
        custom: $('#personaCustom').value,
        commandsEnabled: $('#cmdEnabled').checked
      },
      updatedAt: serverTimestamp()
    });
    toast('聊天設定已儲存', 'success');
  };
}

// ========== 6. 一般設定 ==========
async function renderGeneral() {
  const container = $('#app');
  container.innerHTML = `
    <div class="settings-card">
      <h3>⚙️ 一般設定</h3>
      <div class="form-group">
        <label>每日提醒</label>
        <div class="form-check">
          <input type="checkbox" id="remindEnabled">
          <label for="remindEnabled">啟用每日記帳提醒</label>
        </div>
      </div>
      <div class="form-group">
        <label>提醒時間</label>
        <input type="time" id="remindTime" class="form-input" value="21:00" style="color:#1f2937">
      </div>
      <button id="btnSaveGeneral" class="btn btn-primary">儲存設定</button>
    </div>
  `;

  const userRef = doc(db, 'users', UID);
  const snap = await getDoc(userRef);
  const general = snap.data()?.settings?.general || {};

  $('#remindEnabled').checked = general.reminderEnabled || false;
  $('#remindTime').value = general.reminderTime || '21:00';

  $('#btnSaveGeneral').onclick = async () => {
    await updateDoc(userRef, {
      'settings.general': {
        reminderEnabled: $('#remindEnabled').checked,
        reminderTime: $('#remindTime').value
      },
      updatedAt: serverTimestamp()
    });
    toast('一般設定已儲存', 'success');
  };
}

// ========== 路由系統 ==========
const routes = {
  ledgers: renderLedgers,
  budget: renderBudgets,
  categories: renderCategories,
  currency: renderCurrency,
  chat: renderChat,
  general: renderGeneral
};

function route() {
  const hash = location.hash.replace('#', '') || 'ledgers';
  const handler = routes[hash] || renderLedgers;
  
  // 更新按鈕狀態
  $$('[data-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === hash);
  });
  
  handler();
}

// ========== 初始化 ==========
(async function init() {
  console.log('🚀 記帳設定系統啟動');
  
  // 監聽 Auth 狀態
  onAuthStateChanged(auth, (user) => {
    if (user) {
      UID = user.uid;
      console.log('✅ UID 已設定:', UID);
      
      // 登入後觸發路由渲染
      if (!location.hash) location.hash = '#ledgers';
      route();
    } else {
      UID = null;
      const app = $('#app');
      if (app) app.innerHTML = '<div class="settings-card"><div class="empty">請先登入帳號</div></div>';
    }
  });
  
  // 監聽 hash 變化
  window.addEventListener('hashchange', () => {
    if (UID) route(); 
  });
})();
