// assets/js/entries.js
// 依「使用者 email」分流到 Firestore: expenses/{email}/entries

import { db } from './firebase.js';
import {
  doc, collection, addDoc, serverTimestamp,
  query, where, limit, getDocs
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

// 從你的 app 讀取 session_user；抓不到就直接讀 localStorage 再兜一次
import { currentUser } from './app.js';

function getSignedEmail() {
  try {
    const u = currentUser?.() || JSON.parse(localStorage.getItem('session_user') || 'null');
    return u?.email || null;
  } catch {
    return null;
  }
}

/**
 * 新增一筆記帳到 expenses/{email}/entries
 * @param {Object} payload
 * @param {'expense'|'income'} payload.type
 * @param {number|string} payload.amount
 * @param {string|null} payload.categoryId
 * @param {string} payload.note
 * @param {string} payload.date YYYY-MM-DD
 */
export async function addEntryForEmail(payload) {
  const email = getSignedEmail();
  if (!email) throw new Error('尚未登入');

  const { type, amount, categoryId, note, date } = payload;

  const colRef = collection(doc(db, 'expenses', email), 'entries');
  await addDoc(colRef, {
    type,
    amount: Number(amount),
    categoryId: categoryId || null,
    note: note || '',
    date,                          // YYYY-MM-DD
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * 檢查今天是否已記帳（在 expenses/{email}/entries）
 */
export async function hasEntryTodayForEmail() {
  const email = getSignedEmail();
  if (!email) return false;

  const today = new Date().toISOString().slice(0, 10);
  const colRef = collection(doc(db, 'expenses', email), 'entries');
  const q = query(colRef, where('date', '==', today), limit(1));
  const snap = await getDocs(q);
  return !snap.empty;
}
