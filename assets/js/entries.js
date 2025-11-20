// assets/js/entries.js
// 負責從 Firestore 讀取記帳資料 (支援多帳本)

import { auth, db } from './firebase.js';
import {
  collection, getDocs, query, where, orderBy
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

// ----------------------------------------
// 核心：取得目前使用者的所有帳本資料
// ----------------------------------------
export async function getEntriesRange(from, to) {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    // 1. 先取得使用者有哪些帳本 (包含自己建立的 + 別人分享的)
    const ledgersRef = collection(db, 'users', user.uid, 'ledgers');
    const ledgersSnap = await getDocs(ledgersRef);

    if (ledgersSnap.empty) return [];

    // 2. 平行去抓取「每一個帳本」在指定日期範圍內的資料
    const promises = ledgersSnap.docs.map(async (docSnap) => {
      const ledgerId = docSnap.id;
      const ledgerName = docSnap.data().name || '未命名帳本';
      
      // 進入該帳本的 entries 子集合
      const entriesRef = collection(db, 'users', user.uid, 'ledgers', ledgerId, 'entries');
      
      // 設定日期查詢條件
      const q = query(
        entriesRef,
        where('date', '>=', from),
        where('date', '<=', to)
      );

      const snap = await getDocs(q);
      
      // 整理資料，並補上 ledgerName 方便顯示
      return snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          __path: d.ref.path, // 存下完整路徑，之後刪除/修改需要用到
          __ledgerName: ledgerName, // 補上帳本名稱
          ...data
        };
      });
    });

    // 3. 等待所有查詢完成
    const results = await Promise.all(promises);

    // 4. 將所有帳本的資料合併成一個大陣列
    const allEntries = results.flat();

    // 5. 依照日期排序 (由新到舊)
    allEntries.sort((a, b) => {
      // 先比日期
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      // 如果日期一樣，比建立時間 (createdAt)
      const tA = a.createdAt?.seconds || 0;
      const tB = b.createdAt?.seconds || 0;
      return tB - tA;
    });

    return allEntries;

  } catch (e) {
    console.error("讀取明細失敗:", e);
    return [];
  }
}

// (保留舊函式名稱以防報錯，但直接轉接新邏輯)
export async function getEntriesRangeForEmail(email, from, to) {
  return getEntriesRange(from, to);
}
