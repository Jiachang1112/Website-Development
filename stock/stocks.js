/* ===== Yahoo + 代理 ===== */
const PROXIES=['','https://cors.isomorphic-git.org/','https://r.jina.ai/http://','https://r.jina.ai/https://'];
const YF={
  quote:(s)=>`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(s)}`,
  chart:(s,r='1mo',i='1d')=>`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?range=${r}&interval=${i}`,
  search:(q)=>`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&newsCount=20`,
};
/* 內建清單（可擴充） */
const BASE=[
  {symbol:'2330.TW',name:'台積電'},{symbol:'2317.TW',name:'鴻海'},{symbol:'2454.TW',name:'聯發科'},
  {symbol:'0050.TW',name:'元大台灣50'},{symbol:'AAPL',name:'Apple'},{symbol:'MSFT',name:'Microsoft'},
  {symbol:'NVDA',name:'NVIDIA'},{symbol:'TSLA',name:'Tesla'},{symbol:'AMZN',name:'Amazon'}
];

/* ===== 工具 ===== */
const $=(s)=>document.querySelector(s);
const el=(t,c)=>{const e=document.createElement(t); if(c)e.className=c; return e;};
const fmt=(n,d=2)=>Number(n).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});
const pct=(n)=>(n>0?'+':'')+fmt(n,2)+'%';
const debounce=(fn,ms=300)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);}};

const css=(v)=>getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const C={primary:()=>css('--primary'), pweak:()=>css('--primary-weak'), up:()=>css('--up'), down:()=>css('--down'), grid:()=>css('--grid'), muted:()=>css('--muted')};

/* 主題 */
const themeSel=$('#theme');
function applyTheme(t){document.documentElement.setAttribute('data-theme',t);localStorage.setItem('theme',t); if(window._repaintCharts) window._repaintCharts();}
applyTheme(localStorage.getItem('theme')||'light'); themeSel.value=localStorage.getItem('theme')||'light'; themeSel.onchange=()=>applyTheme(themeSel.value);

