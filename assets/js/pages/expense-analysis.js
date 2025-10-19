async function render() {
  // 以 entries 為單一來源（確保 getAll('entries') 能回傳所有 entry）
  const entries = await getAll('entries'); // 若你的 getAll 需要 uid 或其他參數，請對應修改
  const month = m.value; // e.g. "2025-10"
  // 處理不同 date 格式並取出 YYYY-MM
  function toYM(d) {
    if (!d) return null;
    const s = String(d);
    const m1 = s.match(/^(\d{4}-\d{2})/);
    if (m1) return m1[1];
    const m2 = s.match(/^(\d{4})年(\d{1,2})月/);
    if (m2) return `${m2[1]}-${m2[2].padStart(2,'0')}`;
    const m3 = s.match(/^(\d{4})\/(\d{2})/);
    if (m3) return `${m3[1]}-${m3[2]}`;
    return null;
  }
  // 篩選出所選月份的條目
  const monthList = entries.filter(x => toYM(x.date) === month);
  // 依 mode 以容錯方式判斷 type
  const filtered = monthList.filter(x => {
    const t = String(x.type || '').toLowerCase();
    if (mode === 'out') return t === 'expense' || t === '支出';
    return t === 'income' || t === '收入';
  });

  // 顯示目前查詢狀態
  const info = `查詢：${month}；類型：${mode==='out'?'支出':'收入'}；筆數：${filtered.length}`;
  tbl.innerHTML = `<div style="text-align:center;margin:8px 0;color:#666">${info}</div>`;

  if (filtered.length === 0) {
    chart.getContext('2d').clearRect(0, 0, chart.width, chart.height);
    tbl.innerHTML += `<p style="text-align:center;margin-top:1em;">本月無${mode === 'out' ? '支出' : '收入'}資料</p>`;
    return;
  }

  const by = {};
  filtered.forEach(x => {
    const k = x.categoryId || x.cat || x.category || '其他';
    by[k] = (by[k] || 0) + (+x.amount || 0);
  });

  const rows = Object.entries(by).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({label:k,value:v}));
  const total = rows.reduce((s,d)=>s+d.value,0);

  drawDonut(chart, rows);

  tbl.innerHTML += `
    ${createLegend(rows)}
    <table>
      <thead>
        <tr><th>分類</th><th style="text-align:right">金額</th><th style="text-align:right">占比</th></tr>
      </thead>
      <tbody>
        ${rows.map(r=>`<tr><td>${r.label}</td><td style="text-align:right">${r.value.toFixed(0)}</td><td style="text-align:right">${((r.value/total)*100).toFixed(1)}%</td></tr>`).join('')}
      </tbody>
      <tfoot>
        <tr><td>總額</td><td style="text-align:right">${total.toFixed(0)}</td><td></td></tr>
        <tr><td>筆數</td><td style="text-align:right">${filtered.length}</td><td></td></tr>
      </tfoot>
    </table>
  `;
}
