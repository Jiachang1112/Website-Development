// assets/js/pages/expense-analysis.js
// 修改：改用 getEntriesRange 讀取多帳本資料，並整合 auth 監聽

import { getEntriesRange } from '../entries.js'; // ✅ 改用新函式
import { auth } from '../firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';

// ✅ (美化) 繽紛的調色盤
const COLOR_PALETTE = [
  '#3b82f6', // blue-500
  '#10b981', // green-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-500
  '#ec4899', // pink-500
  '#6366f1', // indigo-500
  '#84cc16', // lime-500
];

// ✅ 日期小工具
function pad2(n) { return String(n).padStart(2, '0'); }

// ✅ 填充年份下拉選單
function fillYears(ySel) {
  const frag = document.createDocumentFragment();
  for (let y = 2020; y <= 3000; y++) {
    const o = document.createElement('option');
    o.value = String(y); o.textContent = String(y);
    frag.appendChild(o);
  }
  ySel.appendChild(frag);
}

// ✅ 填充月份下拉選單 (含「不指定」)
function fillMonths(mSel) {
  const o = document.createElement('option');
  o.value = ''; o.textContent = '不指定月份 (整年)';
  mSel.appendChild(o);
  
  const frag = document.createDocumentFragment();
  for (let m = 1; m <= 12; m++) {
    const o = document.createElement('option');
    o.value = pad2(m); o.textContent = pad2(m);
    frag.appendChild(o);
  }
  mSel.appendChild(frag);
}

function drawDonut(canvas, rows) {
  const ctx = canvas.getContext('2d');
  // RWD: 讓 canvas 寬度跟隨容器
  const W = canvas.width = canvas.parentElement.clientWidth || 300;
  const H = canvas.height = 300;
  
  const cx = W / 2, cy = H / 2;
  const r = Math.min(W, H) / 2 - 10;
  const total = rows.reduce((s, d) => s + d.value, 0) || 1;
  let a = -Math.PI / 2;

  // 清空畫布
  ctx.clearRect(0, 0, W, H);

  rows.forEach((d, i) => {
    const ang = d.value / total * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a, a + ang);
    ctx.closePath();
    ctx.fillStyle = COLOR_PALETTE[i % COLOR_PALETTE.length]; // ✅ (美化)
    ctx.fill();
    a += ang;
  });

  // 中心空洞
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  ctx.fill();

  // 中心文字
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#cbd5e1'; // ✅ (美化)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 14px system-ui'; 
  ctx.fillText('總額', cx, cy - 12);
  
  ctx.fillStyle = '#f1f5f9'; // ✅ (美化)
  ctx.font = '700 22px system-ui'; 
  ctx.fillText(total.toLocaleString(), cx, cy + 14);
}

function createLegend(rows) {
  return `<div class="legend" style="margin:10px 0;display:flex;flex-wrap:wrap;gap:8px;">
    ${rows.map((r, i) =>
      `<span style="display:flex;align-items:center;gap:4px; font-size:0.9rem;">
        <span style="width:12px;height:12px;background:${COLOR_PALETTE[i % COLOR_PALETTE.length]};display:inline-block;border-radius:2px;"></span>
        ${r.label}
      </span>`
    ).join('')}
  </div>`;
}

