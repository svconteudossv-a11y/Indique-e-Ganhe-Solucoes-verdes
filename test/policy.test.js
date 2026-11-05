const {test}=require('node:test');const assert=require('node:assert/strict');
const {commission,transition,phone}=require('../cloud/policy');
test('calcula as três faixas em centavos',()=>{assert.equal(commission(450000,5),22500);assert.equal(commission(450000,7),31500);assert.equal(commission(450000,10),45000);});
test('rejeita percentuais e valores fora da regra',()=>{for(const rate of [0,6,20,NaN])assert.throws(()=>commission(450000,rate));for(const value of [-1,0,1.2,Infinity])assert.throws(()=>commission(value,5));});
test('exige etapas consecutivas e impede novo pagamento',()=>{transition('em_atendimento','contrato_fechado');assert.throws(()=>transition('novo','comissao_paga'));assert.throws(()=>transition('comissao_paga','comissao_paga'));assert.throws(()=>transition('comissao_liberada','novo'));});
test('normaliza telefone brasileiro',()=>{assert.equal(phone('(21) 99999-1234'),'5521999991234');assert.equal(phone('+55 21 99999-1234'),'5521999991234');assert.throws(()=>phone('123'));});
