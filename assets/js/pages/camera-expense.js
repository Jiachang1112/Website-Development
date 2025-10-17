// 解析：回傳 { date, vendor, items:[{name, amount}], total }
function parseTaiwanReceiptV2(raw){
  const text  = normalizeText(raw);
  const lines = text.split(/\n/).map(s=>s.trim()).filter(Boolean);

  // 日期
  let date = '';
  const dm = text.match(/(20\d{2}|19\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (dm){
    date = `${dm[1]}-${String(+dm[2]).padStart(2,'0')}-${String(+dm[3]).padStart(2,'0')}`;
  }

  // 忽略的行（卡號/載具/授權/會員/電話/統編/英數ID…）
  const ignoreLine = (L) =>
    /(末\d{3,4}|授權|授\d+|載具|會員|統編|電話|店號|序號|機|APP|卡|點|稅率|稅額|門市|地址|發票號碼|共通載具|會員號|次累點|機號|收銀)/.test(L) ||
    /[A-Z]{1,3}\d{4,}/i.test(L); // 像 TK89405809 這種英數ID

  // 關鍵字
  const keyRe = /(發票金額|應付金額|應收金額|總計|合計|小計)/;

  // 蒐集候選數字並計分
  const bucket = new Map(); // n -> {score, freq}
  const push = (n, scoreAdd=0)=>{
    if (!(Number.isFinite(n) && n > 0 && n < 100000)) return;
    const k = String(n);
    const o = bucket.get(k) || {score:0,freq:0};
    o.score += scoreAdd;
    o.freq  += 1;
    bucket.set(k,o);
  };

  for (let i=0;i<lines.length;i++){
    const L = lines[i];
    const next = lines[i+1] || '';
    const isKey = keyRe.test(L);
    const isKeyNext = keyRe.test(next);

    // 本行 / 下一行的所有數字（去除千分位、全形）
    const pickNums = (S) => {
      const out = [];
      for (const m of S.matchAll(/(\d[\d,，\.]{0,10})(?!\d)/g)){
        const n = parseFloat(cleanNumberToken(m[1]));
        out.push({n, raw:m[1], idx:m.index ?? 0});
      }
      return out;
    };

    // 忽略不可信的行
    if (!ignoreLine(L)) {
      const nums = pickNums(L);
      nums.forEach(({n, raw, idx})=>{
        let s = 1;                   // 基礎分
        if (/\bTX\b/i.test(L)) s+=1; // 有 TX 常是單價/合計欄
        if (idx >= Math.max(0, L.length - 8)) s+=1; // 靠右（金額通常在右邊）
        if (isKey) s+=3;
        push(n, s);
      });
    }

    if (!ignoreLine(next)) {
      const nums2 = pickNums(next);
      nums2.forEach(({n})=>{
        let s = 1;
        if (isKeyNext) s+=2; // 關鍵字的下一行
        push(n, s);
      });
    }
  }

  // 沒抓到任何→再掃一次非敏感行取最大
  if (bucket.size === 0){
    for (const L of lines){
      if (ignoreLine(L)) continue;
      for (const m of L.matchAll(/(\d[\d,，\.]{0,10})(?!\d)/g)){
        push(parseFloat(cleanNumberToken(m[1])), 1);
      }
    }
  }

  // 挑分數最高；同分取「出現次數最多」；再同分取數值較大
  let picked = 0, best = {score:-1,freq:-1};
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
  const itemLine = lines.find(s => /(餐飲|餐點|食品|飲料|豆腐|便當|咖啡|藥|採藥|麵|飯|湯)/.test(s));
  let item = itemLine ? itemLine.replace(/\s+TX\b/i,'').slice(0,40) : '';
  const vendor = findVendor(lines);
  if (!item) item = vendor || '餐飲食品';

  const items = picked ? [{ name: item, amount: picked }] : [];
  return { date, vendor, items, total: picked };
}
