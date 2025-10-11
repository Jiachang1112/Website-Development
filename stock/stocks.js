/* =================== Yahoo + 代理 =================== */
const PROXIES=['','https://cors.isomorphic-git.org/','https://r.jina.ai/http://','https://r.jina.ai/https://'];
const YF={
  quote:(s)=>`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(s)}`,
  chart:(s,r='1mo',i='1d')=>`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?range=${r}&interval=${i}`,
  search:(q)=>`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&newsCount=20`,
};
const SYMBOLS=[
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

/* =================== 工具 & 主題 =================== */
const $=(s)=>document.querySelector(s);
const el=(t,c)=>{const e=document.createElement(t);if(c)e.className=c;return e;};
const fmt=(n,d=2)=>Number(n).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});
const pct=(n)=>(n>0?'+':'')+fmt(n,2)+'%';
const debounce=(fn,ms=300)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);}};

const cssVar=(name)=>getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const colorPrimary=()=>cssVar('--color-primary');
const colorPrimaryWeak=()=>cssVar('--color-primary-weak');
const colorUp=()=>cssVar('--color-up');
const colorDown=()=>cssVar('--color-down');
const colorNeutral=()=>cssVar('--color-neutral');

/* 主題切換（chart 會讀變數色） */
const themeSelect = $('#themeSelect');
const applyTheme = (t)=>{ document.documentElement.setAttribute('data-theme', t); localStorage.setItem('theme', t); };
applyTheme(localStorage.getItem('theme')||'light');
themeSelect.value = localStorage.getItem('theme')||'light';
themeSelect.onchange = ()=>applyTheme(themeSelect.value);

