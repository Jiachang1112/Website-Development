// assets/js/entries.js
// 以 Firestore 為單一來源：/expenses/{email}/records/*
// 提供依日期範圍查詢（YYYY-MM-DD），回傳含 doc.id，並以 date desc → createdAt desc 排序

import { db } from './firebase.js';
import {
  collection, query, where, orderBy, getDocs, limit
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

/**
 * 取得某位使用者在指定日期區間內的記帳資料
 * @param {string} email - 使用者 email（對應 /expenses/{email} 路徑）
 * @param {string} from  - 起始日期（含），格式 YYYY-MM-DD
 * @param {string} to    - 結束日期（含），格式 YYYY-MM-DD
 * @param {number} take  - 最大筆數（預設 500）
 * @returns {Promise<Array<Object>>} rows - 每筆含 { id, date, amount, type, categoryId, note, createdAt, ... }
 */
export async function getEntriesRangeForEmail(email, from, to, take = 500){
  if (!email) return [];

  // Firestore 要求：若有 range 篩選（date），orderBy 也要含該欄位
  // 我們用：orderBy('date','desc') → orderBy('createdAt','desc')
  // 注意：第一次執行可能會要求建立「複合索引」（console 會有連結）
  const col = collection(db, 'expenses', email, 'records');

  const q = query(
    col,
    where('date', '>=', from),
    where('date', '<=', to),
    orderBy('date', 'desc'),
    orderBy('createdAt', 'desc'),
    limit(take)
  );

  const snap = await getDocs(q);

  const rows = [];
  snap.forEach(docSnap => {
    const data = docSnap.data() || {};
    rows.push({
      id: docSnap.id,          // ✅ 回傳 id 供刪除/更新使用
      ...data
    });
  });

  // 萬一有些舊資料沒有 createdAt，就用二次排序保險一下（在記憶體內）
  rows.sort((a, b) => {
    const da = (a.date || '');
    const db = (b.date || '');
    if (db !== da) return db.localeCompare(da);

    const ta = ts(a.createdAt);
    const tb = ts(b.createdAt);
    return tb - ta; // desc
  });

  return rows;
}

/** createdAt 可能是 Firestore Timestamp/Date/ISO，這裡統一成數值方便排序 */
function ts(v){
  if (!v) return 0;
  try { if (typeof v.toDate === 'function') return v.toDate().getTime(); } catch {}
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : 0;
}
