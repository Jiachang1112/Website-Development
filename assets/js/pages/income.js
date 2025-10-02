import { put } from '../db.js';
export function IncomePage(){
  const el=document.createElement('div'); el.className='container card';
  el.innerHTML=`<h3>收入</h3><div class="row"><input id="date" type="date"/><input id="item" placeholder="項目"/><input id="cat" placeholder="分類"/><input id="amt" type="number" placeholder="金額"/><button class="primary" id="add">新增</button></div>`;
  el.querySelector('#date').value=new Date().toISOString().slice(0,10);
  el.querySelector('#add').addEventListener('click', async ()=>{
    const rec={date:el.querySelector('#date').value,item:el.querySelector('#item').value,cat:el.querySelector('#cat').value,amount:parseFloat(el.querySelector('#amt').value||'0')};
    await put('incomes', rec); alert('已加入收入：'+rec.item);
  });
  return el;
}