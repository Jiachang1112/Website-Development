// assets/js/pages/login-logs.js
import { db } from '../firebase.js';
import {
  collection, query, where, orderBy, onSnapshot,
  getDocs, startAfter, limit, Timestamp
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
const toTW = ts => {
  try{
    const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
    return d ? d.toLocaleString('zh-TW',{hour12:false}) : '-';
  }catch{ return '-'; }
};

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
    .btn{white-space:nowrap}
  `;
  document.head.appendChild(css);
}

export function LoginLogsPage(){
  stylesOnce();
  const el = document.createElement('div');
  el.className = 'logs-wrap';

  el.innerHTML = `
    <button class="btn btn-outline-light mb-3" id="backBtn">← 返回選單</button>

    <div class="kcard kpad">
      <div class="hd">
        <div>
          <div class="h5 m-0">用戶登入紀錄</div>
          <div class="muted">即時顯示登入的使用者（無上限）</div>
        </div>
        <div class="tabs">
          <div class="tab active" data-kind="user">用戶登入</div>
          <div class="tab" data-kind="admin">管理員登入</div>
        </div>
      </div>

      <div class="toolbar">
        <input id="kw" class="form-control form-control-sm" placeholder="搜尋：姓名 / Email / UID">
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

  $('#backBtn', el).onclick = ()=> location.hash = '#home';

  const refs = {
    tabs: $$('.tab', el),
    kw:   $('#kw', el),
    from: $('#from', el),
    to:   $('#to', el),
    clear:$('#clear', el),
    csv:  $('#csvAll', el),
    body: $('#tbody', el),
  };

  let kind = 'user';
  let unsub = null;
  let cache = [];

  function buildQuery(_kind, range){
    const col = collection(db, 'login_logs');
    const wheres = [ where('kind','==',_kind) ];
    // 日期範圍
    if (range?.from) wheres.push(where('ts','>=', Timestamp.fromDate(range.from)));
    if (range?.to)   wheres.push(where('ts','<=', Timestamp.fromDate(range.to)));
    return query(col, ...wheres, orderBy('ts','desc'));
  }

  function bind(){
    // 解析日期
    const from = refs.from.value ? new Date(refs.from.value+'T00:00:00') : null;
    const to   = refs.to.value   ? new Date(refs.to.value  +'T23:59:59') : null;

    if (unsub) { unsub(); unsub = null; }
    refs.body.innerHTML = `<tr><td colspan="6" class="muted">載入中…</td></tr>`;

    try{
      const q = buildQuery(kind, {from, to});
      unsub = onSnapshot(q, snap=>{
        cache = snap.docs.map(d=>({ id:d.id, v:d.data()||{} }));
        render();
      });
    }catch(e){
      refs.body.innerHTML = `<tr><td colspan="6" class="text-danger">讀取失敗：${e.message}</td></tr>`;
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

  // 事件
  refs.tabs.forEach(t=>{
    t.onclick = ()=>{
      refs.tabs.forEach(x=>x.classList.remove('active'));
      t.classList.add('active');
      kind = t.dataset.kind;
      bind();
    };
  });
  refs.kw.oninput  = render;
  refs.clear.onclick = ()=>{
    refs.kw.value=''; refs.from.value=''; refs.to.value='';
    bind();
  };

  // 匯出「全部」（自動分頁抓完）
  refs.csv.onclick = async ()=>{
    refs.csv.disabled = true;
    try{
      const header = ['時間','姓名','Email','UID','Provider','UserAgent'];
      const rows = [header];

      const from = refs.from.value ? new Date(refs.from.value+'T00:00:00') : null;
      const to   = refs.to.value   ? new Date(refs.to.value  +'T23:59:59') : null;

      let q = buildQuery(kind, {from, to});
      let last = null;
      while (true){
        const page = last ? await getDocs(query(q, startAfter(last), limit(1000)))
                          : await getDocs(query(q, limit(1000)));
        if (page.empty) break;
        page.forEach(d=>{
          const v = d.data()||{};
          rows.push([
            toTW(v.ts), v.name||'', v.email||'', v.uid||'', v.providerId||'', v.userAgent||''
          ]);
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
      a.href = url; a.download = `login-logs-${kind}-${ts}.csv`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    }finally{
      refs.csv.disabled = false;
    }
  };

  bind(); // 首次載入（用戶）
  return el;
}
