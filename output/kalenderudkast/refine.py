"""Refine the selected colour concept; preserve all previous proposals.

uv run --with reportlab --with pillow python output/kalenderudkast/refine.py
"""
from pathlib import Path
from datetime import date
import json
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
EVENTS = json.loads((HERE/'events.json').read_text())
FONT = ROOT/'calendar-worker/assets/fonts'
for name,path in [('Sans',FONT/'NotoSans-Regular.ttf'),('Bold',FONT/'NotoSans-Bold.ttf'),
                  ('Display',Path('/System/Library/Fonts/Supplemental/Impact.ttf'))]:
    pdfmetrics.registerFont(TTFont(name,str(path)))
W,H=841.8898,1190.5512
INK='#163B32'; MUTED='#405B52'; MINT='#BCDCCE'; PINK='#EACAD8'
WEEKDAYS=['mandag','tirsdag','onsdag','torsdag','fredag','lørdag','søndag']

def rect(c,x,y,w,h,color):
    c.setFillColor(HexColor(color));c.rect(x,H-y-h,w,h,stroke=0,fill=1)

def text(c,value,x,y,size=14,font='Sans',color=INK):
    c.setFillColor(HexColor(color));c.setFont(font,size);c.drawString(x,H-y-size*.8,value)

def rule(c,x,y,w,color='#D9E3DD',thickness=.6):
    c.setStrokeColor(HexColor(color));c.setLineWidth(thickness);c.line(x,H-y,x+w,H-y)

def checked_text(c,value,x,y,width,size=14,font='Sans',color=INK):
    # Never shrink text to force it onto the poster. Overflow requires editing.
    assert pdfmetrics.stringWidth(value,font,size)<=width,(value,width,size)
    text(c,value,x,y,size,font,color)

def draw_qr(c,x,y,size):
    code=qr.QrCodeWidget('https://www.teb-tistrup.dk/')
    x0,y0,x1,y1=code.getBounds()
    d=Drawing(size,size,transform=[size/(x1-x0),0,0,size/(y1-y0),0,0]);d.add(code)
    renderPDF.draw(d,c,x,H-y-size)

def compose(c):
    rect(c,0,0,W,H,'#FFFFFF')
    text(c,'BYENS FÆLLES KALENDER',35,18,10.5,'Bold')
    text(c,'DET SKER!',30,42,88,'Display')
    text(c,'I TISTRUP OG HODDE',35,125,35,'Display')
    # Use the established hand-drawn identity, at a secondary scale.
    logo=Image.open(ROOT/'site/images/teb-trolde-haandtegnet.png').convert('RGB')
    c.drawImage(ImageReader(logo),665,H-22-104,width=130,height=104)
    text(c,'SEPTEMBER + OKTOBER',635,134,11,'Bold')
    text(c,'2026',752,151,15,'Bold')

    y=174
    for month,label,fill,gutter in [(9,'SEPTEMBER',MINT,'#ECF5F0'),(10,'OKTOBER',PINK,'#FAF0F4')]:
        events=[e for e in EVENTS if e['month']==month]
        rect(c,34,y,W-68,34,fill)
        text(c,label,47,y+6,25,'Display')
        text(c,'2026',W-94,y+10,13,'Bold')
        y+=34
        for event in events:
            rect(c,34,y,96,56,gutter)
            if event['title']=='Kroket og krolf':
                text(c,'HVER UGE',44,y+12,13,'Bold')
                text(c,'ons + søn',44,y+33,10.5,'Sans',MUTED)
            else:
                number=event['day']
                text(c,number,47,y+5,25 if len(number)>2 else 30,'Display')
                weekday='fre + lør' if number=='18-19' else WEEKDAYS[date(2026,month,int(number)).weekday()]
                text(c,weekday,47,y+38,10.5,'Sans',MUTED)
            checked_text(c,event['title'],150,y+4,W-192,21.5,'Bold')
            checked_text(c,event['meta'],150,y+27,W-192,13.25)
            checked_text(c,event['org'],150,y+42,W-192,11,'Sans',MUTED)
            rule(c,150,y+56,W-184)
            y+=56
        y+=8
    assert y<=1045, y

    rect(c,34,1045,W-68,117,INK)
    text(c,'Har I noget på programmet?',51,1059,20,'Bold','#FFFFFF')
    text(c,'tistrup.kalender@gmail.com',51,1091,18,'Bold','#FFFFFF')
    text(c,'Send senest den 15. i måneden før.',51,1119,12,'Sans','#FFFFFF')
    text(c,'Tistrup Erhvervs- og Borgerforening',51,1143,11,'Sans','#D2E6D9')
    rect(c,702,1055,94,88,'#FFFFFF')
    draw_qr(c,706,1055,86)
    text(c,'teb-tistrup.dk',705,1149,10,'Sans','#FFFFFF')
    text(c,'DESIGNUDKAST 1.2 · Historiske arrangementer · September og oktober 2026',35,1176,8.5,'Sans',MUTED)

def create(name,width,height):
    c=canvas.Canvas(str(ROOT/'output/pdf'/name),pagesize=(width,height))
    c.setTitle('Det sker i Tistrup og Hodde · Farver og fællesskab · Version 1.2')
    c.setAuthor('Tistrup Erhvervs- og Borgerforening')
    scale=min(width/W,height/H)
    c.translate((width-W*scale)/2,(height-H*scale)/2);c.scale(scale,scale)
    compose(c);c.showPage();c.save()

if __name__=='__main__':
    create('01-farver-og-faellesskab-v2-a3.pdf',W,H)
    create('01-farver-og-faellesskab-v2-50x70.pdf',500*72/25.4,700*72/25.4)
    print('Created revised A3 and 50 × 70 cm versions. All text widths checked.')
