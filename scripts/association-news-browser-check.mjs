// Extends the isolated real portal workflow. No external mail or shared data.
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
export async function checkAssociationNews({admin,member,guest,memberContext,guestContext,association,root,json,fill,record}) {
 const newsForm=member.locator('#news-editor-form');
 await member.getByRole('link',{name:/^Skriv nyhed/}).click();await newsForm.waitFor();
 await fill(newsForm,{title:'Foreningens egen nyhed',description:'En offentlig fortælling fra foreningen.',body:'Den fulde fortælling.'});
 await newsForm.locator('[name=photo]').setInputFiles(resolve(root,'site/images/tistrup-torv.jpg'));await newsForm.getByText('Billedet er klar.',{exact:false}).waitFor();
 assert.equal(await member.locator('[data-news-preview] h3').innerText(),'Foreningens egen nyhed');
 let attempts=0;const keys=[];
 await member.route('**/api/kalender/posts',async route=>{
  if(route.request().method()!=='POST')return route.continue();keys.push(route.request().postDataJSON().requestKey);
  if(++attempts===1){await route.fetch();return route.abort('failed');}return route.continue();
 });
 await newsForm.locator('button[type=submit]').click();await newsForm.getByText('Prøv samme indsendelse igen.',{exact:false}).waitFor();
 await newsForm.locator('button[type=submit]').click();await member.getByRole('heading',{name:'Nyheden er udgivet.'}).waitFor();await member.unroute('**/api/kalender/posts');
 assert.equal(keys.length,2);assert.equal(new Set(keys).size,1);
 const posts=(await json(memberContext,'/me/posts')).posts;assert.equal(posts.length,1);const id=posts[0].id;
 assert.equal(posts[0].data.author,association.name);record('Member publishes news with a real photo and one stable key after a lost successful response');
 await guest.goto('/forening.html?id='+association.id);await guest.getByRole('heading',{name:'Foreningens egen nyhed'}).waitFor();
 assert.ok(await guest.locator('.fa-public-identity h1').evaluate(n=>n.getBoundingClientRect().bottom<innerHeight));
 const contact=guest.getByRole('link',{name:/^Kontakt foreningen/});assert.ok(await contact.evaluate(n=>n.getBoundingClientRect().bottom<innerHeight));
 assert.equal(await contact.getAttribute('href'),'mailto:kontakt%40example.org');record('Public profile puts its own name and contact before the fold and displays published news');
 await guest.getByRole('heading',{name:'Foreningens egen nyhed'}).getByRole('link').click();await guest.getByRole('heading',{name:'Foreningens egen nyhed',level:1}).waitFor();
 assert.ok((await guest.locator('.fa-story-photo').getAttribute('src')).startsWith('/api/kalender/association-images/'));
 assert.equal(await guest.getByRole('link',{name:'Ret nyheden',exact:true}).count(),0);
 await guest.goto('/nyt.html');await guest.locator('#association-news-feed').getByText('Foreningens egen nyhed',{exact:true}).waitFor();record('News detail and Det sker use the same public record without visitor editing controls');
 await member.goto('/forening.html#arbejdsrum?forening='+association.id);await member.locator('.fa-owned-row[data-kind=news]').waitFor();await member.locator('#own-kind').selectOption('news');
 assert.equal(await member.locator('.fa-owned-row[data-kind=event]:visible').count(),0);await member.locator('#own-search').fill('Ingen match');await member.locator('#own-no-match').waitFor();await member.locator('#own-search').fill('');
 await member.locator('.fa-owned-row[data-kind=news]').getByRole('link',{name:'Ret',exact:true}).click();await newsForm.waitFor();await fill(newsForm,{title:'Foreningens rettede nyhed'});await newsForm.locator('button[type=submit]').click();await member.getByRole('heading',{name:'Nyheden er udgivet.'}).waitFor();
 assert.equal((await json(guestContext,'/posts/'+id)).post.title,'Foreningens rettede nyhed');record('Owner filters and searches own content, then edits published news with revisions');
 for(const width of [390,320]){
  await member.setViewportSize({width,height:844});await guest.setViewportSize({width,height:844});
  await member.goto('/forening.html#skriv?forening='+association.id);await newsForm.waitFor();assert.equal(await member.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'news editor at '+width);
  await guest.goto('/forening.html?id='+association.id);await guest.locator('.fa-public-identity').waitFor();assert.equal(await guest.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'public profile at '+width);
  assert.ok(await contact.evaluate(n=>n.getBoundingClientRect().bottom<innerHeight));
 }
 await member.setViewportSize({width:1440,height:1000});await guest.setViewportSize({width:1440,height:1000});record('Public contact and news editor fit both 390px and 320px phones');
 await member.goto('/forening.html#arbejdsrum?forening='+association.id);await member.locator('form[data-action=withdraw-news] button').click();await member.getByText('Nyheden er fjernet fra de offentlige sider.').waitFor();
 assert.equal((await guestContext.request.get('/api/kalender/posts/'+id)).status(),404);record('Owner withdraws news from public views and retains private history');
 async function submitGuest(title){
  await guest.goto('/forening.html#skriv');const form=guest.locator('#news-editor-form');await form.waitFor();
  await fill(form,{title,description:'Skal godkendes af TEB.',author:'En lokal gæst',email:'nyhedsgaest@example.org'});await guest.waitForTimeout(1600);
  const response=guest.waitForResponse(r=>new URL(r.url()).pathname==='/api/kalender/posts'&&r.request().method()==='POST');
  await form.locator('button[type=submit]').click();const saved=await(await response).json();await guest.getByRole('heading',{name:'Tak. TEB har modtaget nyheden.'}).waitFor();
  const href=await guest.getByRole('link',{name:'Gem dit private link til status'}).getAttribute('href');assert.ok(href.includes('#adgang='));
  assert.equal((await guestContext.request.get('/api/kalender/posts/'+saved.id)).status(),404);return {...saved,href};
 }
 const pending=await submitGuest('Gæstens nyhed');
 await admin.goto('/forening.html#teb');await admin.reload();const review=admin.locator('details').filter({hasText:'Gæstens nyhed'});await review.locator('summary').click();await review.locator('button[value=approve]').click();await admin.getByText('Opslaget er godkendt.',{exact:true}).waitFor();
 await guest.goto('/forening.html#opslag?id='+pending.id);await guest.getByRole('heading',{name:'Gæstens nyhed',level:1}).waitFor();record('Guest news stays private until approved in the shared TEB queue beside calendar revisions');
 const rejected=await submitGuest('En afvist nyhed');
 await admin.goto('/forening.html#teb');await admin.reload();const reject=admin.locator('details').filter({hasText:'En afvist nyhed'});await reject.locator('summary').click();await reject.locator('button[value=reject]').click();await reject.getByText('Skriv en begrundelse for afvisningen.').waitFor();
 await reject.locator('[name=note]').fill('Tilføj kontaktoplysninger.');await reject.locator('button[value=reject]').click();await admin.getByText('Indsendelsen er afvist med en besked.').waitFor();
 await guest.goto('/'+rejected.href);await guest.getByText('Besked fra TEB: Tilføj kontaktoplysninger.').waitFor();record('TEB rejection requires a reason and the real private receipt shows feedback');
 await guest.goto('/kalender.html#godkendelse');await guest.waitForURL('**/forening.html#teb');record('Old approval links lead to the single TEB queue');
}
