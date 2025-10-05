// assets/js/pages/admin-userlog.js
// 後台「用戶登入」頁（只有管理員可見）：兩個切換鈕（用戶登入 / 管理員登入），顯示各自的登入紀錄。

import { auth, db } from '../firebase.js';
import {
  onAuthStateChanged,
  getRedirectResult,
  signOut,
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';

import {
  collection, query, where, orderBy, limit, getDocs, startAfter
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

/* ───── 白名單（和你後台一致） ───── */
const ADMIN_EMAILS = ['bruce9811123@gmail.com'].map(s => s.trim().toLowerCase());
const ADMIN_UIDS = []; // 需要可填
const isAdminUser = (user) => {
  if (!user) return false;
  const email = (user.email || '').trim().toLowerCase();
  const uid = user.uid || '';
  return ADMIN_UIDS.includes(uid) || ADMIN_EMAILS.includes(email);
};

/* ───── 小工具 ───── */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const toTW = ts => {
  try {
    const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
    return d ? d.toLocaleString('zh-TW',{hour12:false}) : '-';
  } catch { return '-'; }
};

function ensureStyles(){
  if ($('#userlog-css')) return;
  const css = document.createElement('style');
  css.id = 'userlog-css';
  css.textContent = `
    :root{
      --bg:#0f1318; --fg:#e6e6e6; --muted:#9aa3af; --card:#151a21; --border:#2a2f37;
    }
    body{background:var(--bg); color:var(--fg)}
    .shell{max-width:1100px; margin:24px auto; padding:0 16px}
    .kcard{background:var(--card); border:1px solid var(--border); border-radius:16px}
    .pad{padding:16px}
    .hd{display:flex; align-items:center; justify-content:space-between; margin-bottom:12px}
    .tabs{display:flex; gap:8px; flex-wrap:wrap}
    .tab{border:1px solid var(--border); border-radius:999px; padding:.4rem .9rem; cursor:pointer; user-select:none}
    .tab.active{outline:2px solid rgba(255,255,255,.2)}
    .list{display:flex; flex-direction:column; gap:10px}
    .row{display:flex; justify-content:space-between; align-items:center; padding:12px; border:1px solid var(--border); border-radius:12px}
    .meta{color:var(--muted); font-size:13px}
    .btn-outline{border:1px solid var(--border); background:transparent; color:var(--fg); border-radius:10px; padding:.4rem .7rem}
    .btn-outline:hover{opacity:.9}
    .more-wrap{display:flex; justify-content:center; margin-top:12px}
  `;
  document.head.appendChild(css);
}

function renderFrame(root){
  root.innerHTML = `
    <div class="shell">
      <div class="kcard pad mb-3">
        <div class="hd">
          <div>
            <div class="fw-bold">用戶登入紀錄</div>
            <div class="meta">此頁只有管理員可以看到。點選下方分類查看不同來源的登入紀錄。</div>
          </div>
          <div class="d-flex gap-2">
            <a class="btn btn-outline" href="/admin/index.html">回後台首頁</a>
            <button id="btnLogout" class="btn btn-outline">登出</button>
          </div>
        </div>
        <div class="tabs">
          <span class="tab active" data-kind="user">用戶登入</span>
          <span class="tab" data-kind="admin">管理員登入</span>
        </div>
      </div>

      <div class="kcard pad">
        <div id="listWrap">
          <div class="meta">載入中…</div>
        </div>
        <div class="more-wrap">
          <button id="btnMore" class="btn btn-outline" style="display:none">載入更多</button>
        </div>
      </div>
    </div>
  `;
}

/* 分頁器：每次抓 100 筆，可無限往後 */
function createPager(kind){
  const pageSize = 100;
  let lastDoc = null;
  let reachedEnd = false;

  async function loadNext(){
    if (reachedEnd) return { docs:[], done:true };

    let qRef = query(
      collection(db,'login_logs'),
      where('kind','==', kind),
      orderBy('at','desc'),
      limit(pageSize)
    );

    if (lastDoc){
      qRef = query(
        collection(db,'login_logs'),
        where('kind','==', kind),
        orderBy('at','desc'),
        startAfter(lastDoc),
        limit(pageSize)
      );
    }

    const snap = await getDocs(qRef);
    if (snap.empty){
      reachedEnd = true;
      return { docs:[], done:true };
    }
    lastDoc = snap.docs[snap.docs.length-1];
    return { docs:snap.docs, done:false };
  }

  return { loadNext };
}

function renderRows(container, docs, append=false){
  const rows = docs.map(d=>{
    const v = d.data() || {};
    const name = v.displayName || '(無名稱)';
    const email = v.email || '(無 email)';
    const uid = v.uid || '';
    const time = toTW(v.at);
    const ua = v.ua || '';
    return `
      <div class="row">
        <div>
          <div class="fw-semibold">${name} <span class="meta">｜ ${email}</span></div>
          <div class="meta">UID：${uid}</div>
        </div>
        <div class="text-end">
          <div>${time}</div>
          <div class="meta">${ua}</div>
        </div>
      </div>
    `;
  }).join('');

  if (append) container.insertAdjacentHTML('beforeend', rows);
  else container.innerHTML = rows || `<div class="meta">目前沒有資料</div>`;
}

/* 主流程 */
(async function main(){
  ensureStyles();
  const root = $('#app');
  root.innerHTML = `<div class="shell"><div class="kcard pad">檢查身分中…</div></div>`;

  try { await getRedirectResult(auth); } catch {}

  onAuthStateChanged(auth, async (user)=>{
    if (!user){
      root.innerHTML = `<div class="shell"><div class="kcard pad">請先登入後台（管理員）</div></div>`;
      return;
    }
    if (!isAdminUser(user)){
      root.innerHTML = `<div class="shell"><div class="kcard pad text-danger">你不符合管理員帳號，無法檢視此頁。</div></div>`;
      return;
    }

    renderFrame(root);

    $('#btnLogout')?.addEventListener('click', async ()=>{
      try { await signOut(auth); location.href='/'; } catch(e){ alert(e.message); }
    });

    const listWrap = $('#listWrap');
    const btnMore = $('#btnMore');
    let currentKind = 'user';
    let pager = createPager(currentKind);

    async function firstLoad(){
      listWrap.innerHTML = `<div class="meta">載入中…</div>`;
      pager = createPager(currentKind);
      const { docs, done } = await pager.loadNext();
      renderRows(listWrap, docs, false);
      btnMore.style.display = done ? 'none' : 'inline-block';
    }

    // 切換 tab
    $$('.tab', root).forEach(t=>{
      t.addEventListener('click', async ()=>{
        $$('.tab', root).forEach(x=>x.classList.remove('active'));
        t.classList.add('active');
        currentKind = t.dataset.kind; // 'user' | 'admin'
        await firstLoad();
      });
    });

    // 載入更多
    btnMore.addEventListener('click', async ()=>{
      btnMore.disabled = true;
      const { docs, done } = await pager.loadNext();
      renderRows(listWrap, docs, true);
      btnMore.style.display = done ? 'none' : 'inline-block';
      btnMore.disabled = false;
    });

    // 初始載入 user
    await firstLoad();
  });
})();
