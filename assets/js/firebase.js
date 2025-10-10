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
