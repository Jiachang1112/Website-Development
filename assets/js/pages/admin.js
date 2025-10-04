// assets/js/pages/admin.js
// 後台：訂單管理（卡片風格，無快捷按鈕）
// 依賴：assets/js/firebase.js

import { db } from '../firebase.js';
import {
  collection, query, orderBy, limit, onSnapshot,
  doc, getDoc, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

/* ───────── 小工具 ───────── */
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const money = n => 'NT$ ' + (n || 0).toLocaleString();
const zh = { pending:'待付款', paid:'已付款', shipped:'已出貨', canceled:'已取消' };
const en = { '待付款':'pending', '已付款':'paid', '已出貨':'shipped', '已取消':'canceled' };
const shortId = id => (id||'').slice(0,10);
const toTW = ts => {
  try {
    const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
    return d ? d.toLocaleString('zh-TW',{hour12:false}) : '-';
  } catch { return '-'; }
};

/* ───────── 注入樣式（一次） ───────── */
function ensureAdminStyles(){
  if ($('#admin-css')) return;
  const css = document.createElement('style');
  css.id = 'admin-css';
  css.textContent = `
  :root{
    --bg:#0f1318; --fg:#e6e6e6; --muted:#9aa3af;
    --card:#151a21; --border:#2a2f37; --shadow:0 6px 24px rgba(0,0,0,.25), 0 2px 8px rgba(0,0,0,.2);
    --chip:#0b1220;
  }
  body.light{
    --bg:#f6f8fc; --fg:#111; --muted:#6b7280;
    --card:#ffffff; --border:#e5e7eb; --shadow:0 12px 24px rgba(17,24,39,.06);
    --chip:#eef2ff;
  }
  .admin-shell{max-width:1200px;margin-inline:auto;padding:20px}
  .admin-grid{display:grid;grid-template-columns:1fr 1fr; gap:18px}
  @media(max-width: 992px){ .admin-grid{grid-template-columns:1fr} }

  .kcard{background:var(--card);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow)}
  .kpad{padding:16px}
  .hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
  .hd-title{font-weight:800}

  /* 列表卡片（第三張圖風格） */
  .olist{display:flex;flex-direction:column;gap:12px}
  .orow{display:flex;align-items:center;justify-content:space-between; padding:16px;border:1px solid var(--border);border-radius:14px;cursor:pointer; transition:transform .15s ease, box-shadow .2s ease}
  .orow:hover{transform:translateY(-1px); box-shadow:0 10px 28px rgba(0,0,0,.3)}
  .o-left{display:flex;flex-direction:column;gap:4px}
  .o-line{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .o-id{font-weight:700}
  .o-badge{font-size:12px;border:1px solid var(--border);padding:.2rem .55rem;border-radius:999px;color:var(--muted)}
  .o-sub{color:var(--muted);font-size:13px}
  .o-time{font-size:12px;border:1px solid var(--border);background:var(--chip);color:var(--muted); padding:.25rem .6rem; border-radius:999px}

  /* 詳細區 */
  .detail-title{font-weight:800;margin-bottom:6px}
  .kv{display:grid;grid-template-columns:120px 1fr; gap:6px 12px; margin-bottom:8px}
  .kv .k{color:var(--muted)}
  .table{margin-top:8px}
  `;
  document.head.appendChild(css);
}

/* ───────── 版面與行為 ───────── */
export function AdminPage(){
  ensureAdminStyles();

  const el = document.createElement('div');
  el.className = 'admin-shell';
  el.innerHTML = `
    <div class="admin-grid">

      <!-- 左：訂單列表 -->
      <section class="kcard kpad">
        <div class="hd">
          <div class="hd-title">訂單列表</div>
        </div>
        <div id="orderList" class="olist">
          <div class="o-sub">載入中…</div>
        </div>
      </section>

      <!-- 右：訂單詳細 -->
      <section class="kcard kpad">
        <div class="hd">
          <div class="hd-title">訂單詳細</div>
        </div>
        <div id="orderDetail" class="o-sub">左側點一筆查看</div>
      </section>

    </div>
  `;

  const listEl = $('#orderList', el);
  const detailEl = $('#orderDetail', el);

  // 監聽訂單（最新 50 筆）
  const q = query(collection(db,'orders'), orderBy('createdAt','desc'), limit(50));
  onSnapshot(q, snap=>{
    if (snap.empty){ listEl.innerHTML = '<div class="o-sub">目前沒有訂單</div>'; return; }
    listEl.innerHTML = snap.docs.map(d=>{
      const v = d.data()||{};
      const itemsCount = (v.items||[]).reduce((s,i)=>s+(i.qty||0),0);
      const total = money(v?.amounts?.total||0);
      return `
        <div class="orow" data-id="${d.id}">
          <div class="o-left">
            <div class="o-line">
              <span class="o-id">#${shortId(d.id)}</span>
              <span class="o-badge">${zh[v.status||'pending']||'-'}</span>
              <span class="o-id">${total}</span>
            </div>
            <div class="o-sub">${v?.customer?.name||'-'} ｜ ${itemsCount} 件</div>
          </div>
          <span class="o-time">${toTW(v.createdAt)}</span>
        </div>`;
    }).join('');

    $$('.orow', listEl).forEach(r=>{
      r.addEventListener('click', ()=> showDetail(r.dataset.id));
    });
  }, err=>{
    listEl.innerHTML = `<div class="text-danger">讀取失敗：${err.message}</div>`;
  });

  // 顯示訂單詳細
  async function showDetail(id){
    detailEl.innerHTML = '載入中…';
    try{
      const ref = doc(db,'orders', id);
      const snap = await getDoc(ref);
      if (!snap.exists()){ detailEl.innerHTML = '查無資料'; return; }
      const v = snap.data()||{};

      const itemsRows = (v.items||[]).map(i=>`
        <tr>
          <td>${i.name||''}</td>
          <td>${i.sku||''}</td>
          <td class="text-end">${i.qty||0}</td>
          <td class="text-end">${money(i.price||0)}</td>
          <td class="text-end">${money((i.price||0)*(i.qty||0))}</td>
        </tr>`).join('');

      detailEl.innerHTML = `
        <div class="detail-title">#${snap.id}</div>

        <div class="kv">
          <div class="k">建立時間</div><div>${toTW(v.createdAt)}</div>
          <div class="k">狀態</div>
          <div>
            <select id="stateSel" class="form-select form-select-sm" style="max-width:160px;display:inline-block">
              ${['待付款','已付款','已出貨','已取消'].map(t=>{
                const sel = (zh[v.status||'pending']===t) ? 'selected' : '';
                return `<option ${sel}>${t}</option>`;
              }).join('')}
            </select>
            <button id="saveState" class="btn btn-sm btn-primary ms-2">儲存</button>
          </div>

          <div class="k">客戶</div><div>${v?.customer?.name||'-'}</div>
          <div class="k">電話</div><div>${v?.customer?.phone||'-'}</div>
          <div class="k">Email</div><div>${v?.customer?.email||'-'}</div>
          <div class="k">配送</div><div>${v?.customer?.shipping||'-'} ｜ ${v?.customer?.address||'-'}</div>
          <div class="k">付款</div><div>${v?.customer?.payment||'-'}</div>
          <div class="k">備註</div><div>${v?.customer?.note||''}</div>
        </div>

        <div class="table-responsive">
          <table class="table table-sm align-middle">
            <thead>
              <tr>
                <th>名稱</th><th>SKU</th>
                <th class="text-end">數量</th>
                <th class="text-end">單價</th>
                <th class="text-end">小計</th>
              </tr>
            </thead>
            <tbody>${itemsRows}</tbody>
            <tfoot>
              <tr><th colspan="4" class="text-end">小計</th><th class="text-end">${money(v?.amounts?.subtotal||0)}</th></tr>
              <tr><th colspan="4" class="text-end">運費</th><th class="text-end">${money(v?.amounts?.shipping||0)}</th></tr>
              <tr><th colspan="4" class="text-end">合計</th><th class="text-end">${money(v?.amounts?.total||0)}</th></tr>
            </tfoot>
          </table>
        </div>
      `;

      // 儲存狀態
      $('#saveState', detailEl).addEventListener('click', async ()=>{
        const zhVal = $('#stateSel', detailEl).value;
        const newState = en[zhVal] || 'pending';
        try{
          await updateDoc(ref, { status:newState, updatedAt: serverTimestamp() });
          // 直接把左側選中的那張卡片的徽章字更新（若存在）
          const row = $(`.orow[data-id="${id}"]`, listEl);
          if (row) row.querySelector('.o-badge').textContent = zh[newState];
          alert('狀態已更新');
        }catch(err){
          alert('更新失敗：'+err.message);
        }
      });

    }catch(err){
      detailEl.innerHTML = `<div class="text-danger">讀取失敗：${err.message}</div>`;
    }
  }

  return el;
}
