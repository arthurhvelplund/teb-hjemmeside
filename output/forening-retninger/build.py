"""Bygger en selvstændig sammenligning ud fra den eksisterende TEB-side."""
from pathlib import Path
import base64, json, re, subprocess, mimetypes

ROOT=Path(__file__).resolve().parents[2]
OUT=Path(__file__).resolve().parent
SITE=ROOT/'site'
ASSETS=OUT/'assets'
ASSETS.mkdir(exist_ok=True)

def image_data(path, width=None):
    path=Path(path)
    if width:
        target=ASSETS/(path.stem+'-'+str(width)+'.webp')
        if not target.exists():
            subprocess.run(['cwebp','-quiet','-q','45','-resize',str(width),'0',str(path),'-o',str(target)],check=True,capture_output=True)
        path=target
    mime=mimetypes.guess_type(path)[0] or 'application/octet-stream'
    return 'data:'+mime+';base64,'+base64.b64encode(path.read_bytes()).decode()

def inline_css(name):
    path=SITE/'css'/name
    css=path.read_text()
    def replace(m):
        raw=m.group(1).strip('\"\'')
        if raw.startswith(('data:','http:','https:')): return m.group(0)
        asset=(path.parent/raw).resolve()
        return 'url("'+image_data(asset)+'")' if asset.exists() else m.group(0)
    return re.sub(r'url\(([^)]+)\)',replace,css)

shared='\n'.join(inline_css(n) for n in ['style.css','layout.css','portal.css','forening.css'])
seasonal=inline_css('seasonal-themes.css')
source=(OUT/'current-source.html').read_text()
header=re.search(r'<header class="site-header">.*?</header>',source,re.S).group()
footer=re.search(r'<footer class="site-footer">.*?</footer>',source,re.S).group()
logo=image_data(SITE/'images/teb-trolde-haandtegnet.png',220)
def inline_images(html):
    def replace(m):
        raw=m.group(1)
        path=SITE/raw
        if not path.exists():return m.group(0)
        return 'src="'+(logo if 'teb-trolde' in raw else image_data(path))+'"'
    html=re.sub(r'src="(images/[^"]+)"',replace,html)
    # Reuse the actual Facebook symbol already present in the source site.
    fb=(SITE/'images/facebook.svg').read_text()
    symbol=re.search(r'<symbol[^>]*>(.*?)</symbol>',fb,re.S)
    fb_inner=symbol.group(1) if symbol else re.sub(r'</?svg\b[^>]*>','',fb)
    html=re.sub(r'<use href="images/facebook.svg#facebook"></use>',fb_inner,html)
    return html

header=inline_images(header)
footer=inline_images(footer)
def reference_links(html):
    return re.sub(r'href="((?!https?:|mailto:|tel:|#|data:)[^"]+\.html[^"]*)"',r'target="_blank" rel="noopener" href="http://localhost:8787/\1"',html)
header=reference_links(header)
footer=reference_links(footer)

# Read the six established fictional associations from the existing prototype.
prototype=(ROOT/'output/foreningsportal-enkel/prototype.js').read_text()
seed=re.search(r' const associations=(\[.*?\n \]);',prototype,re.S).group(1)
raw=subprocess.run(['node','-e','process.stdout.write(JSON.stringify('+seed+'))'],check=True,text=True,capture_output=True).stdout
associations=json.loads(raw)
shorts=['Gåture, cykelture og godt selskab.','Musik, fællessang og lokale kulturoplevelser.','Bål, udeliv og oplevelser sammen.','Kaffe, banko, udflugter og nye bekendtskaber.','Fællesspisning og livet i landsbyen.','Håndarbejde, reparationer og nye idéer.']
for a,short in zip(associations,shorts):a['short']=short
photo_files={'motion':'byskoven.jpg','kultur':'torvet-optraeden.png','spejder':'laeringshytten.jpg','senior':'frivillige-frokost.png','hodde':'tistrup-torv.jpg','kreativ':'sandkasse-indvielse.jpg','town':'midsommerfest.jpg'}
photos={key:image_data(SITE/'images'/name,440) for key,name in photo_files.items()}
extra=(OUT/'variants.css').read_text()
script_template=(OUT/'variants.js').read_text().replace('__ASSOCIATIONS__',json.dumps(associations,ensure_ascii=False)).replace('__PHOTOS__',json.dumps(photos,ensure_ascii=False))
pages={}
for variant in ['cards','list','interests','activities']:
    # Use real shared site CSS, header and footer. Only the central content changes.
    script=script_template.replace('__VARIANT__',json.dumps(variant))
    page='<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Foreninger · TEB · '+variant+'</title><style>'+shared+'\n'+extra+'</style></head><body>'+header+'<main class="design-main"><div class="design-wrap" id="design-content"></div></main>'+footer+'<dialog id="design-dialog" class="design-dialog" aria-label="Foreningsoplysninger"></dialog><script>'+script+'</script></body></html>'
    pages[variant]=page
    (OUT/(variant+'.html')).write_text(page)

current=re.sub(r'<script\b[^>]*>.*?</script>','',source,flags=re.S)
current=re.sub(r'<link\b[^>]*>','',current)
current=current.replace('</head>','<style>'+shared+'\n'+seasonal+'</style></head>')
current=inline_images(current)
current=re.sub(r'<a\b([^>]*)href="[^"]*"([^>]*)>',r'<a\1href="#" onclick="return false"\2>',current)
current=current.replace('</body>','<script>new ResizeObserver(()=>parent.postMessage({type:"teb-size",height:document.body.scrollHeight},"*")).observe(document.body);document.querySelectorAll("input,select,button").forEach(e=>e.disabled=true)</script></body>')
pages['current']='<!doctype html>'+current
(OUT/'current.html').write_text(pages['current'])
comparison=(OUT/'comparison.html').read_text()
base=pages['cards'].replace('const variant="cards";','const variant=__SELECTED_VARIANT__;')
comparison=comparison.replace('__BASE_PAGE__',json.dumps(base,ensure_ascii=False).replace('</','<\\/')).replace('__CURRENT_PAGE__',json.dumps(pages['current'],ensure_ascii=False).replace('</','<\\/')).replace('__SCREENSHOT__',image_data(ASSETS/'current-1440.png',1440))
(OUT/'index.html').write_text(comparison)
print(json.dumps({'output':str(OUT/'index.html'),'bytes':len(comparison.encode()),'associations':len(associations),'variants':list(pages)},ensure_ascii=False))
