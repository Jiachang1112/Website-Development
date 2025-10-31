// assets/js/pages/user-login.js
// 多身分供應商登入：Google / LINE(OIDC) / Apple / Facebook
// - 自動 fallback：Popup 失敗或被阻擋時，改用 Redirect
// - 支援 user 與 admin 兩種 "kind" 紀錄到你的 analytics
// - 保留原本 recordLogin 行為

import { auth } from '../../firebase.js';
import { recordLogin } from '../analytics/login-logger.js';
import {
  GoogleAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,           // Apple / 自定 OIDC (LINE) 都用它
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';

const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
const statusBox = $('#loginStatus') || document.body;

// --- Providers --------------------------------------------------------------
// ✅ Google
const google = new GoogleAuthProvider();
google.setCustomParameters({ prompt: 'select_account' });

// ✅ LINE（需在 Firebase Authentication → Sign-in method → OpenID Connect 新增）
//   - Provider ID：oidc.line
//   - 發行者(issuer)：https://access.line.me
//   - Client ID / Secret：來自 LINE Developers
const line = new OAuthProvider('oidc.line');
line.addScope('openid');
line.addScope('profile');
line.addScope('email');

// ✅ Apple
const apple = new OAuthProvider('apple.com');
// Apple 只接受 'email' 'name' 兩種 scope
apple.addScope('email');
apple.addScope('name');

// ✅ Facebook（需在 Sign-in method 啟用並填入 App ID/Secret）
const facebook = new FacebookAuthProvider();
facebook.addScope('public_profile');
facebook.addScope('email');

// --- Helpers ---------------------------------------------------------------
function show(msg){
  if (statusBox) statusBox.textContent = msg;
  else console.log('[login]', msg);
}

function providerName(p){
  if (p === google) return 'Google';
  if (p === line) return 'LINE';
  if (p === apple) return 'Apple';
  if (p === facebook) return 'Facebook';
  return 'Provider';
}

// 嘗試 Popup，失敗（例如 iOS/Safari 阻擋彈窗）則改 Redirect
async function doSignIn(kind, provider){
  await setPersistence(auth, browserLocalPersistence);

  try {
    const res = await signInWithPopup(auth, provider);
    const user = res.user;
    show(`✅ 使用 ${providerName(provider)} 登入成功：${user.displayName || user.email || user.uid}`);
    await recordLogin(kind, user);
    return user;
  } catch (err) {
    // 一些常見情況改走 redirect
    const popupBlocked =
      err?.code === 'auth/popup-blocked' ||
      err?.code === 'auth/popup-closed-by-user' ||
      err?.code === 'auth/operation-not-supported-in-this-environment';

    if (popupBlocked) {
      show(`⚠️ 視窗被阻擋，改用重新導向登入（${providerName(provider)}）…`);
      await signInWithRedirect(auth, provider);
      return null;
    }

    // 現有帳號不同供應商衝突的提示
    if (err?.code === 'auth/account-exists-with-different-credential') {
      show('此 Email 已用其他登入方式註冊，請改用當初的方式登入（或在帳號設定做連結）。');
    } else {
      show(`❌ 登入失敗（${providerName(provider)}）：${err?.message || err}`);
    }
    throw err;
  }
}

// 解析 Redirect 回傳結果（行動裝置或彈窗被擋時用得到）
async function handleRedirectResult(){
  try{
    const res = await getRedirectResult(auth);
    if (res && res.user) {
      const user = res.user;
      show(`✅ 重新導向登入成功：${user.displayName || user.email || user.uid}`);
      // 無法得知當時傳入的 kind，這裡預設記為 'user'
      await recordLogin('user', user);
    }
  }catch(err){
    if (err?.code) {
      show(`❌ 重新導向登入失敗：${err.message || err.code}`);
    }
  }
}

// --- UI 綁定 ---------------------------------------------------------------
// 你的舊按鈕：Google（用戶 / 管理員）
$('#userLogin')  && $('#userLogin').addEventListener('click',  ()=> doSignIn('user',  google));
$('#adminLogin') && $('#adminLogin').addEventListener('click', ()=> doSignIn('admin', google));

// 新增四顆供應商按鈕（如果頁面上有就會綁）
$('#btnGoogle')   && $('#btnGoogle').addEventListener('click',   ()=> doSignIn('user', google));
$('#btnLine')     && $('#btnLine').addEventListener('click',     ()=> doSignIn('user', line));
$('#btnApple')    && $('#btnApple').addEventListener('click',    ()=> doSignIn('user', apple));
$('#btnFacebook') && $('#btnFacebook').addEventListener('click', ()=> doSignIn('user', facebook));

$('#btnSignOut') && $('#btnSignOut').addEventListener('click', async ()=>{
  try{ await signOut(auth); show('👋 已登出'); }
  catch(e){ show('登出失敗：' + (e?.message || e)); }
});

// --- 狀態監聽 --------------------------------------------------------------
onAuthStateChanged(auth, (user)=>{
  if (user) {
    const name  = user.displayName || '(未命名)';
    const email = user.email || '';
    show(`已登入：${name}${email ? '（' + email + '）' : ''}`);
    // 也把登入者資訊存到 localStorage，給其他頁用
    try{
      localStorage.setItem('session_user', JSON.stringify({
        uid: user.uid, email: user.email, displayName: user.displayName,
        photoURL: user.photoURL, providerData: user.providerData
      }));
      // 方便舊程式取用
      window.session_user = { uid: user.uid, email: user.email, displayName: user.displayName };
    }catch{}
  } else {
    show('尚未登入');
    try{
      localStorage.removeItem('session_user');
      window.session_user = null;
    }catch{}
  }
});

// 初次載入：處理 redirect 回傳
handleRedirectResult();
