import { getAll } from '../db.js';

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
    ctx.fillStyle = `hsl(${(i * 57) % 360} 70% 55%)`;
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
  ctx.fillStyle = '#333';
  ctx.textAlign = 'center';
  ctx.font = '700 16px system-ui';
  ctx.fillText('總額', cx, cy - 10);
  ctx.fillText(total.toFixed(0), cx, cy + 10);
}

function createLegend(rows) {
  return `<div class="legend" style="margin:10px 0;display:flex;flex-wrap:wrap;gap:8px;">
    ${rows.map((r, i) =>
      `<span style="display:flex;align-items:center;gap:4px;">
        <span style="width:12px;height:12px;background:hsl(${(i * 57) % 360} 70% 55%);display:inline-block;border-radius:2px;"></span>
        ${r.label}
      </span>`
    ).join('')}
  </div>`;
}

export function ExpenseAnalysisPage() {
  const el = document.createElement('div');
  el.className = 'container card';
  const ym = new Date().toISOString().slice(0, 7);

  el.innerHTML = `
    <h3>記帳｜分析</h3>
    <div class="row">
      <label class="small">月份</label>
      <input id="m" type="month" value="${ym}"/>
      <button class="ghost" id="tabOut" aria-pressed="true">支出</button>
      <button class="ghost" id="tabIn">收入</button>
    </div>
    <canvas id="chart" style="width:100%;height:260px"></canvas>
    <div id="tbl"></div>
  `;

  const m = el.querySelector('#m'),
        chart = el.querySelector('#chart'),
        tbl = el.querySelector('#tbl');
  let mode = 'out';

  async function render() {
    const [e, i] = await Promise.all([getAll('expenses'), getAll('incomes')]);
    const list = (mode === 'out' ? e : i).filter(x => (x.date || '').slice(0, 7) === m.value);

    if (list.length === 0) {
      chart.getContext('2d').clearRect(0, 0, chart.width, chart.height);
      tbl.innerHTML = `<p style="text-align:center;margin-top:1em;">本月無${mode === 'out' ? '支出' : '收入'}資料</p>`;
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

  m.addEventListener('change', render);
  el.querySelector('#tabOut').addEventListener('click', () => {
    mode = 'out';
    render();
  });
  el.querySelector('#tabIn').addEventListener('click', () => {
    mode = 'in';
    render();
  });

  render();
  return el;
}
