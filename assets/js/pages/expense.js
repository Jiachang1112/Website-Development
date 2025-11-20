// assets/js/pages/expense.js
import { auth, db } from '../firebase.js';
import { 
  collection, addDoc, getDocs, query, orderBy, serverTimestamp, where, doc
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

// 硬編碼的類別（暫時保留，未來可改為讀取帳本設定的類別）
const categories = [
  '飲食', '交通', '娛樂', '購物', 
  '居住', '醫療', '教育', '其他'
];

export function ExpensePage(){
  const el = document.createElement('div');
  el.className = 'container';
  
  // 取得當前時間
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].slice(0,5);

  el.innerHTML = `
    <section class="card">
      <h3>新增支出</h3>
      
      <div class="row">
        <div class="col-6 p-1">
          <small class="muted">日期</small>
          <input type="date" id="txDate" class="form-control" value="${dateStr}">
        </div>
        <div class="col-6 p-1">
          <small class="muted">時間</small>
          <input type="time" id="txTime" class="form-control" value="${timeStr}">
        </div>
      </div>

      <div class="p-1">
        <small class="muted">帳本</small>
        <select id="txLedger" class="form-control">
          <option value="" disabled>載入中...</option>
        </select>
      </div>

      <div class="p-1">
        <small class="muted">金額</small>
        <input type="number" id="txAmount" class="form-control" inputmode="decimal" placeholder="0">
      </div>

      <div class="p-1">
        <small class="muted">類別</small>
        <div id="tagContainer" class="tags-input-container">
          </div>
        <input type="hidden" id="txCategory">
      </div>

      <div class="row" style="margin-top:20px">
        <button id="btnSubmit" class="btn btn-primary" style="width:100%; padding:12px; font-size:16px; font-weight:bold;">
          儲存支出
        </button>
      </div>
    </section>
  `;

  // 1. 初始化類別按鈕
  const tagContainer = el.querySelector('#tagContainer');
  const catInput = el.querySelector('#txCategory');
  
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'tag-btn';
    btn.textContent = cat;
    btn.onclick = () => {
      // 移除其他 active
      el.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
      // 自己 active
      btn.classList.add('active');
      catInput.value = cat;
    };
    tagContainer.appendChild(btn);
  });
  // 預設選第一個
  if(tagContainer.firstChild) tagContainer.firstChild.click();


  // 2. 載入使用者的帳本列表
  const ledgerSelect = el.querySelector('#txLedger');
  
  async function loadUserLedgers(user) {
    if(!user) return;
    
    try {
      const q = query(
        collection(db, 'users', user.uid, 'ledgers'), 
        orderBy('createdAt', 'asc')
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        // 如果沒帳本，建立一個預設的 (防呆)
        ledgerSelect.innerHTML = '<option value="default" selected>預設帳本</option>';
        return;
      }

      ledgerSelect.innerHTML = ''; // 清空 Loading
      let defaultLedgerId = null;

      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const opt = document.createElement('option');
        opt.value = docSnap.id;
        opt.textContent = data.name || '(未命名帳本)';
        
        // 檢查是否為預設
        if (data.isDefault) defaultLedgerId = docSnap.id;
        
        ledgerSelect.appendChild(opt);
      });

      // 如果有找到預設帳本，就選它；否則選第一個
      if (defaultLedgerId) {
        ledgerSelect.value = defaultLedgerId;
      } else if (ledgerSelect.options.length > 0) {
        ledgerSelect.selectedIndex = 0;
      }

    } catch (err) {
      console.error("載入帳本失敗", err);
      ledgerSelect.innerHTML = '<option disabled>無法載入帳本</option>';
    }
  }

  // 監聽登入狀態來載入帳本
  auth.onAuthStateChanged(user => {
    if (user) {
      loadUserLedgers(user);
    } else {
      ledgerSelect.innerHTML = '<option disabled>請先登入</option>';
    }
  });


  // 3. 儲存按鈕邏輯
  const btnSubmit = el.querySelector('#btnSubmit');
  btnSubmit.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) {
      alert('請先登入');
      return;
    }

    const date = el.querySelector('#txDate').value;
    const time = el.querySelector('#txTime').value; // 沒用到但可擴充
    const ledgerId = ledgerSelect.value;
    const amount = el.querySelector('#txAmount').value;
    const category = catInput.value;

    if (!ledgerId) { alert('請選擇帳本'); return; }
    if (!amount || Number(amount) <= 0) { alert('請輸入有效金額'); return; }
    if (!category) { alert('請選擇類別'); return; }

    // 鎖定按鈕避免重複發送
    btnSubmit.disabled = true;
    btnSubmit.textContent = '儲存中...';

    try {
      // ✅ 寫入到新結構：users/{uid}/ledgers/{ledgerId}/entries
      const entriesRef = collection(db, 'users', user.uid, 'ledgers', ledgerId, 'entries');
      
      await addDoc(entriesRef, {
        type: 'expense',
        date: date, // YYYY-MM-DD
        amount: Number(amount),
        categoryId: category,
        // note: '', // 原本的品項欄位已移除，這裡留空或移除
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      alert('支出已儲存！');
      
      // 清空金額，保留其他選項方便連續記帳
      el.querySelector('#txAmount').value = '';
      
    } catch (e) {
      console.error('寫入失敗', e);
      alert('儲存失敗：' + e.message);
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = '儲存支出';
    }
  });

  return el;
}
