// assets/js/pages/camera-expense.js（新增：拍照並辨識）
import { auth, db } from '../firebase.js';
import { collection, addDoc, doc, setDoc, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

import { ocrImage } from '../ocr.js';
import { OCR_DEFAULT_LANG, OCR_LANGS } from '../config.js';
import { cloudReady, cloudOCR } from '../cloud.js';

export function CameraExpensePage(){
  const el = document.createElement('div');
  el.className = 'container card';
  el.innerHTML = `
    <h3>拍照記帳</h3>
    <div class="row">
      <button class="ghost" id="openCam">開啟相機</button>
      <button class="ghost" id="snapAndOCR">拍照並辨識</button>
      <button class="ghost" id="runOCR">OCR 辨識</button>
      <button class="ghost" id="runCloudOCR">雲端 OCR</button>
      <select id="lang"></select>
    </div>
    <video id="v" playsinline style="width:100%;max-height:240px;display:none;border-radius:12px"></video>
    <canvas id="c" style="display:none"></canvas>
    <img id="img" style="max-width:100%;display:none;border-radius:12px"/>
    <div class="row" style="margin-top:8px">
      <input id="item" placeholder="品項"/>
      <input id="cat" placeholder="分類"/>
      <input id="date" type="date"/>
      <input id="amt" type="number" placeholder="金額"/>
      <button class="primary" id="save">存為支出</button>
    </div>
  `;

  const v = el.querySelector('#v');
  const c = el.querySelector('#c');
  const img = el.querySelector('#img');
  const date = el.querySelector('#date');
  const amt  = el.querySelector('#amt');
  const item = el.querySelector('#item');
  const cat  = el.querySelector('#cat');
  const snapBtn = el.querySelector('#snapAndOCR');

  date.value = new Date().toISOString().slice(0,10);
  let stream = null, dataUrl = null, busy = false;

  // 語系
  const langSel = el.querySelector('#lang');
  (OCR_LANGS || ['eng']).forEach(l=>{
    const o = document.createElement('option');
    o.value = l; o.textContent = l;
    langSel.appendChild(o);
  });
  langSel.value = OCR_DEFAULT_LANG || 'eng';

  // ========== 共用小工具 ==========
  const setBusy = (val) => {
    busy = val;
    [snapBtn, el.querySelector('#runOCR'), el.querySelector('#runCloudOCR'),
     el.querySelector('#openCam'), el.querySelector('#save')]
      .forEach(b=> b && (b.disabled = !!val));
    snapBtn.textContent = val ? '辨識中…' : (stream ? '拍照並辨識（再按一次）' : '拍照並辨識');
  };

  function captureFrame(){
    if (!v.videoWidth) return null;
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(v,0,0);
    return c.toDataURL('image/jpeg',0.9);
  }

  async function runOcrPipeline(imageDataUrl){
    setBusy(true);
    try{
      let text = '';
      if (cloudReady()){
        const res = await cloudOCR(imageDataUrl, langSel.value);
        if (res?.fields?.amount) amt.value  = res.fields.amount;
        if (res?.fields?.date)   date.value = res.fields.date;
        if (res?.fields?.vendor) item.value = res.fields.vendor;
        text = res?.text || '';
      }else{
        text = await ocrImage(imageDataUrl, langSel.value);
      }
      if (!text){ alert('未辨識到文字，請調整相機距離或光線再試'); return; }
      await analyzeAndSuggest(text);
    }catch(e){
      console.error(e); alert('辨識失敗：' + (e?.message || e));
    }finally{
      setBusy(false);
    }
  }

  // ========== 你的原相機鍵：第一次開相機、第二次截圖 ==========
  el.querySelector('#openCam').addEventListener('click', async ()=>{
    if (!stream){
      stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment' } }).catch(()=>null);
      if (!stream){ alert('相機啟動失敗'); return; }
      v.srcObject = stream;
      await v.play();
      v.style.display = 'block';
      snapBtn.textContent = '拍照並辨識（再按一次）';
    }else{
      dataUrl = captureFrame();
      if (!dataUrl){ alert('擷取影像失敗'); return; }
      img.src = dataUrl; img.style.display='block';
      v.pause(); stream.getTracks().forEach(t=>t.stop());
      stream = null; v.style.display='none';
      snapBtn.textContent = '拍照並辨識';
    }
  });

  // ========== 新增：拍照並辨識 ==========
  snapBtn.addEventListener('click', async ()=>{
    if (busy) return;
    // 若還沒開相機 → 先開相機預覽
    if (!stream && !dataUrl){
      const ok = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment' } }).catch(()=>null);
      if (!ok){ alert('相機啟動失敗'); return; }
      stream = ok; v.srcObject = stream;
      await v.play(); v.style.display = 'block';
      snapBtn.textContent = '拍照並辨識（再按一次）';
      return; // 等使用者再按一次
    }

    // 已在預覽狀態 → 擷取 + OCR
    if (stream){
      const shot = captureFrame();
      if (!shot){ alert('擷取影像失敗'); return; }
      dataUrl = shot;
      img.src = dataUrl; img.style.display='block';
      v.pause(); stream.getTracks().forEach(t=>t.stop());
      stream = null; v.style.display='none';
      snapBtn.textContent = '拍照並辨識';
    }

    if (!dataUrl){ alert('沒有影像可辨識'); return; }
    await runOcrPipeline(dataUrl);
  });

  // ====== 下面維持你原本 OCR/雲端OCR/寫入的流程（略） ======
  // 本地 OCR 鍵
  el.querySelector('#runOCR').addEventListener('click', async ()=>{
    if (!dataUrl){ alert('請先拍照或上傳'); return; }
    await runOcrPipeline(dataUrl);
  });

  // 雲端 OCR 鍵
  el.querySelector('#runCloudOCR').addEventListener('click', async ()=>{
    if (!dataUrl){ alert('請先拍照或上傳'); return; }
    if (!cloudReady()){ alert('尚未設定 Supabase'); return; }
    await runOcrPipeline(dataUrl);
  });

  // ====== 以下為你前面版本的分析＋寫入（保持不動） ======
  function normalize(s){ return (s||'').replace(/[ \t]+/g,' ').trim(); }
  function parseDateFrom(text){
    const body = text.replace(/\s+/g,' ');
    const dm = body.match(/(20\d{2}|19\d{2})[\/\-\.年](\d{1,2})[\/\-\.月](\d{1,2})/);
    if (!dm) return null;
    const y=dm[1], m=('0'+(+dm[2])).slice(-2), d=('0'+(+dm[3])).slice(-2);
    return `${y}-${m}-${d}`;
  }
  function parseLineItems(text){
    const exIgnore = /(小計|合計|總計|找零|找赎|稅|稅額|應收|實收|總額|收銀|付款|折扣|信用卡|現金|交易|發票|統編)/i;
    const lines = text.split('\n').map(s=>normalize(s)).filter(Boolean);
    const items = [];
    for (const ln of lines){
      if (exIgnore.test(ln)) continue;
      const m = ln.match(/(.+?)\s*[:：\-]?\s*(\$?\s*\d{1,5}(?:[.,]\d{1,2})?)\s*$/);
      if (m){
        let name = normalize(m[1]).replace(/[*#•·]/g,'').trim();
        let nstr = m[2].replace(/[^0-9.,-]/g,'').replace(',', '.');
        const val = parseFloat(nstr);
        if (name && Number.isFinite(val) && val>0){
          items.push({ name, amount: Number(val.toFixed(2)) });
        }
      }
    }
    let total = 0;
    for (const ln of lines){
      const mm = ln.match(/(合計|總計|應收|實收)\D*?(\d{1,6}(?:[.,]\d{1,2})?)/i);
      if (mm){ total = parseFloat(mm[2].replace(',', '.')) || 0; break; }
    }
    let vendor = '';
    if (lines.length){
      const first = lines[0];
      if (!/\d{3,}/.test(first)) vendor = first.slice(0,40);
    }
    return { items, total, vendor };
  }

  async function analyzeAndSuggest(text){
    const parsedDate = parseDateFrom(text);
    if (parsedDate) date.value = parsedDate;

    const { items: lineItems, total, vendor } = parseLineItems(text);
    if (vendor && !item.value) item.value = vendor;

    if (lineItems.length <= 1){
      if (lineItems.length === 1){
        item.value = item.value || lineItems[0].name;
        amt.value  = String(lineItems[0].amount);
      }else{
        const nums = Array.from(text.replace(/\s+/g,' ').matchAll(/\d{1,6}(?:[.,]\d{1,2})/g))
          .map(m=>parseFloat(m[0].replace(',', '.'))).filter(n=>Number.isFinite(n));
        const max = nums.length ? Math.max(...nums) : 0;
        if (max>0) amt.value = String(max);
      }
      return;
    }

    const preview = lineItems.slice(0,5).map(i=>`• ${i.name} ${i.amount}`).join('\n');
    const okSplit = confirm(
      `偵測到 ${lineItems.length} 筆品項：\n${preview}${lineItems.length>5?'\n…':''}\n\n` +
      `【確定】＝每筆分開記\n【取消】＝全部合併成一筆`
    );

    const user = auth.currentUser;
    if (!user?.email){ alert('請先登入帳號再記帳'); return; }

    if (okSplit){
      for (const it of lineItems){
        await saveToFirestore(user.email, {
          date: date.value,
          item: it.name,
          cat:  cat.value || '其他',
          amount: it.amount,
          note: vendor ? `收據：${vendor}` : '',
        });
      }
      alert(`已寫入 ${lineItems.length} 筆`);
      return;
    }else{
      const sum = lineItems.reduce((s,i)=>s+i.amount,0);
      item.value = vendor ? `${vendor}（多品項${lineItems.length}筆）` : `多品項${lineItems.length}筆`;
      amt.value  = String(total>0 ? total : sum);
    }
  }

  async function saveToFirestore(userEmail, rec){
    await setDoc(
      doc(db, 'expenses', userEmail),
      { email: userEmail, updatedAt: serverTimestamp() },
      { merge: true }
    );
    await addDoc(collection(db, 'expenses', userEmail, 'records'), {
      ...rec,
      type: 'expense',
      source: 'camera',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  el.querySelector('#save').addEventListener('click', async ()=>{
    const user = auth.currentUser;
    if (!user?.email){ alert('請先登入帳號再記帳'); return; }
    const rec = {
      date:   date.value,
      item:   item.value || '未命名品項',
      cat:    cat.value  || '其他',
      amount: Math.max(0, parseFloat(amt.value||'0')||0),
      note:   ''
    };
    if (!rec.amount){ alert('金額需為正數'); return; }
    await saveToFirestore(user.email, rec);
    alert('已儲存支出');
  });

  return el;
}
