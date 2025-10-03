// assets/js/pages/shop.js

// ----------------------------
// 產品資料（你可再擴充/改價）
// ----------------------------
const PRODUCTS = [
  {
    sku: 'LG-001',
    name: '立國工業手套 M',
    price: 120,
    img: 'assets/img/glove-m.jpg', // 可換你自己的圖片路徑，或留空
  },
  {
    sku: 'LG-002',
    name: '立國工業手套 L',
    price: 120,
    img: 'assets/img/glove-l.jpg',
  },
  {
    sku: 'LT-010',
    name: '立國安全帽',
    price: 980,
    img: 'assets/img/helmet.jpg',
  }
];

// ----------------------------
// money 格式工具（專案有 fmt.money 就用，否則 fallback）
// ----------------------------
function money(n) {
  if (window.fmt && typeof window.fmt.money === 'function') {
    return window.fmt.money(n);
  }
  try {
    return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD'}).format(+n || 0);
  } catch {
    return `NT$ ${(+n || 0).toLocaleString()}`;
  }
}

// ----------------------------
// 購物車 persistence（localStorage）
// ----------------------------
const CART_KEY = 'shop_cart_v1';

function readCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '{"items":[]}'); }
  catch { return { items: [] }; }
}
function writeCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

// 以 sku 找 item
function findItem(cart, sku) {
  return cart.items.find(i => i.sku === sku);
}

// 操作：新增 / 增量 / 減量 / 刪除 / 清空
function addToCart(sku) {
  const prod = PRODUCTS.find(p => p.sku === sku);
  if (!prod) return;
  const cart = readCart();
  const item = findItem(cart, sku);
  if (item) item.qty += 1;
  else cart.items.push({ sku: prod.sku, name: prod.name, price: prod.price, qty: 1 });
  writeCart(cart);
}
function decrease(sku) {
  const cart = readCart();
  const item = findItem(cart, sku);
  if (!item) return;
  item.qty -= 1;
  if (item.qty <= 0) {
    cart.items = cart.items.filter(i => i.sku !== sku);
  }
  writeCart(cart);
}
function removeItem(sku) {
  const cart = readCart();
  cart.items = cart.items.filter(i => i.sku !== sku);
  writeCart(cart);
}
function clearCart() {
  writeCart({ items: [] });
}

// 金額：小計 / 運費 / 合計（可自行調整運費規則）
function calcSubtotal(cart) {
  return cart.items.reduce((s, i) => s + (i.price * i.qty), 0);
}
function calcShipping(cart) {
  const sub = calcSubtotal(cart);
  // 範例：滿 1000 免運，否則 80
  return sub > 0 && sub < 1000 ? 80 : 0;
}
function calcTotal(cart) {
  const sub = calcSubtotal(cart);
  return sub + calcShipping(cart);
}

