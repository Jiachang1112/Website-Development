// assets/js/pages/camera-expense.js（完整版，寫入 Firestore: expenses/{email}/entries/{autoId}）

import { auth, db } from '../firebase.js';
import { collection, addDoc, doc, setDoc, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

import { ocrImage } from '../ocr.js';
import { OCR_DEFAULT_LANG, OCR_LANGS } from '../config.js';
import { cloudReady, cloudOCR } from '../cloud.js';

/* ===============================
   台灣收據/發票解析器（強化版）
   =============================== */
function normalizeText(t){
  return (t || '').replace(/\r/g,'').replace(/[ \t]+/g,' ').trim();
}
function findVendor(lines){
  const shopHint = /(公司|商行|商店|門市|百貨|豆腐|咖啡|茶|便當|早餐|飲|餐|廚|冰|麵|館|家|炸|燒|堂|屋|花|藥|書|超商|全家|萊爾富|OK|小七|7-?ELEVEN|COLD ?STONE)/i;
  const cand = [];
  lines.forEach((L,idx)=>{ if (shopHint.test(L)) cand.push([idx,L]); });
  if (cand.length) return cand[0][1].slice(0,40);
  const ti = lines.findIndex(s => /\d{4}[-\/\.]\d{1,2}[-\/\.]\d{1,2}.*\d{1,2}:\d{2}/.test(s));
  if (ti > 0) return lines[ti-1].slice(0,40);
  return '';
}
// 解析：回傳 { date, vendor, items:[{name, amount}], total }
function parseTaiwanReceipt(raw){
  const text = normalizeText(raw);
  const lines = text.split(/\n/).map(s => s.trim()).filter(Boolean);

  // 1) 日期
  let date = '';
  const dm = text.match(/(20\d{2}|19\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (dm){
    const y = dm[1], m = String(+dm[2]).padStart(2,'0'), d = String(+dm[3]).padStart(2,'0');
    date = `${y}-${m}-${d}`;
  }

  // 2) 關鍵字附近金額（優先）
  const kw = /(發票金額|應付金額|應收金額|總計|合計|金額)\D{0,6}(\d{1,4}(?:[,\，]\d{3})*(?:\.\d{1,2})?)/;
  let total = 0;
  for (const L of lines){
    const m = L.match(kw);
    if (m){
      total = parseFloat(String(m[2]).replace(/[,\，]/g,''));
      break;
    }
  }

  // 3) 沒抓到就用最大合理金額（避開卡號/序號等）
  if (!total){
    const amountRe = /(?:NT\$|＄)?\s*(\d{1,4}(?:[,\，]\d{3})*(?:\.\d{1,2})?)(?!\d)/g;
    const banHint  = /(卡|授權|序號|單號|載具|會員|點|號|稅率|收銀|機|門市|電話|統編|店號)/;
    let max = 0;
    for (const L of lines){
      if (banHint.test(L)) continue;
      if (/(\d+\s+){2,}\d+/.test(L)) continue; // 1685 **** 04330
      for (const m of L.matchAll(amountRe)){
        const n = parseFloat(String(m[1]).replace(/[,\，]/g,''));
        if (Number.isFinite(n) && n > max && n < 100000) max = n;
      }
    }
    total = max || 0;
  }

  // 4) 品項（找不到就用「餐飲食品」或商家名）
  let item = '';
  const itemLine = lines.find(s => /(餐飲|餐點|食品|飲料|咖啡|豆腐|便當|超商|麵|飯|湯|雞|牛|豬)/.test(s));
  if (itemLine) item = itemLine.replace(/\s+TX\b/i,'').slice(0,40);
  const vendor = findVendor(lines);
  if (!item) item = vendor || '餐飲食品';

  const items = total ? [{ name: item, amount: total }] : [];
  return { date, vendor, items, total };
}

/* ===============================
   頁面
   =============================== */
export function CameraExpensePage(){
  const el = document.createElement('div'); 
  el.className = 'container card';
  el.innerHTML = `
    <h3>拍照記帳</h3>
    <div class="row" style="gap:8px;flex-wrap:wrap">
      <button class="ghost" id="openCam">開啟相機 / 擷取</button>
      <button class="ghost" id="runOCR">OCR 辨識</button>
      <button class="ghost" id="runCloudOCR">雲端 OCR</button>
      <select id="lang" class="form-control" style="min-width:100px"></select>
    </div>
    <video id="v" playsinline style="width:100%;max-height:240px;display:none;border-radius:12px"></video>
    <canvas id="c" style="display:none"></canvas>
    <img id="img" style="max-width:100%;display:none;border-radius:12px"/>
    <div class="row" style="margin-top:8px;gap:8px;flex-wrap:wrap">
      <input id="item" placeholder="品項" class="form-control"/>
      <input id="cat" placeholder="分類" class="form-control"/>
      <input id="date" type="date" class="form-control"/>
      <input id="amt" type="text" inputmode="decimal" placeholder="金額" class="form-control"/>
      <input id="note" placeholder="備註（可留空）" class="form-control" />
      <button class="primary btn btn-primary" id="save">存為支出</button>
    </div>
  `;

  const v   = el.querySelector('#v');
  const c   = el.querySelector('#c');
  const img = el.querySelector('#img');

  const date = el.querySelector('#date');
  const amt  = el.querySelector('#amt');
  const item = el.querySelector('#item');
  const cat  = el.querySelector('#cat');
  const note = el.querySelector('#note');

  date.value = new Date().toISOString().slice(0,10);

  let stream = null, dataUrl = null;

  // 語系選單
  const langSel = el.querySelector('#lang');
  (OCR_LANGS || ['chi_tra','eng']).forEach(l=>{
    const o = document.createElement('option');
    o.value = l; o.textContent = l;
    langSel.appendChild(o);
  });
  langSel.value = OCR_DEFAULT_LANG || 'chi_tra';

  // 開相機 / 擷取
  el.querySelector('#openCam').addEventListener('click', async ()=>{
    if (!stream){
      stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment' } }).catch(()=>null);
      if (!stream){ alert('相機啟動失敗'); return; }
      v.srcObject = stream;
      await v.play();
      v.style.display = 'block';
      img.style.display = 'none';
    }else{
      c.width  = v.videoWidth; 
      c.height = v.videoHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(v,0,0);
      dataUrl = c.toDataURL('image/jpeg',0.92);
      img.src = dataUrl;
      img.style.display='block';
      v.pause();
      stream.getTracks().forEach(t=>t.stop());
      stream = null;
      v.style.display='none';
    }
  });

  // 金額輸入安全清理
  amt.addEventListener('input', () => {
    amt.value = amt.value.replace(/[^\d.,\-]/g, '');
  });

  /* ===== 將 OCR 結果自動帶入 ===== */
  async function applyReceiptText(text){
    const { date: d, vendor, items, total } = parseTaiwanReceipt(text || '');

    if (d) date.value = d;

    if (items.length === 1){
      const one = items[0];
      item.value = one.name || vendor || item.value || '餐飲食品';
      if (!cat.value && /餐|飲|食品|便當|豆腐|咖啡/.test(item.value)) cat.value = '餐飲';
      if (!amt.value) amt.value = String(one.amount);
      return;
    }

    if (items.length > 1){
      const preview = items.slice(0,7).map(i=>`• ${i.name} ${i.amount}`).join('\n') + (items.length>7?'\n...':'');
      const ok = confirm(`偵測到 ${items.length} 筆品項：\n${preview}\n\n【確定】= 每筆分開記\n【取消】= 全部合併成一筆`);
      if (ok){
        const user = auth.currentUser;
        if (!user?.email){ alert('請先登入再儲存'); return; }
        const ymd = date.value || new Date().toISOString().slice(0,10);
        for (const it of items){
          await saveToFirestore(user.email, {
            date: ymd,
            item: it.name || vendor || '收據',
            categoryId: (/餐|飲|食品|便當|豆腐|咖啡/.test(it.name||'')) ? '餐飲' : (cat.value || '其他'),
            amount: it.amount,
            note: note.value || ''
          });
        }
        alert('已分開記帳完成');
      }else{
        item.value = vendor || (items[0]?.name) || '收據';
        if (!cat.value && /餐|飲|食品|便當|豆腐|咖啡/.test(item.value)) cat.value = '餐飲';
        if (!amt.value) amt.value = String(total || items.reduce((s,i)=>s+i.amount,0));
      }
    }else{
      if (vendor) item.value = vendor;
    }
  }

  // 本地 OCR
  el.querySelector('#runOCR').addEventListener('click', async ()=>{
    if (!dataUrl){ alert('請先拍照或上傳'); return; }
    const text = await ocrImage(dataUrl, langSel.value).catch(()=> '');
    await applyReceiptText(text);
  });

  // 雲端 OCR
  el.querySelector('#runCloudOCR').addEventListener('click', async ()=>{
    if (!dataUrl){ alert('請先拍照或上傳'); return; }
    if (!cloudReady()){ alert('尚未設定 Supabase'); return; }
    const res = await cloudOCR(dataUrl, langSel.value).catch(()=> null);
    const text = res?.text || '';
    await applyReceiptText(text);
  });

  // Firestore 寫入（統一寫到 expenses/{email}/entries）
  async function saveToFirestore(userEmail, rec){
    await setDoc(
      doc(db, 'expenses', userEmail),
      { email: userEmail, updatedAt: serverTimestamp() },
      { merge: true }
    );
    await addDoc(collection(db, 'expenses', userEmail, 'entries'), {
      amount: rec.amount,
      categoryId: rec.categoryId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      date: rec.date,
      item: rec.item,
      note: rec.note || '',
      type: 'expense',            // 固定本頁為支出
      source: 'camera'            // 來源標記
    });
  }

  // 存為支出（單筆）
  el.querySelector('#save').addEventListener('click', async ()=>{
    const user = auth.currentUser;
    if (!user || !user.email){
      alert('請先登入帳號再記帳');
      return;
    }
    const rec = {
      date: date.value || new Date().toISOString().slice(0,10),
      item: item.value || '未命名品項',
      categoryId: cat.value || '其他',
      amount: parseFloat(String(amt.value || '0').replace(/[,\，]/g, '')),
      note: note.value || ''
    };
    if (!Number.isFinite(rec.amount) || rec.amount <= 0){
      alert('金額需為正數');
      return;
    }
    try{
      await saveToFirestore(user.email, rec);
      alert('已儲存支出');
      // 你可自行決定是否清空欄位
      // amt.value = ''; item.value=''; cat.value=''; note.value='';
    }catch(e){
      console.error(e);
      alert('寫入失敗：' + (e?.message || e));
    }
  });

  return el;
}
