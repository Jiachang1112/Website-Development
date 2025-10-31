// assets/js/pages/auth.js
// -------------------- Firebase --------------------
import { db } from '../firebase.js';
import {
  doc, setDoc, serverTimestamp, collection, addDoc,
  waitForPendingWrites
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

// -------------------- 管理員白名單 --------------------
const ADMIN_EMAILS = ['bruce9811123@gmail.com']; // ← 這些帳號會寫入 admin_logs

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

  await upsertUserProfile(currentUser);
  await writeLoginLog(kind, currentUser);
  await waitForPendingWrites(db); // ✅ 等 Firestore 寫入完成再繼續
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
      email:   payload.email,
      name:    payload.name,
      picture: payload.picture,
      sub:     payload.sub,   // 當 uid 用
    };

    writeSession(user);

    // ✅ 寫入 Firestore 並等待完成
    await ensureLoginLogged(user);

    // 關掉 OneTap 並顯示歡迎
    try { google.accounts.id.cancel(); } catch {}
    showWelcomeChip(user.name);

    // 轉回首頁或其他頁面
    location.hash = '#dashboard';
    location.reload();
  } catch (e) {
    console.error('Google 登入解析/寫入失敗：', e);
    alert('登入失敗，請再試一次。');
  }
}

// -------------------- 帳號頁 UI（新版：像截圖） --------------------
export function AuthPage() {
  const el = document.createElement('div');
  el.className = 'container card login-card';

  //（一次性）插入必要樣式，若你有自己的 CSS，之後可把這段搬走
  if (!document.getElementById('login-page-inline-style')) {
    const style = document.createElement('style');
    style.id = 'login-page-inline-style';
    style.textContent = `
      .login-card { max-width:520px; margin:40px auto; padding:28px 24px; }
      .login-title { font-size:28px; margin:0 0 18px 0; }
      .input-label { font-size:14px; color:#b7c1d1; display:block; margin-bottom:6px; }
      .input { width:100%; padding:12px 14px; border:1px solid #2b3340; background:#101622; color:#e6eefc;
               border-radius:8px; font-size:16px; outline:none; }
      .input:focus { border-color:#409eff; box-shadow:0 0 0 3px rgba(64,158,255,.15); }
      .primary { width:100%; margin-top:12px; padding:12px 14px; border:none; border-radius:8px; font-size:16px;
                 cursor:pointer; background:#2b62ff; color:#fff; }
      .primary:active { transform: translateY(1px); }
      .divider { display:flex; align-items:center; gap:12px; margin:18px 0; color:#758198; }
      .divider::before, .divider::after { content:""; height:1px; background:#2b3340; flex:1; }
      .social { width:100%; margin-top:10px; padding:12px 14px; border:1px solid #2b3340; border-radius:8px;
                background:#fff; font-size:16px; cursor:pointer; display:flex; align-items:center; gap:10px;
                justify-content:flex-start; }
      .social:active { transform: translateY(1px); }
      .social-icon { width:20px; display:inline-block; text-align:center; }
      .small { font-size:12px; color:#758198; }
      .ghost { color:#7aa2ff; text-decoration:none; }
      .ghost:hover { text-decoration:underline; }
      /* 讓官方 GSI 按鈕撐滿寬度 */
      #gsi-btn > div { width:100% !important; justify-content:flex-start !important; }
    `;
    document.head.appendChild(style);
  }

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

    // 若上次登入資料存在，補寫一次（不 reload）
    ensureLoginLogged(user).catch(console.error);

    el.querySelector('#logout').addEventListener('click', () => {
      clearSession();
      try { google.accounts.id.prompt(); } catch {}
      sessionStorage.removeItem('_login_written_user');
      sessionStorage.removeItem('_login_written_admin');
      location.reload();
    });

    showWelcomeChip(user.name);
    return el;
  }

  // 未登入 → 顯示「Email → 繼續」＋第三方登入按鈕（Google 用官方 renderButton）
  el.innerHTML = `
    <h2 class="login-title">登入</h2>

    <label class="input-label">電子郵件地址</label>
    <input id="email" class="input" type="email" placeholder="name@example.com" autocomplete="email" />

    <button id="continue" class="primary">繼續</button>

    <div class="divider"><span>或</span></div>

    <div id="gsi-btn" style="margin-top:10px;"></div>

    <button id="btn-facebook" class="social">
      <span class="social-icon">f</span> 繼續使用 Facebook
    </button>

    <button id="btn-line" class="social">
      <span class="social-icon">L</span> 繼續使用 LINE
    </button>

    <a class="ghost small" href="#dashboard" style="margin-top:8px; display:inline-block;">回首頁</a>
  `;

  // 預填上次輸入的 email（純 UI 友善）
  const emailEl = el.querySelector('#email');
  const lastEmail = localStorage.getItem('_last_email') || '';
  if (lastEmail) emailEl.value = lastEmail;

  // 「繼續」：暫存 email；你之後要做 magic link / 密碼可在這裡接
  el.querySelector('#continue').addEventListener('click', () => {
    const email = (emailEl.value || '').trim();
    if (!email) { alert('請先輸入電子郵件'); return; }
    localStorage.setItem('_last_email', email);
    // 可選：也可以在此嘗試 One Tap（若未被瀏覽器抑制）
    try { google.accounts.id.prompt(); } catch {}
  });

  // 渲染官方 Google Sign-In 按鈕（點擊後會進到 handleCredentialResponse）
  const gsiMount = el.querySelector('#gsi-btn');
  if (window.google?.accounts?.id) {
    google.accounts.id.renderButton(gsiMount, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      width: '100',
    });
  } else {
    console.warn('Google Identity Services 尚未載入');
  }

  // 其他兩顆先佔位
  el.querySelector('#btn-facebook').addEventListener('click', () => {
    alert('Facebook 登入尚未接上（之後可接 FB SDK）');
  });
  el.querySelector('#btn-line').addEventListener('click', () => {
    alert('LINE 登入尚未接上（之後可接 LINE Login）');
  });

  return el;
}

// -------------------- 初始化 GIS --------------------
window.addEventListener('load', () => {
  try { google.accounts.id.disableAutoSelect(); } catch {}

  google.accounts.id.initialize({
    client_id: '577771534429-csromh0ttuk718chvgh66eqf6if3r5cg.apps.googleusercontent.com', // ✅ 你的 GIS Client ID
    callback: handleCredentialResponse,
    auto_select: false,
    cancel_on_tap_outside: true,
  });

  const user = readSession();
  if (user?.name) {
    showWelcomeChip(user.name);
    ensureLoginLogged(user).catch(console.error);
  } else {
    // 顯示 One-Tap（若被抑制也沒關係，頁面上仍有官方 Sign-In 按鈕）
    google.accounts.id.prompt();
  }
});

// 換頁時若未登入就再提示 One-Tap
window.addEventListener('hashchange', () => {
  try { if (!readSession()) google.accounts.id.prompt(); } catch {}
});
