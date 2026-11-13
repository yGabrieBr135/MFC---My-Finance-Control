'use strict';
const $=id=>document.getElementById(id);
const money=c=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(c/100);
const pct=n=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(n)+'%';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateText=s=>s.split('-').reverse().join('/');
let config,rows=[],editId=null,deleteId=null,toastTimer,refreshId=0,currentPage='overview';
async function api(url,method='GET',data){
  let response;
  try{response=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});}catch{throw Error('Sem conexão com o MFC. Verifique se o servidor está aberto no terminal.');}
  const result=await response.json();if(!response.ok)throw Object.assign(Error(result.error),{field:result.field});return result;
}
function notify(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4000);}
function range(month){const [y,m]=month.split('-').map(Number);return {start:month+'-01',end:month+'-'+new Date(Date.UTC(y<100?2000+y:y,m,0)).getUTCDate()};}
function changePage(page){currentPage=page;for(const id of ['overview','transactions','budget'])$(id).hidden=id!==page;
  const names={overview:['Visão geral','Uma visão clara de tudo que entra e sai.'],transactions:['Lançamentos','Cadastre e organize suas movimentações.'],budget:['Orçamento mensal','Defina um limite e acompanhe seus gastos.']};
  $('pageTitle').textContent=names[page][0];$('breadcrumb').textContent=names[page][0];$('pageSubtitle').textContent=names[page][1];
  document.querySelectorAll('[data-page]').forEach(b=>{b.classList.toggle('active',b.dataset.page===page);if(b.dataset.page===page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
}
function categoryOptions(select,type,all=false){const list=type?config.categories[type]:Object.values(config.categories).flat();select.innerHTML=(all?'<option value="">Todas</option>':'<option value="">Selecione uma categoria</option>')+list.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');}
function statusBadge(el,b){el.textContent=b.status;el.className='badge '+(b.limit===null?'':b.status==='Dentro do limite'?'good':b.status==='Limite atingido'?'warn':'bad');}
function categoryHTML(categories,includeZero=false){return Object.entries(categories).filter(([,v])=>includeZero||v>0).sort((a,b)=>b[1]-a[1]).map(([c,v],i)=>`<div class="category-row"><span class="category-icon">${['⌂','◇','↔','+','▤','○','·'][i%7]}</span><span>${esc(c)}</span><strong>${money(v)}</strong></div>`).join('')||'<p class="muted">Nenhuma despesa neste mês.</p>';}
function rowHTML(r,actions=false){return `<tr><td>${dateText(r.date)}</td><td>${esc(r.description)}</td><td>${esc(r.category)}</td><td><span class="badge ${r.type==='receita'?'good':'bad'}">${r.type==='receita'?'Receita':'Despesa'}</span></td><td class="number ${r.type==='receita'?'income':'expense'}">${money(r.cents)}</td>${actions?`<td><div class="row-actions"><button class="icon-button" data-edit="${r.id}" aria-label="Editar ${esc(r.description)}" title="Editar">✎</button><button class="icon-button" data-delete="${r.id}" aria-label="Excluir ${esc(r.description)}" title="Excluir">×</button></div></td>`:''}</tr>`;}
async function refresh(){
  const id=++refreshId,month=$('month').value;if(!month)return;
  const r=range(month);const query=new URLSearchParams({start:$('start').value,end:$('end').value,type:$('filterType').value,category:$('filterCategory').value});
  try{
    const [s,b,recent]=await Promise.all([api('/api/summary?'+new URLSearchParams(r)),api('/api/budgets/'+month),api('/api/transactions?'+new URLSearchParams(r))]);
    if(id!==refreshId)return;
    $('income').textContent=money(s.income);$('expenses').textContent=money(s.expenses);$('balance').textContent=money(s.balance);$('balance').className=s.balance<0?'expense':'';
    $('categoryList').innerHTML=categoryHTML(s.categories);$('budgetCategories').innerHTML=categoryHTML(s.categories,true);$('budgetTotal').textContent=money(s.expenses);
    $('recentRows').innerHTML=recent.slice(0,5).map(r=>rowHTML(r)).join('');$('recentEmpty').hidden=recent.length>0;
    $('budgetUsage').textContent=b.limit===null?'Orçamento não definido':`${money(b.expenses)} de ${money(b.limit)}`;
    for(const el of [$('overviewProgress'),$('budgetProgress')]){el.value=b.percent===null?0:Math.min(b.percent,100);el.classList.toggle('over',b.status==='Limite ultrapassado');}
    $('overviewPercent').textContent=b.percent===null?'Defina seu limite mensal':pct(b.percent)+' utilizado';
    statusBadge($('overviewStatus'),b);statusBadge($('budgetStatus'),b);
    $('budgetMonth').value=month;$('limit').value=b.limit===null?'':(b.limit/100).toFixed(2).replace('.',',');
    $('budgetLimit').textContent=b.limit===null?'—':money(b.limit);$('budgetExpenses').textContent=money(b.expenses);
    $('remainingLabel').textContent=b.remaining<0?'Limite excedido em':'Disponível no orçamento';$('budgetRemaining').textContent=b.remaining===null?'—':money(Math.abs(b.remaining));$('budgetRemaining').className=b.remaining<0?'expense':'income';
    $('budgetPercent').textContent=b.percent===null?'Orçamento não definido':pct(b.percent)+' do orçamento utilizado';$('connectionError').hidden=true;
    try{
      const [list,totals]=await Promise.all([api('/api/transactions?'+query),api('/api/summary?'+new URLSearchParams({start:$('start').value,end:$('end').value}))]);
      if(id!==refreshId)return;rows=list;$('transactionRows').innerHTML=list.map(r=>rowHTML(r,true)).join('');$('rowCount').textContent=list.length+' lançamento'+(list.length===1?'':'s');$('transactionsEmpty').hidden=list.length>0;
      $('periodSummary').innerHTML=`<span>Receitas<strong class="income">${money(totals.income)}</strong></span><span>Despesas<strong class="expense">${money(totals.expenses)}</strong></span><span>Saldo do período<strong>${money(totals.balance)}</strong></span>`;$('filterError').textContent='';
    }catch(e){if(id!==refreshId)return;$('filterError').textContent=e.message;rows=[];$('transactionRows').innerHTML='';$('rowCount').textContent='Consulta inválida';$('periodSummary').textContent='';$('transactionsEmpty').hidden=true;}
  }catch(e){if(id!==refreshId)return;$('connectionError').textContent=e.message;$('connectionError').hidden=false;}
}
function resetFilters(){const r=range($('month').value);$('start').value=r.start;$('end').value=r.end;$('filterType').value='';categoryOptions($('filterCategory'),'',true);}
function openTransaction(row=null){
  editId=row?.id||null;$('transactionForm').reset();$('transactionError').textContent='';$('type').value=row?.type||'despesa';$('type').disabled=!!row;categoryOptions($('category'),$('type').value);
  $('description').value=row?.description||'';$('amount').value=row?(row.cents/100).toFixed(2).replace('.',','):'';$('date').value=row?.date||config.today;$('date').max=config.today;$('category').value=row?.category||'';
  $('formTitle').textContent=row?'Editar lançamento':'Novo lançamento';$('transactionDialog').showModal();$('description').focus();
}
function showFieldError(id,e){$(id).textContent=e.message;const field=e.field&&$(e.field);if(field&&!field.disabled)field.focus();}
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>changePage(b.dataset.page)));
$('goBudget').onclick=()=>changePage('budget');$('goTransactions').onclick=()=>changePage('transactions');
for(const id of ['newTransaction','emptyAdd'])$(id).onclick=()=>openTransaction();
for(const id of ['closeDialog','cancelTransaction'])$(id).onclick=()=>$('transactionDialog').close();
$('type').onchange=()=>categoryOptions($('category'),$('type').value);
$('month').onchange=()=>{if(!$('month').value)return;resetFilters();refresh();};
$('budgetMonth').onchange=()=>{if(!$('budgetMonth').value)return;$('month').value=$('budgetMonth').value;resetFilters();$('budgetError').textContent='';refresh();};
$('filterType').onchange=()=>categoryOptions($('filterCategory'),$('filterType').value,true);
$('filters').onsubmit=e=>{e.preventDefault();refresh();};$('clearFilters').onclick=()=>{resetFilters();refresh();};
$('transactionForm').onsubmit=async e=>{e.preventDefault();const button=$('saveTransaction');if(button.disabled)return;button.disabled=true;
  try{const data=Object.fromEntries(['type','description','amount','date','category'].map(id=>[id,$(id).value]));await api('/api/transactions'+(editId?'/'+editId:''),editId?'PUT':'POST',data);$('transactionDialog').close();notify(editId?'Lançamento atualizado.':'Lançamento cadastrado.');await refresh();}catch(e){showFieldError('transactionError',e);}finally{button.disabled=false;}
};
$('transactionRows').onclick=e=>{const edit=e.target.closest('[data-edit]'),del=e.target.closest('[data-delete]');if(edit)openTransaction(rows.find(r=>r.id===edit.dataset.edit));if(del){deleteId=del.dataset.delete;const row=rows.find(r=>r.id===deleteId);$('deleteDescription').textContent=row.description+' • '+money(row.cents);$('deleteError').textContent='';$('deleteDialog').showModal();$('cancelDelete').focus();}};
$('cancelDelete').onclick=()=>$('deleteDialog').close();$('confirmDelete').onclick=async()=>{const b=$('confirmDelete');if(b.disabled)return;b.disabled=true;try{await api('/api/transactions/'+deleteId,'DELETE',{confirmed:true});$('deleteDialog').close();notify('Lançamento excluído.');await refresh();}catch(e){$('deleteError').textContent=e.message;}finally{b.disabled=false;}};
$('budgetForm').onsubmit=async e=>{e.preventDefault();const b=e.submitter;if(b.disabled)return;b.disabled=true;try{await api('/api/budgets/'+$('budgetMonth').value,'PUT',{amount:$('limit').value});$('budgetError').textContent='';notify('Orçamento salvo.');await refresh();}catch(e){showFieldError('budgetError',e);}finally{b.disabled=false;}};
(async()=>{try{config=await api('/api/config');$('month').value=config.today.slice(0,7);resetFilters();await refresh();}catch(e){$('connectionError').textContent=e.message;$('connectionError').hidden=false;}})();
