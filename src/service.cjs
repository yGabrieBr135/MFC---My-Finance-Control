'use strict';
const {randomUUID}=require('node:crypto');
const D=require('./domain.cjs');
class FinanceService {
  constructor(repository, clock=D.today){this.repo=repository;this.clock=clock;}
  list(filters){return D.filterTransactions(this.repo.read().transactions,filters);}
  create(input){
    const row={...D.validateTransaction(input,this.clock()),id:randomUUID()};
    const s=this.repo.read();s.transactions.push(row);this.repo.commit(s);return row;
  }
  update(id,input){
    const s=this.repo.read(), i=s.transactions.findIndex(r=>r.id===id);
    if(i<0) throw Object.assign(Error('Lançamento não encontrado.'),{status:404});
    if(input.type!==s.transactions[i].type) throw new D.ValidationError('Tipo não pode ser alterado. Exclua e cadastre novamente.','type');
    const row={...D.validateTransaction(input,this.clock()),id};s.transactions[i]=row;this.repo.commit(s);return row;
  }
  remove(id,confirmed){
    if(confirmed!==true) throw new D.ValidationError('Confirme a exclusão do lançamento.','confirmation');
    const s=this.repo.read(),i=s.transactions.findIndex(r=>r.id===id);
    if(i<0) throw Object.assign(Error('Lançamento não encontrado.'),{status:404});
    s.transactions.splice(i,1);this.repo.commit(s);
  }
  summary(start,end){return D.summary(this.repo.read().transactions,start,end);}
  saveBudget(month,amount){
    D.monthRange(month); const limit=D.parseMoney(amount,'limit');
    const s=this.repo.read();s.budgets[month]=limit;this.repo.commit(s);return this.budget(month);
  }
  budget(month){const {start,end}=D.monthRange(month);return D.budgetStatus(this.summary(start,end).expenses,this.repo.read().budgets[month]??null);}
}
module.exports={FinanceService};
