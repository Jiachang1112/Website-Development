export function SettingsPage(){
  const el=document.createElement('div'); el.className='container card';
  el.innerHTML=`<h3>設定</h3>
  <p class="small">主題、幣別、匯率等。</p>
  <div class="row"><label class="small">本位幣</label><input id="base" value="TWD"/><label class="small">匯率</label><input id="rates" placeholder="USD=32, JPY=0.22"/></div>
  <button class="ghost" id="save">儲存</button>`;
  const base=el.querySelector('#base'), rates=el.querySelector('#rates');
  try{ const fx=JSON.parse(localStorage.getItem('fx')||'null'); if(fx){ base.value=fx.base||'TWD'; rates.value=Object.entries(fx.rates||{}).map(([k,v])=>`${k}=${v}`).join(', ');} }catch{}
  el.querySelector('#save').addEventListener('click',()=>{
    const map={}; (rates.value||'').split(',').forEach(p=>{const [k,v]=(p.trim().split('=')); if(k&&v) map[k.trim().toUpperCase()]=parseFloat(v)});
    localStorage.setItem('fx', JSON.stringify({base:base.value.trim().toUpperCase(), rates:map})); alert('已儲存');
  });
  return el;
}