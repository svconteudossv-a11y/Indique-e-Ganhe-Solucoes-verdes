'use strict';
const statuses = ['novo', 'em_atendimento', 'contrato_fechado', 'comissao_liberada', 'comissao_paga'];
function commission(cents, rate) {
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 100000000 || ![5,7,10].includes(rate)) throw new Error('Informe o valor do contrato e escolha 5%, 7% ou 10%.');
  return Math.round(cents * rate / 100);
}
function transition(from, to) {
  if (!statuses.includes(from) || !statuses.includes(to) || statuses.indexOf(to) !== statuses.indexOf(from) + 1) throw new Error('Avance uma etapa por vez.');
}
function phone(value) {
  let p = String(value || '').replace(/\D/g, '');
  if (p.length === 10 || p.length === 11) p = '55' + p;
  if (!/^55[1-9]\d\d{8,9}$/.test(p)) throw new Error('Informe um telefone brasileiro com DDD.');
  return p;
}
module.exports = {statuses, commission, transition, phone};
