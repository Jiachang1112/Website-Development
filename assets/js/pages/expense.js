// assets/js/pages/expense.js（Firestore 版）
// 寫入路徑：/expenses/{email}/records/{autoId}

import { auth, db } from '../firebase.js';
import { collection, addDoc, doc, setDoc, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

export function ExpensePage(){
  const el = document.createElement('div');
  el.className = 'container card';
  el.innerHTML = `
    <h3>支出</h3>
    <div class="row">
      <input id="date" type="date"/>
      <input id="item" placeholder="品項"/>
      <input id="cat" placeholder="分類"/>
      <input id="amt" type="number" placeholder="金額"/>
      <button class="primary" id="add">新增</button>
    </div>
    <div class="small">快速鍵：右下角「＋」也會跳到此頁。</div>
  `;

  // 預設日期為今天
  const d = new Date();
  el.querySelector('#date').value = d.toISOString().slice(0,10);

  el.querySelector('#add').addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) { alert('請先登入'); return; }

    const date = el.querySelector('#date').value;
    const item = el.querySelector('#item').value.trim() || '未命名品項';
    const cat  = el.querySelector('#cat').value.trim()  || '其他';
    const amt  = parseFloat(el.querySelector('#amt').value || '0');
    if (!amt || amt < 0) { alert('金額需為正數'); return; }

    const rec = { date, item, cat, amount: amt, source: 'form' };

    try {
      // 確保 /expenses/{email} 文件存在
      const email = user.email;
      await setDoc(
        doc(db, 'expenses', email),
        { email, updatedAt: serverTimestamp() },
        { merge: true }
      );

      // 新增一筆到 /expenses/{email}/records
      await addDoc(collection(db, 'expenses', email, 'records'), {
        ...rec,
        createdAt: serverTimestamp()
      });

      alert('✅ 已加入：' + rec.item);
      el.querySelector('#item').value = '';
      el.querySelector('#cat').value  = '';
      el.querySelector('#amt').value  = '';
    } catch (err) {
      console.error(err);
      alert('❌ 寫入失敗：' + err.message);
    }
  });

  return el;
}
