import { put } from '../db.js';
function todayStr(offset=0){ const d=new Date(); d.setDate(d.getDate()+offset); return d.toISOString().slice(0,10); }
function parseDate(t){ if(/今天/.test(t)) return todayStr(0); if(/昨天/.test(t)) return todayStr(-1); if(/前天/.test(t)) return todayStr(-2); const m=t.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/); if(m){return `${m[1]}-${String(+m[2]).padStart(2,'0')}-${String(+m[3]).padStart(2,'0')}`;} return todayStr(0); }
function parseAmt(t){ const m=t.match(/(\d+(?:\.\d+)?)/); return m?parseFloat(m[1]):NaN; }
export function ChatbookPage(){
  const el=document.createElement('div'); el.className='container card';
  el.innerHTML=`<h3>聊天記帳</h3><div id="chat" style="min-height:240px;max-height:50vh;overflow:auto;padding:8px;border:1px solid #ffffff22;border-radius:12px;background:#0f1520"></div>
  <div class="row" style="margin-top:8px"><input id="msg" placeholder="昨天 星巴克 拿鐵 95 餐飲"/><button class="ghost" id="send">送出</button></div>`;
  const chat=el.querySelector('#chat'), msg=el.querySelector('#msg');
  function add(text,who){ const b=document.createElement('div'); b.style.margin='6px 0'; b.innerHTML=who==='me'?`<div style="text-align:right"><span class="badge" style="background:var(--accent);color:#fff;border:0">${text}</span></div>`:`<div><span class="badge">${text}</span></div>`; chat.appendChild(b); chat.scrollTop=chat.scrollHeight; }
  async function handle(t){ add(t,'me'); const amt=parseAmt(t); if(!amt){ add('沒抓到金額，試試：今天 超商 咖啡 65 餐飲','bot'); return; } const date=parseDate(t); const cat=(t.match(/餐飲|交通|娛樂|學習|其他/)||['其他'])[0]; const item=t.replace(/今天|昨天|前天|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|餐飲|交通|娛樂|學習|其他|\d+(?:\.\d+)?/g,' ').trim()||'未命名品項'; await put('expenses',{date,item,cat,amount:amt}); add(`已記帳：${item}｜${cat}｜${amt}｜${date}`,'bot'); }
  el.querySelector('#send').addEventListener('click',()=>{ handle(msg.value); msg.value=''; msg.focus(); });
  msg.addEventListener('keydown',e=>{ if(e.key==='Enter'){ el.querySelector('#send').click(); }});
  add('嗨！說：「今天 全聯 牛奶 65 餐飲」我會幫你記帳。','bot'); return el;
}
