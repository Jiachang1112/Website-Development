const PROXIES=['','https://cors.isomorphic-git.org/','https://r.jina.ai/http://','https://r.jina.ai/https://'];
const YF={
  quote:(s)=>`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(s)}`,
  chart:(s,r='1mo',i='1d')=>`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?range=${r}&interval=${i}`,
};
const SYMBOLS=[
  {symbol:'2330.TW',name:'台積電',exchange:'TWSE'},
  {symbol:'2317.TW',name:'鴻海',exchange:'TWSE'},
  {symbol:'2303.TW',name:'聯電',exchange:'TWSE'},
  {symbol:'2454.TW',name:'聯發科',exchange:'TWSE'},
  {symbol:'2881.TW',name:'富邦金',exchange:'TWSE'},
  {symbol:'AAPL',name:'Apple Inc.',exchange:'NASDAQ'},
  {symbol:'MSFT',name:'Microsoft',exchange:'NASDAQ'},
  {symbol:'NVDA',name:'NVIDIA',exchange:'NASDAQ'},
  {symbol:'TSLA',name:'Tesla',exchange:'NASDAQ'},
  {symbol:'AMZN',name:'Amazon',exchange:'NASDAQ'},
];
const $=(s)=>document.querySelector(s);
const el=(t,c)=>{const e=document.createElement(t);if(c)e.className=c;return e;};
const fmt=(n,d=2)=>Number(n).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});
const pct=(n)=>(n>0?'+':'')+fmt(n,2)+'%';
const debounce=(fn,ms=300)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);}};

