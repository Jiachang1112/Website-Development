// assets/js/analytics/login-logger.js
import { db } from '../firebase.js';
import { addDoc, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

/**
 * 寫一筆登入紀錄到 Firestore（單一集合：login_logs）
 * @param {'user'|'admin'} kind 來源：前台帳號頁登入記為 'user'；後台登入記為 'admin'
 * @param {import('firebase/auth').User} user
 */
export async function recordLogin(kind, user){
  try{
    const p = (user?.providerData && user.providerData[0]) || {};
    await addDoc(collection(db, 'login_logs'), {
      kind,                            // 'user' 或 'admin'
      uid:        user?.uid || '',
      email:      user?.email || '',
      name:       user?.displayName || '',
      providerId: p.providerId || 'unknown',
      userAgent:  navigator.userAgent || '',
      createdAt:  serverTimestamp(),
    });
  }catch(e){
    console.warn('[login-logger] add fail:', e);
  }
}

/**（可選）同一天同一人只記一次，避免灌爆 */
export async function recordLoginOncePerDay(kind, user){
  const uid = user?.uid || 'anon';
  const day = new Date().toISOString().slice(0,10);
  const key = `loginlog:${kind}:${uid}:${day}`;
  if (localStorage.getItem(key)) return;
  await recordLogin(kind, user);
  localStorage.setItem(key, '1');
}
