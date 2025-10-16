// assets/js/pages/expense.js
// Firestore: /expenses/{email}/records/{autoId}
// 7 欄位：date(YYYY-MM-DD), party, item, categoryId, amount, type, note
// 登入偵測：先 Firebase Auth，再回退 localStorage.session_user

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
      <!-- 日期：年 / 月 / 日 -->
      <select id="year" class="form-control" style="min-width:110px"></select>
      <select id="month" class="form-control" style="min-width:90px"></select>
      <select id="day" class="form-control" style="min-width:90px"></select>

      <!-- 來客 / 對象 -->
      <input id="party" placeholder="來客 / 對象" class="form-control"/>

      <!-- 品項 -->
      <input id="item" placeholder="品項" class="form-control"/>

      <!-- 分類 -->
      <input id="categoryId" placeholder="分類" class="form-control"/>

      <!-- 金額：text + inputmode，前端清理 -->
      <input id="amount" type="text" inputmode="decimal" placeholder="金額" class="form-control"/>

      <!-- 類型 -->
      <select id="type" class="form-control" style="min-width:120px">
        <option value="expense" selected>支出（expense）</option>
        <option value="income">收入（income）</option>
      </select>

      <!-- 備註 -->
      <input id="note" placeholder="備註" class="form-control"/>

      <button class="primary btn btn-primary" id="add">新增</button>
    </div>

    <div class="small text-muted">快速鍵：右下角「＋」也會跳到此頁。</div>
  `;

  // 取得節點
  const ySel = el.querySelector('#year');
  const mSel = el.querySelector('#month');
  const dSel = el.querySelector('#day');

  const partyInput = el.querySelector('#party');
  const itemInput  = el.querySelector('#item');
  const catInput   = el.querySelector('#categoryId');
  const amtInput   = el.querySelector('#amount');
  const typeSel    = el.querySelector('#type');
  const noteInput  = el.querySelector('#note');
  const addBtn     = el.querySelector('#add');

  // ===== 日期選單（2020~3000，自動判斷天數） =====
  const pad2 = n => String(n).padStart(2,'0');
  const daysInMonth = (y, m) => new Date(y, m, 0).getDate(); // m:1..12

  function fillYears(){
    const frag = document.createDocumentFragment();
    for(let y=2020; y<=3000; y++){
      const o = document.createElement('option');
      o.value = String(y); o.textContent = String(y);
      frag.appendChild(o);
    }
    ySel.appendChild(frag);
  }
  function fillMonths(){
    const frag = document.createDocumentFragment();
    for(let m=1; m<=12; m++){
      const o = document.createElement('option');
      o.value = pad2(m); o.textContent = pad2(m);
      frag.appendChild(o);
    }
    mSel.appendChild(frag);
  }
  function fillDays(y, m){
    dSel.innerHTML = '';
    const max = daysInMonth(Number(y), Number(m));
    const frag = document.createDocumentFragment();
    for(let d=1; d<=max; d++){
      const o = document.createElement('option');
      o.value = pad2(d); o.textContent = pad2(d);
      frag.appendChild(o);
    }
    dSel.appendChild(frag);
  }
  (function initDate(){
    const now = new Date();
    fillYears(); fillMonths();
    ySel.value = String(Math.min(3000, Math.max(2020, now.getFullYear())));
    mSel.value = pad2(now.getMonth()+1);
    fillDays(ySel.value, mSel.value);
    dSel.value = pad2(now.getDate());
  })();
  function syncDays(){
    const prev = Number(dSel.value || '1');
    fillDays(ySel.value, mSel.value);
    const last = Number(dSel.options[dSel.options.length-1].value);
    dSel.value = pad2(Math.min(prev, last));
  }
  ySel.addEventListener('change', syncDays);
  mSel.addEventListener('change', syncDays);

  // ===== 金額清理（允許逗號與小數） =====
  amtInput.addEventListener('input', () => {
    amtInput.value = amtInput.value.replace(/[^\d.,\-]/g,'');
  });
  function parseAmount(v){
    if (!v) return NaN;
    let s = String(v).trim().replace(/\s/g,'').replace(/,/g,'.').replace(/[^\d.\-]/g,'');
    const i = s.indexOf('.');
    if (i !== -1) s = s.slice(0,i+1) + s.slice(i+1).replace(/\./g,'');
    return parseFloat(s);
  }

  // ===== 取得 email：Auth -> localStorage =====
  function activeEmailNow(){
    if (auth?.currentUser?.email) return auth.currentUser.email;
    try{
      const s = JSON.parse(localStorage.getItem('session_user')||'null');
      if (s?.email) return s.email;
    }catch{}
    return null;
  }
  function waitEmail(timeoutMs=2000){
    return new Promise(resolve=>{
      const now = activeEmailNow();
      if (now) return resolve(now);
      let done = false;
      const stop = onAuthStateChanged(auth, u=>{
        if (done) return;
        if (u?.email){ done=true; stop&&stop(); resolve(u.email); }
      });
      setTimeout(()=>{ if (!done){ done=true; try{stop&&stop();}catch{} resolve(activeEmailNow()); } }, timeoutMs);
    });
  }

  // ===== Firestore 寫入 =====
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

  // ===== 新增 =====
  addBtn.addEventListener('click', async ()=>{
    const email = await waitEmail(2000);
    if (!email){ alert('請先登入帳號再記帳'); return; }

    const date = `${ySel.value}-${mSel.value}-${dSel.value}`;
    const party = (partyInput.value||'').trim();
    const item  = (itemInput.value||'').trim() || '未命名品項';
    const categoryId = (catInput.value||'').trim() || '其他';
    const note  = (noteInput.value||'').trim();
    const type  = (typeSel.value||'expense');
    const amount = parseAmount(amtInput.value);

    if (!Number.isFinite(amount) || amount <= 0){
      alert('金額需為正數'); return;
    }

    try{
      await saveExpense(email, { date, party, item, categoryId, amount, type, note });
      alert('✅ 已加入：' + item);
      // 清空輸入（日期保留今天）
      partyInput.value = '';
      itemInput.value  = '';
      catInput.value   = '';
      amtInput.value   = '';
      noteInput.value  = '';
      typeSel.value    = 'expense';
    }catch(err){
      console.error(err);
      alert('❌ 寫入失敗：' + (err?.message || err));
    }
  });

  return el;
}
