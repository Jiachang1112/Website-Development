// assets/js/pages/login-logs.js
// 這版會先出現兩個選項：「用戶登入」與「管理員登入」

import { db } from '../firebase.js';
import {
  collection, query, where, orderBy, limit, onSnapshot
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

const $ = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
const toTW = ts=>{
  try{
    const d=ts?.toDate?ts.toDate():new Date();
    return d.toLocaleString('zh-TW',{hour12:false});
  }catch{return'-';}
};

function ensureStyle(){
  if($('#loginlogs-css'))return;
  const css=document.createElement('style');
  css.id='loginlogs-css';
  css.textContent=`
  .shell{max-width:900px;margin:24px auto;padding:0 16px}
  .kcard{background:#151a21;border:1px solid #2a2f37;border-radius:16px;margin-bottom:16px;padding:20px;color:#e6e6e6}
  .title{font-size:1.3rem;font-weight:700;margin-bottom:6px}
  .muted{color:#9aa3af}
  .grid2{display:grid;gap:16px;grid-template-columns:1fr; }
  @media(min-width:768px){.grid2{grid-template-columns:1fr 1fr}}
  .opt{cursor:pointer;transition:0.2s;user-select:none}
  .opt:hover{transform:translateY(-3px);box-shadow:0 4px 20px rgba(0,0,0,.3)}
  table{width:100%;font-size:14px}
  th,td{border-top:1px solid #2a2f37;padding:8px}
  th{color:#9aa3af}
  `;
  document.head.appendChild(css);
}

function renderUI(root){
  root.innerHTML=`
  <div class="shell">
    <div id="selectBlock" class="kcard">
      <div class="title">選擇登入類型</div>
      <div class="muted mb-3">請選擇要查看的登入紀錄類別</div>
      <div class="grid2">
        <div class="kcard opt" data-kind="user">
          <div class="title">用戶登入</div>
          <div class="muted">查看從首頁帳號登入的用戶紀錄</div>
        </div>
        <div class="kcard opt" data-kind="admin">
          <div class="title">管理員登入</div>
          <div class="muted">查看後台管理員登入紀錄</div>
        </div>
      </div>
    </div>

    <div id="listBlock" class="kcard" style="display:none">
      <div class="title" id="logTitle">登入紀錄</div>
      <div class="muted" id="subText">載入中...</div>
      <table>
        <thead><tr><th>時間</th><th>姓名</th><th>Email</th><th>UID</th><th>Provider</th><th>User-Agent</th></tr></thead>
        <tbody id="tbody"><tr><td colspan="6">尚未載入</td></tr></tbody>
      </table>
    </div>
  </div>`;
}

(async()=>{
  ensureStyle();
  const root = document.getElementById('app') || document.body;
  renderUI(root);

  const selBlock = $('#selectBlock');
  const listBlock = $('#listBlock');
  const title = $('#logTitle');
  const sub = $('#subText');
  const tbody = $('#tbody');

  let currentKind=null;
  let unsub=null;

  function show(kind){
    currentKind=kind;
    selBlock.style.display='none';
    listBlock.style.display='';
    title.textContent = kind==='admin'?'管理員登入紀錄':'用戶登入紀錄';
    sub.textContent = '即時顯示最近登入的使用者';
    loadData(kind);
  }

  async function loadData(kind){
    if(unsub){unsub();unsub=null;}
    tbody.innerHTML='<tr><td colspan="6">載入中...</td></tr>';
    const q=query(
      collection(db,'login_logs'),
      where('kind','==',kind),
      orderBy('ts','desc'),
      limit(500)
    );
    unsub=onSnapshot(q,snap=>{
      const arr=snap.docs.map(d=>d.data());
      if(!arr.length){
        tbody.innerHTML='<tr><td colspan="6" class="muted">無紀錄</td></tr>';
        return;
      }
      tbody.innerHTML=arr.map(v=>`
      <tr>
        <td>${toTW(v.ts)}</td>
        <td>${v.name||''}</td>
        <td>${v.email||''}</td>
        <td>${v.uid||''}</td>
        <td>${v.providerId||''}</td>
        <td style="word-break:break-all">${v.userAgent||''}</td>
      </tr>`).join('');
    });
  }

  $$('.opt',root).forEach(btn=>{
    btn.addEventListener('click',()=>show(btn.dataset.kind));
  });

})();
