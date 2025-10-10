// assets/js/firebase.js
// ------------------------------------------------------
// Firebase 初始化 + 自動記錄登入紀錄（admin/user 分開）
// ------------------------------------------------------

// 1️⃣ 匯入 SDK（請確保版號一致）
import { initializeApp }   from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js';
import { getAuth, onAuthStateChanged } 
                          from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';
import { getFirestore, collection, addDoc, serverTimestamp }
                          from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

// 2️⃣ Firebase 專案設定（你的設定）
const firebaseConfig = {
  apiKey:            "AIzaSyCjrjZOyMrzlbG2VOoRqd9o3q3X5HYv2WY",
  authDomain:        "supertool-dee80.firebaseapp.com",
  projectId:         "supertool-dee80",
  storageBucket:     "supertool-dee80.firebasestorage.app",
  messagingSenderId: "577771534429",
  appId:             "1:577771534429:web:7dc10a6082e9ab1cfd35b4"
};

// 3️⃣ 初始化 Firebase
export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

// ------------------------------------------------------
// 🧩 管理員白名單（只有這些帳號會被歸類為 admin）
// ------------------------------------------------------
const ADMIN_EMAILS = ['bruce9811123@gmail.com'];  // ← 可依需要加更多

// ------------------------------------------------------
// 🪄 寫入 Firestore 登入紀錄
// ------------------------------------------------------
async function recordLogin(kind, user) {
  try {
    const logData = {
      kind,                                   // 'admin' 或 'user'
      email: user.email || '',
      name: user.displayName || '(未命名)',
      uid: user.uid || '',
      providerId: user.providerId || 'google.com',
      userAgent: navigator.userAgent || '',
      ts: serverTimestamp()
    };

    const target = kind === 'admin' ? 'admin_logs' : 'user_logs';
    await addDoc(collection(db, target), logData);
    console.info(`[${target}] 寫入成功：`, logData);
  } catch (e) {
    console.error('🔥 寫入登入紀錄失敗：', e);
  }
}

// ------------------------------------------------------
// 🚀 監聽登入狀態（任何登入都會觸發）
// ------------------------------------------------------
onAuthStateChanged(auth, (user) => {
  if (!user) return; // 未登入直接略過

  const email = (user.email || '').trim().toLowerCase();
  const kind  = ADMIN_EMAILS.includes(email) ? 'admin' : 'user';
  recordLogin(kind, user);
});
