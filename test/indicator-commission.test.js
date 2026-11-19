const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
test('classificação exige ADM, usa padrão e registra opção privada',async()=>{
 const definitions={}, settings=[];
 const indicator={id:'person',get:k=>({name:'Daniel',referralCode:'DANIEL'}[k])};
 let authorized=true;
 class Query {
  constructor(type){this.type=type}
  equalTo(){return this} descending(){return this} addDescending(){return this}
  async first(){if(this.type==='Role')return authorized?{}:null;return settings.at(-1)}
  static or(){return {first:async()=>indicator}}
 }
 class Obj {
  constructor(){this.data={}}
  set(v){Object.assign(this.data,v)}
  get(k){return this.data[k]}
  setACL(a){this.acl=a}
  async save(){settings.push(this)}
 }
 const Parse={Query,Object:Obj,Role:'Role',User:'User',File:'File',ACL:class{},Cloud:{
  define:(n,f)=>definitions[n]=f,beforeSave(){},beforeDelete(){}
 }};
 vm.runInNewContext(fs.readFileSync('cloud/main.js','utf8'),{Parse,require:()=>require('../cloud/policy'),process,Buffer,URL,URLSearchParams});
 const user={id:'admin'},params={referralCode:'DANIEL'};
 assert.equal((await definitions.getIndicatorCommission({user,params})).adminCommissionRate,0.6);
 await definitions.setIndicatorCommission({user,params:{...params,direct:true}});
 assert.equal((await definitions.getIndicatorCommission({user,params})).adminCommissionRate,5);
 assert.ok(settings[0].acl);
 await definitions.setIndicatorCommission({user,params:{...params,direct:false}});
 assert.equal((await definitions.getIndicatorCommission({user,params})).adminCommissionRate,0.6);
 await assert.rejects(definitions.setIndicatorCommission({user,params:{...params,direct:'true'}}));
 authorized=false;
 await assert.rejects(definitions.setIndicatorCommission({user,params:{...params,direct:true}}));
 await assert.rejects(definitions.getIndicatorCommission({user,params}));
});
