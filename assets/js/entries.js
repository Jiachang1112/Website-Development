// assets/js/entries.js
import { db } from './firebase.js';
import {
  doc, collection, addDoc, getDocs, query, where, orderBy, limit,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

/* ========== Auth helper ========== */
function getSignedEmail() {
  try {
    const u = window.session_user || JSON.parse(localStorage.getItem('session_user') || 'null');
    return u?.email || null;
  } catch { return null; }
}

/* ========== Path helpers（你的真實結構：expenses/{email}/entries/{docId}） ========== */
function colRefForEmail(email) {
  return collection(doc(db, 'expenses', email), 'entries');
}
function mapDoc(email, docSnap) {
  const data = docSnap.data();
  return {
    id: docSnap.id,                                   // Firestore docId
    __path: `expenses/${email}/entries/${docSnap.id}`,// 完整路徑（刪除/編輯用）
    __email: email,                                   // 備援用
    ...data
  };
}

/* ========== Create ========== */
export async function addEntryForEmail(payload) {
  const email = getSignedEmail();
  if (!email) throw new Error('尚未登入');

  const ref = colRefForEmail(email);
  const docRef = await addDoc(ref, {
    type: payload.type || 'expense',           // 'expense' | 'income'
    amount: Number(payload.amount),
    categoryId: payload.categoryId || '其他',
    note: payload.note || '',
    date: payload.date,                        // YYYY-MM-DD
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return { id: docRef.id, path: `expenses/${email}/entries/${docRef.id}` };
}

/* ========== Aggregations ========== */
export async function getTodayTotalForEmail(email = getSignedEmail()) {
  if (!email) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const ref = colRefForEmail(email);
  const qy = query(ref, where('date', '==', today));
  const snap = await getDocs(qy);
  let sum = 0;
  snap.forEach(d => sum += Number(d.data().amount || 0));
  return sum;
}

/* ========== Reads ========== */
export async function getRecentEntriesForEmail(email = getSignedEmail(), n = 10) {
  if (!email) return [];
  const ref = colRefForEmail(email);
  const qy = query(ref, orderBy('createdAt', 'desc'), limit(n));
  const snap = await getDocs(qy);
  return snap.docs.map(d => mapDoc(email, d));
}

/** 取得一段日期範圍（含頭含尾；依 date 升冪） */
export async function getEntriesRangeForEmail(email = getSignedEmail(), from, to) {
  if (!email) return [];
  const ref = colRefForEmail(email);
  const qy = query(
    ref,
    where('date', '>=', from),
    where('date', '<=', to),
    orderBy('date', 'asc')
  );
  const snap = await getDocs(qy);
  return snap.docs.map(d => mapDoc(email, d));
}
