import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { database } from './sqlite.mjs';
import worker from '../src/worker.mjs';
const port=Number(process.env.PORT||8787);
const root=resolve(new URL('../../site/',import.meta.url).pathname);
const runtime=resolve(process.env.CALENDAR_DATA_DIR||new URL('../../tmp/kalender-pilot/',import.meta.url).pathname);
await mkdir(runtime,{recursive:true});
const DB=database(resolve(runtime,'calendar.sqlite'));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ttf':'font/ttf','.pdf':'application/pdf'};
const env={DB,LOCAL_PREVIEW:'true',PUBLIC_ORIGIN:`http://localhost:${port}`,EDITOR_EMAIL:'tistrup.kalender@gmail.com',EMAIL_FROM:'kalender@teb-tistrup.dk',
  TEB_EMAIL:{async send(message){await DB.prepare('INSERT INTO local_mail(recipient,subject,body,created_at) VALUES(?,?,?,?)').bind(message.to,message.subject,message.text,new Date().toISOString()).run();return {messageId:'local-only'};}},
  ASSETS:{async fetch(request){try{const url=new URL(request.url);let path=decodeURIComponent(url.pathname);if(path==='/')path='/kalender.html';const file=resolve(root,'.'+path);if(!file.startsWith(root+'/'))return new Response('Ikke fundet',{status:404});return new Response(await readFile(file),{headers:{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'}});}catch{return new Response('Siden findes ikke.',{status:404});}}}
};
const server=http.createServer(async(req,res)=>{try{const parts=[];let size=0;for await(const part of req){size+=part.length;if(size>20000){res.writeHead(413);res.end('For stor forespørgsel');return;}parts.push(part);}const request=new Request(`${env.PUBLIC_ORIGIN}${req.url}`,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(parts),duplex:'half'}:{})});const response=await worker.fetch(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end('Der opstod en fejl.');}});
server.listen(port,'127.0.0.1',()=>console.log(`Kalenderpilot: ${env.PUBLIC_ORIGIN}/kalender.html\nLokal testpostkasse: ${env.PUBLIC_ORIGIN}/kalender-postkasse.html\nLokal SQLite. Ingen e-mails sendes.`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{DB.close();process.exit();}));
