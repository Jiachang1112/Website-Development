// assets/js/pages/auth.js
export function AuthPage(){
  const el = document.createElement('div');
  el.className = 'container card';

  // 讀取 session
  let user = null;
  try { user = JSON.parse(localStorage.getItem('session_user') || 'null'); } catch {}

  if (user) {
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
    el.querySelector('#logout').addEventListener('click', ()=>{
      localStorage.removeItem('session_user');
      location.reload();
    });
  } else {
    // 未登入時顯示 Google 按鈕容器（index.html 已放上 g_id_signin）
    el.innerHTML = `
      <h3>帳號</h3>
      <p class="small">按下方的 Google 登入按鈕登入。</p>
      <div id="googleBtnMount"></div>
      <a class="ghost" href="#dashboard">回首頁</a>
    `;
    // 將首頁上的 Google 按鈕節點搬進來（或直接在這裡再放一個 g_id_signin div 也行）
    const btn = document.querySelector('.g_id_signin');
    if (btn) el.querySelector('#googleBtnMount').appendChild(btn);
  }

  return el;
}
