// assets/js/pages/shop.js
// 更保守：不使用可選鏈結、盡量避免瀏覽器相容性坑，並加上 try/catch。

// -----------------------------
// 產品資料（可自行修改/擴充）
// -----------------------------
var PRODUCTS = [
  { sku: 'LG-001', name: '立國工業手套 M', price: 120, img: 'assets/img/glove-m.jpg' },
  { sku: 'LG-002', name: '立國工業手套 L', price: 120, img: 'assets/img/glove-l.jpg' },
  { sku: 'LT-010', name: '立國安全帽',      price: 980, img: 'assets/img/helmet.jpg' }
];

// -----------------------------
// money 格式（有 fmt.money 就用，否則 fallback）
// -----------------------------
function money(n) {
  try {
    if (window.fmt && typeof window.fmt.money === 'function') {
      return window.fmt.money(n);
    }
    return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD' }).format(Number(n) || 0);
  } catch (e) {
    return 'NT$ ' + (Number(n) || 0).toLocaleString();
  }
}

// -----------------------------
// localStorage 購物車
// -----------------------------
var CART_KEY = 'shop_cart_v1';

function readCart() {
  try {
    var raw = localStorage.getItem(CART_KEY);
    if (!raw) return { items: [] };
    var obj = JSON.parse(raw);
    if (!obj || !Array.isArray(obj.items)) return { items: [] };
    return obj;
  } catch (e) {
    return { items: [] };
  }
}
function writeCart(cart) {
  try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) {}
}

function findItem(cart, sku) {
  for (var i = 0; i < cart.items.length; i++) {
    if (cart.items[i].sku === sku) return cart.items[i];
  }
  return null;
}

function addToCart(sku) {
  var prod = null;
  for (var i = 0; i < PRODUCTS.length; i++) {
    if (PRODUCTS[i].sku === sku) { prod = PRODUCTS[i]; break; }
  }
  if (!prod) return;
  var cart = readCart();
  var item = findItem(cart, sku);
  if (item) item.qty += 1;
  else cart.items.push({ sku: prod.sku, name: prod.name, price: prod.price, qty: 1 });
  writeCart(cart);
}

function decrease(sku) {
  var cart = readCart();
  var item = findItem(cart, sku);
  if (!item) return;
  item.qty -= 1;
  if (item.qty <= 0) {
    var arr = [];
    for (var i = 0; i < cart.items.length; i++) {
      if (cart.items[i].sku !== sku) arr.push(cart.items[i]);
    }
    cart.items = arr;
  }
  writeCart(cart);
}

function removeItem(sku) {
  var cart = readCart();
  var arr = [];
  for (var i = 0; i < cart.items.length; i++) {
    if (cart.items[i].sku !== sku) arr.push(cart.items[i]);
  }
  cart.items = arr;
  writeCart(cart);
}

function clearCart() { writeCart({ items: [] }); }

function calcSubtotal(cart) {
  var s = 0;
  for (var i = 0; i < cart.items.length; i++) {
    s += (Number(cart.items[i].price) || 0) * (Number(cart.items[i].qty) || 0);
  }
  return s;
}
function calcShipping(cart) {
  var sub = calcSubtotal(cart);
  return (sub > 0 && sub < 1000) ? 80 : 0; // 可自行調整規則
}
function calcTotal(cart) { return calcSubtotal(cart) + calcShipping(cart); }

