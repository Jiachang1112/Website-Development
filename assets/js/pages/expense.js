// assets/js/pages/expense.js（Auth + localStorage 兼容 / 金額欄可自由輸入）
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
      <!-- 金額欄：改 text + inputmode 讓各裝置都能輸入 -->
      <input id="amt" type="text" inputmode="decimal" placeholder="金額" class="form-control"/>
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

  // 金額輸入即時清理：只保留數字、小數點與逗號（會在解析時統一成 .）
  amtInput.addEventListener('input', () => {
    amtInput.value = amtInput.value.replace(/[^\d.,\-]/g, '');
  });

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

      setTimeout(() => {
        if (done) return;
        done = true;
        try { unSub && unSub(); } catch {}
        resolve(getActiveEmailNow()); // 可能為 null
      }, timeoutMs);
    });
  }

  // 解析金額（支援逗號小數、千分位）
  function parseAmount(v){
    if (!v) return NaN;
    // 若同時有 . 與 ,：推測千分位 + 小數符號，保留最後一個做為小數點
    let s = String(v).trim();
    // 移除空白與千分位
    s = s.replace(/\s/g,'').replace(/,/g,'.'); // 直接把逗號當小數點
    // 僅保留數字、小數點與負號（最前）
    s = s.replace(/[^\d.\-]/g,'');
    // 若有多個小數點，只取第一個
    const firstDot = s.indexOf('.');
    if (firstDot !== -1){
      s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g,'');
    }
    return parseFloat(s);
  }

  async function saveExpense(email, rec){
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
    const amt   = parseAmount(amtInput.value);

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