/* =================== Fetch JSON with fallback =================== */
async function fetchText(url){const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.text();}
async function fetchJSONWithFallback(url){
  let err;
  for(const p of PROXIES){
    const full=p?(p.endsWith('//')?p+url.replace(/^https?:\/\//,''):p+url):url;
    try{const text=await fetchText(full);return JSON.parse(text);}catch(e){err=e;}
  }
  throw err||new Error('All proxies failed');
}

/* =================== API =================== */
const API={
  async quote(s){
    const j=await fetchJSONWithFallback(YF.quote(s));
    const q=j?.quoteResponse?.result?.[0];
    if(!q)return{};
    return{
      symbol:q.symbol,price:q.regularMarketPrice,prevClose:q.regularMarketPreviousClose,
      change:q.regularMarketChange,changePercent:q.regularMarketChangePercent,
      volume:q.regularMarketVolume,currency:q.currency,exchange:q.fullExchangeName||q.exchange,
      shortName:q.shortName||s,
      logo:`https://logo.clearbit.com/${(q.shortName||q.symbol||'').replace(/\s+/g,'')}.com`
    };
  },
  async candles(s,r='1mo',i='1d'){
    const j=await fetchJSONWithFallback(YF.chart(s,r,i));
    const res=j?.chart?.result?.[0];
    const ts=res?.timestamp||[];
    const q=res?.indicators?.quote?.[0]||{};
    const c=q.close||[];
    return ts.map((t,k)=>({t:t*1000,c:c[k]??null})).filter(d=>d.c!=null);
  },
  async news(q){
    const j=await fetchJSONWithFallback(YF.search(q));
    const news=j?.news||[];
    return news.map(n=>({
      title:n.title,
      publisher:n.publisher||n.provider||'',
      link:n.link||n.clickThroughUrl||n.url||'#',
      time:n.providerPublishTime? n.providerPublishTime*1000 : (n.published_at? Date.parse(n.published_at): Date.now())
    }));
  },
  searchLocal(k){
    const q=String(k||'').trim().toLowerCase();
    if(!q)return [];
    return SYMBOLS.filter(s=>s.symbol.toLowerCase().includes(q)||(s.name||'').toLowerCase().includes(q)).slice(0,60);
  }
};

/* =================== 全域狀態 =================== */
let watch=JSON.parse(localStorage.getItem('watchlist')||'[]'); // {symbol,name,logo?}
const searchInput=$('#stockSearch'),searchBtn=$('#stockSearchBtn'),searchResults=$('#searchResults');
const watchlistEl=$('#watchlist'),sortSelect=$('#sortSelect'),refreshAllBtn=$('#refreshAll');
const statsSection=$('#statsSection');
const csvInput=$('#csvFile'),importBtn=$('#importCsvBtn'),exportBtn=$('#exportCsvBtn'),sampleBtn=$('#sampleCsvBtn');

searchBtn.onclick=()=>doSearch();
searchInput.oninput=debounce(()=>doSearch(),350);
sortSelect.onchange=()=>renderWatchlist();
refreshAllBtn.onclick=()=>renderWatchlist(true);

/* =================== CSV / XLSX =================== */
// 範例
(function makeSampleCsv(){
  const content = "symbol,name,logo\n2330.TW,台積電,\nAAPL,Apple Inc.,https://logo.clearbit.com/apple.com\nNVDA,NVIDIA,https://logo.clearbit.com/nvidia.com\n";
  sampleBtn.href='data:text/csv;charset=utf-8,'+encodeURIComponent(content);
})();
// 匯出 CSV
exportBtn.onclick=()=>{
  const rows=[['symbol','name','logo'],...watch.map(w=>[w.symbol,w.name||'',w.logo||''])];
  const csv=rows.map(r=>r.map(v=>String(v).includes(',')?`"${String(v).replace(/"/g,'""')}"`:v).join(',')).join('\n');
  const a=document.createElement('a'); a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv); a.download='watchlist.csv'; a.click();
};
// 匯入 CSV / XLSX
importBtn.onclick=()=>{
  const f=csvInput.files?.[0];
  if(!f){alert('請先選擇檔案');return;}
  const ext=f.name.toLowerCase().split('.').pop();
  if(ext==='csv'){
    const reader=new FileReader();
    reader.onload=()=>importFromRows(parseCSV(String(reader.result)));
    reader.readAsText(f,'utf-8');
  }else{
    // 使用 SheetJS
    const reader=new FileReader();
    reader.onload=(e)=>{
      const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:false});
      importFromRows(rows);
    };
    reader.readAsArrayBuffer(f);
  }
};
function parseCSV(text){
  return text.split(/\r?\n/).filter(l=>l!=='').map(line=>{
    // 簡單 CSV parser（支援加引號）
    const out=[]; let cur='',inq=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch==='"' ){ if(inq && line[i+1]==='"'){cur+='"';i++;} else inq=!inq; }
      else if(ch===',' && !inq){ out.push(cur); cur=''; }
      else cur+=ch;
    }
    out.push(cur);
    return out;
  });
}
function importFromRows(rows){
  let start=0; const h=rows[0]?.map(s=>String(s).toLowerCase());
  const hasHeader = h && (h.includes('symbol'));
  if(hasHeader) start=1;
  let add=0;
  for(let i=start;i<rows.length;i++){
    const [s='',n='',l='']=rows[i];
    const symbol=String(s||'').trim(); if(!symbol) continue;
    if(!watch.find(w=>w.symbol===symbol)){
      watch.push({symbol, name:String(n||'').trim(), logo:String(l||'').trim()||undefined});
      add++;
    }
  }
  localStorage.setItem('watchlist',JSON.stringify(watch));
  renderWatchlist(true);
  alert(`匯入完成：新增 ${add} 檔`);
}

