// assets/js/pages/expense.js（穩健版）
// 寫入 Firestore：/expenses/{email}/records/{autoId}
// 點擊時才等待 Auth 初始化，避免按鈕被鎖住

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
      <button class="primary btn btn-primary" id="add">新增</button>
    </div>
    <div class="small text-muted">快速鍵：右下角「＋」也會跳到此頁。</div>
  `;

  // 預設日期今天
  el.querySelector('#date').value = new Date().toISOString().slice(0,10);

  const dateInput = el.querySelector('#date');
  const itemInput = el.querySelector('#item');
  const catInput  = el.querySelector('#cat');
  const amtInput  = el.querySelector('#amt');
  const addBtn    = el.querySelector('#add');

  // 等待 Firebase Auth 準備好（最多等 timeoutMs 毫秒）
  function waitForUser(timeoutMs = 2000){
    return new Promise(resolve => {
      // 1) 立刻有就回傳
      if (auth.currentUser) return resolve(auth.currentUser);

      // 2) 監聽一次狀態變化
      const unSub = onAuthStateChanged(auth, u => {
        unSub && unSub();
        resolve(u || null);
      });

      // 3) 超時保底
      setTimeout(() => {
        try { unSub && unSub(); } catch {}
        resolve(auth.currentUser || null);
      }, timeoutMs);
    });
  }

  addBtn.addEventListener('click', async () => {
    // 等到 Auth 初始完成
    const user = await waitForUser(2000);
    if (!user || !user.email){
      alert('請先登入帳號再記帳');
      return;
    }

    const date  = dateInput.value;
    const item  = (itemInput.value || '').trim() || '未命名品項';
    const cat   = (catInput.value  || '').trim() || '其他';
    const amt   = parseFloat(amtInput.value || '0');

    if (!Number.isFinite(amt) || amt <= 0) {
      alert('金額需為正數');
      return;
    }

    const rec = { date, item, cat, amount: amt, source: 'form' };

    try {
      const email = user.email;

      // 先確保父文件存在（merge）
      await setDoc(
        doc(db, 'expenses', email),
        { email, updatedAt: serverTimestamp() },
        { merge: true }
      );

      // 寫入一筆記錄
      await addDoc(collection(db, 'expenses', email, 'records'), {
        ...rec,
        createdAt: serverTimestamp()
      });

      alert('✅ 已加入：' + rec.item);
      itemInput.value = '';
      catInput.value  = '';
      amtInput.value  = '';
    } catch (err) {
      console.error(err);
      alert('❌ 寫入失敗：' + (err?.message || err));
    }
  });

  return el;
}
