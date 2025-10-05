// assets/js/analytics/streak.js
// 連續記帳（Streak）寫入 users/{uid}/settings.streak

import { db } from '../firebase.js';
import { doc, getDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

const toYmd = (d = new Date()) => d.toISOString().slice(0,10);
const isYesterday = (prevYmd, todayYmd) => {
  const d1 = new Date(prevYmd + 'T00:00:00');
  const d2 = new Date(todayYmd + 'T00:00:00');
  return (d2 - d1) === 24 * 60 * 60 * 1000;
};

/**
 * 在「當天第一筆新增成功」後呼叫
 * @param {string} uid
 */
export async function bumpStreak(uid){
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);

  const today = toYmd();
  const before = (snap.exists() && snap.data()?.settings?.streak) || { current:0, best:0, lastEntryDate:null };

  // 今天已經計過，不重複加分
  if (before.lastEntryDate === today) return;

  let current = 1;
  if (before.lastEntryDate && isYesterday(before.lastEntryDate, today)) current = (before.current || 0) + 1;
  const best = Math.max(before.best || 0, current);

  await updateDoc(ref, {
    'settings.streak': { current, best, lastEntryDate: today },
    updatedAt: serverTimestamp(),
  });
}
