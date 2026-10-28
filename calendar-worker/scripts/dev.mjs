import http from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { database } from './sqlite.mjs';
import { localR2 } from './r2.mjs';
import { token } from '../src/shared.mjs';
import worker from '../src/worker.mjs';
import { syncSite } from '../../scripts/sync-site.mjs';
// Always prepare the same static files that will later be published.
await syncSite();
const port=Number(process.env.PORT||8787);
const root=resolve(fileURLToPath(new URL('../../site/',import.meta.url)));
const runtime=resolve(process.env.CALENDAR_DATA_DIR||fileURLToPath(new URL('../.wrangler/local-portal/',import.meta.url)));
await mkdir(runtime,{recursive:true});
const DB=database(resolve(runtime,'calendar.sqlite'));
const secretFile=resolve(runtime,'mail-key');
let mailKey;
try{mailKey=(await readFile(secretFile,'utf8')).trim();}catch(error){if(error.code!=='ENOENT')throw error;mailKey=token();await writeFile(secretFile,mailKey,{flag:'wx',mode:0o600});}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf','.woff2':'font/woff2','.pdf':'application/pdf','.ico':'image/x-icon'};
const assets={async fetch(request){
 try{
  const url=new URL(request.url);let path=decodeURIComponent(url.pathname);if(path.endsWith('/'))path+='index.html';
  const file=resolve(root,'.'+path);if(!file.startsWith(root+sep))return new Response('Siden findes ikke.',{status:404});
  return new Response(await readFile(file),{headers:{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'}});
 }catch{return new Response('Siden findes ikke.',{status:404});}
}};
const editorEmail=process.env.EDITOR_EMAIL||'tistrup.kalender@gmail.com';
const printRoot=resolve(fileURLToPath(new URL('../assets/',import.meta.url)));
const printAssets={async fetch(request){
 try{const file=resolve(printRoot,'.'+decodeURIComponent(new URL(request.url).pathname));if(!file.startsWith(printRoot+sep))return new Response(null,{status:404});return new Response(await readFile(file),{headers:{'Content-Type':mime[extname(file)]||'application/octet-stream'}});}catch{return new Response(null,{status:404});}
}};
const env={DB,PDFS:localR2(resolve(runtime,'r2')),LOCAL_PREVIEW:'true',PUBLIC_ORIGIN:`http://localhost:${port}`,EDITOR_EMAIL:editorEmail,EMAIL_FROM:'kalender@example.test',TEB_ADMIN_EMAILS:process.env.TEB_ADMIN_EMAILS||editorEmail,MAIL_ENCRYPTION_KEY:mailKey,ASSETS:printAssets};
const server=http.createServer(async(req,res)=>{
 try{
  const imageUpload=req.method==='POST'&&(/^\/api\/kalender\/associations\/[^/]+\/image$/.test(req.url)||req.url==='/api/kalender/event-images');
  const limit=imageUpload?2*1024*1024:20000;
  const parts=[];let size=0;
  for await(const part of req){size+=part.length;if(size>limit){res.writeHead(413,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Indsendelsen er for stor.'}));return;}parts.push(part);}
  // Keep the actual Host for loopback-only endpoints. A forwarded external Host
  // must not become localhost merely because the server binds to loopback.
  const host=req.headers.host||`localhost:${port}`;
  if(![`localhost:${port}`,`127.0.0.1:${port}`,`[::1]:${port}`].includes(host)){res.writeHead(403);res.end('Kun lokal adgang.');return;}
  const request=new Request(`http://${host}${req.url}`,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(parts),duplex:'half'}:{})});
  const pathname=new URL(request.url).pathname;
  const response=pathname==='/api/kalender'||pathname.startsWith('/api/kalender/')?await worker.fetch(request,{...env,PUBLIC_ORIGIN:new URL(request.url).origin}):await assets.fetch(request);
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(req.method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end('Der opstod en fejl.');}
});
server.listen(port,'127.0.0.1',()=>console.log(`TEB lokal: ${env.PUBLIC_ORIGIN}/\nLokal testpostkasse: ${env.PUBLIC_ORIGIN}/kalender-postkasse.html\nTEB-login: ${editorEmail}\nLokal SQLite og R2. Ingen e-mails sendes.`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{DB.close();process.exit();}));
