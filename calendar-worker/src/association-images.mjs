import { ensure, json } from './shared.mjs';
import { stmt, rate } from './db.mjs';
import { requireAccess } from './auth.mjs';

export const maxImageBytes=2*1024*1024;
const uuid='[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
export const storedImagePath=new RegExp('^/api/kalender/association-images/('+uuid+')/('+uuid+'\\.(?:jpg|png|webp))$');
export const imageTypes={jpg:'image/jpeg',png:'image/png',webp:'image/webp'};
const types=imageTypes;
export function extension(bytes){
 const text=(start,end)=>String.fromCharCode(...bytes.slice(start,end));
 if(bytes.length>=12&&text(0,4)==='RIFF'&&text(8,12)==='WEBP'&&new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(4,true)===bytes.length-8&&['VP8 ','VP8L','VP8X'].includes(text(12,16)))return 'webp';
 if(bytes.length>=24&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)&&text(12,16)==='IHDR'){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),width=view.getUint32(16),height=view.getUint32(20);
  if(width>0&&height>0&&width<=16000&&height<=16000)return 'png';
 }
 if(bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes.at(-2)===255&&bytes.at(-1)===217)return 'jpg';
 return null;
}
export async function readImage(request){
 ensure(Number(request.headers.get('Content-Length')||0)<=maxImageBytes,413,'Billedet er for stort. Vælg et mindre billede.');
 ensure(request.body,400,'Vælg et billede.');
 const reader=request.body.getReader(),chunks=[];let length=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>maxImageBytes){await reader.cancel();ensure(false,413,'Billedet er for stort. Vælg et mindre billede.');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
export async function uploadAssociationImage(request,env,auth,id){
 ensure(request.headers.get('Origin')===env.PUBLIC_ORIGIN,403,'Billedet skal sendes fra hjemmesiden.');
 await requireAccess(env,auth,id);
 ensure(await stmt(env,'SELECT id FROM associations WHERE id=?',id).first(),404,'Foreningen findes ikke.');
 ensure(env.PDFS,503,'Billeder kan ikke gemmes lige nu. Prøv igen senere.');
 await rate(env,'association-image:'+auth.user.id,30);
 const bytes=await readImage(request),ext=extension(bytes);
 ensure(ext&&request.headers.get('Content-Type')?.split(';')[0]===types[ext],415,'Vælg et JPG-, PNG- eller WebP-billede.');
 // Recheck access after reading the body. Saving the profile checks it again.
 await requireAccess(env,auth,id);
 const filename=crypto.randomUUID()+'.'+ext,key='association-images/'+id+'/'+filename;
 await env.PDFS.put(key,bytes,{httpMetadata:{contentType:types[ext]}});
 await requireAccess(env,auth,id);
 return json({imageUrl:'/api/kalender/'+key},201);
}
export async function associationImage(env,id,filename){
 const image=await env.PDFS?.get('association-images/'+id+'/'+filename);ensure(image,404,'Billedet findes ikke.');
 const bytes=await image.arrayBuffer();
 return new Response(bytes,{headers:{'Content-Type':types[filename.split('.').at(-1)],'Content-Length':String(bytes.byteLength),'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
}
