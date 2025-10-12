// assets/js/entries.js
// ------------------------------------------------------------
// 1) Firestore：新增記帳 / 檢查今天是否已記帳（沿用你原本）
// 2) 支出/聊天記帳/拍照記帳頁面：全部改寫成寫入 Firestore：
//    路徑：expenses/{email}/records/{autoId}
// ------------------------------------------------------------

import { auth, db } from './firebase.js';
import {
  collection, addDoc, serverTimestamp,
  query, where, limit, getDocs, doc, setDoc
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';
import { bumpStreak } from './analytics/streak.js';

// =============== 工具 ===============
function assertLogin() {
  const u = auth.currentUser;
  if (!u || !u.email) throw new Error('尚未登入');
  return u;
}
function todayStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}
function parseDateText(t) {
  if (/今天/.test(t)) return todayStr(0);
  if (/昨天/.test(t)) return todayStr(-1);
  if (/前天/.test(t)) return todayStr(-2);
  const m = t.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) return `${m[1]}-${String(+m[2]).padStart(2, '0')}-${String(+m[3]).padStart(2, '0')}`;
  return todayStr(0);
}
function parseAmount(t) {
  const m = t.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : NaN;
}
function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// =============== 1) 你原本的 entries API：保留（使用 users/{uid}/ledgers/...） ===============
/**
 * 新增一筆記帳（你原本的結構）
 * users/{uid}/ledgers/{ledgerId}/entries
 */
