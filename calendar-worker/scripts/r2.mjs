import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { createHash } from 'node:crypto';
// The filesystem adapter implements the R2 subset used by the application.
export function localR2(directory){
 const memory=new Map(),root=directory?resolve(directory):null;
 function filename(key){const path=resolve(root,key);if(!path.startsWith(root+sep))throw new Error('Invalid object key');return path;}
 function object(bytes){return {etag:createHash('sha256').update(bytes).digest('hex'),body:new Uint8Array(bytes),arrayBuffer:async()=>new Uint8Array(bytes).buffer};}
 return {
  async get(key){try{const bytes=root?await readFile(filename(key)):memory.get(key);return bytes?object(bytes):null;}catch(error){if(error.code==='ENOENT')return null;throw error;}},
  async put(key,input,options={}){
   const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
   if(root){const path=filename(key);await mkdir(dirname(path),{recursive:true});try{await writeFile(path,bytes,{flag:options.onlyIf?.etagDoesNotMatch==='*'?'wx':'w'});}catch(error){if(error.code==='EEXIST')return null;throw error;}}
   else {if(options.onlyIf?.etagDoesNotMatch==='*'&&memory.has(key))return null;memory.set(key,new Uint8Array(bytes));}
   return object(bytes);
  }
 };
}
