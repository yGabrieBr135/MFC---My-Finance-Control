'use strict';
// RN-001: validação; RN-002: consultas e cálculos; RN-003: orçamento.
const CATEGORIES = Object.freeze({
  receita: ['Salário', 'Serviços', 'Outras receitas'],
  despesa: ['Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Outras despesas']
});
class ValidationError extends Error {
  constructor(message, field) { super(message); this.name = 'ValidationError'; this.field = field; this.status = 400; }
}
function fail(message, field) { throw new ValidationError(message, field); }
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.slice(0,4) === '0000') return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0,10) === value;
}
function monthRange(month) {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month.startsWith('0000')) fail('Mês inválido. Selecione um mês e ano válidos.', 'month');
  const [y,m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y < 100 ? 2000+y : y,m,0)).getUTCDate();
  return {start: `${month}-01`, end: `${month}-${last}`};
}
// Recebe texto sem separador de milhar. Não usa ponto flutuante para os centavos.
function parseMoney(value, field='amount') {
  if (typeof value !== 'string' || !/^\d{1,9}([.,]\d{1,2})?$/.test(value.trim())) fail('Valor inválido. Use até 9 dígitos inteiros e até duas casas decimais, sem separador de milhar.', field);
  const [whole, fraction=''] = value.trim().replace(',','.').split('.');
  const cents = Number(whole)*100 + Number(fraction.padEnd(2,'0'));
  if (cents < 1 || cents > 99999999999) fail('Valor inválido. Informe entre R$ 0,01 e R$ 999.999.999,99.', field);
  return cents;
}
function validateTransaction(input, currentDate=today()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Lançamento inválido.', 'description');
  if (!Object.hasOwn(CATEGORIES,input.type)) fail('Tipo inválido. Selecione Receita ou Despesa.', 'type');
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if (!description || description.length > 100) fail('Descrição inválida. Informe de 1 a 100 caracteres.', 'description');
  const cents = parseMoney(input.amount);
  if (!validDate(input.date) || input.date > currentDate) fail('Data inválida. Informe uma data existente que não seja futura.', 'date');
  if (!CATEGORIES[input.type].includes(input.category)) fail('Categoria inválida. Escolha uma categoria compatível com o tipo.', 'category');
  return {type:input.type, description, cents, date:input.date, category:input.category};
}
function validateRange(start,end) {
  if (!validDate(start)) fail('Data inicial inválida. Informe uma data existente.', 'start');
  if (!validDate(end) || end < start) fail('Data final inválida. Informe uma data igual ou posterior à inicial.', 'end');
}
function filterTransactions(rows, {start,end,type='',category=''}={}) {
  validateRange(start,end);
  if (type && !Object.hasOwn(CATEGORIES,type)) fail('Tipo inválido no filtro.', 'filterType');
  if (category && !Object.values(CATEGORIES).flat().includes(category)) fail('Categoria inválida no filtro.', 'filterCategory');
  return rows.filter(r => r.date >= start && r.date <= end && (!type || r.type===type) && (!category || r.category===category))
    .sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
}
function summary(rows, start,end) {
  const selected = filterTransactions(rows,{start,end});
  let income=0, expenses=0;
  const categories=Object.fromEntries(CATEGORIES.despesa.map(c=>[c,0]));
  for (const r of selected) {
    if (r.type==='receita') income+=r.cents;
    else {expenses+=r.cents; categories[r.category]+=r.cents;}
  }
  if (!Number.isSafeInteger(income) || !Number.isSafeInteger(expenses)) fail('Total excede a capacidade de cálculo seguro.', 'amount');
  return {income,expenses,balance:income-expenses,categories};
}
function budgetStatus(expenses,limit=null) {
  if (limit===null) return {expenses,limit:null,remaining:null,percent:null,status:'Orçamento não definido'};
  return {expenses,limit,remaining:limit-expenses,percent:Number((expenses/limit*100).toFixed(2)),
    status:expenses<limit?'Dentro do limite':expenses===limit?'Limite atingido':'Limite ultrapassado'};
}
module.exports={CATEGORIES,ValidationError,today,validDate,monthRange,parseMoney,validateTransaction,validateRange,filterTransactions,summary,budgetStatus};
