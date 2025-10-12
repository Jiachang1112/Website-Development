// assets/js/pages/chart.js
import { getEntriesRangeForEmail } from '../entries.js';

// 動態載入 Chart.js（只載一次）
async function loadChartJs() {
  if (window.Chart) return window.Chart;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js';
    s.onload = resolve; s.onerror = () => reject(new Error('Chart.js 載入失敗'));
    document.head.appendChild(s);
  });
  return window.Chart;
}

// 取得登入 email（沿用你現在的 session_user）
function getUserEmail(){
  try{
    if (window.session_user?.email) return window.session_user.email;
    const u = JSON.parse(localStorage.getItem('session_user')||'null') || JSON.parse(sessionStorage.getItem('session_user')||'null');
    return u?.email || null;
  }catch{ return null; }
}

export function ChartPage(){
  const el = document.createElement('div'); el.className = 'container card';
  const y = (new Date()).getFullYear();
  el.innerHTML = `
    <h3>支出統計</h3>
    <div class="row" style="gap:8px;align-items:center;margin:8px 0">
      <label>年份</label>
      <input id="year" type="number" value="${y}" style="width:120px">
      <button class="ghost" id="reload">重新整理</button>
    </div>

    <div class="row">
      <div class="card" style="padding:16px">
        <div style="font-weight:700;margin-bottom:8px">📆 月支出（當年）</div>
        <canvas id="line"></canvas>
      </div>
      <div class="card" style="padding:16px">
        <div style="font-weight:700;margin-bottom:8px">🍩 分類占比（當年）</div>
        <canvas id="pie"></canvas>
      </div>
    </div>
  `;

  const iptYear = el.querySelector('#year');
  const btnReload = el.querySelector('#reload');
  let lineChart, pieChart;

  async function render(){
    const email = getUserEmail();
    if(!email){
      el.appendChild(document.createTextNode('請先登入才能查看統計。'));
      return;
    }
    const year = +iptYear.value || (new Date()).getFullYear();
    const from = `${year}-01-01`, to = `${year}-12-31`;

    // 讀取該年的所有 entries
    const entries = await getEntriesRangeForEmail(email, from, to);

    // 僅統計支出
    const ex = entries.filter(e => (e.type||'expense') === 'expense');

    // 1) 各月份合計
    const months = Array.from({length:12}, (_,i)=>i+1);
    const monthly = Array(12).fill(0);
    ex.forEach(e=>{
      const m = +(e.date||'').slice(5,7); // "YYYY-MM-DD"
      if(m>=1 && m<=12) monthly[m-1] += Number(e.amount||0);
    });

    // 2) 分類合計
    const catMap = {};
    ex.forEach(e=>{
      const k = e.categoryId || '其他';
      catMap[k] = (catMap[k]||0) + Number(e.amount||0);
    });
    const catLabels = Object.keys(catMap);
    const catValues = catLabels.map(k=>catMap[k]);

    await loadChartJs();

    // 畫折線
    if(lineChart) lineChart.destroy();
    lineChart = new Chart(el.querySelector('#line').getContext('2d'), {
      type: 'line',
      data: {
        labels: months.map(m=>`${m}月`),
        datasets: [{
          label: '支出',
          data: monthly,
          tension: .25,
          fill: false
        }]
      },
      options: {
        plugins:{ legend:{ display:false } },
        scales:{ y:{ beginAtZero:true } }
      }
    });

    // 畫圓餅
    if(pieChart) pieChart.destroy();
    pieChart = new Chart(el.querySelector('#pie').getContext('2d'), {
      type: 'pie',
      data: { labels: catLabels, datasets: [{ data: catValues }] },
      options: { plugins:{ legend:{ position:'bottom' } } }
    });
  }

  btnReload.addEventListener('click', render);
  render();
  return el;
}
