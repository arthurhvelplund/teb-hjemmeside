from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,PageBreak,KeepTogether
from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4
from pathlib import Path
root=Path(__file__).resolve().parent.parent
pdfmetrics.registerFont(TTFont('Noto',str(root/'site/fonts/NotoSans-Regular.ttf')))
pdfmetrics.registerFont(TTFont('NotoB',str(root/'site/fonts/NotoSans-Bold.ttf')))
pdfmetrics.registerFontFamily('Noto',normal='Noto',bold='NotoB')
green=colors.HexColor('#174D3A'); pale=colors.HexColor('#EAF2EC'); ink=colors.HexColor('#23382D'); muted=colors.HexColor('#52675C')
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='TitleTEB',fontName='NotoB',fontSize=26,leading=31,textColor=green,spaceAfter=10))
styles.add(ParagraphStyle(name='SubTEB',fontName='Noto',fontSize=11,leading=16,textColor=muted,spaceAfter=16))
styles.add(ParagraphStyle(name='HeadTEB',fontName='NotoB',fontSize=13,leading=18,textColor=green,spaceBefore=15,spaceAfter=6))
styles.add(ParagraphStyle(name='BodyTEB',fontName='Noto',fontSize=10,leading=15,textColor=ink,spaceAfter=7))
styles.add(ParagraphStyle(name='SmallTEB',fontName='Noto',fontSize=9,leading=13,textColor=muted,spaceAfter=5))
P=lambda text,style='BodyTEB':Paragraph(text,styles[style])
flow=[]
def title(kicker,title,sub):
 flow.extend([P(kicker,'SmallTEB'),P(title,'TitleTEB'),P(sub,'SubTEB')])
def heading(text):flow.append(P(text,'HeadTEB'))
def step(n,title,text):flow.append(KeepTogether([P(f'{n}. {title}','HeadTEB'),P(text)]))
def box(text):
 t=Table([[P(text)]],colWidths=[491]);t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),pale),('BOX',(0,0),(-1,-1),.5,colors.HexColor('#C9DACD')),('LEFTPADDING',(0,0),(-1,-1),12),('RIGHTPADDING',(0,0),(-1,-1),12),('TOPPADDING',(0,0),(-1,-1),10),('BOTTOMPADDING',(0,0),(-1,-1),5)]));flow.append(t)
base='https://teb-tistrup.dk/forening.html'
title('TEB  /  ADMINISTRATION  /  24. OKTOBER 2026','Opret en forening\nog giv adgang','Brugermanual til Tistrup Erhvervs- og Borgerforening. Gem denne vejledning, når nye foreninger og kontaktpersoner skal med.')
box('<b>To forskellige ting:</b> Foreningens profil er offentlig. Personens loginmail er en særskilt adgang. En mail under <b>Offentlig kontaktmail</b> giver ikke automatisk login.')
step(1,'Åbn TEBs administration',f'Åbn <link href="{base}#teb?fane=foreninger" color="#174D3A"><u>TEBs foreningsadministration</u></link>. Hvis du ikke er logget ind, bruger du din godkendte administratormail og koden fra din mail. Du kan også vælge <b>TEBs administration</b> nederst på Min forening og derefter fanen <b>Foreninger</b>. Kun TEB-administratorer kan bruge siden.')
step(2,'Find foreningen først','Se, om foreningen allerede findes. Vælg <b>Profil og personer med adgang</b>, hvis den er oprettet. Så undgår du dubletter. Mangler den, klik på <b>Opret forening</b>, skriv navnet og gerne beskrivelse og kontaktoplysninger. Klik <b>Opret forening</b>. Kun navnet er obligatorisk.')
step(3,'Giv den første person adgang','På foreningens side: rul til <b>Personer med adgang</b>, åbn <b>+ Invitér en person</b>, og skriv personens navn og den præcise e-mailadresse, personen vil bruge til login. Markér, at du har kontrolleret tilknytningen. Klik <b>Send invitation</b>, og bekræft adressen.')
step(4,'Kontrollér resultatet','Personen skal stå under <b>Personer med adgang</b> som <b>Inviteret - afventer første login</b> eller <b>Adgang aktiv</b>. Læs også beskeden om mailafsendelse. Invitationen gælder i syv dage. Er den udløbet, inviteres samme mailadresse igen. En aktiv adgang udløber ikke efter syv dage.')
heading('Når flere personer skal med')
flow.append(P('Gentag trin 3 på den eksisterende forening. Foreningen kan også selv invitere via <b>Min forening → Personer med adgang</b>. Alle med adgang kan oprette arrangementer, rette profilen og invitere andre. Ved en forkert mail: tilføj den korrekte først og fjern derefter den forkerte med <b>Fjern</b>.'))
flow.append(PageBreak())
title('TEB  /  LOGIN OG HJÆLP','Sådan logger\nforeningen ind','En engangskode i mailen. Ingen fast adgangskode og ingen ny offentlig profil.')
for n,h,b in [
 (1,'Åbn login',f'Gå til <link href="{base}#login" color="#174D3A"><u>teb-tistrup.dk/forening.html#login</u></link>, eller vælg <b>Foreninger og institutioner</b> og derefter <b>Log ind</b>.'),
 (2,'Brug den tilknyttede mail','Skriv præcis den mailadresse, der står under <b>Personer med adgang</b>, og klik <b>Send kode</b>. Siden viser, om adressen har adgang. Mangler tilknytningen, skal personen rette adressen, kontakte TEB eller bekræfte mailen og bede om adgang.'),
 (3,'Hent de seks cifre','Behold loginsiden åben. Åbn mailen fra <b>kalender@teb-tistrup.dk</b> med emnet <b>Din engangskode til TEB</b>. Tjek spam/uønsket post og eventuelt fanen <b>Andet</b>. Koden gælder i ti minutter og kan bruges én gang.'),
 (4,'Log ind','Skriv de seks cifre på loginsiden og klik <b>Log ind</b>. Personen kommer til <b>Min forening</b>. Har personen adgang til flere foreninger, vælges den rigtige. Første login aktiverer en gyldig invitation.')]:step(n,h,b)
