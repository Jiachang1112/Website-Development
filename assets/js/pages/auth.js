// --- auth.js (或你現在處理 Google Sign-In 的檔案) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, addDoc, collection, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 你的 Firebase config
const firebaseConfig = { /* ...你的設定... */ };
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

const provider = new GoogleAuthProvider();

// ✨ 只有這些 email 算 admin（可多個）
const ADMIN_EMAILS = ["bruce9811123@gmail.com"];

// 登入按鈕
document.getElementById("btnGoogleSignIn")?.addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user   = result.user; // Firebase User

    // 準備要寫入的欄位（跟你原本 login_logs 一樣）
    const payload = {
      uid:        user.uid,
      name:       user.displayName || "",
      email:      user.email || "",
      providerId: (user.providerData?.[0]?.providerId) || "google.com",
      ts:         serverTimestamp(),                          // Firestore 伺服器時間
      userAgent:  navigator.userAgent,
      kind:       ADMIN_EMAILS.includes(user.email) ? "admin" : "user"
    };

    // ✨ 判斷要寫入哪個集合
    const targetCol = ADMIN_EMAILS.includes(user.email) ? "admin_logs" : "user_logs";
    await addDoc(collection(db, targetCol), payload);

    // （可選）同步記一份到 users/{uid}
    // await setDoc(doc(db, "users", user.uid), {
    //   name: user.displayName || "",
    //   email: user.email || "",
    //   updatedAt: serverTimestamp()
    // }, { merge: true });

    alert("登入成功！");
  } catch (err) {
    console.error(err);
    alert(`登入失敗（${err.code || err.message}）`);
  }
});

// 登出按鈕（若有）
document.getElementById("btnSignOut")?.addEventListener("click", async () => {
  await signOut(auth);
  alert("已登出");
});

// （可選）只有 admin 才能進後台的按鈕守門
document.getElementById("btnGoAdmin")?.addEventListener("click", () => {
  const u = auth.currentUser;
  if (!u || !ADMIN_EMAILS.includes(u.email)) {
    alert("你沒有後台權限");
    return;
  }
  // 例如導到你的後台頁
  location.href = "/admin/index.html";
});
