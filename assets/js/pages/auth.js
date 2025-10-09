// /assets/js/pages/auth.js
// 以 Firebase 彈窗完成 Google 登入，並顯示你要的「使用 Google 登入」按鈕

// ---------- Firebase SDK（CDN ESM） ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";

// ⚠️ 換成你的 Firebase 設定
const firebaseConfig = {
  apiKey: "你的_API_KEY",
  authDomain: "你的專案ID.firebaseapp.com",
  projectId: "你的專案ID",
  appId: "你的_APP_ID"
};

// 初始化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// ---------- UI 樣式：自訂 Google 按鈕 ----------
const style = document.createElement("style");
style.textContent = `
  .btn-google{
    display:inline-block; padding:.6rem 1.2rem;
    border:1px solid #e6e6e6; color:#e6e6e6; background:transparent;
    border-radius:999px; font-size:16px; line-height:1; transition:.2s ease;
  }
  .btn-google:hover{ background:#e6e6e6; color:#0f1318; }
  .auth-card{max-width:460px;margin:40px auto;}
`;
document.head.appendChild(style);

// ---------- Render ----------
function render(root){
  root.innerHTML = `
    <div class="card p-4 auth-card">
      <h4 class="mb-3">帳號</h4>
      <p class="text-muted">請點擊按鈕以 Google 登入。</p>

      <div id="auth-area">
        <button id="btn-google" class="btn-google">使用 Google 登入</button>
      </div>

      <a href="./index.html" class="btn btn-outline-secondary mt-3">回首頁</a>
    </div>
  `;

  // 綁定登入事件
  const btn = root.querySelector('#btn-google');
  btn?.addEventListener('click', async ()=>{
    try{
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      console.log('登入成功 ✅', user);

      // 登入成功：你要做什麼？(導回首頁、或進入上一頁)
      location.href = './index.html';
    }catch(err){
      console.error('登入失敗 ❌', err);
      alert('登入失敗，請再試一次');
    }
  });

  // 即時顯示登入狀態（可選）
  onAuthStateChanged(auth, (user)=>{
    const area = root.querySelector('#auth-area');
    if(user){
      area.innerHTML = `
        <div class="alert alert-success d-flex align-items-center gap-2" role="alert">
          <span>已以 <strong>${user.displayName || user.email}</strong> 登入</span>
          <button id="btn-logout" class="btn btn-sm btn-outline-light ms-auto">登出</button>
        </div>
      `;
      area.querySelector('#btn-logout')?.addEventListener('click', async ()=>{
        await signOut(auth);
        location.reload();
      });
    }else{
      area.innerHTML = `<button id="btn-google" class="btn-google">使用 Google 登入</button>`;
      area.querySelector('#btn-google')?.addEventListener('click', async ()=>{
        try{
          await signInWithPopup(auth, provider);
          location.href = './index.html';
        }catch(err){
          console.error('登入失敗 ❌', err);
          alert('登入失敗，請再試一次');
        }
      });
    }
  });
}

// ---------- 匯出 & 自動掛載 ----------
export function AuthPage(host = document.getElementById('app')){
  if(!host) return console.warn('[auth] #app not found');
  render(host);
}

document.addEventListener('DOMContentLoaded', ()=>{
  const root = document.getElementById('app');
  if(root) AuthPage(root);
});
