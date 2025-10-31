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
      email:   payload.email,
      name:    payload.name,
      picture: payload.picture,
      sub:     payload.sub,   // 當 uid 用
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

// -------------------- 工具：渲染官方 Google 按鈕到覆蓋層 --------------------
function renderGoogleOverlay(mount) {
  if (!window.google?.accounts?.id) {
    // 若 script 尚未載入，稍後再試
    setTimeout(() => renderGoogleOverlay(mount), 150);
    return;
    }
  google.accounts.id.renderButton(mount, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'signin_with',
    shape: 'rectangular',
    logo_alignment: 'left',
  });
  // 撐滿父層寬度並左對齊，與 FB/LINE 視覺一致
  const inner = mount.querySelector('div');
  if (inner) {
    inner.style.width = '100%';
    inner.style.justifyContent = 'flex-start';
  }
}

// -------------------- 帳號頁 UI（Google 外觀與 FB/LINE 一致） --------------------
export function AuthPage() {
  const el = document.createElement('div');
  el.className = 'container card login-card';

  //（一次性）插入必要樣式
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

      .social { width:100%; margin-top:10px; padding:12px 14px;
                border:1px solid #dcdfe6; border-radius:8px; background:#fff;
                font-size:16px; cursor:pointer; display:flex; align-items:center; gap:10px;
                justify-content:flex-start; position: relative; }
      .social:active { transform: translateY(1px); }
      .social-icon { width:20px; display:inline-block; text-align:center; }

      .small { font-size:12px; color:#758198; }
      .ghost { color:#7aa2ff; text-decoration:none; }
      .ghost:hover { text-decoration:underline; }

      /* 官方 GSI 透明覆蓋層：鋪滿社群鈕並吃點擊 */
      .gsi-overlay { position:absolute; inset:0; opacity:0; pointer-events:auto; }
      /* 讓官方 GSI 內容撐滿寬度 */
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

  // 未登入 → Email → 繼續 → 或 → Google（官方覆蓋）＋ FB/LINE（placeholder）
  el.innerHTML = `
    <h2 class="login-title">登入</h2>

    <label class="input-label">電子郵件地址</label>
    <input id="email" class="input" type="email" placeholder="name@example.com" autocomplete="email" />

    <button id="continue" class="primary">繼續</button>

    <div class="divider"><span>或</span></div>

    <!-- Google：外觀與 FB/LINE 相同，內部是官方按鈕的透明覆蓋層 -->
    <div id="btn-google-wrap" class="social" role="button" tabindex="0" aria-label="使用 Google 帳戶登入">
      <span class="social-icon">G</span>
      <span>繼續使用 Google</span>
      <div id="gsi-btn" class="gsi-overlay" aria-hidden="false"></div>
    </div>

    <button id="btn-facebook" class="social">
      <span class="social-icon">f</span> 繼續使用 Facebook
    </button>

    <button id="btn-line" class="social">
      <span class="social-icon">L</span> 繼續使用 LINE
    </button>

    <a class="ghost small" href="#dashboard" style="margin-top:8px; display:inline-block;">回首頁</a>
  `;

  // 預填 email（純 UI 友善）
  const emailEl = el.querySelector('#email');
  const lastEmail = localStorage.getItem('_last_email') || '';
  if (lastEmail) emailEl.value = lastEmail;

  el.querySelector('#continue').addEventListener('click', () => {
    const email = (emailEl.value || '').trim();
    if (!email) { alert('請先輸入電子郵件'); return; }
    localStorage.setItem('_last_email', email);
    try { google.accounts.id.prompt(); } catch {}
  });

  // 把官方 Google Sign-In 按鈕渲染到透明覆蓋層
  renderGoogleOverlay(el.querySelector('#gsi-btn'));

  // 先放 placeholder（之後接 SDK）
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
    client_id: '577771534429-csromh0ttuk718chvgh66eqf6if3r5cg.apps.googleusercontent.com', // ✅ 你目前「可用」的 Client ID
    callback: handleCredentialResponse,
    auto_select: false,
    cancel_on_tap_outside: true,
  });

  const user = readSession();
  if (user?.name) {
    showWelcomeChip(user.name);
    ensureLoginLogged(user).catch(console.error);
  } else {
    // 有就顯示 One-Tap；被抑制也沒關係，頁面有可點的官方按鈕
    google.accounts.id.prompt();
  }
});

// 換頁時若未登入就再提示 One-Tap
window.addEventListener('hashchange', () => {
  try { if (!readSession()) google.accounts.id.prompt(); } catch {}
});