/* =================== 搜尋 & 渲染 =================== */
async function doSearch(){
  const list=API.searchLocal(searchInput.value.trim());
  await renderCards(list,searchResults,{showAdd:true});
}
async function renderCards(items,container,{showAdd=false}={}){
  container.innerHTML='';
  if(!items?.length){container.innerHTML='<div class="text-muted">無資料</div>';return [];}
  const enriched=await Promise.all(items.map(async it=>{
    const q=await API.quote(it.symbol).catch(()=>null);
    // 讓 search 結果也能帶入自定 logo
    const customLogo = watch.find(w=>w.symbol===it.symbol)?.logo;
    return {...it,quote:q, logo: customLogo};
  }));
  const sortBy=sortSelect.value;
  const sorted=[...enriched].sort((a,b)=>{
    const qa=a.quote||{},qb=b.quote||{};
    const pa=Number(qa.price??0),pb=Number(qb.price??0);
    const ca=Number(qa.changePercent??0),cb=Number(qb.changePercent??0);
    if(sortBy==='symbol')return a.symbol.localeCompare(b.symbol);
    if(sortBy==='name')return (a.name||'').localeCompare(b.name||'');
    if(sortBy==='priceDesc')return pb-pa;
    if(sortBy==='priceAsc')return pa-pb;
    if(sortBy==='changeDesc')return cb-ca;
    if(sortBy==='changeAsc')return ca-cb;
    return 0;
  });

  for(const it of sorted){
    const col=el('div','col-12 col-md-6 col-lg-4');
    const card=el('div','stock-card shadow-sm p-3');
    const up=it.quote?.changePercent>0,down=it.quote?.changePercent<0;
    card.style.background=up?'rgba(34,197,94,.05)':(down?'rgba(239,68,68,.05)':'var(--color-card)');

    const head=el('div','d-flex justify-content-between align-items-center');
    const left=el('div');
    const logo=el('img');
    logo.src = it.logo || it.quote?.logo || '';
    logo.onerror=()=>logo.style.display='none';
    logo.style.width='24px';logo.style.height='24px';logo.style.objectFit='contain';logo.classList.add('me-2');
    const name=el('div','fw-bold');name.textContent=it.name||it.quote?.shortName||it.symbol;
    const sym=el('div','text-muted small');sym.textContent=it.symbol;
    left.append(logo,name,sym);

    const chip=el('div','chip '+(up?'up':(down?'down':'')));
    chip.textContent=it.quote?.changePercent?pct(it.quote.changePercent):'—';
    head.append(left,chip);

    const price=el('div','fs-4 fw-bold mt-2');price.textContent=it.quote?.price?fmt(it.quote.price):'—';
    const sub=el('div','text-muted small mb-2');
    sub.textContent=it.quote?.volume?`成交量 ${Number(it.quote.volume).toLocaleString()}`:'暫無報價';

    const canvas=el('canvas','mini-chart mb-2');
    drawMini(canvas,it.symbol,up,down);

    const btns=el('div','d-flex gap-2');
    if(showAdd){
      const add=el('button','btn btn-sm btn-outline-primary');add.textContent='加入自選';add.onclick=()=>addWatch(it);
      btns.append(add);
    }else{
      const detail=el('button','btn btn-sm btn-outline-secondary');detail.textContent='詳細';detail.onclick=()=>openModal(it.symbol,it.name||it.quote?.shortName);
      const del=el('button','btn btn-sm btn-outline-danger');del.textContent='移除';del.onclick=()=>removeWatch(it.symbol);
      btns.append(detail,del);
    }

    card.append(head,price,sub,canvas,btns);
    col.append(card);
    container.append(col);
  }
  return sorted;
}
async function drawMini(cv,symbol,up,down){
  const d=await API.candles(symbol,'1mo','1d');
  const ctx=cv.getContext('2d'); const w=cv.width=cv.clientWidth||320; const h=cv.height=cv.clientHeight||80;
  if(!d.length)return;
  const ys=d.map(x=>x.c),min=Math.min(...ys),max=Math.max(...ys);
  ctx.beginPath();ctx.lineWidth=2;ctx.strokeStyle=up?colorUp():down?colorDown():'#666';
  d.forEach((x,i)=>{const X=i/(d.length-1)*w,Y=h-(x.c-min)/(max-min)*(h-4); if(i===0)ctx.moveTo(X,Y); else ctx.lineTo(X,Y);});
  ctx.stroke();
}

/* =================== 自選與統計 =================== */
function saveWatch(){localStorage.setItem('watchlist',JSON.stringify(watch));}
function addWatch(it){
  if(!watch.find(w=>w.symbol===it.symbol)){
    watch.push({symbol:it.symbol,name:it.name||it.quote?.shortName,logo:it.logo||''});
    saveWatch(); renderWatchlist(true);
  }
}
function removeWatch(s){watch=watch.filter(w=>w.symbol!==s);saveWatch();renderWatchlist(true);}

