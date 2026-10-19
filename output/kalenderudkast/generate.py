"""Three print concepts using the historical September/October poster content.

Run from the repository root: uv run --with reportlab --with pillow python output/kalenderudkast/generate.py
These are independent design drafts, not a replacement for the calendar service.
"""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF
import json

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output/pdf'
OUT.mkdir(exist_ok=True, parents=True)
FONT = ROOT / 'calendar-worker/assets/fonts'
for name, path in [('Sans', FONT/'NotoSans-Regular.ttf'), ('Bold', FONT/'NotoSans-Bold.ttf'),
                   ('Display', Path('/System/Library/Fonts/Supplemental/Impact.ttf')),
                   ('Serif', Path('/System/Library/Fonts/Supplemental/Georgia.ttf'))]:
    pdfmetrics.registerFont(TTFont(name, str(path)))

# Editorial shortening only. Missing times and places remain missing.
EVENTS = [
 dict(month=9, day='02', title='Kroket og krolf', meta='Onsdage kl. 13.00 · Søndage kl. 9.00', org='Hele september · Kom og spil!', date='2/9'),
 dict(month=9, day='02', title='Bowling, opstart', meta='Kl. 9.00 · Sportium, Varde', org='Tistrup Plejecenters Venner', date='2/9'),
 dict(month=9, day='03', title='Banko', meta='Kl. 14.30', org='Tistrup Plejecenters Venner', date='3/9'),
 dict(month=9, day='11', title='Hodde griller sammen', meta='Ved forsamlingshuset · Tid på Facebook @hoddeby', org='Hodde Sogneforening', date='11/9'),
 dict(month=9, day='17', title='Citrondrengen', meta='Kl. 14.30 · Sang og musik', org='Tistrup Plejecenters Venner', date='17/9'),
 dict(month=9, day='18-19', title='UV-håndbold', meta='Hodde-Tistrup Hallen · For børn i Varde Kommune', org='Tistrup Hodde Håndbold', date='18-19/9'),
 dict(month=9, day='23', title='Virksomhedsbesøg', meta='Kl. 19.00 · Brink System, Mots More og LPA Byg', org='Tistrup FTF', date='23/9'),
 dict(month=9, day='25', title='Modeshow', meta='Kl. 17.30 · Sammen med Salili, Henne Strand', org='Hodde-Tistrup Hallen', date='25/9'),
 dict(month=10, day='01', title='Banko', meta='Kl. 14.30', org='Tistrup Plejecenters Venner', date='1/10'),
 dict(month=10, day='05', title='Klubdag', meta='Kl. 14.00 · Hallens mødelokale', org='OK Klubben', date='5/10'),
 dict(month=10, day='12', title='Klubdag med Søren Abel', meta='Kl. 14.00 · Hallens mødelokale', org='OK Klubben', date='12/10'),
 dict(month=10, day='15', title='Harmonikapigerne Viberne', meta='Kl. 14.30 · Underholdning', org='Tistrup Plejecenters Venner', date='15/10'),
 dict(month=10, day='19', title='Banko og lotteri', meta='Kl. 14.00 · Hallens mødelokale', org='OK Klubben · Klubdag', date='19/10'),
 dict(month=10, day='26', title='Jyske dialekter', meta='Kl. 14.00 · Hallens mødelokale', org='OK Klubben · Peter Høgsberg', date='26/10'),
]
(ROOT/'output/kalenderudkast/events.json').write_text(json.dumps(EVENTS, ensure_ascii=False, indent=2))

W,H=841.8898,1190.5512  # A3, mm 297 x 420
INK='#142F2A'; MUTED='#435951'; CREAM='#F8F6EE'; MINT='#C7E5D6'; PINK='#F0D5E1'; BLUE='#CDE6F2'

def rect(c,x,y,w,h,color):
    c.setFillColor(HexColor(color)); c.rect(x,H-y-h,w,h,stroke=0,fill=1)

def text(c,s,x,y,size=14,font='Sans',color=INK):
    c.setFillColor(HexColor(color)); c.setFont(font,size); c.drawString(x,H-y-size*.8,s)

def line(c,x,y,w,color='#C9D2CB',thick=.7):
    c.setStrokeColor(HexColor(color)); c.setLineWidth(thick); c.line(x,H-y,x+w,H-y)

def fit(c,s,x,y,maxwidth,size,font='Bold',color=INK):
    while pdfmetrics.stringWidth(s,font,size)>maxwidth: size-=.25
    text(c,s,x,y,size,font,color)

def wrap(s,width,size,font='Sans'):
    lines=[]; current=''
    for word in s.split():
        attempt=(current+' '+word).strip()
        if current and pdfmetrics.stringWidth(attempt,font,size)>width:
            lines.append(current); current=word
        else: current=attempt
    if current: lines.append(current)
    return lines

def qrcode(c,x,y,size):
    # Points to the existing public homepage, not a localhost or unlaunched route.
    widget=qr.QrCodeWidget('https://www.teb-tistrup.dk/')
    a,b,u,v=widget.getBounds(); drawing=Drawing(size,size,transform=[size/(u-a),0,0,size/(v-b),0,0]); drawing.add(widget)
    renderPDF.draw(drawing,c,x,H-y-size)

