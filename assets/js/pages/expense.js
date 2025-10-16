// assets/js/pages/expense.js（改寫版）
// 寫入 Firestore：/expenses/{email}/records/{autoId}

import { auth, db } from '../firebase.js';
import { collection, addDoc, doc, setDoc, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

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
      <button class="primary btn btn-primary" id="add">新增</button>
    </div>
    <div class="small text-muted">快速鍵：右下角「＋」也會跳到此頁。</div>
  `;

  // 預設日期為今天
  const today = new Date();
  el.querySelector('#date').value = today.toISOString().slice(0,10);

  const dateInput = el.querySelector('#date');
  const itemInput = el.querySelector('#item');
  const catInput  = el.querySelector('#cat');
  const amtInput  = el.querySelector('#amt');

  el.querySelector('#add').addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) {
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
      // 建立 /expenses/{email}
      const email = user.email;
      await setDoc(
        doc(db, 'expenses', email),
        { email, updatedAt: serverTimestamp() },
        { merge: true }
      );

      // 寫入 /expenses/{email}/records
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