// ----------------------------
// UI：商品卡 + 購物車側欄
// ----------------------------
export default function ShopPage() {
  const root = document.createElement('div');
  root.className = 'container';
  root.style.display = 'grid';
  root.style.gridTemplateColumns = '1fr 360px';
  root.style.gap = '24px';

  // 左：商品區
  const left = document.createElement('div');
  left.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin:8px 0 16px">
      <h2 style="margin:0">立國實業｜線上下單</h2>
      <button class="ghost" id="goCheckoutTop">前往結帳</button>
    </div>
    <div id="prodGrid" class="prod-grid"></div>
  `;

  // 右：購物車
  const right = document.createElement('div');
  right.innerHTML = `
    <div class="card">
      <h3 style="margin-top:0">購物車</h3>
      <div id="cartItems"></div>
      <div style="border-top:1px solid #ffffff22;margin-top:12px;padding-top:12px">
        <div class="row" style="justify-content:space-between"><div>小計</div><div id="sub"></div></div>
        <div class="row" style="justify-content:space-between"><div>運費</div><div id="ship"></div></div>
        <div class="row" style="justify-content:space-between;font-weight:700"><div>合計</div><div id="total"></div></div>
      </div>

      <div class="row" style="margin-top:12px;justify-content:space-between">
        <button class="ghost" id="btnClear">清空</button>
        <button class="primary" id="btnCheckout">結帳</button>
      </div>

      <p class="small" style="opacity:.7;margin-top:12px">
        付款：轉帳 / 貨到（可日後開啟信用卡/LINE Pay）
      </p>
    </div>
  `;

  root.appendChild(left);
  root.appendChild(right);

  // --- 渲染商品卡片 ---
  const grid = left.querySelector('#prodGrid');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(260px, 1fr))';
  grid.style.gap = '16px';

  grid.innerHTML = PRODUCTS.map(p => `
    <div class="card prod-card" data-sku="${p.sku}">
      <div style="height:140px;background:#ffffff08;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:8px;overflow:hidden">
        ${p.img ? `<img src="${p.img}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover">` : `<div style="opacity:.5">No Image</div>`}
      </div>
      <div style="font-weight:700">${p.name}</div>
      <div class="small" style="opacity:.8">SKU：${p.sku}</div>
      <div style="margin:8px 0 10px;font-weight:700">${money(p.price)}</div>
      <button class="ghost addBtn">加入購物車</button>
    </div>
  `).join('');

  // 點擊加入購物車
  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('.addBtn');
    if (!btn) return;
    const card = btn.closest('.prod-card');
    const sku = card?.dataset?.sku;
    if (!sku) return;
    addToCart(sku);
    renderCart(); // 更新右側購物車
  });

  // --- 購物車畫面 ---
  const dom = {
    items: right.querySelector('#cartItems'),
    sub: right.querySelector('#sub'),
    ship: right.querySelector('#ship'),
    total: right.querySelector('#total'),
    clear: right.querySelector('#btnClear'),
    pay: right.querySelector('#btnCheckout'),
    goTop: left.querySelector('#goCheckoutTop'),
  };

  dom.clear.addEventListener('click', () => {
    if (!confirm('確定要清空購物車？')) return;
    clearCart();
    renderCart();
  });
  dom.pay.addEventListener('click', () => goCheckout());
  dom.goTop.addEventListener('click', () => goCheckout());

  function goCheckout() {
    const cart = readCart();
    if (!cart.items.length) {
      alert('購物車是空的喔！');
      return;
    }
    // 這裡可以導向你的「結帳頁」或開啟付款流程
    // 目前先做示意
    alert(`已前往結帳。\n合計：${money(calcTotal(cart))}\n(你可以在這裡串接金流或建立訂單)`);
  }

  // 購物車渲染
  function renderCart() {
    const cart = readCart();
    if (!cart.items.length) {
      dom.items.innerHTML = `
        <div class="small" style="opacity:.7">尚無商品</div>
      `;
    } else {
      dom.items.innerHTML = cart.items.map(i => `
        <div class="row" data-sku="${i.sku}" style="justify-content:space-between;gap:8px;margin-bottom:8px;align-items:center">
          <div style="flex:1 1 50%">
            <div style="font-weight:700">${i.name}</div>
            <div class="small" style="opacity:.7"> ${i.sku} </div>
          </div>
          <div style="min-width:68px;text-align:right">${money(i.price)}</div>
          <div class="row" style="gap:6px">
            <button class="ghost sm decBtn">－</button>
            <div style="min-width:24px;text-align:center">${i.qty}</div>
            <button class="ghost sm incBtn">＋</button>
          </div>
          <button class="ghost sm rmBtn" title="移除">✕</button>
        </div>
      `).join('');
    }

    dom.items.querySelectorAll('.incBtn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sku = btn.closest('[data-sku]')?.dataset?.sku;
        addToCart(sku);
        renderCart();
      });
    });
    dom.items.querySelectorAll('.decBtn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sku = btn.closest('[data-sku]')?.dataset?.sku;
        decrease(sku);
        renderCart();
      });
    });
    dom.items.querySelectorAll('.rmBtn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sku = btn.closest('[data-sku]')?.dataset?.sku;
        removeItem(sku);
        renderCart();
      });
    });

    dom.sub.textContent = money(calcSubtotal(cart));
    dom.ship.textContent = money(calcShipping(cart));
    dom.total.textContent = money(calcTotal(cart));
  }

  // 首次載入
  renderCart();

  return root;
}