export function ExpenseAnalysisPage() {
  const el = document.createElement('div');
  el.className = 'container card';
  const now = new Date();
  const y0 = now.getFullYear(), m0 = now.getMonth() + 1;

  el.innerHTML = `
    <h3>記帳｜分析</h3>
    <div class="row" style="flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
      <label class="small" style="display:flex;align-items:center;">日期</label>
      <select id="y" class="form-control" style="min-width:100px"></select>
      <select id="m" class="form-control" style="min-width:100px"></select>
      
      <div style="flex-basis: 100%; height: 0; margin: 0;"></div> <div style="display:flex; gap:8px; width:100%;">
        <button class="btn btn-primary" id="tabOut" style="flex:1;">支出</button>
        <button class="btn btn-outline-light" id="tabIn" style="flex:1; border:1px solid #475569;">收入</button>
      </div>
    </div>
    
    <div style="position:relative; width:100%; max-width:400px; margin:0 auto;">
       <canvas id="chart" style="width:100%;height:300px"></canvas>
    </div>
    
    <div id="tbl" style="margin-top:20px;"></div>
  `;

  const ySel = el.querySelector('#y');
  const mSel = el.querySelector('#m');
  const chart = el.querySelector('#chart');
  const tbl = el.querySelector('#tbl');
  const tabOut = el.querySelector('#tabOut');
  const tabIn = el.querySelector('#tabIn');

  let mode = 'out'; // 'out' | 'in'
  
  // 初始化選單
  fillYears(ySel);
  fillMonths(mSel);
  ySel.value = String(y0);
  mSel.value = pad2(m0);

  async function render() {
    const user = auth.currentUser;
    if (!user) {
      tbl.innerHTML = '<p class="small text-center muted">請先登入帳號</p>';
      // 清空圖表
      const ctx = chart.getContext('2d');
      ctx.clearRect(0, 0, chart.width, chart.height);
      return;
    }

    // ✅ 準備查詢參數
    const yearVal = ySel.value;
    const monthVal = mSel.value; 
    let from, to;
    let timeRangeText = '';

    if (monthVal) {
      // 月模式
      timeRangeText = `${yearVal}年${monthVal}月`;
      from = `${yearVal}-${monthVal}-01`;
      // 計算該月最後一天
      const lastDay = new Date(yearVal, Number(monthVal), 0).getDate();
      to = `${yearVal}-${monthVal}-${pad2(lastDay)}`;
    } else {
      // 年模式
      timeRangeText = `${yearVal}年`;
      from = `${yearVal}-01-01`;
      to = `${yearVal}-12-31`;
    }

    tbl.innerHTML = '<div class="small muted text-center">載入分析中...</div>';

    // ✅ 呼叫新函式抓取所有帳本資料
    const allEntries = await getEntriesRange(from, to);

    // 過濾 支出/收入
    const targetType = (mode === 'out' ? 'expense' : 'income');
    const list = allEntries.filter(r => r.type === targetType);

    if (list.length === 0) {
      chart.getContext('2d').clearRect(0, 0, chart.width, chart.height);
      tbl.innerHTML = `<p style="text-align:center;margin-top:2em;" class="muted">${timeRangeText} 無 ${mode === 'out' ? '支出' : '收入'} 資料</p>`;
      return;
    }

    // 統計分類
    const by = {};
    list.forEach(x => {
      const k = x.categoryId || '其他';
      by[k] = (by[k] || 0) + (+x.amount || 0);
    });

    const rows = Object.entries(by)
      .sort((a, b) => b[1] - a[1]) // 金額大到小
      .map(([k, v]) => ({ label: k, value: v }));

    const total = rows.reduce((s, d) => s + d.value, 0);

    // 繪圖
    drawDonut(chart, rows);

    // 繪製表格
    tbl.innerHTML = `
      ${createLegend(rows)}
      <table style="width:100%; margin-top:10px; font-size:0.95rem;">
        <thead style="border-bottom:1px solid #374151; color:#94a3b8;">
          <tr>
            <th style="text-align:left; padding:8px;">分類</th>
            <th style="text-align:right; padding:8px;">金額</th>
            <th style="text-align:right; padding:8px;">占比</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr style="border-bottom:1px solid #1f2937;">
              <td style="padding:8px;">${r.label}</td>
              <td style="text-align:right; padding:8px;">${Math.round(r.value).toLocaleString()}</td>
              <td style="text-align:right; padding:8px;">${((r.value / total) * 100).toFixed(1)}%</td>
            </tr>`).join('')}
        </tbody>
        <tfoot style="font-weight:bold; color:#fff; border-top:1px solid #475569;">
          <tr>
            <td style="padding:8px;">總計</td>
            <td style="text-align:right; padding:8px;">${Math.round(total).toLocaleString()}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    `;
  }

  // 事件監聽
  ySel.addEventListener('change', render);
  mSel.addEventListener('change', render);

  tabOut.addEventListener('click', () => {
    mode = 'out';
    tabOut.className = 'btn btn-primary';
    tabIn.className = 'btn btn-outline-light';
    tabIn.style.border = '1px solid #475569';
    render();
  });
  tabIn.addEventListener('click', () => {
    mode = 'in';
    tabIn.className = 'btn btn-primary';
    tabIn.style.border = 'none';
    tabOut.className = 'btn btn-outline-light';
    render();
  });

  // ✅ 確保登入後自動載入
  onAuthStateChanged(auth, (user) => {
    if(user) render();
    else tbl.innerHTML = '<p class="small text-center muted">請先登入帳號</p>';
  });

  return el;
}
