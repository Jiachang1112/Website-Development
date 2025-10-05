// assets/js/pages/accounting-settings.js
// 最小可運作：把畫面插入 #app（或整頁 body）

const $ = (s, r = document) => r.querySelector(s);

function mount() {
  let root = $('#app');
  if (!root) {
    root = document.createElement('div');
    document.body.appendChild(root);
  }
  root.innerHTML = `
    <div style="max-width:960px;margin:40px auto;padding:16px;border:1px solid #2a2f37;border-radius:12px;background:#12161c;color:#e6e6e6">
      <h2 style="margin:0 0 12px">記帳設定（Demo）</h2>
      <p style="color:#9aa3af;margin:0 0 10px">
        這是測試頁，前端已成功載入 <code>assets/js/pages/accounting-settings.js</code> 🎉
      </p>

      <ul style="line-height:1.9;margin:12px 0 0">
        <li>管理帳本</li>
        <li>管理預算</li>
        <li>管理貨幣</li>
        <li>管理類型</li>
        <li>聊天設定：專屬角色、記帳指令</li>
        <li>一般設定：每日提醒、匯入帳本、匯出帳本</li>
      </ul>
    </div>
  `;
}

mount();
