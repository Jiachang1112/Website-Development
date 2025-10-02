import { put } from '../db.js'; import { ocrImage } from '../ocr.js'; import { OCR_DEFAULT_LANG, OCR_LANGS } from '../config.js'; import { cloudReady, cloudOCR } from '../cloud.js';
export function CameraExpensePage(){
  const el=document.createElement('div'); el.className='container card';
  el.innerHTML=`<h3>拍照記帳</h3>
  <div class="row"><button class="ghost" id="openCam">開啟相機</button><button class="ghost" id="runOCR">OCR 辨識</button><button class="ghost" id="runCloudOCR">雲端 OCR</button><select id="lang"></select></div>
  <video id="v" playsinline style="width:100%;max-height:240px;display:none;border-radius:12px"></video>
  <canvas id="c" style="display:none"></canvas>
  <img id="img" style="max-width:100%;display:none;border-radius:12px"/>
  <div class="row" style="margin-top:8px"><input id="item" placeholder="品項"/><input id="cat" placeholder="分類"/><input id="date" type="date"/><input id="amt" type="number" placeholder="金額"/><button class="primary" id="save">存為支出</button></div>`;
  const v=el.querySelector('#v'), c=el.querySelector('#c'), img=el.querySelector('#img'), date=el.querySelector('#date'), amt=el.querySelector('#amt'), item=el.querySelector('#item'), cat=el.querySelector('#cat');
  date.value=new Date().toISOString().slice(0,10); let stream=null, dataUrl=null;
  const langSel=el.querySelector('#lang'); (OCR_LANGS||['eng']).forEach(l=>{ const o=document.createElement('option'); o.value=l; o.textContent=l; langSel.appendChild(o); }); langSel.value=OCR_DEFAULT_LANG||'eng';
  el.querySelector('#openCam').addEventListener('click', async ()=>{
    if(!stream){ stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}).catch(()=>null); if(!stream){ alert('相機啟動失敗'); return;} v.srcObject=stream; await v.play(); v.style.display='block'; }
    else{ c.width=v.videoWidth; c.height=v.videoHeight; const ctx=c.getContext('2d'); ctx.drawImage(v,0,0); dataUrl=c.toDataURL('image/jpeg',0.9); img.src=dataUrl; img.style.display='block'; v.pause(); stream.getTracks().forEach(t=>t.stop()); stream=null; v.style.display='none'; }
  });
  async function applyText(text){ const body=(text||'').replace(/\s+/g,' '); const head=(text||'').split(/\n/).map(s=>s.trim()).filter(Boolean)[0]||''; const nums=Array.from(body.matchAll(/(\d{1,6}(?:[.,]\d{1,2})?)/g)).map(m=>m[1].replace(',','.')); let max=0; for(const s of nums){ const n=parseFloat(s); if(!isNaN(n)&&n>max&&n<100000) max=n; } if(max) amt.value=String(max); const dm=body.match(/(20\d{2}|19\d{2})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/); if(dm){ date.value=`${dm[1]}-${String(+dm[2]).padStart(2,'0')}-${String(+dm[3]).padStart(2,'0')}`; } item.value=head.slice(0,40)||item.value||'收據'; if(/餐|飲|咖啡|便當|超商/.test(body) && !cat.value) cat.value='餐飲'; }
  el.querySelector('#runOCR').addEventListener('click', async ()=>{ if(!dataUrl){ alert('請先拍照或上傳'); return;} const text=await ocrImage(dataUrl, langSel.value).catch(e=>{alert('OCR 失敗'); return '';}); await applyText(text); });
  el.querySelector('#runCloudOCR').addEventListener('click', async ()=>{ if(!dataUrl){ alert('請先拍照或上傳'); return;} if(!cloudReady()){ alert('尚未設定 Supabase'); return;} const res=await cloudOCR(dataUrl, langSel.value).catch(e=>{alert('雲端 OCR 失敗'); return null;}); if(!res) return; const { text, fields } = res; if(fields?.amount) amt.value=fields.amount; if(fields?.date) date.value=fields.date; if(fields?.vendor) item.value=fields.vendor; await applyText(text||''); });
  el.querySelector('#save').addEventListener('click', async ()=>{ const rec={date:date.value,item:item.value||'未命名品項',cat:cat.value||'其他',amount:parseFloat(amt.value||'0')}; await put('expenses',rec); alert('已儲存支出'); });
  return el;
}