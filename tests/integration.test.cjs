'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {once}=require('node:events');
const {createServer}=require('../src/server.cjs');const {Repository}=require('../src/repository.cjs');const {FinanceService}=require('../src/service.cjs');
const date='2026-11-13',sample={type:'despesa',description:'Aluguel',amount:'900,00',date:'2026-11-03',category:'Moradia'};
const query='?start=2026-11-01&end=2026-11-30';
async function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mfc-test-')),filename=path.join(dir,'mfc.json');let server;
 async function start(){server=createServer({filename,clock:()=>date});server.listen(0,'127.0.0.1');await once(server,'listening');}
 async function stop(){if(server?.listening)await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
 await start();t.after(async()=>{await stop();fs.rmSync(dir,{recursive:true,force:true});});
 return {filename,restart:async()=>{await stop();await start();},request:async(p,method='GET',data,headers={})=>{const r=await fetch(`http://127.0.0.1:${server.address().port}`+p,{method,headers:{'Content-Type':'application/json',...headers},body:data===undefined?undefined:JSON.stringify(data)});return {status:r.status,body:await r.json()};}};
}
test('I01 | CRUD HTTP + resumo + atualização de orçamento',async t=>{const f=await fixture(t);const created=await f.request('/api/transactions','POST',sample);assert.equal(created.status,201);const id=created.body.id;
 assert.equal((await f.request('/api/summary'+query)).body.expenses,90000);
 await f.request('/api/budgets/2026-11','PUT',{amount:'1000'});
 assert.equal((await f.request('/api/budgets/2026-11')).body.percent,90);
 assert.equal((await f.request('/api/transactions/'+id,'PUT',{...sample,amount:'1100'})).status,200);
 assert.equal((await f.request('/api/budgets/2026-11')).body.status,'Limite ultrapassado');
 assert.equal((await f.request('/api/transactions'+query)).body.length,1);
 assert.equal((await f.request('/api/transactions/'+id,'DELETE',{confirmed:true})).status,200);
 assert.equal((await f.request('/api/summary'+query)).body.expenses,0);
});
test('I02 | cancelar exclusão mantém registro e totais',async t=>{const f=await fixture(t);const {body:r}=await f.request('/api/transactions','POST',sample);assert.equal((await f.request('/api/transactions/'+r.id,'DELETE',{confirmed:false})).status,400);assert.equal((await f.request('/api/summary'+query)).body.expenses,90000);});
test('I03 | validação HTTP impede alteração e persistência inválidas',async t=>{const f=await fixture(t);assert.equal((await f.request('/api/transactions','POST',{...sample,amount:'-1'})).status,400);assert.equal((await f.request('/api/transactions'+query)).body.length,0);const {body:r}=await f.request('/api/transactions','POST',sample);assert.equal((await f.request('/api/transactions/'+r.id,'PUT',{...sample,type:'receita',category:'Salário'})).status,400);assert.equal((await f.request('/api/summary'+query)).body.expenses,90000);});
test('I04 | RNF-002 | 20 registros + 2 orçamentos íntegros após 3 reinícios reais',async t=>{const f=await fixture(t);for(let i=0;i<20;i++)assert.equal((await f.request('/api/transactions','POST',{...sample,description:'Registro '+i,amount:String(i+1)})).status,201);
 await f.request('/api/budgets/2026-11','PUT',{amount:'1000'});await f.request('/api/budgets/2026-12','PUT',{amount:'2000'});
 const before=(await f.request('/api/transactions'+query)).body;
 for(let i=0;i<3;i++){await f.restart();assert.deepEqual((await f.request('/api/transactions'+query)).body,before);assert.equal((await f.request('/api/budgets/2026-11')).body.limit,100000);assert.equal((await f.request('/api/budgets/2026-12')).body.limit,200000);}
});
test('I05 | orçamento substituído, zero rejeitado, outros meses preservados',async t=>{const f=await fixture(t);await f.request('/api/budgets/2026-11','PUT',{amount:'100'});await f.request('/api/budgets/2026-11','PUT',{amount:'200'});assert.equal((await f.request('/api/budgets/2026-11')).body.limit,20000);assert.equal((await f.request('/api/budgets/2026-11','PUT',{amount:'0'})).status,400);assert.equal((await f.request('/api/budgets/2026-12')).body.limit,null);});
test('I06 | edição entre meses recalcula ambos os orçamentos',async t=>{const f=await fixture(t);const {body:r}=await f.request('/api/transactions','POST',{...sample,date:'2026-10-01'});await f.request('/api/budgets/2026-10','PUT',{amount:'1000'});await f.request('/api/budgets/2026-11','PUT',{amount:'1000'});await f.request('/api/transactions/'+r.id,'PUT',sample);assert.equal((await f.request('/api/budgets/2026-10')).body.expenses,0);assert.equal((await f.request('/api/budgets/2026-11')).body.expenses,90000);});
test('I07 | arquivo corrompido não é sobrescrito',t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mfc-corrupt-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'mfc.json');fs.writeFileSync(file,'INVALIDO');assert.throws(()=>new Repository(file),/preservado/);assert.equal(fs.readFileSync(file,'utf8'),'INVALIDO');});
test('I08 | falha de gravação não modifica estado em memória',t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mfc-failure-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const r=new Repository(path.join(dir,'db.json'));fs.mkdirSync(r.filename+'.tmp');const service=new FinanceService(r,()=>date);assert.throws(()=>service.create(sample),/salvar/);assert.equal(r.read().transactions.length,0);});
test('I09 | API protege origem externa e retorna 404',async t=>{const f=await fixture(t);assert.equal((await f.request('/api/transactions','POST',sample,{Origin:'https://externo.example'})).status,403);assert.equal((await f.request('/api/inexistente')).status,404);assert.equal((await f.request('/api/transactions/inexistente','PUT',sample)).status,404);assert.equal((await f.request('/api/transactions/inexistente','DELETE',{confirmed:true})).status,404);});
test('I10 | filtro não altera resumo do período',async t=>{const f=await fixture(t);await f.request('/api/transactions','POST',sample);await f.request('/api/transactions','POST',{type:'receita',description:'Salário',amount:'2000',date:'2026-11-01',category:'Salário'});assert.equal((await f.request('/api/transactions'+query+'&type=receita')).body.length,1);assert.equal((await f.request('/api/summary'+query)).body.balance,110000);});
test('I11 | configuração, filtros e mês inválidos retornam mensagens',async t=>{const f=await fixture(t);assert.equal((await f.request('/api/config')).body.today,date);assert.equal((await f.request('/api/transactions?start=2026-12-01&end=2026-11-01')).status,400);assert.equal((await f.request('/api/budgets/2026-13')).status,400);assert.equal((await f.request('/api/transactions','POST',{...sample,date:'2026-11-14'})).body.field,'date');});
