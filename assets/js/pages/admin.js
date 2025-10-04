// assets/js/pages/admin.js
import { db } from '../firebase.js';
import {
  collection, query, orderBy, onSnapshot
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

export default function AdminPage(){
  const el = document.createElement('div');
  el.className = 'container card p-3';
  el.innerHTML = `
    <h3 class="mb-3">後台訂單列表</h3>
    <div id="orders" class="small"></div>
  `;

  const box = el.querySelector('#orders');

  const q = query(collection(db,'orders'), orderBy('createdAt','desc'));
  onSnapshot(q, snap=>{
    if (snap.empty){
      box.innerHTML = '<div class="text-muted">尚無訂單</div>';
      return;
    }
    box.innerHTML = [...snap.docs].map(d=>{
      const o = d.data();
      const total = o?.amounts?.total || 0;
      const name = o?.customer?.name || '';
      const email = o?.customer?.email || '';
      const ts = o.createdAt?.toDate?.() ? o.createdAt.toDate().toLocaleString() : '';
      const items = (o.items||[]).map(i=>`${i.name} x ${i.qty}`).join('、');
      return `
        <div class="py-2 border-bottom border-secondary">
          <div><b>#${d.id}</b> ｜ ${name} ｜ ${email} ｜ NT$ ${total.toLocaleString()}</div>
          <div class="text-muted">${ts}</div>
          <div class="mt-1">品項：${items}</div>
        </div>
      `;
    }).join('');
  });

  return el;
}
