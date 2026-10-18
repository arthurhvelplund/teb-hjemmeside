// Fælles API-klient. Serveren afgør identitet, adgang og offentliggørelse.
export class ApiError extends Error { constructor(message,status){super(message);this.status=status;} }
export async function api(path,{body,token,method,signal,...options}={}) {
  const response=await fetch('/api/kalender'+path,{credentials:'same-origin',signal:signal||AbortSignal.timeout(25000),...options,
    method:method||(body!==undefined?'POST':'GET'),headers:{Accept:'application/json',...(body!==undefined?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},
    ...(body!==undefined?{body:JSON.stringify(body)}:{})});
  let result;
  try { result=await response.json(); }
  catch { throw new ApiError('Svaret fra serveren kunne ikke læses. Prøv igen. Oplysningerne kan allerede være gemt.',response.ok?502:response.status); }
  if(!result||typeof result!=='object'||Array.isArray(result))throw new ApiError('Svaret fra serveren kunne ikke læses. Prøv igen. Oplysningerne kan allerede være gemt.',response.ok?502:response.status);
  if(!response.ok)throw new ApiError(result.error||'Der opstod en fejl.',response.status);
  return result;
}
export const getSession=()=>api('/session');
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
export const requestKey=()=>crypto.randomUUID();
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Copenhagen',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const dateText=(date,options={})=>new Intl.DateTimeFormat('da-DK',{day:'numeric',month:'long',year:'numeric',...options}).format(new Date(date+'T12:00:00'));
export function showMessage(node,message,error=false){if(!node)return;node.replaceChildren();const p=document.createElement('p');p.className='fp-notice'+(error?' is-error':'');p.setAttribute('role',error?'alert':'status');p.textContent=message;node.append(p);}
export async function showMode(){try{const config=await api('/config');if(config.mode==='local'&&!document.querySelector('.fp-local-banner')){const p=document.createElement('p');p.className='fp-local-banner';p.append('Lokal afprøvning. Ingen mails sendes. ');const a=document.createElement('a');a.href='kalender-postkasse.html';a.textContent='Åbn testpostkassen';p.append(a);document.querySelector('header')?.after(p);}return config;}catch{return {mode:'offline',submissionsEnabled:false};}}
export async function busy(button,task){const disabled=button?.disabled;if(button)button.disabled=true;try{return await task();}finally{if(button?.isConnected)button.disabled=disabled;}}
