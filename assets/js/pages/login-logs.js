// assets/js/pages/login-logs.js
// 只讀取 user_logs / admin_logs 兩個集合，和 UI 分頁同步

import { auth, db } from '../firebase.js';
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';
import {
  collection, query, orderBy, onSnapshot,
  getDocs, startAfter, limit, Timestamp, where
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
const toTW = ts => {
  try{
    const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
    return d ? d.toLocaleString('zh-TW',{hour12:false}) : '-';
  }catch{ return '-'; }
};

/* ========= 你的管理員白名單 ========= */
const ADMIN_EMAILS = ['bruce9811123@gmail.com'];
function isAdminUser(user){
  const email = (user?.email || '').trim().toLowerCase();
  return !!email && ADMIN_EMAILS.includes(email);
}

/* ========= 樣式 ========= */
function stylesOnce(){
  if ($('#login-logs-css')) return;
  const css = document.createElement('style');
  css.id = 'login-logs-css';
  css.textContent = `
    .logs-wrap{max-width:1200px;margin:20px auto;padding:0 16px}
    .kcard{background:var(--card,#151a21);border:1px solid var(--border,#2a2f37);
          border-radius:16px;box-shadow:0 6px 24px rgba(0,0,0,.25),0 2px 8px rgba(0,0,0,.2)}
    .kpad{padding:16px}
    .hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
    .tabs{display:flex;gap:8px}
    .tab{border:1px solid var(--border,#2a2f37);border-radius:999px;padding:.35rem .8rem;cursor:pointer}
    .tab.active{outline:2px solid rgba(255,255,255,.25)}
    .toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
    .table{width:100%}
    .table th,.table td{padding:.6rem .75rem;border-bottom:1px solid var(--border,#2a2f37)}
    .muted{color:var(--muted,#9aa3af)}
  `;
  document.head.appendChild(css);
}

/* ========= 主頁面（含權限檢查） ========= */
export function LoginLogsPage(){
  stylesOnce();

  const root = document.createElement('div');
  root.className = 'logs-wrap';
  root.innerHTML = `
    <div class="kcard kpad" id="gate">
      <div class="h5 m-0">帳號</div>
      <div class="muted" id="gateTip">載入中…</div>
      <div class="mt-3 d-flex gap-2">
        <button class="btn btn-primary" id="btnGoogle" style="display:none">使用 Google 登入</button>
        <button class="btn btn-outline-light" id="btnBack" style="display:none">回首頁</button>
      </div>
    </div>
    <div id="page" style="display:none"></div>
  `;

  const gate     = $('#gate', root);
  const gateTip  = $('#gateTip', root);
  const btnLogin = $('#btnGoogle', root);
  const btnBack  = $('#btnBack', root);
  const pageHost = $('#page', root);

  btnBack.onclick = ()=> location.hash = '#home';

  const provider = new GoogleAuthProvider();
  btnLogin.onclick = async ()=>{
    try{ await signInWithPopup(auth, provider); }
    catch(e){ gateTip.textContent = e.message || '登入失敗'; }
  };

  onAuthStateChanged(auth, (user)=>{
    if (!user){
      gateTip.textContent = '請先使用 Google 登入才能查看此頁';
      btnLogin.style.display = '';
      btnBack.style.display  = '';
      pageHost.style.display = 'none';
      gate.style.display     = '';
      return;
    }
    if (!isAdminUser(user)){
      gateTip.textContent = '你沒有權限查看此頁（僅限管理員）。';
      btnLogin.style.display = 'none';
      btnBack.style.display  = '';
      pageHost.style.display = 'none';
      gate.style.display     = '';
      return;
    }
    // 通過管理員檢查 → 渲染真正頁面
    gate.style.display     = 'none';
    pageHost.style.display = '';
    renderLogsUI(pageHost);
  });

  return root;
}

/* ========= 真正的紀錄頁 UI ========= */
function renderLogsUI(host){
  host.innerHTML = `
    <button class="btn btn-outline-light mb-3" id="backBtn">← 返回選單</button>

    <div class="kcard kpad">
      <div class="hd">
        <div>
          <div class="h5 m-0">登入紀錄</div>
          <div class="muted">即時顯示登入的使用者（無上限）</div>
        </div>
        <div class="tabs">
          <div class="tab active" data-coll="user_logs">用戶登入</div>
          <div class="tab" data-coll="admin_logs">管理員登入</div>
        </div>
      </div>

      <div class="toolbar">
        <input id="kw"   class="form-control form-control-sm" placeholder="搜尋：姓名 / Email / UID">
        <input id="from" type="date" class="form-control form-control-sm">
        <span class="align-self-center">～</span>
        <input id="to"   type="date" class="form-control form-control-sm">
        <button id="clear" class="btn btn-sm btn-outline-secondary">清除</button>
        <div class="flex-grow-1"></div>
        <button id="csvAll" class="btn btn-sm btn-outline-light">匯出 CSV（全部）</button>
      </div>

      <div class="table-responsive">
        <table class="table align-middle">
          <thead>
            <tr>
              <th style="width:180px">時間</th>
              <th style="width:160px">姓名</th>
              <th>Email</th>
              <th style="width:320px">UID</th>
              <th style="width:140px">Provider</th>
              <th>User-Agent</th>
            </tr>
          </thead>
          <tbody id="tbody"><tr><td colspan="6" class="muted">載入中…</td></tr></tbody>
        </table>
      </div>
    </div>
  `;

  $('#backBtn', host).onclick = ()=> location.hash = '#home';

  const refs = {
    tabs: $$('.tab', host),
    kw:   $('#kw', host),
    from: $('#from', host),
    to:   $('#to', host),
    clear:$('#clear', host),
    csv:  $('#csvAll', host),
    body: $('#tbody', host),
  };

  let currentColl = 'user_logs';   // ← 預設讀 user_logs
  let unsub = null;
  let cache = [];

  // 依集合＆日期組出查詢（完全不再看 kind）
  function buildQuery(range){
    const colRef = collection(db, currentColl);
    const wheres = [];
    if (range?.from) wheres.push(where('ts','>=', Timestamp.fromDate(range.from)));
    if (range?.to)   wheres.push(where('ts','<=', Timestamp.fromDate(range.to)));
    return query(colRef, ...wheres, orderBy('ts','desc'));
  }

  function bind(){
    const from = refs.from.value ? new Date(refs.from.value+'T00:00:00') : null;
    const to   = refs.to.value   ? new Date(refs.to.value  +'T23:59:59') : null;

    if (unsub) { unsub(); unsub = null; }
    refs.body.innerHTML = `<tr><td colspan="6" class="muted">載入中…</td></tr>`;

    try{
      const q = buildQuery({from, to});
      unsub = onSnapshot(q, snap=>{
        cache = snap.docs.map(d=>({ id:d.id, v:d.data()||{} }));
        render();
      }, err=>{
        console.error('[login-logs]', err.code, err.message);
        refs.body.innerHTML = `<tr><td colspan="6" class="text-danger">
          讀取失敗：${err.code||''} ${err.message||''}
        </td></tr>`;
      });
    }catch(e){
      console.error('[login-logs]', e);
      refs.body.innerHTML = `<tr><td colspan="6" class="text-danger">
        讀取失敗：${e.message||e}
      </td></tr>`;
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
      refs.body.innerHTML = `<tr><td colspan="6" class="muted">沒有資料</td></tr>`;
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

  // tab 切換 → 換集合 → 重新綁定
  refs.tabs.forEach(t=>{
    t.onclick = ()=>{
      refs.tabs.forEach(x=>x.classList.remove('active'));
      t.classList.add('active');
      currentColl = t.dataset.coll; // 'user_logs' 或 'admin_logs'
      bind();
    };
  });

  refs.kw.oninput  = render;
  refs.clear.onclick = ()=>{
    refs.kw.value=''; refs.from.value=''; refs.to.value='';
    bind();
  };

  // 匯出全部（依目前選擇的集合與日期範圍）
  refs.csv.onclick = async ()=>{
    refs.csv.disabled = true;
    try{
      const header = ['時間','姓名','Email','UID','Provider','UserAgent'];
      const rows = [header];

      const from = refs.from.value ? new Date(refs.from.value+'T00:00:00') : null;
      const to   = refs.to.value   ? new Date(refs.to.value  +'T23:59:59') : null;

      let q = buildQuery({from, to});
      let last = null;
      while (true){
        const page = last ? await getDocs(query(q, startAfter(last), limit(1000)))
                          : await getDocs(query(q, limit(1000)));
        if (page.empty) break;
        page.forEach(d=>{
          const v = d.data()||{};
          rows.push([ toTW(v.ts), v.name||'', v.email||'', v.uid||'', v.providerId||'', v.userAgent||'' ]);
        });
        last = page.docs[page.docs.length-1];
        if (page.size < 1000) break;
      }

      const csv = rows.map(r=>r.map(x=>{
        const s = (x===undefined||x===null)? '' : String(x);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
      }).join(',')).join('\n');

      const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
      a.href = url; a.download = `login-logs-${currentColl}-${ts}.csv`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    }finally{
      refs.csv.disabled = false;
    }
  };

  bind(); // 預設載入「用戶登入」= user_logs
}
