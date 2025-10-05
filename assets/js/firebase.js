// assets/js/firebase.js  ← 確保這個檔案是以 <script type="module"> 載入

// ✅ 一定要先 import 這三個
import { initializeApp }  from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js';
import { getAuth }        from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';
import { getFirestore }   from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

// 你的 Firebase 設定
export const firebaseConfig = {
  apiKey:        '…',
  authDomain:    '…',
  projectId:     '…',
  storageBucket: '…',
  messagingSenderId: '…',
  appId:         '…',
};

// 初始化
export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

/* -------------------（可選）登入紀錄：動態載入，避免整頁掛掉 ------------------- */
(async () => {
  try {
    const [{ recordLogin }, { onAuthStateChanged }] = await Promise.all([
      import('./analytics/login-logger.js'),
      import('https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js')
    ]);

    // 管理員白名單（可自行增減）
    const ADMIN_EMAILS = ['bruce9811123@gmail.com'].map(s => s.trim().toLowerCase());

    onAuthStateChanged(auth, (user) => {
      if (!user) return;
      const email = (user.email || '').toLowerCase();
      const kind  = ADMIN_EMAILS.includes(email) ? 'admin' : 'user';
      recordLogin(kind, user);  // ✅ 寫入 Firestore: login_logs
    });
  } catch (e) {
    console.warn('[login-logger] disabled:', e);
  }
})();
