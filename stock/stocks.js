// API 路徑
const API = {
  search:  '/api/stocks/search?q=',
  quote:   (symbol) => `/api/stocks/quote?symbol=${encodeURIComponent(symbol)}`,
  candles: (symbol, range='1mo', interval='1d') =>
           `/api/stocks/candles?symbol=${encodeURIComponent(symbol)}&range=${range}&interval=${interval}`,
};

const $ = (s)=>document.querySelector(s);
const el = (t,c)=>{const e=document.createElement(t);if(c)e.className=c;return e;};
const fmt=(n,d=2)=>Number(n).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});
const pct=(n)=>(n>0?'+':'')+fmt(n,2)+'%';
const debounce=(fn,ms=300)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);}};

let watch=JSON.parse(localStorage.getItem('watchlist')||'[]');
let autoTimer=null;

// 綁定
const searchInput=$('#stockSearch');
const searchBtn=$('#stockSearchBtn');
const searchResults=$('#searchResults');
const watchlistEl=$('#watchlist');
const sortSelect=$('#sortSelect');
const refreshAllBtn=$('#refreshAll');

// 搜尋
const doSearch=async()=>{
  const q=searchInput.value.trim();
  if(!q){searchResults.innerHTML='';return;}
  const res=await fetch(API.search+encodeURIComponent(q));
  const list=await res.json();
  renderCards(list,searchResults,{showAdd:true});
};
searchBtn.addEventListener('click',doSearch);
searchInput.addEventListener('input',debounce(doSearch,350));

sortSelect.addEventListener('change',()=>renderWatchlist());
refreshAllBtn.addEventListener('click',()=>renderWatchlist(true));

// 渲染卡片
async function renderCards(items,container,{showAdd=false}={}){
  container.innerHTML='';
  if(!items?.length){container.innerHTML='<div class=\"text-muted\">無資料</div>';return;}
  const enriched=await Promise.all(items.map(async it=>{
    try{const q=await(await fetch(API.quote(it.symbol))).json();return {...it,quote:q};}
    catch{return {...it,quote:null};}
  }));

  const sortBy=sortSelect.value;
  const sorted=[...enriched].sort((a,b)=>{
    const qa=a.quote||{},qb=b.quote||{};
    const pa=Number(qa.price??0),pb=Number(qb.price??0);
    const ca=Number(qa.changePercent??0),cb=Number(qb.changePercent??0);
    if(sortBy==='symbol')return a.symbol.localeCompare(b.symbol);
    if(sortBy==='name')return(a.name||'').localeCompare(b.name||'');
    if(sortBy==='priceDesc')return pb-pa;
    if(sortBy==='priceAsc')return pa-pb;
    if(sortBy==='changeDesc')return cb-ca;
    if(sortBy==='changeAsc')return ca-cb;
    return 0;
  });

  for(const item of sorted){
    const col=el('div','col-12 col-md-6 col-lg-4');
    const card=el('div','stock-card');
    const header=el('div','d-flex align-items-center justify-content-between mb-1');
    const left=el('div');const right=el('div');
    const sym=el('div','stock-symbol');sym.textContent=item.symbol;
    const name=el('div','text-muted small');name.textContent=item.name||item.exchange||'';
    left.append(sym,name);
    const chip=el('div','chip');right.append(chip);header.append(left,right);

    const priceRow=el('div','d-flex align-items-end justify-content-between');
    const p=el('div');
    const price=el('div');price.style.fontSize='20px';price.style.fontWeight='700';
    const sub=el('div','text-muted small');

    if(item.quote && typeof item.quote.price!=='undefined'){
      price.textContent=fmt(item.quote.price);
      const ch=Number(item.quote.changePercent||0);
      chip.textContent=Number.isFinite(ch)?pct(ch):'—';
      chip.classList.toggle('up',ch>0);
      chip.classList.toggle('down',ch<0);
      sub.textContent=`昨收 ${fmt(item.quote.prevClose??0)}｜成交量 ${Number(item.quote.volume||0).toLocaleString()}`;
    }else{
      price.textContent='—';chip.textContent='—';sub.textContent='暫無報價';
    }
    p.append(price,sub);

    const mini=el('canvas','mini-chart');
    drawMiniChart(mini,item.symbol).catch(()=>{});
    const btns=el('div','d-flex gap-2 mt-2');
    if(showAdd){
      const add=el('button','btn btn-sm btn-outline-primary');add.textContent='加入自選';add.onclick=()=>addWatch(item);btns.append(add);
    }else{
      const detail=el('button','btn btn-sm btn-outline-secondary');detail.textContent='詳細';detail.onclick=()=>openDetail(item.symbol);
      const rm=el('button','btn btn-sm btn-outline-danger');rm.textContent='移除';rm.onclick=()=>removeWatch(item.symbol);
      btns.append(detail,rm);
    }
    priceRow.append(p);
    card.append(header,priceRow,mini,btns);
    col.append(card);
    container.append(col);
  }
}

// 小型K線
async function drawMiniChart(canvas,symbol){
  const data=await(await fetch(API.candles(symbol,'1mo','1d'))).json();
  const w=canvas.width=canvas.clientWidth||320;
  const h=canvas.height=canvas.clientHeight||80;
  const ctx=canvas.getContext('2d');
  const ys=data.map(d=>d.c);
  if(!ys.length)return;
  const min=Math.min(...ys),max=Math.max(...ys);
  const pad=4,nx=i=>pad+(i/(ys.length-1))*(w-2*pad),ny=v=>h-pad-((v-min)/(max-min||1))*(h-2*pad);
  ctx.lineWidth=1.5;ctx.beginPath();
  ys.forEach((y,i)=>{const X=nx(i),Y=ny(y);if(i===0)ctx.moveTo(X,Y);else ctx.lineTo(X,Y);});
  ctx.stroke();
}

// 自選
function saveWatch(){localStorage.setItem('watchlist',JSON.stringify(watch));}
function addWatch(item){if(!watch.find(w=>w.symbol===item.symbol)){watch.push({symbol:item.symbol,name:item.name});saveWatch();renderWatchlist(true);}}
function removeWatch(symbol){watch=watch.filter(w=>w.symbol!==symbol);saveWatch();renderWatchlist();}
async function renderWatchlist(forceRefresh=false){await renderCards(watch,watchlistEl,{showAdd:false});}

// 詳細頁
function openDetail(symbol){window.open(`https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`,'_blank');}
