// 3) 初始化並匯出
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// 匯入登入紀錄模組
import { recordLogin } from './analytics/login-logger.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';

// ✅ 管理員白名單
const ADMIN_EMAILS = ['bruce9811123@gmail.com'].map(s => s.trim().toLowerCase());

// 當登入狀態改變時觸發
onAuthStateChanged(auth, (user) => {
  if (user) {
    const email = (user.email || '').toLowerCase();

    // 判斷管理員或一般用戶
    const kind = ADMIN_EMAILS.includes(email) ? 'admin' : 'user';

    // ✅ 寫入 Firestore 登入紀錄
    recordLogin(kind, user);
  }
});
