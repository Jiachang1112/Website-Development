// assets/js/entries.js
import { db } from './firebase.js';
import {
  collection, doc, addDoc, getDocs, deleteDoc,
  serverTimestamp, Timestamp, orderBy, query, where, limit
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

/** 取得目前登入者 Email */
function getSignedEmail() {
  try {
    const u = window.session_user || JSON.parse(localStorage.getItem('session_user')||'null');
    return u?.email || null;
  } catch { return null; }
}

/**
 * ✨ 新增一筆支出（可跨裝置同步）
 * @param {Object} user - 登入使用者（至少要有 email）
 * @param {Object} data - { item, category, amount, ts?, note?, source? }
 */
export async function saveExpense(user, data) {
  const email = user?.email || getSignedEmail();
  if (!email) throw new Error('login required');

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
    email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const col = collection(db, 'expenses', email, 'records');
  return await addDoc(col, payload);
}

/** ✨ 批次新增 */
export async function saveExpenseBatch(user, items = []) {
  return Promise.all(items.map(i => saveExpense(user, i)));
}

/** ✨ 讀取最近 N 筆 */
export async function getRecentExpenses(n = 10, email = getSignedEmail()) {
  if (!email) return [];
  const col = collection(db, 'expenses', email, 'records');
  const q = query(col, orderBy('createdAt', 'desc'), limit(n));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** ✨ 查詢某段日期範圍內的資料（明細頁用） */
export async function getExpensesByRange(from, to, email = getSignedEmail()) {
  if (!email) return [];
  const col = collection(db, 'expenses', email, 'records');
  const q = query(
    col,
    where('ts', '>=', new Date(from)),
    where('ts', '<=', new Date(to)),
    orderBy('ts', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** ✨ 刪除單筆 */
export async function deleteExpense(id, email = getSignedEmail()) {
  if (!email || !id) throw new Error('missing id or email');
  const ref = doc(collection(db, 'expenses', email, 'records'), id);
  await deleteDoc(ref);
}
