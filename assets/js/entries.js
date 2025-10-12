// assets/js/entries.js
// 新增記帳、檢查今天是否已記帳

import { auth, db } from './firebase.js';
import {
  collection, addDoc, serverTimestamp,
  query, where, limit, getDocs
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';
import { bumpStreak } from './analytics/streak.js';

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
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('尚未登入');

  const { ledgerId, type, amount, currency, categoryId, note, date } = payload;

  // 寫入 entries
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
