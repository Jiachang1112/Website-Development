// assets/js/pages/admin.js
import { isAdmin, fmt } from '../app.js';
import { db } from '../firebase.js';
import {
  collection, doc, getDocs, query, orderBy, limit
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

export function AdminPage() {
  const el = document.createElement('div');
  el.className = 'container';

  el.innerHTML = `
    <section class="card">
      <h3>後台｜用戶記帳</h3>

      <div id="guard" class="small" style="display:none">
        僅管理員可檢視此頁。
      </div>

      <div class="row" id="toolbar" style="display:none">
        <div>
          <label class="small">用戶（email）</label>
          <select id="userSel"></select>
        </div>
        <div>
          <label class="small">載入筆數</label>
          <select id="limitSel">
            <option>20</option>
            <option selected>50</option>
            <option>100</option>
          </select>
        </div>
      </div>

      <div id="result" class="small"></div>
      <div id="list"></div>
    </section>
  `;

  const guard = el.querySelector('#guard');
  const toolbar = el.querySelector('#toolbar');
  const userSel = el.querySelector('#userSel');
  const limitSel = el.querySelector('#limitSel');
  const result  = el.querySelector('#result');
  const list    = el.querySelector('#list');

  // 只有管理員能看
  if (!isAdmin()) {
    guard.style.display = 'block';
    return el;
  }
  toolbar.style.display = 'flex';

  // 載入所有 user（= expenses 底下的文件 id）
  async function loadUsers() {
    result.textContent = '載入用戶中…';
    list.innerHTML = '';
    userSel.innerHTML = '';

    const snap = await getDocs(collection(db, 'expenses'));
    const users = snap.docs.map(d => d.id).sort((a,b)=>a.localeCompare(b));

    if (users.length === 0) {
      result.textContent = '目前沒有任何用戶。';
      return;
    }

    // 塞選單
    userSel.innerHTML = users.map(e => `<option value="${e}">${e}</option>`).join('');
    result.textContent = `共 ${users.length} 位用戶。`;

    // 預設載入第一位使用者的紀錄
    await loadEntries(userSel.value);
  }

  // 載入某位使用者的 entries（最近 N 筆）
  async function loadEntries(email) {
    list.innerHTML = '';
    result.textContent = `載入 ${email} 的紀錄中…`;

    const n = Number(limitSel.value || 50);
    const qy = query(
      collection(doc(db, 'expenses', email), 'entries'),
      orderBy('date', 'desc'),
      limit(n)
    );
    const snap = await getDocs(qy);
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (rows.length === 0) {
      result.textContent = `${email} 目前沒有紀錄。`;
      list.innerHTML = '';
      return;
    }

    // 統計
    const out = rows.filter(r => r.type !== 'income')
                    .reduce((s,r)=>s + (Number(r.amount)||0), 0);
    const inc = rows.filter(r => r.type === 'income')
                    .reduce((s,r)=>s + (Number(r.amount)||0), 0);

    result.innerHTML = `
      <div class="row">
        <span class="badge">用戶：${email}</span>
        <span class="badge">顯示：${rows.length} 筆</span>
        <span class="badge">支出：${fmt.money(out)}</span>
        <span class="badge">收入：${fmt.money(inc)}</span>
        <span class="badge">結餘：${fmt.money(inc - out)}</span>
      </div>
    `;

    // 列表
    list.innerHTML = rows.map(r => {
      const typeTxt = r.type === 'income' ? '收入' : '支出';
      const amt = r.type === 'income'
        ? Number(r.amount)||0
        : -Math.abs(Number(r.amount)||0);
      const cat = r.categoryId || '';
      const note = r.note || '';
      const date = r.date || '';

      return `
        <div class="order-row">
          <div>
            <b>${date}</b>
            <span class="badge">${typeTxt}</span>
            <div class="small">${cat}｜${note}</div>
          </div>
          <div>${fmt.money(amt)}</div>
        </div>
      `;
    }).join('');
  }

  // 事件
  userSel.addEventListener('change', () => loadEntries(userSel.value));
  limitSel.addEventListener('change', () => loadEntries(userSel.value));

  // 啟動
  loadUsers().catch(err => {
    console.error(err);
    result.textContent = '讀取失敗：' + err.message;
  });

  return el;
}
