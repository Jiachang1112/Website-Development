// assets/js/entries.js
import { db } from './firebase.js';
import {
  collection, addDoc, serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

/**
 * 新增一筆支出
 * @param {Object} user - 登入使用者（需有 email）
 * @param {Object} data - { item, category, amount, ts?, note?, source? }
 */
export async function saveExpense(user, data) {
  if (!user || !(user.email || user.uid)) {
    throw new Error('login required');
  }

  const docId = String(user.email || user.uid).trim().toLowerCase();
  const ts =
    data.ts instanceof Date
      ? Timestamp.fromDate(data.ts)
      : (data.ts?.seconds ? data.ts : serverTimestamp());

  const payload = {
    item: data.item || '',
    category: data.category || '',
    amount: Number(data.amount) || 0,
    note: data.note || '',
    source: data.source || 'form', // form | chat | camera ...
    ts,
    email: user.email || null,
    uid: user.uid || null,
    name: user.name || null,
    providerId: user.providerId || null,
    userAgent: navigator.userAgent,
    createdAt: serverTimestamp(),
  };

  const col = collection(db, 'expenses', docId, 'records');
  return await addDoc(col, payload);
}

/** 一次寫多筆記帳 */
export async function saveExpenseBatch(user, items = []) {
  return Promise.all(items.map(i => saveExpense(user, i)));
}
