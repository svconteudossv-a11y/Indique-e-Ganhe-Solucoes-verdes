'use strict';
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {pipeline}=require('node:stream/promises');
const {Transform}=require('node:stream');
const config=require('./server-config.json');
const LIMIT=20*1024*1024;
let busy=false;
function failure(message,status=400){const e=new Error(message);e.status=status;return e;}
async function authorize(token){
 if(!token)throw failure('Entre como administrador para converter vídeos.',401);
 let response;
 try{response=await fetch(config.serverURL+'/functions/authorizeCampaignUpload',{method:'POST',headers:{
  'Content-Type':'application/json','X-Parse-Application-Id':config.applicationId,
  'X-Parse-JavaScript-Key':config.javascriptKey,'X-Parse-Session-Token':token
 },body:'{}',signal:AbortSignal.timeout(10000)});}catch{throw failure('Não foi possível verificar o acesso. Tente novamente.',503);}
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.result?.allowed!==true)throw failure('A conversão exige administrador e Cloud Code atualizado.',403);
}
async function transcode(input,output,binary,signal){
 const args=['-hide_banner','-loglevel','error','-nostdin','-y','-threads','1',
 '-protocol_whitelist','file,pipe','-i',input,'-map','0:v:0','-map','0:a:0?',
 '-vf','pad=ceil(iw/2)*2:ceil(ih/2)*2',
 '-c:v','libx264','-threads','1','-preset','veryfast','-crf','24','-tune','zerolatency','-pix_fmt','yuv420p',
 '-c:a','aac','-b:a','128k','-movflags','+faststart',output];
 await new Promise((resolve,reject)=>{
  const proc=spawn(binary,args,{stdio:['ignore','ignore','pipe']});
  let errorText='',reason;
  const stop=()=>{reason=failure('A conversão foi cancelada.',499);proc.kill('SIGKILL');};
  const timer=setTimeout(()=>{reason=failure('A conversão demorou demais. Tente um vídeo menor.',408);proc.kill('SIGKILL');},90000);
  const sizeTimer=setInterval(()=>{fs.stat(output).then(s=>{if(s.size>LIMIT){reason=failure('O MP4 convertido ultrapassa 20 MB. Use um vídeo menor.',413);proc.kill('SIGKILL');}}).catch(()=>{});},250);
  signal?.addEventListener('abort',stop,{once:true});
  if(signal?.aborted)stop();
  const cleanup=()=>{clearTimeout(timer);clearInterval(sizeTimer);signal?.removeEventListener('abort',stop);};
  proc.stderr.on('data',b=>{if(errorText.length<2048)errorText+=b.toString();});
  proc.on('error',()=>{cleanup();reject(failure('Conversor indisponível no servidor. Verifique a instalação do FFmpeg.',503));});
  proc.on('close',code=>{cleanup();if(reason)reject(reason);else if(code!==0)reject(failure('Não foi possível converter este MOV. O arquivo pode estar danificado ou usar um codec não suportado.'));else resolve();});
 });
 const stat=await fs.stat(output);
 if(stat.size<=0||stat.size>LIMIT)throw failure('O MP4 convertido ultrapassa o limite ou está vazio.',413);
}
function createMovHandler(options={}){
 const auth=options.authorize||authorize;
 const binary=options.ffmpegPath||process.env.FFMPEG_PATH;
 return async function handle(req,res){
  if(busy){req.resume();res.writeHead(429,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Há outro vídeo em conversão. Aguarde e tente novamente.'}));return;}
  busy=true;let folder;
  const controller=new AbortController();
  const disconnect=()=>{if(!res.writableEnded)controller.abort();};
  res.on('close',disconnect);
  try{
   await auth(req.headers['x-parse-session-token']);
   if(!['video/quicktime','application/octet-stream'].includes((req.headers['content-type']||'').split(';')[0]))throw failure('Envie um arquivo MOV.');
   if(Number(req.headers['content-length']||0)>LIMIT)throw failure('O MOV deve ter até 20 MB.',413);
   folder=await fs.mkdtemp(path.join(os.tmpdir(),'sv-mov-'));
   const input=path.join(folder,'input.mov'),output=path.join(folder,'output.mp4');
   let size=0;
   const limiter=new Transform({transform(chunk,enc,cb){size+=chunk.length;cb(size>LIMIT?failure('O MOV deve ter até 20 MB.',413):null,chunk);}});
   await pipeline(req,limiter,require('node:fs').createWriteStream(input),{signal:controller.signal});
   if(!size)throw failure('O arquivo MOV está vazio.');
   const file=await fs.open(input,'r');const header=Buffer.alloc(12);try{await file.read(header,0,12,0);}finally{await file.close();}
   if(!['ftyp','moov','mdat','wide','free','skip','pnot'].includes(header.toString('ascii',4,8)))throw failure('Arquivo MOV inválido.');
   let executable=binary;
   if(!executable){try{executable=require('ffmpeg-static');}catch{throw failure('FFmpeg não instalado. Reimplante o servidor atualizado.',503);}}
   if(!executable)throw failure('FFmpeg indisponível nesta plataforma.',503);
   await transcode(input,output,executable,controller.signal);
   const data=await fs.readFile(output);
   res.writeHead(200,{'Content-Type':'video/mp4','Content-Length':data.length,'Content-Disposition':'attachment; filename="campanha.mp4"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);
  }catch(e){
   if(!res.destroyed&&!res.headersSent){req.resume();res.writeHead(e.status||500,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:e.status?e.message:'Falha na conversão. Tente novamente com um arquivo menor.'}));}
  }finally{res.removeListener('close',disconnect);if(folder)await fs.rm(folder,{recursive:true,force:true}).catch(()=>{});busy=false;}
 };
}
module.exports={createMovHandler,transcode};
