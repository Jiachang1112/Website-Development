// assets/js/pages/auth.js
// 小工具：安全讀取/寫入 session_user
function readSession() {
  try { return JSON.parse(localStorage.getItem('session_user') || 'null'); }
  catch { return null; }
}
function writeSession(user) {
  localStorage.setItem('session_user', JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem('session_user');
}

// 產生歡迎小膠囊（頁面左上角）
function showWelcomeChip(name) {
  const anchor = document.getElementById('onetap-anchor');
  if (!anchor) return;
  anchor.innerHTML = `<div class="welcome-chip">👋 歡迎 ${name || ''}</div>`;
}

// Google 回傳憑證（JWT）→ 解析出使用者（含中文姓名正確解碼）
function handleCredentialResponse(response) {
  try {
    const token = response.credential;
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64).split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(json);

    const user = {
      email:   payload.email,
      name:    payload.name,
      picture: payload.picture,
      sub:     payload.sub
    };

    writeSession(user);
    try { google.accounts.id.cancel(); } catch {}
    showWelcomeChip(user.name);

    location.hash = '#auth'; // 先停留在 auth
    location.reload();
  } catch (e) {
    console.error('解析 Google Token 失敗：', e);
    alert('Google 登入解析失敗，請再試一次。');
  }
}

// ✅ 主畫面：帳號頁
export function AuthPage() {
  const el = document.createElement('div');
  el.className = 'container card';

  let user = readSession();

  if (user) {
    el.innerHTML = `
      <h3>帳號</h3>
      <div class="row">
        <img src="${user.picture || ''}" alt=""
             style="width:40px;height:40px;border-radius:50%;
             object-fit:cover;margin-right:8px">
        <div>
          <div><b>${user.name || ''}</b></div>
          <div class="small">${user.email || ''}</div>
        </div>
      </div>
      <div class="row" style="margin-top:10px">
        <button class="ghost" id="logout">登出</button>
        <a class="ghost" href="#dashboard">回首頁</a>
      </div>
    `;

    el.querySelector('#logout').addEventListener('click', () => {
      clearSession();
      try { google.accounts.id.prompt(); } catch {}
      location.reload();
    });

    showWelcomeChip(user.name);

  } else {
    el.innerHTML = `
      <h3>帳號</h3>
      <p class="small">請下方的 Google 登入按鈕登入。</p>
      <div class="g_id_signin"
           data-type="standard"
           data-shape="rectangular"
           data-theme="outline"
           data-text="signin_with"
           data-size="large"
           data-logo_alignment="left"></div>
      <a class="ghost" href="#dashboard">回首頁</a>
    `;
  }

  return el;
}

/* 初始化 GSI（放在這支檔案結尾即可） */
window.addEventListener('load', () => {
  try { google.accounts.id.disableAutoSelect(); } catch {}

  google.accounts.id.initialize({
    // ⬇️ 換成你的 Client ID
    client_id: "225238850447-tds4p75o2nsforov086amnrj1nha7tuh.apps.googleusercontent.com",
    callback: handleCredentialResponse,
    auto_select: false,
    cancel_on_tap_outside: true
  });

  const user = readSession();
  if (user && user.name) {
    showWelcomeChip(user.name);
  } else {
    google.accounts.id.prompt();
  }
});

window.addEventListener('hashchange', () => {
  try {
    const user = readSession();
    if (!user) { google.accounts.id.prompt(); }
  } catch {}
});
