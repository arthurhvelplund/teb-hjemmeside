// Exercise the actual local setup twice against a fresh, disposable database.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';

const socket=createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');
const port=socket.address().port;await new Promise(done=>socket.close(done));
const runtime=await mkdtemp(join(tmpdir(),'teb-pilot-')),origin='http://localhost:'+port;
const catalog=JSON.parse(await readFile(new URL('../../site/data/foreninger-udkast.json',import.meta.url),'utf8'));
const cwd=new URL('../',import.meta.url),env={...process.env,PORT:String(port),CALENDAR_DATA_DIR:runtime,CALENDAR_ORIGIN:origin};
const server=spawn(process.execPath,['scripts/dev.mjs'],{cwd,env,stdio:['ignore','ignore','pipe']});
let error='';server.stderr.on('data',x=>error+=x);
try{
 const deadline=Date.now()+45000;
 for(;;){
  if(server.exitCode!==null||Date.now()>deadline)throw Error('Pilot server did not start: '+error.slice(-500));
  try{if((await fetch(origin+'/api/kalender/config',{signal:AbortSignal.timeout(1000)})).ok)break;}catch{}
  await new Promise(done=>setTimeout(done,100));
 }
 for(let i=0;i<2;i++){
  if(i){const db=new DatabaseSync(join(runtime,'calendar.sqlite'));try{db.prepare("UPDATE rate_limits SET expires_at='2000-01-01' WHERE key LIKE 'otp-cooldown:%'").run();}finally{db.close();}}
  const child=spawn(process.execPath,['scripts/seed-pilot.mjs'],{cwd,env,stdio:['ignore','ignore','pipe']});
  let detail='';child.stderr.on('data',x=>detail+=x);const[code]=await once(child,'exit');assert.equal(code,0,detail);
  const db=new DatabaseSync(join(runtime,'calendar.sqlite'),{readOnly:true});
  try{
   assert.equal(db.prepare('SELECT COUNT(*) AS n FROM associations').get().n,catalog.associations.length+1);
   assert.equal(db.prepare('SELECT COUNT(*) AS n FROM memberships').get().n,2);
   assert.equal(db.prepare('SELECT COUNT(*) AS n FROM invitations').get().n,2);
   for(const table of ['events','posts','editions'])assert.equal(db.prepare('SELECT COUNT(*) AS n FROM '+table).get().n,0);
  }finally{db.close();}
 }
 console.log(`Pilot setup passed twice: ${catalog.associations.length} directory drafts, one practice association, two practice memberships, no duplicates and no fictional public events.`);
}finally{
 if(server.exitCode===null){const exited=once(server,'exit');server.kill('SIGTERM');const force=setTimeout(()=>server.kill('SIGKILL'),5000);await exited;clearTimeout(force);}
 await rm(runtime,{recursive:true,force:true});
}
