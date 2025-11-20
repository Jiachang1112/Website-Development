// assets/js/pages/expense.js
// Firestore: /users/{uid}/ledgers/{ledgerId}/entries/{autoId}
// 修改：調整欄位順序，將「帳本」移到「金額」左邊

import { auth, db } from '../firebase.js';
import {
  collection, addDoc, doc, setDoc, serverTimestamp,
  query, orderBy, getDocs, where
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';
import { onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';

export function ExpensePage(){
  const el = document.createElement('div');
  el.className = 'container card';
  el.innerHTML = `
    <h3>支出記帳</h3>

    <div id="formRow" style="
      display:flex;
      gap:4px;
      align-items:center;
      overflow-x:auto;
      padding-bottom:4px;
      scrollbar-width:thin;
      margin-bottom:8px;
    ">
      <select id="type" class="form-control" style="min-width:80px;flex:0 0 auto;">
        <option value="expense">支出</option>
        <option value="income">收入</option>
      </select>

      <select id="year"  class="form-control" style="min-width:90px;flex:0 0 auto;"></select>
      <select id="month" class="form-control" style="min-width:70px;flex:0 0 auto;"></select>
      <select id="day"   class="form-control" style="min-width:70px;flex:0 0 auto;"></select>

      <select id="ledger" class="form-control" style="min-width:100px;flex:1 1 auto;">
        <option value="" disabled selected>載入中...</option>
      </select>

      <input id="amt"  type="text" inputmode="decimal" placeholder="金額"
             class="form-control" style="min-width:10px;flex:1 1 auto;"/>
      <input id="cat"  placeholder="分類" class="form-control"
             style="min-width:25px;flex:0 0 auto;"/>

      <input id="note" placeholder="備註" class="form-control"
             style="min-width:140px;flex:1 1 auto;"/>

      <button class="primary btn btn-primary" id="add" style="min-width:80px;flex:0 0 auto;">新增</button>
    </div>

    <div class="small text-muted">快速鍵：按 Enter 或 Ctrl+Enter 可直接新增。</div>
  `;

  // === 節點 ===
  const typeSel  = el.querySelector('#type');
  const yearSel  = el.querySelector('#year');
  const monthSel = el.querySelector('#month');
  const daySel   = el.querySelector('#day');
  const amtInput  = el.querySelector('#amt');
  const catInput  = el.querySelector('#cat');
  const ledgerSel = el.querySelector('#ledger'); // Ledger
  const noteInput = el.querySelector('#note');
  const addBtn    = el.querySelector('#add');

  // === 日期選單 ===
  const pad2 = n => String(n).padStart(2,'0');
  const daysInMonth = (y,m) => new Date(y,m,0).getDate();
  function fillYears(){
    const frag=document.createDocumentFragment();
    for(let y=2020;y<=3000;y++){
      const o=document.createElement('option');
      o.value=o.textContent=String(y);
      frag.appendChild(o);
    }
    yearSel.appendChild(frag);
  }
  function fillMonths(){
    const frag=document.createDocumentFragment();
    for(let m=1;m<=12;m++){
      const o=document.createElement('option');
      o.value=o.textContent=pad2(m);
      frag.appendChild(o);
    }
    monthSel.appendChild(frag);
  }
  function fillDays(y,m){
    daySel.innerHTML='';
    const frag=document.createDocumentFragment();
    const dmax=daysInMonth(+y,+m);
    for(let d=1;d<=dmax;d++){
      const o=document.createElement('option');
      o.value=o.textContent=pad2(d);
      frag.appendChild(o);
    }
    daySel.appendChild(frag);
  }
  (function initDate(){
    const now=new Date();
    fillYears(); fillMonths();
    yearSel.value=String(now.getFullYear());
    monthSel.value=pad2(now.getMonth()+1);
    fillDays(yearSel.value,monthSel.value);
    daySel.value=pad2(now.getDate());
  })();
  function syncDays(){
    const prev=+daySel.value||1;
    fillDays(yearSel.value,monthSel.value);
    const max=+daySel.options[daySel.options.length-1].value;
    daySel.value=pad2(Math.min(prev,max));
  }
  yearSel.addEventListener('change',syncDays);
  monthSel.addEventListener('change',syncDays);

  // === 金額輸入過濾 ===
  amtInput.addEventListener('input',()=>{
    amtInput.value=amtInput.value.replace(/[^\d.,\-]/g,'');
  });
  const parseAmount=v=>{
    if(!v) return NaN;
    let s=String(v).trim().replace(/\s/g,'').replace(/,/g,'.').replace(/[^\d.\-]/g,'');
    const i=s.indexOf('.');
    if(i!==-1) s=s.slice(0,i+1)+s.slice(i+1).replace(/\./g,'');
    return parseFloat(s);
  };

  // === 載入帳本列表 ===
  async function loadUserLedgers(uid) {
    ledgerSel.innerHTML = '<option value="" disabled>載入中...</option>';
    try {
      const q = query(collection(db, 'users', uid, 'ledgers'), orderBy('createdAt', 'asc'));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        ledgerSel.innerHTML = '<option value="" disabled>無帳本，請至設定新增</option>';
        return;
      }

      ledgerSel.innerHTML = '';
      let defaultId = null;

      snap.forEach(doc => {
        const d = doc.data();
        const opt = document.createElement('option');
        opt.value = doc.id;
        opt.textContent = d.name || '(未命名)';
        if (d.isDefault) defaultId = doc.id;
        ledgerSel.appendChild(opt);
      });

      // 自動選取預設帳本，若無則選第一個
      if (defaultId) {
        ledgerSel.value = defaultId;
      } else if (ledgerSel.options.length > 0) {
        ledgerSel.selectedIndex = 0;
      }

    } catch (e) {
      console.error("載入帳本失敗:", e);
      ledgerSel.innerHTML = '<option value="" disabled>載入失敗</option>';
    }
  }

  // 監聽登入狀態以載入帳本
  onAuthStateChanged(auth, (user) => {
    if (user) {
      loadUserLedgers(user.uid);
    } else {
      ledgerSel.innerHTML = '<option value="" disabled>請先登入</option>';
    }
  });

  // === 新增 ===
  async function addRecord(){
    const user = auth.currentUser;
    if(!user){ alert('請先登入帳號再記帳'); return; }

    const date = `${yearSel.value}-${monthSel.value}-${daySel.value}`;
    const amount = parseAmount(amtInput.value);
    if(!Number.isFinite(amount) || amount <= 0){ alert('金額需為正數'); return; }

    const categoryId = (catInput.value||'').trim()||'其他';
    const note = (noteInput.value||'').trim()||'';
    const type = typeSel.value;
    
    // 取得選中的帳本 ID
    const ledgerId = ledgerSel.value;
    const ledgerName = ledgerSel.options[ledgerSel.selectedIndex]?.text;

    if(!ledgerId) { alert('請選擇帳本'); return; }

    try{
      // 寫入路徑：users/{uid}/ledgers/{ledgerId}/entries
      await addDoc(collection(db, 'users', user.uid, 'ledgers', ledgerId, 'entries'), {
        type,
        date,
        amount,
        categoryId,
        note,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      alert(`✅ 已加入${type==='income'?'收入':'支出'} 到 [${ledgerName}]`);
      amtInput.value=''; catInput.value=''; noteInput.value='';
      amtInput.focus();
    }catch(err){
      console.error(err);
      alert('❌ 寫入失敗：'+(err?.message||err));
    }
  }
  addBtn.addEventListener('click', addRecord);

  // === Enter 快速送出 ===
  // 將 ledgerSel 加入監聽列表
  const inputsForEnter = [amtInput, catInput, ledgerSel, noteInput, yearSel, monthSel, daySel, typeSel];
  function handleEnterToAdd(e){
    if (e.isComposing) return;
    if (e.key !== 'Enter') return;
    e.preventDefault();
    addRecord();
  }
  inputsForEnter.forEach(inp => inp.addEventListener('keydown', handleEnterToAdd));

  // Ctrl+Enter 全域快速送出
  document.addEventListener('keydown', e=>{
    if (e.ctrlKey && e.key === 'Enter'){
      e.preventDefault();
      addRecord();
    }
  });

  return el;
}
