// assets/js/pages/expense-analysis.js
import { auth, db } from '../firebase.js';
import {
  collection, query, where, getDocs, orderBy
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

// ===============================
// 主函式
// ===============================
export async function ExpenseAnalysisPage() {
  const mount = document.querySelector('#app') || document.body;
  mount.innerHTML = `
    <section class="content-card">
      <h2>記帳｜分析</h2>
      <div style="margin-bottom:12px;">
        <label>月份：</label>
        <input type="month" id="monthPicker" value="${new Date().toISOString().slice(0,7)}" />
        <button id="btnExpense" class="btn">支出</button>
        <button id="btnIncome" class="btn">收入</button>
      </div>
      <canvas id="chartCanvas" width="600" height="400" style="background:#0f172a;border-radius:12px;padding:16px"></canvas>
      <div id="summary" style="margin-top:12px;color:#fff"></div>
    </section>
  `;

  const canvas = document.getElementById('chartCanvas');
  const ctx = canvas.getContext('2d');
  const type = { mode: 'expense' };
  const btnExpense = document.getElementById('btnExpense');
  const btnIncome = document.getElementById('btnIncome');
  const monthInput = document.getElementById('monthPicker');

  btnExpense.onclick = ()=>{ type.mode='expense'; loadAndDraw(); };
  btnIncome.onclick = ()=>{ type.mode='income'; loadAndDraw(); };
  monthInput.onchange = ()=>loadAndDraw();

  async function loadAndDraw() {
    const user = auth.currentUser;
    if(!user){
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = '#fff';
      ctx.fillText('請先登入帳號', 50, 50);
      return;
    }

    const UID = user.uid;
    const monthStr = monthInput.value; // "2025-10"
    const start = new Date(monthStr + "-01T00:00:00");
    const end = new Date(start);
    end.setMonth(end.getMonth()+1);

    // 找出該使用者的預設帳本
    const ledgersSnap = await getDocs(collection(db, 'users', UID, 'ledgers'));
    if (ledgersSnap.empty){
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.fillText('尚未建立帳本',50,50);
      return;
    }
    const ledgerId = ledgersSnap.docs[0].id;

    const txRef = collection(db, 'users', UID, 'ledgers', ledgerId, 'transactions');
    const qy = query(txRef, where('date','>=',start), where('date','<',end), orderBy('date','asc'));
    const snap = await getDocs(qy);

    const list = [];
    snap.forEach(doc=>{
      const v = doc.data();
      if(type.mode==='expense' && v.type==='支出') list.push(v);
      if(type.mode==='income' && v.type==='收入') list.push(v);
    });

    // --- 分類統計 ---
    const stats = {};
    list.forEach(v=>{
      const cat = v.category || '未分類';
      stats[cat] = (stats[cat]||0) + Number(v.amount||0);
    });

    const total = Object.values(stats).reduce((a,b)=>a+b,0);
    const summaryEl = document.getElementById('summary');
    summaryEl.innerHTML = `總額：NT$ ${total.toLocaleString()} （${list.length} 筆）`;

    drawDonut(ctx, stats);
  }

  loadAndDraw();
}

// ===============================
// Donut 圖
// ===============================
function drawDonut(ctx, stats){
  const colors = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#22d3ee'];
  const total = Object.values(stats).reduce((a,b)=>a+b,0);
  const cx = 300, cy = 200, r = 120;
  let start = -Math.PI/2;

  ctx.clearRect(0,0,600,400);
  if(total === 0){
    ctx.fillStyle='#fff';
    ctx.font='18px system-ui';
    ctx.fillText('這個月沒有資料',220,210);
    return;
  }

  let i=0;
  for(const [cat, val] of Object.entries(stats)){
    const angle = (val/total)*Math.PI*2;
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,r,start,start+angle);
    ctx.closePath();
    ctx.fillStyle = colors[i++ % colors.length];
    ctx.fill();
    start += angle;
  }

  // 中心文字
  ctx.fillStyle='#fff';
  ctx.font='bold 20px system-ui';
  ctx.textAlign='center';
  ctx.fillText(`總額 ${total.toLocaleString()}`, cx, cy);
}
