// assets/js/pages/admin.js
// 後台：訂單管理 + 用戶記帳（只讀）
// 只依賴：assets/js/firebase.js

import { db } from '../firebase.js';
import {
  collection, collectionGroup, doc,
  query, orderBy, limit, where,
  onSnapshot, getDoc, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

/* ===== 管理員 Email（請改成你自己的，可多筆） ===== */
var ADMIN_EMAILS = [
  'Bruce9811123@gmail.com'   // ← 改成你的管理員 email
];
/* =============================================== */

function $(sel, root){ return (root||document).querySelector(sel); }
function $all(sel, root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }
function money(n){ n = n||0; return 'NT$ ' + Number(n).toLocaleString(); }
function toDT(ts){
  try{
    if(!ts) return '-';
    var d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('zh-TW', { hour12:false });
  }catch(e){ return '-'; }
}
function sessionUser(){
  try { return JSON.parse(localStorage.getItem('session_user')||'null'); }
  catch(e){ return null; }
}
function isAdmin(){
  var u = sessionUser();
  if(!u || !u.email) return false;
  var e = String(u.email).toLowerCase();
  return ADMIN_EMAILS.map(function(x){return String(x).toLowerCase();}).indexOf(e) >= 0;
}

export default function AdminPage(){
  var el = document.createElement('div');
  el.className = 'container card p-3';

  // ---- 權限檢查（失敗也不會讓整頁黑）----
  if(!isAdmin()){
    el.innerHTML =
      '<h3 class="mb-3">⛔ 無權限</h3>'+
      '<p class="text-muted">只有管理員可以進入後台。</p>'+
      '<a class="btn btn-secondary" href="#auth">前往登入</a>';
    return el;
  }

  // ---- 版面（用原生 JS 切分頁，不依賴 Bootstrap JS）----
  el.innerHTML =
    '<h3 class="mb-3">後台</h3>'+
    '<div class="d-flex gap-2 mb-3">'+
      '<button id="tabOrders" class="btn btn-primary btn-sm">訂單管理</button>'+
      '<button id="tabLedger" class="btn btn-outline-secondary btn-sm">用戶記帳</button>'+
    '</div>'+

    '<div id="paneOrders">'+
      '<div class="row g-3">'+
        '<div class="col-lg-6">'+
          '<div class="card p-2" style="min-height:360px">'+
            '<div class="d-flex justify-content-between align-items-center">'+
              '<h5 class="m-0">最近訂單</h5>'+
              '<select id="orderFilter" class="form-select form-select-sm" style="width:auto">'+
                '<option value="">全部狀態</option>'+
                '<option value="pending">pending</option>'+
                '<option value="paid">paid</option>'+
                '<option value="shipped">shipped</option>'+
                '<option value="canceled">canceled</option>'+
              '</select>'+
            '</div>'+
            '<div id="orderList" class="mt-2 small text-muted">按下方的「訂單管理」開始載入…</div>'+
          '</div>'+
        '</div>'+
        '<div class="col-lg-6">'+
          '<div class="card p-2" style="min-height:360px">'+
            '<h5 class="m-0">訂單詳細</h5>'+
            '<div id="orderDetail" class="mt-2 small text-muted">左側點一筆查看</div>'+
          '</div>'+
        '</div>'+
      '</div>'+
    '</div>'+

    '<div id="paneLedger" class="d-none">'+
      '<div class="row g-3">'+
        '<div class="col-lg-6">'+
          '<div class="card p-2" style="min-height:360px">'+
            '<div class="d-flex justify-content-between align-items-center">'+
              '<h5 class="m-0">最近記帳（collectionGroup: expenses）</h5>'+
              '<span class="small text-muted">最多顯示 100 筆</span>'+
            '</div>'+
            '<div id="ledgerList" class="mt-2 small text-muted">按上方「用戶記帳」再開始載入…</div>'+
          '</div>'+
        '</div>'+
        '<div class="col-lg-6">'+
          '<div class="card p-2" style="min-height:360px">'+
            '<h5 class="m-0">記帳詳細</h5>'+
            '<div id="ledgerDetail" class="mt-2 small text-muted">左側點一筆查看</div>'+
          '</div>'+
        '</div>'+
      '</div>'+
    '</div>';

  // ---- 分頁切換 ----
  var tabOrdersBtn = $('#tabOrders', el);
  var tabLedgerBtn = $('#tabLedger', el);
  var paneOrders   = $('#paneOrders', el);
  var paneLedger   = $('#paneLedger', el);

  tabOrdersBtn.addEventListener('click', function(){
    tabOrdersBtn.classList.remove('btn-outline-secondary'); tabOrdersBtn.classList.add('btn-primary');
    tabLedgerBtn.classList.remove('btn-primary');            tabLedgerBtn.classList.add('btn-outline-secondary');
    paneOrders.classList.remove('d-none'); paneLedger.classList.add('d-none');
    // 初次點擊才綁訂單資料
    if(!bindOrdersBound){ bindOrders(); bindOrdersBound = true; }
  });
  tabLedgerBtn.addEventListener('click', function(){
    tabLedgerBtn.classList.remove('btn-outline-secondary'); tabLedgerBtn.classList.add('btn-primary');
    tabOrdersBtn.classList.remove('btn-primary');            tabOrdersBtn.classList.add('btn-outline-secondary');
    paneLedger.classList.remove('d-none'); paneOrders.classList.add('d-none');
    // 初次點擊才綁記帳資料
    if(!bindLedgerBound){ bindLedger(); bindLedgerBound = true; }
  });

  /* ================= 訂單管理 ================= */
  var ordersUnsub = null;
  var orderListEl = $('#orderList', el);
  var orderDetailEl = $('#orderDetail', el);
  var bindOrdersBound = false;

  function bindOrders(){
    try{
      if(ordersUnsub){ try{ ordersUnsub(); }catch(e){} ordersUnsub = null; }
      var state = $('#orderFilter', el).value;

      var qy = query(collection(db,'orders'), orderBy('createdAt','desc'), limit(100));
      if(state){
        qy = query(collection(db,'orders'), where('status','==',state), orderBy('createdAt','desc'), limit(100));
      }

      orderListEl.textContent = '載入中…';

      ordersUnsub = onSnapshot(qy, function(snap){
        try{
          if(snap.empty){
            orderListEl.innerHTML = '<div class="text-muted">沒有資料</div>';
            return;
          }
          var html = '';
          snap.docs.forEach(function(d){
            var v = d.data() || {};
            var items = v.items || [];
            var count = 0;
            for(var i=0;i<items.length;i++){ count += (items[i].qty||0); }
            var total = (v.amounts && v.amounts.total) ? v.amounts.total : 0;
            var email = (v.customer && v.customer.email) ? v.customer.email : '-';
            var name  = (v.customer && v.customer.name)  ? v.customer.name  : '-';
            html +=
              '<div class="border-bottom py-2 list-item" data-id="'+d.id+'" style="cursor:pointer">'+
                '<div class="d-flex justify-content-between">'+
                  '<div><span class="text-info">#'+d.id.slice(0,10)+'</span>'+
                  '<span class="ms-2">'+toDT(v.createdAt)+'</span></div>'+
                  '<div>'+
                    '<span class="badge bg-secondary">'+(v.status||'pending')+'</span>'+
                    '<span class="ms-2">'+count+'件｜'+money(total)+'</span>'+
                  '</div>'+
                '</div>'+
                '<div class="text-muted">'+name+' ｜ '+email+'</div>'+
              '</div>';
          });
          orderListEl.innerHTML = html;

          $all('.list-item', orderListEl).forEach(function(li){
            li.addEventListener('click', function(){ showOrderDetail(li.getAttribute('data-id')); });
          });
        }catch(err){
          console.error(err);
          orderListEl.innerHTML = '<div class="text-danger">渲染失敗：'+err.message+'</div>';
        }
      }, function(err){
        console.error(err);
        orderListEl.innerHTML = '<div class="text-danger">讀取失敗：'+err.message+'</div>';
      });
    }catch(err){
      console.error(err);
      orderListEl.innerHTML = '<div class="text-danger">初始化失敗：'+err.message+'</div>';
    }
  }

  function showOrderDetail(id){
    orderDetailEl.textContent = '載入中…';
    (async function(){
      try{
        var ref = doc(db,'orders',id);
        var d = await getDoc(ref);
        if(!d.exists()){ orderDetailEl.textContent = '查無資料'; return; }
        var v = d.data() || {};
        var items = v.items || [];
        var rows = '';
        for(var i=0;i<items.length;i++){
          var it = items[i];
          var sku = it.sku || '';
          var qty = it.qty || 0;
          var price = it.price || 0;
          rows += '<tr>'+
                    '<td>'+ (it.name||'') +'</td>'+
                    '<td>'+ sku +'</td>'+
                    '<td class="text-end">'+ qty +'</td>'+
                    '<td class="text-end">'+ money(price) +'</td>'+
                    '<td class="text-end">'+ money(price*qty) +'</td>'+
                  '</tr>';
        }
        var subtotal = (v.amounts && v.amounts.subtotal) ? v.amounts.subtotal : 0;
        var shipping = (v.amounts && v.amounts.shipping) ? v.amounts.shipping : 0;
        var total    = (v.amounts && v.amounts.total)    ? v.amounts.total    : 0;
        var c = v.customer || {};

        orderDetailEl.innerHTML =
          '<div class="small text-muted">訂單編號</div>'+
          '<div class="mb-2"><code>'+d.id+'</code></div>'+

          '<div class="row g-2">'+
            '<div class="col-md-6">'+
              '<div class="small text-muted">建立時間</div>'+
              '<div>'+toDT(v.createdAt)+'</div>'+
            '</div>'+
            '<div class="col-md-6">'+
              '<div class="small text-muted">狀態</div>'+
              '<div class="d-flex gap-2 align-items-center">'+
                '<select id="orderState" class="form-select form-select-sm" style="max-width:160px">'+
                  ['pending','paid','shipped','canceled'].map(function(s){
                    var sel = (s === (v.status||'pending')) ? ' selected' : '';
                    return '<option'+sel+'>'+s+'</option>';
                  }).join('')+
                '</select>'+
                '<button id="btnSaveState" class="btn btn-sm btn-primary">儲存</button>'+
              '</div>'+
            '</div>'+
          '</div>'+

          '<hr class="my-2">'+

          '<div class="small text-muted">客戶資料</div>'+
          '<div class="mb-2">'+
            '<div>'+(c.name||'-')+'</div>'+
            '<div>'+(c.phone||'-')+'</div>'+
            '<div>'+(c.email||'-')+'</div>'+
            '<div>'+(c.shipping||'-')+' ｜ '+(c.address||'-')+'</div>'+
            '<div>付款：'+(c.payment||'-')+'</div>'+
            '<div>備註：'+(c.note||'')+'</div>'+
          '</div>'+

          '<div class="small text-muted">品項</div>'+
          '<div class="table-responsive">'+
            '<table class="table table-sm align-middle">'+
              '<thead>'+
                '<tr><th>名稱</th><th>SKU</th><th class="text-end">數量</th><th class="text-end">單價</th><th class="text-end">小計</th></tr>'+
              '</thead>'+
              '<tbody>'+ rows +'</tbody>'+
              '<tfoot>'+
                '<tr><th colspan="4" class="text-end">小計</th><th class="text-end">'+money(subtotal)+'</th></tr>'+
                '<tr><th colspan="4" class="text-end">運費</th><th class="text-end">'+money(shipping)+'</th></tr>'+
                '<tr><th colspan="4" class="text-end">合計</th><th class="text-end">'+money(total)+'</th></tr>'+
              '</tfoot>'+
            '</table>'+
          '</div>';

        $('#btnSaveState', orderDetailEl).addEventListener('click', function(){
          (async function(){
            try{
              var state = $('#orderState', orderDetailEl).value;
              await updateDoc(doc(db,'orders',id), { status: state, updatedAt: serverTimestamp() });
              alert('狀態已更新');
            }catch(err){
              alert('更新失敗：'+err.message);
            }
          })();
        });

      }catch(err){
        console.error(err);
        orderDetailEl.innerHTML = '<div class="text-danger">讀取失敗：'+err.message+'</div>';
      }
    })();
  }

  $('#orderFilter', el).addEventListener('change', function(){
    bindOrders();
  });

  /* ================= 用戶記帳 ================= */
  var ledgerListEl = $('#ledgerList', el);
  var ledgerDetailEl = $('#ledgerDetail', el);
  var bindLedgerBound = false;

  function bindLedger(){
    try{
      ledgerListEl.textContent = '載入中…';

      var cg = query(
        collectionGroup(db,'expenses'),
        // 若你的紀錄沒有 date 欄位，可改成 orderBy('createdAt','desc')
        orderBy('date','desc'),
        limit(100)
      );

      onSnapshot(cg, function(snap){
        try{
          if(snap.empty){
            ledgerListEl.innerHTML = '<div class="text-muted">沒有資料</div>';
            return;
          }
          var html = '';
          snap.docs.forEach(function(d){
            var v = d.data() || {};
            var amount = (v.amount!=null) ? v.amount : ((v.price!=null)?v.price:0);
            var memo = (v.note || v.memo || '');
            if(typeof memo !== 'string'){ try{ memo = JSON.stringify(memo); }catch(e){ memo = ''; } }
            html +=
              '<div class="border-bottom py-2 ledger-item" data-path="'+d.ref.path+'" style="cursor:pointer">'+
                '<div class="d-flex justify-content-between">'+
                  '<div>'+toDT(v.date || v.createdAt)+'</div>'+
                  '<div>'+money(amount)+'</div>'+
                '</div>'+
                '<div class="text-muted">'+ memo.slice(0,24) +'</div>'+
              '</div>';
          });
          ledgerListEl.innerHTML = html;

          $all('.ledger-item', ledgerListEl).forEach(function(li){
            li.addEventListener('click', function(){ showLedgerDetail(li.getAttribute('data-path')); });
          });
        }catch(err){
          console.error(err);
          ledgerListEl.innerHTML = '<div class="text-danger">渲染失敗：'+err.message+'</div>';
        }
      }, function(err){
        console.error(err);
        ledgerListEl.innerHTML = '<div class="text-danger">讀取失敗：'+err.message+'</div>';
      });

    }catch(err){
      console.error(err);
      ledgerListEl.innerHTML = '<div class="text-danger">初始化失敗：'+err.message+'</div>';
    }
  }

  function showLedgerDetail(path){
    ledgerDetailEl.textContent = '載入中…';
    (async function(){
      try{
        var d = await getDoc(doc(db, path));
        if(!d.exists()){ ledgerDetailEl.textContent = '查無資料'; return; }
        var v = d.data() || {};
        var amount = (v.amount!=null) ? v.amount : ((v.price!=null)?v.price:0);
        var objStr;
        try{ objStr = JSON.stringify(v, null, 2); }catch(e){ objStr = String(v); }

        ledgerDetailEl.innerHTML =
          '<div class="small text-muted">文件路徑</div>'+
          '<div class="mb-2"><code>'+path+'</code></div>'+

          '<div class="small text-muted">日期</div>'+
          '<div class="mb-2">'+toDT(v.date || v.createdAt)+'</div>'+

          '<div class="small text-muted">金額</div>'+
          '<div class="mb-2">'+money(amount)+'</div>'+

          '<div class="small text-muted">內容</div>'+
          '<pre class="mb-0" style="white-space:pre-wrap">'+objStr+'</pre>';
      }catch(err){
        console.error(err);
        ledgerDetailEl.innerHTML = '<div class="text-danger">讀取失敗：'+err.message+'</div>';
      }
    })();
  }

  return el;
}
