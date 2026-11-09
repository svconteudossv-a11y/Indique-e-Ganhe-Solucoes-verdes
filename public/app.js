'use strict';
const root=document.getElementById('app'), notice=document.getElementById('notice');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>((v||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

function referralDate(value){
  if(!value)return '<small>Data da indicação indisponível</small>';
  const date=new Date(value.iso||value);
  if(Number.isNaN(date.getTime()))return '<small>Data da indicação indisponível</small>';
  const day=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(date);
  const hour=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date);
  return '<small>Indicação recebida em <time datetime="'+date.toISOString()+'">'+day+' às '+hour+'</time> (Brasília)</small>';
}

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
 video:{accept:'.mp4,.webm,.mov',extensions:/\.(mp4|webm|mov)$/i,mimes:['video/mp4','video/webm','video/quicktime'],max:20*1024*1024,label:'Vídeo (MP4, WebM ou MOV, até 20 MB)'}
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
    if(kind==='image')media.alt='Prévia da imagem selecionada';else {media.controls=true;media.preload='metadata';media.onerror=()=>{const warning=document.createElement('small');warning.textContent='Este navegador não conseguiu reproduzir a prévia. O envio do arquivo continua disponível. Para reprodução mais compatível, use MP4.';preview.replaceChildren(media,warning);};}
    preview.append(media);
    if(/\.mov$/i.test(file.name)){const tip=document.createElement('small');tip.textContent='Este MOV será convertido automaticamente para MP4 ao ativar a campanha.';preview.append(tip);}
   }catch(e){input.value='';message(e.message);}
  };
 }
}
async function convertMov(file){
 const token=Parse.User.current()?.getSessionToken();
 if(!token)throw Error('Entre como administrador para enviar vídeos.');
 message('Convertendo MOV para MP4… Aguarde; isso pode levar alguns instantes.');
 const response=await fetch('/api/convert-mov',{method:'POST',headers:{'Content-Type':'video/quicktime','X-Parse-Session-Token':token},body:file});
 if(!response.ok){const detail=await response.json().catch(()=>({}));throw Error(detail.error||'Não foi possível converter. Confira a implantação do servidor e tente novamente.');}
 const blob=await response.blob();
 if(blob.type!=='video/mp4')throw Error('O servidor não retornou um MP4 válido.');
 const converted=new File([blob],file.name.replace(/\.mov$/i,'.mp4'),{type:'video/mp4'});
 validateMedia(converted,'video');
 return converted;
}
async function uploadMedia(file,kind){
 if(!file)return '';
 if(uploadedMedia.has(file))return uploadedMedia.get(file);
 const source=kind==='video' && /\.mov$/i.test(file.name)?await convertMov(file):file;
 const ext=source.name.split('.').pop().toLowerCase();
 const media=new Parse.File('campanha-'+kind+'.'+ext,source);
 message('Enviando '+(kind==='image'?'imagem':'vídeo')+'… Aguarde a conclusão.');
 await media.save();
 const url=media.url();uploadedMedia.set(file,url);return url;
}


