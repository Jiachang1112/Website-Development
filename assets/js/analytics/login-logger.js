// assets/js/analytics/login-logger.js
import { db } from '../firebase.js';
import { addDoc, collection, serverTimestamp } 
  from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

/**
 * 記錄一筆登入
 * @param {'user'|'admin'} kind  來源：用戶 or 管理員
 * @param {import('firebase/auth').User} user
 */
export async function recordLogin(kind, user){
  try{
    const p = (user?.providerData && user.providerData[0]) || {};
    await addDoc(collection(db, 'login_logs'), {
      kind,                          // 'user' | 'admin'
      uid: user?.uid || '',
      email: user?.email || '',
      name: user?.displayName || '',
      providerId: p.providerId || 'unknown',
      userAgent: navigator.userAgent || '',
      ts: serverTimestamp()
    });
  }catch(e){
    // 不影響登入流程，失敗就靜默
    console.warn('[login-logger] add fail:', e);
  }
}
