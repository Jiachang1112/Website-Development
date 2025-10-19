// ===== Firebase base（與你專案一致） =====
import { auth, db } from '../firebase.js';
import {
  collection, query, where, orderBy, getDocs, Timestamp, doc, getDoc
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

// ===== DOM =====
const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

const bookSelect   = $('#bookSelect');
const monthPicker  = $('#monthPicker');
const refreshBtn   = $('#refreshBtn');

const incomeEl  = $('#incomeTotal');
const expenseEl = $('#expenseTotal');
const netEl     = $('#netTotal');

let pieChart = null;
let barChart = null;

// ===== 工具：金額格式 =====
const fmt = (n)=> new Intl.NumberFormat('zh-Hant-TW', { style:'currency', currency:'TWD', maximumFractionDigits:0 }).format(n||0);

// ===== 取得當月起訖（以使用者 local 月份為準，再轉 Timestamp）=====
function getMonthRange(ym /* '2025-10' */) {
  // 若未選，預設當月
  let base = ym ? new Date(`${ym}-01T00:00:00`) : new Date();
  const start = new Date(base.getFullYear(), base.getMonth(), 1, 0,0,0,0);
  const end   = new Date(base.getFullYear(), base.getMonth()+1, 1, 0,0,0,0);
  return {
    startTS: Timestamp.fromDate(start),
    endTS:   Timestamp.fromDate(end),
    daysInMonth: new Date(base.getFullYear(), base.getMonth()+1, 0).getDate(),
    y: base.getFullYear(),
    m: base.getMonth()+1
  };
}

// ===== 讀取使用者帳本清單（沿用你在 settings 的結構）=====
async function loadBooks(uid) {
  // 依你現有結構調整：假定 users/{uid}/books
  const booksRef = collection(db, 'users', uid, 'books');
  const snap = await getDocs(booksRef);
  const books = [];
  snap.forEach(d=> books.push({ id: d.id, ...d.data() }));
  // 填入下拉
  bookSelect.innerHTML = books.map(b=>`<option value="${b.id}">${b.name || '未命名帳本'}</option>`).join('');
  return books;
}

// ===== 讀取本月交易（對齊欄位相容性）=====
/**
 * 預期交易欄位：
 * - amount: number | string
 * - type: 'income' | 'expense' | 可能大小寫 / 中文（收入/支出）/ 縮寫
 * - timestamp: Firestore Timestamp | number(ms) | string(ISO)
 * - category: { id?:string, name?:string } or categoryName
 * - bookId, uid
 */
async function fetchMonthTransactions({ uid, bookId, ym }) {
  const { startTS, endTS } = getMonthRange(ym);

  // 最準確/高效作法：在交易集合上有 uid, bookId, timestamp 欄位
  const txRef = collection(db, 'transactions');
  const qy = query(
    txRef,
    where('uid', '==', uid),
    where('bookId', '==', bookId),
    where('timestamp', '>=', startTS),
    where('timestamp', '<', endTS),
    orderBy('timestamp','asc')
  );
  const snap = await getDocs(qy);

  const rows = [];
  snap.forEach(d=>{
    const raw = d.data();

    // 轉 timestamp -> JS Date
    let jsDate;
    if (raw.timestamp instanceof Timestamp) {
      jsDate = raw.timestamp.toDate();
    } else if (typeof raw.timestamp === 'number') {
      jsDate = new Date(raw.timestamp);
    } else if (typeof raw.timestamp === 'string') {
      jsDate = new Date(raw.timestamp);
    } else {
      // 沒有 timestamp 的資料直接略過（或補救：用 createdAt）
      return;
    }

    // 金額轉數字
    let amount = Number(raw.amount);
    if (Number.isNaN(amount)) amount = 0;

    // type 正規化
    let t = String(raw.type || '').trim().toLowerCase();
    // 相容：中文 / 縮寫 / 大小寫
    if (['income','in','i','收入','入'].includes(t)) t = 'income';
    else if (['expense','out','ex','e','支出','出'].includes(t)) t = 'expense';
    else t = 'unknown'; // 未知就歸 0，但也能在 console 提醒

    // 分類名稱
    const categoryName =
      (raw.category && (raw.category.name || raw.category.label)) ||
      raw.categoryName || '未分類';

    rows.push({
      id: d.id,
      amount,
      type: t,
      date: jsDate,
      y: jsDate.getFullYear(),
      m: jsDate.getMonth()+1,
      d: jsDate.getDate(),
      categoryName
    });
  });

  // 方便你除錯：看到本月實際載到幾筆、前 3 筆
  console.debug('[analysis] loaded tx count=', rows.length, rows.slice(0,3));
  return rows;
}

// ===== 統計與繪圖 =====
function summarize(rows, daysInMonth) {
  let income = 0, expense = 0;

  // 每日淨額（或你想拆成收入/支出兩條也行）
  const dailyNet = Array.from({length: daysInMonth}, ()=>0);

  // 類別分佈（以支出為主；若要收入也進餅圖可再拆兩張）
  const catMap = new Map();

  for (const r of rows) {
    if (r.type === 'income') income += r.amount;
    else if (r.type === 'expense') expense += r.amount;

    // daily：收入 +、支出 -
    const idx = r.d - 1;
    if (idx >=0 && idx < daysInMonth) {
      dailyNet[idx] += (r.type === 'expense' ? -r.amount : r.amount);
    }

    if (r.type === 'expense') {
      const key = r.categoryName || '未分類';
      catMap.set(key, (catMap.get(key) || 0) + r.amount);
    }
  }

  // 類別陣列
  const catLabels = [...catMap.keys()];
  const catData   = catLabels.map(k => catMap.get(k));

  return { income, expense, net: income - expense, dailyNet, catLabels, catData };
}

function renderSummary({ income, expense, net }) {
  incomeEl.textContent  = fmt(income);
  expenseEl.textContent = fmt(expense);
  netEl.textContent     = fmt(net);
}

function drawOrUpdatePie(labels, data) {
  const ctx = $('#pieByCategory');
  if (pieChart) pieChart.destroy();
  pieChart = new Chart(ctx, {
    type: 'pie',
    data: { labels, datasets: [{ data }] },
    options: {
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

function drawOrUpdateDailyBar(daysInMonth, dailyNet) {
  const ctx = $('#dailyBar');
  if (barChart) barChart.destroy();
  const labels = Array.from({length: daysInMonth}, (_,i)=>`${i+1}`);
  barChart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label:'本日淨額', data: dailyNet }]},
    options: {
      scales: { y: { beginAtZero: true }},
      plugins: { legend: { display: false } }
    }
  });
}

