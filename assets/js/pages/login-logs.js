// === /assets/js/pages/auth-role-login.js (你可以用任意檔名) ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  setDoc,
  doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- 你的 Firebase 設定（保持跟目前專案一樣） ---
const firebaseConfig = {
  apiKey: "...",
  authDomain: "....firebaseapp.com",
  projectId: "....",
  storageBucket: "....appspot.com",
  messagingSenderId: "...",
  appId: "..."
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// --- 1) 簡單的管理員名單（白名單）---
//    只要 email 在這個陣列，就視為 admin。其餘都是 user。
//    之後你也可以改成讀 Firestore / 使用 custom claims。
const ADMIN_EMAILS = [
  "你的管理員1@email.com",
  "你的管理員2@email.com"
];

// --- 2) 判斷角色 ---
function resolveRole(email) {
  return ADMIN_EMAILS.includes((email || "").toLowerCase()) ? "admin" : "user";
}

// --- 3) 寫入登入紀錄（admin -> admin_logs；user -> login_logs）---
async function writeLoginLog(user, role) {
  const payload = {
    uid: user.uid,
    email: user.email || "",
    name: user.displayName || "",
    providerId: (user.providerData && user.providerData[0]?.providerId) || "google.com",
    userAgent: navigator.userAgent || "",
    ts: serverTimestamp(),           // Firestore 端的時間
    kind: role                       // 跟你現在 login_logs 的欄位風格一致
  };

  const colName = role === "admin" ? "admin_logs" : "login_logs";
  await addDoc(collection(db, colName), payload);

  // 另外把 users/{uid} 更新（方便之後查角色）
  await setDoc(
    doc(db, "users", user.uid),
    {
      email: payload.email,
      name: payload.name,
      role: role,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

// --- 4) 觸發登入（你可以把這個函式綁到「使用 Google 登入」按鈕）---
export async function signInWithGoogleRole() {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user   = result.user;
    const role   = resolveRole(user.email);

    // 寫入紀錄
    await writeLoginLog(user, role);

    // 依角色導頁（可依需求調整）
    if (role === "admin") {
      // 例如導到你的後台
      location.href = "/admin/";
    } else {
      // 一般使用者導回首頁或原本頁面
      location.href = "/index.html";
    }
  } catch (err) {
    alert(`登入失敗（${err.code || err.name}）：${err.message || err}`);
    console.error(err);
  }
}

// --- 5)（可選）自動偵測已登入狀態 ---
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  // 已登入但還沒寫過紀錄的情況：你也可以在這裡呼叫 writeLoginLog
  // 不過通常我們只在「登入事件」當下寫一次即可。
});
