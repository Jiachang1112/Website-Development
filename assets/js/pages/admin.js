// assets/js/pages/admin.js
// 後台：訂單列表 + 詳細檢視 + 狀態更新（簡化穩定版）
// 使用具名匯出：AdminPage（對應 app.js: import { AdminPage } from './pages/admin.js'）

import { db } from '../firebase.js';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

function $(sel, root){ return (root||document).querySelector(sel); }
function money(n){ n = Number(n||0); return 'NT$ ' + n.toLocaleString(); }
function tsToText(ts){
  try{
    if(!ts) return '(未記錄時間)';
    var d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('zh-TW', { hour12:false });
  }catch(e){ return '(未記錄時間)'; }
}

export function AdminPage() {
  const el = document.createElement('div');
  el.className = 'container card p-3';
  el.innerHTML = `
    <h3 class="mb-3">後台訂單管理</h3>

    <div class="row g-3">
      <div class="col-lg-6">
        <div class="card p-2" style="min-height:360px">
          <div class="d-flex justify-content-between align-items-center">
            <h5 class="m-0">訂單列表</h5>
          </div>
          <div id="orders" class="small text-muted">載入中…</div>
        </div>
      </div>

      <div class="col-lg-6">
        <div class="card p-2" style="min-height:360px">
          <h5 class="m-0">訂單詳細</h5>
          <div id="orderDetail" class="mt-2 small text-muted">左側點一筆查看</div>
        </div>
      </div>
    </div>
  `;

  const box = $('#orders', el);
  const detailBox = $('#orderDetail', el);

  try {
    // Firestore 訂單集合（依建立時間排序）
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));

    // 即時監聽訂單
    onSnapshot(q, (snap) => {
      if (snap.empty) {
        box.innerHTML = '<div class="text-muted">尚無訂單</div>';
        return;
      }

      // 列表
      box.innerHTML = Array.prototype.map.call(snap.docs, function(d){
        const o = d.data() || {};
        const total = (o && o.amounts && o.amounts.total) ? o.amounts.total : 0;
        const name  = (o && o.customer && o.customer.name)  ? o.customer.name  : '';
        const email = (o && o.customer && o.customer.email) ? o.customer.email : '';
        const items = (o && o.items) ? o.items : [];
        const itemText = items.map(function(i){
          const nm = (i && i.name) ? i.name : '';
          const q  = (i && i.qty)  ? i.qty  : 0;
          return nm + ' × ' + q;
        }).join('、');

        const t = (o && o.createdAt) ? o.createdAt : null;
        const ts = tsToText(t);

        return (
          '<div class="py-2 border-bottom border-secondary" '+
               'style="cursor:pointer" data-id="'+d.id+'">'+
            '<div><b>#'+d.id+'</b> ｜ '+name+' ｜ '+email+' ｜ '+ money(total) +'</div>'+
            '<div class="text-muted">'+ts+'</div>'+
            '<div class="mt-1">品項：'+itemText+'</div>'+
          '</div>'
        );
      }).join('');

      // 綁定點擊顯示詳細
      Array.prototype.forEach.call(
        box.querySelectorAll('[data-id]'),
        function(row){
          row.addEventListener('click', function(){
            const id = row.getAttribute('data-id');
            showOrderDetail(id);
          });
        }
      );
    }, (err) => {
      box.innerHTML = '<span class="text-danger">讀取失敗：</span>' + err.message;
    });
  } catch (err) {
    box.innerHTML = '<span class="text-danger">初始化失敗：</span>' + err.message;
  }

  // 顯示單筆訂單詳細 + 狀態更新
  function showOrderDetail(id){
    detailBox.textContent = '載入中…';
    (async function(){
      try{
        const ref = doc(db, 'orders', id);
        const d = await getDoc(ref);
        if(!d.exists()){ detailBox.textContent = '查無資料'; return; }

        const v = d.data() || {};
        const c = v.customer || {};
        const items = Array.isArray(v.items) ? v.items : [];

        // 組品項表格
        var rows = '';
        for(var i=0;i<items.length;i++){
          var it = items[i] || {};
          var nm = it.name || '';
          var sku = it.sku  || '';
          var qty = Number(it.qty || 0);
          var price = Number(it.price || 0);
          rows += '<tr>'+
                    '<td>'+nm+'</td>'+
                    '<td>'+sku+'</td>'+
                    '<td class="text-end">'+qty+'</td>'+
                    '<td class="text-end">'+money(price)+'</td>'+
                    '<td class="text-end">'+money(price*qty)+'</td>'+
                  '</tr>';
        }

        var subtotal = (v.amounts && v.amounts.subtotal) ? v.amounts.subtotal : 0;
        var shipping = (v.amounts && v.amounts.shipping) ? v.amounts.shipping : 0;
        var total    = (v.amounts && v.amounts.total)    ? v.amounts.total    : 0;

        var statusNow = v.status || 'pending';
        var createdTxt = tsToText(v.createdAt);

        detailBox.innerHTML =
          '<div class="small text-muted">訂單編號</div>'+
          '<div class="mb-2"><code>'+d.id+'</code></div>'+

          '<div class="row g-2">'+
            '<div class="col-md-6">'+
              '<div class="small text-muted">建立時間</div>'+
              '<div>'+ createdTxt +'</div>'+
            '</div>'+
            '<div class="col-md-6">'+
              '<div class="small text-muted">狀態</div>'+
              '<div class="d-flex gap-2 align-items-center">'+
                '<select id="orderState" class="form-select form-select-sm" style="max-width:160px">'+
                  ['pending','paid','shipped','canceled'].map(function(s){
                    var sel = (s === statusNow) ? ' selected' : '';
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
            '<div>'+(c.name  || '-')+'</div>'+
            '<div>'+(c.phone || '-')+'</div>'+
            '<div>'+(c.email || '-')+'</div>'+
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
              '<tbody>'+rows+'</tbody>'+
              '<tfoot>'+
                '<tr><th colspan="4" class="text-end">小計</th><th class="text-end">'+money(subtotal)+'</th></tr>'+
                '<tr><th colspan="4" class="text-end">運費</th><th class="text-end">'+money(shipping)+'</th></tr>'+
                '<tr><th colspan="4" class="text-end">合計</th><th class="text-end">'+money(total)+'</th></tr>'+
              '</tfoot>'+
            '</table>'+
          '</div>';

        // 儲存狀態
        $('#btnSaveState', detailBox).addEventListener('click', function(){
          (async function(){
            try{
              var state = $('#orderState', detailBox).value;
              await updateDoc(doc(db,'orders',id), {
                status: state,
                updatedAt: serverTimestamp()
              });
              alert('狀態已更新');
            }catch(err){
              alert('更新失敗：'+err.message);
            }
          })();
        });

      }catch(err){
        detailBox.innerHTML = '<span class="text-danger">讀取失敗：</span>'+err.message;
      }
    })();
  }

  return el;
}
