// db.js 內新增：刪除工具
import { db } from './firebase.js';
import { doc, deleteDoc, getDoc } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

/**
 * 智能刪除一筆記帳明細。
 * 會依序嘗試：
 *   1) 你給的完整路徑 path（若提供）
 *   2) 指定集合 coll（預設 'transactions'）
 *   3) 常見替代集合：'expenses'、'incomes'
 *   4) 巢狀路徑：users/{uid}/books/{bookId}/transactions/{id}
 *
 * @param {Object} opt
 * @param {string} opt.id        - 文件 id（必填）
 * @param {string} [opt.path]    - 文件完整路徑（例："transactions/abc123"），若提供會優先用
 * @param {string} [opt.coll]    - 集合名稱（例："transactions" | "expenses" | "incomes"）
 * @param {string} [opt.uid]     - 使用者 uid（巢狀路徑需要）
 * @param {string} [opt.bookId]  - 帳本 id（巢狀路徑需要）
 * @returns {Promise<{ok:boolean, pathUsed:string}>}
 */
export async function remove(opt = {}) {
  const { id, path, coll = 'transactions', uid = null, bookId = null } = opt || {};
  if (!id) throw new Error('remove() 需要 id');

  // 1) 使用明確 path（最可靠）
  if (path) {
    const ref = doc(db, path);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await deleteDoc(ref);
      return { ok: true, pathUsed: path };
    }
  }

  // 2) 嘗試指定集合
  const tryPaths = [
    `${coll}/${id}`,
    // 3) 常見替代集合
    `transactions/${id}`,
    `expenses/${id}`,
    `incomes/${id}`
  ];

  for (const p of tryPaths) {
    try {
      const ref = doc(db, p);
      const s = await getDoc(ref);
      if (s.exists()) {
        await deleteDoc(ref);
        return { ok: true, pathUsed: p };
      }
    } catch (_) {}
  }

  // 4) 巢狀路徑（若提供 uid/bookId）
  if (uid && bookId) {
    const nested = `users/${uid}/books/${bookId}/transactions/${id}`;
    try {
      const ref = doc(db, nested);
      const s = await getDoc(ref);
      if (s.exists()) {
        await deleteDoc(ref);
        return { ok: true, pathUsed: nested };
      }
    } catch (_) {}
  }

  // 找不到就報錯，讓呼叫端可提示
  throw new Error(`找不到可刪除的文件：id=${id}（請確認集合/路徑/權限）`);
}

/**
 * 批次刪除（不會因單筆失敗而中斷）
 * @param {string[]} ids
 * @param {Object} opt - 同 remove() 的其他選項
 * @returns {Promise<{done:number, fail:number, results:Array}>}
 */
export async function removeMany(ids = [], opt = {}) {
  const results = await Promise.allSettled(ids.map(id => remove({ ...opt, id })));
  const done = results.filter(r => r.status === 'fulfilled').length;
  const fail = results.length - done;
  return { done, fail, results };
}
