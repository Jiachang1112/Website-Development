<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>立國實業｜線上商店</title>

  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body{font-family:system-ui}
    .hero{background:#f8fafc;border-radius:16px;padding:24px;margin:16px 0}
    .product-card img{height:180px;object-fit:cover;border-top-left-radius:.5rem;border-top-right-radius:.5rem}
    .product-card .card-body{display:flex;flex-direction:column}
    .offcanvas{--bs-offcanvas-width:380px}
    .price{font-weight:700}
  </style>
</head>
<body class="bg-light">
  <!-- NAV -->
  <nav class="navbar navbar-expand-lg bg-white border-bottom">
    <div class="container">
      <a class="navbar-brand fw-bold" href="/">立國實業</a>
      <div class="d-flex gap-2">
        <a class="btn btn-outline-secondary" href="/admin.html">後台</a>
        <button class="btn btn-dark" data-bs-toggle="offcanvas" data-bs-target="#cartPanel">
          購物車 <span id="cartCount" class="badge bg-secondary">0</span>
        </button>
      </div>
    </div>
  </nav>

  <!-- HERO -->
  <main class="container">
    <section class="hero">
      <h1 class="h3 mb-2">線上快速下單</h1>
      <div class="text-muted">工業安全用品／公司採購與聯絡：02-0000-0000｜service@liguo.com.tw</div>
    </section>

    <!-- PRODUCTS -->
    <div id="products" class="row g-3"></div>
  </main>

  <!-- CART OFFCANVAS -->
  <div class="offcanvas offcanvas-end" tabindex="-1" id="cartPanel">
    <div class="offcanvas-header">
      <h5 class="offcanvas-title">購物車</h5>
      <button type="button" class="btn-close" data-bs-dismiss="offcanvas"></button>
    </div>
    <div class="offcanvas-body d-flex flex-column">
      <div id="cartItems" class="flex-grow-1"></div>
      <div class="border-top pt-2 small text-muted">滿 2,000 免運；未滿酌收運費 NT$100</div>
      <div class="d-flex justify-content-between mt-2">
        <div class="text-muted">小計</div><div id="subtotal" class="fw-bold">NT$ 0</div>
      </div>
      <div class="d-flex justify-content-between">
        <div class="text-muted">運費</div><div id="shipping" class="fw-bold">NT$ 0</div>
      </div>
      <div class="d-flex justify-content-between fs-5">
        <div>合計</div><div id="total" class="fw-bold">NT$ 0</div>
      </div>
      <div class="d-grid gap-2 mt-2">
        <button id="clearCart" class="btn btn-outline-secondary">清空</button>
        <button id="checkout" class="btn btn-dark">結帳</button>
      </div>
    </div>
  </div>

  <!-- CHECKOUT MODAL -->
  <div class="modal" id="checkoutDlg" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered">
      <form id="orderForm" class="modal-content">
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
              <option value="信用卡（綠界/藍新）">信用卡（綠界/藍新）</option>
            </select>
          </div>
          <div class="mt-2">
            <label class="form-label">備註</label>
            <textarea name="note" rows="3" class="form-control" placeholder="尺寸、發票抬頭/統編等"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline-secondary" data-bs-dismiss="modal" type="button">取消</button>
          <button class="btn btn-dark" type="submit">送出訂單</button>
        </div>
      </form>
    </div>
  </div>

  <!-- TOAST -->
  <div class="position-fixed bottom-0 end-0 p-3" style="z-index:11">
    <div id="toast" class="toast" role="alert"><div class="toast-body"></div></div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    /*** 購物車邏輯 ***/
    const cart = JSON.parse(localStorage.getItem('cart')||'[]');
    const saveCart = ()=>localStorage.setItem('cart', JSON.stringify(cart));
    const fmt = n => 'NT$ ' + n.toLocaleString();
    const toastEl = document.getElementById('toast');
    const toast = new bootstrap.Toast(toastEl,{delay:1600});
    const show = (msg)=>{ toastEl.querySelector('.toast-body').textContent = msg; toast.show(); };

    function add(p){
      const found = cart.find(i=>i.sku===p.sku);
      if(found) found.qty++; else cart.push({sku:p.sku,name:p.name,price:p.price,qty:1});
      saveCart(); renderCart(); show('已加入購物車');
    }
    function changeQty(sku,delta){
      const i = cart.find(x=>x.sku===sku);
      if(!i) return;
      i.qty += delta;
      if(i.qty<=0) cart.splice(cart.indexOf(i),1);
      saveCart(); renderCart();
    }
    function renderCart(){
      document.getElementById('cartCount').textContent = cart.reduce((s,i)=>s+i.qty,0);
      const wrap = document.getElementById('cartItems');
      wrap.innerHTML = cart.length ? cart.map(i=>`
        <div class="d-flex justify-content-between align-items-center border-bottom py-2">
          <div>${i.name} <span class="text-muted">× ${i.qty}</span></div>
          <div>${fmt(i.price*i.qty)}</div>
        </div>
        <div class="d-flex gap-2 my-2">
          <button class="btn btn-outline-secondary btn-sm" onclick="changeQty('${i.sku}',-1)">－</button>
          <button class="btn btn-outline-secondary btn-sm" onclick="changeQty('${i.sku}',+1)">＋</button>
        </div>
      `).join('') : '<div class="text-muted">尚無商品</div>';
      const subtotal = cart.reduce((s,i)=>s+i.price*i.qty,0);
      const shipping = (subtotal>2000||subtotal===0)?0:100;
      document.getElementById('subtotal').textContent = fmt(subtotal);
      document.getElementById('shipping').textContent = fmt(shipping);
      document.getElementById('total').textContent = fmt(subtotal+shipping);
    }
    document.getElementById('clearCart').onclick = ()=>{ cart.length=0; saveCart(); renderCart(); };
    document.getElementById('checkout').onclick = ()=>{ if(!cart.length) return show('購物車是空的'); new bootstrap.Modal('#checkoutDlg').show(); };
    document.getElementById('orderForm').addEventListener('submit', async (e)=>{
      e.preventDefault();
      const customer = Object.fromEntries(new FormData(e.target).entries());
      const res = await fetch('/api/orders',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ customer, items:cart })});
      const r = await res.json();
      if(r.next){ window.location.href = r.next; return; }
      show('訂單成立：'+r.orderNo);
      cart.length=0; saveCart(); renderCart();
      bootstrap.Modal.getInstance(document.getElementById('checkoutDlg')).hide();
    });

    /*** 50 個商品（前端靜態清單；之後可改名/價/圖/sku） ***/
    const PRODUCTS = Array.from({length:50},(_,i)=>{
      const n2 = (i+1).toString().padStart(2,'0');
      const n3 = (i+1).toString().padStart(3,'0');
      return {
        sku: `P-${n3}`,
        name: `商品 ${n2}`,
        price: (i+1)*100,                   // 自行調整
        image: `/assets/product-${n2}.jpg`  // 把圖片丟到 public/assets/，沒圖會顯示 placeholder.jpg
      };
    });

    function renderProducts(){
      const box = document.getElementById('products');
      box.innerHTML = PRODUCTS.map(p=>`
        <div class="col-12 col-sm-6 col-md-4 col-lg-3">
          <div class="card product-card h-100 shadow-sm">
            <img src="${p.image}" alt="${p.name}" onerror="this.src='/assets/placeholder.jpg'">
            <div class="card-body">
              <h5 class="card-title">${p.name}</h5>
              <div class="text-muted small mb-2">SKU：${p.sku}</div>
              <div class="mt-auto d-flex justify-content-between align-items-center">
                <div class="price">NT$ ${p.price.toLocaleString()}</div>
                <button class="btn btn-outline-dark btn-sm" onclick='add(${JSON.stringify(p)})'>加入購物車</button>
              </div>
            </div>
          </div>
        </div>
      `).join('');
    }

    // 初始化
    renderProducts();
    renderCart();
  </script>
</body>
</html>
