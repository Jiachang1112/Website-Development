// assets/js/pages/expense-detail.js
// 查看支出/收入明細
// ✅ 功能：
// - 日期選擇器（年 2020~3000、月 01~12、自動天數）
// - 篩選特定日期
// - 按 createdAt desc 排序（最新在上）
// - 支援登入帳號自動抓資料

import { auth, db } from '../firebase.js';
import {
  collection, query, where, orderBy, getDocs, onSnapshot
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';
import { onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';

export function ExpenseDetailPage(){
  const el = document.createElement('div');
  el.className = 'container card';
  el.innerHTML = `
    <h3>明細</h3>
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
      <select id="year"  class="form-control" style="min-width:90px"></select>
      <select id="month" class="form-control" style="min-width:90px"></select>
      <select id="day"   class="form-control" style="min-width:90px"></select>
      <button id="btnLoad" class="btn btn-primary">載入當天紀錄</button>
    </div>

    <div id="listWrap" class="mt-3" style="max-height:60vh;overflow-y:auto;border-top:1px solid #333;padding-top:8px">
      <div class="text-muted small">請選擇日期以查看紀錄</div>
    </div>
  `;

  const yearSel = el.querySelector('#year');
  const monthSel = el.querySelector('#month');
  const daySel = el.querySelector('#day');
  const btnLoad = el.querySelector('#btnLoad');
  const listWrap = el.querySelector('#listWrap');

  // ===== 日期選單邏輯 =====
  const pad2 = n => String(n).padStart(2,'0');
  const daysInMonth = (y,m)=> new Date(y,m,0).getDate();

  function fillYears(){
    const frag = document.createDocumentFragment();
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
    const dmax=daysInMonth(+y,+m);
    const frag=document.createDocumentFragment();
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

  // ===== 登入 & 載入資料 =====
  async function getActiveEmail(){
    if(auth?.currentUser?.email) return auth.currentUser.email;
    return new Promise(resolve=>{
      onAuthStateChanged(auth,u=>resolve(u?.email||null));
    });
  }

  async function loadEntries(){
    const email = await getActiveEmail();
    if(!email){ alert('請先登入帳號'); return; }

    const dateStr = `${yearSel.value}-${monthSel.value}-${daySel.value}`;
    listWrap.innerHTML = `<div class="text-muted small">載入中...</div>`;

    const q = query(
      collection(db, 'expenses', email, 'entries'),
      where('date','==',dateStr),
      orderBy('createdAt','desc') // 🔥 最新的放最上
    );

    const snap = await getDocs(q);
    if(snap.empty){
      listWrap.innerHTML = `<div class="text-muted small">這天沒有紀錄</div>`;
      return;
    }

    let html = '<table class="table table-sm text-light align-middle mt-2">';
    html += `<thead><tr><th>類別</th><th>品項</th><th>金額</th><th>備註</th><th>時間</th></tr></thead><tbody>`;
    snap.forEach(doc=>{
      const d = doc.data();
      const type = d.type === 'income' ? '💰收入' : '💸支出';
      const note = d.note || '';
      const time = d.createdAt?.toDate ? d.createdAt.toDate().toLocaleTimeString('zh-TW',{hour12:false}) : '';
      html += `
        <tr>
          <td>${type}</td>
          <td>${d.item||'-'}</td>
          <td>${d.amount||0}</td>
          <td>${note}</td>
          <td class="text-muted small">${time}</td>
        </tr>`;
    });
    html += '</tbody></table>';
    listWrap.innerHTML = html;
  }

  btnLoad.addEventListener('click', loadEntries);

  // 預設自動載入今天
  loadEntries();

  return el;
}
