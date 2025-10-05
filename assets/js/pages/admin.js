// assets/js/pages/admin.js
import { auth } from '../firebase.js';
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';

/* ---------- 小工具 ---------- */
const $ = (sel, root = document) => root.querySelector(sel);

/* ---------- 後台只在自身作用域的樣式 ---------- */
function ensureAdminStyles() {
  if (document.getElementById('admin-css')) return;
  const css = document.createElement('style');
  css.id = 'admin-css';
  css.textContent = `
  .admin-scope{ --bg:#0f1318; --fg:#e6e6e6; --muted:#9aa3af; --card:#151a21; --border:#2a2f37; }
  .admin-scope{ background:var(--bg); color:var(--fg); min-height:100vh; }
  .admin-scope .shell{ max-width:1200px; margin-inline:auto; padding:20px; }

  .admin-scope .hero{
    background:linear-gradient(135deg, rgba(59,130,246,.15), rgba(168,85,247,.10));
    border:1px solid var(--border); border-radius:18px; padding:18px;
    display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;
  }
  .admin-scope .hero h5{ margin:0; font-weight:800 }
  .admin-scope .hero .btn{ border-radius:12px }

  .admin-scope .grid{
    display:grid; grid-template-columns:repeat(3,1fr); gap:16px;
  }
  @media (max-width: 992px){ .admin-scope .grid{ grid-template-columns:1fr } }

  .admin-scope .cardx{
    background:var(--card); border:1px solid var(--border); border-radius:16px; padding:18px;
    cursor:pointer; transition:transform .12s ease, box-shadow .2s ease, border-color .2s ease;
  }
  .admin-scope .cardx:hover{
    transform:translateY(-2px);
    border-color:#3b82f6;
    box-shadow:0 10px 28px rgba(0,0,0,.28);
  }
  .admin-scope .cardx .title{ font-weight:800; margin-bottom:6px }
  .admin-scope .muted{ color:var(--muted) }
  .admin-scope .top-actions{ display:flex; gap:8px; }
  `;
  document.head.appendChild(css);
}

/* ---------- 首頁：三個大選項 ---------- */
function renderHome(onGo) {
  const el = document.createElement('div');
  el.className = 'shell';
  el.innerHTML = `
    <div class="hero">
      <div>
        <h5>歡迎回來 👋</h5>
        <div class="muted">快速進入你的管理工具</div>
      </div>
      <div class="top-actions">
        <button id="btnTheme" class="btn btn-outline-light btn-sm">切換亮/暗</button>
        <button id="btnLogout" class="btn btn-outline-danger btn-sm">登出</button>
      </div>
    </div>

    <div class="grid">
      <div class="cardx" data-go="ledger">
        <div class="title">用戶記帳</div>
        <div class="muted">記錄/查詢用戶的費用、款項與餘額（之後在這裡實作）。</div>
      </div>

      <div class="cardx" data-go="audit">
        <div class="title">用戶登入</div>
        <div class="muted">查看誰在何時登入本平台的帳號與姓名（之後在這裡實作）。</div>
      </div>

      <div class="cardx" data-go="orders">
        <div class="title">訂單管理</div>
        <div class="muted">搜尋、篩選、查看與更新訂單狀態（點此進入）。</div>
      </div>
    </div>
  `;

  // 導覽
  el.addEventListener('click', e => {
    const hit = e.target.closest('[data-go]');
    if (!hit) return;
    onGo && onGo(hit.dataset.go);
  });

  // 亮/暗（只在 admin 容器上切）
  $('#btnTheme', el)?.addEventListener('click', () => {
    const scope = el.closest('.admin-scope');
    const nowLight = scope.classList.toggle('light');
    localStorage.setItem('admin_theme', nowLight ? 'light' : 'dark');
  });

  // 登出
  $('#btnLogout', el)?.addEventListener('click', async () => {
    if (!confirm('要登出嗎？')) return;
    try { await signOut(auth); } catch (e) { alert(e.message || '登出失敗'); }
  });

  // 還原主題
  const saved = localStorage.getItem('admin_theme') || 'dark';
  el.closest('.admin-scope')?.classList.toggle('light', saved === 'light');

  return el;
}

