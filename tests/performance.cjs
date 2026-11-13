'use strict';
// Medição HTTP local; não mede pintura/renderização no navegador.
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {once}=require('node:events');
const {performance}=require('node:perf_hooks');
const {Repository}=require('../src/repository.cjs');
const {createServer}=require('../src/server.cjs');
(async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mfc-perf-'));
 const filename=path.join(temp,'mfc.json');let server;
 try {
  const transactions=Array.from({length:1000},(_,i)=>({id:'seed-'+i,type:i%2?'receita':'despesa',description:'Registro '+i,category:i%2?'Salário':'Moradia',date:'2026-11-'+String(i%13+1).padStart(2,'0'),cents:10000+i}));
  new Repository(filename).commit({version:1,transactions,budgets:{'2026-11':10000000}});
  server=createServer({filename,clock:()=> '2026-11-13'});server.listen(0,'127.0.0.1');await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port;
  async function request(url,method='GET',data){const response=await fetch(base+url,{method,headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});const result=await response.json();if(!response.ok)throw Error(JSON.stringify(result));return result;}
  await request('/api/config');
  const samples={cadastro:[],edicao:[],exclusao:[],consulta:[],resumo:[]};
  async function measure(name,fn){const start=performance.now();const result=await fn();samples[name].push(Number((performance.now()-start).toFixed(3)));return result;}
  for(let i=0;i<10;i++){
   const input={type:'despesa',description:'Medição '+i,category:'Moradia',date:'2026-11-13',amount:'10,00'};
   const row=await measure('cadastro',()=>request('/api/transactions','POST',input));
   await measure('edicao',()=>request('/api/transactions/'+row.id,'PUT',{...input,amount:'20,00'}));
   await measure('consulta',()=>request('/api/transactions?start=2026-11-01&end=2026-11-30&type=despesa'));
   await measure('resumo',()=>request('/api/summary?start=2026-11-01&end=2026-11-30'));
   await measure('exclusao',()=>request('/api/transactions/'+row.id,'DELETE',{confirmed:true}));
  }
  const results=Object.fromEntries(Object.entries(samples).map(([k,v])=>[k,{samplesMs:v,averageMs:Number((v.reduce((a,b)=>a+b,0)/v.length).toFixed(3)),maxMs:Math.max(...v),passed:v.every(n=>n<=2000)}]));
  const report={executedAt:new Date().toISOString(),scope:'HTTP local, incluindo gravação JSON e leitura da resposta; exclui renderização do navegador',initialRecords:1000,runsPerOperation:10,thresholdMs:2000,node:process.version,platform:os.platform(),cpu:os.cpus()[0]?.model,totalMemoryGiB:Number((os.totalmem()/2**30).toFixed(2)),results};
  const output=path.resolve(__dirname,'../evidencias');fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'desempenho.json'),JSON.stringify(report,null,2));
  for(const [name,r] of Object.entries(results))console.log(`${r.passed?'PASS':'FAIL'} | ${name}: média ${r.averageMs} ms; máximo ${r.maxMs} ms; 10 execuções`);
  if(Object.values(results).some(r=>!r.passed))process.exitCode=1;
 }catch(e){console.error(e.stack);process.exitCode=1;}finally{if(server?.listening)await new Promise(r=>server.close(r));fs.rmSync(temp,{recursive:true,force:true});}
})();
