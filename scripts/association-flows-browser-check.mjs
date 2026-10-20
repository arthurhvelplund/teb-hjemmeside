// Extends the real isolated portal workflow with the current association scope.
import assert from 'node:assert/strict';
export async function checkAssociationFlows({member,guest,association,record}) {
 await member.goto('/forening.html#arbejdsrum?forening='+association.id);
 await member.getByRole('heading',{name:'Jeres arrangementer',exact:true}).waitFor();
 assert.equal(await member.getByRole('link',{name:/Skriv.*nyhed/}).count(),0);
 assert.equal(await member.locator('#own-kind, .fa-owned-row[data-kind=news]').count(),0);
 await member.locator('#own-search').fill('Ingen match');await member.locator('#own-no-match').waitFor();
 await member.locator('#own-search').fill('');
 assert.equal(await member.locator('#own-no-match').isVisible(),false);
 record('Owner workspace contains calendar events and search without news creation or a content-type filter');
 await guest.goto('/nyt.html');await guest.locator('#nyheder-heading').waitFor();
 assert.equal(await guest.locator('#association-news-feed, #foreningsnyt-heading, a[href*="#skriv"]').count(),0);
 assert.ok(await guest.getByRole('link',{name:/Tistrup Nyt/}).count());
 record('Det sker has no association-news feed or creation links and retains the local media links');
 for(const page of [member,guest]){
  await page.goto('/forening.html#skriv?forening='+association.id);
  await page.waitForURL('**/kalender.html?opret=1');await page.locator('#ec-form').waitFor();
  assert.equal(await page.locator('#news-editor-form').count(),0);
 }
 record('Previous news-creation bookmarks lead members and guests to event creation');
 for(const width of [390,320]){
  await member.setViewportSize({width,height:844});await guest.setViewportSize({width,height:844});
  await member.goto('/forening.html#arbejdsrum?forening='+association.id);await member.locator('#own-search').waitFor();
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
  assert.ok((await guest.locator('[data-sharing=flyers]').innerText()).includes('Omdelingsdato'));
  assert.equal(await guest.locator('a[href="mailto:jemantonsen@bbsyd.dk"]').count(),1);
  assert.equal(await guest.locator('a[href="https://vardekommune.dk/kommunen/byportal/"]').count(),1);
  assert.equal(await guest.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'expanded information page at '+width);

 }
 await member.setViewportSize({width:1440,height:1000});await guest.setViewportSize({width:1440,height:1000});
 record('Public contact, owner workspace, directory views, print-only popup and separate illustrated information page fit 390px and 320px phones');
}
