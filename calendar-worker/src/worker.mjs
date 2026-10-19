import { handleApi } from './api.mjs';
import { flushMail } from './mail.mjs';
import { handleNews } from './news.mjs';
export default {
 async fetch(request,env){
  const path=new URL(request.url).pathname;
  if(['/api/kalender/kilder/tistrup-nyt','/api/kalender/nyheder/tistrup-nyt'].includes(path))return handleNews(request,env);
  if(['/api/kalender/kilder/pulsen','/api/kalender/nyheder/pulsen'].includes(path))return handleNews(request,env,'pulsen');
  if(path==='/api/kalender'||path.startsWith('/api/kalender/'))return handleApi(request,env);
  // Production routes only the API. ASSETS holds print fonts, not the website.
  // The local server separately serves site/index.html and the rest of site/.
  return new Response('Siden findes ikke.',{status:404});
 },
 async scheduled(controller,env,ctx){ctx.waitUntil(flushMail(env));}
};
