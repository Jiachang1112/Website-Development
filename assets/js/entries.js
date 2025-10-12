// assets/js/entries.js
import { db } from './firebase.js';
import {
  doc, collection, addDoc, getDocs, query, where, orderBy, limit,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

function getSignedEmail() {
  try {
    const u = window.session_user || JSON.parse(localStorage.getItem('session_user')||'null');
    return u?.email || null;
  } catch { return null; }
}

// 新增記帳
export async function addEntryForEmail(payload) {
  const email = getSignedEmail();
  if (!email) throw new Error('尚未登入');
  const colRef = collection(doc(db, 'expenses', email), 'entries');
  await addDoc(colRef, {
    type: payload.type || 'expense',
    amount: Number(payload.amount),
    categoryId: payload.categoryId || '其他',
    note: payload.note || '',
    date: payload.date,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

// 今日支出合計
export async function getTodayTotalForEmail(email = getSignedEmail()) {
  if (!email) return 0;
  const today = new Date().toISOString().slice(0,10);
  const colRef = collection(doc(db, 'expenses', email), 'entries');
  const q = query(colRef, where('date','==',today));
  const snap = await getDocs(q);
  let sum = 0;
  snap.forEach(d=> sum += Number(d.data().amount || 0));
  return sum;
}

// 最近 10 筆支出
export async function getRecentEntriesForEmail(email = getSignedEmail(), n = 10) {
  if (!email) return [];
  const colRef = collection(doc(db, 'expenses', email), 'entries');
  const q = query(colRef, orderBy('createdAt','desc'), limit(n));
  const snap = await getDocs(q);
  return snap.docs.map(d=>d.data());
}
