import { db } from '../firebase.js';
import {
  collection, query, where, orderBy, getDocs, Timestamp
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';

const auth = getAuth();
const $  = (s,r=document)=>r.querySelector(s);
const toTW = ts => ts?.toDate?.()?.toLocaleString('zh-TW',{hour12:false}) ?? '-';

// ======================== 主頁 ========================
export function LoginLogsPage(){
  const root = document.createElement('div');
  root.className = 'container py-3';
  root.innerHTML = `
    <button class="btn btn-outline-light mb-3" id="backBtn">← 返回選單</button>
    <div class="kcard kpad mb-3">
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <div class="h5 m-0">登入紀錄管理</div>
          <div class="text-muted">僅限管理員檢視登入紀錄</div>
        </div>
        <div class="d-flex gap-2">
          <button id="tabUser"  class="btn btn-outline-light active">用戶登入</button>
          <button id="tabAdmin" class="btn btn-outline-light">管理員登入</button>
        </div>
      </div>
    </div>
    <div id="noAuth" class="text-center text-danger mt-5" style="display:none">
      <h4>權限不足</h4>
      <p>您沒有權限檢視此頁面。</p>
    </div>
    <div id="content" class="kcard kpad" style="display:none">
      <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
        <input id="kw" class="form-control form-control-sm" placeholder="搜尋姓名 / Email / UID" style="max-width:260px">
        <input id="from" type="date" class="form-control form-control-sm">
        <span>～</span>
        <input id="to" type="date" class="form-control form-control-sm">
        <button id="apply" class="btn btn-sm btn-outline-secondary">套用</button>
        <button id="clear" class="btn btn-sm btn-outline-secondary">清除</button>
        <div class="flex-grow-1"></div>
        <button id="csvAll" class="btn btn-sm btn-outline-light">匯出 CSV</button>
      </div>
      <div class="table-responsive">
        <table class="table align-middle">
          <thead>
            <tr>
              <th>時間</th><th>姓名</th><th>Email</th><th>UID</th><th>Provider</th><th>User-Agent</th>
            </tr>
          </thead>
          <tbody id="tbody"><tr><td colspan="6" class="text-muted">載入中...</td></tr></tbody>
        </table>
      </div>
    </div>
  `;

  $('#backBtn', root).onclick = ()=> location.hash = '#home';
  const refs = {
    tabUser:  $('#tabUser', root),
    tabAdmin: $('#tabAdmin', root),
    kw:  $('#kw', root),
    from: $('#from', root),
    to:   $('#to', root),
    apply: $('#apply', root),
    clear: $('#clear', root),
    csv: $('#csvAll', root),
    body: $('#tbody', root),
    noAuth: $('#noAuth', root),
    content: $('#content', root)
  };

  let currentColl = 'user_logs';
  let cache = [];

  refs.tabUser.onclick = ()=>{switchTab('user_logs');};
  refs.tabAdmin.onclick = ()=>{switchTab('admin_logs');};

  function switchTab(coll){
    if (currentColl === coll) return;
    currentColl = coll;
    refs.tabUser.classList.toggle('active', coll==='user_logs');
    refs.tabAdmin.classList.toggle('active', coll==='admin_logs');
    bind();
  }

  async function bind(){
    refs.body.innerHTML = `<tr><td colspan="6" class="text-muted">載入中...</td></tr>`;
    try{
      const from = refs.from.value ? new Date(refs.from.value+'T00:00:00') : null;
      const to   = refs.to.value   ? new Date(refs.to.value  +'T23:59:59') : null;
      const col = collection(db, currentColl);
      const wheres = [];
      if (from) wheres.push(where('ts','>=', Timestamp.fromDate(from)));
      if (to)   wheres.push(where('ts','<=', Timestamp.fromDate(to)));
      const q = query(col, ...wheres, orderBy('ts','desc'));
      const snap = await getDocs(q);
      cache = snap.docs.map(d=>d.data());
      render();
    }catch(e){
      refs.body.innerHTML = `<tr><td colspan="6" class="text-danger">讀取失敗：${e.message}</td></tr>`;
    }
  }

  function render(){
    const kw = refs.kw.value.trim().toLowerCase();
    const arr = cache.filter(v =>
      (v.name||'').toLowerCase().includes(kw) ||
      (v.email||'').toLowerCase().includes(kw) ||
      (v.uid||'').toLowerCase().includes(kw)
    );
    if (!arr.length){
      refs.body.innerHTML = `<tr><td colspan="6" class="text-muted">沒有符合條件的資料</td></tr>`;
      return;
    }
    refs.body.innerHTML = arr.map(v=>`
      <tr>
        <td>${toTW(v.ts)}</td>
        <td>${v.name||'-'}</td>
        <td>${v.email||'-'}</td>
        <td>${v.uid||'-'}</td>
        <td>${v.providerId||'-'}</td>
        <td>${(v.userAgent||'').slice(0,120)}</td>
      </tr>
    `).join('');
  }

  refs.apply.onclick = bind;
  refs.clear.onclick = ()=>{ refs.kw.value=''; refs.from.value=''; refs.to.value=''; bind(); };
  refs.kw.oninput = render;

  refs.csv.onclick = ()=>{
    const csv = cache.map(v=>[toTW(v.ts),v.name,v.email,v.uid,v.providerId,v.userAgent].join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${currentColl}-${Date.now()}.csv`;
    a.click();
  };

  // === 權限檢查 ===
  onAuthStateChanged(auth, user=>{
    if (!user || user.email !== 'bruce9811123@gmail.com'){
      refs.noAuth.style.display = 'block';
      refs.content.style.display = 'none';
      return;
    }
    refs.noAuth.style.display = 'none';
    refs.content.style.display = 'block';
    bind();
  });

  return root;
}
