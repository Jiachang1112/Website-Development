// assets/js/pages/chatbook.js
import { addEntryForEmail } from '../entries.js';
import { fmt } from '../app.js';

/* --- 小工具 --- */
function todayStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}
function parseDate(t) {
  if (/今天/.test(t)) return todayStr(0);
  if (/昨天/.test(t)) return todayStr(-1);
  if (/前天/.test(t)) return todayStr(-2);
  const m = t.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) {
    return `${m[1]}-${String(+m[2]).padStart(2,'0')}-${String(+m[3]).padStart(2,'0')}`;
  }
  return todayStr(0);
}
function parseAmount(t) {
  const m = t.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : NaN;
}
function guessCategory(text) {
  if (/餐|飲|早餐|午餐|晚餐|便當|咖啡|牛奶|超商/.test(text)) return '餐飲';
  if (/交通|捷運|公車|高鐵|油/.test(text)) return '交通';
  if (/娛樂|電影|遊戲|演唱會|樂園/.test(text)) return '娛樂';
  if (/薪|獎金|收入|轉入|紅包/.test(text)) return '收入';
  if (/學習|課程|書|學費/.test(text)) return '學習';
  return '其他';
}
function inferType(note, amount) {
  if (amount < 0) return 'expense';
  if (/薪|獎金|收入|轉入|贈|退費/.test(note)) return 'income';
  if (/刷|繳|買|花|餐|飲|車|票|租/.test(note)) return 'expense';
  // 預設正數視為支出（也可改成 income，看你的習慣）
  return 'expense';
}

export function ChatbookPage(){
  const el = document.createElement('div');
  el.className = 'container card';

  el.innerHTML = `
    <h3>聊天記帳</h3>
    <div id="chat" style="min-height:240px;max-height:50vh;overflow:auto;padding:8px;border:1px solid #ffffff22;border-radius:12px;background:#0f1520"></div>
    <div class="row" style="margin-top:8px">
      <input id="msg" placeholder="例：今天 全聯 牛奶 65 餐飲 / 昨天 領薪水 25000"/>
      <button class="ghost" id="send">送出</button>
    </div>
  `;

  const chat = el.querySelector('#chat');
  const msg  = el.querySelector('#msg');

  function bubble(text, who){
    const b = document.createElement('div');
    b.style.margin = '6px 0';
    b.innerHTML =
      who === 'me'
        ? `<div style="text-align:right"><span class="badge" style="background:var(--accent);color:#fff;border:0">${text}</span></div>`
        : `<div><span class="badge">${text}</span></div>`;
    chat.appendChild(b);
    chat.scrollTop = chat.scrollHeight;
  }

  async function handle(text){
    const raw = (text || '').trim();
    if (!raw) return;

    bubble(raw, 'me');

    // 1) 解析
    const date = parseDate(raw);
    let amount = parseAmount(raw);
    if (Number.isNaN(amount)) {
      bubble('沒抓到金額，試試：今天 超商 咖啡 65（支出）或 今天 領薪水 25000（收入）', 'bot');
      return;
    }

    // 允許以負號輸入（-500 視為支出）
    const category = guessCategory(raw);
    const note = raw
      .replace(/今天|昨天|前天/g, ' ')
      .replace(/\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/g, ' ')
      .replace(/-?\d+(?:\.\d+)?/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || (category === '收入' ? '收入' : '未命名品項');

    // 2) 判斷收入/支出
    const type = inferType(note, amount);
    const amountAbs = Math.abs(amount);

    // 3) 寫入 Firestore
    await addEntryForEmail({
      type,                      // 'expense' or 'income'
      amount: amountAbs,         // 正數存
      categoryId: category,
      note,
      date
    });

    bubble(
      `已記帳：${note}｜${category}｜${type === 'income' ? '+' : '-'}${fmt.money(amountAbs)}｜${date}`,
      'bot'
    );

    msg.value = '';
    msg.focus();
  }

  el.querySelector('#send').addEventListener('click', ()=> handle(msg.value));
  msg.addEventListener('keydown', (e)=>{ if (e.key === 'Enter') handle(msg.value); });

  bubble('嗨！說：「今天 全聯 牛奶 65」我會幫你記帳（支出）。說「今天 領薪水 25000」會記為收入。', 'bot');
  return el;
}