let cachedCampaignVideo=null;
async function campaignVideoFile(campaign){
 if(cachedCampaignVideo?.url===campaign.videoUrl)return cachedCampaignVideo.file;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
 try{
  const response=await fetch(campaign.videoUrl,{credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal});
  if(!response.ok)throw Error('Não foi possível baixar o vídeo.');
  if(Number(response.headers.get('content-length')||0)>20*1024*1024)throw Error('O vídeo ultrapassa o limite de 20 MB para compartilhar pelo portal.');
  const blob=await response.blob();
  if(!blob.size||blob.size>20*1024*1024)throw Error('O vídeo está vazio ou ultrapassa 20 MB.');
  const pathname=new URL(campaign.videoUrl).pathname;
  const ext=pathname.match(/\.(mp4|webm|mov)$/i)?.[1].toLowerCase()||'mp4';
  const type={mp4:'video/mp4',webm:'video/webm',mov:'video/quicktime'}[ext];
  const name=(campaign.title||'campanha').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,70)||'campanha';
  const file=new File([blob],name+'.'+ext,{type});
  cachedCampaignVideo={url:campaign.videoUrl,file};return file;
 }finally{clearTimeout(timer);}
}
function supportsVideoShare(file){
 try{return typeof navigator.share==='function'&&typeof navigator.canShare==='function'&&navigator.canShare({files:[file]});}catch{return false;}
}
function saveCampaignVideo(file){
 const url=URL.createObjectURL(file),a=document.createElement('a');
 a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function campaignVideoActions(c){
 if(!/^https:\/\//.test(c.videoUrl||''))return '';
 return '<div><button type="button" data-video-share="'+esc(c.id)+'">Compartilhar vídeo</button><button type="button" class="secondary" data-video-download="'+esc(c.id)+'">Baixar vídeo</button><button type="button" class="secondary" data-video-copy="'+esc(c.id)+'">Copiar legenda e link</button><small id="video-status-'+esc(c.id)+'" role="status" aria-live="polite">Prepare o vídeo e toque novamente para escolher o WhatsApp. Você confirma o envio no aplicativo.</small><a href="'+esc(c.videoUrl)+'" target="_blank" rel="noopener noreferrer">Abrir vídeo para salvar manualmente</a></div>';
}
function bindCampaignVideos(campaigns){
 const prepared=new Map();
 const getCampaign=id=>campaigns.find(c=>c.id===id);
 const status=(id,text)=>{document.getElementById('video-status-'+id).textContent=text;};
 const caption=s=>(s.text||'')+'\n\nAcesse pelo meu link:\n'+s.link;
 document.querySelectorAll('[data-video-share]').forEach(button=>{
  button.onclick=()=>{
   const id=button.dataset.videoShare,c=getCampaign(id),ready=prepared.get(id);
   if(ready){
    // Call share directly on the second tap, before any fetch or other awaited operation.
    if(!supportsVideoShare(ready.file)){status(id,'Este navegador não permite compartilhar arquivos. Use Baixar vídeo e Copiar legenda e link.');return;}
    button.disabled=true;
    navigator.share({files:[ready.file],text:ready.text,title:c.title})
     .then(()=>status(id,'Compartilhamento encerrado no dispositivo. Confira o envio no aplicativo escolhido.'))
     .catch(e=>status(id,e.name==='AbortError'?'Compartilhamento cancelado. Você pode tentar novamente.':'Não foi possível abrir o compartilhamento. Use Baixar vídeo e Copiar legenda e link.'))
     .finally(()=>{button.disabled=false;});
    return;
   }
   button.disabled=true;status(id,'Preparando vídeo e link de indicação…');
   action(async()=>{
    try{
     const file=await campaignVideoFile(c);
     const share=await run('generateShareLink',{campaignId:id,platform:'whatsapp'});
     prepared.set(id,{file,text:caption(share)});
     if(supportsVideoShare(file)){
      button.textContent='Escolher WhatsApp e compartilhar';
      status(id,'Vídeo pronto. Toque no botão acima e escolha o WhatsApp. Confira se a legenda e o link foram incluídos.');
     }else{status(id,'Vídeo pronto. Este navegador não compartilha arquivos: use Baixar vídeo e Copiar legenda e link.');}
    }catch(e){status(id,'Não foi possível preparar o vídeo. Você pode usar Abrir vídeo para salvar manualmente.');throw e;}
    finally{button.disabled=false;}
   });
  };
 });
 document.querySelectorAll('[data-video-download]').forEach(button=>button.onclick=()=>action(async()=>{
  const id=button.dataset.videoDownload;button.disabled=true;status(id,'Preparando download…');
  try{const file=await campaignVideoFile(getCampaign(id));saveCampaignVideo(file);status(id,'Download solicitado ao navegador. Depois, anexe o vídeo no WhatsApp e cole a legenda com seu link.');}
  catch(e){status(id,'O download foi bloqueado ou falhou. Use Abrir vídeo para salvar manualmente.');throw e;}
  finally{button.disabled=false;}
 }));
 document.querySelectorAll('[data-video-copy]').forEach(button=>button.onclick=()=>action(async()=>{
  const id=button.dataset.videoCopy;button.disabled=true;
  try{let text=prepared.get(id)?.text;if(!text){text=caption(await run('generateShareLink',{campaignId:id,platform:'whatsapp'}));}
   await navigator.clipboard.writeText(text);status(id,'Legenda e link copiados. Cole junto do vídeo no WhatsApp para manter sua identificação.');
  }finally{button.disabled=false;}
 }));
}

async function render(){
  cachedCampaignVideo=null;
  clearMediaPreviews();
  if(qs.has('ref')&&qs.has('camp'))return capture();
  if(!Parse.User.current())return auth();
  const d=await run('myDashboard');
  root.innerHTML=`<section class="card"><span class="tag">Área do indicador</span><h2>Olá, ${esc(d.name)}</h2><p>Seu código: <strong>${esc(d.referralCode)}</strong></p><p>Percentuais disponíveis: 5%, 7% ou 10%. A empresa define o percentual em cada contrato fechado.</p><button id="logout" class="secondary">Sair</button></section><section class="card"><span class="tag">Sua rede tem valor</span><h2>Sua próxima indicação pode virar uma nova conquista.</h2><p>Conhece alguém que precisa de ajuda com o financiamento do veículo? Compartilhe seu link exclusivo. Nossa equipe cuida do atendimento, e você acompanha o andamento por aqui.</p><a href="#campaigns">Escolha uma campanha e faça sua próxima indicação →</a><small>A comissão é devida quando a indicação fecha contrato, conforme o percentual e as regras definidos pela empresa.</small></section><div class="grid"><section class="card"><h2>Uma conversa pode abrir uma oportunidade.</h2><p>Lembrou de alguém com financiamento? Envie seu link e apresente a análise gratuita da Soluções Verdes.</p></section><section class="card"><h2>Compartilhe uma solução. Amplie suas possibilidades.</h2><p>Use as campanhas prontas para alcançar pessoas que possam se beneficiar do nosso atendimento.</p></section><section class="card"><h2>Você indica. A gente atende. Você acompanha.</h2><p>Consulte suas indicações e suas comissões no painel. Quando lembrar de outra pessoa que precisa de ajuda, compartilhe novamente.</p></section></div><h2 id="campaigns">Campanhas para compartilhar</h2><div class="grid">${d.campaigns.map(c=>`<section class="card"><h2>${esc(c.title)}</h2><p>${esc(c.description)}</p>${/^https:\/\//.test(c.imageUrl||'')?`<img src="${esc(c.imageUrl)}" alt="Arte da campanha" loading="lazy">`:''}${/^https:\/\//.test(c.videoUrl||'')?`<video src="${esc(c.videoUrl)}" controls preload="metadata" style="width:100%;max-height:300px;border-radius:12px" aria-label="Vídeo da campanha"></video>`:''}${campaignVideoActions(c)}${['whatsapp','facebook','instagram','link'].map(p=>`<button data-share="${p}" data-id="${esc(c.id)}">${{whatsapp:'Compartilhar link no WhatsApp',facebook:'Compartilhar no Facebook',instagram:'Copiar legenda e link para Instagram',link:'Copiar link'}[p]}</button>`).join('')}</section>`).join('')||'<p>Nenhuma campanha ativa.</p>'}</div><h2>Suas indicações</h2>${d.referrals.map(r=>`<section class="card"><strong>${esc(r.referredName)}</strong>${referralDate(r.createdAt)}<p>${names[r.status]||esc(r.status)}</p><p>${r.commissionRate?`${r.commissionRate}% · ${money(r.rewardValueCents)}`:'Comissão a definir no fechamento'}</p></section>`).join('')||'<p>Seu histórico aparecerá aqui.</p>'}${d.isAdmin?'<div id="company"></div>':''}`;
  document.getElementById('logout').onclick=()=>action(async()=>{await Parse.User.logOut();await render();});
  document.querySelectorAll('[data-share]').forEach(b=>b.onclick=()=>action(async()=>{
    const p=b.dataset.share;const s=await run('generateShareLink',{campaignId:b.dataset.id,platform:p});const text=`${s.text||''}\n\nAcesse pelo meu link:\n${s.link}`;
    if(p==='whatsapp')location.href='https://wa.me/?text='+encodeURIComponent(text);
    else if(p==='facebook')location.href='https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(s.link);
    else {await navigator.clipboard.writeText(p==='link'?s.link:text);message(p==='instagram'?'Legenda e link copiados. No Instagram, adicione o link ao story.':'Link copiado.');}
  }));
  bindCampaignVideos(d.campaigns);
  if(d.isAdmin)await company();
}
function auth(){root.innerHTML=`<div class="grid"><form id="login" class="card"><h2>Entrar</h2>${field('username','E-mail','email')}${field('password','Senha','password')}<button>Entrar</button></form><form id="signup" class="card"><h2>Quero ser indicador</h2>${field('name','Nome')}${field('phone','WhatsApp com DDD','tel')}${field('email','E-mail','email')}${field('password','Senha (mínimo de 12 caracteres)','password')}<button>Criar conta</button></form></div>`;bind('login',async p=>{await Parse.User.logIn(p.username.toLowerCase().trim(),p.password);await render();});bind('signup',async p=>{if(p.password.length<12)throw Error('Use pelo menos 12 caracteres.');const u=new Parse.User();u.set({...p,username:p.email.toLowerCase().trim(),email:p.email.toLowerCase().trim()});await u.signUp();await render();});}

function installmentCents(value){
 let text=String(value??'').trim().replace(/^R\$\s*/i,'');
 if(/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(text))text=text.replace(/\./g,'').replace(',','.');
 else if(/^\d+(,\d{1,2})?$/.test(text))text=text.replace(',','.');
 else if(!/^\d+\.\d{1,2}$/.test(text))throw Error('Informe o valor da parcela, por exemplo 2.500,00.');
 const [whole,fraction='']=text.split('.');
 const cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 if(!Number.isSafeInteger(cents)||cents<=0||cents>100000000)throw Error('Informe um valor de parcela válido, maior que zero.');
 return cents;
}

async function capture(){const c=await run('publicCampaign',{campaignId:qs.get('camp')});root.innerHTML=`<form id="capture" class="card"><h2>Solicite sua análise gratuita</h2><p>Conte com nossa equipe para avaliar seu contrato e apresentar uma análise personalizada.</p>${field('name','Seu nome')}${field('phone','Seu WhatsApp com DDD','tel')}<label>Tem financiamento de veículo ativo?<select name="financing"><option value="true">Sim</option><option value="false">Não</option></select></label><label>Qual banco financiou seu veículo?<input name="bank" placeholder="Ex.: Santander, Itaú, BV ou PAN"></label><label>Qual é o veículo? (marca e modelo)<input name="vehicle" maxlength="120" placeholder="Ex.: Chevrolet Onix 2022" required></label><label>Valor da parcela (R$)<input name="installment" type="text" inputmode="decimal" placeholder="Ex.: 2.500,00" required></label><label><input name="consent" type="checkbox" required> Autorizo a Soluções Verdes a entrar em contato para analisar minha solicitação.</label><button>Quero análise gratuita</button><small>O resultado da análise e as condições dependem da negociação.</small></form>`;bind('capture',async p=>{const r=await run('registerReferral',{...p,referralCode:qs.get('ref'),campaignId:qs.get('camp'),source:qs.get('src'),installmentValueCents:installmentCents(p.installment),hasFinancing:p.financing==='true',consent:p.consent==='on'});root.innerHTML='<section class="card"><h2>Solicitação recebida ✅</h2><p>'+analysisConfirmation+'</p></section>';message('Seus dados foram recebidos com sucesso ✅');});}

let showArchivedCampaigns=false;
function campaignManager(campaigns){
 const list=campaigns.filter(c=>(c.archived===true)===showArchivedCampaigns);
 return '<section><h2>Gerenciar campanhas</h2><button type="button" id="toggle-archived-campaigns" class="secondary">'+(showArchivedCampaigns?'Ver campanhas ativas':'Ver campanhas arquivadas')+'</button><p>'+(showArchivedCampaigns?'Campanhas arquivadas':'Campanhas não arquivadas')+'</p>'+list.map(c=>'<article class="card"><h2>'+esc(c.title)+'</h2><span class="tag">'+(c.archived?'Arquivada':c.active?'Ativa':'Inativa')+'</span><p>'+esc(c.description)+'</p><button type="button" class="secondary" data-campaign-archive="'+esc(c.id)+'">'+(c.archived?'Restaurar campanha':'Arquivar campanha')+'</button><button type="button" class="secondary" data-campaign-delete="'+esc(c.id)+'">Excluir campanha</button></article>').join('')+(list.length?'':'<p>Nenhuma campanha nesta lista.</p>')+'</section>';
}
function bindCampaignManagement(){
 document.getElementById('toggle-archived-campaigns').onclick=()=>action(async()=>{showArchivedCampaigns=!showArchivedCampaigns;await company();});
 document.querySelectorAll('[data-campaign-archive]').forEach(b=>b.onclick=()=>action(async()=>{
  const archived=!showArchivedCampaigns;
  if(!window.confirm(archived?'Arquivar esta campanha? Ela sairá da área dos indicadores e seus links ficarão indisponíveis até a restauração. O histórico será preservado.':'Restaurar esta campanha? Ela voltará ao estado anterior ao arquivamento.'))return;
  b.disabled=true;
  try{await run('setCampaignArchived',{id:b.dataset.campaignArchive,archived});await render();message(archived?'Campanha arquivada.':'Campanha restaurada.');}finally{b.disabled=false;}
 }));
 document.querySelectorAll('[data-campaign-delete]').forEach(b=>b.onclick=()=>action(async()=>{
  if(!window.confirm('Excluir esta campanha do painel e desativar seus links? Não haverá opção de restauração no painel. O histórico das indicações e comissões será preservado.'))return;
  b.disabled=true;
  try{await run('deleteCampaign',{id:b.dataset.campaignDelete});await render();message('Campanha excluída do painel. Histórico preservado.');}finally{b.disabled=false;}
 }));
}

let showArchivedReferrals=false;
async function company(){clearMediaPreviews();const d=await run('companyDashboard',{archived:showArchivedReferrals});document.getElementById('company').innerHTML=`<h2>Painel da empresa</h2><p>Incentive sua rede a compartilhar soluções: mantenha campanhas atualizadas e acompanhe cada oportunidade até o fechamento.</p><button type="button" id="toggle-archived" class="secondary">${showArchivedReferrals?'Ver indicações ativas':'Ver indicações arquivadas'}</button><h2>${showArchivedReferrals?'Indicações arquivadas':'Indicações ativas'}</h2><form id="campaign" class="card"><h2>Nova campanha</h2>${field('title','Título')}<label>Descrição<textarea name="description"></textarea></label><label>Legenda para compartilhar<textarea name="shareText"></textarea></label>${mediaInput('image')}${mediaInput('video')}<small>Os arquivos serão enviados ao ativar a campanha. Você também pode informar um link abaixo; o arquivo selecionado tem prioridade.</small><details><summary>Usar links HTTPS em vez de arquivos</summary><label>URL HTTPS da imagem<input name="imageUrl" type="url"></label><label>URL HTTPS do vídeo<input name="videoUrl" type="url"></label></details><button>Ativar campanha</button></form>${campaignManager(d.campaigns||[])}${d.referrals.map(r=>{const next=showArchivedReferrals?null:Object.keys(names)[Object.keys(names).indexOf(r.status)+1];return `<form class="card" id="ref-${esc(r.id)}"><h2>${esc(r.referredName)}</h2>${referralDate(r.createdAt)}<p>${esc(r.referredPhone)} · Indicado por ${esc(r.indicatorName)}</p><p>Veículo: ${esc(r.vehicle||'Não informado')}<br>Parcela: ${Number.isSafeInteger(r.installmentValueCents)?money(r.installmentValueCents):'Não informada'}</p><span class="tag">${names[r.status]}</span><p>${r.commissionRate?`${r.commissionRate}% · ${money(r.rewardValueCents)}`:'Comissão ainda não definida'}</p>${next==='contrato_fechado'?field('value','Valor total do contrato (R$)','number')+'<label>Comissão<select name="rate"><option>5</option><option>7</option><option>10</option></select></label>':''}${next?`<button>Avançar para ${names[next]}</button>`:''}<button type="button" class="secondary" data-archive-id="${esc(r.id)}">${showArchivedReferrals?'Restaurar indicação':'Arquivar indicação'}</button></form>`;}).join('')}`;
  document.getElementById('toggle-archived').onclick=()=>action(async()=>{showArchivedReferrals=!showArchivedReferrals;await company();});
  document.querySelectorAll('[data-archive-id]').forEach(b=>b.onclick=()=>action(async()=>{
    const archived=!showArchivedReferrals;
    if(!window.confirm(archived?'Arquivar esta indicação? O histórico e a comissão serão preservados.':'Restaurar esta indicação para a lista ativa?'))return;
    b.disabled=true;
    try{await run('setReferralArchived',{id:b.dataset.archiveId,archived});await render();message(archived?'Indicação arquivada.':'Indicação restaurada.');}finally{b.disabled=false;}
  }));
  const valueInput=document.querySelector('input[name=value]');if(valueInput)valueInput.step='0.01';
  bindMediaPreviews();
  bindCampaignManagement();
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
