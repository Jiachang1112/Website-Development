// assets/js/pages/auth.js

// 1) Firestore
import { db } from '../firebase.js';
import {
  collection, addDoc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

/* ------------------------------------------------------------------ */
/* 你可以在這裡調整：只要出現在這個清單裡的 email，就視為 admin                   */
/* ------------------------------------------------------------------ */
const ADMIN_EMAILS = ['bruce9811123@gmail.com'];   // ← 換成你的清單（可多個）

/* ------------------------- Session 小工具 -------------------------- */
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

/* ---------------------- UI：歡迎小膠囊（左上） --------------------- */
function showWelcomeChip(name) {
  const anchor = document.getElementById('onetap-anchor');
  if (!anchor) return;
  anchor.innerHTML = `<div class="welcome-chip">👋 歡迎 ${name || ''}</div>`;
}

/* ------------------------- 寫入 Firestore ------------------------- */
/** 將登入事件寫到 Firestore：login_logs + (admin_logs | user_logs) */
async function logLoginToFirestore(user) {
  const kind = ADMIN_EMAILS.includes(String(user.email || '').toLowerCase())
    ? 'admin' : 'user';

  const payload = {
    uid:        user.sub || user.uid || '',       // GSI 的 sub 當成 uid
    name:       user.name || '',
    email:      user.email || '',
    providerId: 'google.com',
    ts:         serverTimestamp(),
    userAgent:  navigator.userAgent || '',
    kind,
  };

  // 統一記錄：login_logs
  await addDoc(collection(db, 'login_logs'), payload);

  // 依身份記錄：admin_logs 或 user_logs
  const target = kind === 'admin' ? 'admin_logs' : 'user_logs';
  await addDoc(collection(db, target), payload);
}

/* --------------------- Google One Tap 回呼 ------------------------ */
/** Google 回傳憑證（JWT）→ 解析出使用者（含中文姓名正確解碼） */
async function handleCredentialResponse(response) {
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

    // GSI 使用者物件
    const user = {
      email:   payload.email,
      name:    payload.name,
      picture: payload.picture,
      sub:     payload.sub,     // 當作 uid 使用
    };

    // 寫 session、關閉 One Tap、顯示歡迎
    writeSession(user);
    try { google.accounts.id.cancel(); } catch {}
    showWelcomeChip(user.name);

    // ✨ 寫入 Firestore（login_logs + admin/user_logs）
    try {
      await logLoginToFirestore(user);
    } catch (err) {
      console.warn('寫入登入紀錄失敗（不影響登入）：', err);
    }

    // 讓你的 app 重新載入，切到有登入狀態（可改成只刷新區塊）
    location.hash = '#dashboard';
    location.reload();

  } catch (e) {
    console.error('解析 Google Token 失敗：', e);
    alert('Google 登入解析失敗，請再試一次。');
  }
}

/* --------------------------- 帳號頁 UI ---------------------------- */
export function AuthPage() {
  const el = document.createElement('div');
  el.className = 'container card';

  const user = readSession();

  if (user) {
    // 已登入
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

    // 登出
    el.querySelector('#logout').addEventListener('click', () => {
      clearSession();
      try { google.accounts.id.prompt(); } catch {}
      location.reload();
    });

    // 避免刷新後沒顯示
    showWelcomeChip(user.name);

  } else {
    // 未登入（由 GSI 自動渲染按鈕）
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

/* --------------------------- 初始化 ------------------------------- */
/* 這段建議放在載入 AuthPage 之前只要執行一次即可 */
window.addEventListener('load', () => {
  try { google.accounts.id.disableAutoSelect(); } catch {}

  google.accounts.id.initialize({
    client_id: "YOUR_GOOGLE_CLIENT_ID", // ← 改成你的 GSI Client ID
    callback: handleCredentialResponse,
    auto_select: false,
    cancel_on_tap_outside: true,
  });

  const user = readSession();
  if (user && user.name) {
    showWelcomeChip(user.name);
  } else {
    google.accounts.id.prompt();
  }
});

// 路由切換時，若未登入就再嘗試叫出 One Tap（例如剛登出後轉跳頁籤）
window.addEventListener('hashchange', () => {
  try {
    const user = readSession();
    if (!user) google.accounts.id.prompt();
  } catch {}
});