def footer(c,dark=False):
    color='#FFFFFF' if dark else INK
    if dark: rect(c,0,1064,W,H-1064,INK)
    else: line(c,34,1064,W-68,INK,1)
    text(c,'Har I noget til næste kalender?',36,1082,19,'Bold',color)
    text(c,'Send til tistrup.kalender@gmail.com',36,1112,14,'Sans',color)
    text(c,'Senest den 15. i måneden før · Samlet af TEB',36,1135,12,'Sans',color)
    text(c,'DESIGNUDKAST · Historisk indhold fra september og oktober 2026',36,1166,8,'Sans',color)
    rect(c,W-123,1080,88,88,'#FFFFFF'); qrcode(c,W-120,1083,82)
    text(c,'teb-tistrup.dk',W-123,1171,9,'Sans',color)

def new(name):
    c=canvas.Canvas(str(OUT/name),pagesize=(W,H)); c.setTitle('Tistrup og Hodde · Kalenderudkast · '+name); c.setAuthor('Tistrup Erhvervs- og Borgerforening'); return c

def classic():
    c=new('01-farver-og-faellesskab.pdf')
    rect(c,0,0,W,H,'#FFFFFF')
    text(c,'DET SKER!',34,24,90,'Display')
    text(c,'I TISTRUP OG HODDE',37,126,40,'Display')
    rect(c,650,40,157,43,MINT); text(c,'SEP + OKT 2026',663,55,15,'Bold')
    text(c,'Byens fælles kalender',652,98,11)
    y=202
    for month,color,label in [(9,MINT,'SEPTEMBER'),(10,PINK,'OKTOBER')]:
        events=[e for e in EVENTS if e['month']==month]; block=42+len(events)*53
        rect(c,24,y,W-48,block,color)
        text(c,label,38,y+12,27,'Display'); text(c,'2026',W-103,y+14,18,'Bold')
        y+=42
        for i,e in enumerate(events):
            if i%2==0: rect(c,24,y,W-48,53,'#EFF6F1' if month==9 else '#FAF0F4')
            fit(c,e['day'],39,y+10,75,29,'Display')
            text(c,e['title'],133,y+5,20,'Bold')
            text(c,e['meta'],133,y+28,12.5)
            # Association is a separate column so a quick scan stays easy.
            fit(c,e['org'],133,y+43,W-184,9.5,'Sans',MUTED)
            y+=53
        y+=13
    footer(c,True); c.showPage(); c.save()

def editorial():
    c=new('02-det-sker-i-byen.pdf'); rect(c,0,0,W,H,CREAM)
    text(c,'TISTRUP + HODDE',38,29,15,'Bold')
    text(c,'SEPTEMBER / OKTOBER 2026',490,31,13,'Sans')
    line(c,38,62,W-76,INK,1)
    text(c,'Det sker',30,75,112,'Serif')
    text(c,'lige her.',30,184,112,'Serif')
    rect(c,596,191,207,73,MINT)
    text(c,'14 arrangementer',612,207,17,'Bold'); text(c,'To måneder. Én kalender.',612,236,11)
    # Shared date/title hierarchy, editorial whitespace, restrained month colors.
    y=324
    for month,label,accent in [(9,'SEPTEMBER',INK),(10,'OKTOBER','#764953')]:
        text(c,label,38,y,17,'Bold',accent); line(c,206,y+10,W-244,accent,1); y+=34
        for e in [e for e in EVENTS if e['month']==month]:
            fit(c,e['day'],38,y+3,75,24,'Bold',accent)
            text(c,e['title'],139,y,19,'Bold')
            # Single compact information line; the title remains the largest text.
            fit(c,e['meta']+' · '+e['org'],139,y+25,W-180,11,'Sans',MUTED)
            line(c,139,y+43,W-177,'#DBDED3',.6); y+=45
        y+=17
    footer(c); c.showPage(); c.save()

def columns():
    c=new('03-to-maaneder-to-spalter.pdf'); rect(c,0,0,W,H,'#FFFFFF')
    rect(c,0,0,W,256,INK)
    text(c,'DIN BY. DIN KALENDER.',35,27,15,'Bold','#D7ECD9')
    text(c,'KOM MED!',30,67,101,'Display','#FFFFFF')
    text(c,'Tistrup og Hodde · September og oktober 2026',36,188,20,'Sans','#FFFFFF')
    x_positions=[34,437]; colwidth=370
    for x,month,label,color in [(x_positions[0],9,'SEPTEMBER',MINT),(x_positions[1],10,'OKTOBER',BLUE)]:
        rect(c,x,281,colwidth,53,color); text(c,label,x+14,291,30,'Display')
        y=358
        for e in [e for e in EVENTS if e['month']==month]:
            # Make room for the two-day event without shrinking the event title.
            text(c,e['day'],x,y,18 if len(e['day'])>2 else 26,'Bold')
            titlelines=wrap(e['title'],colwidth-81,19,'Bold')
            for j,s in enumerate(titlelines): text(c,s,x+81,y+j*23,19,'Bold')
            yy=y+len(titlelines)*23+3
            for s in wrap(e['meta'],colwidth-81,11.2): text(c,s,x+81,yy,11.2); yy+=15
            for s in wrap(e['org'],colwidth-81,10.2): text(c,s,x+81,yy,10.2,'Sans',MUTED); yy+=14
            line(c,x+81,yy+7,colwidth-81,'#CFD9D4'); y=max(y+80,yy+22)
        if month==10:
            rect(c,x,922,colwidth,97,'#F0F5F0')
            text(c,'Vi ses i byen.',x+18,941,25,'Serif')
            text(c,'Plads til både gamle og nye bekendtskaber.',x+18,981,11)
    footer(c); c.showPage(); c.save()

classic(); editorial(); columns()
print('Created 3 single-page A3 design drafts in output/pdf/')
