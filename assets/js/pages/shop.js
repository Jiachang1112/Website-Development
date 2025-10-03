// assets/js/pages/shop.js
// 不依賴 Bootstrap 的購物頁（可直接在 SPA 中使用）

// ---------- 產品清單（先放 3 個，你可以改/擴充） ----------
const PRODUCTS = [
  { sku: 'LG-001', name: '立國工業手套 M', price: 120, image: 'assets/img/glove-m.jpg' },
  { sku: 'LG-002', name: '立國工業手套 L', price: 120, image: 'assets/img/glove-l.jpg' },
  { sku: 'LT-010', name: '立國安全帽',      price: 980, image: 'assets/img/helmet.jpg' }
];

// ---------- 工具 ----------
const money = n => new Intl.NumberFormat('zh-TW',{style:'currency',currency:'TWD'}).format(+n||0);

// LocalStorage 購物車（和你範例相同的 key）
const CART_KEY = 'cart';
const readCart  = () => { try{ return JSON.parse(localStorage.getItem(CART_KEY)||'[]'); }catch{return [];} };
const saveCart  = (arr) => localStorage.setItem(CART_KEY, JSON.stringify(arr));
const findItem  = (arr, sku) => arr.find(i => i.sku === sku);

// ---------- 主頁 ----------
export default function ShopPage(){
  const root = document.createElement('div');
  root.className = 'container';
  root.innerHTML = `
    <style>
      .shop-wrap{display:grid;grid-template-columns:1fr 360px;gap:24px}
      @media (max-width: 980px){ .shop-wrap{grid-template-columns:1fr} }
      .hero{background:#f8fafc;border-radius:16px;padding:16px;margin:16px 0;color:#111}
      .product-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}
      .card{background:#fff;border:1px solid #0001;border-radius:12px;padding:0;box-shadow:0 2px 10px #0001;display:flex;flex-direction:column}
      .card .imgbox{height:160px;background:#eef;border-top-left-radius:12px;border-top-right-radius:12px;display:flex;align-items:center;justify-content:center;overflow:hidden}
      .card img{width:100%;height:100%;object-fit:cover}
      .card .body{padding:12px;display:flex;flex-direction:column;gap:6px}
      .row{display:flex;gap:8px;align-items:center}
      .space{justify-content:space-between}
      .btn{padding:.5rem .75rem;border-radius:8px;border:1px solid #0002;background:#fff;cursor:pointer}
      .btn:hover{background:#f6f6f6}
      .btn.primary{background:#111;color:#fff;border-color:#111}
      .btn.ghost{background:transparent;border-color:#0003}
      .small{font-size:.86rem;opacity:.75}
      .sidecard{position:sticky;top:12px;height:max-content}
      .badge{display:inline-block;min-width:1.2em;padding:.2em .5em;border-radius:999px;background:#666;color:#fff;font-size:.75rem;text-align:center}
      .hr{height:1px;background:#0001;margin:8px 0}
      .input, select, textarea{width:100%;border-radius:8px;padding:.5rem .6rem;border:1px solid #0002}
      .overlay{position:fixed;inset:0;background:#0007;display:none;align-items:center;justify-content:center;z-index:50}
      .modal{background:#fff;border-radius:12px;max-width:540px;width:92%;padding:12px}
      .toast{position:fixed;right:16px;bottom:16px;background:#111;color:#fff;padding:.6rem .9rem;border-radius:10px;opacity:0;transform:translateY(10px);transition:.2s;z-index:60}
      .toast.show{opacity:1;transform:translateY(0)}
    </style>

    <!-- NAV（在 SPA 中就簡版，回首頁/後台都用 hash） -->
    <div class="row space" style="margin:8px 0 4px">
      <div class="row" style="gap:12px">
        <div class="row" style="gap:6px;font-weight:700">立國實業</div>
        <a class="btn ghost" href="#dashboard">首頁</a>
        <a class="btn ghost" href="#admin">後台</a>
      </div>
      <button class="btn" id="btnCart">購物車 <span id="cartCount" class="badge">0</span></button>
    </div>

    <section class="hero">
      <div class="row space">
        <h3 style="margin:0">線上快速下單</h3>
      </div>
      <div class="small">工業安全用品／公司採購與聯絡：02-0000-0000｜service@liguo.com.tw</div>
    </section>

    <div class="shop-wrap">
      <!-- 左：產品 -->
      <div>
        <div id="prodGrid" class="product-grid"></div>
      </div>

      <!-- 右：購物車 -->
      <div class="sidecard card">
        <div class="body">
          <div class="row space">
            <h3 style="margin:0">購物車</h3>
            <button class="btn ghost" id="btnCloseCart" style="display:none">關閉</button>
          </div>
          <div id="cartItems" class="small"></div>

          <div class="hr"></div>
          <div class="row space"><div class="small">小計</div><div id="subtotal" style="font-weight:700">NT$ 0</div></div>
          <div class="row space"><div class="small">運費</div><div id="shipping" style="font-weight:700">NT$ 0</div></div>
          <div class="row space" style="font-size:1.1rem;font-weight:800"><div>合計</div><div id="total">NT$ 0</div></div>

          <div class="row space" style="margin-top:8px">
            <button class="btn ghost" id="btnClear">清空</button>
            <button class="btn primary" id="btnCheckout">結帳</button>
          </div>
          <div class="small" style="opacity:.7">滿 NT$2,000 免運；未滿酌收 NT$100</div>
        </div>
      </div>
    </div>

    <!-- 側邊購物車在窄螢幕當抽屜 -->
    <div id="cartDrawer" class="overlay" style="align-items:flex-start;justify-content:flex-end">
      <div class="card" style="width:360px;height:100%;border-radius:0">
        <div class="body" style="height:100%;display:flex">
          <div class="row space" style="width:100%">
            <h3 style="margin:0">購物車</h3>
            <button class="btn ghost" id="drawerClose">關閉</button>
          </div>
          <div id="drawerItems" style="flex:1 1 auto;overflow:auto"></div>
          <div class="hr"></div>
          <div class="row space"><div class="small">小計</div><div id="drawerSub">NT$ 0</div></div>
          <div class="row space"><div class="small">運費</div><div id="drawerShip">NT$ 0</div></div>
          <div class="row space" style="font-weight:800"><div>合計</div><div id="drawerTotal">NT$ 0</div></div>
          <div class="row space" style="margin-top:8px">
            <button class="btn ghost" id="drawerClear">清空</button>
            <button class="btn primary" id="drawerCheckout">結帳</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 結帳表單（自製 modal） -->
    <div id="checkoutMask" class="overlay">
      <form id="orderForm" class="modal">
        <div class="row space">
          <h3 style="margin:.25rem 0">訂購資料</h3>
          <button class="btn ghost" type="button" id="closeForm">✕</button>
        </div>
        <div class="row" style="gap:12px">
          <div style="flex:1">
            <div class="small">姓名</div>
            <input name="name" class="input" required>
          </div>
          <div style="flex:1">
            <div class="small">電話</div>
            <input name="phone" class="input" required>
          </div>
        </div>
        <div style="margin-top:8px">
          <div class="small">Email（收訂單）</div>
          <input name="email" type="email" class="input" required>
        </div>
        <div style="margin-top:8px">
          <div class="small">配送方式</div>
          <select name="shipping" class="input" required>
            <option value="宅配">宅配（黑貓/新竹）</option>
            <option value="超商取貨（先匯款）">超商取貨（先匯款）</option>
          </select>
        </div>
        <div style="margin-top:8px">
          <div class="small">地址/門市</div>
          <input name="address" class="input" required>
        </div>
        <div style="margin-top:8px">
          <div class="small">付款方式</div>
          <select name="payment" class="input" required>
            <option value="銀行轉帳">銀行轉帳</option>
            <option value="貨到付款">貨到付款</option>
            <option value="信用卡（綠界/藍新）">信用卡（綠界/藍新）</option>
          </select>
        </div>
        <div style="margin-top:8px">
          <div class="small">備註</div>
          <textarea name="note" rows="3" class="input" placeholder="尺寸、發票抬頭/統編等"></textarea>
        </div>
        <div class="row space" style="margin-top:12px">
          <button class="btn ghost" type="button" id="cancelForm">取消</button>
          <button class="btn primary" type="submit">送出訂單</button>
        </div>
      </form>
    </div>

    <div id="toast" class="toast"></div>
  `;

  // --------- 元件參照 ---------
  const els = {
    prodGrid:   root.querySelector('#prodGrid'),
    cartItems:  root.querySelector('#cartItems'),
    subtotal:   root.querySelector('#subtotal'),
    shipping:   root.querySelector('#shipping'),
    total:      root.querySelector('#total'),
    cartCount:  root.querySelector('#cartCount'),

    btnClear:   root.querySelector('#btnClear'),
    btnCheckout:root.querySelector('#btnCheckout'),
    btnCart:    root.querySelector('#btnCart'),
    btnCloseCart: root.querySelector('#btnCloseCart'),

    drawer:     root.querySelector('#cartDrawer'),
    drawerClose:root.querySelector('#drawerClose'),
    drawerItems:root.querySelector('#drawerItems'),
    drawerSub:  root.querySelector('#drawerSub'),
    drawerShip: root.querySelector('#drawerShip'),
    drawerTotal:root.querySelector('#drawerTotal'),
    drawerClear:root.querySelector('#drawerClear'),
    drawerCheckout:root.querySelector('#drawerCheckout'),

    mask:       root.querySelector('#checkoutMask'),
    orderForm:  root.querySelector('#orderForm'),
    closeForm:  root.querySelector('#closeForm'),
    cancelForm: root.querySelector('#cancelForm'),
    toast:      root.querySelector('#toast')
  };

  // --------- Toast ----------
  let toastTimer = null;
  function showToast(msg){
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>els.toast.classList.remove('show'), 1500);
  }

  // --------- 購物車核心 ----------
  function getCart(){ return readCart(); }
  function setCart(arr){ saveCart(arr); renderCart(); }

  function addToCart(prod){
    const cart = getCart();
    const found = findItem(cart, prod.sku);
    if(found) found.qty++;
    else cart.push({ sku:prod.sku, name:prod.name, price:prod.price, qty:1 });
    setCart(cart);
    showToast('已加入購物車');
  }
  function changeQty(sku, delta){
    const cart = getCart();
    const item = findItem(cart, sku);
    if(!item) return;
    item.qty += delta;
    if(item.qty <= 0){
      const arr = cart.filter(i => i.sku !== sku);
      setCart(arr);
    }else{
      setCart(cart);
    }
  }
  function clearCart(){ setCart([]); }

  function subtotal(arr){ return arr.reduce((s,i)=> s + i.price*i.qty, 0); }
  function shippingFee(arr){
    const s = subtotal(arr);
    return (s===0 || s>=2000) ? 0 : 100;
  }
  function totals(arr){ return subtotal(arr) + shippingFee(arr); }

  // --------- 渲染 ----------
  function renderProducts(){
    els.prodGrid.innerHTML = PRODUCTS.map(p => `
      <div class="card">
        <div class="imgbox">
          ${p.image ? `<img src="${p.image}" alt="${p.name}" onerror="this.style.display='none'">` : `<div class="small">No Image</div>`}
        </div>
        <div class="body">
          <div style="font-weight:700">${p.name}</div>
          <div class="small">SKU：${p.sku}</div>
          <div class="row space" style="margin-top:6px">
            <div style="font-weight:800">${money(p.price)}</div>
            <button class="btn" data-add="${p.sku}">加入購物車</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  function renderCart(){
    const cart = getCart();
    els.cartCount.textContent = cart.reduce((s,i)=> s + i.qty, 0);

    // 右欄
    els.cartItems.innerHTML = cart.length ? cart.map(i => `
      <div class="row space" style="margin:6px 0">
        <div>
          <div style="font-weight:700">${i.name}</div>
          <div class="small">x ${i.qty}</div>
        </div>
        <div>${money(i.price*i.qty)}</div>
      </div>
      <div class="row" style="gap:6px;margin-bottom:8px">
        <button class="btn ghost" data-dec="${i.sku}">－</button>
        <button class="btn ghost" data-inc="${i.sku}">＋</button>
        <button class="btn ghost" data-rm="${i.sku}">移除</button>
      </div>
    `).join('') : '<div class="small" style="opacity:.7">尚無商品</div>';

    els.subtotal.textContent = money(subtotal(cart));
    els.shipping.textContent = money(shippingFee(cart));
    els.total.textContent    = money(totals(cart));

    // 抽屜（窄螢幕）
    els.drawerItems.innerHTML = els.cartItems.innerHTML;
    els.drawerSub.textContent = els.subtotal.textContent;
    els.drawerShip.textContent= els.shipping.textContent;
    els.drawerTotal.textContent=els.total.textContent;
  }

  // --------- 事件 ----------
  // 產品「加入購物車」
  els.prodGrid.addEventListener('click', (e)=>{
    const sku = e.target.getAttribute('data-add');
    if(!sku) return;
    const prod = PRODUCTS.find(p => p.sku === sku);
    if(!prod) return;
    addToCart(prod);
  });

  // 右欄購物車操作
  function handleCartClick(container){
    container.addEventListener('click', (e)=>{
      const t = e.target;
      const sku = t.getAttribute('data-inc')||t.getAttribute('data-dec')||t.getAttribute('data-rm');
      if(!sku) return;
      if(t.hasAttribute('data-inc')) changeQty(sku,+1);
      else if(t.hasAttribute('data-dec')) changeQty(sku,-1);
      else if(t.hasAttribute('data-rm')) changeQty(sku,-9999);
    });
  }
  handleCartClick(els.cartItems);
  handleCartClick(els.drawerItems);

  // 清空
  els.btnClear.addEventListener('click', ()=>{ clearCart(); });
  els.drawerClear.addEventListener('click', ()=>{ clearCart(); });

  // 抽屜（窄螢幕）
  const mq = window.matchMedia('(max-width: 980px)');
  function openDrawer(){ if(mq.matches){ els.drawer.style.display='flex'; } }
  function closeDrawer(){ els.drawer.style.display='none'; }
  els.btnCart.addEventListener('click', openDrawer);
  els.drawerClose.addEventListener('click', closeDrawer);
  els.btnCloseCart.addEventListener('click', closeDrawer);
  els.drawer.addEventListener('click', (e)=>{ if(e.target===els.drawer) closeDrawer(); });

  // 結帳表單
  function openForm(){ els.mask.style.display='flex'; }
  function closeForm(){ els.mask.style.display='none'; }

  els.btnCheckout.addEventListener('click', ()=>{
    const cart = getCart();
    if(!cart.length) return showToast('購物車是空的');
    openForm();
  });
  els.drawerCheckout.addEventListener('click', ()=>{
    const cart = getCart();
    if(!cart.length) return showToast('購物車是空的');
    closeDrawer(); openForm();
  });
  els.closeForm.addEventListener('click', closeForm);
  els.cancelForm.addEventListener('click', closeForm);
  els.mask.addEventListener('click', (e)=>{ if(e.target===els.mask) closeForm(); });

  // 送單（目前先模擬成功，之後可改成 fetch('/api/orders') 或寫進 Firestore）
  els.orderForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const data = Object.fromEntries(new FormData(els.orderForm).entries());
    const cart = getCart();
    if(!cart.length){ showToast('購物車是空的'); return; }

    // TODO：改成真正 API
    // const res = await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customer:data,items:cart})});
    // const r = await res.json(); if(r.next){ location.href=r.next; return; }

    const orderNo = 'LG' + Date.now().toString().slice(-8);
    showToast('訂單成立：' + orderNo);

    // 重置
    saveCart([]); renderCart(); closeForm();
  });

  // 初次渲染
  renderProducts();
  renderCart();

  return root;
}
