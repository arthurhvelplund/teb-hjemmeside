import test from 'node:test';
import assert from 'node:assert/strict';
import { database } from '../scripts/sqlite.mjs';
import { handleApi } from '../src/api.mjs';
import { token } from '../src/shared.mjs';
test('password routes enforce origin, JSON and authentication before credential changes',async t=>{
 const DB=database();t.after(()=>DB.close());
 const env={DB,PUBLIC_ORIGIN:'https://teb.example.test',MAIL_ENCRYPTION_KEY:token()};
 const call=(path,origin=env.PUBLIC_ORIGIN,type='application/json')=>handleApi(new Request(env.PUBLIC_ORIGIN+'/api/kalender'+path,{method:'POST',headers:{Origin:origin,'Content-Type':type},body:JSON.stringify({email:'member@example.test',password:'A long password!2026'})}),env);
 for(const path of ['/auth/password/login','/auth/password','/admin/associations/a/members/b/password']){
  assert.equal((await call(path,'https://evil.example')).status,403);
  assert.equal((await call(path,env.PUBLIC_ORIGIN,'text/plain')).status,415);
 }
 assert.equal((await call('/auth/password')).status,401);
 assert.equal((await call('/admin/associations/a/members/b/password')).status,401);
 assert.equal((await call('/auth/password/login')).status,401);
 assert.equal(DB.prepare('SELECT count(*) AS n FROM password_credentials').first().n,0);
});
