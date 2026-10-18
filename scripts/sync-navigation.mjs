import {readFile,writeFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const site=new URL('../site/',import.meta.url);
const items=[['index.html','Forside'],['erhverv.html','Erhverv'],['forening.html','Forening'],['kalender.html','Kalender'],['nyt.html','Det sker'],['om-tistrup.html','Om byen'],['projekter.html','Projekter'],['om-foreningen.html','Om TEB'],['bliv-medlem.html','Bliv medlem']];
const parents={'bestyrelse.html':'om-foreningen.html','dokumenter.html':'om-foreningen.html','hodde-tistrup-prisen.html':'om-tistrup.html'};
let count=0;
for(const file of await readdir(site)){
 if(!file.endsWith('.html'))continue;
 const path=new URL(file,site),old=await readFile(path,'utf8');
 if(!/<nav\b[^>]*id="primary-nav"/.test(old))continue;
 const active=parents[file]||file;
 let content=old.replace(/<nav\b[^>]*id="primary-nav"[^>]*>[\s\S]*?<\/nav>/,()=>`<nav class="nav" id="primary-nav" aria-label="Hovedmenu">\n${items.map(([href,label])=>`      <a href="${href}"${href===active?' class="'+(href==='bliv-medlem.html'?'nav-cta active':'active')+'" aria-current="page"':href==='bliv-medlem.html'?' class="nav-cta"':''}>${label}</a>`).join('\n')}\n    </nav>`);
 content=content.replaceAll('<a href="foreningsportal.html">Foreningsportal</a>','<a href="forening.html">Forening</a>');
 content=content.replace(/(<li><a href="forening.html">Forening<\/a><\/li>)(?!\s*<li><a href="kalender.html">)/g,'$1\n        <li><a href="kalender.html">Kalender</a></li>');
 if(!content.includes('css/seasonal-themes.css'))content=content.replace('</head>','<link rel="stylesheet" href="css/seasonal-themes.css?v=20261009-haunted-v5">\n</head>');
 if(!content.includes('js/seasonal-theme.js'))content=content.replace('</body>','<script src="js/seasonal-theme.js?v=20261009-haunted-v5" defer></script>\n</body>');
 if(content!==old){await writeFile(path,content);count++;}
}
console.log(`Opdaterede fælles navigation på ${count} sider i ${fileURLToPath(site)}.`);
