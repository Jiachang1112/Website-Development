// assets/js/pages/camera-expense.js（升級：自動抓品項/金額 + 多筆合併/拆分）
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

  date.value = new Date().toISOString().slice(0,10);
  let stream = null, dataUrl = null;

  // 語系選單
  const langSel = el.querySelector('#lang');
  (OCR_LANGS || ['eng']).forEach(l=>{
    const o = document.createElement('option');
    o.value = l; o.textContent = l;
    langSel.appendChild(o);
  });
  langSel.value = OCR_DEFAULT_LANG || 'eng';

  // --- 相機 ---
  el.querySelector('#openCam').addEventListener('click', async ()=>{
    if (!stream){
      stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment' } }).catch(()=>null);
      if (!stream){ alert('相機啟動失敗'); return; }
      v.srcObject = stream;
      await v.play();
      v.style.display = 'block';
    }else{
      c.width = v.videoWidth; c.height = v.videoHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(v,0,0);
      dataUrl = c.toDataURL('image/jpeg',0.9);
      img.src = dataUrl;
      img.style.display='block';
      v.pause();
      stream.getTracks().forEach(t=>t.stop());
      stream = null;
      v.style.display='none';
    }
  });

  // ====== 解析收據文字：抓出多筆「品項＋金額」、店名、日期、合計 ======
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

      // 常見格式：品名 ... 123 / 123.00 / $123
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

    // 找總計
    let total = 0;
    for (const ln of lines){
      const mm = ln.match(/(合計|總計|應收|實收)\D*?(\d{1,6}(?:[.,]\d{1,2})?)/i);
      if (mm){
        total = parseFloat(mm[2].replace(',', '.')) || 0;
        break;
      }
    }

    // 估計店名：第一行且不主要是數字
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

    // 只有一筆或沒抓到 → 直接填入金額（抓不到就挑最大數）
    if (lineItems.length <= 1){
      if (lineItems.length === 1){
        item.value = item.value || lineItems[0].name;
        amt.value  = String(lineItems[0].amount);
      }else{
        // 抓全文最大數（當作總額）
        const nums = Array.from(text.replace(/\s+/g,' ').matchAll(/\d{1,6}(?:[.,]\d{1,2})/g))
          .map(m=>parseFloat(m[0].replace(',', '.'))).filter(n=>Number.isFinite(n));
        const max = nums.length ? Math.max(...nums) : 0;
        if (max>0) amt.value = String(max);
      }
      return;
    }

    // 多筆項目：詢問要「分開記」或「合併成一筆」
    const preview = lineItems.slice(0,5).map(i=>`• ${i.name} ${i.amount}`).join('\n');
    const okSplit = confirm(
      `偵測到 ${lineItems.length} 筆品項：\n${preview}${lineItems.length>5?'\n…':''}\n\n` +
      `【確定】＝每筆分開記\n【取消】＝全部合併成一筆`
    );

    const user = auth.currentUser;
    if (!user?.email){ alert('請先登入帳號再記帳'); return; }

    if (okSplit){
      // 分開記
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
      // 合併成一筆
      const sum = lineItems.reduce((s,i)=>s+i.amount,0);
      item.value = vendor ? `${vendor}（多品項${lineItems.length}筆）` : `多品項${lineItems.length}筆`;
      amt.value  = String(total>0 ? total : sum);
      // 不直接寫入，讓使用者可改金額/分類再按「存為支出」
    }
  }

  // 本地 OCR
  el.querySelector('#runOCR').addEventListener('click', async ()=>{
    if (!dataUrl){ alert('請先拍照或上傳'); return; }
    const text = await ocrImage(dataUrl, langSel.value).catch(e=>{ alert('OCR 失敗'); return ''; });
    if (!text) return;
    await analyzeAndSuggest(text);
  });

  // 雲端 OCR
  el.querySelector('#runCloudOCR').addEventListener('click', async ()=>{
    if (!dataUrl){ alert('請先拍照或上傳'); return; }
    if (!cloudReady()){ alert('尚未設定 Supabase'); return; }
    const res = await cloudOCR(dataUrl, langSel.value).catch(e=>{ alert('雲端 OCR 失敗'); return null; });
    if (!res) return;

    // 優先用雲端回傳的結構化欄位
    const { text, fields } = res;
    if (fields?.amount) amt.value  = fields.amount;
    if (fields?.date)   date.value = fields.date;
    if (fields?.vendor) item.value = fields.vendor;

    await analyzeAndSuggest(text||'');
  });

  // --- Firestore 寫入 ---
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

  // 手動「存為支出」按鈕
  el.querySelector('#save').addEventListener('click', async ()=>{
    const user = auth.currentUser;
    if (!user?.email){ alert('請先登入帳號再記帳'); return; }
    const rec = {
      date:   date.value,
      item:   item.value || '未命名品項',
      cat:    cat.value  || '其他',
      amount: Math.max(0, parseFloat(amt.value||'0')||0),
      note:   '' // 手動存就不帶 OCR 的說明
    };
    if (!rec.amount){ alert('金額需為正數'); return; }
    await saveToFirestore(user.email, rec);
    alert('已儲存支出');
  });

  return el;
}
