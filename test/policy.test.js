const {test}=require('node:test');const assert=require('node:assert/strict');
const {commission,transition,phone}=require('../cloud/policy');
test('calcula as duas comissões fixas em centavos',()=>{
  assert.deepEqual(commission(450000), {commissionRate:10, rewardValueCents:45000, adminCommissionRate:0.6, adminCommissionValueCents:2700});
  assert.equal(commission(250).adminCommissionValueCents, 2);
});
test('rejeita valores fora da regra',()=>{
  for(const value of [-1,0,1.2,Infinity,100000001]) assert.throws(()=>commission(value));
});
test('exige etapas consecutivas e impede novo pagamento',()=>{transition('em_atendimento','contrato_fechado');assert.throws(()=>transition('novo','comissao_paga'));assert.throws(()=>transition('comissao_paga','comissao_paga'));assert.throws(()=>transition('comissao_liberada','novo'));});
test('normaliza telefone brasileiro',()=>{assert.equal(phone('(21) 99999-1234'),'5521999991234');assert.equal(phone('+55 21 99999-1234'),'5521999991234');assert.throws(()=>phone('123'));});

const {referralBase, availableReferralCode}=require('../cloud/policy');
test('normaliza nomes, sobrenomes, acentos e espaços',()=>{
  assert.equal(referralBase('  João da Silva  '),'JOAO-DA-SILVA');
  assert.equal(referralBase('Daniel'),'DANIEL');
  assert.throws(()=>referralBase('---'));
});
test('homônimos recebem o próximo número livre',async()=>{
  const taken = new Set(['DANIEL-SOUZA','DANIEL-SOUZA-002']);
  assert.equal(await availableReferralCode('Daniel Souza',async c=>taken.has(c)),'DANIEL-SOUZA-003');
  assert.equal(await availableReferralCode('Maria Silva',async()=>false),'MARIA-SILVA');
});
