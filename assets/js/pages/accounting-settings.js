// admin/accounting-settings.js
import { auth, db } from '../assets/js/firebase.js';
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp,
  collection, addDoc, deleteDoc, query, orderBy, getDocs, where
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';
import {
  onAuthStateChanged, GoogleAuthProvider, signInWithPopup,
  setPersistence, browserLocalPersistence, signOut
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';

const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
const host = $('#pageHost');
const toast = (m)=>{ try{console.log(m);}catch{} };

let UID = null;
let READY = false;

/* ---------------- Tabs ---------------- */
$('#tab-ledgers').onclick  = () => switchTab('ledgers');
$('#tab-budgets').onclick  = () => switchTab('budgets');
$('#tab-currency').onclick = () => switchTab('currency');

function switchTab(tab){
  document.querySelectorAll('.tabs button').forEach(b=>b.classList.remove('active'));
  $(`#tab-${tab}`).classList.add('active');
  if (tab==='ledgers')  renderLedgers();
  if (tab==='budgets')  renderBudgets();
  if (tab==='currency') renderCurrency();
}

/* ---------------- 初次渲染 ---------------- */
renderLedgers();

/* ---------------- Auth 初始化 & 監聽 ---------------- */
(async function initAuth(){
  // 強制使用本機持久化（避免某些瀏覽器把預設關掉）
  try { await setPersistence(auth, browserLocalPersistence); } catch(e){ console.warn(e); }

  onAuthStateChanged(auth, async (user)=>{
    READY = true;
    if (!user){
      UID = null;
      // 重新渲染目前分頁（會出現登入按鈕）
      const active = document.querySelector('.tabs button.active')?.id?.replace('tab-','') || 'ledgers';
      switchTab(active);
      return;
    }
    UID = user.uid;
    // 重新渲染目前分頁（接上 Firestore 真資料）
    const active = document.querySelector('.tabs button.active')?.id?.replace('tab-','') || 'ledgers';
    switchTab(active);
  });
})();

/* ---------------- 共用：登入/登出 UI ---------------- */
function renderLoginPrompt(title='請先登入帳號'){
  host.innerHTML = `
    <div class="content-card">
      <h2>${title}</h2>
      <p class="muted" style="margin:6px 0 14px">點一下下面按鈕即可用 Google 登入。</p>
      <button id="btnGoogleLogin" class="btn" style="background:#ea4335">使用 Google 快速登入</button>
    </div>`;
  $('#btnGoogleLogin').onclick = doGoogleLogin;
}

async function doGoogleLogin(){
  try{
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }catch(err){
    alert('登入失敗：' + (err?.message || err));
  }
}

/* ===================================================================
   管理帳本
=================================================================== */
async function renderLedgers(){
  if (!READY){ host.innerHTML = `<div class="content-card"><h2>管理帳本</h2><p class="muted">載入中…</p></div>`; return; }
  if (!UID){ renderLoginPrompt('管理帳本'); return; }

  const ref  = collection(db,'users',UID,'ledgers');
  let   snap = await getDocs(query(ref, orderBy('createdAt','asc')));
  if (snap.empty){
    await addDoc(ref,{ name:'預設帳本', isDefault:true, currency:'TWD', createdAt:serverTimestamp(), updatedAt:serverTimestamp() });
    snap = await getDocs(query(ref, orderBy('createdAt','asc')));
  }

  const cards = [];
  snap.forEach(d=>{
    const v = d.data();
    cards.push(`
      <div class="ledger-card">
        <div class="cover"></div>
        <div class="body">
          <div style="min-width:0">
            <div class="ledger-name">${esc(v.name||'(未命名)')}</div>
            ${v.isDefault?`<span class="badge-default">預設</span>`:''}
          </div>
          <div class="ledger-actions">
            <button class="btn" onclick="renameLedger('${d.id}','${attr(v.name||'')}')"><i class="bi bi-pencil"></i></button>
            <button class="btn" onclick="deleteLedger('${d.id}')"><i class="bi bi-trash"></i></button>
          </div>
        </div>
      </div>
    `);
  });
  cards.push(`
    <div class="ledger-card add" onclick="addLedger()">
      <div class="add-inner">
        <div class="big">＋</div>
        <div>新增帳本</div>
      </div>
    </div>`);

  host.innerHTML = `
    <section class="content-card">
      <h2>管理帳本</h2>
      <div class="ledger-grid">${cards.join('')}</div>
      <div style="margin-top:14px">
        <button class="btn" id="btnSignOut" style="background:#475569">登出</button>
      </div>
    </section>`;
  $('#btnSignOut')?.addEventListener('click', ()=>signOut(auth));
}

window.addLedger = async function(){
  if(!UID) return doGoogleLogin();
  const name = prompt('請輸入帳本名稱');
  if(!name) return;
  await addDoc(collection(db,'users',UID,'ledgers'),{
    name, isDefault:false, currency:'TWD', createdAt:serverTimestamp(), updatedAt:serverTimestamp()
  });
  renderLedgers();
};

window.renameLedger = async function(id, oldName=''){
  if(!UID) return doGoogleLogin();
  const name = prompt('修改帳本名稱', oldName);
  if(!name) return;
  await updateDoc(doc(db,'users',UID,'ledgers',id),{ name, updatedAt:serverTimestamp() });
  renderLedgers();
};

window.deleteLedger = async function(id){
  if(!UID) return doGoogleLogin();
  if(!confirm('確定刪除？')) return;
  const r  = doc(db,'users',UID,'ledgers',id);
  const v  = (await getDoc(r)).data();
  await deleteDoc(r);
  if (v?.isDefault){
    const q  = query(collection(db,'users',UID,'ledgers'), orderBy('createdAt','asc'));
    const s  = await getDocs(q);
    if (!s.empty){
      await updateDoc(doc(db,'users',UID,'ledgers',s.docs[0].id), { isDefault:true, updatedAt:serverTimestamp() });
    }
  }
  renderLedgers();
};

/* ===================================================================
   管理預算（簡版示例）
=================================================================== */
async function renderBudgets(){
  if (!READY){ host.innerHTML = `<div class="content-card"><h2>管理預算</h2><p class="muted">載入中…</p></div>`; return; }
  if (!UID){ renderLoginPrompt('管理預算'); return; }

  host.innerHTML = `
    <div class="content-card">
      <h2>管理預算</h2>
      <div style="display:grid;gap:10px;max-width:520px">
        <input id="bName"  placeholder="預算名稱">
        <input id="bAmt"   type="number" placeholder="金額">
        <button class="btn" id="bAdd">新增</button>
      </div>
      <div id="bList" style="margin-top:14px"></div>
    </div>`;
  $('#bAdd').onclick = async ()=>{
    const name = $('#bName').value.trim();
    const amt  = Number($('#bAmt').value||0);
    if(!name || !amt) return alert('請輸入名稱與金額');
    await addDoc(collection(db,'users',UID,'budgets'),{ name, amount:amt, createdAt:serverTimestamp() });
    $('#bName').value=''; $('#bAmt').value='';
    listBudgets();
  };
  listBudgets();
}

async function listBudgets(){
  const list = $('#bList'); list.innerHTML = '載入中…';
  const snap = await getDocs(query(collection(db,'users',UID,'budgets'), orderBy('createdAt','desc')));
  if (snap.empty){ list.innerHTML = `<span class="muted">目前沒有預算</span>`; return; }
  list.innerHTML = '';
  snap.forEach(d=>{
    const v = d.data();
    list.innerHTML += `<div class="budget-item"><span>${esc(v.name)}</span><span>$${(v.amount||0).toLocaleString()}</span></div>`;
  });
}

/* ===================================================================
   管理貨幣（主貨幣設定示例）
=================================================================== */
async function renderCurrency(){
  if (!READY){ host.innerHTML = `<div class="content-card"><h2>管理貨幣</h2><p class="muted">載入中…</p></div>`; return; }
  if (!UID){ renderLoginPrompt('管理貨幣'); return; }

  const uref = doc(db,'users',UID);
  const udoc = await getDoc(uref);
  const current = udoc.data()?.settings?.currency || 'TWD';

  host.innerHTML = `
    <div class="content-card">
      <h2>管理貨幣</h2>
      <div style="display:flex;gap:10px;max-width:520px">
        <select id="curSel">
          <option value="TWD">TWD 新台幣</option>
          <option value="USD">USD 美元</option>
          <option value="JPY">JPY 日圓</option>
          <option value="EUR">EUR 歐元</option>
        </select>
        <button class="btn" id="curSave">儲存</button>
      </div>
      <p class="muted" style="margin-top:8px">此主貨幣會作為記帳時的預設幣別。</p>
    </div>`;
  $('#curSel').value = current;
  $('#curSave').onclick = async ()=>{
    await setDoc(uref, { settings:{ currency: $('#curSel').value } }, { merge:true });
    alert('已儲存');
  };
}

/* ---------------- 小工具 ---------------- */
function esc(s=''){return s.replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))}
function attr(s=''){return esc(s).replace(/\n/g,' ')}

