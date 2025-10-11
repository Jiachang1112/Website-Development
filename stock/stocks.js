/* ======================= 設定：Yahoo API + CORS 代理 ======================= */
const PROXIES = [
  '',                                        // 先直連
  'https://cors.isomorphic-git.org/',        // 通用 CORS 代理
  'https://r.jina.ai/http://',               // 只讀代理（http）
  'https://r.jina.ai/https://',              // 只讀代理（https）
];
const YF = {
  quote: (s) => `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(s)}`,
  chart: (s, r='1mo', i='1d') =>
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?range=${r}&interval=${i}`,
  // 搜尋 API（會回傳 news 陣列）（非官方，但可用）
  search: (q) =>
    `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&newsCount=20`,
};
/* 內建清單（可擴充；台股加 .TW，上櫃 .TWO） */
const SYMBOLS = [
  {symbol:'2330.TW',name:'台積電',exchange:'TWSE'},
  {symbol:'2317.TW',name:'鴻海',exchange:'TWSE'},
  {symbol:'2303.TW',name:'聯電',exchange:'TWSE'},
  {symbol:'2454.TW',name:'聯發科',exchange:'TWSE'},
  {symbol:'2881.TW',name:'富邦金',exchange:'TWSE'},
  {symbol:'0050.TW',name:'元大台灣50',exchange:'TWSE'},
  {symbol:'AAPL',name:'Apple Inc.',exchange:'NASDAQ'},
  {symbol:'MSFT',name:'Microsoft',exchange:'NASDAQ'},
  {symbol:'NVDA',name:'NVIDIA',exchange:'NASDAQ'},
  {symbol:'TSLA',name:'Tesla',exchange:'NASDAQ'},
  {symbol:'AMZN',name:'Amazon',exchange:'NASDAQ'},
];

/* ======================= 小工具 ======================= */
const $ = (s)=>document.querySelector(s);
const el = (t,c)=>{const e=document.createElement(t); if(c)e.className=c; return e;};
const fmt=(n,d=2)=>Number(n).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});
const pct=(n)=>(n>0?'+':'')+fmt(n,2)+'%';
const debounce=(fn,ms=300)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);}};

async function fetchText(url){
  const r = await fetch(url, { headers: { 'User-Agent':'Mozilla/5.0' }});
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}
async function fetchJSONWithFallback(url) {
  let err;
  for (const p of PROXIES) {
    const full = p ? (p.endsWith('//') ? p + url.replace(/^https?:\/\//,'') : p + url) : url;
    try {
      const text = await fetchText(full);
      // jina 的代理回純文字，仍需 JSON.parse；其餘同樣 parse
      return JSON.parse(text);
    } catch (e) { err = e; }
  }
  throw err || new Error('All proxies failed');
}

/* ======================= 前端 API ======================= */
const API = {
  async quote(symbol){
    const data = await fetchJSONWithFallback(YF.quote(symbol));
    const q = data?.quoteResponse?.result?.[0];
    if (!q) return {};
    return {
      symbol: q.symbol,
      price: q.regularMarketPrice,
      prevClose: q.regularMarketPreviousClose,
      change: q.regularMarketChange,
      changePercent: q.regularMarketChangePercent,
      volume: q.regularMarketVolume,
      currency: q.currency,
      exchange: q.fullExchangeName || q.exchange,
      logo: `https://logo.clearbit.com/${(q.shortName||q.symbol||'').replace(/\s+/g,'')}.com`,
    };
  },
  async candles(symbol, range='1mo', interval='1d'){
    const data = await fetchJSONWithFallback(YF.chart(symbol, range, interval));
    const res = data?.chart?.result?.[0];
    const ts = res?.timestamp || [];
    const q = res?.indicators?.quote?.[0] || {};
    const c = q.close || [];
    return ts.map((t,i)=>({ t: t*1000, c: c[i] ?? null })).filter(d=>d.c!=null);
  },
  // 取得個股新聞（用 search 端點，抓 news 陣列）
  async news(symbolOrName){
    const data = await fetchJSONWithFallback(YF.search(symbolOrName));
    const news = data?.news || [];
    // 正規化：title, publisher, link, published
    return news.map(n=>({
      title: n.title,
      publisher: n.publisher || n.provider || '',
      link: n.link || n.clickThroughUrl || n.url || '#',
      time: n.providerPublishTime ? n.providerPublishTime*1000 :
            n.published_at ? Date.parse(n.published_at) : Date.now()
    }));
  },
  searchLocal(keyword){
    const q = String(keyword||'').trim().toLowerCase();
    if (!q) return [];
    return SYMBOLS.filter(s =>
      s.symbol.toLowerCase().includes(q) ||
      (s.name||'').toLowerCase().includes(q)
    ).slice(0, 60);
  }
};

