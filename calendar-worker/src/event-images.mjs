import { ensure, json } from './shared.mjs';
import { rate, ipKey } from './db.mjs';
import { readImage, extension, imageTypes } from './association-images.mjs';

export const eventImagePath=/^\/api\/kalender\/event-images\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(?:jpg|png|webp))$/;

export async function uploadEventImage(request,env){
 ensure(request.headers.get('Origin')===env.PUBLIC_ORIGIN,403,'Billedet skal sendes fra hjemmesiden.');
 ensure(env.PDFS,503,'Billeder kan ikke gemmes lige nu. Prøv igen senere.');
 await rate(env,'event-image:'+await ipKey(request),30);
 const bytes=await readImage(request),ext=extension(bytes);
 ensure(ext&&request.headers.get('Content-Type')?.split(';')[0]===imageTypes[ext],415,'Vælg et JPG-, PNG- eller WebP-billede.');
 const filename=crypto.randomUUID()+'.'+ext;
 await env.PDFS.put('event-images/'+filename,bytes,{httpMetadata:{contentType:imageTypes[ext]}});
 return json({imageUrl:'/api/kalender/event-images/'+filename},201);
}

export async function eventImage(env,filename){
 const image=await env.PDFS?.get('event-images/'+filename);
 ensure(image,404,'Billedet findes ikke.');
 return new Response(await image.arrayBuffer(),{headers:{'Content-Type':imageTypes[filename.split('.').at(-1)],'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
}
