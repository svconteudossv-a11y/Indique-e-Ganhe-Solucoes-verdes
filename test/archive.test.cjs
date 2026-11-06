const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const functions={},state={status:'comissao_paga',rewardValueCents:55000};let roleAccess=true,saves=0;
const record={get:k=>state[k],set(k,v){state[k]=v;},async save(){saves++;}};
class Query{equalTo(){return this}async first(){return roleAccess?{}:undefined}async get(){return record}}
const Parse={Query,Role:class{},User:class{},Cloud:{beforeSave(){},beforeDelete(){},define(n,f){functions[n]=f;}}};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../cloud/main.js'),'utf8'),{Parse,require:()=>({}),Date,process:{env:{}}});
(async()=>{
 const user={id:'admin'};
 await assert.rejects(()=>functions.setReferralArchived({user:null,params:{id:'r',archived:true}}));
 roleAccess=false;await assert.rejects(()=>functions.setReferralArchived({user,params:{id:'r',archived:true}}));roleAccess=true;
 await assert.rejects(()=>functions.setReferralArchived({user,params:{id:'r',archived:'true'}}));
 await functions.setReferralArchived({user,params:{id:'r',archived:true}});assert.equal(state.archived,true);assert.equal(state.rewardValueCents,55000);assert.equal(state.status,'comissao_paga');
 await functions.setReferralArchived({user,params:{id:'r',archived:true}});assert.equal(saves,1);
 await assert.rejects(()=>functions.updateReferralStatus({user,params:{id:'r',status:'novo'}}),/Restaure/);
 await functions.setReferralArchived({user,params:{id:'r',archived:false}});assert.equal(state.archived,false);assert.equal(state.rewardValueCents,55000);
 console.log('OK: autorização, validação, arquivamento, restauração, preservação financeira e bloqueio de status arquivado.');
})();