/* ---------- 訂單管理：先放 placeholder（之後把你的原始程式碼放進來） ---------- */
function renderOrdersUI() {
  // TODO：把你「原封不動」的訂單管理程式碼的 UI 產生函式放到這裡，回傳一個元素節點即可。
  const el = document.createElement('div');
  el.className = 'shell';
  el.innerHTML = `
    <div class="hero">
      <div>
        <h5>訂單管理</h5>
        <div class="muted">（這裡放你原本的訂單管理 UI；目前先顯示占位）</div>
      </div>
      <div class="top-actions">
        <button id="btnBack" class="btn btn-outline-light btn-sm">回後台首頁</button>
      </div>
    </div>
    <div class="cardx">
      <div class="title">占位內容</div>
      <div class="muted">請把既有的訂單管理程式碼植入本函式，回傳完整的 UI。</div>
    </div>
  `;
  $('#btnBack', el)?.addEventListener('click', () => {
    location.hash = '#home';
    el.dispatchEvent(new CustomEvent('admin:navigate', { bubbles: true, detail: { to: 'home' } }));
  });
  return el;
}

/* ---------- 登入畫面（Google） ---------- */
function showLogin(container, msg = '請先使用 Google 登入才能進入後台') {
  const el = document.createElement('div');
  el.className = 'shell';
  el.innerHTML = `
    <div class="cardx">
      <div class="title">管理員登入</div>
      <div class="muted">${msg}</div>
      <div class="mt-3 d-flex gap-2">
        <button id="googleLogin" class="btn btn-primary btn-sm">使用 Google 登入</button>
      </div>
      <div id="loginErr" class="text-danger small mt-2"></div>
    </div>
  `;
  container.replaceChildren(el);

  const provider = new GoogleAuthProvider();
  $('#googleLogin', el)?.addEventListener('click', async () => {
    $('#loginErr', el).textContent = '';
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/cancelled-popup-request') {
        try { await signInWithRedirect(auth, provider); }
        catch (e2) { $('#loginErr', el).textContent = e2.message || '登入失敗'; }
      } else {
        $('#loginErr', el).textContent = err.message || '登入失敗';
      }
    }
  });
}

/* ---------- 導出：後台入口，只顯示三個選項 ---------- */
export function AdminPage() {
  ensureAdminStyles();

  // 後台作用域容器，避免影響全站
  const scope = document.createElement('div');
  scope.className = 'admin-scope';

  const host = document.createElement('div'); // 放頁面內容
  scope.appendChild(host);

  const go = (to) => {
    switch (to) {
      case 'orders':
        host.replaceChildren(renderOrdersUI());
        location.hash = '#orders';
        break;
      case 'ledger':
        // 之後在這裡換成用戶記帳的 UI
        {
          const el = document.createElement('div');
          el.className = 'shell';
          el.innerHTML = `
            <div class="hero">
              <div><h5>用戶記帳</h5><div class="muted">（待實作）</div></div>
              <div class="top-actions"><button id="back" class="btn btn-outline-light btn-sm">回後台首頁</button></div>
            </div>
            <div class="cardx"><div class="title">占位</div><div class="muted">這裡將是用戶記帳功能。</div></div>
          `;
          el.querySelector('#back')?.addEventListener('click', () => { location.hash = '#home'; host.replaceChildren(renderHome(go)); });
          host.replaceChildren(el);
          location.hash = '#ledger';
        }
        break;
      case 'audit':
        // 之後在這裡換成登入紀錄的 UI
        {
          const el = document.createElement('div');
          el.className = 'shell';
          el.innerHTML = `
            <div class="hero">
              <div><h5>用戶登入</h5><div class="muted">（待實作）</div></div>
              <div class="top-actions"><button id="back" class="btn btn-outline-light btn-sm">回後台首頁</button></div>
            </div>
            <div class="cardx"><div class="title">占位</div><div class="muted">這裡將呈現登入時間、帳號、姓名等紀錄。</div></div>
          `;
          el.querySelector('#back')?.addEventListener('click', () => { location.hash = '#home'; host.replaceChildren(renderHome(go)); });
          host.replaceChildren(el);
          location.hash = '#audit';
        }
        break;
      default:
        host.replaceChildren(renderHome(go));
        location.hash = '#home';
    }
  };

  // 登入/路由
  getRedirectResult(auth).catch(() => {});
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      showLogin(host);
      return;
    }
    // 進來就只有三個選項
    const hash = (location.hash || '').replace('#', '');
    go(hash || 'home');
  });

  // 允許內部頁面丟事件切回首頁
  scope.addEventListener('admin:navigate', (e) => {
    const to = e.detail?.to || 'home';
    go(to);
  });

  return scope;
}
