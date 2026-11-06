'use strict';
const {commission, transition, phone, availableReferralCode} = require('./policy');
const master = {useMasterKey:true};
const privateACL = () => new Parse.ACL();
const clean = (v, max=200) => String(v || '').trim().slice(0,max);
const row = o => ({id:o.id, ...o.toJSON()});
// Business objects are only writable through the server functions below.
for (const className of ['Campaign','Referral','ShareLog']) {
  Parse.Cloud.beforeSave(className, request => {if (!request.master) throw new Error('Use as funções do sistema.');});
  Parse.Cloud.beforeDelete(className, request => {if (!request.master) throw new Error('Operação não permitida.');});
}
async function admin(user) {
  if (!user) throw new Error('Entre na sua conta.');
  const role = await new Parse.Query(Parse.Role).equalTo('name','admin').equalTo('users',user).first(master);
  if (!role) throw new Error('Acesso exclusivo da empresa.');
}

async function findIndicator(code) {
  return Parse.Query.or(
    new Parse.Query(Parse.User).equalTo('referralCode', code),
    new Parse.Query(Parse.User).equalTo('previousReferralCode', code)
  ).first(master);
}
async function chooseCode(name, userId) {
  return availableReferralCode(name, async code => {
    const owner = await findIndicator(code);
    return !!owner && owner.id !== userId;
  });
}
// Before deploying, create the unique index on _User.referralCode described in README.
async function migrateLegacyCode(user) {
  const current = await new Parse.Query(Parse.User).get(user.id, master);
  if (!/^SV-[A-F0-9]{24}$/.test(current.get('referralCode') || '')) return current;
  const old = current.get('referralCode');
  const code = await chooseCode(current.get('name'), current.id);
  current.set('previousReferralCode', old);
  current.set('referralCode', code);
  await current.save(null, master);
  return current;
}

async function campaign(id, active=true) {
  const c = await new Parse.Query('Campaign').get(id,master);
  if (active && !c.get('active')) throw new Error('Campanha indisponível.');
  return c;
}
Parse.Cloud.beforeSave(Parse.User, async request => {
  const u = request.object;
  if (!u.existed()) {
    u.set('name',clean(u.get('name'),100));
    if (!u.get('name')) throw new Error('Informe seu nome.');
    u.set('phone',phone(u.get('phone')));
    u.unset('previousReferralCode');
    u.set('referralCode',await chooseCode(u.get('name')));
    u.set('role','indicador');
    u.setACL(privateACL());
  } else if (!request.master && ['referralCode','previousReferralCode','role','category'].some(k=>u.dirty(k))) {
    throw new Error('Este campo é gerenciado pela empresa.');
  }
});
Parse.Cloud.define('myDashboard',async ({user}) => {
  if (!user) throw new Error('Entre na sua conta.');
  user = await migrateLegacyCode(user);
  let isAdmin=false;
  try {await admin(user);isAdmin=true;} catch {}
  const refs=await new Parse.Query('Referral').equalTo('indicator',user).descending('createdAt').limit(100).find(master);
  const campaigns=await new Parse.Query('Campaign').equalTo('active',true).descending('createdAt').limit(100).find(master);
  return {name:user.get('name'),referralCode:user.get('referralCode'),isAdmin,referrals:refs.map(row),campaigns:campaigns.map(row)};
});
Parse.Cloud.define('saveCampaign',async ({user,params}) => {
  await admin(user);
  const c=params.id?await campaign(params.id,false):new Parse.Object('Campaign');
  const title=clean(params.title,120);
  if (!title) throw new Error('Informe o título.');
  for (const key of ['imageUrl','videoUrl']) {
    const value=clean(params[key],2000);
    if (value && !/^https:\/\//.test(value)) throw new Error('Use uma URL HTTPS para a mídia.');
    c.set(key,value);
  }
  c.set({title,description:clean(params.description,3000),shareText:clean(params.shareText,3000),active:params.active===true});
  c.setACL(privateACL());await c.save(null,master);return row(c);
});
Parse.Cloud.define('generateShareLink',async ({user,params}) => {
  if (!user) throw new Error('Entre na sua conta.');
  if (!['whatsapp','facebook','instagram','link'].includes(params.platform)) throw new Error('Canal inválido.');
  const c=await campaign(params.campaignId);
  if (!process.env.PUBLIC_APP_URL) throw new Error('Configure PUBLIC_APP_URL no servidor.');
  user = await migrateLegacyCode(user);
  const url=new URL(process.env.PUBLIC_APP_URL);
  url.search=new URLSearchParams({ref:user.get('referralCode'),camp:c.id,src:params.platform}).toString();
  const log=new Parse.Object('ShareLog');
  log.set({indicator:user,campaign:c,platform:params.platform,referralLink:url.href});log.setACL(privateACL());await log.save(null,master);
  return {link:url.href,text:c.get('shareText'),imageUrl:c.get('imageUrl'),videoUrl:c.get('videoUrl')};
});
Parse.Cloud.define('publicCampaign',async ({params}) => {
  const c=await campaign(params.campaignId);
  return {title:c.get('title'),description:c.get('description'),imageUrl:c.get('imageUrl'),videoUrl:c.get('videoUrl')};
});
Parse.Cloud.define('registerReferral',async ({user,params}) => {
  const c=await campaign(params.campaignId);
  const indicator=params.referralCode ? await findIndicator(clean(params.referralCode,80)) : user;
  if (!indicator) throw new Error('Código de indicação inválido.');
  const name=clean(params.name,100), number=phone(params.phone);
  if (!name || typeof params.hasFinancing!=='boolean') throw new Error('Preencha nome e financiamento ativo.');
  if (number===indicator.get('phone')) throw new Error('Não é possível indicar a si mesmo.');
  if (params.consent!==true) throw new Error('Confirme a autorização de contato.');
  const r=new Parse.Object('Referral');
  r.set({indicator,campaign:c,referredName:name,referredPhone:number,hasFinancing:params.hasFinancing,bank:clean(params.bank,100),status:'novo',consentAt:new Date(),source:['whatsapp','instagram','facebook'].includes(params.source)?params.source:'link'});
  r.setACL(privateACL());await r.save(null,master);
  return {success:true,message:'Indicação recebida com sucesso ✅ A comissão será calculada pela empresa quando o contrato for fechado.'};
}, {rateLimit:{requestTimeWindow:60000,requestCount:10}});
Parse.Cloud.define('companyDashboard',async ({user}) => {
  await admin(user);
  const refs=await new Parse.Query('Referral').include('indicator').descending('createdAt').limit(100).find(master);
  return {referrals:refs.map(r=>({...row(r),indicatorName:r.get('indicator').get('name')}))};
});
Parse.Cloud.define('updateReferralStatus',async ({user,params}) => {
  await admin(user);
  const r=await new Parse.Query('Referral').get(params.id,master);
  const from=r.get('status');transition(from,params.status);
  if (params.status==='contrato_fechado') {
    const amount=commission(params.contractValueCents,params.commissionRate);
    r.set({contractValueCents:params.contractValueCents,commissionRate:params.commissionRate,rewardValueCents:amount,commissionMode:'manual',closedAt:new Date()});
  }
  r.set('status',params.status);r.set('lastChangedBy',user);await r.save(null,master);
  return row(r);
});
