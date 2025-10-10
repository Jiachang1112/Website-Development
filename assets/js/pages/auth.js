// assets/js/pages/auth.js
// -------------------- Firebase --------------------
import { db } from '../firebase.js';
import {
  doc, setDoc, serverTimestamp, collection, addDoc
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

// -------------------- 管理員白名單 --------------------
const ADMIN_EMAILS = ['bruce9811123@gmail.com']; // 可自行增減

// -------------------- session 小工具 --------------------
function readSession() {
  try { return JSON.parse(localStorage.getItem('session_user') || 'null'); }
  catch { return null; }
}
function writeSession(user) { localStorage.setItem('session_user', JSON.stringify(user)); }
function clearSession()      { localStorage.removeItem('session_user'); }

// -------------------- UI：左上歡迎膠囊 --------------------
function showWelcomeChip(name) {
  const anchor = document.getElementById('onetap-anchor');
  if (!anchor) return;
  anchor.innerHTML = `<div class="welcome-chip">👋 歡迎 ${name || ''}</div>`;
}

// -------------------- Firestore：主檔 + 登入紀錄 --------------------
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

async function writeLoginLog(kind, u) {
  const coll = kind === 'admin' ? 'admin_logs' : 'user_logs';
  const ref = collection(db, coll);
  const payload = {
    kind,
    email: u.email || '',
    name:  u.name  || '',
    uid:   u.sub   || '',
    providerId: 'google.com',
    userAgent: navigator.userAgent || '',
    ts: serverTimestamp(),
  };
  const docRef = await addDoc(ref, payload);
  console.info(`[${coll}] 寫入成功:`, docRef.id, payload);
}

// --- 去重：同一個 session 只寫一次 ---
function markLogged(kind) {
  sessionStorage.setItem(`_login_written_${kind}`, '1');
}
function alreadyLogged(kind) {
  return sessionStorage.getItem(`_login_written_${kind}`) === '1';
}

// 在「目前已知 user」的情況下，保險寫入一次（若未寫過）
async function ensureLoginLogged(currentUser) {
  if (!currentUser) return;
  const email = (currentUser.email || '').trim().toLowerCase();
  const kind  = ADMIN_EMAILS.includes(email) ? 'admin' : 'user';
  if (alreadyLogged(kind)) return;           // 避免重覆寫
  try {
    await upsertUserProfile(currentUser);
    await writeLoginLog(kind, currentUser);
    markLogged(kind);
  } catch (e) {
    console.error('寫入登入紀錄失敗：', e);
  }
}

// -------------------- GIS callback：解析 JWT 並寫入 --------------------
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
      sub:     payload.sub,   // 當 uid 用
    };

    writeSession(user);

    // 直接保險寫入一次（GIS 成功時）
    await ensureLoginLogged(user);

    try { google.accounts.id.cancel(); } catch {}
    showWelcomeChip(user.name);

    // 轉回首頁或你要的頁籤
    location.hash = '#dashboard';
    location.reload();
  } catch (e) {
    console.error('Google 登入解析/寫入失敗：', e);
    alert('登入失敗，請再試一次。');
  }
}

// -------------------- 帳號頁 UI --------------------
export function AuthPage() {
  const el = document.createElement('div');
  el.className = 'container card';

  const user = readSession();

  if (user) {
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

    // ✅ 如果頁面載入時就已經有 session（例如上次登入、或 One-Tap 被封鎖）
    //    這裡再保險寫一次 user/admin logs（同一 session 不重覆）
    ensureLoginLogged(user);

    el.querySelector('#logout').addEventListener('click', () => {
      clearSession();
      try { google.accounts.id.prompt(); } catch {}
      // 清掉本 session 的「已寫入」旗標
      sessionStorage.removeItem('_login_written_user');
      sessionStorage.removeItem('_login_written_admin');
      location.reload();
    });

    showWelcomeChip(user.name);
  } else {
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
    // ⚠️ 若先前就已登入但 One-Tap 被封鎖，這裡也會補寫一次
    ensureLoginLogged(user);
  } else {
    google.accounts.id.prompt(); // One-Tap；若被封鎖也不影響按鈕登入
  }
});

// 換頁時若未登入就再提示 One-Tap
window.addEventListener('hashchange', () => {
  try { if (!readSession()) google.accounts.id.prompt(); } catch {}
});
