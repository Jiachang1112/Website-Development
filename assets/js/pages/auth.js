// assets/js/pages/auth.js
// -------------------- Firebase --------------------
import { db } from '../firebase.js';
import {
  doc, setDoc, serverTimestamp, collection, addDoc,
  waitForPendingWrites
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

// -------------------- 管理員白名單 --------------------
const ADMIN_EMAILS = ['bruce9811123@gmail.com'];

// -------------------- session 小工具 --------------------
function readSession() {
  try { return JSON.parse(localStorage.getItem('session_user') || 'null'); }
  catch { return null; }
}
function writeSession(user) { localStorage.setItem('session_user', JSON.stringify(user)); }
function clearSession() { localStorage.removeItem('session_user'); }

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
  const kind = ADMIN_EMAILS.includes(email) ? 'admin' : 'user';
  if (alreadyLogged(kind)) return;

  await upsertUserProfile(currentUser);
  await writeLoginLog(kind, currentUser);
  await waitForPendingWrites(db);
  markLogged(kind);
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
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      sub: payload.sub,
    };

    writeSession(user);
    await ensureLoginLogged(user);

    try { google.accounts.id.cancel(); } catch {}
    showWelcomeChip(user.name);

    location.hash = '#dashboard';
    location.reload();
  } catch (e) {
    console.error('Google 登入解析/寫入失敗：', e);
    alert('登入失敗，請再試一次。');
  }
}

// -------------------- Google 按鈕覆蓋層 --------------------
function renderGoogleOverlay(mount) {
  if (!window.google?.accounts?.id) {
    setTimeout(() => renderGoogleOverlay(mount), 150);
    return;
  }
  console.log('[GIS] render button');
  google.accounts.id.renderButton(mount, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'signin_with',
    shape: 'rectangular',
    logo_alignment: 'left',
  });
  const inner = mount.querySelector('div');
  if (inner) {
    inner.style.width = '100%';
    inner.style.justifyContent = 'flex-start';
  }
}

// -------------------- 帳號頁 UI --------------------
export function AuthPage() {
  const el = document.createElement('div');
  el.className = 'container card login-card';

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
    ensureLoginLogged(user).catch(console.error);
    el.querySelector('#logout').addEventListener('click', () => {
      clearSession();
      try { google.accounts.id.prompt(); } catch {}
      sessionStorage.clear();
      location.reload();
    });
    showWelcomeChip(user.name);
    return el;
  }

  el.innerHTML = `
    <h2 class="login-title">登入</h2>
    <label class="input-label">電子郵件地址</label>
    <input id="email" class="input" type="email" placeholder="name@example.com" />
    <button id="continue" class="primary">繼續</button>

    <div class="divider"><span>或</span></div>

    <div id="btn-google-wrap" class="social">
      <span class="social-icon">G</span>
      <span>繼續使用 Google</span>
      <div id="gsi-btn" class="gsi-overlay"></div>
    </div>

    <button id="btn-facebook" class="social">
      <span class="social-icon">f</span> 繼續使用 Facebook
    </button>

    <button id="btn-line" class="social">
      <span class="social-icon">L</span> 繼續使用 LINE
    </button>

    <a class="ghost small" href="#dashboard" style="margin-top:8px;display:inline-block;">回首頁</a>
  `;

  el.querySelector('#continue').addEventListener('click', () => {
    const email = (el.querySelector('#email').value || '').trim();
    if (!email) { alert('請輸入電子郵件'); return; }
    localStorage.setItem('_last_email', email);
    try { google.accounts.id.prompt(); } catch {}
  });

  renderGoogleOverlay(el.querySelector('#gsi-btn'));
  el.querySelector('#btn-facebook').addEventListener('click', () => alert('Facebook 登入尚未啟用'));
  el.querySelector('#btn-line').addEventListener('click', () => alert('LINE 登入尚未啟用'));
  return el;
}

// -------------------- 初始化 GIS --------------------
const GIS_CLIENT_ID = '894572383995-cikj8ha4r2cge14vvugjggfajrjh1img.apps.googleusercontent.com';

window.addEventListener('load', () => {
  console.log('[GIS] init client_id =', GIS_CLIENT_ID);
  try { google.accounts.id.disableAutoSelect(); } catch {}

  if (!window.__GIS_INITIALIZED__) {
    window.__GIS_INITIALIZED__ = true;
    google.accounts.id.initialize({
      client_id: GIS_CLIENT_ID,
      callback: handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true,
    });
  }

  const user = readSession();
  if (user?.name) {
    showWelcomeChip(user.name);
    ensureLoginLogged(user).catch(console.error);
  } else {
    try { google.accounts.id.prompt(); } catch {}
  }
});

// 換頁時若未登入就再提示 One-Tap
window.addEventListener('hashchange', () => {
  try { if (!readSession()) google.accounts.id.prompt(); } catch {}
});
