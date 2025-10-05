// 3) 初始化
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

// ✅ 動態載入，避免路徑或 module 問題導致整個頁面掛掉
(async () => {
  try {
    const [{ recordLogin }, { onAuthStateChanged }] = await Promise.all([
      import('./analytics/login-logger.js'),
      import('https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js')
    ]);

    // 管理員白名單（可多個）
    const ADMIN_EMAILS = ['bruce9811123@gmail.com'].map(s => s.trim().toLowerCase());

    onAuthStateChanged(auth, (user) => {
      if (!user) return;
      const email = (user.email || '').toLowerCase();
      const kind  = ADMIN_EMAILS.includes(email) ? 'admin' : 'user';
      recordLogin(kind, user); // ✅ 寫登入紀錄
    });
  } catch (e) {
    console.warn('[login-logger] disabled:', e);
    // 不影響頁面運作
  }
})();
