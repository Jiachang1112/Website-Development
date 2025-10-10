// assets/js/pages/auth.js
// 需要：assets/js/firebase.js 已正確初始化並 export { db }

import { db } from '../firebase.js';
import {
  collection, addDoc, doc, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

/* ------------------------ 基本設定 ------------------------ */
// 管理員白名單（小寫）
const ADMIN_EMAILS = ['bruce9811123@gmail.com'];

// 你的 Google Client ID（務必改成自己的）
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID';

/* ------------------------ Session 工具 ------------------------ */
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

/* ------------------------ UI 小膠囊 ------------------------ */
function showWelcomeChip(name) {
  const anchor = document.getElementById('onetap-anchor');
  if (!anchor) return;
  anchor.innerHTML = `<div class="welcome-chip">👋 歡迎 ${name || ''}</div>`;
}

/* ------------------------ Firestore 寫入 ------------------------ */
// 使用者基本資料 upsert 到 users/{uid}
async function upsertUserProfile(user) {
  const uid = user.sub || user.uid || '';
  if (!uid) return;
  await setDoc(
    doc(db, 'users', uid),
    {
      email: user.email || '',
      name: user.name || '',
      picture: user.picture || '',
      providerId: 'google.com',
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

// 把 7 個欄位寫到 login_logs + admin_logs/user_logs
async function logLoginToFirestore(user) {
  const email = String(user.email || '').toLowerCase();
  const isAdmin = ADMIN_EMAILS.includes(email);
  const kind = isAdmin ? 'admin' : 'user';

  const payload = {
    email:      user.email || '',
    kind,                               // 'admin' | 'user'
    name:       user.name || '',
    providerId: 'google.com',
    ts:         serverTimestamp(),
    uid:        user.sub || user.uid || '',
    userAgent:  navigator.userAgent || '',
  };

  // 1) 彙總
  await addDoc(collection(db, 'login_logs'), payload);
  // 2) 依身分分類
  const target = isAdmin ? 'admin_logs' : 'user_logs';
  await addDoc(collection(db, target), payload);
}

/* ------------------------ Google 登入回呼 ------------------------ */
// 解析 One Tap 回傳的 JWT，取得 email/name/picture/sub
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

    const user = {
      email:   payload.email,
      name:    payload.name,
      picture: payload.picture,
      sub:     payload.sub,      // 當作 uid 使用
    };

    // 寫 session 供前端顯示
    writeSession(user);

    // 關掉 one-tap 並顯示歡迎
    try { google.accounts.id.cancel(); } catch {}
    showWelcomeChip(user.name);

    // 同步使用者資料 & 登入紀錄
    try { await upsertUserProfile(user); } catch (e) { console.warn('upsert user 失敗', e); }
    try { await logLoginToFirestore(user); } catch (e) { console.warn('寫登入紀錄失敗', e); }

    // 切頁 + 重新整理（你也可以改成只重繪區塊）
    location.hash = '#dashboard';
    location.reload();
  } catch (e) {
    console.error('解析 Google Token 失敗：', e);
    alert('Google 登入解析失敗，請再試一次。');
  }
}

/* ------------------------ 頁面 UI ------------------------ */
export function AuthPage() {
  const el = document.createElement('div');
  el.className = 'container card';

  const user = readSession();

  if (user) {
    el.innerHTML = `
      <h3>帳號</h3>
      <div class="row">
        <img src="${user.picture || ''}" alt=""
             style="width:40px;height:40px;border-radius:50%;object-fit:cover;margin-right:8px">
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

    el.querySelector('#logout').addEventListener('click', () => {
      clearSession();
      try { google.accounts.id.prompt(); } catch {}
      location.reload();
    });

    // 保險：刷新後也顯示歡迎
    showWelcomeChip(user.name);

  } else {
    // 未登入畫面：GSI 會自動把按鈕渲染進這個容器
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

/* ------------------------ 初始化 GSI ------------------------ */
function initGSI() {
  if (!window.google || !google.accounts || !google.accounts.id) return;

  try { google.accounts.id.disableAutoSelect(); } catch {}

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse,
    auto_select: false,
    cancel_on_tap_outside: true,
    context: 'signin',
  });

  const user = readSession();
  if (user && user.name) {
    showWelcomeChip(user.name);      // 已登入就不再叫 one-tap
  } else {
    google.accounts.id.prompt();     // 未登入叫 one-tap
  }
}

window.addEventListener('load', () => {
  // 若 GSI script 還沒載入就等一下再嘗試（避免偶發 race）
  if (window.google && google.accounts && google.accounts.id) {
    initGSI();
  } else {
    const timer = setInterval(() => {
      if (window.google && google.accounts && google.accounts.id) {
        clearInterval(timer);
        initGSI();
      }
    }, 150);
    setTimeout(() => clearInterval(timer), 5000);
  }
});

// hash 換頁剛登出 → 再嘗試叫 one-tap
window.addEventListener('hashchange', () => {
  try {
    const user = readSession();
    if (!user && window.google && google.accounts && google.accounts.id) {
      google.accounts.id.prompt();
    }
  } catch {}
});
