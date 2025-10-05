// assets/js/pages/user-login.js
// 「用戶登入」頁：分成兩顆按鈕（用戶登入 / 管理員登入），並分別記錄 kind

import { auth } from '../firebase.js';
import { recordLogin } from '../analytics/login-logger.js';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';

const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

/* ---------- UI：簡單的面板（可照你網站風格改） ---------- */
function render(container){
  container.innerHTML = `
    <div class="admin-shell">
      <div class="kcard kpad" style="max-width:680px;margin:auto">
        <div class="hd" style="margin-bottom:12px">
          <div class="hd-title">用戶／管理員登入</div>
          <div class="meta">請選擇登入身份，登入後將寫入登入紀錄</div>
        </div>

        <div class="d-flex flex-column gap-2">
          <button id="btnUser" class="btn btn-primary">
            使用 Google 登入（用戶）
          </button>
          <button id="btnAdmin" class="btn btn-outline-warning">
            使用 Google 登入（管理員）
          </button>
        </div>

        <hr class="my-3">

        <div id="who" class="meta">尚未登入</div>
        <div class="d-flex gap-2 mt-2">
          <button id="btnLogout" class="btn btn-outline-danger btn-sm" disabled>登出</button>
          <a href="#dashboard" class="btn btn-outline-light btn-sm">回首頁</a>
        </div>

        <div id="msg" class="text-danger small mt-2"></div>
      </div>
    </div>
  `;
}

/* ---------- 登入邏輯：用戶／管理員分別記錄 kind ---------- */
function makeLogin(kind){
  return async ()=>{
    $('#msg').textContent = '';
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try{
      const cred = await signInWithPopup(auth, provider);
      // ✅ 立即寫入 Firestore，標記這次是 user or admin
      await recordLogin(kind, cred.user);
    }catch(e){
      // 視窗被阻擋時，fallback 到 redirect
      if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/cancelled-popup-request'){
        try{
          await signInWithRedirect(auth, provider);
          // redirect 回來後會在 getRedirectResult() 再記錄
          sessionStorage.setItem('login-kind', kind);
        }catch(err){
          $('#msg').textContent = err.message || '登入失敗';
        }
      }else{
        $('#msg').textContent = e.message || '登入失敗';
      }
    }
  };
}

/* ---------- 監聽登入狀態，更新畫面 ---------- */
function bindAuthUI(root){
  $('#btnUser', root).addEventListener('click', makeLogin('user'));
  $('#btnAdmin', root).addEventListener('click', makeLogin('admin'));
  $('#btnLogout', root).addEventListener('click', async ()=>{
    try{ await signOut(auth); }catch(e){ /* ignore */ }
  });

  // redirect 登入返回後，補記錄（避免 popup 被阻擋）
  getRedirectResult(auth).then(async (cred)=>{
    const u = cred?.user;
    if (u){
      const kind = sessionStorage.getItem('login-kind') || 'user';
      sessionStorage.removeItem('login-kind');
      await recordLogin(kind, u);
    }
  }).catch(()=>{});

  onAuthStateChanged(auth, (user)=>{
    const who = $('#who', root);
    const btnLogout = $('#btnLogout', root);
    if (user){
      who.textContent = `已登入：${user.displayName || '(未提供姓名)'} ＜${user.email || ''}＞`;
      btnLogout.disabled = false;
    }else{
      who.textContent = '尚未登入';
      btnLogout.disabled = true;
    }
  });
}

/* ---------- 導出：提供掛載函式 ---------- */
export function UserLoginPage(mountEl){
  const root = mountEl || document.body;
  render(root);
  bindAuthUI(root);
  return root;
}

/* 若你是直接用 <script type="module"> 引入，也可自動掛到 #app（可自行刪除） */
const auto = document.querySelector('[data-user-login-page], #user-login-page, #app');
if (auto) {
  try { UserLoginPage(auto); } catch {}
}
