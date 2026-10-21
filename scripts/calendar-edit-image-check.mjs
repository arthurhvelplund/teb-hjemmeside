// Exercise the real calendar edit form without a browser, mail or production data.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../calendar-worker/package.json',import.meta.url));
const {parseDocument}=require('htmlparser2');
class Element {
 constructor(tag,attrs={},children=[]){this.tag=tag;this.attrs=attrs;Object.assign(this,attrs);this.children=[];this.listeners={};this.value=attrs.value||'';this.disabled=false;this.hidden=attrs.hidden||false;this.classList={add:()=>{}};this.append(...children);}
 append(...children){this.children.push(...children.flat(Infinity).filter(x=>x!=null));}
 prepend(...children){this.children.unshift(...children);}
 replaceChildren(...children){this.children=[];this.append(...children);}
 addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);}
 async emit(type,event={}){for(const fn of this.listeners[type]||[])await fn({target:this,preventDefault(){},...event});}
 set innerHTML(html){const convert=n=>n.type==='text'?n.data:new Element(n.name,n.attribs||{},(n.children||[]).map(convert));this.children=parseDocument(html).children.map(convert);}
 matches(selector){const attr=selector.match(/\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]/);const tag=selector.match(/^[a-z]+/);const cls=selector.match(/\.([\w-]+)/);return (!tag||this.tag===tag[0])&&(!attr||(attr[2]===undefined?attr[1] in this.attrs:String(this.attrs[attr[1]])===attr[2]))&&(!cls||(this.class||'').split(' ').includes(cls[1]));}
 querySelectorAll(selector){const found=[];for(const c of this.children){if(c instanceof Element){if(selector.split(',').some(s=>c.matches(s.trim())))found.push(c);found.push(...c.querySelectorAll(selector));}}return found;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 get elements(){return Object.fromEntries(this.querySelectorAll('input,textarea,select,button').filter(n=>n.name).map(n=>[n.name,n]));}
 reportValidity(){return true;}
 setAttribute(name,value){this.attrs[name]=value;this[name]=value;}
 remove(){this.removed=true;}
}
const node=(tag,attrs={},...children)=>new Element(tag,attrs,children);
const source=await readFile(new URL('../site/js/kalender.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('\nconst fields = ['),source.indexOf('\nasync function createEvent()'))+'\nglobalThis.makeForm=eventForm;';
const path='/api/kalender/event-images/11111111-1111-4111-8111-111111111111.webp';
function setup(data={},options={}){
 const saved=[],uploads=[];let calls=0;
 const context={node,button:(text,fn)=>{const b=node('button',{type:'button'},text);b.addEventListener('click',fn);return b;},note:text=>node('p',{},text),printRequestHTML:()=>'<input name="printRequested" type="checkbox">',today:()=> '2026-10-21',requestKey:()=> 'key',randomToken:()=> 'token',safeURL:()=>true,eventCard:event=>node('article',{},event.title),showMessage:(box,text)=>box.textContent=text,readableError:e=>e.message,prepareImage:async file=>{if(file.type!=='image/png')throw Error('Vælg et JPG-, PNG- eller WebP-billede.');return new Blob(['test'],{type:'image/webp'});},FileReader:class{readAsDataURL(){this.result='data:image/webp;base64,dGVzdA==';this.onload();}},Blob,Date,URL,console,fetch:async(url,request)=>{
   uploads.push({url,request});
   assert.equal(request.method,'POST');assert.equal(request.credentials,'same-origin');
   assert.equal(request.headers['Content-Type'],'image/webp');assert.ok(request.body.size>0);
   if(options.uploadFailure)return {ok:false,status:413,json:async()=>({error:'Billedet er for stort'})};
   return {ok:true,status:201,json:async()=>({imageUrl:path})};
  },AbortSignal};
 vm.createContext(context);vm.runInContext(code,context);
 const root=context.makeForm({data:{title:'Eksisterende møde',association:'TEB',date:'2026-10-22',time:'19:30',location:'Hallen',...data},onSave:async value=>{calls++;if(options.retry&&calls===1)throw Error('Forbindelsen blev afbrudt');saved.push(JSON.parse(JSON.stringify(value)));}});
 const form=root.querySelector('form');return {root,form,saved,uploads};
}
{
 const f=setup();const picker=f.form.querySelector('input[type="file"]');assert.ok(picker,'Ret arrangement skal have et felt til at vælge et billede');
 picker.files=[{type:'image/png',size:4}];await picker.emit('change');await f.form.emit('submit');assert.equal(f.uploads.length,1);assert.equal(f.uploads[0].url,'/api/kalender/event-images');assert.equal(f.saved[0].event.imageUrl,path);assert.equal(f.saved[0].event.title,'Eksisterende møde');console.log('OK: existing event without image accepts and saves a selected image');
}
{
 const f=setup({imageUrl:path});await f.form.emit('submit');assert.equal(f.uploads.length,0);assert.equal(f.saved[0].event.imageUrl,path);const remove=f.form.querySelector('[data-remove-event-image]');assert.ok(remove,'Existing image can be removed');await remove.emit('click');await f.form.emit('submit');assert.equal(f.saved[1].event.imageUrl,'');console.log('OK: preserve an existing image, or explicitly remove it');
}
{
 const f=setup({}, {retry:true});const picker=f.form.querySelector('input[type="file"]');picker.files=[{type:'image/png'}];await picker.emit('change');await f.form.emit('submit');await f.form.emit('submit');assert.equal(f.uploads.length,1);assert.equal(f.saved[0].event.imageUrl,path);console.log('OK: retry reuses the uploaded image and the same edit payload');
}
{
 const f=setup({imageUrl:path});const picker=f.form.querySelector('input[type="file"]');picker.files=[{type:'text/plain'}];await picker.emit('change');await f.form.emit('submit');assert.equal(f.uploads.length,0);assert.equal(f.saved[0].event.imageUrl,path);console.log('OK: invalid image selection keeps the existing image');
}

{
 const f=setup({}, {uploadFailure:true});const picker=f.form.querySelector('input[type="file"]');picker.files=[{type:'image/png'}];await picker.emit('change');await f.form.emit('submit');assert.equal(f.saved.length,0);assert.equal(picker.disabled,false);assert.equal(f.form.querySelector('button[type="submit"]').disabled,false);console.log('OK: rejected upload never saves an edit without the selected image');
}
