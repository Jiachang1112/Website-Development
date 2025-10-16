// assets/js/pages/expense.js
// Firestore: /expenses/{email}/records/{autoId}
// - 日期：改成 年/月/日 <select>（2020~3000，自動判斷天數）
// - 金額：text+inputmode=decimal，程式端安全解析
// - 登入：先取 Firebase Auth，再回退 localStorage.session_user

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
      <!-- 日期選擇：年 / 月 / 日 -->
      <select id="year" class="form-control" style="min-width:110px"></select>
      <select id="month" class="form-control" style="min-width:90px"></select>
      <select id="day" class="form-control" style="min-width:90px"></select>

      <input id="item" placeholder="品項" class="form-control"/>
      <input id="cat" placeholder="分類" class="form-control"/>

      <!-- 金額欄：text + inputmode 讓裝置都能輸入 -->
      <input id="amt" type="text" inputmode="decimal" placeholder="金額" class="form-control"/>
      <button class="primary btn btn-primary" id="add">新增</button>
    </div>
    <div class="small text-muted">快速鍵：右下角「＋」也會跳到此頁。</div>
  `;

  // === 取得節點 ===
  const yearSel = el.querySelector('#year');
  const monthSel = el.querySelector('#month');
  const daySel = el.querySelector('#day');

  const itemInput = el.querySelector('#item');
  const catInput  = el.querySelector('#cat');
  const amtInput  = el.querySelector('#amt');
  const addBtn    = el.querySelector('#add');

  // === 日期選單：2020 ~ 3000，預設今天 ===
  function pad2(n){ return String(n).padStart(2,'0'); }
  function daysInMonth(y, m){ return new Date(y, m, 0).getDate(); } // m: 1..12

  function fillYears(){
    const start = 2020, end = 3000;
    const frag = document.createDocumentFragment();
    for(let y = start; y <= end; y++){
      const o = document.createElement('option');
      o.value = String(y);
      o.textContent = String(y);
      frag.appendChild(o);
    }
    yearSel.appendChild(frag);
  }
  function fillMonths(){
    const frag = document.createDocumentFragment();
    for(let m = 1; m <= 12; m++){
      const o = document.createElement('option');
      o.value = pad2(m);
      o.textContent = pad2(m);
      frag.appendChild(o);
    }
    monthSel.appendChild(frag);
  }
  function fillDays(y, m){
    daySel.innerHTML = '';
    const dmax = daysInMonth(Number(y), Number(m));
    const frag = document.createDocumentFragment();
    for(let d = 1; d <= dmax; d++){
      const o = document.createElement('option');
      o.value = pad2(d);
      o.textContent = pad2(d);
      frag.appendChild(o);
    }
    daySel.appendChild(frag);
  }

  // 初始化日期
  (function initDate(){
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth()+1;
    const d = now.getDate();
    fillYears();
    fillMonths();
    yearSel.value  = String(Math.min(3000, Math.max(2020, y)));
    monthSel.value = pad2(m);
    fillDays(yearSel.value, monthSel.value);
    daySel.value   = pad2(d);
  })();

  // 任何年/月變更都重算該月天數；若原本的日 > 新月份上限，會自動設為最後一天
  function syncDays(){
    const prevDay = Number(daySel.value || '1');
    fillDays(yearSel.value, monthSel.value);
    const max = Number(daySel.options[daySel.options.length-1].value);
    daySel.value = pad2(Math.min(prevDay, max));
  }
  yearSel.addEventListener('change', syncDays);
  monthSel.addEventListener('change', syncDays);

  // === 金額輸入即時清理 ===
  amtInput.addEventListener('input', () => {
    amtInput.value = amtInput.value.replace(/[^\d.,\-]/g, '');
  });

  // === 取得登入 email：Firebase -> localStorage 回退 ===
  function getActiveEmailNow(){
    if (auth && auth.currentUser && auth.currentUser.email) return auth.currentUser.email;
    try{
      const s = JSON.parse(localStorage.getItem('session_user') || 'null');
      if (s && s.email) return s.email;
    }catch{}
    return null;
  }
  function waitEmail(timeoutMs = 2000){
    return new Promise(resolve => {
      const now = getActiveEmailNow();
      if (now) return resolve(now);

      let done = false;
      const unSub = onAuthStateChanged(auth, u => {
        if (done) return;
        if (u && u.email){ done = true; unSub && unSub(); resolve(u.email); }
      });
      setTimeout(() => {
        if (done) return;
        done = true;
        try{ unSub && unSub(); }catch{}
        resolve(getActiveEmailNow());
      }, timeoutMs);
    });
  }

  // === 解析金額（支援逗號小數/千分位） ===
  function parseAmount(v){
    if (!v) return NaN;
    let s = String(v).trim();
    s = s.replace(/\s/g,'').replace(/,/g,'.');   // 把逗號視為小數點
    s = s.replace(/[^\d.\-]/g,'');               // 僅保留數字 . 負號
    const firstDot = s.indexOf('.');
    if (firstDot !== -1){
      s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g,'');
    }
    return parseFloat(s);
  }

  // === Firestore 寫入 ===
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

  // === 新增 ===
  addBtn.addEventListener('click', async () => {
    const email = await waitEmail(2000);
    if (!email){
      alert('請先登入帳號再記帳');
      return;
    }

    const date  = `${yearSel.value}-${monthSel.value}-${daySel.value}`;
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
