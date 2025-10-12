import { getAll } from '../db.js'; import { fmt } from '../app.js';
export function ExpenseDetailPage(){
  const el=document.createElement('div'); el.className='container';
  const ym=new Date().toISOString().slice(0,7);
  el.innerHTML=`<section class="card"><h3>記帳｜明細</h3>
  <div class="row"><label class="small">月份</label><input id="m" type="month" value="${ym}"/></div>
  <div class="row"><span class="badge">月結餘：<b id="bal"></b></span><span class="badge">月支出：<b id="out"></b></span><span class="badge">月收入：<b id="inc"></b></span></div>
  <div id="list"></div></section>`;
  const m=el.querySelector('#m'), out=el.querySelector('#out'), inc=el.querySelector('#inc'), bal=el.querySelector('#bal'), list=el.querySelector('#list');
  async function render(){ const [exps,incs]=await Promise.all([getAll('expenses'),getAll('incomes')]); const e=exps.filter(x=>(x.date||'').slice(0,7)===m.value);const i=incs.filter(x=>(x.date||'').slice(0,7)===m.value); const sOut=e.reduce((s,a)=>s+(+a.amount||0),0), sIn=i.reduce((s,a)=>s+(+a.amount||0),0); out.textContent=sOut; inc.textContent=sIn; bal.textContent=sIn-sOut; list.innerHTML=[...e.map(x=>({type:'支出',...x,amt:-Math.abs(+x.amount||0)})),...i.map(x=>({type:'收入',...x,amt:+(+x.amount||0)}))].sort((a,b)=>a.date>b.date?-1:1).map(r=>`<div class="order-row"><div><b>${r.date}</b> <span class="badge">${r.type}</span><div class="small">${r.cat||''}｜${r.item||''}</div></div><div>${r.amt<0?'-':''}${Math.abs(r.amt)}</div></div>`).join('')||'<p class="small">本月尚無記錄</p>'; }
  m.addEventListener('change',render); render(); return el;
}
