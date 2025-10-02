import { put } from '../db.js'; import { fmt } from '../app.js';
export function ExpensePage(){
  const el=document.createElement('div'); el.className='container card';
  el.innerHTML=`<h3>支出</h3>
  <div class="row"><input id="date" type="date"/><input id="item" placeholder="品項"/><input id="cat" placeholder="分類"/><input id="amt" type="number" placeholder="金額"/><button class="primary" id="add">新增</button></div>
  <div class="small">快速鍵：右下角「＋」也會跳到此頁。</div>`;
  const d=new Date(); el.querySelector('#date').value=d.toISOString().slice(0,10);
  el.querySelector('#add').addEventListener('click', async ()=>{
    const rec={date:el.querySelector('#date').value,item:el.querySelector('#item').value,cat:el.querySelector('#cat').value,amount:parseFloat(el.querySelector('#amt').value||'0')};
    await put('expenses', rec); alert('已加入：'+rec.item);
  });
  return el;
}