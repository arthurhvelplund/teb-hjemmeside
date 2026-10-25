import { loginPassword, setPassword, ownPassword } from './passwords.mjs';
import { HttpError, ensure, json } from './shared.mjs';
import { local, stmt, all } from './db.mjs';
import { identity, sessionData, requestOtp, verifyOtp, logout, requireAccess } from './auth.mjs';
import { associations, saveAssociation, createAssociation, members, invite, revoke, accessRequests, requestAccess, decideAccess } from './associations.mjs';
import { publicEvents, createEvent, author, privateData, guestUpdate, memberUpdate, review, myEvents, adminEvents } from './events.mjs';
import { editionCandidates, previewEdition, finalizeEdition, listEditions, editionPdf } from './editions.mjs';
import { localMailbox, flushMail } from './mail.mjs';
import { handlePosts } from './posts.mjs';
import { experiment } from './experiment.mjs';
import { uploadAssociationImage, associationImage, storedImagePath } from './association-images.mjs';
import { uploadEventImage, eventImage, eventImagePath } from './event-images.mjs';
const base='/api/kalender';
async function body(request,env){
 ensure(request.headers.get('Origin')===env.PUBLIC_ORIGIN,403,'Indsendelsen skal komme fra hjemmesiden.');
 ensure(request.headers.get('Content-Type')?.split(';')[0]==='application/json',415,'Ugyldigt formularformat.');
 ensure(Number(request.headers.get('Content-Length')||0)<=16000,413,'Indsendelsen er for stor.');
 const text=await request.text();ensure(new TextEncoder().encode(text).length<=16000,413,'Indsendelsen er for stor.');
 let data;try{data=JSON.parse(text);}catch{throw new HttpError(400,'Ugyldigt formularformat.');}
 ensure(data&&typeof data==='object'&&!Array.isArray(data),400,'Ugyldigt formularformat.');return data;
}
async function api(request,env){
 const url=new URL(request.url),route=url.pathname.slice(base.length),method=request.method;
 ensure(url.pathname===base||url.pathname.startsWith(base+'/'),404,'Siden findes ikke.');
 if(route==='/config'&&method==='GET')return json({mode:local(env)?'local':'live',submissionsEnabled:Boolean(env.DB&&env.MAIL_ENCRYPTION_KEY&&(local(env)||env.TEB_EMAIL)&&env.PUBLIC_ORIGIN&&env.EDITOR_EMAIL&&env.EMAIL_FROM),editorEmail:local(env)?(env.EDITOR_EMAIL||'').split(',')[0].trim():''});
 ensure(env.DB&&env.PUBLIC_ORIGIN,503,'Databasen er ikke tilsluttet.');
 ensure(['GET','POST'].includes(method),405,'Denne handling er ikke tilladt.');
 const image=route.match(/^\/associations\/([^/]+)\/image$/);
 if(image&&method==='POST')return uploadAssociationImage(request,env,await identity(request,env),image[1]);
 const storedImage=url.pathname.match(storedImagePath);
 if(storedImage&&method==='GET')return associationImage(env,storedImage[1],storedImage[2]);
 if(route==='/event-images'&&method==='POST')return uploadEventImage(request,env);
 const storedEventImage=url.pathname.match(eventImagePath);
 if(storedEventImage&&method==='GET')return eventImage(env,storedEventImage[1]);
 const data=method==='POST'?await body(request,env):null;
 if(route==='/local-mail'&&method==='GET')return json(await localMailbox(request,env));
 if(route==='/auth/password/login'&&method==='POST')return loginPassword(request,env,data);
 if(route==='/auth/request'&&method==='POST')return requestOtp(request,env,data);
 if(route==='/auth/verify'&&method==='POST')return verifyOtp(request,env,data);
 if(['/auth/logout','/admin/logout'].includes(route)&&method==='POST')return logout(request,env);
 const auth=await identity(request,env);
 if(route==='/auth/password'&&method==='POST')return ownPassword(env,auth,data);
 const passwordMember=route.match(/^\/admin\/associations\/([^/]+)\/members\/([^/]+)\/password$/);
 if(passwordMember&&method==='POST')return setPassword(request,env,auth,data,passwordMember[1],passwordMember[2]);
 if(route==='/posts'||route==='/me/posts'||route.startsWith('/member/posts/')||route.startsWith('/posts/')||route.startsWith('/admin/posts'))return handlePosts(request,env,auth,route,data);
 if(route.startsWith('/experiment/'))return experiment(request,env,auth,route,data);
 if(route==='/session'&&method==='GET')return json(await sessionData(env,auth));
 if(route==='/associations'&&method==='GET')return associations(env);
 let match=route.match(/^\/associations\/([^/]+)$/);
 if(match)return method==='GET'?associations(env,match[1]):saveAssociation(env,auth,match[1],data);
 match=route.match(/^\/associations\/([^/]+)\/members$/);
 if(match&&method==='GET')return members(env,auth,match[1]);
 match=route.match(/^\/associations\/([^/]+)\/invitations$/);
 if(match&&method==='POST')return invite(env,auth,match[1],data);
 match=route.match(/^\/associations\/([^/]+)\/members\/([^/]+)\/revoke$/);
 if(match&&method==='POST')return revoke(env,auth,match[1],match[2]);
 if(route==='/admin/associations'&&method==='POST')return createAssociation(env,auth,data);
 match=route.match(/^\/admin\/associations\/([^/]+)\/members$/);
 if(match&&method==='POST')return invite(env,auth,match[1],data,true);
 if(route==='/me/access-requests'&&method==='GET'){ensure(auth.user,401,'Log ind først.');return accessRequests(env,auth);}
 if(route==='/access-requests'&&method==='POST'){ensure(auth.user,401,'Log ind først.');return requestAccess(env,auth,data);}
 if(route==='/admin/access-requests'&&method==='GET')return accessRequests(env,auth,true);
 match=route.match(/^\/admin\/access-requests\/([^/]+)$/);
 if(match&&method==='POST')return decideAccess(env,auth,match[1],data);
 if(route==='/events'){
  if(method==='GET')return publicEvents(env,url);
  return createEvent(request,env,auth,data);
 }
 match=route.match(/^\/events\/([^/]+)$/);
 if(match&&method==='GET')return publicEvents(env,url,match[1]);
 match=route.match(/^\/private\/([^/]+)$/);
 if(match)return method==='GET'?json(privateData(await author(request,env,match[1]))):guestUpdate(request,env,match[1],data);
 if(route==='/me/events'&&method==='GET'){ensure(auth.user,401,'Log ind først.');return myEvents(env,auth);}
 match=route.match(/^\/member\/events\/([^/]+)$/);
 if(match&&method==='POST')return memberUpdate(env,auth,match[1],data);
 if(route==='/admin/events'&&method==='GET')return adminEvents(env,auth);
 match=route.match(/^\/admin\/events\/([^/]+)$/);
 if(match&&method==='POST')return review(env,auth,match[1],data);
 if(route==='/admin/editions/events'&&method==='GET')return editionCandidates(env,auth,url);
 if(route==='/admin/editions/preview')return previewEdition(env,auth,url,data);
 if(route==='/admin/editions'&&method==='POST')return finalizeEdition(env,auth,data);
 if(route==='/editions'&&method==='GET')return listEditions(env);
 match=route.match(/^\/editions\/([^/]+)\/pdf$/);
 if(match&&method==='GET')return editionPdf(env,match[1]);
 // Operational recovery exposes status only. Encrypted payloads are never sent.
 if(route==='/admin/mail'&&method==='GET'){
  await requireAccess(env,auth);return json({jobs:await all(stmt(env,'SELECT id,state,attempts,created_at,updated_at,event_id FROM mail_jobs ORDER BY created_at DESC LIMIT 100'))});
 }
 if(route==='/admin/mail/retry'&&method==='POST'){await requireAccess(env,auth);await flushMail(env);return json({saved:true});}
 throw new HttpError(404,'Siden findes ikke.');
}
export async function handleApi(request,env){
 try{return await api(request,env);}catch(error){
  if(error instanceof HttpError)return json({error:error.message,...(error.retryAfterSeconds?{retryAfterSeconds:error.retryAfterSeconds}:{})},error.status,error.retryAfterSeconds?{'Retry-After':String(error.retryAfterSeconds)}:{});
  // Never log payloads, addresses, tokens, SQL bind values, or provider errors.
  return json({error:'Der opstod en fejl. Prøv igen, eller kontakt TEB.'},500);
 }
}
