import pdfLib from 'pdf-lib/dist/pdf-lib.min.js';
import fontkit from '@pdf-lib/fontkit';
import qrcode from 'qrcode-generator';
import { HttpError } from './shared.mjs';
const {PDFDocument,rgb}=pdfLib;

const mm = value => value * 72 / 25.4;
const colors = {ink:rgb(.09,.16,.12),mint:rgb(.87,.93,.88),rule:rgb(.77,.82,.76)};
const monthName = value => new Intl.DateTimeFormat('da-DK',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(value+'-01T12:00:00Z'));
let fontBytes;
async function fonts(env) {
  if(!fontBytes)fontBytes=Promise.all(['Regular','Bold'].map(async weight=>{
    const response=await env.ASSETS.fetch(new Request(env.PUBLIC_ORIGIN+'/fonts/NotoSans-'+weight+'.ttf'));
    if(!response.ok)throw new HttpError(503,'Skrifttypen til print kunne ikke indlæses.');
    return new Uint8Array(await response.arrayBuffer());
  })).catch(error=>{fontBytes=undefined;throw error;});
  return fontBytes;
}

function wrap(text,font,size,width) {
  const lines=[];let current='';
  for(const word of text.split(/\s+/).filter(Boolean)) {
    if(font.widthOfTextAtSize(word,size)>width) {
      if(current){lines.push(current);current='';}
      for(const char of word){if(current&&font.widthOfTextAtSize(current+char,size)>width){lines.push(current);current=char;}else current+=char;}
    } else if(current&&font.widthOfTextAtSize(current+' '+word,size)>width){lines.push(current);current=word;}
    else current+=(current?' ':'')+word;
  }
  if(current)lines.push(current);
  return lines;
}

export async function makeCalendarPdf(edition,env) {
  const document=await PDFDocument.create();
  document.registerFontkit(fontkit);
  const [regular,bold]=await fonts(env);
  const font=await document.embedFont(regular,{subset:true}),heavy=await document.embedFont(bold,{subset:true});
  const supported=new Set(font.getCharacterSet());
  for(const event of edition.events)for(const text of [event.title,event.association,event.location]) {
    if([...text].some(char=>!supported.has(char.codePointAt(0))))throw new HttpError(422,'Et arrangement indeholder tegn, som printskrifttypen ikke kan vise. Ret teksten før tryk.');
  }
  document.setTitle('Det sker i Tistrup og Hodde · '+monthName(edition.month));
  document.setAuthor('Tistrup Erhvervs- og Borgerforening');
  const width=mm(500),height=mm(700),margin=mm(24),column=margin+118;
  const textWidth=width-column-margin;
  let page,y,activeMonth='',pageNumber=0;
  const text=(value,x,at,size=22,strong=false)=>page.drawText(value,{x,y:at,size,font:strong?heavy:font,color:colors.ink});
  function newPage(){
    page=document.addPage([width,height]);pageNumber++;
    text('DET SKER!',margin,height-margin-62,62,true);
    text('I TISTRUP OG HODDE',margin,height-margin-112,39,true);
    const first=new Date(edition.month+'-01T12:00:00Z'),second=new Date(first);second.setUTCMonth(second.getUTCMonth()+1);
    const end=second.toISOString().slice(0,7);
    text(monthName(edition.month)+' · '+monthName(end),margin,height-margin-158,24);
    y=height-margin-205;
    const qr=qrcode(0,'M');qr.addData(edition.calendarUrl);qr.make();
    const size=94,unit=size/qr.getModuleCount(),left=width-margin-size,top=margin+145;
    for(let r=0;r<qr.getModuleCount();r++)for(let c=0;c<qr.getModuleCount();c++)if(qr.isDark(r,c))page.drawRectangle({x:left+c*unit,y:top-r*unit,width:unit+.05,height:unit+.05,color:colors.ink});
    page.drawLine({start:{x:margin,y:margin+85},end:{x:width-margin-size-25,y:margin+85},thickness:1,color:colors.rule});
    text('Find aktuelle arrangementer og ændringer i den levende kalender.',margin,margin+54,17);
    const urlLines=wrap(edition.calendarUrl,font,15,width-2*margin-size-30);
    urlLines.slice(0,2).forEach((line,i)=>text(line,margin,margin+27-i*20,15));
    text((env.LOCAL_PREVIEW==='true'?'PRØVEUDGAVE · ':edition.draft?'FORHÅNDSVISNING · ':`Fast printudgave · Frist ${edition.deadline} · `)+'Samlet af TEB',margin,margin-17,15);
  }
  function monthHeader(month,continued=false){
    page.drawRectangle({x:margin,y:y-47,width:width-2*margin,height:62,color:colors.mint});
    text(monthName(month)+(continued?' · fortsat':''),margin+16,y-28,29,true);y-=88;activeMonth=month;
  }
  newPage();
  if(!edition.events.length)text('Der er endnu ingen godkendte arrangementer i denne periode.',margin,y-30,25);
  for(const event of edition.events) {
    const month=event.date.slice(0,7)<edition.month?edition.month:event.date.slice(0,7);
    const titleLines=wrap(event.title,heavy,26,textWidth);
    let dateText=String(Number(event.date.slice(8)))+'.';
    if(event.endDate&&event.endDate!==event.date)dateText=event.endDate.slice(0,7)===event.date.slice(0,7)?dateText+'–'+Number(event.endDate.slice(8))+'.':Number(event.date.slice(8))+'/'+Number(event.date.slice(5,7))+'–'+Number(event.endDate.slice(8))+'/'+Number(event.endDate.slice(5,7));
    const clock='Kl. '+event.time.replace(':','.')+(event.endTime?'–'+event.endTime.replace(':','.'):'');
    const metaLines=wrap(clock+' · '+event.location,font,20,textWidth);
    const associationLines=wrap(event.association,font,18,textWidth);
    const blockHeight=titleLines.length*31+metaLines.length*26+associationLines.length*23+10;
    const needsHeader=activeMonth!==month;
    if(y-blockHeight-(needsHeader?88:0)<margin+155){newPage();monthHeader(month,!needsHeader);}
    else if(needsHeader)monthHeader(month);
    if(y-blockHeight<margin+155)throw new HttpError(422,'Et arrangement er for langt til printskabelonen. Forkort titel eller sted.');
    text(dateText,margin+10,y-25,dateText.length>7?16:dateText.length>5?20:27,true);
    for(const line of titleLines){text(line,column,y-25,26,true);y-=31;}
    for(const line of metaLines){text(line,column,y-21,20);y-=26;}
    for(const line of associationLines){text(line,column,y-19,18);y-=23;}
    y-=10;
    page.drawLine({start:{x:column,y:y+9},end:{x:width-margin,y:y+9},thickness:.6,color:colors.rule});
  }
  for(const [index,p] of document.getPages().entries())p.drawText(`Side ${index+1} af ${pageNumber}`,{x:width-margin-100,y:margin-17,size:14,font,color:colors.ink});
  return {bytes:await document.save(),pages:pageNumber};
}
