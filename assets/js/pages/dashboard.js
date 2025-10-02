import { getAll } from '../db.js'; import { fmt } from '../app.js';
export function DashboardPage(){
  const el=document.createElement('div'); el.className='container';
  el.innerHTML=`<section class="card"><h3>首頁儀表板</h3>
  <div class="row"><a class="ghost" href="#acct_mine">我的</a><a class="ghost" href="#acct_detail">明細</a><a class="ghost" href="#acct_analysis">分析</a></div>
  <div id="finance" class="row"></div><div id="orders" class="row"></div></section>`;
  (async ()=>{
    const [exps,incs,orders]=await Promise.all([getAll('expenses'),getAll('incomes'),getAll('orders')]);
    const ym=new Date().toISOString().slice(0,7);
    const out=exps.filter(e=>(e.date||'').slice(0,7)===ym).reduce((s,e)=>s+(+e.amount||0),0);
    const inc=incs.filter(i=>(i.date||'').slice(0,7)===ym).reduce((s,i)=>s+(+i.amount||0),0);
    el.querySelector('#finance').innerHTML=`<span class="badge">收入：${fmt.money(inc)}</span><span class="badge">支出：${fmt.money(out)}</span><span class="badge">結餘：${fmt.money(inc-out)}</span><a class="ghost" href="#expense">去記帳</a>`;
    const count=s=>orders.filter(o=>o.status===s).length;
    el.querySelector('#orders').innerHTML=`<span class="badge">待付款 ${count('待付款')}</span><span class="badge">待出貨 ${count('待出貨')}</span><span class="badge">待收貨 ${count('待收貨')}</span><span class="badge">評價 ${count('評價')}</span>`;
  })();
  return el;
}