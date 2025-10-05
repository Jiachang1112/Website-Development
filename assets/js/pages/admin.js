// assets/js/pages/admin.js
import { auth } from '../firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';
import { recordLogin } from '../analytics/login-logger.js';

// ✅ 你的管理員白名單
const ADMIN_EMAILS = ['bruce9811123@gmail.com', 'youradmin@domain.com'];

function isAdmin(user) {
  return ADMIN_EMAILS.includes(user.email);
}

// ===============================
// ✅ 後台首頁渲染
// ===============================
function renderAdmin(user) {
  const app = document.querySelector('#app');
  if (!app) return;
  if (!user) {
    app.innerHTML = `
      <div class="card bg-dark text-light p-4 text-center">
        <h4>管理員登入</h4>
        <button id="adminLoginBtn" class="btn btn-light mt-3">使用 Google 登入</button>
      </div>
    `;
    document.querySelector('#adminLoginBtn').onclick = async () => {
      const provider = new google.auth.GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    };
    return;
  }

  if (!isAdmin(user)) {
    app.innerHTML = `
      <div class="card bg-dark text-danger p-4 text-center">
        <h4>❌ 無權限</h4>
        <p>此帳號非管理員，請使用管理員帳號登入。</p>
        <button id="logoutBtn" class="btn btn-outline-light btn-sm mt-3">登出</button>
      </div>
    `;
    document.querySelector('#logoutBtn').onclick = () => signOut(auth);
    return;
  }

  app.innerHTML = `
    <div class="card bg-dark text-light p-4">
      <h4>👑 歡迎回來，${user.displayName || '管理員'}</h4>
      <div class="text-secondary small mb-3">${user.email}</div>
      <button id="logoutBtn" class="btn btn-outline-light btn-sm">登出</button>
      <button id="gotoPanel" class="btn btn-outline-secondary btn-sm ms-2">進入後台</button>
    </div>
  `;
  document.querySelector('#logoutBtn').onclick = () => signOut(auth);
  document.querySelector('#gotoPanel').onclick = () => (location.hash = '#dashboard');
}

// ===============================
// ✅ Firebase 狀態監聽 + 寫入登入紀錄
// ===============================
const ADMIN_LOG_KEY = 'll:lastAdminLog';

onAuthStateChanged(auth, (user) => {
  renderAdmin(user);
  if (!user || !isAdmin(user)) return;

  const sig = `${user.uid}:${new Date().toDateString()}`;
  if (localStorage.getItem(ADMIN_LOG_KEY) === sig) return;

  localStorage.setItem(ADMIN_LOG_KEY, sig);
  recordLogin('admin', user); // 🟢 寫入 Firestore，標記為 admin
});
