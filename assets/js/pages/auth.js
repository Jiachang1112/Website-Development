// assets/js/pages/auth.js
// ----------------------------------------------------
// 這版直接用 GIS 的 JWT 寫入 Firestore（不依賴 Firebase Auth）
// ----------------------------------------------------

// -------------------- Firebase --------------------
import { db } from '../firebase.js';
import {
  doc, setDoc, serverTimestamp, collection, addDoc
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

// -------------------- 管理員白名單 --------------------
const ADMIN_EMAILS = ['bruce9811123@gmail.com']; // 需要的話可加更多

// -------------------- session 小工具 --------------------
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

// -------------------- UI：左上歡迎膠囊 --------------------
function showWelcomeChip(name) {
  const anchor = document.getElementById('onetap-anchor');
  if (!anchor) return;
  anchor.innerHTML = `<div class="welcome-chip">👋 歡迎 ${name || ''}</div>`;
}

// -------------------- 寫入 Firestore --------------------
// upsert 使用者主檔：users/{uid}
async function upsertUserProfile(u) {
  const uid = u.sub || u.uid;
  if (!uid) return;

  const ref = doc(db, 'users', uid);
  await setDoc(ref, {
    uid,
    email: u.email || '',
    name: u.name || '',
    picture: u.picture || '',
    providerId: 'google.com',
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  }, { merge: true });
}

// 寫入登入紀錄：user_logs 或 admin_logs
async function writeLoginLog(kind, u) {
  const coll = kind === 'admin' ? 'admin_logs' : 'user_logs';
  const ref = collection(db, coll);
  const payload = {
    kind,                              // 'user' | 'admin'
    email: u.email || '',
    name: u.name || '',
    uid: u.sub || '',                  // Google 的唯一識別 sub
    providerId: 'google.com',
    userAgent: navigator.userAgent || '',
    ts: serverTimestamp(),
  };
  const docRef = await addDoc(ref, payload);
  console.info(`[${coll}] 寫入成功:`, docRef.id, payload);
}

// -------------------- GIS callback：解析 JWT 並寫入 --------------------
async function handleCredentialResponse(response) {
  try {
    // 解析 Google JWT
    const token = response.credential;
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64).split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(json);

    // 取出使用者資料
    const user = {
      email:   payload.email,
      name:    payload.name,
      picture: payload.picture,
      sub:     payload.sub,   // 當 uid 用
    };

    // 存到 session（讓 UI 顯示）
    writeSession(user);

    // 判斷 user / admin
    const email = (user.email || '').trim().toLowerCase();
    const kind  = ADMIN_EMAILS.includes(email) ? 'admin' : 'user';

    // Firestore：主檔 + 登入紀錄
    await upsertUserProfile(user);
    await writeLoginLog(kind, user);

    // 關掉 OneTap、打招呼
    try { google.accounts.id.cancel(); } catch {}
    showWelcomeChip(user.name);

    // 跳回首頁或你要的頁籤
    location.hash = '#dashboard';
    location.reload();

  } catch (e) {
    console.error('Google 登入解析/寫入失敗：', e);
    alert('登入失敗，請再試一次。詳細請看主控台 Console。');
  }
}

// -------------------- 帳號頁 UI --------------------
export function AuthPage() {
  const el = document.createElement('div');
  el.className = 'container card';

  const user = readSession();
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

    el.querySelector('#logout').addEventListener('click', () => {
      clearSession();
      try { google.accounts.id.prompt(); } catch {}
      location.reload();
    });

    showWelcomeChip(user.name);
  } else {
    // 未登入畫面
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

// -------------------- 初始化 GIS（載入一次即可） --------------------
window.addEventListener('load', () => {
  try { google.accounts.id.disableAutoSelect(); } catch {}

  google.accounts.id.initialize({
    client_id: 'YOUR_GOOGLE_CLIENT_ID',   // ← 換成你的 GIS Client ID
    callback: handleCredentialResponse,
    auto_select: false,
    cancel_on_tap_outside: true,
  });

  const user = readSession();
  if (user?.name) {
    showWelcomeChip(user.name);
  } else {
    google.accounts.id.prompt();
  }
});

// 換頁時若未登入就再提示 OneTap
window.addEventListener('hashchange', () => {
  try { if (!readSession()) google.accounts.id.prompt(); } catch {}
});
