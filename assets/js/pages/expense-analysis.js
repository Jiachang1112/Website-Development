// assets/js/pages/expense-analysis.js
import { getAll } from '../db.js';

// ✅ 1. (美化) 新增一個繽紛的調色盤
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
    // ✅ 1. (美化) 使用調色盤
    ctx.fillStyle = COLOR_PALETTE[i % COLOR_PALETTE.length];
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
  // ✅ 1. (美化) 調整標籤顏色和字體
  ctx.fillStyle = '#cbd5e1'; // 改成亮灰色
  ctx.textAlign = 'center';
  ctx.font = '700 14px system-ui'; // 標籤字體
  ctx.fillText('總額', cx, cy - 10);
  
  // ✅ 1. (美化) 調整金額顏色和字體
  ctx.fillStyle = '#f1f5f9'; // 改成白色 (更重、更明顯)
  ctx.font = '700 22px system-ui'; // 金額字體加大
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
  const ym = new Date().toISOString().slice(0, 7);
  const y_now = new Date().getFullYear();

  // ✅ 2. (功能) 更新 HTML 加入「月/年」切換
  el.innerHTML = `
    <h3>記帳｜分析</h3>
    <div class="row" style="flex-wrap: wrap; gap: 8px;">
      <button class="ghost" id="modeMonth" aria-pressed="true" style="padding: 6px 10px;">月檢視</button>
      <button class="ghost" id="modeYear" aria-pressed="false" style="padding: 6px 10px;">年檢視</button>
      
      <span id="monthPicker" style="display: inline-flex; gap: 6px; align-items: center;">
        <label class="small">月份</label>
        <input id="m" type="month" value="${ym}"/>
      </span>
      <span id="yearPicker" style="display: none; gap: 6px; align-items: center;">
        <label class="small">年份</label>
        <input id="y" type="number" value="${y_now}" style="width: 100px;"/>
      </span>
      
      <div style="flex-basis: 100%; height: 0; margin: 4px 0;"></div> <button class="ghost" id="tabOut" aria-pressed="true">支出</button>
      <button class="ghost" id="tabIn" aria-pressed="false">收入</button>
    </div>
    <canvas id="chart" style="width:100%;height:260px"></canvas>
    <div id="tbl"></div>
  `;

  // ✅ 2. (功能) 抓取新的 UI 元素
  const m = el.querySelector('#m');
  const y = el.querySelector('#y');
  const chart = el.querySelector('#chart');
  const tbl = el.querySelector('#tbl');
  const modeMonthBtn = el.querySelector('#modeMonth');
  const modeYearBtn = el.querySelector('#modeYear');
  const monthPicker = el.querySelector('#monthPicker');
  const yearPicker = el.querySelector('#yearPicker');
  const tabOut = el.querySelector('#tabOut');
  const tabIn = el.querySelector('#tabIn');

  let mode = 'out';
  let analysisMode = 'month'; // ✅ 2. (功能) 新增狀態

  async function render() {
    const [e, i] = await Promise.all([getAll('expenses'), getAll('incomes')]);
    
    // ✅ 2. (功能) 根據 analysisMode 決定過濾邏輯
    const yearVal = y.value;
    const monthVal = m.value;
    const list = (mode === 'out' ? e : i).filter(x => {
      const date = x.date || '';
      if (analysisMode === 'month') {
        return date.slice(0, 7) === monthVal; // 比較 "2025-10"
      } else {
        return date.slice(0, 4) === yearVal; // 比較 "2025"
      }
    });

    if (list.length === 0) {
      chart.getContext('2d').clearRect(0, 0, chart.width, chart.height);
      // ✅ 2. (功能) 更新提示文字
      const timeRangeText = analysisMode === 'month' ? '本月' : '本年';
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

  // ✅ 2. (功能) 設定檢視模式的函數
  function setAnalysisMode(newMode) {
    analysisMode = newMode;
    const isMonth = newMode === 'month';
    
    modeMonthBtn.setAttribute('aria-pressed', isMonth);
    modeYearBtn.setAttribute('aria-pressed', !isMonth);
    
    monthPicker.style.display = isMonth ? 'inline-flex' : 'none';
    yearPicker.style.display = isMonth ? 'none' : 'inline-flex';
    
    render();
  }

  // ✅ 2. (功能) 綁定新按鈕和輸入框的事件
  modeMonthBtn.addEventListener('click', () => setAnalysisMode('month'));
  modeYearBtn.addEventListener('click', () => setAnalysisMode('year'));
  m.addEventListener('change', render);
  y.addEventListener('change', render);

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
