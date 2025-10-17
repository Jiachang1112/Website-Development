/* 更嚴格的台灣發票金額擷取（避免把會員點數/卡號尾碼當金額） */
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

    // 應忽略的行：＋加入「會員點數/累點/回饋」等字樣
    const ignoreLine = (L) =>
      /(末\d{3,4}|授權|授\d+|載具|會員(?:點|點數|累點)?|累點|回饋|紅利|可用點數|目前點數|本次點數|統編|電話|店號|序號|機|APP|卡|刷卡|點(?!(?:心|餐)))|稅率|稅額|門市|地址|發票號碼|共通載具|機號|收銀/i
      .test(L);

    const keyRe  = /(發\s*票\s*金\s*額|應\s*付\s*金\s*額|應\s*收\s*金\s*額|總\s*計|合\s*計|小\s*計)/;
    const numRe  = /(\d[\d,，\.]{0,10})(?!\d)/g;
    const moneyHint = /(NT\$|NT|＄|\$|元|金額|TX)\b/i;

    // 出現次數表
    const freq = new Map();
    const incFreq = (n)=>{ const k=String(n); freq.set(k,(freq.get(k)||0)+1); };

    // 候選池
    const bucket = new Map();
    const push = (n, sDelta)=>{
      if (!(Number.isFinite(n) && n>0 && n<100000)) return;
      const k = String(n);
      const o = bucket.get(k) || {score:0, freq:(freq.get(k)||0)};
      o.score += sDelta;
      bucket.set(k,o);
    };

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
      const safeLine  = !ignoreLine(L);

      for (const m of L.matchAll(numRe)){
        const raw = m[1];
        const n   = parseFloat(cleanNumberToken(raw));
        if (!Number.isFinite(n)) continue;

        const idx0   = m.index ?? 0;
        const around = L.slice(Math.max(0, idx0-2), idx0+raw.length+2);

        // 英文+數字黏在一起（卡號/載具/發票號）→ 強扣
        if (/[A-Z][0-9]|[0-9][A-Z]/i.test(around)) { push(n, -10); continue; }

        // 四位數，沒逗號，且不在關鍵字附近 → 當店號/尾碼處理
        if (String(Math.trunc(n)).length === 4 && !/,|，/.test(raw) && !(isKey || isKeyNext)) continue;

        let s = 0;
        if (safeLine) s += 1;
        if (/,|，/.test(raw)) s += 3;                   // 有千分位
        if (moneyHint.test(L)) s += 3;                  // 含 NT$/$/元/TX/金額
        if (idx0 >= Math.max(0, L.length - 8)) s += 2;  // 靠右
        if (isKey) s += 7;                              // 關鍵字同行
        if (isKeyNext) s += 4;                          // 關鍵字下一行

        // 很小的數字（<10）若沒有貨幣/關鍵字 → 降分（像「1、7、9」）
        if (n < 10 && !moneyHint.test(L) && !isKey && !isKeyNext) s -= 3;

        // 出現頻率（總額常在多處重複）
        const f = freq.get(String(n)) || 0;
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

    // 若還是沒有候選，再做一次寬鬆掃描（但仍排除 ignoreLine）
    if (bucket.size === 0){
      for (const L of lines){
        if (ignoreLine(L)) continue;
        for (const m of L.matchAll(numRe)){
          const n = parseFloat(cleanNumberToken(m[1]));
          push(n, moneyHint.test(L) ? 2 : 1);
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
