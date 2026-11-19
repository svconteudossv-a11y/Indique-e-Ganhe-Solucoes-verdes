'use strict';
const statuses = ['novo', 'em_atendimento', 'contrato_fechado', 'comissao_liberada', 'comissao_paga'];
function commission(cents, adminRate = 0.6) {
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 100000000) {
    throw new Error('Informe um valor válido para o contrato.');
  }
  if (![0.6, 5, 15].includes(adminRate)) throw new Error('Comissão administrativa inválida.');
  return {
    commissionRate: 10,
    rewardValueCents: Math.round(cents * 10 / 100),
    adminCommissionRate: adminRate,
    adminCommissionValueCents: Math.round(cents * ({0.6:6, 5:50, 15:150}[adminRate]) / 1000)
  };
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
function referralBase(name) {
  const base = String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/g, '');
  if (!base) throw new Error('Informe um nome válido para gerar seu código.');
  return base;
}
async function availableReferralCode(name, isTaken) {
  const base = referralBase(name);
  for (let n = 1; n <= 10000; n++) {
    const code = n === 1 ? base : base + '-' + String(n).padStart(3, '0');
    if (!await isTaken(code)) return code;
  }
  throw new Error('Não foi possível reservar um código. Tente novamente.');
}
module.exports = {statuses, commission, transition, phone, referralBase, availableReferralCode};
