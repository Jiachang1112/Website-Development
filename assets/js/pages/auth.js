// assets/js/pages/auth.js
export function AuthPage(){
  const el = document.createElement('div');
  el.className = 'container card';

  // 讀取 session
  let user = null;
  try { user = JSON.parse(localStorage.getItem('session_user') || 'null'); } catch {}

  if (user) {
    // 已登入畫面
    el.innerHTML = `
      <h3>帳號</h3>
      <div class="row">
        <img src="${user.picture || ''}" alt="" style="width:40px;height:40px;border-radius:50%;object-fit:cover;margin-right:8px">
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

    // 登出
    el.querySelector('#logout').addEventListener('click', () => {
  // 1) 清掉登入狀態
  localStorage.removeItem('session_user');

  // 2) 確保 One-Tap 可再次出現
  try { google.accounts.id.cancel(); } catch(e) {}
  try { google.accounts.id.disableAutoSelect(); } catch(e) {}
  // 立刻要求顯示（不等重新整理）
  setTimeout(() => { try { google.accounts.id.prompt(); } catch(e) {} }, 0);

  // 3) 直接導向帳號頁，讓按鈕立刻渲染
  location.hash = '#auth';        // 或你路由上的「帳號」路徑
  // 不 reload：SPA 會馬上換到帳號頁並渲染按鈕
});


  } else {
    // 未登入畫面（動態渲染 Google 按鈕）
    el.innerHTML = `
      <h3>帳號</h3>
      <p class="small">請下方的 Google 登入按鈕登入。</p>
      <div id="googleBtnMount" style="margin-top:8px;"></div>
      <a class="ghost" href="#dashboard">回首頁</a>
    `;

    function mountGoogleBtn() {
      const mount = el.querySelector('#googleBtnMount');
      if (!mount) return;

      if (window.google && google.accounts?.id?.renderButton) {
        google.accounts.id.renderButton(mount, {
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          text: 'signin_with'
        });
      } else {
        setTimeout(mountGoogleBtn, 100);
      }
    }
    mountGoogleBtn();
  }

  return el;
}
