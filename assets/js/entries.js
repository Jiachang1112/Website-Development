// assets/js/entries.js
// 新增記帳、檢查今天是否已記帳（同時寫入兩處：users/... 與 expenses/{email}/records）

import { auth, db } from './firebase.js';
import {
  collection, addDoc, serverTimestamp,
  query, where, limit, getDocs, doc, setDoc
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';
import { bumpStreak } from './analytics/streak.js';

/** 內部：另存一份到 expenses/{email}/records/{autoId} */
async function saveToEmailExpenses(email, data) {
  if (!email) return; // 沒 email 就略過第二份（避免整體報錯）
  // 建立/更新使用者節點（可放彙總欄位，這裡只寫 email 與 updatedAt）
  await setDoc(
    doc(db, 'expenses', email),
    { email, updatedAt: serverTimestamp() },
    { merge: true }
  );
  // 寫入一筆記錄
  await addDoc(collection(db, 'expenses', email, 'records'), data);
}

/**
 * 新增一筆記帳
 * @param {Object} payload
 * @param {string} payload.ledgerId
 * @param {'expense'|'income'} payload.type
 * @param {number|string} payload.amount
 * @param {string} payload.currency
 * @param {string|null} payload.categoryId
 * @param {string} payload.note
 * @param {string} payload.date YYYY-MM-DD
 */
export async function addEntry(payload){
  const uid   = auth.currentUser?.uid;
  const email = auth.currentUser?.email || '';
  if (!uid) throw new Error('尚未登入');

  const { ledgerId, type, amount, currency, categoryId, note, date } = payload;

  // 主要寫入：users/{uid}/ledgers/{ledgerId}/entries
  await addDoc(collection(db, 'users', uid, 'ledgers', ledgerId, 'entries'), {
    type,
    amount: Number(amount),
    currency,
    categoryId: categoryId || null,
    note: note || '',
    date, // YYYY-MM-DD
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  // 同步備份一份到：expenses/{email}/records/{autoId}
  await saveToEmailExpenses(email, {
    uid,
    ledgerId,
    type,
    amount: Number(amount),
    currency,
    categoryId: categoryId || null,
    note: note || '',
    date,
    source: 'app',            // 標註來源（可自訂：form/chat/camera/app）
    createdAt: serverTimestamp()
  });

  // 連續記帳（僅當日第一筆有效）
  await bumpStreak(uid);
}

/**
 * 檢查今天是否已記帳（該帳本）
 */
export async function hasEntryToday(ledgerId){
  const uid = auth.currentUser?.uid;
  if (!uid) return false;

  const today = new Date().toISOString().slice(0,10);
  const q = query(
    collection(db, 'users', uid, 'ledgers', ledgerId, 'entries'),
    where('date', '==', today),
    limit(1)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}
