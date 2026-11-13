'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {CATEGORIES,validDate,monthRange}=require('./domain.cjs');
function assertState(s) {
  if (!s || s.version!==1 || !Array.isArray(s.transactions) || !s.budgets || typeof s.budgets!=='object' || Array.isArray(s.budgets)) throw Error('Formato de dados inválido.');
  const ids=new Set();
  for (const r of s.transactions) {
    if (!r || typeof r.id!=='string' || !r.id || ids.has(r.id) || !Object.hasOwn(CATEGORIES,r.type) || !CATEGORIES[r.type].includes(r.category) || typeof r.description!=='string' || !r.description.trim() || r.description.length>100 || !validDate(r.date) || !Number.isSafeInteger(r.cents) || r.cents<1 || r.cents>99999999999) throw Error('Lançamento armazenado inválido.');
    ids.add(r.id);
  }
  for (const [month,value] of Object.entries(s.budgets)) {
    monthRange(month);
    if (!Number.isSafeInteger(value)||value<1||value>99999999999) throw Error('Orçamento armazenado inválido.');
  }
}
class Repository {
  constructor(filename) {
    this.filename=filename;
    this.state={version:1,transactions:[],budgets:{}};
    if(fs.existsSync(filename)) {
      try {this.state=JSON.parse(fs.readFileSync(filename,'utf8'));assertState(this.state);}
      catch(e){throw Error('Não foi possível ler os dados. O arquivo foi preservado; restaure um backup antes de iniciar. '+e.message);}
    }
  }
  read(){return structuredClone(this.state);}
  commit(next){
    assertState(next);
    fs.mkdirSync(path.dirname(this.filename),{recursive:true});
    const temporary=this.filename+'.tmp';
    try {
      fs.writeFileSync(temporary,JSON.stringify(next,null,2),'utf8');
      fs.renameSync(temporary,this.filename);
      this.state=structuredClone(next);
    } catch(e) {
      try{fs.unlinkSync(temporary);}catch{}
      throw Error('Não foi possível salvar os dados. Verifique o espaço e a permissão de escrita.');
    }
  }
}
module.exports={Repository,assertState};
