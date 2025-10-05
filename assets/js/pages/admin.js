// assets/js/pages/admin.js
// 管理員後台首頁：白名單驗證 + 三個選項卡

import { auth } from '../firebase.js';
import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';

const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

/* ========= 管理員白名單 ========= */
const ADMIN_EMAILS = ['bruce9811123@gmail.com'].map(s => s.trim().toLowerCase());
const ADMIN_UIDS   = []; // 可加入 uid 白名單

function isAdminUser(user){
  if (!user) return false;
  const email = (user.email || '').trim().toLowerCase();
  const uid   = user.uid || '';
  return ADMIN_EMAILS.includes(email) || ADMIN_UIDS.includes(uid);
}

/* ========= UI ========= */
export function AdminPage(){
  const el = document.createElement('div');
  el.className = 'container my-4';
  el.innerHTML = `
    <div class="text-center text-white mb-4">
      <h4>歡迎回來 👋</h4>
      <p class="text-muted">請選擇要進入的管理項目</p>
      <button id="logoutBtn" class="btn btn-outline-light btn-sm">登出</button>
    </div>

    <div class="row g-4">
      <div class="col-md-4">
        <div class="card bg-dark text-light h-100 shadow-sm p-3">
          <h5>用戶記帳</h5>
          <p class="text-muted small">查看或管理用戶的記帳紀錄</p>
          <button class="btn btn-outline-light btn-sm" data-link="#account">進入</button>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card bg-dark text-light h-100 shadow-sm p-3">
          <h5>用戶登入</h5>
          <p class="text-muted small">查看誰在何時登入此平台</p>
          <button class="btn btn-outline-light btn-sm" data-link="#loginlogs">進入</button>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card bg-dark text-light h-100 shadow-sm p-3">
          <h5>訂單管理</h5>
          <p class="text-muted small">查看與管理用戶訂單</p>
          <button class="btn btn-outline-light btn-sm" data-link="#orders">進入</button>
        </div>
      </div>
    </div>
  `;

  // 登出事件
  $('#logoutBtn', el).onclick = async ()=>{
    await signOut(auth);
    alert('您已登出');
    location.href = '/';
  };

  // 卡片跳轉
  $$('[data-link]', el).forEach(btn=>{
    btn.onclick = ()=>{
      location.hash = btn.dataset.link;
    };
  });

  return el;
}

/* ========= 登入與權限邏輯 ========= */
export async function AdminGate(container){
  container.innerHTML = `<div class="text-center text-light mt-5">載入中...</div>`;
  const provider = new GoogleAuthProvider();

  onAuthStateChanged(auth, async (user)=>{
    if (!user){
      // 未登入 → 顯示登入按鈕
      container.innerHTML = `
        <div class="text-center text-light mt-5">
          <h4>管理員登入</h4>
          <p class="text-muted">請使用 Google 登入以進入後台</p>
          <button id="loginBtn" class="btn btn-outline-light">使用 Google 登入</button>
        </div>`;
      $('#loginBtn', container).onclick = async ()=>{
        await signInWithPopup(auth, provider);
      };
      return;
    }

    // 已登入，驗證管理員身份
    if (isAdminUser(user)){
      container.innerHTML = '';
      container.appendChild(AdminPage());
    } else {
      alert('非管理員帳號，無法進入後台。');
      await signOut(auth);
      location.href = '/';
    }
  });
}
