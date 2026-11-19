const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),http=require('node:http');const {execFileSync}=require('node:child_process');
const {createMovHandler}=require('../mov-converter');
test('converte MOV real para MP4 e recusa acesso não autorizado',async t=>{
 let binary=process.env.FFMPEG_PATH;try{binary=binary||require('ffmpeg-static');execFileSync(binary,['-version'],{stdio:'ignore'});}catch{t.skip('FFmpeg não disponível neste ambiente');return;}
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'sv-conversion-test-'));let server;
 try{
  const input=path.join(folder,'sample.mov');execFileSync(binary,['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c=green:s=320x240:r=10','-t','1','-c:v','qtrle',input]);
  const handler=createMovHandler({ffmpegPath:binary,authorize:async token=>{if(token!=='test-admin'){const e=Error('Não autorizado');e.status=403;throw e;}}});
  server=http.createServer((req,res)=>void handler(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url='http://127.0.0.1:'+server.address().port,data=await fs.readFile(input);
  const denied=await fetch(url,{method:'POST',headers:{'Content-Type':'video/quicktime'},body:data});assert.equal(denied.status,403);await denied.text();
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'video/quicktime','X-Parse-Session-Token':'test-admin'},body:data});assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'video/mp4');
  const output=path.join(folder,'output.mp4');const bytes=Buffer.from(await response.arrayBuffer());await fs.writeFile(output,bytes);assert.equal(bytes.toString('ascii',4,8),'ftyp');
  execFileSync(binary,['-hide_banner','-loglevel','error','-i',output,'-f','null','-'],{stdio:'ignore'});
 }finally{if(server)await new Promise(r=>server.close(r));await fs.rm(folder,{recursive:true,force:true});}
});
