// assets/js/pages/login-logs.js
// 目標：行為與 UI 風格都與「訂單頁」一致，僅資料來源不同
// 用戶登入 -> user_logs
// 管理員登入 -> admin_logs

import { db } from '../firebase.js';
import {
  collection, query, where, orderBy, getDocs, Timestamp, startAfter, limit
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
const toTW = ts => {
  try{
    const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
    return d ? d.toLocaleString('zh-TW',{hour12:false}) : '-';
  }catch{ return '-' }
};

// --------- UI（和訂單頁同樣節奏） ---------
export function LoginLogsPage(){
  const root = document.createElement('div');
  root.className = 'container py-3';

  root.innerHTML = `
    <button class="btn btn-outline-light mb-3" id="backBtn">← 返回選單</button>

    <div class="kcard kpad mb-3">
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <div class="h5 m-0">用戶登入紀錄</div>
          <div class="text-muted">即時顯示最近登入的使用者（最多 500 筆）</div>
        </div>
        <div class="d-flex gap-2">
          <button id="tabUser"  class="btn btn-outline-light active">用戶登入</button>
          <button id="tabAdmin" class="btn btn-outline-light">管理員登入</button>
        </div>
      </div>
    </div>

    <div class="kcard kpad">
      <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
        <input id="kw"   class="form-control form-control-sm" placeholder="搜尋：姓名 / Email / UID" style="max-width:260px">
        <input id="from" type="date" class="form-control form-control-sm">
        <span class="align-self-center">～</span>
        <input id="to"   type="date" class="form-control form-control-sm">

        <button id="apply" class="btn btn-sm btn-outline-secondary">套用</button>
        <button id="clear" class="btn btn-sm btn-outline-secondary">清除</button>

        <div class="flex-grow-1"></div>
        <button id="csvAll" class="btn btn-sm btn-outline-light">匯出 CSV</button>
      </div>

      <div class="table-responsive">
        <table class="table align-middle">
          <thead>
            <tr>
              <th style="width:180px">時間</th>
              <th style="width:160px">姓名</th>
              <th>Email</th>
              <th style="width:320px">UID</th>
              <th style="width:120px">Provider</th>
              <th>User-Agent</th>
            </tr>
          </thead>
          <tbody id="tbody"><tr><td colspan="6" class="muted">載入中…</td></tr></tbody>
        </table>
      </div>
    </div>
  `;

  $('#backBtn', root).onclick = ()=> location.hash = '#home';

  const refs = {
    tabUser:  $('#tabUser', root),
    tabAdmin: $('#tabAdmin', root),
    kw:    $('#kw', root),
    from:  $('#from', root),
    to:    $('#to', root),
    apply: $('#apply', root),
    clear: $('#clear', root),
    csv:   $('#csvAll', root),
    body:  $('#tbody', root),
  };

  // 狀態
  let currentColl = 'user_logs';  // 'user_logs' | 'admin_logs'
  let cache = [];                 // 目前頁面的快取（用於關鍵字篩選）
  let lastPageCursor = null;      // 若要做分頁可用，這邊先保留

  // 分頁切換（和訂單頁的 tab 一樣）
  refs.tabUser.onclick = ()=>{
    switchTab('user_logs');
  };
  refs.tabAdmin.onclick = ()=>{
    switchTab('admin_logs');
  };

  function switchTab(coll){
    if (currentColl === coll) return;
    currentColl = coll;
    [refs.tabUser, refs.tabAdmin].forEach(btn=>btn.classList.remove('active'));
    (coll === 'user_logs' ? refs.tabUser : refs.tabAdmin).classList.add('active');
    bind(); // 重新載入
  }

  // 查詢構建（和訂單頁一致：依集合 + 日期區間）
  function buildQuery(range){
    const colRef = collection(db, currentColl);
    const wheres = [];
    if (range?.from) wheres.push(where('ts','>=', Timestamp.fromDate(range.from)));
    if (range?.to)   wheres.push(where('ts','<=', Timestamp.fromDate(range.to)));
    return query(colRef, ...wheres, orderBy('ts','desc'));
  }

  // 綁定查詢 + 渲染（與訂單頁節奏相同）
  async function bind(){
    try{
      refs.body.innerHTML = `<tr><td colspan="6" class="muted">載入中…</td></tr>`;

      const from = refs.from.value ? new Date(refs.from.value+'T00:00:00') : null;
      const to   = refs.to.value   ? new Date(refs.to.value  +'T23:59:59') : null;

      const q = buildQuery({from, to});
      const snap = await getDocs(q);

      cache = snap.docs.map(d=>({ id:d.id, v:d.data() || {} }));
      render();

    }catch(e){
      console.error(e);
      refs.body.innerHTML = `<tr><td colspan="6" class="text-danger">讀取失敗：${e.message || e}</td></tr>`;
    }
  }

  function render(){
    const kw = refs.kw.value.trim().toLowerCase();

    let arr = cache;
    if (kw){
      arr = arr.filter(({v})=>{
        return (v.name||'').toLowerCase().includes(kw) ||
               (v.email||'').toLowerCase().includes(kw) ||
               (v.uid||'').toLowerCase().includes(kw);
      });
    }

    if (!arr.length){
      refs.body.innerHTML = `<tr><td colspan="6" class="muted">沒有符合條件的資料</td></tr>`;
      return;
    }

    refs.body.innerHTML = arr.map(({v})=>`
      <tr>
        <td>${toTW(v.ts)}</td>
        <td>${v.name||'-'}</td>
        <td>${v.email||'-'}</td>
        <td class="small">${v.uid||'-'}</td>
        <td class="small">${v.providerId||'-'}</td>
        <td class="small">${(v.userAgent||'').slice(0,180)}</td>
      </tr>
    `).join('');
  }

  // 事件（和訂單頁一致）
  refs.apply.onclick = bind;
  refs.clear.onclick = ()=>{
    refs.kw.value = '';
    refs.from.value = '';
    refs.to.value = '';
    bind();
  };
  refs.kw.oninput = render;

  refs.csv.onclick = async ()=>{
    try{
      refs.csv.disabled = true;

      const header = ['時間','姓名','Email','UID','Provider','UserAgent'];
      const rows = [header];

      const from = refs.from.value ? new Date(refs.from.value+'T00:00:00') : null;
      const to   = refs.to.value   ? new Date(refs.to.value  +'T23:59:59') : null;

      const q = buildQuery({from, to});
      const snap = await getDocs(q);
      snap.forEach(d=>{
        const v = d.data()||{};
        rows.push([
          toTW(v.ts), v.name||'', v.email||'', v.uid||'',
          v.providerId||'', v.userAgent||''
        ]);
      });

      const csv = rows.map(r=>r.map(x=>{
        const s = (x===undefined||x===null)? '' : String(x);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
      }).join(',')).join('\n');

      const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
      const kindLabel = currentColl==='admin_logs' ? 'admin' : 'user';
      a.href = url; a.download = `login-logs-${kindLabel}-${ts}.csv`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);

    }catch(e){
      alert('匯出失敗：'+(e.message||e));
    }finally{
      refs.csv.disabled = false;
    }
  };

  // 初始載入（預設「用戶登入」）
  bind();
  return root;
}
