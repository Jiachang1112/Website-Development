import { getAll, put } from '../db.js';
export function ExpenseMinePage(){
  const el=document.createElement('div'); el.className='container';
  el.innerHTML=`<section class="card"><h3>記帳｜我的</h3>
  <div class="row"><a class="ghost" href="#settings">設定</a><a class="ghost" href="#chatbook">聊天記帳</a><a class="ghost" href="#camera">拍照記帳</a><a class="ghost" href="#expense">傳統輸入</a></div>
  <div class="row" style="margin-top:8px"><label class="small">月份</label><input id="ym" type="month"/><label class="small">本月預算</label><input id="budget" type="number"/><button class="primary" id="save">儲存</button></div></section>`;
  const ym=el.querySelector('#ym'), budget=el.querySelector('#budget'); ym.value=new Date().toISOString().slice(0,7);
  el.querySelector('#save').addEventListener('click', async ()=>{ const all=await getAll('settings'); let set=all.find(s=>s.id==='expense-settings')||{id:'expense-settings',budgets:{}}; set.budgets[ym.value]=parseFloat(budget.value||'0'); await put('settings',set); alert('已儲存'); });
  return el;
}
