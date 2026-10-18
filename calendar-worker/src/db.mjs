import { ensure, hash, now } from './shared.mjs';
export const stmt=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
export const all=async statement=>(await statement.all()).results;
export const local=env=>env.LOCAL_PREVIEW==='true';
export const loopback=url=>['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname);
export async function rate(env,key,limit,minutes=60){
 const stamp=now();
 const row=await stmt(env,`INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET
 count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END,
 expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING count`,key,new Date(Date.now()+minutes*60000).toISOString(),stamp,stamp).first();
 ensure(row.count<=limit,429,'For mange forsøg. Vent lidt, og prøv igen.');
}
export const ipKey=async request=>hash(request.headers.get('CF-Connecting-IP')||'local');
export function emailAddress(input){
 const email=typeof input==='string'?input.trim().toLowerCase():'';
 ensure(email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),400,'Skriv en gyldig e-mailadresse.');
 return email;
}
export function field(input,key,limit,required=false){
 const value=typeof input?.[key]==='string'?input[key].trim():'';
 ensure((!required||value)&&value.length<=limit&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value),400,'Udfyld felterne med gyldig tekst.');
 return value;
}
