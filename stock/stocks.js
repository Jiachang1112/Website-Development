// ====== 公開代理備援（若 Yahoo 直連被 CORS 擋就換 proxy）======
const PROXIES = [
  '', // 先嘗試直連（很多時候可用）
  'https://cors.isomorphic-git.org/',
  'https://r.jina.ai/http://',       // read-only 代理（不支援 https → 用 http）
  'https://r.jina.ai/https://',
];

// Yahoo Finance endpoints（不需要金鑰）
const YF = {
  quote: (symbol) => `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`,
  chart: (symbol, range='1mo', interval='1d') =>
         `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`,
};

// ====== 內建清單（可擴充；台股 .TW、上櫃 .TWO）======
const SYMBOLS = [
  { symbol: '2330.TW', name: '台積電', exchange: 'TWSE' },
  { symbol: '2317.TW', name: '鴻海',   exchange: 'TWSE' },
  { symbol: '2303.TW', name: '聯電',   exchange: 'TWSE' },
  { symbol: '2454.TW', name: '聯發科', exchange: 'TWSE' },
  { symbol: '2881.TW', name: '富邦金', exchange: 'TWSE' },
  { symbol: '0050.TW', name: '元大台灣50', exchange: 'TWSE' },
  { symbol: 'AAPL',    name: 'Apple Inc.', exchange: 'NASDAQ' },
  { symbol: 'MSFT',    name: 'Microsoft',  exchange: 'NASDAQ' },
  { symbol: 'NVDA',    name: 'NVIDIA',     exchange: 'NASDAQ' },
  { symbol: 'TSLA',    name: 'Tesla',      exchange: 'NASDAQ' },
  { symbol: 'AMZN',    name: 'Amazon',     exchange: 'NASDAQ' },
];

// ====== 小工具 ======
const $ = (s)=>document.querySelector(s);
const el = (t,c)=>{const e=document.createElement(t);if(c)e.className=c;return e;};
const fmt=(n,d=2)=>Number(n).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});
const pct=(n)=>(n>0?'+':'')+fmt(n,2)+'%';
const debounce=(fn,ms=300)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);}};