async function fetchJSON(url){
  for(const p of PROXIES){
    const full=p?(p.endsWith('//')?p+url.replace(/^https?:\/\//,''):p+url):url;
    try{
      const r=await fetch(full,{headers:{'User-Agent':'Mozilla/5.0'}});
      if(!r.ok)continue;
      const txt=await r.text();
      const j=(p.startsWith('https://r.jina.ai/'))?JSON.parse(txt):JSON.parse(txt);
      return j;
    }catch{}
  }return null;
}
const API={
  async quote(s){
    const j=await fetchJSON(YF.quote(s));
    const q=j?.quoteResponse?.result?.[0];
    if(!q)return{};
    return{
      symbol:q.symbol,price:q.regularMarketPrice,prevClose:q.regularMarketPreviousClose,
      change:q.regularMarketChange,changePercent:q.regularMarketChangePercent,
      volume:q.regularMarketVolume,currency:q.currency,exchange:q.fullExchangeName||q.exchange,
      logo:`https://logo.clearbit.com/${(q.shortName||q.symbol||'').replace(/\s+/g,'')}.com`
    };
  },
  async candles(s){
    const j=await fetchJSON(YF.chart(s,'1mo','1d'));
    const res=j?.chart?.result?.[0];
    const ts=res?.timestamp||[];
    const q=res?.indicators?.quote?.[0]||{};
    const c=q.close||[];
    return ts.map((t,i)=>({t:t*1000,c:c[i]??null})).filter(d=>d.c!=null);
  },
  searchLocal(k){
    const q=String(k||'').trim().toLowerCase();
    return SYMBOLS.filter(s=>s.symbol.toLowerCase().includes(q)||(s.name||'').toLowerCase().includes(q)).slice(0,30);
  }
};

let watch=JSON.parse(localStorage.getItem('watchlist')||'[]');
const searchInput=$('#stockSearch'),searchBtn=$('#stockSearchBtn'),searchResults=$('#searchResults');
const watchlistEl=$('#watchlist'),sortSelect=$('#sortSelect'),refreshAllBtn=$('#refreshAll');
searchBtn.onclick=()=>doSearch();
searchInput.oninput=debounce(()=>doSearch(),350);
sortSelect.onchange=()=>renderWatchlist();
refreshAllBtn.onclick=()=>renderWatchlist(true);

async function doSearch(){
  const q=searchInput.value.trim();
  const list=API.searchLocal(q);
  renderCards(list,searchResults,{showAdd:true});
}
async function renderCards(items,container,{showAdd=false}={}){
  container.innerHTML='';
  if(!items?.length){container.innerHTML='<div class="text-muted">無資料</div>';return;}
  const enriched=await Promise.all(items.map(async i=>{
    const q=await API.quote(i.symbol).catch(()=>null);
    return {...i,quote:q};
  }));
  for(const it of enriched){
    const col=el('div','col-12 col-md-6 col-lg-4');
    const card=el('div','stock-card shadow-sm p-3');
    const up=it.quote?.changePercent>0,down=it.quote?.changePercent<0;
    card.style.background=up?'#f0fff4':down?'#fff5f5':'#fff';
    const head=el('div','d-flex justify-content-between align-items-center');
    const left=el('div');
    const logo=el('img');logo.src=it.quote?.logo||'';logo.onerror=()=>logo.style.display='none';
    logo.style.width='24px';logo.style.height='24px';logo.style.objectFit='contain';logo.classList.add('me-2');
    const name=el('div','fw-bold');name.textContent=it.name;
    const sym=el('div','text-muted small');sym.textContent=it.symbol;
    left.append(logo,name,sym);
    const chip=el('div','chip '+(up?'up':down?'down':''));
    chip.textContent=it.quote?.changePercent?pct(it.quote.changePercent):'—';
    head.append(left,chip);
    const price=el('div','fs-4 fw-bold mt-2');
    price.textContent=it.quote?.price?fmt(it.quote.price):'—';
    const sub=el('div','text-muted small mb-2');
    sub.textContent=it.quote?.volume?`成交量 ${Number(it.quote.volume).toLocaleString()}`:'暫無報價';
    const canvas=el('canvas','mini-chart mb-2');
    drawLineChart(canvas,it.symbol,up,down);
    const btns=el('div','d-flex gap-2');
    if(showAdd){
      const add=el('button','btn btn-sm btn-outline-primary');add.textContent='加入自選';add.onclick=()=>addWatch(it);
      btns.append(add);
    }else{
      const detail=el('button','btn btn-sm btn-outline-secondary');detail.textContent='詳細';
      detail.onclick=()=>window.open(`https://finance.yahoo.com/quote/${it.symbol}`,'_blank');
      const del=el('button','btn btn-sm btn-outline-danger');del.textContent='移除';del.onclick=()=>removeWatch(it.symbol);
      btns.append(detail,del);
    }
    card.append(head,price,sub,canvas,btns);
    col.append(card);
    container.append(col);
  }
}
async function drawLineChart(cv,symbol,up,down){
  const d=await API.candles(symbol);
  const ctx=cv.getContext('2d');
  const w=cv.width=cv.clientWidth||320,h=cv.height=cv.clientHeight||80;
  if(!d.length)return;
  const ys=d.map(x=>x.c);
  const min=Math.min(...ys),max=Math.max(...ys);
  ctx.beginPath();ctx.lineWidth=2;
  ctx.strokeStyle=up?'#137333':down?'#c5221f':'#666';
  d.forEach((x,i)=>{
    const X=i/(d.length-1)*w,Y=h-(x.c-min)/(max-min)*(h-4);
    if(i===0)ctx.moveTo(X,Y);else ctx.lineTo(X,Y);
  });
  ctx.stroke();
}
function addWatch(i){if(!watch.find(w=>w.symbol===i.symbol)){watch.push(i);localStorage.setItem('watchlist',JSON.stringify(watch));renderWatchlist(true);}}
function removeWatch(s){watch=watch.filter(w=>w.symbol!==s);localStorage.setItem('watchlist',JSON.stringify(watch));renderWatchlist();}
async function renderWatchlist(){await renderCards(watch,watchlistEl,{showAdd:false});}
renderWatchlist();