let distChart,moversChart;
async function renderWatchlist(){
  const enriched=await renderCards(watch,watchlistEl,{showAdd:false});
  if(!enriched.length){statsSection.style.display='none';return;}
  statsSection.style.display='';
  let up=0,down=0,flat=0; const movers=[];
  for(const it of enriched){
    const cp=Number(it.quote?.changePercent??0);
    if(!isFinite(cp))continue;
    if(cp>0)up++;else if(cp<0)down++;else flat++;
    movers.push({symbol:it.symbol,cp});
  }
  const distCtx=$('#distChart').getContext('2d');
  if(distChart)distChart.destroy();
  distChart=new Chart(distCtx,{type:'doughnut',
    data:{labels:['上漲','下跌','持平'],datasets:[{data:[up,down,flat],backgroundColor:[colorUp(),colorDown(),colorNeutral()]}]},
    options:{plugins:{legend:{position:'bottom'}},cutout:'65%'}
  });
  movers.sort((a,b)=>Math.abs(b.cp)-Math.abs(a.cp));
  const top=movers.slice(0,5).reverse();
  const mvCtx=$('#moversChart').getContext('2d');
  if(moversChart)moversChart.destroy();
  moversChart=new Chart(mvCtx,{type:'bar',
    data:{labels:top.map(x=>x.symbol),datasets:[{data:top.map(x=>x.cp),backgroundColor:top.map(x=>x.cp>=0?colorUp():colorDown())}]},
    options:{indexAxis:'y',plugins:{legend:{display:false},tooltip:{callbacks:{label:(c)=>`${fmt(c.raw,2)}%`}}},scales:{x:{ticks:{callback:(v)=>`${v}%`}}}}
  });
}

/* =================== 詳細視窗（盤中顏色＆新聞圖示） =================== */
let modalChart,modalInstance,liveTimer=null,modalSymbol='';
function isMarketOpen(symbol,date=new Date()){
  const day=date.getDay(); // 0 Sun ... 6 Sat
  if(/[.]TW|[.]TWO$/i.test(symbol)){
    // 台股 09:00-13:30 (Mon-Fri)
    if(day===0||day===6) return false;
    const open=new Date(date), close=new Date(date);
    open.setHours(9,0,0,0); close.setHours(13,30,0,0);
    return date>=open && date<=close;
  }else{
    // 美股 09:30-16:00 ET -> 轉成本地：粗略用紐約時間
    const nowET=new Date(date.toLocaleString('en-US',{timeZone:'America/New_York'}));
    const etDay=nowET.getDay(); if(etDay===0||etDay===6) return false;
    const open=new Date(nowET), close=new Date(nowET);
    open.setHours(9,30,0,0); close.setHours(16,0,0,0);
    return nowET>=open && nowET<=close;
  }
}
function marketBadgeUpdate(symbol){
  const badge=$('#marketBadge');
  const open=isMarketOpen(symbol);
  badge.textContent=open?'交易中':'休市';
  badge.className = 'badge ' + (open?'text-bg-success':'text-bg-secondary');
}
async function openModal(symbol,name){
  modalSymbol=symbol;
  const modal=$('#stockModal'); const title=$('#modalTitle'),price=$('#modalPrice'),chg=$('#modalChange');
  title.textContent=`${name||symbol} (${symbol})`;
  const q=await API.quote(symbol);
  const up=q.changePercent>0,down=q.changePercent<0;
  price.textContent=q.price?fmt(q.price):'—';
  chg.textContent=q.changePercent?pct(q.changePercent):'—';
  chg.style.color=up?colorUp():down?colorDown():cssVar('--color-muted');
  await loadModalChart(symbol,'1mo','1d');
  await loadNews(symbol,name);
  marketBadgeUpdate(symbol);
  modalInstance=new bootstrap.Modal(modal); modalInstance.show();
  document.querySelectorAll('[data-range]').forEach(btn=>{
    btn.onclick=()=>{
      document.querySelectorAll('[data-range]').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const r=btn.dataset.range,i=btn.dataset.intv;
      stopLive();
      if(r==='1d' && i==='1m' && $('#liveToggle').checked) startLive();
      loadModalChart(symbol,r,i);
    };
  });
  $('#liveToggle').onchange=()=>{stopLive(); const act=document.querySelector('[data-range].active'); if(act?.dataset.range==='1d'&&act.dataset.intv==='1m'&&$('#liveToggle').checked) startLive();};
}
function stopLive(){ if(liveTimer){clearInterval(liveTimer); liveTimer=null;} }
function startLive(){ liveTimer=setInterval(()=>{ const act=document.querySelector('[data-range].active'); if(act?.dataset.range==='1d'&&act.dataset.intv==='1m') loadModalChart(modalSymbol,'1d','1m',true); marketBadgeUpdate(modalSymbol); },30000); }

