// assets/js/pages/expense.js
// 保留原 UI，寫入 Firestore 時自動補上 note/type/時間欄位

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
      <select id="year" class="form-control" style="max-width:110px"></select>
      <select id="month" class="form-control" style="max-width:90px"></select>
      <select id="day" class="form-control" style="max-width:90px"></select>

      <input id="item" placeholder="品項" class="form-control"/>
      <input id="cat" placeholder="分類" class="form-control"/>
      <input id="amt" type="text" inputmode="decimal" placeholder="金額" class="form-control"/>
      <button class="primary btn btn-primary" id="add">新增</button>
    </div>
    <div class="small text-muted">快速鍵：右下角「＋」也會跳到此頁。</div>
  `;

  const ySel = el.querySelector('#year');
  const mSel = el.querySelector('#month');
  const dSel = el.querySelector('#day');
  const itemInput = el.querySelector('#item');
  const catInput  = el.querySelector('#cat');
  const amtInput  = el.querySelector('#amt');
  const addBtn    = el.querySelector('#add');

  // === 日期選單 ===
  function pad2(n){ return String(n).padStart(2,'0'); }
  function daysInMonth(y, m){ return new Date(y, m, 0).getDate(); }

  function fillYears(){
    for(let y=2020; y<=3000; y++){
      const o=document.createElement('option'); o.value=y; o.textContent=y; ySel.appendChild(o);
    }
  }
  function fillMonths(){
    for(let m=1; m<=12; m++){
      const o=document.createElement('option'); o.value=pad2(m); o.textContent=pad2(m); mSel.appendChild(o);
    }
  }
  function fillDays(y, m){
    dSel.innerHTML='';
    const max = daysInMonth(+y,+m);
    for(let d=1; d<=max; d++){
      const o=document.createElement('option'); o.value=pad2(d); o.textContent=pad2(d); dSel.appendChild(o);
    }
  }

  (function initDate(){
    const now=new Date();
    fillYears(); fillMonths();
    ySel.value=now.getFullYear();
    mSel.value=pad2(now.getMonth()+1);
    fillDays(ySel.value,mSel.value);
    dSel.value=pad2(now.getDate());
  })();

  function syncDays(){
    const prev=dSel.value;
    fillDays(ySel.value,mSel.value);
    const last=dSel.options[dSel.options.length-1].value;
    dSel.value=prev>last?last:prev;
  }
  ySel.addEventListener('change',syncDays);
  mSel.addEventListener('change',syncDays);

  // === 金額欄清理 ===
  amtInput.addEventListener('input',()=>{
    amtInput.value = amtInput.value.replace(/[^\d.,\-]/g,'');
  });
  function parseAmount(v){
    let s=String(v||'').trim().replace(/,/g,'.').replace(/[^\d.\-]/g,'');
    const dot=s.indexOf('.');
    if(dot!==-1)s=s.slice(0,dot+1)+s.slice(dot+1).replace(/\./g,'');
    return parseFloat(s);
  }

  // === 取得登入使用者 ===
  function getEmailNow(){
    if(auth?.currentUser?.email) return auth.currentUser.email;
    try{
      const s=JSON.parse(localStorage.getItem('session_user')||'null');
      if(s?.email) return s.email;
    }catch{}
    return null;
  }
  function waitEmail(timeout=2000){
    return new Promise(resolve=>{
      const now=getEmailNow();
      if(now)return resolve(now);
      let done=false;
      const stop=onAuthStateChanged(auth,u=>{
        if(done)return;
        if(u?.email){done=true;stop&&stop();resolve(u.email);}
      });
      setTimeout(()=>{if(!done){done=true;try{stop&&stop();}catch{}resolve(getEmailNow());}},timeout);
    });
  }

  // === Firestore 寫入 ===
  async function saveExpense(email, rec){
    await setDoc(doc(db,'expenses',email),{email,updatedAt:serverTimestamp()},{merge:true});
    await addDoc(collection(db,'expenses',email,'entries'),rec);
  }

  // === 新增事件 ===
  addBtn.addEventListener('click',async()=>{
    const email=await waitEmail();
    if(!email){ alert('請先登入帳號再記帳'); return; }

    const date=`${ySel.value}-${mSel.value}-${dSel.value}`;
    const item=(itemInput.value||'').trim()||'未命名品項';
    const cat=(catInput.value||'').trim()||'其他';
    const amt=parseAmount(amtInput.value);
    if(!Number.isFinite(amt)||amt<=0){ alert('金額需為正數'); return; }

    const rec={
      date,
      item,
      categoryId:cat,
      amount:amt,
      note:'',
      type:'expense',
      createdAt:serverTimestamp(),
      updatedAt:serverTimestamp()
    };

    try{
      await saveExpense(email,rec);
      alert('✅ 已加入：'+item);
      itemInput.value=''; catInput.value=''; amtInput.value='';
    }catch(e){
      console.error(e);
      alert('❌ 寫入失敗：'+e.message);
    }
  });

  return el;
}
