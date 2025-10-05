// assets/js/firebase.js

// 1) 匯入 SDK（同一版號 12.3.0）
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js';
import { getAuth }       from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';
import { getFirestore }  from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

// 2) 你的 Firebase 專案設定（從 Firebase Console 複製）
const firebaseConfig = {
  apiKey:            "AIzaSyCjrjZOyMrzlbG2VOoRqd9o3q3X5HYv2WY",
  authDomain:        "supertool-dee80.firebaseapp.com",
  projectId:         "supertool-dee80",
  storageBucket:     "supertool-dee80.firebasestorage.app",
  messagingSenderId: "577771534429",
  appId:             "1:577771534429:web:7dc10a6082e9ab1cfd35b4"
};

// 3) 初始化並匯出
export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
import { recordLogin } from './analytics/login-logger.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';

onAuthStateChanged(auth, (user) => {
  if (user) {
    // 檢查是不是管理員 or 一般用戶
    const email = user.email || '';
    const kind = email.endsWith('@gmail.com') ? 'user' : 'admin'; // 你也可以改成自己的條件
    recordLogin(kind, user); // ✅ 寫入 Firestore 登入紀錄
  }
});
