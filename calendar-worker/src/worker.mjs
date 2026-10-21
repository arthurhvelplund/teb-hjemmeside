import { handleApi } from './api.mjs';
import { flushMail } from './mail.mjs';
import { handleNews } from './news.mjs';
export default {
 async fetch(request,env){
  const path=new URL(request.url).pathname;
  // www sendes videre til hoveddomænet, så login, formularer og cookies kun findes ét sted.
  if(env.REDIRECT_HOST&&new URL(request.url).host===env.REDIRECT_HOST){const url=new URL(request.url);return Response.redirect(env.PUBLIC_ORIGIN+url.pathname+url.search,301);}
  if(['/api/kalender/kilder/tistrup-nyt','/api/kalender/nyheder/tistrup-nyt'].includes(path))return handleNews(request,env);
  if(['/api/kalender/kilder/pulsen','/api/kalender/nyheder/pulsen'].includes(path))return handleNews(request,env,'pulsen');
  if(path==='/api/kalender'||path.startsWith('/api/kalender/'))return handleApi(request,env);
  // Production routes only the API. ASSETS holds print fonts, not the website.
  // The local server separately serves site/index.html and the rest of site/.
  // Testversionen har sit eget domæne og henter hjemmesiden fra Pages-grenen.
  if(env.SITE_ORIGIN&&['GET','HEAD'].includes(request.method)){
   const url=new URL(request.url),site=new URL(url.pathname+url.search,env.SITE_ORIGIN);
   return fetch(new Request(site,{method:request.method,headers:{Accept:request.headers.get('Accept')||'*/*'}}));
  }
  return new Response('Siden findes ikke.',{status:404});
 },
 async scheduled(controller,env,ctx){ctx.waitUntil(flushMail(env));}
};
