const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
async function setup(supported=true){
 const elements={},status=id=>elements[id]??={textContent:'',innerHTML:''};
 const buttons={share:{dataset:{videoShare:'c'}},download:{dataset:{videoDownload:'c'}},copy:{dataset:{videoCopy:'c'}}};
 const calls={fetch:0,share:[],links:0,downloads:0,clipboard:[]};let active=false;
 const document={getElementById:status,querySelectorAll:q=>q==='[data-video-share]'?[buttons.share]:q==='[data-video-download]'?[buttons.download]:q==='[data-video-copy]'?[buttons.copy]:[],createElement:()=>({click(){calls.downloads++},remove(){}}),body:{append(){}}};
 const context={document,location:{search:''},URLSearchParams,File,Blob,AbortController,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},setTimeout:()=>1,clearTimeout(){},APP_CONFIG:{},
 navigator:{canShare:()=>supported,share:payload=>{assert.equal(active,true,'share deve iniciar no toque direto');calls.share.push(payload);return Promise.resolve();},clipboard:{writeText:async t=>calls.clipboard.push(t)}},
 fetch:async()=>{calls.fetch++;return {ok:true,headers:{get:()=>100},blob:async()=>new Blob(['video'],{type:'video/mp4'})}},
 Parse:{Cloud:{run:async(name,params)=>{assert.equal(params.platform,'whatsapp');calls.links++;return {link:'https://portal.test/?ref=DANIEL-CAMPOS&camp=c',text:'Campanha'};}}}};
 context.window=context;context.URL.prototype=URL.prototype;
 // URL needs constructor semantics for parsing campaign URLs.
 const originalURL=URL;context.URL=class extends originalURL{};context.URL.createObjectURL=()=> 'blob:test';context.URL.revokeObjectURL=()=>{};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../public/app.js'),'utf8'),context);
 const campaign={id:'c',title:'Campanha teste',videoUrl:'https://files.example/video.mp4'};
 context.bindCampaignVideos([campaign]);
 const tap=async button=>{active=true;button.onclick();active=false;await new Promise(setImmediate);await new Promise(setImmediate);};
 return {context,calls,buttons,status,tap};
}
(async()=>{
 const s=await setup();await s.tap(s.buttons.share);assert.equal(s.calls.share.length,0);assert.equal(s.calls.links,1);
 await s.tap(s.buttons.share);assert.equal(s.calls.share.length,1);assert.equal(s.calls.share[0].files[0].type,'video/mp4');assert.match(s.calls.share[0].text,/ref=DANIEL-CAMPOS/);
 await s.tap(s.buttons.copy);assert.match(s.calls.clipboard[0],/ref=DANIEL-CAMPOS/);
 await s.tap(s.buttons.download);assert.equal(s.calls.downloads,1);assert.equal(s.calls.fetch,1);
 const u=await setup(false);await u.tap(u.buttons.share);await u.tap(u.buttons.share);assert.equal(u.calls.share.length,0);assert.match(u.status('video-status-c').textContent,/Baixar vídeo/);
 const cancel=await setup();await cancel.tap(cancel.buttons.share);cancel.context.navigator.share=()=>Promise.reject(Object.assign(Error(),{name:'AbortError'}));await cancel.tap(cancel.buttons.share);assert.match(cancel.status('video-status-c').textContent,/cancelado/);
 assert.equal(s.context.campaignVideoActions({id:'no-video'}),'');
 console.log('OK: vídeo anexado no segundo toque, link rastreável, cópia, download, cache, fallback e cancelamento. APIs do navegador simuladas.');
})();
