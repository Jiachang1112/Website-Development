// assets/js/pages/expense.js（修正版）
// 等待 Firebase Auth 初始化後再啟用新增功能

import { auth, db } from '../firebase.js';
import { collection, addDoc, doc, setDoc, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';
import { onAuthStateChanged } 
  from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';

export function ExpensePage(){
  const el = document.createElement('div');
  el.className = 'container card';
  el.innerHTML = `
    <h3>支出記帳</h3>
    <div class="row" style="gap:6px; margin-bottom:8px">
      <input id="date" type="date" class="form-control"/>
      <input id="item" placeholder="品項" class="form-control"/>
      <input id="cat" placeholder="分類" class="form-control"/>
      <input id="amt" type="number" placeholder="金額" class="form-control"/>
      <button class="primary btn btn-primary" id="add" disabled>新增</button>
    </div>
    <div class="small text-muted">快速鍵：右下角「＋」也會跳到此頁。</div>
  `;

  // 預設日期為今天
  el.querySelector('#date').value = new Date().toISOString().slice(0,10);

  const dateInput = el.querySelector('#date');
  const itemInput = el.querySelector('#item');
  const catInput  = el.querySelector('#cat');
  const amtInput  = el.querySelector('#amt');
  const addBtn    = el.querySelector('#add');

  let currentUser = null;

  // 監聽登入狀態
  onAuthStateChanged(auth, user => {
    if (user && user.email) {
      currentUser = user;
      addBtn.disabled = false;
      console.log('✅ 登入中：', user.email);
    } else {
      currentUser = null;
      addBtn.disabled = true;
      console.log('⚠️ 尚未登入');
    }
  });

  addBtn.addEventListener('click', async () => {
    if (!currentUser) {
      alert('請先登入帳號再記帳');
      return;
    }

    const date  = dateInput.value;
    const item  = itemInput.value.trim() || '未命名品項';
    const cat   = catInput.value.trim()  || '其他';
    const amt   = parseFloat(amtInput.value || '0');

    if (!amt || amt <= 0) {
      alert('金額需為正數');
      return;
    }

    const rec = { date, item, cat, amount: amt };

    try {
      const email = currentUser.email;
      await setDoc(
        doc(db, 'expenses', email),
        { email, updatedAt: serverTimestamp() },
        { merge: true }
      );

      await addDoc(collection(db, 'expenses', email, 'records'), {
        ...rec,
        source: 'form',
        createdAt: serverTimestamp()
      });

      alert('✅ 已加入：' + rec.item);
      itemInput.value = '';
      catInput.value  = '';
      amtInput.value  = '';
    } catch (err) {
      console.error(err);
      alert('❌ 寫入失敗：' + (err.message || err));
    }
  });

  return el;
}
