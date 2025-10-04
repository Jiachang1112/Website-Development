// assets/js/pages/shop.js
import { db } from '../firebase.js';
import {
  collection, addDoc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

export default function ShopPage () {
  const el = document.createElement('div');
  el.className = 'container py-3';
  el.innerHTML = `
  <style>
    #shopPage .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
    #shopPage .card{background:#151a21;border:1px solid #2a2f37;border-radius:12px}
    body.light #shopPage .card{background:#fff;border-color:#ddd}
    #shopPage .aside{position:sticky;top:16px}
    @media (max-width: 991px){ #shopPage .aside{position:static} }
  </style>

  <div id="shopPage" class="row g-3">
    <div class="col-lg-8">
      <h4 class="mb-3">商品列表</h4>
      <div id="shopProducts" class="grid"></div>
    </div>

    <div class="col-lg-4">
      <div class="card aside p-3">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h5 class="m-0">購物車</h5>
          <button id="shopClear" class="btn btn-sm">清空</button>
        </div>
        <div id="shopCartItems" class="small text-muted">尚無商品</div>
        <hr>
        <div class="d-flex justify-content-between">
          <div class="text-muted">小計</div><div id="shopSubtotal" class="fw-bold">NT$ 0</div>
        </div>
        <div class="d-flex justify-content-between">
          <div class="text-muted">運費</div><div id="shopShipping" class="fw-bold">NT$ 0</div>
        </div>
        <div class="d-flex justify-content-between fs-5">
          <div>合計</div><div id="shopTotal" class="fw-bold">NT$ 0</div>
        </div>
        <div class="d-grid mt-2">
          <button id="shopCheckout" class="btn btn-primary">結帳</button>
        </div>
      </div>
    </div>
  </div>

  <div class="modal fade" id="shopCheckoutDlg" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered">
      <form id="shopOrderForm" class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">訂購資料</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <div class="row g-2">
            <div class="col-md-6">
              <label class="form-label">姓名</label>
              <input name="name" class="form-control" required>
            </div>
            <div class="col-md-6">
              <label class="form-label">電話</label>
              <input name="phone" class="form-control" required>
            </div>
          </div>
          <div class="mt-2">
            <label class="form-label">Email（收訂單）</label>
            <input name="email" type="email" class="form-control" required>
          </div>
          <div class="mt-2">
            <label class="form-label">配送方式</label>
            <select name="shipping" class="form-select" required>
              <option value="宅配">宅配（黑貓/新竹）</option>
              <option value="超商取貨（先匯款）">超商取貨（先匯款）</option>
            </select>
          </div>
          <div class="mt-2">
            <label class="form-label">地址/門市</label>
            <input name="address" class="form-control" required>
          </div>
          <div class="mt-2">
            <label class="form-label">付款方式</label>
            <select name="payment" class="form-select" required>
              <option value="銀行轉帳">銀行轉帳</option>
              <option value="貨到付款">貨到付款</option>
              <option value="信用卡">信用卡（綠界/藍新）</option>
            </select>
          </div>
          <div class="mt-2">
            <label class="form-label">備註</label>
            <textarea name="note" rows="3" class="form-control" placeholder="尺寸、發票抬頭/統編等"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline-secondary" data-bs-dismiss="modal" type="button">取消</button>
          <button class="btn btn-primary" type="submit">送出訂單</button>
        </div>
      </form>
    </div>
  </div>
  `;

  // ====== 商品資料 ======
  const PRODUCTS = [
    { sku:'LG-001', name:'立國工業手套 M', price:120 },
    { sku:'LG-002', name:'立國工業手套 L', price:120 },
    { sku:'LT-010', name:'立國安全帽',    price:980 },
    { sku:'P-004',  name:'工地雨鞋',      price:560 },
    { sku:'P-005',  name:'商品 05',       price:500 },
    { sku:'P-008',  name:'護目鏡',        price:199 },
  ];

  const CART_KEY = 'cart';
  const fmt = n => 'NT$ ' + (n||0).toLocaleString();
  const $  = sel => el.querySelector(sel);

  const loadCart = () => { try { return JSON.parse(localStorage.getItem(CART_KEY)||'[]'); } catch { return []; } };
  const saveCart = (c) => localStorage.setItem(CART_KEY, JSON.stringify(c));
  const clearCart = () => localStorage.removeItem(CART_KEY);

  function addToCart(p){
    const cart = loadCart();
    const f = cart.find(i=>i.sku===p.sku);
    if (f) f.qty++; else cart.push({ sku:p.sku, name:p.name, price:p.price, qty:1 });
    saveCart(cart); renderCart();
  }
  function changeQty(sku, delta){
    const cart = loadCart();
    const i = cart.find(x=>x.sku===sku);
    if (!i) return;
    i.qty += delta;
    if (i.qty<=0) cart.splice(cart.indexOf(i),1);
    saveCart(cart); renderCart();
  }

  function renderProducts(){
    const box = $('#shopProducts');
    box.innerHTML = PRODUCTS.map(p=>`
      <div class="card p-3">
        <div class="fw-semibold">${p.name}</div>
        <div class="text-muted small">SKU：${p.sku}</div>
        <div class="price mt-1">NT$ ${p.price.toLocaleString()}</div>
        <button class="btn btn-sm mt-2" data-add='${p.sku}'>加入購物車</button>
      </div>
    `).join('');
    box.querySelectorAll('[data-add]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const sku = btn.getAttribute('data-add');
        const p = PRODUCTS.find(x=>x.sku===sku);
        addToCart(p);
      });
    });
  }

  function renderCart(){
    const cart = loadCart();
    const wrap = $('#shopCartItems');
    wrap.innerHTML = cart.length ? cart.map(i=>`
      <div class="d-flex justify-content-between align-items-center py-1 border-bottom border-secondary">
        <div>
          <div>${i.name}</div>
          <div class="text-muted small">SKU：${i.sku}</div>
        </div>
        <div class="d-flex align-items-center gap-2">
          <button class="btn btn-sm" data-minus='${i.sku}'>－</button>
          <span>${i.qty}</span>
          <button class="btn btn-sm" data-plus='${i.sku}'>＋</button>
          <div class="ms-2">${fmt(i.price*i.qty)}</div>
        </div>
      </div>
    `).join('') : '<div class="text-muted">尚無商品</div>';

    wrap.querySelectorAll('[data-minus]').forEach(b=>b.addEventListener('click',()=>changeQty(b.getAttribute('data-minus'),-1)));
    wrap.querySelectorAll('[data-plus]').forEach(b=>b.addEventListener('click',()=>changeQty(b.getAttribute('data-plus'),+1)));

    const subtotal = cart.reduce((s,i)=> s + i.price*i.qty, 0);
    const shipping = (subtotal > 2000 || subtotal === 0) ? 0 : 100;
    $('#shopSubtotal').textContent = fmt(subtotal);
    $('#shopShipping').textContent = fmt(shipping);
    $('#shopTotal').textContent = fmt(subtotal+shipping);
  }

  $('#shopClear').addEventListener('click', ()=>{ clearCart(); renderCart(); });
  $('#shopCheckout').addEventListener('click', ()=>{
    if (!loadCart().length) return alert('購物車是空的');
    new bootstrap.Modal(el.querySelector('#shopCheckoutDlg')).show();
  });

  el.querySelector('#shopOrderForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const cart = loadCart();
    if (!cart.length) return;

    const data = Object.fromEntries(new FormData(e.target).entries());
    const subtotal = cart.reduce((s,i)=> s + i.price*i.qty, 0);
    const shipping = (subtotal > 2000 || subtotal === 0) ? 0 : 100;
    const total = subtotal + shipping;

    const order = {
      customer: {
        name: data.name, phone: data.phone, email: data.email,
        shipping: data.shipping, address: data.address,
        payment: data.payment, note: data.note || ''
      },
      items: cart,
      amounts: { subtotal, shipping, total },
      status: 'pending',
      createdAt: serverTimestamp()
    };

    try{
      const ref = await addDoc(collection(db, 'orders'), order);
      alert(\`訂單已送出：\${ref.id}\`);
      clearCart(); renderCart();
      bootstrap.Modal.getInstance(el.querySelector('#shopCheckoutDlg')).hide();
    }catch(err){
      console.error(err);
      alert('寫入訂單失敗：' + err.message);
    }
  });

  // init
  renderProducts();
  renderCart();
  return el;
}