export async function addEntry(payload) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('尚未登入');

  const { ledgerId, type, amount, currency, categoryId, note, date } = payload;

  await addDoc(collection(db, 'users', uid, 'ledgers', ledgerId, 'entries'), {
    type,
    amount: Number(amount),
    currency,
    categoryId: categoryId || null,
    note: note || '',
    date, // YYYY-MM-DD
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // 連續記帳（僅當日第一筆有效）
  await bumpStreak(uid);
}

/**
 * 檢查今天是否已記帳（該帳本）
 */
export async function hasEntryToday(ledgerId) {
  const uid = auth.currentUser?.uid;
  if (!uid) return false;

  const today = new Date().toISOString().slice(0, 10);
  const qy = query(
    collection(db, 'users', uid, 'ledgers', ledgerId, 'entries'),
    where('date', '==', today),
    limit(1)
  );
  const snap = await getDocs(qy);
  return !snap.empty;
}

// =============== 2) 新的 Firestore 寫入：expenses/{email}/records ===============
/**
 * 將一筆「支出」寫到：
 * expenses/{email}/records/{autoId}
 */
async function saveExpenseToEmailCollection(userEmail, record) {
  // 保證有個使用者節點（非必要，但可預留總覽資料）
  await setDoc(
    doc(db, 'expenses', userEmail),
    {
      email: userEmail,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // 新增一筆記錄
  await addDoc(collection(db, 'expenses', userEmail, 'records'), {
    ...record,
    createdAt: serverTimestamp(),
  });
}

// =============== 3) 支出頁（改寫為 Firestore 寫入 expenses/{email}/records） ===============
import { fmt } from './app.js'; // 你原本有用到 fmt.money；保留匯入避免錯誤

export function ExpensePage() {
  const $root = el(`
    <div class="container card">
      <h3>支出</h3>
      <div class="row" style="gap:8px;align-items:end">
        <div class="col-auto">
          <label class="form-label">日期</label>
          <input id="date" type="date" class="form-control"/>
        </div>
        <div class="col">
          <label class="form-label">品項</label>
          <input id="item" class="form-control" placeholder="品項"/>
        </div>
        <div class="col">
          <label class="form-label">分類</label>
          <input id="cat" class="form-control" placeholder="分類"/>
        </div>
        <div class="col-auto">
          <label class="form-label">金額</label>
          <input id="amt" type="number" class="form-control" placeholder="金額"/>
        </div>
        <div class="col-auto">
          <button class="primary btn btn-primary" id="add">新增</button>
        </div>
      </div>
      <div class="small mt-2">快速鍵：右下角「＋」也會跳到此頁。</div>
      <div id="msg" class="small text-muted mt-2"></div>
    </div>
  `);

  const d = new Date();
  $root.querySelector('#date').value = d.toISOString().slice(0, 10);

  $root.querySelector('#add').addEventListener('click', async () => {
    const msg = $root.querySelector('#msg');
    msg.textContent = '寫入中…';
    try {
      const u = assertLogin();
      const rec = {
        date: $root.querySelector('#date').value,
        item: $root.querySelector('#item').value?.trim() || '未命名品項',
        cat: $root.querySelector('#cat').value?.trim() || '其他',
        amount: parseFloat($root.querySelector('#amt').value || '0'),
        source: 'form',
      };
      if (!rec.amount || rec.amount < 0) throw new Error('金額需為正數');

      await saveExpenseToEmailCollection(u.email, rec);
      msg.textContent = `✅ 已加入：${rec.item}`;
      // 清空品項/分類/金額，但保留日期
      $root.querySelector('#item').value = '';
      $root.querySelector('#cat').value = '';
      $root.querySelector('#amt').value = '';
      setTimeout(() => (msg.textContent = ''), 1200);
    } catch (e) {
      console.error(e);
      msg.textContent = '❌ 失敗：' + (e.message || e);
    }
  });

  return $root;
}

// =============== 4) 聊天記帳頁（改寫為 Firestore 寫入 expenses/{email}/records） ===============
export function ChatbookPage() {
  const $root = el(`
    <div class="container card">
      <h3>聊天記帳</h3>
      <div id="chat" style="min-height:240px;max-height:50vh;overflow:auto;padding:8px;border:1px solid #ffffff22;border-radius:12px;background:#0f1520"></div>
      <div class="row" style="margin-top:8px">
        <input id="msg" class="form-control" placeholder="昨天 星巴克 拿鐵 95 餐飲"/>
        <button class="ghost btn btn-outline-light mt-2" id="send">送出</button>
      </div>
    </div>
  `);

  const chat = $root.querySelector('#chat'), msg = $root.querySelector('#msg');

  function addBubble(text, who) {
    const b = document.createElement('div');
    b.style.margin = '6px 0';
    b.innerHTML =
      who === 'me'
        ? `<div style="text-align:right"><span class="badge" style="background:var(--accent);color:#fff;border:0">${text}</span></div>`
        : `<div><span class="badge">${text}</span></div>`;
    chat.appendChild(b);
    chat.scrollTop = chat.scrollHeight;
  }

  async function handle(line) {
    addBubble(line, 'me');
    const amt = parseAmount(line);
    if (!amt) {
      addBubble('沒抓到金額，試試：今天 超商 咖啡 65 餐飲', 'bot');
      return;
    }
    const date = parseDateText(line);
    const cat = (line.match(/餐飲|交通|娛樂|學習|其他/) || ['其他'])[0];
    const item = line
      .replace(/今天|昨天|前天|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|餐飲|交通|娛樂|學習|其他|\d+(?:\.\d+)?/g, ' ')
      .trim() || '未命名品項';

    try {
      const u = assertLogin();
      await saveExpenseToEmailCollection(u.email, {
        date,
        item,
        cat,
        amount: amt,
        source: 'chat',
      });
      addBubble(`已記帳：${item}｜${cat}｜${amt}｜${date}`, 'bot');
    } catch (e) {
      console.error(e);
      addBubble('❌ 寫入失敗：' + (e.message || e), 'bot');
    }
  }

  $root.querySelector('#send').addEventListener('click', () => {
    if (!msg.value.trim()) return;
    handle(msg.value);
    msg.value = '';
    msg.focus();
  });
  msg.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      $root.querySelector('#send').click();
    }
  });

  addBubble('嗨！說：「今天 全聯 牛奶 65 餐飲」我會幫你記帳。', 'bot');
  return $root;
}

// =============== 5) 拍照記帳頁（改寫為 Firestore 寫入 expenses/{email}/records） ===============
import { ocrImage } from './ocr.js';
import { OCR_DEFAULT_LANG, OCR_LANGS } from './config.js';
import { cloudReady, cloudOCR } from './cloud.js';

