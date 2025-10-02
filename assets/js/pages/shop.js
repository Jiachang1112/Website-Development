import { getAll, put } from '../db.js'; import { fmt } from '../app.js';
export function ShopPage(){
  const el=document.createElement('div'); el.className='container card';
  el.innerHTML=`<h3>購物</h3><div class="row"><input id="q" placeholder="搜尋商品"/><button class="ghost" id="search">搜尋</button></div><div id="list"></div><h4>我的訂單</h4><div id="orders"></div>`;
  const list=el.querySelector('#list'), ordersEl=el.querySelector('#orders'), q=el.querySelector('#q');
  let all=[]; let cart=[]; function render(){ list.innerHTML=all.filter(p=>!q.value || (p.name+ p.brand+ p.category).includes(q.value)).slice(0,50).map(p=>`<div class="order-row"><div><strong>${p.name}</strong><div class="small">${p.brand||''}｜${p.category||''}</div></div><div>${fmt.money(p.price)} <button class="ghost" data-add="${p.id}">加入</button></div></div>`).join(''); }
  el.addEventListener('click', async (e)=>{
    const add=e.target.dataset.add; if(add){ const prod=all.find(x=>x.id==add); cart.push({id:prod.id,name:prod.name,price:prod.price,qty:1}); alert('已加入購物車'); }
    if(e.target.id==='checkout'){ const total=cart.reduce((s,i)=>s+i.price*i.qty,0); const order={id:crypto.randomUUID(), created:Date.now(), items:cart, total, status:'待付款'}; await put('orders', order); cart=[]; alert('已建立訂單'); renderOrders(); }
  });
  async function renderOrders(){ const orders=await getAll('orders'); ordersEl.innerHTML=orders.sort((a,b)=>b.created-a.created).map(o=>`<div class="order-row"><div><strong>#${o.id.slice(0,6)}</strong><div class="small">${new Date(o.created).toLocaleString()}</div></div><div>${fmt.money(o.total)} <span class="badge">${o.status}</span></div></div>`).join('')||'<p class="small">尚無訂單</p>'; }
  fetch('data/products.json').then(r=>r.json()).then(js=>{all=js; render();});
  list.insertAdjacentHTML('beforeend','<div class="row" style="justify-content:flex-end;margin-top:8px"><button class="primary" id="checkout">結帳</button></div>');
  el.querySelector('#search').addEventListener('click', render);
  renderOrders();
  return el;
}