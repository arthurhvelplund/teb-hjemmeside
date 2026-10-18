import pdfLib from 'pdf-lib/dist/pdf-lib.min.js';
import fontkit from '@pdf-lib/fontkit';
import qrcode from 'qrcode-generator';
import { HttpError } from './shared.mjs';
const {PDFDocument,rgb}=pdfLib;
const mm=value=>value*72/25.4;
const width=mm(297),height=mm(420),margin=34,column=150,textWidth=width-column-42;
const hex=value=>rgb(...value.match(/\w\w/g).map(v=>parseInt(v,16)/255));
const colors={ink:hex('163B32'),muted:hex('405B52'),rule:hex('D9E3DD'),mint:hex('BCDCCE'),pink:hex('EACAD8'),mintLight:hex('ECF5F0'),pinkLight:hex('FAF0F4'),white:rgb(1,1,1)};
const monthName=value=>new Intl.DateTimeFormat('da-DK',{month:'long',timeZone:'UTC'}).format(new Date(value+'-01T12:00:00Z')).toUpperCase();
const weekday=value=>new Intl.DateTimeFormat('da-DK',{weekday:'long',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
let assetBytes;
async function assets(env){
 if(!assetBytes)assetBytes=Promise.all(['/fonts/NotoSans-Regular.ttf','/fonts/NotoSans-Bold.ttf','/fonts/Anton-Regular.ttf','/images/teb-trolde.png'].map(async path=>{
  const response=await env.ASSETS.fetch(new Request(env.PUBLIC_ORIGIN+path));
  if(!response.ok)throw new HttpError(503,'Printskrifter eller TEBs logo kunne ikke indlæses.');
  return new Uint8Array(await response.arrayBuffer());
 })).catch(error=>{assetBytes=undefined;throw error;});
 return assetBytes;
}
function wrap(value,font,size,maxWidth){
 const lines=[];let current='';
 for(const word of String(value).split(/\s+/).filter(Boolean)){
  if(font.widthOfTextAtSize(word,size)>maxWidth){
   if(current){lines.push(current);current='';}
   for(const char of word){if(current&&font.widthOfTextAtSize(current+char,size)>maxWidth){lines.push(current);current=char;}else current+=char;}
  }else if(current&&font.widthOfTextAtSize(current+' '+word,size)>maxWidth){lines.push(current);current=word;}
  else current+=(current?' ':'')+word;
 }
 if(current)lines.push(current);return lines;
}
export function printDetails(event){return 'Kl. '+event.time.replace(':','.')+(event.endTime?' til '+event.endTime.replace(':','.'):'')+' · '+event.location;}
export async function makeCalendarPdf(edition,env){
 const document=await PDFDocument.create();document.registerFontkit(fontkit);
 const [regular,bold,display,logoBytes]=await assets(env);
 const font=await document.embedFont(regular,{subset:true}),heavy=await document.embedFont(bold,{subset:true}),headline=await document.embedFont(display,{subset:true}),logo=await document.embedPng(logoBytes);
 const supported=new Set(font.getCharacterSet());
 for(const event of edition.events)for(const value of [event.print?.title||event.title,event.print?.association||event.association,event.print?.details||printDetails(event),event.print?.dateLabel||'',event.print?.dateNote||'']){
  if([...String(value)].some(char=>!supported.has(char.codePointAt(0))))throw new HttpError(422,'Et arrangement indeholder tegn, som printskrifttypen ikke kan vise. Ret teksten før tryk.');
 }
 const start=edition.start||edition.month+'-01',end=edition.end||new Date(Date.UTC(Number(edition.month.slice(0,4)),Number(edition.month.slice(5))+1,0)).toISOString().slice(0,10);
 document.setTitle('Det sker i Tistrup og Hodde · '+start+' - '+end);document.setAuthor('Tistrup Erhvervs- og Borgerforening');
 const qr=qrcode(0,'M');qr.addData(edition.calendarUrl);qr.make();
 let page,y,activeMonth='';
 const box=(x,top,w,h,color)=>page.drawRectangle({x,y:height-top-h,width:w,height:h,color});
 const text=(value,x,top,size=14,type=font,color=colors.ink)=>page.drawText(value,{x,y:height-top-size*.8,size,font:type,color});
 const rule=top=>page.drawLine({start:{x:column,y:height-top},end:{x:width-margin,y:height-top},color:colors.rule,thickness:.6});
 function newPage(){
  page=document.addPage([width,height]);
  text('BYENS FÆLLES KALENDER',35,18,10.5,heavy);text('DET SKER!',30,42,88,headline);text('I TISTRUP OG HODDE',35,125,35,headline);
  page.drawImage(logo,{x:665,y:height-126,width:130,height:104});
  const range=start.slice(0,7)===end.slice(0,7)?monthName(start.slice(0,7)):monthName(start.slice(0,7))+' + '+monthName(end.slice(0,7));
  const year=start.slice(0,4)===end.slice(0,4)?start.slice(0,4):start.slice(0,4)+' / '+end.slice(0,4);
  text(range,635,134,Math.min(11,165/heavy.widthOfTextAtSize(range,1)),heavy);text(year,795-heavy.widthOfTextAtSize(year,15),151,15,heavy);
  box(margin,1045,width-2*margin,117,colors.ink);
  text('Har I noget på programmet?',51,1059,20,heavy,colors.white);text('tistrup.kalender@gmail.com',51,1091,18,heavy,colors.white);
  text('Send senest den 15. i måneden før.',51,1119,12,font,colors.white);text('Tistrup Erhvervs- og Borgerforening',51,1143,11,font,hex('D2E6D9'));
  // Keep a white quiet zone on all sides of the QR code.
  const size=86,count=qr.getModuleCount(),unit=size/(count+8),quiet=4*unit,left=706,top=1055;
  box(702,1052,94,94,colors.white);
  for(let r=0;r<count;r++)for(let c=0;c<count;c++)if(qr.isDark(r,c))box(left+quiet+c*unit,top+quiet+r*unit,unit+.03,unit+.03,colors.ink);
  text('Se kalenderen',705,1149,10,font,colors.white);
  const status=env.LOCAL_PREVIEW==='true'?'PRØVEUDGAVE':edition.draft?'KORREKTUR':'FAST PRINTUDGAVE';
  text(status+' · Indhold godkendt senest '+edition.deadline,35,1176,8.5,font,colors.muted);y=174;
 }
 const monthOffset=month=>(Number(month.slice(0,4))-Number(start.slice(0,4)))*12+Number(month.slice(5))-Number(start.slice(5,7));
 function monthHeader(month,continued=false){
  box(margin,y,width-2*margin,34,monthOffset(month)%2?colors.pink:colors.mint);
  text(monthName(month)+(continued?' · FORTSAT':''),47,y+6,25,headline);text(month.slice(0,4),width-94,y+10,13,heavy);y+=34;activeMonth=month;
 }
 newPage();
 if(!edition.events.length)text('Der er ingen valgte arrangementer i denne periode.',margin,y+25,18);
 for(const event of edition.events){
  const month=event.date.slice(0,7)<start.slice(0,7)?start.slice(0,7):event.date.slice(0,7),print=event.print||{};
  const title=wrap(print.title||event.title,heavy,21.5,textWidth),details=wrap(print.details||printDetails(event),font,13.25,textWidth),association=wrap(print.association||event.association,font,11,textWidth);
  const dateLines=print.dateLabel?wrap(print.dateLabel,heavy,13,78):[],noteLines=print.dateNote?wrap(print.dateNote,font,10.5,78):[];
  const blockHeight=Math.max(56,4+title.length*23+details.length*15+association.length*14,16+dateLines.length*16+noteLines.length*13);
  const needsHeader=month!==activeMonth;
  if(y+blockHeight+(needsHeader?42:0)>1034){newPage();monthHeader(month,!needsHeader);}
  else if(needsHeader){if(activeMonth)y+=8;monthHeader(month);}
  if(y+blockHeight>1034)throw new HttpError(422,'Et arrangement er for langt til printskabelonen. Forkort printteksten.');
  box(margin,y,96,blockHeight,monthOffset(month)%2?colors.pinkLight:colors.mintLight);
  const first=event.date.slice(8),last=event.endDate&&event.endDate!==event.date?event.endDate.slice(8):'';
  if(print.dateLabel){
   dateLines.forEach((value,i)=>text(value,44,y+10+i*16,13,heavy));noteLines.forEach((value,i)=>text(value,44,y+12+dateLines.length*16+i*13,10.5,font,colors.muted));
  }else if(last&&event.date.slice(0,7)!==event.endDate.slice(0,7)){
   text(first+'/'+Number(event.date.slice(5,7)),47,y+5,19,heavy);text('til '+last+'/'+Number(event.endDate.slice(5,7)),47,y+33,13,font);
  }else{
   text(first+(last?'-'+last:''),47,y+5,last?25:30,headline);text(last?'flere dage':weekday(event.date),47,y+38,10.5,font,colors.muted);
  }
  let at=y+4;
  for(const value of title){text(value,column,at,21.5,heavy);at+=23;}
  for(const value of details){text(value,column,at,13.25);at+=15;}
  for(const value of association){text(value,column,at,11,font,colors.muted);at+=14;}
  y+=blockHeight;rule(y);
 }
 const pages=document.getPages();
 for(const [index,p] of pages.entries())p.drawText('Side '+(index+1)+' af '+pages.length,{x:width-100,y:height-1176-8.5*.8,size:8.5,font,color:colors.muted});
 if(edition.format!=='a3')for(const p of pages){const w=mm(500),h=mm(700),scale=Math.min(w/width,h/height);p.scaleContent(scale,scale);p.translateContent((w-width*scale)/2,(h-height*scale)/2);p.setSize(w,h);}
 return {bytes:await document.save(),pages:pages.length};
}
