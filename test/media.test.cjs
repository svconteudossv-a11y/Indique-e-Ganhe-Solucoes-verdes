const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const triggers=new Map();let allowed=true;
class Query{equalTo(){return this}async first(){return allowed?{}:undefined}}
const Parse={File:class{},User:class{},Role:class{},Query,Cloud:{beforeSave(c,f){triggers.set(c,f)},beforeDelete(){},define(){}}};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../cloud/main.js'),'utf8'),{Parse,Buffer,require:()=>({}),process:{env:{}},Date});
const upload=triggers.get(Parse.File);
const request=(name,bytes,user={id:'admin'})=>({user,file:{name:()=>name,getData:async()=>bytes.toString('base64')}});
const png=Buffer.from([137,80,78,71,13,10,26,10,0]);
const app={document:{getElementById:()=>({innerHTML:'',textContent:''})},location:{search:''},URLSearchParams,URL,APP_CONFIG:{}};app.window=app;
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../public/app.js'),'utf8'),app);
(async()=>{
 await upload(request('logo.png',png));
 await assert.rejects(()=>upload(request('logo.png',png,null)));
 allowed=false;await assert.rejects(()=>upload(request('logo.png',png)));allowed=true;
 await assert.rejects(()=>upload(request('fake.png',Buffer.from('not an image'))));
 const large=Buffer.alloc(5*1024*1024+1);png.copy(large);await assert.rejects(()=>upload(request('large.png',large)));
 await upload(request('video.mp4',Buffer.from([0,0,0,12,102,116,121,112,105,115,111,109])));
 assert.throws(()=>app.validateMedia({name:'video.mp4',type:'video/mp4',size:21*1024*1024},'video'));
 assert.throws(()=>app.validateMedia({name:'attack.svg',type:'image/svg+xml',size:100},'image'));
 assert.equal(app.validateMedia({name:'logo.png',type:'image/png',size:100},'image').name,'logo.png');
 let saves=0;app.Parse={File:class{async save(){saves++}url(){return 'https://example.test/logo.png'}}};
 const file={name:'logo.png'};await app.uploadMedia(file,'image');await app.uploadMedia(file,'image');assert.equal(saves,1);
 console.log('OK: upload só admin, formatos/assinaturas, limites de tamanho, MP4, validação no cliente e reaproveitamento após retry.');
})();
