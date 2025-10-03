// assets/js/pages/auth.js

// 1. 匯入 Firebase 相關功能
import { db } from '../firebase.js';
import {
  doc, setDoc, serverTimestamp,
  collection, addDoc
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

// 2. 這裡放你的 session 工具（readSession、writeSession、clearSession...）

// 3. 這裡放 handleCredentialResponse（Google 登入回傳的地方）
//    在裡面呼叫 upsertUser(user)

// 4. export function AuthPage() { ... }   ← UI 畫面

// 5. window.addEventListener('load', ...) ← 初始化 Google Identity

// 小工具：安全讀取/寫入 session_user
function readSession() {
  try { return JSON.parse(localStorage.getItem('session_user') || 'null'); }
  catch { return null; }
}
function writeSession(user) {
  localStorage.setItem('session_user', JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem('session_user');
}
async function upsertUser(user) {
  try {
    await setDoc(doc(db, "users", user.sub), {
      uid: user.sub,
      name: user.name,
      email: user.email,
      picture: user.picture,
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log("✅ 使用者已寫入 Firestore:", user.email);
  } catch (e) {
    console.error("❌ Firestore 寫入失敗:", e);
  }
}
// 產生歡迎小膠囊（頁面左上角）
function showWelcomeChip(name) {
  const anchor = document.getElementById('onetap-anchor');
  if (!anchor) return;
  anchor.innerHTML =
    `<div class="welcome-chip">👋 歡迎 ${name || ''}</div>`;
}

// Google 回傳憑證（JWT）→ 解析出使用者（含中文姓名正確解碼）
function handleCredentialResponse(response) {
  try {
    const token = response.credential;
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64).split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(json);

    const user = {
      email:   payload.email,
      name:    payload.name,
      picture: payload.picture,
      sub:     payload.sub
    };

    writeSession(user);

    // 關閉 One Tap 並顯示歡迎
    try { google.accounts.id.cancel(); } catch {}
    showWelcomeChip(user.name);

    // 讓你的 app 重新載入，切到有登入狀態（可改成只刷新區塊）
    location.hash = '#dashboard';
    location.reload();
  } catch (e) {
    console.error('解析 Google Token 失敗：', e);
    alert('Google 登入解析失敗，請再試一次。');
  }
  export function AuthPage() {
}

// ✅ 主畫面：帳號頁
export function AuthPage() {
  const el = document.createElement('div');
  el.className = 'container card';

  let user = readSession();

  if (user) {
    // 已登入畫面
    el.innerHTML = `
      <h3>帳號</h3>
      <div class="row">
        <img src="${user.picture || ''}" alt=""
             style="width:40px;height:40px;border-radius:50%;
             object-fit:cover;margin-right:8px">
        <div>
          <div><b>${user.name || ''}</b></div>
          <div class="small">${user.email || ''}</div>
        </div>
      </div>

      <div class="row" style="margin-top:10px">
        <button class="ghost" id="logout">登出</button>
        <a class="ghost" href="#dashboard">回首頁</a>
      </div>
    `;

    // 登出：清 session → 叫出 One Tap → 刷新
    el.querySelector('#logout').addEventListener('click', () => {
      clearSession();
      try { google.accounts.id.prompt(); } catch {}
      location.reload();
    });

    // 也在左上角顯示歡迎膠囊（避免刷新後沒顯示）
    showWelcomeChip(user.name);

  } else {
    // 未登入畫面：顯示 Google 登入按鈕容器（由 GSI 自動渲染）
    el.innerHTML = `
      <h3>帳號</h3>
      <p class="small">請下方的 Google 登入按鈕登入。</p>

      <div class="g_id_signin"
           data-type="standard"
           data-shape="rectangular"
           data-theme="outline"
           data-text="signin_with"
           data-size="large"
           data-logo_alignment="left"></div>

      <a class="ghost" href="#dashboard">回首頁</a>
    `;
  }

  return el;
}

/* ---------------------------- 初始化區塊 ---------------------------- */
/* 這段建議放在 index.html 的 <script type="module" src="assets/js/app.js"> 之前或同檔，
   只要在載入 AuthPage 之前執行一次即可 */

window.addEventListener('load', () => {
  // 先把自動選取登入關掉，避免殘留舊帳號
  try { google.accounts.id.disableAutoSelect(); } catch {}

  // 初始化 Google Identity Services
  google.accounts.id.initialize({
    client_id: "YOUR_GOOGLE_CLIENT_ID", // ← 改成你的 Client ID
    callback: handleCredentialResponse,
    auto_select: false,
    cancel_on_tap_outside: true
  });

  const user = readSession();
  if (user && user.name) {
    // 已登入：顯示歡迎徽章，不叫 One Tap
    showWelcomeChip(user.name);
  } else {
    // 未登入：叫出 One Tap 小膠囊
    google.accounts.id.prompt();
  }
});

// 只要 hash 換頁且未登入，就再嘗試叫出 One Tap（例如剛登出後轉跳頁籤）
window.addEventListener('hashchange', () => {
  try {
    const user = readSession();
    if (!user) { google.accounts.id.prompt(); }
  } catch {}
});
