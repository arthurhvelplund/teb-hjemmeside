// Extends the real isolated portal workflow with the current association scope.
import assert from 'node:assert/strict';
export async function checkAssociationFlows({member,guest,association,record}) {
 await member.goto('/forening.html#min-forening?forening='+association.id);
 await member.getByRole('heading',{name:'Jeres arrangementer',exact:true}).waitFor();
 await member.getByRole('heading',{name:'Personer med adgang',exact:true}).waitFor();
 await member.locator('.mf-header summary[aria-label="Foreningens muligheder"]').click();
 await member.getByRole('link',{name:'Rediger foreningens side',exact:true}).waitFor();await member.getByRole('link',{name:'Se siden som besøgende',exact:true}).waitFor();
 await member.keyboard.press('Escape');
 assert.equal(await member.getByRole('link',{name:/Skriv.*nyhed/}).count(),0);
 assert.equal(await member.locator('.mf-event-grid li').filter({hasText:'Foreningens direkte arrangement'}).count(),1);
 record('Min forening groups events and access with public-profile editing in the header menu');
 const liveProfile=await (await member.request.get('/api/kalender/associations/'+association.id)).json();
 await member.route('**/api/kalender/me/events',async route=>{
  const response=await route.fetch(),body=await response.json();
  body.events.push(...Array.from({length:20},(_,i)=>({id:'twenty-test-'+i,associationId:association.id,revision:1,status:'approved',published:{state:'approved'},data:{title:'Tyve arrangementer '+i,date:'2099-01-01',time:'12:00',location:'Teststed',state:'approved',...(i===0?{image:liveProfile.association.imageUrl}:{})}})));
  await route.fulfill({response,json:body});
 });
 await member.reload();await member.locator('.mf-event-grid > li').filter({hasText:'Tyve arrangementer'}).last().waitFor();
 assert.equal(await member.locator('.mf-event-grid > li').filter({hasText:'Tyve arrangementer'}).count(),20);
 assert.equal(await member.locator('.mf-event-grid > li').filter({hasText:'Tyve arrangementer 0'}).locator('.mf-event-visual > img').getAttribute('src'),liveProfile.association.imageUrl);
 await member.unroute('**/api/kalender/me/events');await member.reload();
 record('All twenty upcoming events render in the compact grid and an existing photo appears');
 const origin=new URL(member.url()).origin;
 const disposable=await member.request.post('/api/kalender/events',{headers:{Origin:origin},data:{requestKey:crypto.randomUUID(),associationId:association.id,event:{title:'Sletning via menu',date:'2099-01-02',time:'12:00',location:'Teststed',description:'Isoleret slettetest'}}});
 assert.ok(disposable.ok());const temporary=await disposable.json();await member.reload();
 const removalCard=member.locator('.mf-event-grid > li').filter({hasText:'Sletning via menu'});await removalCard.locator('summary').click();
 member.once('dialog',dialog=>dialog.accept());await removalCard.getByRole('button',{name:'Slet arrangement',exact:true}).click();
 await member.getByText('Arrangementet er slettet.',{exact:true}).waitFor();assert.equal((await member.request.get('/api/kalender/events/'+temporary.id)).status(),404);
 assert.equal(await member.locator('.mf-event-grid > li').filter({hasText:'Sletning via menu'}).count(),0);
 record('Delete from the three-dot menu removes an isolated event from workspace and public calendar');
 await guest.goto('/nyt.html');await guest.locator('#nyheder-heading').waitFor();
 assert.equal(await guest.locator('#association-news-feed, #foreningsnyt-heading, a[href*="#skriv"]').count(),0);
 assert.ok(await guest.getByRole('link',{name:/Tistrup Nyt/}).count());
 record('Det sker has no association-news feed or creation links and retains the local media links');
 for(const path of ['/foreningsportal.html','/mit-arrangement.html','/kalender-redaktion.html'])assert.equal((await guest.request.get(path)).status(),404,path);
 record('Old redirect pages are removed');
 // Exercise the display limit and history without changing the existing workflow's data.
 await guest.route('**/api/kalender/events?from=2000-01-01',async route=>{
  const response=await route.fetch(),body=await response.json();
  const base={associationId:association.id,time:'12:00',location:'Teststed',description:'Hele beskrivelsen på foreningssiden.',state:'approved'};
  body.events.push(...[1,2,3,4].map(i=>({...base,id:'profile-test-'+i,title:'Profilens arrangement '+i,date:'2099-01-01'})),{...base,id:'profile-old',title:'Tidligere profilarrangement',date:'2020-01-01'});
  await route.fulfill({response,json:body});
 });
 await guest.goto('/forening.html?id='+association.id);await guest.locator('.fa-public-identity').waitFor();
 for(let i=1;i<=4;i++)await guest.getByRole('heading',{name:'Profilens arrangement '+i,exact:true}).waitFor();
 assert.equal(await guest.getByRole('link',{name:'Se flere arrangementer',exact:true}).count(),0);
 await guest.locator('.fa-past-events summary').click();await guest.getByRole('heading',{name:'Tidligere profilarrangement',exact:true}).waitFor();
 record('Association profile shows every upcoming event beyond the old three-event limit and its expandable history');
 await guest.unroute('**/api/kalender/events?from=2000-01-01');
 for(const width of [390,320]){
  await member.setViewportSize({width,height:844});await guest.setViewportSize({width,height:844});
  await member.goto('/forening.html#min-forening?forening='+association.id);await member.locator('.mf-event-grid').waitFor();
  assert.equal(await member.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'owner workspace at '+width);
  await guest.goto('/forening.html?id='+association.id);await guest.locator('.fa-public-identity').waitFor();
  assert.equal(await guest.locator('.fa-public-news').count(),0);
  assert.equal(await guest.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'public profile at '+width);
  const contact=guest.getByRole('link',{name:/^Kontakt foreningen/});
  assert.equal(await contact.getAttribute('href'),'mailto:kontakt%40example.org');
  assert.ok(await contact.evaluate(n=>n.getBoundingClientRect().bottom<innerHeight));
  await guest.goto('/forening.html');await guest.locator('.fa-association').waitFor();
  for(const mode of ['cards','list']){
   await guest.locator('[data-directory-view='+mode+']').click();
   assert.equal(await guest.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'directory '+mode+' at '+width);
   const photoHeight=await guest.locator('.fa-association-photo').first().evaluate(n=>n.getBoundingClientRect().height);
   assert.ok(mode==='cards'?photoHeight>=140:photoHeight<=65,'picture and list views remain distinct on phones');
  }
  await guest.goto('/kalender.html?opret=1');await guest.locator('#ec-form').waitFor();
  assert.equal(await guest.locator('#ec-form [name=channels], #ec-form [data-sharing]').count(),0);
  assert.equal(await guest.locator('#ec-form [name=printRequested]').count(),1);
  assert.equal(await guest.evaluate(()=>document.querySelector('.ec-dialog').scrollWidth>innerWidth),false,'print request at '+width);
  await guest.keyboard.press('Escape');
  await guest.locator('.cal-sharing-link a').click();await guest.waitForURL('**/del-arrangement.html');
  assert.equal(await guest.locator('[data-sharing]').count(),6);
  assert.equal(await guest.locator('input, select, textarea').count(),0);
  for(const summary of await guest.locator('.sharing-card summary').all())await summary.click();
  assert.ok((await guest.locator('[data-sharing=flyers]').innerText()).includes('Kirsten Thorhauge'));
  assert.ok((await guest.locator('[data-sharing=flyers]').innerText()).includes('Omdeling i 2026'));
  assert.equal(await guest.locator('a[href="mailto:jemantonsen@bbsyd.dk"]').count(),1);
  assert.equal(await guest.locator('a[href="https://vardekommune.dk/kommunen/byportal/"]').count(),1);
  assert.equal(await guest.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'expanded information page at '+width);

 }
 await member.setViewportSize({width:1440,height:1000});await guest.setViewportSize({width:1440,height:1000});
 record('Public contact, owner workspace, directory views, print-only popup and separate illustrated information page fit 390px and 320px phones');
}
