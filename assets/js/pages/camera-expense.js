/* ============================
 * 解析器 v3（取代你目前的 parseTaiwanReceipt / parseTaiwanReceiptV2）
 * ============================ */
function _nz(s){ return (s||'').replace(/\r/g,'').trim(); }
function _normNumber(s){
  return String(s||'')
    .replace(/[Oo]/g,'0').replace(/[Il]/g,'1')
    .replace(/[,\uFF0C]/g,'')       // 半/全形逗號
    .replace(/[^\d.\-]/g,'');       // 只留數字與小數點、負號
}
function _dateISO(s){
  const m = String(s||'').match(/(20\d{2}|19\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if(!m) return '';
  const y=m[1], mo=String(+m[2]).padStart(2,'0'), d=String(+m[3]).padStart(2,'0');
  return `${y}-${mo}-${d}`;
}

function parseTaiwanReceiptV3(raw){
  const text  = _nz(raw);
  const lines = text.split(/\n/).map(s=>s.trim()).filter(Boolean);

  // 1) 日期
  const date = _dateISO(text);

  // 2) 先找店名/品項線索
  const vendorHint = /(公司|商行|門市|藥|超商|咖啡|餐|飲|便當|豆腐|冰|館|屋|家)/;
  let vendor = '';
  for(let i=0;i<lines.length;i++){
    const L = lines[i];
    if (vendorHint.test(L)){ vendor = L.slice(0,40); break; }
  }

  // 3) 金額：關鍵行優先（不可撿到卡號/載具/授權等）
  const IGNORE = /(末\d{3,4}|授權|載具|會員|統編|電話|店號|地址|序號|機號|卡號|點|稅率|稅額|票號|發票號碼|電子發票|APP)/;
  const KEY_ORDER = [
    /發票金額|應付金額|應收金額/,
    /總計/,
    /合計/,
    /小計/
  ];

  function pickFromLine(L){
    const mm = L.match(/(-?\d[\d,\uFF0C\.]*)\s*(?:TX)?\b/);
    if(!mm) return null;
    const n = parseFloat(_normNumber(mm[1]));
    if (!Number.isFinite(n) || n<=0 || n>=100000) return null;
    return n;
  }

  let amount = 0;
  // 3a) 關鍵詞當行 → 下一行（兩層都試）
  for (const KR of KEY_ORDER){
    for (let i=0;i<lines.length;i++){
      const L = lines[i];
      if (IGNORE.test(L)) continue;
      if (!KR.test(L)) continue;
      const cand = [L, lines[i+1]||''];
      for (const c of cand){
        const n = pickFromLine(c);
        if (n){ amount = n; break; }
      }
      if (amount) break;
    }
    if (amount) break;
  }

  // 3b) 備援：掃描所有非敏感行，取最大金額（避免時間/日期）
  if (!amount){
    for (const L of lines){
      if (IGNORE.test(L)) continue;
      if (/^\d{2}:\d{2}/.test(L)) continue; // 時間
      for (const m of L.matchAll(/(-?\d[\d,\uFF0C\.]*)/g)){
        const n = parseFloat(_normNumber(m[1]));
        if (Number.isFinite(n) && n>amount && n<100000) amount = n;
      }
    }
  }

  // 4) 品項：若有「餐/飲/食品…」類詞，用它，否則用 vendor
  let item = '';
  const itemLine = lines.find(L => /(餐飲|餐點|食品|飲料|豆腐|便當|藥)/.test(L));
  item = (itemLine || vendor || '').replace(/\s+TX\b/i,'').slice(0,40) || '餐飲食品';

  return {
    date, vendor, amount, item,
    category: /(餐|飲|食品|便當|豆腐)/.test(item) ? '餐飲' : ''
  };
}

/* =======================================
 * 把 OCR 結果套進表單（取代原 applyReceiptText）
 * ======================================= */
async function applyReceiptText(text){
  const r = parseTaiwanReceiptV3(text||'');

  if (r.date)  date.value = r.date;
  if (r.item)  item.value = r.item;
  if (!cat.value && r.category) cat.value = r.category;
  if (!amt.value && r.amount)   amt.value = String(r.amount);
}
