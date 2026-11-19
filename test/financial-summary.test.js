const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
test('resumo exclusivo do ADM exclui arquivados e agrupa pelo fechamento em Brasília',async()=>{
 const defs={}; let allowed=true, read=false;
 const records=Array.from({length:125},(_,i)=>({status:'contrato_fechado',archived:i%2===0,closedAt:'2026-11-01T02:30:00Z',referredName:'Cliente',vehicle:'Carro',contractValueCents:10000,rewardValueCents:1000,adminCommissionValueCents:[60,500,1500][i%3]}));
 records.push({status:'novo',contractValueCents:999999});
 records.push({status:'comissao_paga',closedAt:'2026-11-01T03:00:00Z',contractValueCents:20000,rewardValueCents:2000});
 records.push({status:'contrato_fechado',contractValueCents:30000});
 class Query {
  constructor(type){this.type=type}
  equalTo(){return this} notEqualTo(k,v){this.excluded=[k,v];return this} include(){return this}
  descending(){return this} limit(){return this} select(){return this}
  containedIn(key,values){this.statuses=values;return this}
  async first(){return allowed?{}:null}
  async find(){return []}
  async each(fn,options){
   read=true;assert.equal(options.useMasterKey,true);
   for(const record of records.filter(r=>this.statuses.includes(r.status) && (!this.excluded || r[this.excluded[0]]!==this.excluded[1]))) fn({get:k=>record[k]});
  }
 }
 const Parse={Query,Role:'Role',User:'User',File:'File',Cloud:{define:(n,f)=>defs[n]=f,beforeSave(){},beforeDelete(){}}};
 vm.runInNewContext(fs.readFileSync('cloud/main.js','utf8'),{Parse,require:()=>({}),process,Buffer,URL,URLSearchParams});
 const result=await defs.companyDashboard({user:{id:'admin'},params:{}});
 assert.equal(result.financialSummary.contracts,64);
 assert.equal(result.financialSummary.contractValueCents,670000);
 assert.equal(result.financialSummary.indicatorCommissionCents,64000);
 const adm=records.slice(0,125).filter(r=>!r.archived).reduce((s,r)=>s+r.adminCommissionValueCents,0);
 assert.equal(result.financialSummary.adminCommissionCents,adm);
 assert.equal(result.financialSummary.totalCommissionCents,64000+adm);
 assert.equal(result.financialSummary.months.map(m=>m.month).join(','),'2026-11,2026-10,sem-data');
 assert.equal(result.financialSummary.months[1].contracts,62);
 assert.equal(result.financialSummary.months[1].items[0].referredName,'Cliente');
 assert.equal(result.financialSummary.months[1].items[0].vehicle,'Carro');
 assert.equal(result.financialSummary.months[0].contractValueCents,20000);
 assert.equal(result.financialSummary.months[2].contractValueCents,30000);
 allowed=false;read=false;
 await assert.rejects(defs.companyDashboard({user:{id:'indicator'},params:{}}));
 assert.equal(read,false);
});
