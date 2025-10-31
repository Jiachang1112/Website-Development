// assets/js/pages/user-login.js
// 用戶登入頁面：分為「用戶登入」與「管理員登入」

import { auth } from '../../firebase.js';
import { recordLogin } from '../analytics/login-logger.js';
import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';

const provider = new GoogleAuthProvider();
const statusBox = document.querySelector('#loginStatus');

// 登入流程（傳入 kind: 'user' 或 'admin'）
async function login(kind) {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    statusBox.textContent = `✅ 登入成功：${user.displayName}`;
    await recordLogin(kind, user);
  } catch (err) {
    statusBox.textContent = `❌ 登入失敗：${err.message}`;
  }
}

// 綁定按鈕事件
document.querySelector('#userLogin').addEventListener('click', () => login('user'));
document.querySelector('#adminLogin').addEventListener('click', () => login('admin'));

// 監聽登入狀態
onAuthStateChanged(auth, (user) => {
  if (user) {
    statusBox.textContent = `已登入：${user.displayName} (${user.email})`;
  } else {
    statusBox.textContent = '尚未登入';
  }
});
