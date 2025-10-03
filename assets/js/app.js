import { GOOGLE_CLIENT_ID, ADMIN_EMAILS } from './config.js';
import { getAll } from './db.js';
import { DashboardPage } from './pages/dashboard.js';
import { ExpensePage } from './pages/expense.js';
import { IncomePage } from './pages/income.js';
import { ChatbookPage } from './pages/chatbook.js';
import { CameraExpensePage } from './pages/camera-expense.js';
import { ShopPage } from './pages/shop.js';
import { AdminPage } from './pages/admin.js';
import { SettingsPage } from './pages/settings.js';
import { BackupPage } from './pages/backup.js';
import { AuthPage } from './pages/auth.js';
import { ExpenseMinePage } from './pages/expense-mine.js';
import { ExpenseDetailPage } from './pages/expense-detail.js';
import { ExpenseAnalysisPage } from './pages/expense-analysis.js';

export const fmt={
  money:(n)=> new Intl.NumberFormat(undefined,{style:'currency',currency:'TWD'}).format(+n||0)
};

function q(sel){return document.querySelector(sel);}

const routes={
  dashboard:DashboardPage, auth:AuthPage, expense:ExpensePage, income:IncomePage,
  chatbook:ChatbookPage, camera:CameraExpensePage, shop:ShopPage, admin:AdminPage,
  settings:SettingsPage, backup:BackupPage,
  acct_mine:ExpenseMinePage, acct_detail:ExpenseDetailPage, acct_analysis:ExpenseAnalysisPage
};

function render(){
  const hash=location.hash.replace('#','')||'dashboard';
  const Page = routes[hash]||DashboardPage;
  const app=document.getElementById('app'); app.innerHTML='';
  const el = Page(); if(el.then){ el.then(node=>app.appendChild(node)); } else { app.appendChild(el); }
}
window.addEventListener('hashchange', render);
document.addEventListener('click', (e)=>{
  const r=e.target && e.target.getAttribute && e.target.getAttribute('data-route'); if(r){ location.hash='#'+r; }
});
render();

// FABs
q('#fabExpense').addEventListener('click',()=> location.hash='#expense');
q('#fabShop').addEventListener('click',()=> location.hash='#shop');

// Google ID (simple button rendered in AuthPage).

// session helper
export function currentUser(){ try{return JSON.parse(localStorage.getItem('session_user')||'null');}catch{return null;} }
export function requireLogin(){
  const u=currentUser(); if(!u){ location.hash='#auth'; throw new Error('login required'); }
  return u;
}
export function isAdmin(){
  const u=currentUser(); if(!u) return false; return (u.email && ADMIN_EMAILS.includes(u.email)) || ADMIN_EMAILS.includes(u.name||''); 
}

/* ====== 簡易購物車（localStorage） ====== */
const CART_KEY = 'cart';
const $ = sel => document.querySelector(sel);
const fmt = n => 'NT$ ' + (+n || 0).toLocaleString();

function loadCart(){ try{return JSON.parse(localStorage.getItem(CART_KEY)||'[]');}catch{return [];} }
function saveCart(cart){ localStorage.setItem(CART_KEY, JSON.stringify(cart)); updateBadge(cart); }
function updateBadge(cart=loadCart()){
  const btn = document.getElementById('fabShop');
  if(!btn) return;
  let badge = btn.querySelector('.badge-dot');
  const count = cart.reduce((s,i)=>s+i.qty,0);
  if(!badge){
    badge = document.createElement('span');
    badge.className='badge-dot';
    btn.style.position='relative';
    btn.appendChild(badge);
  }
  badge.textContent = count;
  badge.style.display = count ? 'inline-block' : 'none';
}

/* 對外：加入購物車（讓你的「加入購物車」按鈕呼叫） */
window.addToCart = function (p){
  const cart = loadCart();
  const hit = cart.find(x=>x.sku===p.sku);
  if(hit) hit.qty += 1; else cart.push({sku:p.sku, name:p.name, price:+p.price, qty:1});
  saveCart(cart);
  renderCart(); // 即時刷新面板
};

/* 調整數量、刪除 */
function changeQty(sku, delta){
  const cart = loadCart();
  const item = cart.find(i=>i.sku===sku);
  if(!item) return;
  item.qty += delta;
  if(item.qty<=0) cart.splice(cart.indexOf(item),1);
  saveCart(cart); renderCart();
}

/* 渲染面板內容 */
function renderCart(){
  const cart = loadCart();
  updateBadge(cart);

  const box = $('#cartItems');
  if(!box) return;

  if(!cart.length){
    box.innerHTML = '<div class="text-muted">尚無商品</div>';
  }else{
    box.innerHTML = cart.map(i=>`
      <div class="cart-item">
        <div>
          <div>${i.name}</div>
          <div class="text-muted small">SKU：${i.sku}</div>
        </div>
        <div class="cart-qty">
          <button onclick="changeQty('${i.sku}',-1)">－</button>
          <span>${i.qty}</span>
          <button onclick="changeQty('${i.sku}',+1)">＋</button>
        </div>
        <div>${fmt(i.price*i.qty)}</div>
      </div>
    `).join('');
  }

  const subtotal = cart.reduce((s,i)=>s + i.price*i.qty, 0);
  const shipping = (!cart.length || subtotal>=2000) ? 0 : 100;
  $('#cartSubtotal').textContent = fmt(subtotal);
  $('#cartShipping').textContent = fmt(shipping);
  $('#cartTotal').textContent     = fmt(subtotal+shipping);
}

<!-- app.js -->
<script type="module" src="assets/js/app.js"></script>

<script>
/* 你的其他 function (例如 parseGoogleJWT...) */

// === 購物車面板開關 ===
document.addEventListener("DOMContentLoaded", () => {
  const btnShop = document.getElementById("fabShop");
  const panel   = document.getElementById("cartPanel");
  const mask    = document.getElementById("cartMask");
  const close   = document.getElementById("cartClose");

  if (btnShop) {
    btnShop.addEventListener("click", () => {
      panel.classList.add("open");
      mask.classList.add("open");
    });
  }

  if (close) {
    close.addEventListener("click", () => {
      panel.classList.remove("open");
      mask.classList.remove("open");
    });
  }

  if (mask) {
    mask.addEventListener("click", () => {
      panel.classList.remove("open");
      mask.classList.remove("open");
    });
  }
});
</script>
</body>
</html>

/* 打開/關閉 面板 */
function openCart(){ $('#cartMask').classList.add('open'); $('#cartPanel').classList.add('open'); }
function closeCart(){ $('#cartMask').classList.remove('open'); $('#cartPanel').classList.remove('open'); }

/* 綁定按鈕與初始化 */
window.addEventListener('load', ()=>{
  // 右下角舊的 🛒 按鈕：#fabShop
  const fab = document.getElementById('fabShop');
  if(fab){ fab.addEventListener('click', openCart); }

  // 關閉 & 清空
  $('#cartMask')  ?.addEventListener('click', closeCart);
  $('#cartClose') ?.addEventListener('click', closeCart);
  $('#cartClear') ?.addEventListener('click', ()=>{ localStorage.setItem(CART_KEY,'[]'); renderCart(); });

  renderCart(); // 首次渲染 & 更新角標
});
