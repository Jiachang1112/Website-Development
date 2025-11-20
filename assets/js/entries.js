// assets/js/entries.js
// 負責從 Firestore 讀取記帳資料 (支援多帳本結構)

import { auth, db } from './firebase.js';
import {
  collection, getDocs, query, where, orderBy, limit
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

/* ========== 讀取邏輯核心 ========== */

// 1. 取得目前使用者的所有帳本
async function getUserLedgers(uid) {
  const ledgersRef = collection(db, 'users', uid, 'ledgers');
  const snap = await getDocs(ledgersRef);
  return snap.docs.map(d => ({
    id: d.id,
    name: d.data().name || '未命名帳本'
  }));
}

// 2. (主要功能) 讀取指定日期範圍內的所有明細
export async function getEntriesRange(from, to) {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    // A. 先查出有哪些帳本
    const ledgers = await getUserLedgers(user.uid);
    if (ledgers.length === 0) return [];

    // B. 平行去查每個帳本的 entries
    const promises = ledgers.map(async (ledger) => {
      const entriesRef = collection(db, 'users', user.uid, 'ledgers', ledger.id, 'entries');
      const q = query(
        entriesRef,
        where('date', '>=', from),
        where('date', '<=', to)
        // 注意：這裡不加 orderBy，因為跨多個查詢合併後再排序比較準確
      );
      
      const snap = await getDocs(q);
      return snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          __path: d.ref.path,       // 存下路徑供刪除/修改用
          __ledgerName: ledger.name, // 補上帳本名稱供顯示
          ...data
        };
      });
    });

    // C. 等待全部結果並合併
    const results = await Promise.all(promises);
    const allEntries = results.flat();

    // D. 在前端進行排序 (日期新 -> 舊)
    allEntries.sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      // 如果日期一樣，比建立時間 (createdAt)
      const tA = a.createdAt?.seconds || 0;
      const tB = b.createdAt?.seconds || 0;
      return tB - tA;
    });

    return allEntries;

  } catch (e) {
    console.error("讀取失敗:", e);
    return [];
  }
}

// 3. (相容舊版) 為了不讓其他還沒改的頁面壞掉，保留這個函式名稱
// 但內部直接轉接給新的 getEntriesRange
export async function getEntriesRangeForEmail(email, from, to) {
  return getEntriesRange(from, to);
}

// 4. (相容舊版) 取得最近 N 筆 (改為抓取最近一個月的資料來模擬)
export async function getRecentEntriesForEmail(email, n = 10) {
  // 簡單實作：抓前後 60 天的資料，然後切片
  const today = new Date();
  const prior = new Date(); prior.setDate(today.getDate() - 60);
  
  const to = today.toISOString().split('T')[0];
  const from = prior.toISOString().split('T')[0];
  
  const list = await getEntriesRange(from, to);
  return list.slice(0, n);
}

// 5. (相容舊版) 取得今日總額
export async function getTodayTotalForEmail(email) {
  const today = new Date().toISOString().split('T')[0];
  const list = await getEntriesRange(today, today);
  return list.reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

// (其他不需要的 Create 函式可移除，因為已經移到 expense.js 處理了)
export async function addEntryForEmail() {
  throw new Error("請改用 ExpensePage 的新版寫入邏輯");
}
