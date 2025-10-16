// assets/js/firebase.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js';
import { getAuth }       from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';
import { getFirestore }  from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            "AIzaSyCjrjZOyMrzlbG2VOoRqd9o3q3X5HYv2WY",
  authDomain:        "supertool-dee80.firebaseapp.com",
  projectId:         "supertool-dee80",
  storageBucket:     "supertool-dee80.firebasestorage.app",
  messagingSenderId: "577771534429",
  appId:             "1:577771534429:web:7dc10a6082e9ab1cfd35b4"
};

export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

// 🚫 不要在這裡寫任何 onAuthStateChanged 去記錄登入！
// 登入紀錄一律交給 assets/js/pages/auth.js 的 handleCredentialResponse 處理。

// --- 放在 assets/js/firebase.js 的最後 -----------------------------

import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';
import {
  collection, addDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

// 與 auth.js 同樣的管理員白名單（務必小寫）
const ADMIN_EMAILS = ['bruce9811123@gmail.com'].map(s => s.trim().toLowerCase());

// 避免同一個分頁/同一次登入重複寫入（Firebase Auth 這條）
function faAlreadyLogged(kind) {
  return sessionStorage.getItem(`_fa_login_written_${kind}`) === '1';
}
function faMarkLogged(kind) {
  sessionStorage.setItem(`_fa_login_written_${kind}`, '1');
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return; // 已登出

  try {
    const email = (user.email || '').trim().toLowerCase();
    const kind  = ADMIN_EMAILS.includes(email) ? 'admin' : 'user';

    // 避免重覆（例如你也有 GIS 寫入）
    if (faAlreadyLogged(kind)) return;

    const coll = kind === 'admin' ? 'admin_logs' : 'user_logs';
    await addDoc(collection(db, coll), {
      kind,
      email,
      name: user.displayName || '',
      uid:  user.uid || '',
      providerId: (user.providerData?.[0]?.providerId) || 'google.com',
      userAgent: navigator.userAgent || '',
      ts: serverTimestamp(),
    });

    faMarkLogged(kind);
    console.info(`[${coll}] via FirebaseAuth 寫入成功`);
  } catch (e) {
    console.error('[FirebaseAuth] 寫入登入紀錄失敗：', e);
  }
});