heading('Hvis noget driller')
rows=[['Det oplever personen','Det gør I'],
 ['Ingen kode i mailen','Kontrollér den viste e-mail. Søg på afsenderen, og tjek spam/Andet. Vent, til nedtællingen er slut. Bed derefter om en ny kode.'],
 ['Ny kode-knappen er grå','Vent 60 sekunder mellem koder. Ved mange forsøg kan ventetiden være længere; knappen viser den resterende tid.'],
 ['Koden er forkert eller udløbet','Brug den nyeste kode. Hver ny kode erstatter den gamle. Efter fem forkerte forsøg skal der bestilles en ny kode.'],
 ['Mailen er ikke tilknyttet','TEB åbner den eksisterende forening og kontrollerer Personer med adgang. Offentlig kontaktmail er ikke det samme som loginmail.'],
 ['Koden kunne ikke sendes','Prøv igen, når knappen er klar. Kontakt TEB, hvis fejlen fortsætter. En kode, der ikke er bekræftet sendt, vises ikke som sendt.']]
table=Table([[P(c,'SmallTEB') for c in row] for row in rows],colWidths=[151,340],hAlign='LEFT')
table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),pale),('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,-1),.4,colors.HexColor('#D8E3DA')),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),4)]));flow.append(table)
flow.append(Spacer(1,11));flow.append(P('<b>Ved en supportsag:</b> Få den præcise loginmail, foreningens navn, tidspunktet for forsøget og teksten på skærmen. Bed aldrig om personens kode. "Sendt" bekræfter afsendelsen; selv aflevering til mailserveren kan ikke garantere placering i indbakken.','SmallTEB'))
def footer(c,doc):
 c.setStrokeColor(colors.HexColor('#C9DACD'));c.line(52,43,A4[0]-52,43);c.setFont('Noto',8);c.setFillColor(muted);c.drawString(52,29,'Tistrup Erhvervs- og Borgerforening  ·  teb-tistrup.dk');c.drawRightString(A4[0]-52,29,f'{doc.page} / 2')
out=root/'site/downloads/teb-admin-brugermanual.pdf'
(root/'output/pdf').mkdir(parents=True,exist_ok=True)
SimpleDocTemplate(str(out),pagesize=A4,rightMargin=52,leftMargin=52,topMargin=43,bottomMargin=56,title='TEB - Opret foreninger og giv adgang',author='Tistrup Erhvervs- og Borgerforening').build(flow,onFirstPage=footer,onLaterPages=footer)
import shutil
shutil.copyfile(out,root/'output/pdf/TEB_brugermanual_foreninger.pdf')
print(out)
