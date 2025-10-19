import { auth, db } from '../assets/js/firebase.js';
import {
  doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc,
  collection, getDocs, query, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';

const $ = s => document.querySelector(s);
const host = $('#pageHost');
let UID = null;
let currentLedgerId = null;

// ===================== 初始化 =====================
onAuthStateChanged(auth, async (user)=>{
  if(!user){ host.innerHTML='<p>請先登入帳號</p>'; return; }
  UID = user.uid;
  renderLedgers(); // 預設顯示帳本
});

// ===================== 切換分頁 =====================
$('#tab-ledgers').onclick = ()=>switchTab('ledgers');
$('#tab-budgets').onclick = ()=>switchTab('budgets');
$('#tab-currency').onclick = ()=>switchTab('currency');

function switchTab(tab){
  document.querySelectorAll('.tabs button').forEach(b=>b.classList.remove('active'));
  $(`#tab-${tab}`).classList.add('active');
  if(tab==='ledgers') renderLedgers();
  if(tab==='budgets') renderBudgets();
  if(tab==='currency') renderCurrency();
}

// ===================== 管理帳本 =====================
async function renderLedgers(){
  const ref = collection(db, 'users', UID, 'ledgers');
  const snap = await getDocs(query(ref, orderBy('createdAt','asc')));
  if(snap.empty){
    await addDoc(ref,{ name:'預設帳本',createdAt:serverTimestamp(),isDefault:true});
    return renderLedgers();
  }

  const html = [];
  snap.forEach(docSnap=>{
    const d = docSnap.data();
    html.push(`
      <div class="ledger-card">
        <img src="../assets/img/ledger-default.png">
        <div class="ledger-body">
          <div class="ledger-name">${d.name}</div>
          ${d.isDefault ? `<div style="color:#facc15;font-size:12px;">預設帳本</div>`:''}
          <div class="ledger-actions">
            <button onclick="renameLedger('${docSnap.id}','${d.name}')"><i class="bi bi-pencil"></i></button>
            <button onclick="deleteLedger('${docSnap.id}')"><i class="bi bi-trash"></i></button>
          </div>
        </div>
      </div>
    `);
  });

  html.push(`<div class="add-card" onclick="addLedger()">＋ 新增帳本</div>`);
  host.innerHTML = `<div class="ledger-grid">${html.join('')}</div>`;
}

window.addLedger = async function(){
  const name = prompt('請輸入帳本名稱');
  if(!name) return;
  await addDoc(collection(db,'users',UID,'ledgers'),{ name,createdAt:serverTimestamp(),isDefault:false });
  renderLedgers();
};

window.renameLedger = async function(id,old){
  const name = prompt('修改帳本名稱',old);
  if(!name) return;
  await updateDoc(doc(db,'users',UID,'ledgers',id),{ name });
  renderLedgers();
};

window.deleteLedger = async function(id){
  if(!confirm('確定刪除帳本？')) return;
  await deleteDoc(doc(db,'users',UID,'ledgers',id));
  renderLedgers();
};

// ===================== 管理預算 =====================
async function renderBudgets(){
  host.innerHTML = `
    <h2>管理預算</h2>
    <div>
      <input id="budgetName" placeholder="預算名稱">
      <input id="budgetAmount" type="number" placeholder="金額">
      <button class="save" id="addBudget">新增</button>
    </div>
    <div class="budget-list" id="budgetList"></div>
  `;
  $('#addBudget').onclick = addBudget;
  listBudgets();
}

async function addBudget(){
  const name = $('#budgetName').value.trim();
  const amt = Number($('#budgetAmount').value.trim());
  if(!name || !amt) return alert('請輸入完整預算');
  await addDoc(collection(db,'users',UID,'budgets'),{ name,amount:amt,createdAt:serverTimestamp() });
  listBudgets();
}

async function listBudgets(){
  const list = $('#budgetList');
  const snap = await getDocs(query(collection(db,'users',UID,'budgets'), orderBy('createdAt','asc')));
  list.innerHTML = snap.empty ? '<p>尚無預算</p>' : '';
  snap.forEach(d=>{
    const v=d.data();
    list.innerHTML+=`<div class="budget-item"><span>${v.name}</span><span>$${v.amount}</span></div>`;
  });
}

// ===================== 管理貨幣 =====================
async function renderCurrency(){
  const userRef = doc(db,'users',UID);
  const snap = await getDoc(userRef);
  const curr = snap.data()?.settings?.currency || 'TWD';

  host.innerHTML = `
    <h2>管理貨幣</h2>
    <div class="currency-list">
      <div class="currency-item">
        <label>主要貨幣：</label>
        <select id="currencySelect">
          <option value="TWD">新台幣 (TWD)</option>
          <option value="USD">美元 (USD)</option>
          <option value="JPY">日圓 (JPY)</option>
          <option value="EUR">歐元 (EUR)</option>
        </select>
        <button class="save" id="saveCurrency">儲存</button>
      </div>
    </div>
  `;
  $('#currencySelect').value = curr;
  $('#saveCurrency').onclick = async ()=>{
    const val = $('#currencySelect').value;
    await updateDoc(userRef,{ 'settings.currency': val, updatedAt:serverTimestamp() });
    alert('主貨幣已更新！');
  };
}
