'use strict';
const root=document.getElementById('app'), notice=document.getElementById('notice');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>((v||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const names={novo:'Novo',em_atendimento:'Em atendimento',contrato_fechado:'Contrato fechado',comissao_liberada:'Comissão liberada',comissao_paga:'Comissão paga'};
const field=(name,label,type='text')=>`<label>${label}<input name="${name}" type="${type}" required></label>`;
const run=(name,params)=>Parse.Cloud.run(name,params);
function message(t){notice.textContent=t;}
async function action(fn){try{await fn();}catch(e){message(e.message||'Não foi possível concluir.');}}
function bind(id,fn){document.getElementById(id).onsubmit=e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;action(()=>fn(Object.fromEntries(new FormData(e.target)))).finally(()=>{b.disabled=false;});};}
const qs=new URLSearchParams(location.search);
const analysisConfirmation = 'Nossa equipe entrará em contato para analisar seu contrato de financiamento e retornar com uma análise personalizada para sua situação.';
if (qs.has('ref') && qs.has('camp')) {
  document.title = 'Análise personalizada · Soluções Verdes';
  document.querySelector('.eyebrow').textContent = 'Análise gratuita';
  document.querySelector('.hero h1').textContent = 'Seu financiamento merece uma análise personalizada.';
  document.querySelector('.hero > p:last-child').textContent = 'Preencha seus dados. Nossa equipe entrará em contato para entender sua situação e analisar seu contrato de financiamento.';
  document.querySelector('.program-label').textContent = 'Análise de financiamento';
  document.querySelector('footer span').textContent = 'Soluções Verdes · Análise personalizada';
}

const mediaTypes={
 image:{accept:'.png,.jpg,.jpeg,.webp',extensions:/\.(png|jpe?g|webp)$/i,mimes:['image/png','image/jpeg','image/webp'],max:5*1024*1024,label:'Imagem (PNG, JPG ou WebP, até 5 MB)'},
 video:{accept:'.mp4,.webm',extensions:/\.(mp4|webm)$/i,mimes:['video/mp4','video/webm'],max:20*1024*1024,label:'Vídeo (MP4 ou WebM, até 20 MB)'}
};
function validateMedia(file,kind){
 if(!file||!file.name)return null;
 const rule=mediaTypes[kind];
 if(!rule.extensions.test(file.name)||(file.type&&!rule.mimes.includes(file.type)))throw Error('Formato inválido. '+rule.label);
 if(file.size<=0||file.size>rule.max)throw Error(rule.label);
 return file;
}
const uploadedMedia=new WeakMap();
let mediaPreviewUrls=[];
function clearMediaPreviews(){mediaPreviewUrls.forEach(url=>URL.revokeObjectURL(url));mediaPreviewUrls=[];}
function mediaInput(kind){return '<label>'+mediaTypes[kind].label+'<input type="file" name="'+kind+'File" id="'+kind+'-upload" accept="'+mediaTypes[kind].accept+'"></label><div id="'+kind+'-preview" aria-live="polite"></div>';}
function bindMediaPreviews(){
 for(const kind of ['image','video']){
  const input=document.getElementById(kind+'-upload'),preview=document.getElementById(kind+'-preview');
  let previousUrl;
  input.onchange=()=>{if(previousUrl){URL.revokeObjectURL(previousUrl);mediaPreviewUrls=mediaPreviewUrls.filter(u=>u!==previousUrl);}preview.replaceChildren();
   try{const file=validateMedia(input.files[0],kind);if(!file)return;
    previousUrl=URL.createObjectURL(file);mediaPreviewUrls.push(previousUrl);
    const media=document.createElement(kind==='image'?'img':'video');media.src=previousUrl;media.style.cssText='max-width:100%;max-height:260px;display:block;margin:12px 0;border-radius:10px';
    if(kind==='image')media.alt='Prévia da imagem selecionada';else {media.controls=true;media.preload='metadata';}
    preview.append(media);
   }catch(e){input.value='';message(e.message);}
  };
 }
}
async function uploadMedia(file,kind){
 if(!file)return '';
 if(uploadedMedia.has(file))return uploadedMedia.get(file);
 const ext=file.name.split('.').pop().toLowerCase();
 const media=new Parse.File('campanha-'+kind+'.'+ext,file);
 message('Enviando '+(kind==='image'?'imagem':'vídeo')+'… Aguarde a conclusão.');
 await media.save();
 const url=media.url();uploadedMedia.set(file,url);return url;
}

async function render(){
  clearMediaPreviews();
  if(qs.has('ref')&&qs.has('camp'))return capture();
  if(!Parse.User.current())return auth();
  const d=await run('myDashboard');
  root.innerHTML=`<section class="card"><span class="tag">Área do indicador</span><h2>Olá, ${esc(d.name)}</h2><p>Seu código: <strong>${esc(d.referralCode)}</strong></p><p>Percentuais disponíveis: 5%, 7% ou 10%. A empresa define o percentual em cada contrato fechado.</p><button id="logout" class="secondary">Sair</button></section><h2>Campanhas</h2><div class="grid">${d.campaigns.map(c=>`<section class="card"><h2>${esc(c.title)}</h2><p>${esc(c.description)}</p>${/^https:\/\//.test(c.imageUrl||'')?`<img src="${esc(c.imageUrl)}" alt="Arte da campanha" loading="lazy">`:''}${/^https:\/\//.test(c.videoUrl||'')?`<video src="${esc(c.videoUrl)}" controls preload="metadata" style="width:100%;max-height:300px;border-radius:12px" aria-label="Vídeo da campanha"></video>`:''}${['whatsapp','facebook','instagram','link'].map(p=>`<button data-share="${p}" data-id="${esc(c.id)}">${{whatsapp:'Compartilhar no WhatsApp',facebook:'Compartilhar no Facebook',instagram:'Copiar legenda e link para Instagram',link:'Copiar link'}[p]}</button>`).join('')}</section>`).join('')||'<p>Nenhuma campanha ativa.</p>'}</div><h2>Suas indicações</h2>${d.referrals.map(r=>`<section class="card"><strong>${esc(r.referredName)}</strong><p>${names[r.status]||esc(r.status)}</p><p>${r.commissionRate?`${r.commissionRate}% · ${money(r.rewardValueCents)}`:'Comissão a definir no fechamento'}</p></section>`).join('')||'<p>Seu histórico aparecerá aqui.</p>'}${d.isAdmin?'<div id="company"></div>':''}`;
  document.getElementById('logout').onclick=()=>action(async()=>{await Parse.User.logOut();await render();});
  document.querySelectorAll('[data-share]').forEach(b=>b.onclick=()=>action(async()=>{
    const p=b.dataset.share;const s=await run('generateShareLink',{campaignId:b.dataset.id,platform:p});const text=`${s.text||''}\n\nAcesse pelo meu link:\n${s.link}`;
    if(p==='whatsapp')location.href='https://wa.me/?text='+encodeURIComponent(text);
    else if(p==='facebook')location.href='https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(s.link);
    else {await navigator.clipboard.writeText(p==='link'?s.link:text);message(p==='instagram'?'Legenda e link copiados. No Instagram, adicione o link ao story.':'Link copiado.');}
  }));
  if(d.isAdmin)await company();
}
function auth(){root.innerHTML=`<div class="grid"><form id="login" class="card"><h2>Entrar</h2>${field('username','E-mail','email')}${field('password','Senha','password')}<button>Entrar</button></form><form id="signup" class="card"><h2>Quero ser indicador</h2>${field('name','Nome')}${field('phone','WhatsApp com DDD','tel')}${field('email','E-mail','email')}${field('password','Senha (mínimo de 12 caracteres)','password')}<button>Criar conta</button></form></div>`;bind('login',async p=>{await Parse.User.logIn(p.username.toLowerCase().trim(),p.password);await render();});bind('signup',async p=>{if(p.password.length<12)throw Error('Use pelo menos 12 caracteres.');const u=new Parse.User();u.set({...p,username:p.email.toLowerCase().trim(),email:p.email.toLowerCase().trim()});await u.signUp();await render();});}
async function capture(){const c=await run('publicCampaign',{campaignId:qs.get('camp')});root.innerHTML=`<form id="capture" class="card"><h2>Solicite sua análise gratuita</h2><p>Conte com nossa equipe para avaliar seu contrato e apresentar uma análise personalizada.</p>${field('name','Seu nome')}${field('phone','Seu WhatsApp com DDD','tel')}<label>Tem financiamento de veículo ativo?<select name="financing"><option value="true">Sim</option><option value="false">Não</option></select></label><label>Banco<input name="bank"></label><label><input name="consent" type="checkbox" required> Autorizo a Soluções Verdes a entrar em contato para analisar minha solicitação.</label><button>Quero análise gratuita</button><small>O resultado da análise e as condições dependem da negociação.</small></form>`;bind('capture',async p=>{const r=await run('registerReferral',{...p,referralCode:qs.get('ref'),campaignId:qs.get('camp'),source:qs.get('src'),hasFinancing:p.financing==='true',consent:p.consent==='on'});root.innerHTML='<section class="card"><h2>Solicitação recebida ✅</h2><p>'+analysisConfirmation+'</p></section>';message('Seus dados foram recebidos com sucesso ✅');});}
let showArchivedReferrals=false;
async function company(){clearMediaPreviews();const d=await run('companyDashboard',{archived:showArchivedReferrals});document.getElementById('company').innerHTML=`<h2>Painel da empresa</h2><button type="button" id="toggle-archived" class="secondary">${showArchivedReferrals?'Ver indicações ativas':'Ver indicações arquivadas'}</button><h2>${showArchivedReferrals?'Indicações arquivadas':'Indicações ativas'}</h2><form id="campaign" class="card"><h2>Nova campanha</h2>${field('title','Título')}<label>Descrição<textarea name="description"></textarea></label><label>Legenda para compartilhar<textarea name="shareText"></textarea></label>${mediaInput('image')}${mediaInput('video')}<small>Os arquivos serão enviados ao ativar a campanha. Você também pode informar um link abaixo; o arquivo selecionado tem prioridade.</small><details><summary>Usar links HTTPS em vez de arquivos</summary><label>URL HTTPS da imagem<input name="imageUrl" type="url"></label><label>URL HTTPS do vídeo<input name="videoUrl" type="url"></label></details><button>Ativar campanha</button></form>${d.referrals.map(r=>{const next=showArchivedReferrals?null:Object.keys(names)[Object.keys(names).indexOf(r.status)+1];return `<form class="card" id="ref-${esc(r.id)}"><h2>${esc(r.referredName)}</h2><p>${esc(r.referredPhone)} · Indicado por ${esc(r.indicatorName)}</p><span class="tag">${names[r.status]}</span><p>${r.commissionRate?`${r.commissionRate}% · ${money(r.rewardValueCents)}`:'Comissão ainda não definida'}</p>${next==='contrato_fechado'?field('value','Valor total do contrato (R$)','number')+'<label>Comissão<select name="rate"><option>5</option><option>7</option><option>10</option></select></label>':''}${next?`<button>Avançar para ${names[next]}</button>`:''}<button type="button" class="secondary" data-archive-id="${esc(r.id)}">${showArchivedReferrals?'Restaurar indicação':'Arquivar indicação'}</button></form>`;}).join('')}`;
  document.getElementById('toggle-archived').onclick=()=>action(async()=>{showArchivedReferrals=!showArchivedReferrals;await company();});
  document.querySelectorAll('[data-archive-id]').forEach(b=>b.onclick=()=>action(async()=>{
    const archived=!showArchivedReferrals;
    if(!window.confirm(archived?'Arquivar esta indicação? O histórico e a comissão serão preservados.':'Restaurar esta indicação para a lista ativa?'))return;
    b.disabled=true;
    try{await run('setReferralArchived',{id:b.dataset.archiveId,archived});await render();message(archived?'Indicação arquivada.':'Indicação restaurada.');}finally{b.disabled=false;}
  }));
  const valueInput=document.querySelector('input[name=value]');if(valueInput)valueInput.step='0.01';
  bindMediaPreviews();
  bind('campaign',async p=>{
    const image=validateMedia(p.imageFile,'image'),video=validateMedia(p.videoFile,'video');
    const {imageFile,videoFile,...fields}=p;
    if(image)fields.imageUrl=await uploadMedia(image,'image');
    if(video)fields.videoUrl=await uploadMedia(video,'video');
    message('Salvando campanha…');
    await run('saveCampaign',{...fields,active:true});
    await render();message('Campanha ativada com sucesso.');
  });
  d.referrals.forEach(r=>{if(showArchivedReferrals||r.status==='comissao_paga')return;bind('ref-'+r.id,async p=>{await run('updateReferralStatus',{id:r.id,status:Object.keys(names)[Object.keys(names).indexOf(r.status)+1],contractValueCents:Math.round(Number(p.value)*100),commissionRate:Number(p.rate)});await render();});});
}
if(!window.APP_CONFIG?.applicationId||!window.APP_CONFIG?.serverURL){root.innerHTML='<section class="card"><h2>Configuração inicial</h2><p>O código está pronto para conectar ao Back4App. Preencha public/config.js e instale o Cloud Code conforme o README.</p><p>As comissões serão de 5%, 7% ou 10%, escolhidas pela empresa em cada fechamento.</p></section>';}else{Parse.initialize(APP_CONFIG.applicationId,APP_CONFIG.javascriptKey);Parse.serverURL=APP_CONFIG.serverURL;action(render);}