export function CameraExpensePage() {
  const $root = el(`
    <div class="container card">
      <h3>拍照記帳</h3>
      <div class="row" style="gap:8px">
        <button class="ghost btn btn-outline-light" id="openCam">開啟相機</button>
        <button class="ghost btn btn-outline-light" id="runOCR">OCR 辨識</button>
        <button class="ghost btn btn-outline-light" id="runCloudOCR">雲端 OCR</button>
        <select id="lang" class="form-select" style="max-width:160px"></select>
      </div>
      <video id="v" playsinline style="width:100%;max-height:240px;display:none;border-radius:12px"></video>
      <canvas id="c" style="display:none"></canvas>
      <img id="img" style="max-width:100%;display:none;border-radius:12px"/>
      <div class="row" style="margin-top:8px;gap:8px;align-items:end">
        <div class="col-auto">
          <label class="form-label">日期</label>
          <input id="date" type="date" class="form-control"/>
        </div>
        <div class="col">
          <label class="form-label">品項</label>
          <input id="item" class="form-control" placeholder="品項"/>
        </div>
        <div class="col">
          <label class="form-label">分類</label>
          <input id="cat" class="form-control" placeholder="分類"/>
        </div>
        <div class="col-auto">
          <label class="form-label">金額</label>
          <input id="amt" type="number" class="form-control" placeholder="金額"/>
        </div>
        <div class="col-auto">
          <button class="primary btn btn-primary" id="save">存為支出</button>
        </div>
      </div>
      <div id="msg" class="small text-muted mt-2"></div>
    </div>
  `);

  const v = $root.querySelector('#v'),
    c = $root.querySelector('#c'),
    img = $root.querySelector('#img'),
    date = $root.querySelector('#date'),
    amt = $root.querySelector('#amt'),
    item = $root.querySelector('#item'),
    cat = $root.querySelector('#cat'),
    msg = $root.querySelector('#msg');

  date.value = new Date().toISOString().slice(0, 10);
  let stream = null,
    dataUrl = null;

  const langSel = $root.querySelector('#lang');
  (OCR_LANGS || ['eng']).forEach((l) => {
    const o = document.createElement('option');
    o.value = l;
    o.textContent = l;
    langSel.appendChild(o);
  });
  langSel.value = OCR_DEFAULT_LANG || 'eng';

  $root.querySelector('#openCam').addEventListener('click', async () => {
    if (!stream) {
      stream = await navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' } })
        .catch(() => null);
      if (!stream) {
        alert('相機啟動失敗');
        return;
      }
      v.srcObject = stream;
      await v.play();
      v.style.display = 'block';
    } else {
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(v, 0, 0);
      dataUrl = c.toDataURL('image/jpeg', 0.9);
      img.src = dataUrl;
      img.style.display = 'block';
      v.pause();
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
      v.style.display = 'none';
    }
  });

  async function applyText(text) {
    const body = (text || '').replace(/\s+/g, ' ');
    const head = (text || '')
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean)[0] || '';
    const nums = Array.from(body.matchAll(/(\d{1,6}(?:[.,]\d{1,2})?)/g)).map((m) =>
      m[1].replace(',', '.')
    );
    let max = 0;
    for (const s of nums) {
      const n = parseFloat(s);
      if (!isNaN(n) && n > max && n < 100000) max = n;
    }
    if (max) amt.value = String(max);
    const dm = body.match(/(20\d{2}|19\d{2})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
    if (dm) {
      date.value = `${dm[1]}-${String(+dm[2]).padStart(2, '0')}-${String(+dm[3]).padStart(2, '0')}`;
    }
    item.value = head.slice(0, 40) || item.value || '收據';
    if (/餐|飲|咖啡|便當|超商/.test(body) && !cat.value) cat.value = '餐飲';
  }

  $root.querySelector('#runOCR').addEventListener('click', async () => {
    if (!dataUrl) {
      alert('請先拍照或上傳');
      return;
    }
    const text = await ocrImage(dataUrl, langSel.value).catch((e) => {
      alert('OCR 失敗');
      console.error(e);
      return '';
    });
    await applyText(text);
  });

  $root.querySelector('#runCloudOCR').addEventListener('click', async () => {
    if (!dataUrl) {
      alert('請先拍照或上傳');
      return;
    }
    if (!cloudReady()) {
      alert('尚未設定 Supabase');
      return;
    }
    const res = await cloudOCR(dataUrl, langSel.value).catch((e) => {
      alert('雲端 OCR 失敗');
      console.error(e);
      return null;
    });
    if (!res) return;
    const { text, fields } = res;
    if (fields?.amount) amt.value = fields.amount;
    if (fields?.date) date.value = fields.date;
    if (fields?.vendor) item.value = fields.vendor;
    await applyText(text || '');
  });

  $root.querySelector('#save').addEventListener('click', async () => {
    msg.textContent = '寫入中…';
    try {
      const u = assertLogin();
      const rec = {
        date: date.value || todayStr(0),
        item: item.value?.trim() || '未命名品項',
        cat: cat.value?.trim() || '其他',
        amount: parseFloat(amt.value || '0'),
        source: 'camera',
      };
      if (!rec.amount || rec.amount < 0) throw new Error('金額需為正數');

      await saveExpenseToEmailCollection(u.email, rec);
      msg.textContent = '✅ 已儲存支出';
      item.value = '';
      cat.value = '';
      amt.value = '';
      setTimeout(() => (msg.textContent = ''), 1200);
    } catch (e) {
      console.error(e);
      msg.textContent = '❌ 失敗：' + (e.message || e);
    }
  });

  return $root;
}
