// assets/js/pages/expense-analysis.js
import { getAll } from '../db.js';

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

// ✅ (新增) 拷貝日期小工具
function pad2(n) { return String(n).padStart(2, '0'); }
function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }

// ✅ (新增) 填充年份下拉選單
function fillYears(ySel) {
  const frag = document.createDocumentFragment();
  for (let y = 2020; y <= 3000; y++) {
    const o = document.createElement('option');
    o.value = String(y); o.textContent = String(y);
    frag.appendChild(o);
  }
  ySel.appendChild(frag);
}

// ✅ (新增) 填充月份下拉選單 (含「不指定」)
function fillMonths(mSel) {
  const o = document.createElement('option');
  o.value = ''; o.textContent = '不指定月份';
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
  const W = canvas.width = canvas.clientWidth || 300;
  const H = canvas.height = 300;
  const cx = W / 2, cy = H / 2;
  const r = Math.min(W, H) / 2 - 10;
  const total = rows.reduce((s, d) => s + d.value, 0) || 1;
  let a = -Math.PI / 2;

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
  ctx.font = '700 14px system-ui'; // ✅ (美化)
  ctx.fillText('總額', cx, cy - 10);
  
  ctx.fillStyle = '#f1f5f9'; // ✅ (美化)
  ctx.font = '700 22px system-ui'; // ✅ (美化)
  ctx.fillText(total.toFixed(0), cx, cy + 14);
}

function createLegend(rows) {
  return `<div class="legend" style="margin:10px 0;display:flex;flex-wrap:wrap;gap:8px;">
    ${rows.map((r, i) =>
      `<span style="display:flex;align-items:center;gap:4px;">
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

  // ✅ (修改) 更新 HTML，使用 <select> 替換 <input type="month">
  el.innerHTML = `
    <h3>記帳｜分析</h3>
    <div class="row" style="flex-wrap: wrap; gap: 8px;">
      <label class="small">日期</label>
      <select id="y" class="form-control" style="min-width:110px"></select>
      <select id="m" class="form-control" style="min-width:110px"></select>
      
      <div style="flex-basis: 100%; height: 0; margin: 4px 0;"></div> <button class="ghost" id="tabOut" aria-pressed="true">支出</button>
      <button class="ghost" id="tabIn" aria-pressed="false">收入</button>
    </div>
    <canvas id="chart" style="width:100%;height:260px"></canvas>
    <div id="tbl"></div>
  `;

  // ✅ (修改) 抓取新的 UI 元素
  const ySel = el.querySelector('#y');
  const mSel = el.querySelector('#m');
  const chart = el.querySelector('#chart');
  const tbl = el.querySelector('#tbl');
  const tabOut = el.querySelector('#tabOut');
  const tabIn = el.querySelector('#tabIn');

  let mode = 'out';
  
  // ✅ (新增) 初始化日期下拉選單
  fillYears(ySel);
  fillMonths(mSel);
  ySel.value = String(y0);
  mSel.value = pad2(m0);

  async function render() {
    const [e, i] = await Promise.all([getAll('expenses'), getAll('incomes')]);
    
    // ✅ (修改) 根據下拉選單的值來決定過濾邏輯
    const yearVal = ySel.value;
    const monthVal = mSel.value; // "不指定" 時會是 ""
    let timeRangeText = '';

    const list = (mode === 'out' ? e : i).filter(x => {
      const date = x.date || '';
      if (monthVal) {
        // --- 月檢視 ---
        // monthVal 是 "11"，yearVal 是 "2025"
        timeRangeText = '本月';
        return date.slice(0, 7) === `${yearVal}-${monthVal}`; // 比較 "2025-11"
      } else {
        // --- 年檢視 ---
        // monthVal 是 "" (不指定月份)
        timeRangeText = '本年';
        return date.slice(0, 4) === yearVal; // 比較 "2025"
      }
    });

    if (list.length === 0) {
      chart.getContext('2d').clearRect(0, 0, chart.width, chart.height);
      tbl.innerHTML = `<p style="text-align:center;margin-top:1em;">${timeRangeText}無${mode === 'out' ? '支出' : '收入'}資料</p>`;
      return;
    }

    const by = {};
    list.forEach(x => {
      const k = x.cat || '其他';
      by[k] = (by[k] || 0) + (+x.amount || 0);
    });

    const rows = Object.entries(by)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ label: k, value: v }));

    const total = rows.reduce((s, d) => s + d.value, 0);

    drawDonut(chart, rows);

    tbl.innerHTML = `
      ${createLegend(rows)}
      <table>
        <thead>
          <tr>
            <th>分類</th>
            <th style="text-align:right">金額</th>
            <th style="text-align:right">占比</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td>${r.label}</td>
              <td style="text-align:right">${r.value.toFixed(0)}</td>
              <td style="text-align:right">${((r.value / total) * 100).toFixed(1)}%</td>
            </tr>`).join('')}
        </tbody>
        <tfoot>
          <tr><td>總額</td><td style="text-align:right">${total.toFixed(0)}</td><td></td></tr>
          <tr><td>筆數</td><td style="text-align:right">${list.length}</td><td></td></tr>
        </tfoot>
      </table>
    `;
  }

  // ✅ (修改) 綁定新下拉選單的事件
  ySel.addEventListener('change', render);
  mSel.addEventListener('change', render);

  // (舊有) 支出/收入 切換
  tabOut.addEventListener('click', () => {
    mode = 'out';
    tabOut.setAttribute('aria-pressed', true);
    tabIn.setAttribute('aria-pressed', false);
    render();
  });
  tabIn.addEventListener('click', () => {
    mode = 'in';
    tabOut.setAttribute('aria-pressed', false);
    tabIn.setAttribute('aria-pressed', true);
    render();
  });

  render();
  return el;
}
