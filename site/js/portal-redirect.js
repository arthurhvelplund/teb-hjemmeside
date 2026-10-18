// Bevar gamle bogmærker. Private adgangsnøgler bliver i URL-fragmentet.
const kind=document.body.dataset.portalRedirect;
let target='forening.html';
if(kind==='submit')target='kalender.html?opret=1';
if(kind==='private'){
  const id=new URLSearchParams(location.search).get('id');
  const fragment=new URLSearchParams(location.hash.slice(1));
  const token=fragment.get('adgang');
  target='kalender.html'+(id?'?privat='+encodeURIComponent(id):'')+(token?'#adgang='+encodeURIComponent(token):'');
}
if(kind==='admin')target='forening.html#teb';
location.replace(target);