async function loadModalChart(symbol,range,interval,append=false){
  const ctx=$('#modalChart').getContext('2d');
  const data=await API.candles(symbol,range,interval);
  const labels=data.map(x=> new Date(x.t).toLocaleString());
  const values=data.map(x=>x.c);
  const open=isMarketOpen(symbol);
  // 背景陰影 plugin：交易中用淡綠，休市用淡灰
  const shadeColor = open ? 'rgba(34,197,94,.08)' : 'rgba(148,163,184,.10)';
  const gridColor = cssVar('--grid-line');
  const dsColor = colorPrimary(), dsFill = colorPrimaryWeak();

  const pluginShade = {
    id:'sessionShade',
    beforeDraw(chart, args, opts){
      const {ctx,chartArea:{left,right,top,bottom}} = chart;
      ctx.save(); ctx.fillStyle = shadeColor; ctx.fillRect(left, top, right-left, bottom-top); ctx.restore();
    }
  };

  if(!modalChart || !append){
    if(modalChart) modalChart.destroy();
    modalChart=new Chart(ctx,{
      type:'line',
      data:{labels, datasets:[{data:values, borderColor:dsColor, backgroundColor:dsFill, fill:true, tension:.25}]},
      options:{
        plugins:{legend:{display:false}},
        scales:{x:{grid:{color:gridColor}}, y:{grid:{color:gridColor}}},
        animation:false
      },
      plugins:[pluginShade]
    });
  }else{
    modalChart.data.labels=labels;
    modalChart.data.datasets[0].data=values;
    modalChart.update();
  }
}

/* 新聞：來源圖示（favicon） */
function favicon(url){
  try{ const host=new URL(url).hostname; return `https://www.google.com/s2/favicons?sz=32&domain=${host}`; }
  catch{ return ''; }
}
async function loadNews(symbol,name){
  const list=$('#newsList'); list.innerHTML='<div class="text-muted small">載入中…</div>';
  try{
    const items=await API.news(symbol||name);
    if(!items.length){list.innerHTML='<div class="text-muted small">暫無新聞</div>';return;}
    list.innerHTML='';
    items.slice(0,20).forEach(n=>{
      const a=el('a','list-group-item list-group-item-action d-flex justify-content-between align-items-start news-item');
      a.href=n.link; a.target='_blank'; a.rel='noopener';
      const left=el('div','d-flex align-items-start gap-2');
      const img=el('img'); img.src=favicon(n.link); img.width=16; img.height=16; img.alt='src'; img.referrerPolicy='no-referrer';
      const text=el('div');
      const ttl=el('div','fw-semibold'); ttl.textContent=n.title||'(無標題)';
      const sub=el('div','small text-muted'); sub.textContent=`${n.publisher||''} · ${new Date(n.time).toLocaleString()}`;
      text.append(ttl,sub); left.append(img,text);
      a.append(left);
      list.append(a);
    });
  }catch{ list.innerHTML='<div class="text-muted small">新聞載入失敗</div>'; }
}

/* =================== 啟動 =================== */
renderWatchlist(true);
