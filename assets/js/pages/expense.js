// assets/js/pages/expense.js（與聊天記帳一致：Auth + localStorage 兼容）
// Firestore 路徑：/expenses/{email}/records/{autoId}

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

  // 取得目前可用的 email：先 Firebase，再退回 localStorage.session_user
  function getActiveEmailNow(){
    if (auth && auth.currentUser && auth.currentUser.email) return auth.currentUser.email;
    try{
      const s = JSON.parse(localStorage.getItem('session_user') || 'null');
      if (s && s.email) return s.email;
    }catch{}
    return null;
  }

  // 點擊時最多等待 2 秒，給 Firebase Auth 一次機會；若仍無，回退 localStorage
  function waitEmail(timeoutMs = 2000){
    return new Promise(resolve => {
      const immediate = getActiveEmailNow();
      if (immediate) return resolve(immediate);

      let done = false;
      const unSub = onAuthStateChanged(auth, u => {
        if (done) return;
        if (u && u.email){ done = true; unSub && unSub(); resolve(u.email); }
      });

      // 超時使用 localStorage 回退
      setTimeout(() => {
        if (done) return;
        done = true;
        try { unSub && unSub(); } catch {}
        resolve(getActiveEmailNow()); // 可能為 null，外層會再檢查
      }, timeoutMs);
    });
  }

  async function saveExpense(email, rec){
    // 先確保父文件存在
    await setDoc(
      doc(db, 'expenses', email),
      { email, updatedAt: serverTimestamp() },
      { merge: true }
    );
    // 新增一筆記錄
    await addDoc(collection(db, 'expenses', email, 'records'), {
      ...rec,
      source: 'form',
      createdAt: serverTimestamp()
    });
  }

  addBtn.addEventListener('click', async () => {
    const email = await waitEmail(2000);
    if (!email){
      alert('請先登入帳號再記帳');
      return;
    }

    const date  = dateInput.value;
    const item  = (itemInput.value || '').trim() || '未命名品項';
    const cat   = (catInput.value  || '').trim() || '其他';
    const amt   = parseFloat(amtInput.value || '0');

    if (!Number.isFinite(amt) || amt <= 0){
      alert('金額需為正數');
      return;
    }

    try{
      await saveExpense(email, { date, item, cat, amount: amt });
      alert('✅ 已加入：' + item);
      itemInput.value = '';
      catInput.value  = '';
      amtInput.value  = '';
    }catch(err){
      console.error(err);
      alert('❌ 寫入失敗：' + (err?.message || err));
    }
  });

  return el;
}
