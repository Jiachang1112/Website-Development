import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
serve(async (req: Request) => {
  if (req.method==='OPTIONS') return new Response('ok',{headers:cors});
  try{
    const { imageBase64, lang } = await req.json();
    const key = Deno.env.get('VISION_API_KEY'); if(!key) return new Response(JSON.stringify({error:'VISION_API_KEY not set'}),{status:500,headers:{...cors,'Content-Type':'application/json'}});
    const gRes = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${key}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requests:[{image:{content:imageBase64},features:[{type:'TEXT_DETECTION'}],imageContext:{languageHints: lang && lang!=='auto' ? [lang]: undefined}}]})});
    const gJson = await gRes.json();
    const text = gJson?.responses?.[0]?.fullTextAnnotation?.text || gJson?.responses?.[0]?.textAnnotations?.[0]?.description || '';
    // quick parse
    const body=(text||'').replace(/\s+/g,' '), head=(text||'').split(/\n/).map(s=>s.trim()).filter(Boolean)[0]||'';
    const nums = Array.from(body.matchAll(/(\d{1,6}(?:[.,]\d{1,2})?)/g)).map(m=>String(m[1]).replace(',','.'));
    let amount=0; for(const s of nums){ const n=parseFloat(s); if(!isNaN(n)&&n>amount&&n<100000) amount=n; }
    const dm = body.match(/(20\d{2}|19\d{2})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
    const date = dm ? `${dm[1]}-${String(+dm[2]).padStart(2,'0')}-${String(+dm[3]).padStart(2,'0')}` : undefined;
    return new Response(JSON.stringify({ text, fields:{ amount, date, vendor: head.slice(0,60) } }), {headers:{...cors,'Content-Type':'application/json'}});
  }catch(e){ return new Response(JSON.stringify({error:String(e)}),{status:500,headers:{...cors,'Content-Type':'application/json'}}); }
});