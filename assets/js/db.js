// assets/js/db.js  —— IndexedDB 版（包含 put/getAll/remove/removeMany）

const DB_NAME = 'supertool-db';
const DB_VER  = 1;

// 依你原本的 store 名稱維持相容
const stores = ['users','expenses','incomes','orders','settings','products','images'];

// 開啟或建立資料庫
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      stores.forEach(s => {
        if (!db.objectStoreNames.contains(s)) {
          // 使用 id 當 keyPath，與你原有寫法相容
          db.createObjectStore(s, { keyPath: 'id' });
        }
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// 產生 id（若沒有）
function makeId() {
  return (window.crypto?.randomUUID?.() || ('id_' + Math.random().toString(36).slice(2)));
}

/** 新增/覆寫一筆（保持你原本的介面） */
export async function put(store, obj) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    const data = { ...obj };
    if (!data.id) data.id = makeId();
    const req = os.put(data);
    req.onsuccess = () => resolve(data);
    req.onerror   = () => reject(req.error);
  });
}

/** 讀取整個 store（保持你原本的介面） */
export async function getAll(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const os = tx.objectStore(store);
    const req = os.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => reject(req.error);
  });
}

/** 刪除一筆（新增） */
export async function remove(store, key) {
  const db = await openDB();
  const id = typeof key === 'object' ? key.id : key;
  if (!id) throw new Error('remove() 需要 id');
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id).onsuccess = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/** 批次刪除（新增；單筆失敗不會中斷） */
export async function removeMany(store, keys = []) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    let done = 0, fail = 0;
    keys.forEach(k => {
      const id = typeof k === 'object' ? k.id : k;
      try {
        os.delete(id);
        done++;
      } catch (_) {
        fail++;
      }
    });
    tx.oncomplete = () => resolve({ done, fail });
    tx.onerror = () => resolve({ done, fail: fail + 1 });
  });
}
