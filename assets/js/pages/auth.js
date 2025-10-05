// assets/js/pages/auth.js
import { auth } from '../firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';
import { recordLogin } from '../analytics/login-logger.js';

// ===============================
// ✅ 帳號登入頁面邏輯
// ===============================
function renderAccount(user) {
  const app = document.querySelector('#app');
  if (!app) return;
  app.innerHTML = `
    <div class="card bg-dark text-light p-4">
      <h4>帳號</h4>
      ${
        user
          ? `
        <div class="d-flex align-items-center gap-3 mt-3">
          <img src="${user.photoURL || 'https://i.imgur.com/8Km9tLL.png'}" class="rounded-circle" width="48" height="48">
          <div>
            <div class="fw-bold">${user.displayName || '(未命名)'}</div>
            <div class="small text-secondary">${user.email || '-'}</div>
          </div>
        </div>
        <div class="mt-3 d-flex gap-2">
          <button id="logoutBtn" class="btn btn-outline-light btn-sm">登出</button>
          <button id="homeBtn" class="btn btn-outline-secondary btn-sm">回首頁</button>
        </div>`
          : `
        <p class="mt-3">尚未登入</p>
        <button id="loginBtn" class="btn btn-light">使用 Google 登入</button>
      `
      }
    </div>
  `;

  if (user) {
    document.querySelector('#logoutBtn').onclick = () => signOut(auth);
    document.querySelector('#homeBtn').onclick = () => (location.hash = '#home');
  } else {
    document.querySelector('#loginBtn').onclick = async () => {
      const provider = new google.auth.GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    };
  }
}

// ===============================
// ✅ 自動偵測登入狀態
// ===============================
const USER_LOG_KEY = 'll:lastUserLog';

onAuthStateChanged(auth, (user) => {
  renderAccount(user);
  if (!user) return;

  // 避免重複寫入（同日只寫一次）
  const sig = `${user.uid}:${new Date().toDateString()}`;
  if (localStorage.getItem(USER_LOG_KEY) === sig) return;

  localStorage.setItem(USER_LOG_KEY, sig);
  recordLogin('user', user); // 🟢 寫入 Firestore，標記為 user
});
