// assets/js/pages/camera-expense.js  (完整可替換版)
// Firestore: expenses/{email}/entries/{autoId}

import { auth, db } from '../firebase.js';
import { collection, addDoc, doc, setDoc, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

import { ocrImage } from '../ocr.js';
import { OCR_DEFAULT_LANG, OCR_LANGS } from '../config.js';
import { cloudReady, cloudOCR } from '../cloud.js';

/* ---------------------------------------
   共同小工具 + 台灣發票解析器 (V3-safe)
--------------------------------------- */
function normalizeText(t){
  return (t || '').replace(/\r/g,'').replace(/[ \t]+/g,' ').trim();
}
function cleanNumberToken(s){
  return s.replace(/[Oo]/g,'0')
          .replace(/[Il]/g,'1')
          .replace(/[,\，]/g,'')
          .replace(/[^\d.]/g,'');
}
function findVendor(lines){
  const shopHint = /(公司|商行|商店|門市|百貨|豆腐|咖啡|茶|便當|早餐|飲|餐|廚|冰|麵|館|家|炸|燒|堂|屋|藥|超商|全家|萊爾富|OK|7-?ELEVEN|COLD ?STONE)/i;
  const cand = [];
  lines.forEach((L,idx)=>{ if (shopHint.test(L)) cand.push([idx,L]); });
  if (cand.length) return cand[0][1].slice(0,40);
  const ti = lines.findIndex(s => /\d{4}[-\/\.]\d{1,2}[-\/\.]\d{1,2}.*\d{1,2}:\d{2}/.test(s));
  if (ti > 0) return lines[ti-1].slice(0,40);
  return '';
}

/* 更嚴格的台灣發票金額擷取（加上安全條件，避免整頁報錯） */
function parseTaiwanReceiptV3(raw){
  try{
    const text  = normalizeText(raw);
    const lines = text.split(/\n/).map(s=>s.trim()).filter(Boolean);

    // 日期
    let date = '';
    const dm = text.match(/(20\d{2}|19\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
    if (dm){
      date = `${dm[1]}-${String(+dm[2]).padStart(2,'0')}-${String(+dm[3]).padStart(2,'0')}`;
    }

    // 應忽略的行
    const ignoreLine = (L) =>
      /(末\d{3,4}|授權|授\d+|載具|會員|統編|電話|店號|序號|機|APP|卡|點|稅率|稅額|門市|地址|發票號碼|共通載具|機號|收銀)/.test(L);

    const keyRe = /(發\s*票\s*金\s*額|應\s*付\s*金\s*額|應\s*收\s*金\s*額|總\s*計|合\s*計|小\s*計)/;
    const numRe = /(\d[\d,，\.]{0,10})(?!\d)/g;

    // 先統計每個數字出現次數
    const freq = new Map();
    function incFreq(n){
      if (!Number.isFinite(n)) return;
      const k = String(n);
      freq.set(k, (freq.get(k)||0)+1);
    }

    // 候選池：n -> {score,freq}
    const bucket = new Map();
    function push(n, scoreDelta){
      if (!(Number.isFinite(n) && n>0 && n<100000)) return;
      const k = String(n);
      const o = bucket.get(k) || {score:0, freq: (freq.get(k)||0)};
      o.score += scoreDelta;
      bucket.set(k,o);
    }

    // 預掃頻率
    lines.forEach(L=>{
      for (const m of L.matchAll(numRe)){
        const n = parseFloat(cleanNumberToken(m[1]));
        if (Number.isFinite(n)) incFreq(n);
      }
    });

    // 計分
    for (let i=0;i<lines.length;i++){
      const L = lines[i];
      const next = lines[i+1] || '';

      const isKey     = keyRe.test(L);
      const isKeyNext = keyRe.test(next);

      const safeLine = !ignoreLine(L);

      for (const m of L.matchAll(numRe)){
        const raw = m[1];
        const n   = parseFloat(cleanNumberToken(raw));
        if (!Number.isFinite(n)) continue;

        const idx0   = m.index ?? 0;
        const around = L.slice(Math.max(0, idx0-2), idx0+raw.length+2);

        // 與英文字母緊鄰（例：TK89405809 的 5809）→ 強降分
        if (/[A-Z][0-9]|[0-9][A-Z]/i.test(around)) { push(n, -8); continue; }

        // 4 碼且沒千分位、又不在關鍵字行 → 視為店號/尾碼
        if (String(Math.trunc(n)).length === 4 && !/,|，/.test(raw) && !(isKey || isKeyNext)) continue;

        let s = 0;
        if (safeLine) s += 1;                         // 基礎分
        if (/,|，/.test(raw)) s += 3;                 // 有千分位
        if (/\bTX\b/i.test(L)) s += 1;                // 列上有 TX
        if (idx0 >= Math.max(0, L.length - 8)) s += 2;// 靠右
        if (isKey) s += 6;                            // 關鍵字同行
        if (isKeyNext) s += 3;                        // 關鍵字下一行

        const f = freq.get(String(n)) || 0;           // 次數越多越像總額
        if (f >= 2) s += 4;
        if (f >= 3) s += 2;

        push(n, s);
      }

      // 關鍵字下一行也掃
      if (!ignoreLine(next)){
        for (const m of next.matchAll(numRe)){
          const n = parseFloat(cleanNumberToken(m[1]));
          if (Number.isFinite(n)) push(n, isKey ? 2 : 0);
        }
      }
    }

    // 若無候選，再寬鬆掃一輪
    if (bucket.size === 0){
      for (const L of lines){
        if (ignoreLine(L)) continue;
        for (const m of L.matchAll(numRe)){
          const n = parseFloat(cleanNumberToken(m[1]));
          push(n, 1);
        }
      }
    }

    // 取分數最高 → 次數最多 → 數值較大
    let picked = 0, best = {score:-1, freq:-1};
    for (const [k, v] of bucket.entries()){
      const n = parseFloat(k);
      if (
        v.score > best.score ||
        (v.score === best.score && v.freq > best.freq) ||
        (v.score === best.score && v.freq === best.freq && n > picked)
      ){
        picked = n; best = v;
      }
    }

    // 品項 / 商家
    const itemLine = lines.find(s => /(餐飲|餐點|食品|飲料|便當|豆腐|咖啡|藥|麵|飯|湯)/.test(s));
    let item = itemLine ? itemLine.replace(/\s+TX\b/i,'').slice(0,40) : '';
    const vendor = findVendor(lines);
    if (!item) item = vendor || '餐飲食品';

    const items = picked ? [{ name: item, amount: picked }] : [];
    return { date, vendor, items, total: picked };
  }catch(e){
    console.error('[parseTaiwanReceiptV3] error:', e);
    return { date:'', vendor:'', items:[], total:0 };
  }
}

/* ---------------------------------------
   頁面
--------------------------------------- */
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

  // 元素
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

  /* ===== 將 OCR 結果自動帶入（使用 V3 解析器） ===== */
  async function applyReceiptText(text){
    try{
      const { date: d, vendor, items, total } = parseTaiwanReceiptV3(text || '');
      if (d) date.value = d;

      if (items.length === 1){
        const one = items[0];
        item.value = one.name || vendor || item.value || '餐飲食品';
        if (!cat.value && /餐|飲|食品|便當|豆腐|咖啡|藥/.test(item.value)) cat.value = '餐飲';
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
              categoryId: (/餐|飲|食品|便當|豆腐|咖啡|藥/.test(it.name||'')) ? '餐飲' : (cat.value || '其他'),
              amount: it.amount,
              note: note.value || ''
            });
          }
          alert('已分開記帳完成');
        }else{
          item.value = vendor || (items[0]?.name) || '收據';
          if (!cat.value && /餐|飲|食品|便當|豆腐|咖啡|藥/.test(item.value)) cat.value = '餐飲';
          if (!amt.value) amt.value = String(total || items.reduce((s,i)=>s+i.amount,0));
        }
      }else{
        if (vendor) item.value = vendor;
      }
    }catch(err){
      console.error('[applyReceiptText] error:', err);
      alert('解析發票時發生錯誤，先幫你保留圖片與欄位，金額請手動輸入。');
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
      type: 'expense',      // 固定本頁為支出
      source: 'camera'
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
      // 視需求清空欄位：
      // amt.value = ''; item.value=''; cat.value=''; note.value='';
    }catch(e){
      console.error(e);
      alert('寫入失敗：' + (e?.message || e));
    }
  });

  return el;
}

