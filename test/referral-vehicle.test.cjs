const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const front={document:{getElementById:()=>({})},location:{search:''},URLSearchParams,APP_CONFIG:{},Intl};front.window=front;
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../public/app.js'),'utf8'),front);
for(const value of ['2500','2.500','2.500,00','2500,00','2500.00','R$ 2.500,00'])assert.equal(front.installmentCents(value),250000);
assert.equal(front.installmentCents('99,90'),9990);
for(const value of ['','-1','0','abc','2,500.00','1e3'])assert.throws(()=>front.installmentCents(value));
const functions={};let saved;
const indicator={id:'indicator',get:()=> '5521999990000'};
class Query{equalTo(){return this}static or(){return {first:async()=>indicator}}async get(){return {id:'campaign',get:key=>key==='active'}}}
class ObjectRecord{set(v){saved=v}setACL(){}async save(){}}
const Parse={Query,User:class{},Role:class{},File:class{},ACL:class{},Object:ObjectRecord,Cloud:{beforeSave(){},beforeDelete(){},define(n,f){functions[n]=f}}};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../cloud/main.js'),'utf8'),{Parse,require:()=>({phone:v=>'55'+v}),Date,Buffer,process:{env:{}}});
(async()=>{
 const params={campaignId:'campaign',referralCode:'DANIEL-CAMPOS',name:'Teste',phone:'21999991234',vehicle:'Chevrolet Onix 2022',installmentValueCents:250000,hasFinancing:true,consent:true};
 await functions.registerReferral({params});assert.equal(saved.vehicle,'Chevrolet Onix 2022');assert.equal(saved.installmentValueCents,250000);
 await assert.rejects(()=>functions.registerReferral({params:{...params,vehicle:''}}));
 for(const value of [0,-1,10.5,'250000'])await assert.rejects(()=>functions.registerReferral({params:{...params,installmentValueCents:value}}));
 console.log('OK: moeda brasileira, validação no servidor e gravação do veículo/parcela em centavos.');
})();
