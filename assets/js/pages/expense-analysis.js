// 記帳分析頁
import { auth, db } from '../firebase.js';
import {
  collection, query, where, getDocs, orderBy,
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
const toast = (m)=>{
  const div=document.createElement('div');
  div.textContent=m;
  div.style.cssText='position:fixed;top:20px;right:20px;background:#1f2937;color:white;padding:10px 16px;border-radius:8px;z-index:9999';
  document.body.append(div);
  setTimeout(()=>div.remove(),2500);
};

let UID=null;
let currentLedgerId=null;
let TYPE='expense'; // expense | income
let CURR_MONTH=new Date().toISOString().slice(0,7); // yyyy-mm

// ====== 初始化 ======
onAuthStateChanged(auth, async (user)=>{
  if(!user){
    $('#app').innerHTML='<section class="content-card"><h2>記帳｜分析</h2><div class="muted">請先登入帳號</div></section>';
    return;
  }
  UID=user.uid;
  initUI();
  await loadDefaultLedger();
  await renderAnalysis();
});

async function loadDefaultLedger(){
  const qy=query(collection(db,'users',UID,'ledgers'));
  const snap=await getDocs(qy);
  if(snap.empty) return;
  currentLedgerId=snap.docs[0].id;
}

// ====== 介面 ======
function initUI(){
  $('#app').innerHTML=`
  <section class="content-card">
    <h2>記帳｜分析</h2>
    <div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <label>月份</label>
      <input type="month" id="monthPick" value="${CURR_MONTH}" style="padding:6px 10px;border-radius:6px;border:1px solid #ccc">
      <button id="btnExpense" class="btn active">支出</button>
      <button id="btnIncome" class="btn">收入</button>
    </div>
    <div id="summary" style="font-size:18px;font-weight:600;margin-bottom:12px;color:#3b82f6">總額 0</div>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="border-bottom:1px solid #555">
          <th style="text-align:left;padding:6px">分類</th>
          <th style="text-align:right;padding:6px">金額</th>
          <th style="text-align:right;padding:6px">占比</th>
        </tr>
      </thead>
      <tbody id="listBody"></tbody>
    </table>
  </section>
  `;
  $('#btnExpense').onclick=()=>{TYPE='expense';switchTab();};
  $('#btnIncome').onclick=()=>{TYPE='income';switchTab();};
  $('#monthPick').onchange=()=>{CURR_MONTH=$('#monthPick').value;renderAnalysis();};
}

function switchTab(){
  $('#btnExpense').classList.toggle('active',TYPE==='expense');
  $('#btnIncome').classList.toggle('active',TYPE==='income');
  renderAnalysis();
}

// ====== 主要分析 ======
async function renderAnalysis(){
  const body=$('#listBody');
  const summary=$('#summary');
  body.innerHTML='<tr><td colspan="3" class="muted">載入中...</td></tr>';
  summary.textContent='總額 0';

  if(!UID||!currentLedgerId){
    body.innerHTML='<tr><td colspan="3" class="muted">尚未登入或無帳本</td></tr>';
    return;
  }

  // 取得該月的起訖時間
  const [year,month]=CURR_MONTH.split('-').map(Number);
  const start=new Date(year,month-1,1);
  const end=new Date(year,month,0,23,59,59);

  // 從 Firestore 撈交易資料
  const qy=query(
    collection(db,'users',UID,'ledgers',currentLedgerId,'records'),
    where('type','==',TYPE),
    orderBy('createdAt','desc')
  );
  const snap=await getDocs(qy);
  const map={};
  let total=0;

  snap.forEach(doc=>{
    const v=doc.data();
    if(!v.amount||!v.date) return;
    const dt=new Date(v.date.seconds?v.date.seconds*1000:v.date);
    if(dt<start||dt>end) return;
    const cat=v.categoryName||'未分類';
    const amt=Math.abs(Number(v.amount)||0);
    map[cat]=(map[cat]||0)+amt;
    total+=amt;
  });

  if(total===0){
    body.innerHTML='<tr><td colspan="3" class="muted">此月份沒有資料</td></tr>';
    summary.textContent=`總額 0`;
    return;
  }

  const rows=Object.entries(map).map(([cat,amt])=>{
    const ratio=((amt/total)*100).toFixed(1);
    return `<tr><td style="padding:6px">${cat}</td><td style="padding:6px;text-align:right">${amt.toLocaleString()}</td><td style="padding:6px;text-align:right">${ratio}%</td></tr>`;
  });
  body.innerHTML=rows.join('');
  summary.textContent=`總額 ${total.toLocaleString()}`;
}