/* ======================= 狀態 & 綁定 ======================= */
let watch = JSON.parse(localStorage.getItem('watchlist') || '[]'); // [{symbol,name}]
const searchInput=$('#stockSearch'), searchBtn=$('#stockSearchBtn'), searchResults=$('#searchResults');
const watchlistEl=$('#watchlist'), sortSelect=$('#sortSelect'), refreshAllBtn=$('#refreshAll');
const statsSection = $('#statsSection');
const csvInput = $('#csvFile'), importCsvBtn = $('#importCsvBtn'), exportCsvBtn = $('#exportCsvBtn'), sampleCsvBtn = $('#sampleCsvBtn');

searchBtn.addEventListener('click', doSearch);
searchInput.addEventListener('input', debounce(doSearch,350));
sortSelect.addEventListener('change', ()=>renderWatchlist());
refreshAllBtn.addEventListener('click', ()=>renderWatchlist(true));

/* ======================= CSV：樣本／匯入／匯出 ======================= */
// 樣本
(function makeSampleCsv(){
  const content = "symbol,name\n2330.TW,台積電\nAAPL,Apple Inc.\nNVDA,NVIDIA\n";
  sampleCsvBtn.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(content);
})();
// 匯出
exportCsvBtn.addEventListener('click', ()=>{
  const rows = [['symbol','name'], ...watch.map(w=>[w.symbol, w.name||''])];
  const csv = rows.map(r=>r.map(v=>String(v).includes(',')?`"${v.replace(/"/g,'""')}"`:v).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'watchlist.csv';
  a.click();
});
// 匯入
importCsvBtn.addEventListener('click', ()=>{
  const f = csvInput.files?.[0];
  if (!f) { alert('請先選擇 CSV 檔案'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    const lines = String(reader.result).split(/\r?\n/).filter(Boolean);
    let start = 0;
    if (lines[0].toLowerCase().includes('symbol')) start = 1; // 有標題
    const added = [];
    for (let i=start;i<lines.length;i++){
      const [symRaw,nameRaw=''] = lines[i].split(',');
      const symbol = symRaw?.trim();
      const name = nameRaw?.trim();
      if (!symbol) continue;
      if (!watch.find(w=>w.symbol===symbol)) {
        watch.push({symbol, name});
        added.push(symbol);
      }
    }
    localStorage.setItem('watchlist', JSON.stringify(watch));
    renderWatchlist(true);
    alert(`CSV 匯入完成：新增 ${added.length} 檔`);
  };
  reader.readAsText(f, 'utf-8');
});

/* ======================= 主流程：搜尋 / 渲染 ======================= */
async function doSearch(){
  const q = searchInput.value.trim();
  const list = API.searchLocal(q);
  await renderCards(list, searchResults, {showAdd:true});
}

async function renderCards(items, container, {showAdd=false}={}){
  container.innerHTML='';
  if(!items?.length){ container.innerHTML='<div class="text-muted">無資料</div>'; return []; }

  const enriched = await Promise.all(items.map(async (it) => {
    try { const q = await API.quote(it.symbol); return {...it, quote: q}; }
    catch { return {...it, quote: null}; }
  }));

  const sortBy = sortSelect.value;
  const sorted = [...enriched].sort((a,b)=>{
    const qa=a.quote||{}, qb=b.quote||{};
    const pa=Number(qa.price??0), pb=Number(qb.price??0);
    const ca=Number(qa.changePercent??0), cb=Number(qb.changePercent??0);
    if (sortBy==='symbol') return a.symbol.localeCompare(b.symbol);
    if (sortBy==='name') return (a.name||'').localeCompare(b.name||'');
    if (sortBy==='priceDesc') return pb - pa;
    if (sortBy==='priceAsc') return pa - pb;
    if (sortBy==='changeDesc') return cb - ca;
    if (sortBy==='changeAsc') return ca - cb;
    return 0;
  });

  for (const it of sorted) {
    const col = el('div','col-12 col-md-6 col-lg-4');
    const card = el('div','stock-card shadow-sm p-3');

    const up = it.quote?.changePercent > 0, down = it.quote?.changePercent < 0;
    card.style.background = up ? '#f0fff4' : (down ? '#fff5f5' : '#fff');

    const head = el('div','d-flex justify-content-between align-items-center');
    const left = el('div');
    const logo = el('img'); logo.src = it.quote?.logo || ''; logo.onerror = ()=>logo.style.display='none';
    logo.style.width='24px'; logo.style.height='24px'; logo.style.objectFit='contain'; logo.classList.add('me-2');
    const name = el('div','fw-bold'); name.textContent = it.name || it.symbol;
    const sym = el('div','text-muted small'); sym.textContent = it.symbol;
    left.append(logo,name,sym);
    const chip = el('div','chip '+(up?'up':(down?'down':'')));
    chip.textContent = it.quote?.changePercent ? pct(it.quote.changePercent) : '—';
    head.append(left, chip);

    const price = el('div','fs-4 fw-bold mt-2'); price.textContent = it.quote?.price ? fmt(it.quote.price) : '—';
    const sub = el('div','text-muted small mb-2');
    sub.textContent = it.quote?.volume ? `成交量 ${Number(it.quote.volume).toLocaleString()}` : '暫無報價';

    const canvas = el('canvas','mini-chart mb-2');
    drawLineMini(canvas, it.symbol, up, down);

    const btns = el('div','d-flex gap-2');
    if (showAdd) {
      const add = el('button','btn btn-sm btn-outline-primary'); add.textContent='加入自選';
      add.onclick = ()=>addWatch(it);
      btns.append(add);
    } else {
      const detail = el('button','btn btn-sm btn-outline-secondary'); detail.textContent='詳細';
      detail.onclick = ()=>openModal(it.symbol, it.name);
      const del = el('button','btn btn-sm btn-outline-danger'); del.textContent='移除';
      del.onclick = ()=>removeWatch(it.symbol);
      btns.append(detail, del);
    }

    card.append(head, price, sub, canvas, btns);
    col.append(card);
    container.append(col);
  }
  return sorted;
}

/* 迷你折線圖（Canvas） */
async function drawLineMini(canvas, symbol, up, down){
  const data = await API.candles(symbol, '1mo', '1d');
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.clientWidth || 320;
  const h = canvas.height = canvas.clientHeight || 80;
  if (!data.length) return;
  const ys = data.map(x=>x.c);
  const min=Math.min(...ys), max=Math.max(...ys);
  ctx.beginPath(); ctx.lineWidth=2;
  ctx.strokeStyle = up ? '#137333' : (down ? '#c5221f' : '#666');
  data.forEach((x,i)=>{
    const X=i/(data.length-1)*w, Y=h - (x.c-min)/(max-min)*(h-4);
    if(i===0)ctx.moveTo(X,Y); else ctx.lineTo(X,Y);
  });
  ctx.stroke();
}

/* 自選：儲存/移除/渲染 + 統計儀表板 */
function saveWatch(){ localStorage.setItem('watchlist', JSON.stringify(watch)); }
function addWatch(item){ if(!watch.find(w=>w.symbol===item.symbol)){ watch.push({symbol:item.symbol,name:item.name}); saveWatch(); renderWatchlist(true); } }
function removeWatch(symbol){ watch = watch.filter(w=>w.symbol!==symbol); saveWatch(); renderWatchlist(true); }

let distChart, moversChart;
async function renderWatchlist(force=false){
  const enriched = await renderCards(watch, watchlistEl, {showAdd:false});
  if (!enriched.length) { statsSection.style.display='none'; return; }
  statsSection.style.display='';
  let up=0, down=0, flat=0; const movers=[];
  for (const it of enriched) {
    const cp = Number(it.quote?.changePercent ?? 0);
    if (!isFinite(cp)) continue;
    if (cp>0) up++; else if (cp<0) down++; else flat++;
    movers.push({symbol:it.symbol, cp});
  }
  // Doughnut
  const distCtx = $('#distChart').getContext('2d');
  if (distChart) distChart.destroy();
  distChart = new Chart(distCtx, {
    type: 'doughnut',
    data: { labels:['上漲','下跌','持平'], datasets:[{ data:[up,down,flat], backgroundColor:['#34c759','#ff3b30','#a1a1aa'] }]},
    options: { plugins:{legend:{position:'bottom'}}, cutout:'65%' }
  });
  // Movers
  movers.sort((a,b)=>Math.abs(b.cp)-Math.abs(a.cp));
  const top = movers.slice(0,5).reverse();
  const mvCtx = $('#moversChart').getContext('2d');
  if (moversChart) moversChart.destroy();
  moversChart = new Chart(mvCtx, {
    type: 'bar',
    data: {
      labels: top.map(x=>x.symbol),
      datasets: [{ data: top.map(x=>x.cp), backgroundColor: top.map(x=>x.cp>=0?'#34c759':'#ff3b30') }]
    },
    options: { indexAxis:'y', plugins:{legend:{display:false}, tooltip:{callbacks:{label:(c)=>`${fmt(c.raw,2)}%`}}}, scales:{x:{ticks:{callback:(v)=>`${v}%`}}} }
  });
}

/* ======================= 詳細視窗：1m 即時 + 新聞 ======================= */
let modalChart, modalInstance, liveTimer=null;
async function openModal(symbol, name){
  const modal=$('#stockModal');
  const title=$('#modalTitle'), price=$('#modalPrice'), chg=$('#modalChange');
  title.textContent = `${name||symbol} (${symbol})`;
  const q = await API.quote(symbol);
  const up=q.changePercent>0, down=q.changePercent<0;
  price.textContent = q.price ? fmt(q.price) : '—';
  chg.textContent = q.changePercent ? pct(q.changePercent) : '—';
  chg.style.color = up ? '#137333' : (down ? '#c5221f' : '#666');

  // 預設載入 1 月（日線）
  await loadModalChart(symbol,'1mo','1d');
  await loadNews(symbol, name);

  // 打開視窗
  modalInstance = new bootstrap.Modal(modal);
  modalInstance.show();

  // 綁定 range 切換
  document.querySelectorAll('[data-range]').forEach(btn=>{
    btn.onclick=()=>{
      document.querySelectorAll('[data-range]').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const r=btn.dataset.range, i=btn.dataset.intv;
      stopLive();
      if (r==='1d' && i==='1m' && $('#liveToggle').checked) startLive(symbol);
      loadModalChart(symbol, r, i);
    };
  });

  // 自動更新開關
  $('#liveToggle').onchange = ()=>{
    stopLive();
    const active = document.querySelector('[data-range].active');
    const r=active?.dataset.range, i=active?.dataset.intv;
    if (r==='1d' && i==='1m' && $('#liveToggle').checked) startLive(symbol);
  };
}
function stopLive(){ if(liveTimer){ clearInterval(liveTimer); liveTimer=null; } }
function startLive(symbol){
  liveTimer = setInterval(async ()=>{
    const active = document.querySelector('[data-range].active');
    if (!active || active.dataset.range!=='1d' || active.dataset.intv!=='1m') return;
    await loadModalChart(symbol,'1d','1m', true); // append 模式
  }, 30000); // 30 秒自動更新
}
async function loadModalChart(symbol, range, interval, append=false){
  const ctx = $('#modalChart').getContext('2d');
  const data = await API.candles(symbol, range, interval);
  const labels = data.map(x=> new Date(x.t).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) );
  const values = data.map(x=> x.c);
  if (!modalChart || !append){
    if (modalChart) modalChart.destroy();
    modalChart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ data: values, borderColor:'#007aff', backgroundColor:'rgba(0,122,255,.1)', fill:true, tension:.25 }]},
      options: { plugins:{legend:{display:false}}, scales:{x:{display:true}, y:{display:true}}, animation:false }
    });
  } else {
    // 追加點（避免整張重繪）
    modalChart.data.labels = labels;
    modalChart.data.datasets[0].data = values;
    modalChart.update();
  }
}

/* 新聞列表（Yahoo search news） */
async function loadNews(symbol, name){
  const list = $('#newsList'); list.innerHTML = '<div class="text-muted small">載入中…</div>';
  try{
    const items = await API.news(symbol || name);
    if (!items.length) { list.innerHTML = '<div class="text-muted small">暫無新聞</div>'; return; }
    list.innerHTML = '';
    items.slice(0,20).forEach(n=>{
      const a = el('a','list-group-item list-group-item-action d-flex justify-content-between align-items-start news-item');
      a.href = n.link; a.target='_blank'; a.rel='noopener';
      const div = el('div','me-3');
      const ttl = el('div','fw-semibold'); ttl.textContent = n.title || '(無標題)';
      const sub = el('div','small text-muted'); sub.textContent = `${n.publisher||''} · ${new Date(n.time).toLocaleString()}`;
      div.append(ttl, sub);
      a.append(div);
      list.append(a);
    });
  }catch{
    list.innerHTML = '<div class="text-muted small">新聞載入失敗</div>';
  }
}

/* ======================= 啟動 ======================= */
renderWatchlist(true);