// -----------------------------
// UI
// -----------------------------
export default function ShopPage() {
  var root = document.createElement('div');
  root.className = 'container';
  root.style.display = 'grid';
  root.style.gridTemplateColumns = '1fr 360px';
  root.style.gap = '24px';

  // 左側：商品清單
  var left = document.createElement('div');
  left.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin:8px 0 16px">' +
      '<h2 style="margin:0">立國實業｜線上下單</h2>' +
      '<button class="ghost" id="goCheckoutTop">前往結帳</button>' +
    '</div>' +
    '<div id="prodGrid" class="prod-grid"></div>';

  // 右側：購物車
  var right = document.createElement('div');
  right.innerHTML =
    '<div class="card">' +
      '<h3 style="margin-top:0">購物車</h3>' +
      '<div id="cartItems"></div>' +
      '<div style="border-top:1px solid #ffffff22;margin-top:12px;padding-top:12px">' +
        '<div class="row" style="justify-content:space-between"><div>小計</div><div id="sub"></div></div>' +
        '<div class="row" style="justify-content:space-between"><div>運費</div><div id="ship"></div></div>' +
        '<div class="row" style="justify-content:space-between;font-weight:700"><div>合計</div><div id="total"></div></div>' +
      '</div>' +
      '<div class="row" style="margin-top:12px;justify-content:space-between">' +
        '<button class="ghost" id="btnClear">清空</button>' +
        '<button class="primary" id="btnCheckout">結帳</button>' +
      '</div>' +
      '<p class="small" style="opacity:.7;margin-top:12px">付款：轉帳 / 貨到（可日後開啟信用卡/LINE Pay）</p>' +
    '</div>';

  root.appendChild(left);
  root.appendChild(right);

  // 渲染商品卡
  var grid = left.querySelector('#prodGrid');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(260px, 1fr))';
  grid.style.gap = '16px';

  var html = '';
  for (var i = 0; i < PRODUCTS.length; i++) {
    var p = PRODUCTS[i];
    html +=
      '<div class="card prod-card" data-sku="' + p.sku + '">' +
        '<div style="height:140px;background:#ffffff08;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:8px;overflow:hidden">' +
          (p.img ? '<img src="' + p.img + '" alt="' + p.name + '" style="width:100%;height:100%;object-fit:cover">' : '<div style="opacity:.5">No Image</div>') +
        '</div>' +
        '<div style="font-weight:700">' + p.name + '</div>' +
        '<div class="small" style="opacity:.8">SKU：' + p.sku + '</div>' +
        '<div style="margin:8px 0 10px;font-weight:700">' + money(p.price) + '</div>' +
        '<button class="ghost addBtn">加入購物車</button>' +
      '</div>';
  }
  grid.innerHTML = html;

  // 商品加入購物車事件
  grid.addEventListener('click', function (e) {
    try {
      var target = e.target;
      // 往上找 .addBtn
      while (target && target !== grid && !target.classList.contains('addBtn')) {
        target = target.parentNode;
      }
      if (!target || target === grid) return;
      // 找到對應卡片
      var card = target;
      while (card && card !== grid && !card.classList.contains('prod-card')) {
        card = card.parentNode;
      }
      if (!card || card === grid) return;
      var sku = card.getAttribute('data-sku');
      if (!sku) return;
      addToCart(sku);
      renderCart();
    } catch (err) {
      console.error('Add to cart error:', err);
    }
  });

  // 購物車 DOM 參照
  var dom = {
    items: right.querySelector('#cartItems'),
    sub: right.querySelector('#sub'),
    ship: right.querySelector('#ship'),
    total: right.querySelector('#total'),
    clear: right.querySelector('#btnClear'),
    pay: right.querySelector('#btnCheckout'),
    goTop: left.querySelector('#goCheckoutTop')
  };

  dom.clear.addEventListener('click', function () {
    if (confirm('確定要清空購物車？')) {
      clearCart();
      renderCart();
    }
  });
  function goCheckout() {
    var cart = readCart();
    if (!cart.items.length) {
      alert('購物車是空的喔！');
      return;
    }
    alert('已前往結帳。\\n合計：' + money(calcTotal(cart)) + '\\n(此處可導向結帳頁或串金流)');
  }
  dom.pay.addEventListener('click', goCheckout);
  dom.goTop.addEventListener('click', goCheckout);

  // 渲染購物車
  function renderCart() {
    var cart = readCart();
    if (!cart.items.length) {
      dom.items.innerHTML = '<div class="small" style="opacity:.7">尚無商品</div>';
    } else {
      var h = '';
      for (var i = 0; i < cart.items.length; i++) {
        var it = cart.items[i];
        h +=
          '<div class="row" data-sku="' + it.sku + '" style="justify-content:space-between;gap:8px;margin-bottom:8px;align-items:center">' +
            '<div style="flex:1 1 50%">' +
              '<div style="font-weight:700">' + it.name + '</div>' +
              '<div class="small" style="opacity:.7">' + it.sku + '</div>' +
            '</div>' +
            '<div style="min-width:68px;text-align:right">' + money(it.price) + '</div>' +
            '<div class="row" style="gap:6px">' +
              '<button class="ghost sm decBtn">－</button>' +
              '<div style="min-width:24px;text-align:center">' + it.qty + '</div>' +
              '<button class="ghost sm incBtn">＋</button>' +
            '</div>' +
            '<button class="ghost sm rmBtn" title="移除">✕</button>' +
          '</div>';
      }
      dom.items.innerHTML = h;

      var incBtns = dom.items.querySelectorAll('.incBtn');
      for (var i1 = 0; i1 < incBtns.length; i1++) {
        incBtns[i1].addEventListener('click', function () {
          var row = this;
          while (row && row !== dom.items && !row.getAttribute('data-sku')) row = row.parentNode;
          var sku = row ? row.getAttribute('data-sku') : '';
          if (!sku) return;
          addToCart(sku);
          renderCart();
        });
      }
      var decBtns = dom.items.querySelectorAll('.decBtn');
      for (var i2 = 0; i2 < decBtns.length; i2++) {
        decBtns[i2].addEventListener('click', function () {
          var row = this;
          while (row && row !== dom.items && !row.getAttribute('data-sku')) row = row.parentNode;
          var sku = row ? row.getAttribute('data-sku') : '';
          if (!sku) return;
          decrease(sku);
          renderCart();
        });
      }
      var rmBtns = dom.items.querySelectorAll('.rmBtn');
      for (var i3 = 0; i3 < rmBtns.length; i3++) {
        rmBtns[i3].addEventListener('click', function () {
          var row = this;
          while (row && row !== dom.items && !row.getAttribute('data-sku')) row = row.parentNode;
          var sku = row ? row.getAttribute('data-sku') : '';
          if (!sku) return;
          removeItem(sku);
          renderCart();
        });
      }
    }

    var c = readCart();
    dom.sub.textContent = money(calcSubtotal(c));
    dom.ship.textContent = money(calcShipping(c));
    dom.total.textContent = money(calcTotal(c));
  }

  // 首次載入
  try { renderCart(); } catch (e) { console.error('renderCart error:', e); }

  return root;
}
