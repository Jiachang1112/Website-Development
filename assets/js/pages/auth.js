// assets/js/pages/auth.js
export default function AuthPage() {
  const el = document.createElement('div');
  el.className = 'container card';
  el.id = 'auth-card';

  // 讀 session
  let user = null;
  try { user = JSON.parse(localStorage.getItem('session_user') || 'null'); } catch {}

  // UI：已登入 / 未登入
  if (user) {
    el.innerHTML = `
      <h3>帳號</h3>
      <div id="welcome-slot"></div>
      <div class="row" style="align-items:center;gap:12px;">
        <img src="${user.picture || ''}" alt="" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">
        <div>
          <div><b>${user.name || ''}</b></div>
          <div class="small">${user.email || ''}</div>
        </div>
      </div>

      <div class="row" style="margin-top:12px;gap:8px;">
        <button class="ghost" id="btnLogout">登出</button>
        <a class="ghost" href="#dashboard">回首頁</a>
      </div>
    `;

    // 歡迎貼片
    window.__showWelcomeInAuth && window.__showWelcomeInAuth(user.name || '');

    // 登出
    el.querySelector('#btnLogout').addEventListener('click', () => {
      try { google.accounts.id.cancel(); } catch {}
      localStorage.removeItem('session_user');
      location.hash = '#auth';
      location.reload();
    });

  } else {
    el.innerHTML = `
      <h3>帳號</h3>
      <div id="welcome-slot"></div>
      <p class="small">請按下方的 Google 登入按鈕。</p>
      <div id="googleBtnMount" style="margin:8px 0;"></div>
      <a class="ghost" href="#dashboard">回首頁</a>
    `;

    // 渲染 Google 登入按鈕（index.html 會把函式掛在 window）
    // 若 GSI script 還在載入，晚一點再呼叫也沒關係
    if (window.__renderGoogleBtn) {
      window.__renderGoogleBtn();
    } else {
      const t = setInterval(() => {
        if (window.__renderGoogleBtn) {
          clearInterval(t);
          window.__renderGoogleBtn();
        }
      }, 100);
      setTimeout(() => clearInterval(t), 4000);
    }
  }

  return el;
}
