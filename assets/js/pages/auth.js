import { currentUser } from '../app.js';
export function AuthPage(){
  const el=document.createElement('div'); el.className='container card';
  const u=currentUser();
  el.innerHTML=`<h3>帳號</h3>
  <div id="info">${u?('已登入：'+(u.email||u.name)):'尚未登入'}</div>
  <div class="row"><button class="primary" id="fake">Sign in with Google</button><button class="ghost" id="logout">登出</button></div>
  <p class="small">（範例）按下登入會建立本地 session，正式環境請填入 GOOGLE_CLIENT_ID 並使用 Google Identity 1-tap。</p>`;
  el.querySelector('#fake').addEventListener('click',()=>{ localStorage.setItem('session_user', JSON.stringify({email:'bruce9811123@gmail.com', name:'Bruce'})); location.reload(); });
  el.querySelector('#logout').addEventListener('click',()=>{ localStorage.removeItem('session_user'); location.reload(); });
  return el;
}