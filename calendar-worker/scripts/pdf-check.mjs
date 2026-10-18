import { makeCalendarPdf } from '../src/pdf.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import pdfLib from 'pdf-lib/dist/pdf-lib.min.js';
const output=new URL('../.wrangler/pdf-check/',import.meta.url);await mkdir(output,{recursive:true});
const env={LOCAL_PREVIEW:'true',PUBLIC_ORIGIN:'http://localhost:8787',ASSETS:{async fetch(request){return new Response(await readFile(new URL('../assets'+new URL(request.url).pathname,import.meta.url)));}}};
const events=Array.from({length:45},(_,i)=>({id:String(i),title:'Arrangement '+String(i+1).padStart(3,'0')+' - Fællessang og æblekage med naboerne',association:'Den opdigtede Eksempelforening',date:'2026-'+(i<23?'11':'12')+'-'+String(i%23+1).padStart(2,'0'),time:'18:30',endTime:'21:00',location:'Eksempelhuset, Sal A, Eksempelvej 12',state:'approved'}));
for(const format of ['poster','a3']){
 const pdf=await makeCalendarPdf({month:'2026-11',start:'2026-11-01',end:'2026-12-31',deadline:'2026-10-18',format,calendarUrl:'https://teb.example.test/kalender.html',events},env);
 const path=new URL('kalender-'+format+'.pdf',output).pathname;await writeFile(path,pdf.bytes);
 const extracted=execFileSync('pdftotext',[path,'-'],{encoding:'utf8'}).replace(/\s+/g,' ');
 for(let i=1;i<=45;i++)assert.ok(extracted.includes('Arrangement '+String(i).padStart(3,'0')),'Missing event '+i);
 assert.ok(pdf.pages>=3);
 execFileSync('pdftoppm',['-scale-to','1200','-png',path,new URL(format,output).pathname]);
 console.log(`${format}: ${pdf.pages} pages; all 45 event titles extracted; PDF and page images in .wrangler/pdf-check/.`);
 const compact=Array.from({length:14},(_,i)=>({id:String(i),title:'Prøvearrangement '+(i+1),association:'Eksempelforeningen',date:'2026-'+(i<8?'11':'12')+'-'+String(i%8+2).padStart(2,'0'),time:'18:00',location:'Eksempelhuset',state:'approved',...(i===0?{print:{dateLabel:'HVER UGE',dateNote:'ons + søn',details:'Onsdage kl. 13.00 · Søndage kl. 9.00'}}:{})}));
 const single=await makeCalendarPdf({month:'2026-11',start:'2026-11-01',end:'2026-12-31',deadline:'2026-10-18',format,calendarUrl:'https://www.teb-tistrup.dk/kalender.html',events:compact},env);
 assert.equal(single.pages,1,'14 compact events should fit on one page');
 const doc=await pdfLib.PDFDocument.load(single.bytes),size=doc.getPage(0).getSize(),expected=format==='a3'?[297,420]:[500,700];
 assert.ok(Math.abs(size.width-expected[0]*72/25.4)<.01);assert.ok(Math.abs(size.height-expected[1]*72/25.4)<.01);
 const singlePath=new URL('kalender-kompakt-'+format+'.pdf',output).pathname;await writeFile(singlePath,single.bytes);
 const singleText=execFileSync('pdftotext',[singlePath,'-'],{encoding:'utf8'});assert.ok(singleText.includes('HVER UGE'));
 for(let i=1;i<=14;i++)assert.ok(singleText.includes('Prøvearrangement '+i));
 execFileSync('pdftoppm',['-scale-to','1500','-singlefile','-png',singlePath,new URL('kompakt-'+format,output).pathname]);
}
