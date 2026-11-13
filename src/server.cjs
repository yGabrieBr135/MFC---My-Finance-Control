'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {Repository}=require('./repository.cjs');
const {FinanceService}=require('./service.cjs');
const {CATEGORIES,today}=require('./domain.cjs');
const ROOT=path.resolve(__dirname,'../public');
const FILES={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/styles.css':'styles.css','/favicon.svg':'favicon.svg'};
async function body(req){
  let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>16384)throw Object.assign(Error('Requisição muito grande.'),{status:413});}
  try {const data=JSON.parse(text);if(!data||typeof data!=='object'||Array.isArray(data))throw Error();return data;}
  catch{throw Object.assign(Error('Dados JSON inválidos.'),{status:400});}
}
function createServer({filename=path.resolve(__dirname,'../data/mfc.json'),clock=today}={}) {
  const service=new FinanceService(new Repository(filename),clock);
  const server=http.createServer(async(req,res)=>{
    const json=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const allowedHosts=[`127.0.0.1:${server.address().port}`,`localhost:${server.address().port}`];
      if(!allowedHosts.includes(req.headers.host)) return json(403,{error:'Host não permitido.'});
      if(req.headers.origin && !allowedHosts.map(h=>'http://'+h).includes(req.headers.origin))return json(403,{error:'Origem não permitida.'});
      const url=new URL(req.url,'http://localhost'),p=url.pathname,method=req.method;
      if(p.startsWith('/api/') && !['GET','HEAD'].includes(method) && !String(req.headers['content-type']).startsWith('application/json'))return json(415,{error:'Envie dados no formato application/json.'});
      if(method==='GET' && p==='/api/config')return json(200,{categories:CATEGORIES,today:clock()});
      if(method==='GET' && p==='/api/transactions')return json(200,service.list(Object.fromEntries(url.searchParams)));
      if(method==='POST' && p==='/api/transactions')return json(201,service.create(await body(req)));
      if(method==='GET' && p==='/api/summary')return json(200,service.summary(url.searchParams.get('start'),url.searchParams.get('end')));
      const tx=p.match(/^\/api\/transactions\/([a-zA-Z0-9-]+)$/);
      if(tx && method==='PUT')return json(200,service.update(tx[1],await body(req)));
      if(tx && method==='DELETE'){service.remove(tx[1],(await body(req)).confirmed);return json(200,{ok:true});}
      const budget=p.match(/^\/api\/budgets\/([^/]+)$/);
      if(budget && method==='GET')return json(200,service.budget(budget[1]));
      if(budget && method==='PUT')return json(200,service.saveBudget(budget[1],(await body(req)).amount));
      if(method==='GET' && Object.hasOwn(FILES,p)) {
        const file=FILES[p],ext=path.extname(file),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
        res.writeHead(200,{'Content-Type':types[ext]+'; charset=utf-8','Cache-Control':'no-cache'});return res.end(fs.readFileSync(path.join(ROOT,file)));
      }
      return json(404,{error:'Recurso não encontrado.'});
    }catch(e){json(e.status||500,{error:e.status?e.message:'Falha ao processar ou salvar os dados. Verifique o terminal.',field:e.field});if(!e.status)console.error(e.message);}
  });
  return server;
}
if(require.main===module){
  try{
    const server=createServer();
    server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'A porta está em uso. Feche a outra instância ou altere PORT.':e.message);process.exitCode=1;});
    server.listen(Number(process.env.PORT)||3000,'127.0.0.1',()=>console.log(`MFC disponível em http://localhost:${server.address().port}\nDados: data/mfc.json\nPara encerrar: Ctrl+C`));
  }catch(e){console.error(e.message);process.exitCode=1;}
}
module.exports={createServer};
