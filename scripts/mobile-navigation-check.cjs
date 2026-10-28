const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { join } = require('node:path');
const { chromium } = require(require.resolve('playwright', {paths:[join(__dirname,'../calendar-worker')]}));
module.exports = async function checkMobileNavigation() {
 const root=join(__dirname,'..');
 const css=await readFile(join(root,'site/css/style.css'),'utf8');
 const layout=await readFile(join(root,'site/css/layout.css'),'utf8');
 const html=await readFile(join(root,'site/index.html'),'utf8');
 const main=await readFile(join(root,'site/js/main.js'),'utf8');
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {})});
 try {
 const page=await browser.newPage();
 await page.route('**/*',route=>route.abort());
 for(const [width,height] of [[320,568],[393,852],[852,393],[1100,800],[1440,1000]]) {
 await page.setViewportSize({width,height});
 await page.setContent(html.replace(/<script\b[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*>/g,''));
 await page.addStyleTag({content:css.replace(/@import[^;]+;/g,'')+'\n'+layout});
 await page.addScriptTag({content:main});
 await page.waitForFunction(()=>document.documentElement.style.getPropertyValue('--site-header-height'));
 const header=page.locator('.site-header');
 const closedHeight=(await header.boundingBox()).height;
 assert.ok(Math.abs((await header.boundingBox()).y)<1,'header starts at viewport top');
 if(width<=1100) {
 await page.locator('.nav-toggle').click();
 assert.equal(await page.locator('.nav-toggle').getAttribute('aria-expanded'),'true');
 const boxes=await page.locator('.nav > a').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,bottom:r.bottom};}));
 assert.ok(boxes.every(b=>Math.abs(b.x-boxes[0].x)<1),'mobile menu must use one column at '+width);
 assert.ok(boxes.every((b,i)=>!i||b.y>=boxes[i-1].bottom),'links stack without overlap');
 assert.ok(Math.abs((await header.boundingBox()).height-closedHeight)<1,'opening menu must not resize header');
 const panel=await page.locator('.nav').boundingBox();
 assert.ok(panel.y+panel.height<=height+1,'menu fits viewport');
 await page.locator('.nav > a').last().scrollIntoViewIfNeeded();
 const last=await page.locator('.nav > a').last().boundingBox();
 assert.ok(last.y>=closedHeight-1&&last.y+last.height<=height+1,'last item reachable');
 await page.locator('.nav-toggle').click();
 assert.equal(await page.locator('.nav').isVisible(),false);
 }
 await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,600);});
 assert.ok(Math.abs((await header.boundingBox()).y)<1,'header remains at viewport top after scroll');
 console.log('Navigation passed at '+width+'x'+height);
 }
 }finally{await browser.close();}
};
if(require.main===module) module.exports().catch(error=>{console.error(error);process.exitCode=1;});
