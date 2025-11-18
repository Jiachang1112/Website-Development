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
      await ensureLoginLogged(user); 
      location.hash = '#dashboard'; 
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
      
      // ✅ 登出時也清除訂閱狀態 (模擬用)
      // localStorage.removeItem('site_subscription'); 
      
      location.reload(); 
    } catch (err) {
      console.error("登出失敗:", err);
    }
  };

  // 5. 監聽 Firebase Auth 狀態來更新 UI
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (!contentEl) return; // 節點不存在

    if (user) {
      // ✅ (新增) 判斷訂閱狀態
      // 這裡我們先讀取 localStorage (因為是純前端模擬付款)
      // 如果是真實專案，這裡應該讀取 user.claims 或 Firestore 資料
      const isPro = localStorage.getItem('site_subscription') === 'pro';
      
      const planLabel = isPro ? '🏆 PRO 專業版' : '🌱 免費會員';
      
      // 根據狀態設定顏色 (PRO=金色, Free=深灰)
      const planBadgeStyle = isPro 
        ? 'background: linear-gradient(135deg, #f59e0b, #d97706); color: #fff; border: none; box-shadow: 0 2px 8px rgba(245,158,11,0.4);'
        : 'background: #334155; color: #94a3b8; border: 1px solid #475569;';

      // 已登入 UI
      contentEl.innerHTML = `
        <div class="row" style="align-items: center;">
          <img src="${user.photoURL || ''}" alt=""
               style="width:56px; height:56px; border-radius:50%;
               object-fit:cover; margin-right:14px; border: 2px solid #3b82f6;">
          <div>
            <div style="font-size: 1.1rem; font-weight: 700; margin-bottom: 2px;">
              ${user.displayName || '使用者'}
            </div>
            <div class="small" style="color: #cbd5e1; margin-bottom: 6px;">
              ${user.email || ''}
            </div>
            
            <span style="
              display: inline-block; 
              font-size: 0.75rem; 
              padding: 2px 10px; 
              border-radius: 99px; 
              font-weight: 600; 
              letter-spacing: 0.5px;
              ${planBadgeStyle}
            ">
              ${planLabel}
            </span>
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
      ensureLoginLogged(user).catch(console.error);

    } else {
      // 未登入
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

  return el;
}