// ====== 具有備援的 fetch JSON ======
async function fetchJSONWithFallback(url) {
  let lastErr = null;
  for (const p of PROXIES) {
    const full = p ? (p.endsWith('//') ? p + url.replace(/^https?:\/\//,'') : p + url) : url;
    try {
      const r = await fetch(full, { headers: { 'User-Agent':'Mozilla/5.0' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      // jina 的代理會回傳純文字，需要再 JSON.parse
      const txt = await r.text();
      const data = (p.startsWith('https://r.jina.ai/')) ? JSON.parse(txt) : (txt ? JSON.parse(txt) : {});
      return data;
    } catch (e) {
      lastErr = e;
      // 繼續嘗試下一個 proxy
    }
  }
  throw lastErr || new Error('All proxies failed');
}

// ====== API 呼叫（純前端）======
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
      time: q.regularMarketTime ? q.regularMarketTime * 1000 : Date.now(),
    };
  },
  async candles(symbol, range='1mo', interval='1d'){
    const data = await fetchJSONWithFallback(YF.chart(symbol, range, interval));
    const res = data?.chart?.result?.[0];
    const ts = res?.timestamp || [];
    const q = res?.indicators?.quote?.[0] || {};
    const o = q.open || [], h = q.high || [], l = q.low || [], c = q.close || [], v = q.volume || [];
    return ts.map((t,i)=>({ t: t*1000, o:o[i]??null, h:h[i]??null, l:l[i]??null, c:c[i]??null, v:v[i]??null }))
             .filter(d=>d.c!=null);
  },
  searchLocal(keyword){
    const q = String(keyword||'').trim().toLowerCase();
    if (!q) return [];
    return SYMBOLS.filter(s =>
      s.symbol.toLowerCase().includes(q) ||
      (s.name||'').toLowerCase().includes(q)
    ).slice(0, 30);
  }
};

// ====== 狀態 ======
let watch = JSON.parse(localStorage.getItem('watchlist') || '[]'); // [{symbol, name?}]

// ====== 綁定 ======
const searchInput=$('#stockSearch');
const searchBtn=$('#stockSearchBtn');
const searchResults=$('#searchResults');
const watchlistEl=$('#watchlist');
const sortSelect=$('#sortSelect');
const refreshAllBtn=$('#refreshAll');

// 搜尋
const doSearch=async()=>{
  const q=searchInput.value.trim();
  const list = API.searchLocal(q);
  renderCards(list, searchResults, {showAdd:true});
};
searchBtn.addEventListener('click',doSearch);
searchInput.addEventListener('input',debounce(doSearch,350));

// 排序 + 全部更新
sortSelect.addEventListener('change',()=>renderWatchlist());
refreshAllBtn.addEventListener('click',()=>renderWatchlist(true));

// ====== 渲染卡片 ======
async function renderCards(items, container, {showAdd=false}={}){
  container.innerHTML='';
  if(!items?.length){ container.innerHTML='<div class="text-muted">無資料</div>'; return; }

  const enriched = await Promise.all(items.map(async it=>{
    try{ const q = await API.quote(it.symbol); return {...it, quote:q}; }
    catch{ return {...it, quote:null}; }
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

  for(const item of sorted){
    const col = el('div','col-12 col-md-6 col-lg-4');
    const card = el('div','stock-card');

    const header = el('div','d-flex align-items-center justify-content-between mb-1');
    const left = el('div'); const right = el('div');
    const sym = el('div','stock-symbol'); sym.textContent=item.symbol;
    const name = el('div','text-muted small'); name.textContent=item.name || item.exchange || '';
    left.append(sym,name);
    const chip = el('div','chip'); right.append(chip);
    header.append(left,right);

    const priceRow = el('div','d-flex align-items-end justify-content-between');
    const p = el('div');
    const price = el('div'); price.style.fontSize='20px'; price.style.fontWeight='700';
    const sub = el('div','text-muted small');

    if(item.quote && typeof item.quote.price!=='undefined'){
      price.textContent = fmt(item.quote.price);
      const ch = Number(item.quote.changePercent || 0);
      chip.textContent = Number.isFinite(ch) ? pct(ch) : '—';
      chip.classList.toggle('up', ch>0);
      chip.classList.toggle('down', ch<0);
      sub.textContent = `昨收 ${fmt(item.quote.prevClose ?? 0)}｜成交量 ${Number(item.quote.volume||0).toLocaleString()}`;
    }else{
      price.textContent='—'; chip.textContent='—'; sub.textContent='暫無報價';
    }
    p.append(price, sub);

    const mini = el('canvas','mini-chart');
    drawMiniChart(mini, item.symbol).catch(()=>{});

    const btns = el('div','d-flex gap-2 mt-2');
    if (showAdd) {
      const add = el('button','btn btn-sm btn-outline-primary'); add.textContent='加入自選';
      add.onclick = ()=>addWatch(item); btns.append(add);
    } else {
      const detail = el('button','btn btn-sm btn-outline-secondary'); detail.textContent='詳細';
      detail.onclick = ()=>openDetail(item.symbol);
      const rm = el('button','btn btn-sm btn-outline-danger'); rm.textContent='移除';
      rm.onclick = ()=>removeWatch(item.symbol);
      btns.append(detail, rm);
    }

    priceRow.append(p);
    card.append(header, priceRow, mini, btns);
    col.append(card);
    container.append(col);
  }
}

// 迷你K線
async function drawMiniChart(canvas,symbol){
  const data = await API.candles(symbol,'1mo','1d');
  const w = canvas.width = canvas.clientWidth || 320;
  const h = canvas.height = canvas.clientHeight || 80;
  const ctx = canvas.getContext('2d');
  const ys = data.map(d=>d.c);
  if(!ys.length) return;
  const min=Math.min(...ys), max=Math.max(...ys);
  const pad=4, nx=i=> pad + (i/(ys.length-1))*(w-2*pad), ny=v=> h - pad - ((v-min)/(max-min||1))*(h-2*pad);
  ctx.lineWidth=1.5; ctx.beginPath();
  ys.forEach((y,i)=>{ const X=nx(i), Y=ny(y); if(i===0) ctx.moveTo(X,Y); else ctx.lineTo(X,Y); });
  ctx.stroke();
}

// 自選
function saveWatch(){ localStorage.setItem('watchlist', JSON.stringify(watch)); }
function addWatch(item){ if(!watch.find(w=>w.symbol===item.symbol)){ watch.push({symbol:item.symbol,name:item.name}); saveWatch(); renderWatchlist(true);} }
function removeWatch(symbol){ watch = watch.filter(w=>w.symbol!==symbol); saveWatch(); renderWatchlist(); }
async function renderWatchlist(forceRefresh=false){ await renderCards(watch, $('#watchlist'), {showAdd:false}); }

// 其他
function openDetail(symbol){ window.open(`https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`,'_blank'); }

// 首次進頁面渲染自選
renderWatchlist();
