import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";

// ⚠️ 換成你的 Firebase 設定
const firebaseConfig = {
  apiKey: "你的_API_KEY",
  authDomain: "你的專案ID.firebaseapp.com",
  projectId: "你的專案ID",
  appId: "你的_APP_ID",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// 建議：維持登入狀態
await setPersistence(auth, browserLocalPersistence);

// 登入按鈕點擊：先嘗試 Popup，失敗再改 Redirect
async function loginWithGoogle() {
  try {
    await signInWithPopup(auth, provider);
    location.href = "./index.html";
  } catch (err) {
    console.warn("Popup 失敗，改用 Redirect：", err.code, err.message);

    // 這幾種情境常見：彈窗被阻擋、環境不支援 popup、iOS Safari
    const fallbackCodes = [
      "auth/popup-blocked",
      "auth/popup-closed-by-user",
      "auth/operation-not-supported-in-this-environment",
      "auth/internal-error",
    ];
    if (fallbackCodes.includes(err.code)) {
      await signInWithRedirect(auth, provider);
      return;
    }

    // 未授權網域：去 Firebase Console 加入 jiachang1112.github.io
    if (err.code === "auth/unauthorized-domain") {
      alert("未授權網域：請到 Firebase > Authentication > Settings > Authorized domains 加入 jiachang1112.github.io");
      return;
    }

    // 其他錯誤：顯示 code 方便排查
    alert(`登入失敗（${err.code}）：${err.message}`);
  }
}

// Redirect 回來後，這裡會拿到結果
getRedirectResult(auth).then((result) => {
  if (result?.user) {
    location.href = "./index.html";
  }
}).catch((err) => {
  console.error("Redirect 登入失敗：", err.code, err.message);
  if (err.code === "auth/unauthorized-domain") {
    alert("未授權網域：請到 Firebase > Authentication > Settings > Authorized domains 加入 jiachang1112.github.io");
  }
});

// ====== 簡單的 UI（沿用你現在那顆圓角按鈕） ======
const style = document.createElement("style");
style.textContent = `
  .btn-google{display:inline-block;padding:.6rem 1.2rem;border:1px solid #e6e6e6;color:#e6e6e6;background:transparent;border-radius:999px;font-size:16px;line-height:1;transition:.2s}
  .btn-google:hover{background:#e6e6e6;color:#0f1318}
  .auth-card{max-width:460px;margin:40px auto}
`;
document.head.appendChild(style);

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
  root.querySelector('#btn-google')?.addEventListener('click', loginWithGoogle);
  onAuthStateChanged(auth, user=>{
    if(user){
      root.querySelector('#auth-area').innerHTML = `
        <div class="alert alert-success d-flex align-items-center gap-2">
          <span>已以 <strong>${user.displayName||user.email}</strong> 登入</span>
          <button id="btn-logout" class="btn btn-sm btn-outline-light ms-auto">登出</button>
        </div>`;
      root.querySelector('#btn-logout')?.addEventListener('click', ()=>signOut(auth).then(()=>location.reload()));
    }
  });
}

export function AuthPage(host = document.getElementById('app')) {
  if (!host) return;
  render(host);
}
document.addEventListener('DOMContentLoaded', ()=>{
  const root = document.getElementById('app');
  if(root) AuthPage(root);
});
