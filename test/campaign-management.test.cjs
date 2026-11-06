const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const functions={},state={active:true,title:'Campanha de teste'};let access=true,saves=0;
const campaign={id:'campaign',get:k=>state[k],set(k,v){state[k]=v},save:async()=>{saves++}};
class Query{equalTo(){return this}async first(){return access?{}:undefined}async get(){return campaign}}
const Parse={Query,Role:class{},User:class{},File:class{},Cloud:{beforeSave(){},beforeDelete(){},define(n,f){functions[n]=f}}};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../cloud/main.js'),'utf8'),{Parse,require:()=>({}),Date,Buffer,process:{env:{}}});
(async()=>{
 const user={id:'admin'},params={id:'campaign',archived:true};
 await assert.rejects(()=>functions.setCampaignArchived({user:null,params}));
 access=false;await assert.rejects(()=>functions.deleteCampaign({user,params}));access=true;
 await assert.rejects(()=>functions.setCampaignArchived({user,params:{...params,archived:'true'}}));
 await functions.setCampaignArchived({user,params});assert.equal(state.active,false);assert.equal(state.archived,true);
 await assert.rejects(()=>functions.publicCampaign({params:{campaignId:'campaign'}}),/indisponível/);
 await functions.setCampaignArchived({user,params:{...params,archived:false}});assert.equal(state.active,true);assert.equal(state.archived,false);
 await functions.deleteCampaign({user,params});assert.equal(state.deleted,true);assert.equal(state.active,false);assert.equal(campaign.id,'campaign');assert.equal(state.title,'Campanha de teste');
 await assert.rejects(()=>functions.publicCampaign({params:{campaignId:'campaign'}}),/indisponível/);
 await assert.rejects(()=>functions.setCampaignArchived({user,params:{...params,archived:false}}),/indisponível/);
 const before=saves;await functions.deleteCampaign({user,params});assert.equal(saves,before);
 console.log('OK: acesso admin, arquivamento, restauração, exclusão lógica, bloqueio de links e preservação do registro.');
})();
