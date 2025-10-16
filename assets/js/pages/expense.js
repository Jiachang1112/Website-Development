// assets/js/pages/expense.js
// Firestore: /expenses/{email}/entries/{autoId}
// 欄位：type, date, amount, categoryId, item, note, createdAt, updatedAt
import { auth, db } from '../firebase.js';
import {
  collection, addDoc, doc, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';
import { onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';

export function ExpensePage(){
  const el = document.createElement('div');
  el.className = 'container card';
  el.innerHTML = `
    <h3>支出記帳</h3>

    <!-- 一行排版；桌機保持在同一行，窄螢幕才換行 -->
    <div class="row" id="formRow" style="
      display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px; align-items:center;
    ">
      <!-- 類型：支出 / 收入 -->
      <select id="type" class="form-control" style="min-width:90px">
        <option value="expense">支出</option>
        <option value="income">收入</option>
      </select>

      <!-- 日期：年 / 月 / 日 -->
      <select id="year"  class="form-control" style="min-width:110px"></select>
      <select id="month" class="form-control" style="min-width:90px"></select>
      <select id="day"   class="form-control" style="min-width:90px"></select>

      <!-- 先金額，再分類、品項、備註（備註緊貼在品項右邊） -->
      <input id="amt"  type="text" inputmode="decimal" placeholder="金額"
             class="form-control" style="min-width:120px;"/>
      <input id="cat"  placeholder="分類" class="form-control" style="min-width:140px;"/>

      <!-- 品項與備註給較大的彈性寬度，維持同一行 -->
      <input id="item" placeholder="品項" class="form-control"
             style="flex:1 1 240px; min-width:220px;"/>
      <input id="note" placeholder="備註" class="form-control"
             style="flex:1 1 260px; min-width:220px;"/>

      <button class="primary btn btn-primary" id="add" style="min-width:88px;">新增</button>
    </div>

    <div class="small text-muted">快速鍵：右下角「＋」也會跳到此頁。</div>
  `;

  // === 節點 ===
  const typeSel  = el.querySelector('#type');
  const yearSel  = el.querySelector('#year');
  const monthSel = el.querySelector('#month');
  const daySel   = el.querySelector('#day');
  const amtInput  = el.querySelector('#amt');
  const catInput  = el.querySelector('#cat');
  const itemInput = el.querySelector('#item');
  const noteInput = el.querySelector('#note');
  const addBtn    = el.querySelector('#add');

  // === 日期選單（2020~3000） ===
  const pad2 = n => String(n).padStart(2,'0');
  const daysInMonth = (y,m) => new Date(y,m,0).getDate(); // m:1..12
  function fillYears(){
    const frag = document.createDocumentFragment();
    for(let y=2020;y<=3000;y++){
      const o=document.createElement('option'); o.value=o.textContent=String(y);
      frag.appendChild(o);
    }
    yearSel.appendChild(frag);
  }
  function fillMonths(){
    const frag=document.createDocumentFragment();
    for(let m=1;m<=12;m++){
      const o=document.createElement('option'); o.value=o.textContent=pad2(m);
      frag.appendChild(o);
    }
    monthSel.appendChild(frag);
  }
  function fillDays(y,m){
    daySel.innerHTML='';
    const frag=document.createDocumentFragment();
    const dmax=daysInMonth(+y,+m);
    for(let d=1; d<=dmax; d++){
      const o=document.createElement('option'); o.value=o.textContent=pad2(d);
      frag.appendChild(o);
    }
    daySel.appendChild(frag);
  }
  (function initDate(){
    const now=new Date();
    fillYears(); fillMonths();
    yearSel.value = String(Math.min(3000, Math.max(2020, now.getFullYear())));
    monthSel.value= pad2(now.getMonth()+1);
    fillDays(yearSel.value, monthSel.value);
    daySel.value  = pad2(now.getDate());
  })();
  function syncDays(){
    const prev = +daySel.value || 1;
    fillDays(yearSel.value, monthSel.value);
    const max = +daySel.options[daySel.options.length-1].value;
    daySel.value = pad2(Math.min(prev, max));
  }
  yearSel.addEventListener('change', syncDays);
  monthSel.addEventListener('change', syncDays);

  // === 金額輸入清理（避免手機鍵盤限制） ===
  amtInput.addEventListener('input', ()=>{
    amtInput.value = amtInput.value.replace(/[^\d.,\-]/g,'');
  });
  const parseAmount = (v)=>{
    if(!v) return NaN;
    let s = String(v).trim().replace(/\s/g,'').replace(/,/g,'.').replace(/[^\d.\-]/g,'');
    const i = s.indexOf('.');
    if(i!==-1) s = s.slice(0,i+1) + s.slice(i+1).replace(/\./g,''); // 只留第一個小數點
    return parseFloat(s);
  };

  // === 取得登入 email（Auth → localStorage 回退） ===
  const getActiveEmailNow = ()=>{
    if (auth?.currentUser?.email) return auth.currentUser.email;
    try { const s = JSON.parse(localStorage.getItem('session_user')||'null'); return s?.email || null; } catch { return null; }
  };
  const waitEmail = (ms=2000)=>new Promise(res=>{
    const now=getActiveEmailNow(); if(now) return res(now);
    let done=false;
    const off = onAuthStateChanged(auth,u=>{ if(done) return; if(u?.email){ done=true; off(); res(u.email);} });
    setTimeout(()=>{ if(done) return; done=true; try{off();}catch{} res(getActiveEmailNow()); }, ms);
  });

  // === Firestore 寫入 ===
  const SUBCOL = 'entries'; // 需要改回 'records' 就改這行
  async function saveEntry(email, rec){
    await setDoc(doc(db,'expenses',email), { email, updatedAt: serverTimestamp() }, { merge:true });
    await addDoc(collection(db,'expenses',email,SUBCOL), {
      ...rec,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  // === 新增 ===
  addBtn.addEventListener('click', async ()=>{
    const email = await waitEmail(2000);
    if(!email){ alert('請先登入帳號再記帳'); return; }

    const date = `${yearSel.value}-${monthSel.value}-${daySel.value}`;
    const amount = parseAmount(amtInput.value);
    if(!Number.isFinite(amount) || amount <= 0){ alert('金額需為正數'); return; }

    const categoryId = (catInput.value||'').trim()  || '其他';
    const item       = (itemInput.value||'').trim() || '未命名品項';
    const note       = (noteInput.value||'').trim() || '';
    const type       = typeSel.value; // 'expense' or 'income'

    try{
      await saveEntry(email, { type, date, amount, categoryId, item, note });
      alert(`✅ 已加入${type==='income'?'收入':'支出'}：` + item);

      // 清空文字欄位（日期保留、類型保留）
      amtInput.value=''; catInput.value=''; itemInput.value=''; noteInput.value='';
    }catch(err){
      console.error(err);
      alert('❌ 寫入失敗：' + (err?.message || err));
    }
  });

  return el;
}
