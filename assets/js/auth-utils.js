// assets/js/auth-utils.js
import { ADMIN_EMAILS } from './config.js';

export function currentUser() {
  try {
    return JSON.parse(localStorage.getItem('session_user') || 'null');
  } catch {
    return null;
  }
}

export function isAdmin() {
  const u = currentUser();
  return !!(u && ADMIN_EMAILS.includes(u.email));
}
