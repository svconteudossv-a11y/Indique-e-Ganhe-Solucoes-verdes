const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
test('resumo exclusivo do ADM soma todo o histórico e preserva valores registrados',async()=>{
 const defs={}; let allowed=true, read=false;
 const records=Array.from({length:125},(_,i)=>({status:'contrato_fechado',archived:i%2===0,contractValueCents:10000,rewardValueCents:1000,adminCommissionValueCents:[60,500,1500][i%3]}));
 records.push({status:'novo',contractValueCents:999999});
 records.push({status:'comissao_paga',contractValueCents:20000,rewardValueCents:2000});
 class Query {
  constructor(type){this.type=type}
  equalTo(){return this} notEqualTo(){return this} include(){return this}
  descending(){return this} limit(){return this} select(){return this}
  containedIn(key,values){this.statuses=values;return this}
  async first(){return allowed?{}:null}
  async find(){return []}
  async each(fn,options){
   read=true;assert.equal(options.useMasterKey,true);
   for(const record of records.filter(r=>this.statuses.includes(r.status))) fn({get:k=>record[k]});
  }
 }
 const Parse={Query,Role:'Role',User:'User',File:'File',Cloud:{define:(n,f)=>defs[n]=f,beforeSave(){},beforeDelete(){}}};
 vm.runInNewContext(fs.readFileSync('cloud/main.js','utf8'),{Parse,require:()=>({}),process,Buffer,URL,URLSearchParams});
 const result=await defs.companyDashboard({user:{id:'admin'},params:{}});
 assert.equal(result.financialSummary.contracts,126);
 assert.equal(result.financialSummary.contractValueCents,1270000);
 assert.equal(result.financialSummary.indicatorCommissionCents,127000);
 const adm=records.slice(0,125).reduce((s,r)=>s+r.adminCommissionValueCents,0);
 assert.equal(result.financialSummary.adminCommissionCents,adm);
 assert.equal(result.financialSummary.totalCommissionCents,127000+adm);
 allowed=false;read=false;
 await assert.rejects(defs.companyDashboard({user:{id:'indicator'},params:{}}));
 assert.equal(read,false);
});
