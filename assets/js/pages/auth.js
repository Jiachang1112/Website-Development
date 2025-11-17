// assets/js/pages/auth.js
// -------------------- Firebase --------------------
// ✅ 統一匯入 auth 和 db
import { auth, db } from '../firebase.js'; 
import {
  doc, setDoc, serverTimestamp, collection, addDoc,
  waitForPendingWrites
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

// ✅ 匯入 Firebase Auth 功能
import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';

// -------------------- 管理員白名單 --------------------
const ADMIN_EMAILS = ['bruce9811123@gmail.com']; 

// -------------------- UI：左上歡迎膠囊 (保留) --------------------
function showWelcomeChip(name) {
  const anchor = document.getElementById('onetap-anchor'); // 這在 index.html
  if (!anchor) return;
  anchor.innerHTML = `<div class="welcome-chip">👋 歡迎 ${name || ''}</div>`;
}

// -------------------- Firestore：主檔 + 登入紀錄 (修改) --------------------
// ✅ 參數 u 改為 Firebase Auth User 物件
async function upsertUserProfile(u) {
  const uid = u.uid; 
  if (!uid) return;
  const ref = doc(db, 'users', uid);
  await setDoc(ref, {
    uid,
    email: u.email || '',
    name: u.displayName || '',
    picture: u.photoURL || '',
    providerId: 'google.com',
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  }, { merge: true });
}

// ✅ 參數 u 改為 Firebase Auth User 物件
async function writeLoginLog(kind, u) {
  const coll = kind === 'admin' ? 'admin_logs' : 'user_logs';
  const ref = collection(db, coll);
  const payload = {
    kind,
    email: u.email || '',
    name:  u.displayName  || '',
    uid:   u.uid || '',
    providerId: 'google.com',
    userAgent: navigator.userAgent || '',
    ts: serverTimestamp(),
  };
  const docRef = await addDoc(ref, payload);
  console.info(`[${coll}] (auth.js) 寫入成功:`, docRef.id, payload);
}

// --- 去重：同一個 session 只寫一次 ---
function markLogged(kind) {
  sessionStorage.setItem(`_login_written_${kind}`, '1');
}
function alreadyLogged(kind) {
  return sessionStorage.getItem(`_login_written_${kind}`) === '1';
}

// ✅ 參數 currentUser 改為 Firebase Auth User 物件
async function ensureLoginLogged(currentUser) {
  if (!currentUser) return;
  const email = (currentUser.email || '').trim().toLowerCase();
  const kind  = ADMIN_EMAILS.includes(email) ? 'admin' : 'user';
  if (alreadyLogged(kind)) return; // 避免重覆寫

  await upsertUserProfile(currentUser);
  await writeLoginLog(kind, currentUser);
  await waitForPendingWrites(db); // 等 Firestore 寫入完成再繼續
  markLogged(kind);
}

// -------------------- 帳號頁 UI (重寫) --------------------
export function AuthPage() {
  const el = document.createElement('div');
  el.className = 'container card';

  // 1. 先顯示一個載入中/基礎UI
  el.innerHTML = `
    <h3>帳號</h3>
    <div id="auth-content">
      <p class="small">正在檢查登入狀態...</p>
    </div>
  `;

  // 2. 獲取UI節點
  const contentEl = el.querySelector('#auth-content');

  // 3. 處理登入邏輯
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      // 登入成功，onAuthStateChanged 會自動處理 UI 更新
      // 但我們在這裡立即手動寫入 Log
      await ensureLoginLogged(user); 
      location.hash = '#dashboard'; // 登入後跳轉
    } catch (err) {
      console.error("登入失敗:", err);
      if (contentEl) contentEl.innerHTML += `<p style="color:red;">登入失敗: ${err.message}</p>`;
    }
  };

  // 4. 處理登出邏輯
  const handleLogout = async () => {
    try {
      await signOut(auth);
      sessionStorage.removeItem('_login_written_user');
      sessionStorage.removeItem('_login_written_admin');
      // onAuthStateChanged 會自動更新 UI
      location.reload(); // 簡單起見，直接重載
    } catch (err) {
      console.error("登出失敗:", err);
    }
  };

  // 5. 監聽 Firebase Auth 狀態來更新 UI
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (!contentEl) return; // 節點不存在

    if (user) {
      // 已登入
      contentEl.innerHTML = `
        <div class="row">
          <img src="${user.photoURL || ''}" alt=""
               style="width:40px;height:40px;border-radius:50%;
               object-fit:cover;margin-right:8px">
          <div>
            <div><b>${user.displayName || ''}</b></div>
            <div class="small">${user.email || ''}</div>
          </div>
        </div>
        <div class="row" style="margin-top:10px">
          <a class="primary" href="#dashboard" style="text-decoration: none; padding: 6px 10px;">回首頁</a>
          <button class="ghost" id="logoutBtn">登出</button>
        </div>
      `;
      el.querySelector('#logoutBtn').addEventListener('click', handleLogout);
      
      // 顯示歡迎語
      showWelcomeChip(user.displayName);
      // 補寫登入日誌 (如果 session 中沒有)
      ensureLoginLogged(user).catch(console.error);

    } else {
      // 未登入
      // ✅ 修正：將登入按鈕和回首頁按鈕放入 .row 中
      contentEl.innerHTML = `
        <p class="small">請使用 Google 登入。</p>
        <div class="row" style="margin-top:10px;">
          <button class="primary" id="googleLoginBtn">
            <i class="bi bi-google"></i> 使用 Google 登入
          </button>
          <a class="ghost" href="#dashboard" style="text-decoration: none;">回首頁</a>
        </div>
      `;
      el.querySelector('#googleLoginBtn').addEventListener('click', handleLogin);
    }
  });

  // (可選) 當元件被移除時，取消監聽
  // el.addEventListener('DOMNodeRemoved', unsubscribe);

  return el;
}

// -------------------- (移除) 初始化 GIS --------------------
// (app.js 會自動呼叫 AuthPage)
