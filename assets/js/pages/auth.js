// assets/js/pages/auth.js
// -------------------- Firebase --------------------
// ✅ 修正：同時匯入 auth
import { db, auth } from '../firebase.js'; 
import {
  doc, setDoc, serverTimestamp, collection, addDoc,
  waitForPendingWrites
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

// ✅ 修正：匯入 Firebase Auth 的功能
import {
  GoogleAuthProvider,
  signInWithCredential
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';


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
  const uid = u.uid; // ✅ 修正：使用 Firebase Auth 的 UID
  if (!uid) return;
  const ref = doc(db, 'users', uid);
  await setDoc(ref, {
    uid,
    email: u.email || '',
    name: u.displayName || u.name || '', // ✅ 修正：使用 Firebase Auth 的 displayName
    picture: u.photoURL || u.picture || '', // ✅ 修正：使用 Firebase Auth 的 photoURL
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
    name:  u.displayName || u.name  || '', // ✅ 修正
    uid:   u.uid || '', // ✅ 修正
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
    // 1. ✅ 修正：取得 Google 來的 ID Token
    const idToken = response.credential;
    
    // 2. ✅ 修正：建立 Firebase 憑證
    const credential = GoogleAuthProvider.credential(idToken);
    
    // 3. ✅ 修正：登入 Firebase Auth SDK
    const result = await signInWithCredential(auth, credential);
    const user = result.user; // 這才是 Firebase Auth User 物件

    // 4. (可選) 您的舊邏輯：寫入 localStorage session
    //    (未來建議廢除，改用 onAuthStateChanged)
    writeSession({
      email:   user.email,
      name:    user.displayName,
      picture: user.photoURL,
      sub:     user.uid,   // ✅ 修正：使用 Firebase UID
    });

    // 5. ✅ 修正：使用 Firebase User 物件寫入 Firestore
    await ensureLoginLogged(user);

    // 關掉 OneTap 並顯示歡迎
    try { google.accounts.id.cancel(); } catch {}
    showWelcomeChip(user.displayName); // ✅ 修正

    // 轉回首頁或其他頁面
    location.hash = '#dashboard';
    location.reload();
  } catch (e) {
    console.error('Google 登入或 Firebase 憑證交換失敗：', e);
    alert('登入失敗，請再試一次。');
  }
}

// -------------------- 帳號頁 UI --------------------
export function AuthPage() {
  const el = document.createElement('div');
  el.className = 'container card';

  // ✅ 修正：改為監聽 Firebase Auth 狀態來顯示
  const user = auth.currentUser || readSession(); // 優先使用 Firebase Auth

  if (user) {
    // (注意：user.name 和 user.picture 是來自 localStorage 的，
    //  而 user.displayName 和 user.photoURL 是來自 Firebase Auth 的)
    const picture = user.photoURL || user.picture || '';
    const name = user.displayName || user.name || '';
    const email = user.email || '';

    el.innerHTML = `
      <h3>帳號</h3>
      <div class="row">
        <img src="${picture}" alt=""
             style="width:40px;height:40px;border-radius:50%;
             object-fit:cover;margin-right:8px">
        <div>
          <div><b>${name}</b></div>
          <div class="small">${email}</div>
        </div>
      </div>

      <div class="row" style="margin-top:10px">
        <button class="ghost" id="logout">登出</button>
        <a class="ghost" href="#dashboard">回首頁</a>
      </div>
    `;

    // 若上次登入資料存在，補寫一次（不 reload）
    if (auth.currentUser) {
      ensureLoginLogged(auth.currentUser).catch(console.error);
    }

    el.querySelector('#logout').addEventListener('click', () => {
      clearSession();
      auth.signOut(); // ✅ 修正：登出 Firebase Auth
      try { google.accounts.id.prompt(); } catch {}
      sessionStorage.removeItem('_login_written_user');
      sessionStorage.removeItem('_login_written_admin');
      location.reload();
    });

    showWelcomeChip(name);
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

// -------------------- 初始化 GIS --------------------
window.addEventListener('load', () => {
  try { google.accounts.id.disableAutoSelect(); } catch {}

  google.accounts.id.initialize({
    client_id: '577771534429-csromh0ttuk718chvgh66eqf6if3r5cg.apps.googleusercontent.com', // ✅ 您的 GIS Client ID
    callback: handleCredentialResponse,
    auto_select: false,
    cancel_on_tap_outside: true,
  });

  // ✅ 修正：改為監聽 Firebase Auth 狀態
  auth.onAuthStateChanged(user => {
    if (user?.displayName) {
      showWelcomeChip(user.displayName);
      ensureLoginLogged(user).catch(console.error);
    } else {
      // 只有在 auth 狀態為空時才提示 One-Tap
      google.accounts.id.prompt(); // One-Tap 登入
    }
  });
});

// 換頁時若未登入就再提示 One-Tap
window.addEventListener('hashchange', () => {
  try { 
    // ✅ 修正：檢查 Firebase Auth 狀態
    if (!auth.currentUser) {
      google.accounts.id.prompt(); 
    }
  } catch {}
});
