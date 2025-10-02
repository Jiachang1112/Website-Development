import { getAll } from '../db.js';
export function BackupPage(){
  const el=document.createElement('div'); el.className='container card';
  el.innerHTML=`<h3>備份</h3><div class="row"><button class="primary" id="export">匯出 JSON</button><input type="file" id="file"/></div><pre id="out" class="small"></pre>`;
  el.querySelector('#export').addEventListener('click', async ()=>{
    const stores=['users','expenses','incomes','orders','settings','products','images'];
    const data={}; for(const s of stores){ data[s]=await getAll(s); }
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='backup.json'; a.click();
  });
  return el;
}