/* ===== Fetch JSON（具備援） ===== */
async function fetchText(url){const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.text();}
async function getJSON(url){let err; for(const p of PROXIES){ const full=p?(p.endsWith('//')?p+url.replace(/^https?:\/\//,''):p+url):url; try{ const t=await fetchText(full); return JSON.parse(t);}catch(e){err=e;} } throw err||new Error('All proxies failed');}

/* ===== API ===== */
const API={
  async quote(s){
    const j=await getJSON(YF.quote(s));
    const q=j?.quoteResponse?.result?.[0]; if(!q) return {};
    return {symbol:q.symbol, name:q.shortName||s, price:q.regularMarketPrice, prevClose:q.regularMarketPreviousClose,
      changePercent:q.regularMarketChangePercent, volume:q.regularMarketVolume,
      logo:`https://logo.clearbit.com/${(q.shortName||q.symbol||'').replace(/\s+/g,'')}.com`};
  },
  async candles(s,r='1mo',i='1d'){
    const j=await getJSON(YF.chart(s,r,i)); const res=j?.chart?.result?.[0];
    const ts=res?.timestamp||[]; const q=res?.indicators?.quote?.[0]||{}; const c=q.close||[];
    return ts.map((t,k)=>({t:t*1000,c:c[k]??null})).filter(d=>d.c!=null);
  },
  async news(q){
    const j=await getJSON(YF.search(q)); const n=j?.news||[];
    return n.map(x=>({title:x.title,link:x.link||x.clickThroughUrl||x.url||'#',source:x.publisher||x.provider||'',time:(x.providerPublishTime?x.providerPublishTime*1000:Date.now())}));
  },
  searchLocal(k){ const q=String(k||'').trim().toLowerCase(); if(!q) return []; return BASE.filter(s=>s.symbol.toLowerCase().includes(q)||(s.name||'').toLowerCase().includes(q)).slice(0,60); }
};

/* ===== 狀態 ===== */
let watch=JSON.parse(localStorage.getItem('watchlist')||'[]'); // {symbol,name,logo?,tag?,order?}
let alerts=JSON.parse(localStorage.getItem('alerts')||'[]');   // {symbol,price,dir:'>=','<='}
const cache=JSON.parse(localStorage.getItem('cache')||'{}');   // 價格快取

/* ===== UI 元件 ===== */
const searchInput=$('#q'), btnSearch=$('#btnSearch'), results=$('#searchResults');
const sortSel=$('#sort'), refreshAll=$('#refreshAll');
const watchlist=$('#watchlist');
const distChartCanvas=$('#distChart'), moversChartCanvas=$('#moversChart');
const alertList=$('#alertList'), alertSymbol=$('#alertSymbol'), alertPrice=$('#alertPrice'), btnAddAlert=$('#btnAddAlert');
const bulkArea=$('#bulkAdd'), bulkTag=$('#bulkTag'), btnBulk=$('#btnBulkAdd');
const file=$('#file'), btnImport=$('#btnImport'), btnExport=$('#btnExport'), btnSample=$('#btnSample');
const scanChange=$('#scChange'), scanVol=$('#scVol'), btnRunScan=$('#btnRunScan'), scanResults=$('#scanResults');
const marketStatus=$('#marketStatus');

/* ===== 市場狀態判斷（台股 / 美股） ===== */
function isOpen(symbol, date=new Date()){
  const day=date.getDay();
  if(/[.]TW|[.]TWO$/i.test(symbol)){
    if(day===0||day===6) return false;
    const o=new Date(date), c=new Date(date); o.setHours(9,0,0,0); c.setHours(13,30,0,0);
    return date>=o && date<=c;
  }else{
    const et=new Date(date.toLocaleString('en-US',{timeZone:'America/New_York'})); const d=et.getDay(); if(d===0||d===6) return false;
    const o=new Date(et), c=new Date(et); o.setHours(9,30,0,0); c.setHours(16,0,0,0); return et>=o && et<=c;
  }
}
function updateMarketBadge(symbol='AAPL'){ const open=isOpen(symbol); marketStatus.textContent=open?'交易中':'休市'; marketStatus.className='badge '+(open?'text-bg-success':'text-bg-secondary'); }
updateMarketBadge();

/* ===== 共用渲染 ===== */
function card(item,{addable=false}={}){
  const up=(item.quote?.changePercent||0)>0, down=(item.quote?.changePercent||0)<0;
  const col=el('div','col-12 col-md-6 col-lg-4'); const card=el('div','stock-card'); col.append(card);
  const head=el('div','d-flex justify-content-between align-items-center'); card.append(head);
  const left=el('div'); const logo=el('img'); logo.src=item.logo||item.quote?.logo||''; logo.onerror=()=>logo.style.display='none';
  logo.style.width='24px'; logo.style.height='24px'; logo.style.objectFit='contain'; logo.classList.add('me-2');
  const name=el('div','fw-semibold'); name.textContent=item.name||item.quote?.name||item.symbol;
  const sym=el('div','small text-muted'); sym.textContent=item.symbol;
  left.append(logo,name,sym);
  const chip=el('div','chip '+(up?'up':(down?'down':''))); chip.textContent = (item.quote?.changePercent!=null)?pct(item.quote.changePercent):'—';
  head.append(left, chip);
  const price=el('div','fs-4 fw-bold mt-2'); price.textContent = (item.quote?.price!=null)?fmt(item.quote.price):'—';
  const sub=el('div','small text-muted mb-2'); sub.textContent=item.tag?`#${item.tag}`:'';
  const cv=el('canvas','mini mb-2');
  const btns=el('div','d-flex gap-2');
  if(addable){const b=el('button','btn btn-sm btn-outline-primary'); b.textContent='加入自選'; b.onclick=()=>addWatch(item); btns.append(b);}
  else{
    const d=el('button','btn btn-sm btn-outline-secondary'); d.textContent='詳細'; d.onclick=()=>openModal(item.symbol,item.name||item.quote?.name); btns.append(d);
    const e=el('button','btn btn-sm btn-outline-danger'); e.textContent='移除'; e.onclick=()=>removeWatch(item.symbol); btns.append(e);
  }
  card.append(price,sub,cv,btns);
  drawMini(cv,item.symbol,up,down);
  return col;
}
async function drawMini(cv,symbol,up,down){
  const data=await API.candles(symbol,'1mo','1d'); const ctx=cv.getContext('2d'); const w=cv.width=cv.clientWidth||320; const h=cv.height=cv.clientHeight||80;
  if(!data.length) return; const ys=data.map(x=>x.c); const min=Math.min(...ys),max=Math.max(...ys);
  ctx.beginPath(); ctx.lineWidth=2; ctx.strokeStyle=up?C.up():down?C.down():'#888';
  data.forEach((x,i)=>{const X=i/(data.length-1)*w, Y=h-(x.c-min)/(max-min)*(h-4); if(i===0)ctx.moveTo(X,Y); else ctx.lineTo(X,Y);}); ctx.stroke();
}

/* ===== 搜尋 ===== */
btnSearch.onclick=()=>doSearch();
searchInput.oninput=debounce(()=>doSearch(),300);
async function doSearch(){
  const list=API.searchLocal(searchInput.value.trim()); results.innerHTML='';
  const enriched=await Promise.all(list.map(async i=>({ ...i, quote: await API.quote(i.symbol).catch(()=>null) })));
  for(const it of enriched) results.append(card(it,{addable:true}));
}
sortSel.onchange=()=>renderWatch();
refreshAll.onclick=()=>renderWatch(true);

/* ===== 自選：CRUD + 拖曳排序 + 標籤 ===== */
function saveWatch(){localStorage.setItem('watchlist',JSON.stringify(watch));}
function addWatch(i){ if(!watch.find(w=>w.symbol===i.symbol)){ watch.push({symbol:i.symbol,name:i.name,logo:i.logo||'',tag:bulkTag.value||''}); saveWatch(); renderWatch(true);} }
function removeWatch(s){ watch=watch.filter(x=>x.symbol!==s); saveWatch(); renderWatch(true); }

watchlist.addEventListener('dragstart',e=>{ if(e.target.closest('[data-symbol]')) { e.target.classList.add('dragging'); e.dataTransfer.effectAllowed='move'; }});
watchlist.addEventListener('dragend',e=>{ e.target.classList.remove('dragging'); saveNewOrder(); });
watchlist.addEventListener('dragover',e=>{
  e.preventDefault(); const dragging=watchlist.querySelector('.dragging'); const items=[...watchlist.querySelectorAll('[data-symbol]:not(.dragging)')];
  const after=items.find(it=> e.clientY <= it.getBoundingClientRect().top + it.offsetHeight/2 );
  if(after) watchlist.insertBefore(dragging, after); else watchlist.appendChild(dragging);
});
function saveNewOrder(){ const arr=[...watchlist.querySelectorAll('[data-symbol]')].map(x=>x.dataset.symbol); watch.sort((a,b)=>arr.indexOf(a.symbol)-arr.indexOf(b.symbol)); saveWatch(); }

async function renderWatch(force=false){
  watchlist.innerHTML='';
  const sorted=[...watch];
  const by=sortSel.value;
  const enriched=await Promise.all(sorted.map(async it=>{ const q=await API.quote(it.symbol).catch(()=>cache[it.symbol]?.quote||null); cache[it.symbol]={quote:q,ts:Date.now()}; return {...it, quote:q}; }));
  localStorage.setItem('cache',JSON.stringify(cache));
  enriched.sort((a,b)=>{
    const qa=a.quote||{}, qb=b.quote||{}; const pa=Number(qa.price??0), pb=Number(qb.price??0); const ca=Number(qa.changePercent??0), cb=Number(qb.changePercent??0);
    if(by==='symbol') return a.symbol.localeCompare(b.symbol);
    if(by==='name') return (a.name||'').localeCompare(b.name||'');
    if(by==='priceDesc') return pb-pa; if(by==='priceAsc') return pa-pb;
    if(by==='changeDesc') return cb-ca; if(by==='changeAsc') return ca-cb; return 0;
  });
  for(const it of enriched){ const node=card(it); node.setAttribute('draggable','true'); node.dataset.symbol=it.symbol; watchlist.append(node); }
  // 統計頁一併更新
  updateStats(enriched);
}
renderWatch();

/* ===== 統計（圓餅 + Top movers） ===== */
let distChart, moversChart;
function updateStats(list){
  const up=list.filter(i=> (i.quote?.changePercent||0) > 0).length;
  const down=list.filter(i=> (i.quote?.changePercent||0) < 0).length;
  const flat=list.length - up - down;
  const distCtx=distChartCanvas.getContext('2d'), mvCtx=moversChartCanvas.getContext('2d');
  if(distChart) distChart.destroy(); if(moversChart) moversChart.destroy();
  distChart=new Chart(distCtx,{type:'doughnut',data:{labels:['上漲','下跌','持平'],datasets:[{data:[up,down,flat],backgroundColor:[C.up(),C.down(),css('--neutral')]}]},options:{plugins:{legend:{position:'bottom'}},cutout:'65%'}});
  const movers=[...list].filter(i=>isFinite(i.quote?.changePercent)).sort((a,b)=>Math.abs(b.quote.changePercent)-Math.abs(a.quote.changePercent)).slice(0,5).reverse();
  moversChart=new Chart(mvCtx,{type:'bar',data:{labels:movers.map(x=>x.symbol),datasets:[{data:movers.map(x=>x.quote.changePercent),backgroundColor:movers.map(x=>x.quote.changePercent>=0?C.up():C.down())}]},options:{indexAxis:'y',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${fmt(c.raw,2)}%`}}},scales:{x:{ticks:{callback:v=>`${v}%`}}}});
}
window._repaintCharts=()=>{ if(distChart) updateStats(watch.map(w=>({ ...w, quote: cache[w.symbol]?.quote }))); };

/* ===== 詳細視窗（1分線 + 新聞 + 盤中底色） ===== */
let modalChart, modalInstance, liveTimer=null, currentSymbol='';
function sessionShadePlugin(openColor,closeColor){
  return { id:'shade', beforeDraw(chart){ const {ctx, chartArea:{left,right,top,bottom}}=chart; ctx.save(); ctx.fillStyle=openColor; ctx.fillRect(left,top,right-left,bottom-top); ctx.restore(); } };
}
function isOpenBadge(symbol){ const open=isOpen(symbol); $('#marketBadge').textContent=open?'交易中':'休市'; $('#marketBadge').className='badge '+(open?'text-bg-success':'text-bg-secondary'); }
function fav(url){ try{const h=new URL(url).hostname; return `https://www.google.com/s2/favicons?sz=32&domain=${h}`;}catch{return '';} }

async function openModal(symbol,name){
  currentSymbol=symbol;
  const q=await API.quote(symbol); $('#modalTitle').textContent=`${name||q.name||symbol} (${symbol})`;
  $('#modalPrice').textContent = q.price!=null?fmt(q.price):'—'; $('#modalChange').textContent = (q.changePercent!=null)?pct(q.changePercent):'—';
  $('#modalChange').style.color=(q.changePercent>0?C.up():q.changePercent<0?C.down():C.muted());
  await loadChart(symbol,'1mo','1d'); await loadNews(symbol);
  isOpenBadge(symbol); updateMarketBadge(symbol);
  modalInstance=new bootstrap.Modal($('#stockModal')); modalInstance.show();
  document.querySelectorAll('[data-range]').forEach(btn=>{
    btn.onclick=()=>{ document.querySelectorAll('[data-range]').forEach(b=>b.classList.remove('active')); btn.classList.add('active');
      const r=btn.dataset.range,i=btn.dataset.intv; stopLive(); if(r==='1d'&&i==='1m'&&$('#liveToggle').checked) startLive(); loadChart(symbol,r,i); };
  });
  $('#liveToggle').onchange=()=>{ stopLive(); const act=document.querySelector('[data-range].active'); if(act?.dataset.range==='1d'&&act.dataset.intv==='1m'&&$('#liveToggle').checked) startLive(); };
}
function startLive(){ liveTimer=setInterval(()=>{ const act=document.querySelector('[data-range].active'); if(act?.dataset.range==='1d'&&act.dataset.intv==='1m') loadChart(currentSymbol,'1d','1m',true); isOpenBadge(currentSymbol);},30000); }
function stopLive(){ if(liveTimer){clearInterval(liveTimer); liveTimer=null;} }
async function loadChart(symbol,range,interval,append=false){
  const data=await API.candles(symbol,range,interval); const labels=data.map(x=>new Date(x.t).toLocaleString()); const vals=data.map(x=>x.c);
  const ctx=$('#modalChart').getContext('2d'); const shade=isOpen(symbol)?'rgba(34,197,94,.08)':'rgba(148,163,184,.10)';
  if(!modalChart||!append){ if(modalChart) modalChart.destroy();
    modalChart=new Chart(ctx,{type:'line',data:{labels,datasets:[{data:vals,borderColor:C.primary(),backgroundColor:C.pweak(),fill:true,tension:.25}]},options:{plugins:{legend:{display:false}},scales:{x:{grid:{color:C.grid()}},y:{grid:{color:C.grid()}}},animation:false},plugins:[sessionShadePlugin(shade)]});
  }else{ modalChart.data.labels=labels; modalChart.data.datasets[0].data=vals; modalChart.update(); }
}
async function loadNews(symbol){
  const list=$('#newsList'); list.innerHTML='<div class="text-muted small">載入中…</div>';
  try{ const items=await API.news(symbol); list.innerHTML=''; items.slice(0,20).forEach(n=>{ const a=el('a','list-group-item list-group-item-action d-flex align-items-start gap-2 news-item'); a.href=n.link;a.target='_blank'; const img=el('img'); img.src=fav(n.link); img.width=16; img.height=16; img.alt='src'; const box=el('div'); const t=el('div','fw-semibold'); t.textContent=n.title||'(無標題)'; const s=el('div','small text-muted'); s.textContent=`${n.source||''} · ${new Date(n.time).toLocaleString()}`; box.append(t,s); a.append(img,box); list.append(a); }); }
  catch{ list.innerHTML='<div class="text-muted small">新聞載入失敗</div>'; }
}

/* ===== 到價提醒（本地） ===== */
function renderAlerts(){
  alertList.innerHTML=''; for(const a of alerts){ const li=el('li','list-group-item d-flex justify-content-between align-items-center'); li.textContent=`${a.symbol} ${a.dir} ${a.price}`; const del=el('button','btn btn-sm btn-outline-danger'); del.textContent='刪除'; del.onclick=()=>{alerts=alerts.filter(x=>x!==a); localStorage.setItem('alerts',JSON.stringify(alerts)); renderAlerts();}; li.append(del); alertList.append(li); }
}
btnAddAlert.onclick=()=>{ const s=alertSymbol.value.trim(), p=parseFloat(alertPrice.value); if(!s||!isFinite(p)) return alert('請輸入代碼與價格'); alerts.push({symbol:s,price:p,dir:(p>=0?'>=':'>=')}); localStorage.setItem('alerts',JSON.stringify(alerts)); renderAlerts(); };
renderAlerts();
async function pollAlerts(){ for(const a of alerts){ try{ const q=await API.quote(a.symbol); if(!q.price) continue; if(q.price>=a.price){notify(`到價提醒：${a.symbol} ≥ ${a.price}（現價 ${fmt(q.price)}）`); alerts=alerts.filter(x=>x!==a); localStorage.setItem('alerts',JSON.stringify(alerts)); renderAlerts();} }catch{} } }
setInterval(pollAlerts, 30000);
function notify(msg){ if('Notification' in window){ if(Notification.permission==='granted'){ new Notification(msg); } else if(Notification.permission!=='denied'){ Notification.requestPermission(); } } try{ const audio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAZGF0YQAAAAA='); audio.play().catch(()=>{});}catch{} }

/* ===== 批次匯入/匯出 & 快速新增 ===== */
btnSample.href='data:text/csv;charset=utf-8,'+encodeURIComponent("symbol,name,logo,tag\n2330.TW,台積電,,長線\nAAPL,Apple,https://logo.clearbit.com/apple.com,美股\n");
btnExport.onclick=()=>{ const rows=[['symbol','name','logo','tag'],...watch.map(w=>[w.symbol,w.name||'',w.logo||'',w.tag||''])]; const csv=rows.map(r=>r.map(v=>String(v).includes(',')?`"${String(v).replace(/"/g,'""')}"`:v).join(',')).join('\n'); const a=document.createElement('a'); a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv); a.download='watchlist.csv'; a.click(); };
btnImport.onclick=()=>{ const f=file.files?.[0]; if(!f) return alert('請先選擇檔案'); const ext=f.name.toLowerCase().split('.').pop(); if(ext==='csv'){ const r=new FileReader(); r.onload=()=>importRows(parseCSV(String(r.result))); r.readAsText(f,'utf-8'); } else { const r=new FileReader(); r.onload=(e)=>{ const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'}); const ws=wb.Sheets[wb.SheetNames[0]]; const rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:false}); importRows(rows); }; r.readAsArrayBuffer(f); } };
function parseCSV(text){ return text.split(/\r?\n/).filter(Boolean).map(line=>{ const out=[]; let cur='',inq=false; for(let i=0;i<line.length;i++){const ch=line[i]; if(ch=='"'){ if(inq&&line[i+1]=='"'){cur+='"';i++;} else inq=!inq;} else if(ch===','&&!inq){ out.push(cur); cur=''; } else cur+=ch; } out.push(cur); return out; }); }
function importRows(rows){ let start=0; const header=rows[0]?.map(x=>String(x).toLowerCase()); if(header?.includes('symbol')) start=1; let added=0; for(let i=start;i<rows.length;i++){ const [s='',n='',l='',t='']=rows[i]; const sym=String(s).trim(); if(!sym) continue; if(!watch.find(w=>w.symbol===sym)){ watch.push({symbol:sym,name:String(n||'').trim(),logo:String(l||'').trim(),tag:String(t||'').trim()}); added++; } } saveWatch(); renderWatch(true); alert(`匯入完成：新增 ${added} 檔`); }
btnBulk.onclick=()=>{ const raw=bulkArea.value.trim(); if(!raw) return; const list=raw.split(/[\s,]+/).map(s=>s.trim()).filter(Boolean); let added=0; for(const sym of list){ if(!watch.find(w=>w.symbol===sym)) { watch.push({symbol:sym,tag:bulkTag.value.trim()}); added++; } } saveWatch(); renderWatch(true); alert(`已加入 ${added} 檔`); };

/* ===== 掃描器（本地） ===== */
btnRunScan.onclick=async()=>{ const target=Number(scanChange.value||0), minVol=Number(scanVol.value||0); scanResults.innerHTML=''; const enriched=await Promise.all(watch.map(async w=>({ ...w, quote: await API.quote(w.symbol).catch(()=>null) }))); const hit=enriched.filter(i=> (Number(i.quote?.changePercent)||0) >= target && (Number(i.quote?.volume)||0) >= minVol); if(!hit.length){ scanResults.innerHTML='<div class="text-muted">無結果</div>'; return; } hit.sort((a,b)=>b.quote.changePercent-a.quote.changePercent); for(const it of hit){ scanResults.append(card(it)); } };