// ===== 主流程 =====
async function main() {
  // 預設月份（今天）
  if (!monthPicker.value) {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    monthPicker.value = ym;
  }

  // 等待登入
  const user = await new Promise(resolve=>{
    const unsub = auth.onAuthStateChanged(u => { unsub(); resolve(u); });
  });
  if (!user) {
    console.warn('[analysis] 未登入');
    // 你頁面若有未登入提示，這裡可直接 return，不做分析
    return;
  }
  const uid = user.uid;

  // 載入帳本，並保持選取
  const books = await loadBooks(uid);
  if (!books.length) {
    console.warn('[analysis] 無帳本，請先到設定新增預設帳本');
    return;
  }
  // 若 URL 有 ?book=xxx 可預選；否則保持第一個
  const url = new URL(location.href);
  const qbook = url.searchParams.get('book');
  if (qbook && books.some(b=>b.id===qbook)) bookSelect.value = qbook;

  // 首次載入
  await refresh(uid);

  // 綁定事件
  refreshBtn.addEventListener('click', ()=> refresh(uid));
  monthPicker.addEventListener('change', ()=> refresh(uid));
  bookSelect.addEventListener('change', ()=> refresh(uid));
}

async function refresh(uid) {
  const ym = monthPicker.value;         // 'YYYY-MM'
  const bookId = bookSelect.value;
  if (!bookId) return;

  const { daysInMonth } = getMonthRange(ym);
  const rows = await fetchMonthTransactions({ uid, bookId, ym });
  const sum = summarize(rows, daysInMonth);

  renderSummary(sum);
  drawOrUpdatePie(sum.catLabels, sum.catData);
  drawOrUpdateDailyBar(daysInMonth, sum.dailyNet);

  // 若出現「總額為 0」但明細確有資料，請先觀察 console：
  // 1) rows.length 是否 > 0
  // 2) type 是否被辨識為 income/expense；若大量變成 'unknown'，請檢查資料的 type 寫入
  // 3) timestamp 是否落在本月區間（資料是否用 serverTimestamp() 晚到）
}

main().catch(err=>{
  console.error('[analysis] fatal', err);
});
