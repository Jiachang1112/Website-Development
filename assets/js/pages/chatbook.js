// assets/js/pages/chatbook.js
import { addEntryForEmail, getRecentEntriesForEmail, getTodayTotalForEmail } from '../entries.js';

function todayStr(offset=0){
  const d=new Date(); d.setDate(d.getDate()+offset);
  return d.toISOString().slice(0,10);
}
function parseDate(t){
  if(/今天/.test(t)) return todayStr(0);
  if(/昨天/.test(t)) return todayStr(-1);
  if(/前天/.test(t)) return todayStr(-2);
  const m=t.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if(m){ return `${m[1]}-${String(+m[2]).padStart(2,'0')}-${String(+m[3]).padStart(2,'0')}`; }
  return todayStr(0);
}
function parseAmt(t){
  const m=t.match(/(\d+(?:\.\d+)?)/);
  return m?parseFloat(m[1]):NaN;
}

// AI 自動分類（簡易關鍵字規則）
function autoCategory(text){
  if(/牛奶|餐|飲|超商|早餐|便當|咖啡|全聯|麥當勞|飲料|珍奶/.test(text)) return '餐飲';
  if(/公車|捷運|高鐵|計程車|加油|停車/.test(text)) return '交通';
  if(/電影|遊戲|音樂|娛樂|電影院|唱歌/.test(text)) return '娛樂';
  if(/課本|筆|書|文具|學費|補習|學習/.test(text)) return '學習';
  return '其他';
}

// 嘗試取得登入的 email
function getUserEmail(){
  try{
    if (window.session_user?.email) return window.session_user.email;
    const fromLocal = JSON.parse(localStorage.getItem('session_user')||'null');
    if (fromLocal?.email) return fromLocal.email;
    const fromSession = JSON.parse(sessionStorage.getItem('session_user')||'null');
    if (fromSession?.email) return fromSession.email;
    return null;
  }catch{ return null; }
}

export function ChatbookPage(){
  const el=document.createElement('div'); el.className='container card';
  el.innerHTML=`
    <h3>聊天記帳</h3>
    <div id="chat" style="min-height:240px;max-height:60vh;overflow:auto;padding:8px;border:1px solid #ffffff22;border-radius:12px;background:#0f1520"></div>
    <div id="summary" style="margin-top:8px;color:#9aa3af;font-size:0.9rem"></div>
    <div class="row" style="margin-top:8px">
      <input id="msg" placeholder="昨天 星巴克 拿鐵 95 餐飲"/>
      <button class="ghost" id="send">送出</button>
      <button class="ghost" id="chart">📊 統計</button>
    </div>`;

  const chat=el.querySelector('#chat'), msg=el.querySelector('#msg');
  const summary=el.querySelector('#summary');

  function add(text,who){
    const b=document.createElement('div'); b.style.margin='6px 0';
    b.innerHTML = (who==='me')
      ? `<div style="text-align:right"><span class="badge" style="background:var(--accent);color:#fff;border:0">${text}</span></div>`
      : `<div><span class="badge">${text}</span></div>`;
    chat.appendChild(b); chat.scrollTop=chat.scrollHeight;
  }

  async function refreshSummary(email){
    const total = await getTodayTotalForEmail(email);
    summary.textContent = `💰 今日支出合計：NT$ ${total.toLocaleString()}`;
  }

  async function showRecent(email){
    const recents = await getRecentEntriesForEmail(email, 10);
    if(recents.length===0){ add('目前沒有記帳紀錄喔～','bot'); return; }
    add('📅 最近的支出紀錄：','bot');
    recents.forEach(r=>{
      add(`${r.date}｜${r.note}｜${r.categoryId}｜NT$ ${r.amount}`,'bot');
    });
  }

  async function handle(t){
    add(t,'me');
    const email = getUserEmail();
    if(!email){ add('請先登入帳號再記帳喔。','bot'); return; }

    const amt=parseAmt(t);
    if(!amt){ add('沒抓到金額，試試：今天 超商 咖啡 65 餐飲','bot'); return; }

    const date=parseDate(t);
    const cat=autoCategory(t);
    const item=t.replace(/今天|昨天|前天|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|餐飲|交通|娛樂|學習|其他|\d+(?:\.\d+)?/g,' ').trim() || '未命名品項';

    try{
      await addEntryForEmail({
        type: 'expense',
        amount: amt,
        categoryId: cat,
        note: item,
        date
      });
      add(`已記帳：${item}｜${cat}｜${amt}｜${date}`,'bot');
      await refreshSummary(email);
    }catch(err){
      console.error(err);
      add('寫入失敗：' + (err?.message || err),'bot');
    }
  }

  el.querySelector('#send').addEventListener('click',()=>{
    if(!msg.value.trim()) return;
    handle(msg.value.trim());
    msg.value=''; msg.focus();
  });
  msg.addEventListener('keydown',e=>{
    if(e.key==='Enter'){ el.querySelector('#send').click(); }
  });

  // 顯示初始提示與統計
  add('嗨！說：「今天 全聯 牛奶 65 餐飲」我會幫你記帳。','bot');

  const email = getUserEmail();
  if(email){
    refreshSummary(email);
    showRecent(email);
  }

  // 點擊圖表按鈕 → 切換到統計頁
  el.querySelector('#chart').addEventListener('click',()=>{
    window.location.href = '#chart';
  });

  return el;
}
