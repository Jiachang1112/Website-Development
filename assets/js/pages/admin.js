// assets/js/pages/admin.js
import { auth } from '../firebase.js';
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';

/* ───────── 小工具 ───────── */
const $ = (sel, root=document) => root.querySelector(sel);

/* ───────── 樣式 ───────── */
function ensureAdminStyles(){
  if ($('#admin-css')) return;
  const css = document.createElement('style');
  css.id = 'admin-css';
  css.textContent = `
  body{background:#0f1318;color:#e6e6e6;font-family:system-ui;margin:0}
  .admin-shell{max-width:900px;margin:auto;padding:40px}
  .hero{background:linear-gradient(135deg,rgba(59,130,246,.15),rgba(168,85,247,.10));
        border:1px solid #2a2f37;border-radius:18px;padding:24px;margin-bottom:24px;
        display:flex;justify-content:space-between;align-items:center}
  .hero h5{margin:0;font-weight:800}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px}
  .card{background:#151a21;border:1px solid #2a2f37;border-radius:16px;
        padding:24px;cursor:pointer;transition:.2s}
  .card:hover{border-color:#60a5fa;transform:translateY(-2px)}
  .card h4{margin:0 0 8px 0}
  .muted{color:#9aa3af;font-size:14px}
  .btn{background:none;border:1px solid #e6e6e6;color:#e6e6e6;
       border-radius:8px;padding:6px 12px;cursor:pointer}
  `;
  document.head.appendChild(css);
}

/* ───────── 登入畫面 ───────── */
function showLogin(root){
  const el = document.createElement('div');
  el.className = 'admin-shell';
  el.innerHTML = `
    <div class="card" style="text-align:center">
      <h3>管理員登入</h3>
      <p class="muted">請使用 Google 登入進入後台</p>
      <button id="googleLogin" class="btn">使用 Google 登入</button>
      <div id="loginErr" class="muted" style="margin-top:8px;color:#ef4444"></div>
    </div>
  `;
  root.replaceChildren(el);

  const provider = new GoogleAuthProvider();
  $('#googleLogin', el)?.addEventListener('click', async ()=>{
    try{ await signInWithPopup(auth, provider); }
    catch(err){
      if(err?.code==='auth/popup-blocked' || err?.code==='auth/cancelled-popup-request'){
        await signInWithRedirect(auth, provider);
      }else{
        $('#loginErr', el).textContent = err.message || '登入失敗';
      }
    }
  });
}

/* ───────── 後台首頁：三選項 ───────── */
function renderHome(){
  const el = document.createElement('div');
  el.className = 'admin-shell';
  el.innerHTML = `
    <div class="hero">
      <div>
        <h5>歡迎回來 👋</h5>
        <div class="muted">請選擇要進入的管理項目</div>
      </div>
      <button id="logoutBtn" class="btn">登出</button>
    </div>

    <div class="grid">
      <div class="card" id="ledger">
        <h4>用戶記帳</h4>
        <div class="muted">查看或管理用戶的記帳紀錄</div>
      </div>

      <div class="card" id="loginLog">
        <h4>用戶登入</h4>
        <div class="muted">查看誰何時登入此平台</div>
      </div>

      <div class="card" id="orders">
        <h4>訂單管理</h4>
        <div class="muted">查看與管理用戶訂單</div>
      </div>
    </div>
  `;

  $('#logoutBtn', el)?.addEventListener('click', async ()=>{
    if(confirm('確定要登出嗎？')){
      try{ await signOut(auth); }catch(e){ alert('登出失敗：'+e.message); }
    }
  });

  // 之後可在此補上各選項的導向動作
  $('#ledger', el)?.addEventListener('click', ()=>alert('👉 用戶記帳（尚未實作）'));
  $('#loginLog', el)?.addEventListener('click', ()=>alert('👉 用戶登入紀錄（尚未實作）'));
  $('#orders', el)?.addEventListener('click', ()=>alert('👉 訂單管理（尚未實作）'));

  return el;
}

/* ───────── 主程式 ───────── */
export function AdminPage(){
  ensureAdminStyles();
  const root = document.createElement('div');
  root.innerHTML = '<div class="admin-shell"><p class="muted">載入中...</p></div>';

  getRedirectResult(auth).catch(()=>{});

  onAuthStateChanged(auth, user=>{
    if(!user){ showLogin(root); return; }
    root.replaceChildren(renderHome());
  });

  return root;
}
