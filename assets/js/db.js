const DB_NAME='supertool-db'; const DB_VER=1;
const stores=['users','expenses','incomes','orders','settings','products','images'];
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,DB_VER);r.onupgradeneeded=e=>{const db=r.result;stores.forEach(s=>{ if(!db.objectStoreNames.contains(s)) db.createObjectStore(s,{keyPath:'id',autoIncrement:true});});};r.onsuccess=()=>res(r.result);r.onerror=e=>rej(e);});}
export async function put(store, obj){const db=await openDB();return await new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(obj).onsuccess=e=>resolve({id:e.target.result});tx.onerror=reject;});}
export async function getAll(store){const db=await openDB();return await new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly');const req=tx.objectStore(store).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=reject;});}
export async function remove(store, key){const db=await openDB();return await new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(key).onsuccess=()=>resolve(true);tx.onerror=reject;});}
