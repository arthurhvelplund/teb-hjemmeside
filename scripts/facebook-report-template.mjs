const escape = value => String(value).replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));

export function renderFacebookReport(model) {
  const data = JSON.stringify(model).replace(/[<>&\u2028\u2029]/g, character => '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0'));
  return `<!doctype html>
<html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'">
<title>Facebookrapport · ${escape(model.page.name)}</title>
<style>
:root{--ink:#17392e;--muted:#607069;--green:#1a5e46;--mint:#e8f1e8;--paper:#f7f7f1;--line:#dfe5db;--white:#fff;--gold:#b87a2a;--radius:18px;color-scheme:light;font-family:Arial,Helvetica,sans-serif;color:var(--ink);background:var(--paper)}
*{box-sizing:border-box}body{margin:0}button,input,select{font:inherit}button,select,summary,a{touch-action:manipulation}button,select,input{min-height:44px}button,select{cursor:pointer}a{color:var(--green)}button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible,a:focus-visible,[tabindex]:focus-visible{outline:3px solid #bb8536;outline-offset:4px}button{border:1px solid var(--line);border-radius:9px;padding:10px 16px;background:#fff;color:var(--ink);font-weight:600}button:hover{background:var(--mint)}select,input{border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--ink);padding:10px 13px;max-width:100%}input{width:290px}input::placeholder{color:#748078}.skip{position:absolute;left:20px;top:-100px;z-index:3;background:#fff;padding:15px}.skip:focus{top:10px}.wrap{max-width:1240px;margin:auto;padding:0 36px}
.top{background:var(--ink);color:#fff}.top-inner{min-height:80px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{display:flex;align-items:center;gap:13px}.monogram{font:700 17px Georgia,serif;border:1px solid #91a99b;border-radius:50%;width:46px;height:46px;display:grid;place-items:center;letter-spacing:1px}.brand-name{font-size:14px;font-weight:700;line-height:1.4}.brand-sub{display:block;color:#bad0c3;font-size:12px;font-weight:400}.private{font-size:12px;letter-spacing:.07em;text-transform:uppercase;border:1px solid #637f6f;border-radius:30px;padding:8px 12px;white-space:nowrap}
.hero{padding-top:42px;padding-bottom:28px;display:flex;align-items:flex-end;justify-content:space-between;gap:30px}.eyebrow{font-size:12px;letter-spacing:.13em;text-transform:uppercase;color:var(--green);font-weight:700;margin:0 0 12px}.hero h1{font:400 clamp(36px,4.6vw,58px)/1.04 Georgia,'Times New Roman',serif;letter-spacing:-1.5px;margin:0 0 13px}.hero p{margin:0;color:var(--muted);font-size:15px;line-height:1.55;max-width:670px}.report-meta{font-size:12px;line-height:1.7;white-space:nowrap;color:var(--muted);padding-top:12px}.meta-value{color:var(--ink);font-weight:700}.toolbar{padding:19px 0;border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap}.periods{display:flex;gap:6px;flex-wrap:wrap}.periods button{background:transparent;border-color:transparent;font-size:13px}.periods button[aria-pressed=true]{background:var(--green);color:#fff;box-shadow:0 2px 5px #143e2320}.period-title{font-size:13px;color:var(--muted);margin:0}.period-title strong{color:var(--ink)}
.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:25px}.kpi{padding:21px 23px;background:#fff;border:1px solid var(--line);border-radius:var(--radius);min-height:162px}.kpi-label{font-size:13px;color:var(--muted);margin:0 0 14px}.kpi-number{font-size:clamp(27px,3vw,40px);font-weight:600;letter-spacing:-1.2px;line-height:1.05;margin:0 0 15px;font-variant-numeric:tabular-nums}.kpi-bottom{font-size:12px;line-height:1.45;color:var(--muted);display:flex;align-items:center;gap:8px;flex-wrap:wrap}.delta{border-radius:5px;background:var(--mint);color:var(--green);font-weight:700;padding:4px 6px;white-space:nowrap}.delta.down{background:#f4ede2;color:#8b581c}.kpi-note{margin-top:8px;font-size:11px;line-height:1.4;color:var(--muted)}
.main-grid{display:grid;grid-template-columns:minmax(0,1.85fr) minmax(280px,1fr);gap:20px;margin-bottom:32px}.panel{background:#fff;border:1px solid var(--line);border-radius:var(--radius)}.chart-panel{padding:25px 26px 18px}.panel-head{display:flex;justify-content:space-between;align-items:flex-start;gap:15px;margin-bottom:8px}.section-title{font:400 26px/1.2 Georgia,'Times New Roman',serif;margin:0 0 7px;letter-spacing:-.4px}.section-sub{font-size:12px;color:var(--muted);margin:0;line-height:1.6}.chart-panel select{font-size:12px;min-width:140px}.chart-readout{font-size:12px;color:var(--muted);min-height:38px;padding-top:8px;line-height:1.5}.chart-readout strong{color:var(--ink);margin-left:8px}.chart{width:100%;min-height:270px;position:relative;border-radius:8px}.chart svg{width:100%;height:auto;display:block}.chart-note{font-size:11px;color:var(--muted);line-height:1.6;border-top:1px solid var(--line);padding-top:12px}.mini-stats{display:flex;flex-wrap:wrap;gap:10px 19px;font-size:12px;margin-top:13px;color:var(--muted)}.mini-stats strong{color:var(--ink)}.read-data{margin-top:13px;font-size:12px}.read-data summary{cursor:pointer;padding:8px 0}.data-scroll{max-height:280px;overflow:auto}table{border-collapse:collapse;width:100%;font-size:12px}th,td{padding:9px 8px;border-bottom:1px solid var(--line);text-align:right;font-variant-numeric:tabular-nums}th:first-child,td:first-child{text-align:left}th{position:sticky;top:0;background:#fff;color:var(--muted)}
.insights{padding:25px;background:#edf3e9;border-color:#dce7d6}.insights .eyebrow{font-size:11px;margin-bottom:13px}.insight{padding:16px 0;border-bottom:1px solid #d4dfcf}.insight:first-of-type{padding-top:3px}.insight:last-of-type{border-bottom:0;padding-bottom:0}.insight h3{font-size:15px;line-height:1.4;margin:0 0 7px}.insight p{font-size:13px;line-height:1.65;margin:0;color:#4e6559}.insight strong{color:var(--ink)}.comparison-note{font-size:11px;line-height:1.5;padding:12px 14px;border:1px solid #cbdac5;border-radius:9px;margin-top:17px;color:#51644e}.posts-section{padding-top:5px;margin-bottom:32px}.section-header{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:18px}.section-header h2{font-size:31px}.scope-badge{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.04em;background:var(--mint);color:var(--green);border-radius:5px;padding:5px 8px;margin-left:8px;vertical-align:middle}.post-controls{display:flex;gap:9px;align-items:center;flex-wrap:wrap;padding:15px 0}.post-controls select{font-size:13px}.posts-heading,.post-summary{display:grid;grid-template-columns:30px minmax(220px,1fr) 79px 79px 70px 58px 62px 19px;gap:12px;align-items:center}.posts-heading{padding:11px 20px;color:var(--muted);font-size:11px}.posts-heading span:nth-child(n+3){text-align:right}.post{border:1px solid var(--line);border-radius:12px;background:#fff;margin-bottom:8px;overflow:hidden}.post:first-child{border-color:#9db79f}.post[open]{border-color:#9db79f}.post-summary{padding:20px;list-style:none;cursor:pointer;min-height:104px}.post-summary::-webkit-details-marker{display:none}.post-summary:hover{background:#fafbf7}.post-rank{font-size:13px;color:#7b8d80;align-self:start;padding-top:4px}.post-title{font-size:14px;line-height:1.5;font-weight:600;display:block}.post-date{font-size:11px;display:block;color:var(--muted);margin-top:4px;font-weight:400}.post-bar{display:block;width:110px;height:3px;background:#edf1e9;border-radius:2px;margin-top:9px}.post-bar-fill{display:block;height:100%;background:#68a07a;border-radius:2px}.post-value{text-align:right;font-size:15px;font-variant-numeric:tabular-nums}.post-value.primary{font-weight:700}.mobile-label{display:none}.post-toggle{font-size:19px;transform:rotate(0deg);text-align:center;color:var(--muted)}.post[open] .post-toggle{transform:rotate(90deg)}.post-body{padding:0 25px 22px 62px;border-top:1px solid var(--line)}.post-body p{white-space:pre-wrap;font-size:13px;line-height:1.7;max-width:800px;color:#3e5548;margin:20px 0}.post-body a{font-size:13px;display:inline-block;padding:10px 0}.post-count{font-size:12px;color:var(--muted);margin-top:13px;line-height:1.6}.show-more{display:block;margin:18px auto}.empty{padding:30px;text-align:center;color:var(--muted)}.next-steps{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:30px}.action-card{padding:25px;border:1px solid var(--line);border-radius:var(--radius)}.action-card h3{font-size:16px;margin:0 0 9px}.action-card p{font-size:13px;line-height:1.7;color:var(--muted);margin:0}.methods{padding:23px 0;border-top:1px solid var(--line);font-size:12px;line-height:1.75;color:var(--muted)}.methods summary{font-weight:700;color:var(--ink);cursor:pointer;min-height:32px}.methods ul{padding-left:19px;max-width:950px}.footer{padding:24px 0 35px;color:var(--muted);font-size:11px;display:flex;justify-content:space-between;gap:20px}.quality{background:#f5edde;border:1px solid #e1cfae;border-radius:8px;padding:12px 16px;font-size:12px;line-height:1.6;margin-bottom:20px}
@media(min-width:1500px){.hero{padding-top:49px}}@media(max-width:1050px){.main-grid{grid-template-columns:minmax(0,1.6fr) minmax(260px,1fr)}.wrap{padding:0 24px}.kpi{padding:20px 17px}.posts-heading,.post-summary{grid-template-columns:25px minmax(180px,1fr) 64px 64px 60px 48px 52px 16px;gap:8px}.post-summary{padding:17px}.post-title{font-size:13px}}@media(max-width:850px){.main-grid{grid-template-columns:1fr}.insights{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0 20px}.insights>.eyebrow,.insights>.section-title,.comparison-note{grid-column:1/-1}.insight{border-bottom:0;padding:12px 0}.hero{align-items:start}.report-meta{white-space:normal;max-width:180px}.kpi-number{font-size:32px}.posts-heading{display:none}.post-summary{grid-template-columns:24px minmax(0,1fr) repeat(3,64px) 16px}.post-value:nth-of-type(6),.post-value:nth-of-type(7){display:none}.mobile-label{display:block;font-size:10px;color:var(--muted);font-weight:400;margin-top:4px}.post-title{font-size:14px}.section-header{align-items:start}.section-header button{white-space:nowrap}}
@media(max-width:600px){.wrap{padding:0 18px}.top-inner{min-height:72px;gap:10px}.brand-name{font-size:12px}.brand-sub{font-size:11px}.monogram{width:40px;height:40px;font-size:15px;flex-shrink:0}.private{font-size:10px;padding:7px 9px}.hero{padding:28px 0 24px;display:block}.hero h1{font-size:39px;letter-spacing:-1px}.hero p{font-size:13px}.report-meta{max-width:none;font-size:11px;padding-top:17px}.report-meta div{display:inline}.report-meta div+div:before{content:' · ';padding:0 3px}.eyebrow{font-size:10px}.toolbar{gap:13px;padding:14px 0 17px}.periods{gap:2px}.periods button{font-size:12px;padding:10px 11px}.period-title{font-size:11px}.kpis{grid-template-columns:1fr 1fr;gap:9px;margin-bottom:18px}.kpi{min-height:155px;padding:17px 15px;border-radius:13px}.kpi-label{font-size:11px;line-height:1.5;margin-bottom:12px}.kpi-number{font-size:31px;letter-spacing:-1px;margin-bottom:12px}.kpi-bottom{font-size:10px;gap:5px}.delta{font-size:10px}.kpi-note{font-size:10px}.main-grid{gap:14px;margin-bottom:26px}.chart-panel{padding:20px 15px 15px}.section-title{font-size:25px}.section-sub{font-size:11px}.panel-head{gap:8px;flex-wrap:wrap}.chart-panel select{font-size:11px;min-width:125px}.chart-note{font-size:10px}.chart-readout{font-size:11px;min-height:43px}.mini-stats{font-size:11px;gap:8px 12px}.insights{display:block;padding:22px}.insight{border-bottom:1px solid #d4dfcf;padding:16px 0}.insights .section-title{margin-bottom:12px}.insight h3{font-size:14px}.insight p{font-size:12px}.section-header{display:block;margin-bottom:9px}.section-header h2{font-size:29px}.section-header button{margin-top:13px;font-size:12px}.scope-badge{font-size:10px;margin-left:4px}.post-controls{gap:8px;padding:12px 0}.post-controls input{width:100%;font-size:13px}.post-controls select{flex:1;min-width:0;font-size:11px;padding:9px 8px}.post-summary{display:grid;grid-template-columns:20px 1fr 18px;gap:8px;padding:16px}.post-rank{grid-column:1;grid-row:1}.post-main{grid-column:2;grid-row:1;padding-right:2px}.post-toggle{grid-column:3;grid-row:1}.post-title{font-size:13px;line-height:1.55}.post-date{font-size:10px}.post-bar{width:85px;margin-top:8px}.post-value,.post-value:nth-of-type(6),.post-value:nth-of-type(7){display:flex;flex-direction:column;align-items:start;text-align:left;grid-row:2;font-size:14px;margin-top:8px}.post-value:nth-of-type(3){grid-column:1/3;margin-left:28px}.post-value:nth-of-type(4){grid-column:2;justify-self:center}.post-value:nth-of-type(5){grid-column:2/4;justify-self:end;margin-right:20px}.post-value:nth-of-type(6),.post-value:nth-of-type(7){display:none}.post-body{padding:0 18px 17px}.post-body p{font-size:12px}.post-count{font-size:11px}.next-steps{grid-template-columns:1fr;gap:10px;margin-bottom:22px}.action-card{padding:21px}.action-card h3{font-size:15px}.action-card p{font-size:12px}.methods{font-size:11px}.footer{font-size:10px;display:block}.footer span{display:block;margin-bottom:7px}.data-scroll{overflow:auto}th,td{padding:7px 5px;font-size:10px}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}@media print{body{background:#fff}.top{background:#fff;color:var(--ink);border-bottom:1px solid var(--line)}.brand-sub{color:var(--muted)}.private{color:var(--muted)}.wrap{max-width:none;padding:0 12px}.hero{padding-top:24px}.toolbar button,.post-controls,.show-more,.print-button,.read-data{display:none!important}.toolbar{padding:12px 0}.kpis{grid-template-columns:repeat(4,1fr)}.kpi{min-height:140px;padding:15px}.kpi-number{font-size:30px}.main-grid{grid-template-columns:1.8fr 1fr;gap:14px}.panel,.post,.action-card{break-inside:avoid}.chart-panel{padding:18px 15px}.insights{display:block;padding:18px}.insight{font-size:11px;padding:12px 0}.posts-heading,.post-summary{grid-template-columns:25px minmax(180px,1fr) repeat(5,55px) 15px;gap:7px}.post-summary{padding:14px}.post-body{display:none!important}.post-value{display:block!important}.post-title{font-size:12px}.mobile-label{display:none}.next-steps{grid-template-columns:1fr 1fr}.methods{font-size:10px}.methods>div{display:block!important}.footer{padding-bottom:10px}button,select,input{box-shadow:none}}
</style></head><body>
<a href="#main" class="skip">Gå til rapporten</a>
<header class="top"><div class="wrap top-inner"><div class="brand"><span class="monogram">TEB</span><div class="brand-name">Tistrup Erhvervs- og Borgerforening<span class="brand-sub">Facebook · statistik og indblik</span></div></div><span class="private">Privat rapport</span></div></header>
<main id="main" class="wrap">
<section class="hero"><div><p class="eyebrow">TEB / Facebookrapport</p><h1>Et overblik over<br>det, der bliver set.</h1><p>Sidens udvikling, de mest sete opslag og et par konkrete ting at tage med videre.</p></div><div class="report-meta"><div>Data hentet <span id="fetched" class="meta-value"></span></div><div>Grundlag <span id="basis" class="meta-value"></span></div></div></section>
<div class="toolbar"><div class="periods" role="group" aria-label="Vælg periode"><button data-range="7" aria-pressed="false">7 døgn</button><button data-range="28" aria-pressed="true">28 døgn</button><button data-range="90" aria-pressed="false">90 døgn</button><button data-range="all" aria-pressed="false">Aktiv periode</button></div><p id="period-title" class="period-title"></p></div>
<div id="quality" class="quality" hidden></div>
<section id="kpis" class="kpis" aria-label="Sidens nøgletal"></section>
<section class="main-grid"><div class="panel chart-panel"><div class="panel-head"><div><h2 class="section-title">Udviklingen dag for dag</h2><p class="section-sub">Bevæg musen over grafen, eller brug piletasterne.</p></div><select id="chart-metric" aria-label="Vælg tal i grafen"><option value="views">Visninger</option><option value="interactions">Opslagsinteraktioner</option><option value="followers">Følgere</option><option value="viewers">Daglige viewers</option><option value="reactions">Reaktioner</option></select></div><div id="chart-readout" class="chart-readout" aria-live="polite"></div><div id="chart" class="chart" tabindex="0" role="img" aria-label="Udvikling pr. Meta-døgn. Brug venstre og højre piletast for at læse værdier."></div><div class="chart-note">Datoerne viser slutpunktet for Metas døgn. Det er ikke en opdeling efter danske kalenderdøgn. Visninger kan omfatte samme person flere gange.</div><div id="mini-stats" class="mini-stats"></div><details class="read-data"><summary>Vis dagsdata som tabel</summary><div class="data-scroll"><table><thead><tr><th>Døgnslut</th><th>Visninger</th><th>Interaktioner</th><th>Følgere</th></tr></thead><tbody id="daily-table"></tbody></table></div></details></div>
<aside class="panel insights"><p class="eyebrow">Hvad tallene fortæller</p><h2 class="section-title">Det er værd at lægge mærke til</h2><div id="insight-trend" class="insight"></div><div id="insight-followers" class="insight"></div><div id="insight-top" class="insight"></div><div id="comparison-note" class="comparison-note" hidden></div></aside></section>
<section class="posts-section"><div class="section-header"><div><h2 class="section-title">Opslagene, ét for ét <span class="scope-badge">Livstidstal</span></h2><p class="section-sub">Alle tal er målt ved hentningen. Ældre opslag har haft længere tid til at samle visninger.</p></div><button class="print-button" id="print">Print / gem PDF</button></div><div class="post-controls"><input id="post-search" type="search" placeholder="Søg i opslagene" aria-label="Søg i opslagene"><select id="post-sort" aria-label="Sortér opslag"><option value="views">Flest visninger</option><option value="reactions">Flest reaktioner</option><option value="shares">Flest delinger</option><option value="createdAt">Nyeste først</option></select><select id="post-scope" aria-label="Vælg opslag"><option value="all">Alle opslag</option><option value="period">Udgivet i valgt periode</option></select></div><div class="posts-heading" aria-hidden="true"><span>#</span><span>Opslag</span><span>Visninger</span><span>Viewers</span><span>Reaktioner</span><span>Komm.</span><span>Delinger</span><span></span></div><div id="posts"></div><button id="show-more" class="show-more"></button><p id="post-count" class="post-count"></p></section>
<section class="next-steps" aria-label="Næste skridt"><article class="action-card"><p class="eyebrow">Indhold</p><h3>Brug topopslagene som emneidéer</h3><p>Se på både visninger og reaktioner. Prøv flere opslag med samme lokale relevans, og sammenlign efter lige mange dage. De nuværende tal viser en forskel, men beviser ikke, hvad der skabte den.</p></article><article class="action-card"><p class="eyebrow">Måling</p><h3>Find ud af, hvad Facebook giver hjemmesiden</h3><p>Udtrækket indeholder ikke trafik eller tilmeldinger på teb-tistrup.dk. Brug sporbare links og hjemmesidens egne tal, hvis I vil vurdere det. Nul klik på sidens kontaktknapper er ikke det samme som nul besøg på hjemmesiden.</p></article></section>
<details class="methods"><summary>Om data og beregninger</summary><div><ul><li>Perioden ovenfor gælder Page-metrics. Sammenligningen bruger det samme antal foregående Meta-døgn.</li><li>Opslagstal er lifetime-tal ved hentningen. Periodens opslagfilter vælger udgivelsesdato, men gør ikke opslagstallene til periodetal.</li><li>Viewers er unikke inden for det enkelte døgn eller opslag. De lægges aldrig sammen til et unikt publikum for hele perioden. Kortet viser gennemsnittet pr. døgn.</li><li>Følgere er en beholdning, ikke noget der summeres hen over dage. Følgninger og afmeldinger opgøres særskilt.</li><li>Opslagsinteraktioner er Metas brede mål for aktivitet ved opslag. Det er ikke det samme som summen af reaktioner, kommentarer og delinger.</li><li>Page-visninger omfatter flere slags indhold. De er ikke summen af de viste opslags lifetime-visninger. Data skelner ikke mellem organisk og betalt eksponering.</li><li>En tankestreg betyder, at API'et ikke leverede tallet. Den erstattes ikke af nul. Den tidlige nulhistorik skjules ved valg af aktiv periode; det er ikke dokumentation for sidens oprettelsesdato.</li><li>Data fortæller ikke, hvor mange klik til hjemmesiden, nye medlemmer eller tilmeldinger Facebook har skabt. Den sammenhæng kræver yderligere måling.</li></ul><p id="coverage"></p><p>Rapporten er en selvstændig lokal HTML-fil. Den henter ikke billeder, skrifttyper, statistik eller andre ressourcer fra nettet. Facebook åbnes kun, når du selv vælger et opslagslink.</p></div></details>
<footer class="footer"><span>TEB · Facebookrapport · <span id="footer-date"></span></span><span>Tal fra Meta via Composio. Ingen løbende forbindelse fra rapporten.</span></footer>
<noscript><p>Rapporten kræver JavaScript for at vise de indlejrede data. Den bruger ingen internetforbindelse.</p></noscript>
</main><script id="report-data" type="application/json">${data}</script><script>(${startReport.toString()})();</script></body></html>`;
}

function startReport() {
  const model = JSON.parse(document.getElementById('report-data').textContent);
  const $ = id => document.getElementById(id);
  const fmt = value => value === null || value === undefined ? '—' : new Intl.NumberFormat('da-DK', {maximumFractionDigits: 0}).format(value);
  const decimal = value => new Intl.NumberFormat('da-DK', {maximumFractionDigits: 1}).format(value);
  const date = (value, long = false) => value ? new Intl.DateTimeFormat('da-DK', {timeZone: 'Europe/Copenhagen', day: 'numeric', month: long ? 'long' : 'short', ...(long ? {year: 'numeric'} : {})}).format(new Date(value)) : '—';
  const element = (tag, className, text) => { const item = document.createElement(tag); if (className) item.className = className; if (text !== undefined) item.textContent = text; return item; };
  let range = model.ranges.find(item => item.id === '28'), showAll = false, metric = 'views', selectedPoint = -1;
  const names = {views: 'visninger', interactions: 'opslagsinteraktioner', followers: 'følgere', viewers: 'viewers', reactions: 'reaktioner'};
  const sortedPosts = key => [...model.posts].sort((a, b) => (b[key] ?? -1) - (a[key] ?? -1) || b.createdAt - a.createdAt);
  $('fetched').textContent = new Intl.DateTimeFormat('da-DK', {timeZone: 'Europe/Copenhagen', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'}).format(new Date(model.fetchedAt));
  $('basis').textContent = model.posts.length + ' opslag';
  $('footer-date').textContent = date(model.fetchedAt, true);
  $('coverage').textContent = 'Udtrækket forespurgte ' + (model.requestedCoverage.since || 'ukendt start') + ' til ' + (model.requestedCoverage.until || 'ukendt slut') + ', slutdato eksklusive. Rapporten indeholder ' + model.summary.snapshotDays + ' målte døgn og ' + model.posts.length + ' publicerede opslag fra det autoriserede API. Første registrerede aktivitet i datasættet har døgnslut ' + date(model.daily[model.activeStart].endTime, true) + '.';
  $('print').addEventListener('click', () => window.print());

  function card(label, value, change, note, bottomText) {
    const item = element('article', 'kpi');
    item.append(element('p', 'kpi-label', label), element('p', 'kpi-number', fmt(value)));
    const bottom = element('div', 'kpi-bottom');
    if (change !== undefined && change !== null) bottom.append(element('span', 'delta' + (change < 0 ? ' down' : ''), (change > 0 ? '+' : '') + decimal(change) + ' %'));
    bottom.append(element('span', '', bottomText));
    item.append(bottom);
    if (note) item.append(element('div', 'kpi-note', note));
    return item;
  }
  function insight(id, title, text) {
    $(id).replaceChildren(element('h3', '', title), element('p', '', text));
  }
  function updateOverview() {
    document.querySelectorAll('[data-range]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.range === range.id)));
    $('period-title').textContent = range.length + ' målte døgn · døgnslut ' + date(range.firstEndTime) + '–' + date(range.lastEndTime);
    const baseline = key => range.previous[key] === null || range.previous[key] === 0 ? 'Intet sammenligningsgrundlag' : 'mod de foregående ' + range.length + ' døgn';
    $('kpis').replaceChildren(
      card('Visninger af sidens indhold', range.totals.views, range.changes.views, 'Visninger er ikke unikke personer.', baseline('views')),
      card('Opslagsinteraktioner', range.totals.interactions, range.changes.interactions, 'Metas brede mål for aktivitet ved opslag.', baseline('interactions')),
      card('Følgere nu', range.followersNow, undefined, null, fmt(range.totals.follows) + ' følgninger · ' + fmt(range.totals.unfollows) + ' afmeldinger i perioden'),
      card('Gns. viewers pr. døgn', range.averageDailyViewers, undefined, 'Ikke et unikt publikum for hele perioden.', 'Gennemsnit af daglige unikke viewers')
    );
    $('mini-stats').replaceChildren();
    for (const [value, label] of [[range.totals.reactions, 'reaktioner'], [range.publicationCount, 'opslag udgivet i perioden'], [range.totals.videos, 'videovisninger over 3 sek.']]) {
      const text = element('span'); text.append(element('strong', '', fmt(value)), document.createTextNode(' ' + label)); $('mini-stats').append(text);
    }
    const delta = range.changes.views;
    const week = model.ranges.find(item => item.id === '7');
    const recent = range.length > 7 && week.changes.views !== null
      ? ' I de seneste 7 målte døgn var ændringen ' + (week.changes.views > 0 ? '+' : '') + decimal(week.changes.views) + ' % mod ugen før.' : '';
    insight('insight-trend', delta === null ? 'Et udgangspunkt for næste sammenligning' : delta >= 0 ? 'Mere indhold bliver set' : 'Færre visninger i denne periode',
      fmt(range.totals.views) + ' visninger' + (delta === null ? ' i perioden.' : ' mod ' + fmt(range.previous.views) + ' i de foregående ' + range.length + ' døgn. Det er ' + decimal(Math.abs(delta)) + ' % ' + (delta >= 0 ? 'flere.' : 'færre.')) + recent);
    insight('insight-followers', 'Følgervæksten er ' + (range.netFollows === null ? 'ikke opgjort' : (range.netFollows > 0 ? '+' : '') + fmt(range.netFollows) + ' i perioden'),
      fmt(range.totals.follows) + ' følgninger og ' + fmt(range.totals.unfollows) + ' afmeldinger. Den foregående periode havde ' + fmt(range.previous.follows) + ' følgninger. Sidens samlede beholdning er nu ' + fmt(range.followersNow) + '.');
    const top = sortedPosts('views').find(post => post.views !== null);
    insight('insight-top', 'Topopslaget har ' + fmt(top?.views ?? null) + ' visninger', top ? '“' + top.headline + '” har ' + fmt(top.viewers) + ' unikke viewers. Det er lifetime-tal, uanset perioden valgt ovenfor.' : 'Ingen opslag med visningstal i udtrækket.');
    $('comparison-note').hidden = !range.comparisonIncludesInitialZeros;
    $('comparison-note').textContent = 'Den forrige periode omfatter dage før den første registrerede aktivitet. Procentændringer er derfor ikke en sammenligning af to fulde aktive perioder.';
    const missing = Object.entries(range.coverage.missing).filter(([, count]) => count > 0);
    $('quality').hidden = missing.length === 0;
    $('quality').textContent = 'Nogle daglige tal mangler i den valgte periode. Berørte totaler vises som —, så manglende data ikke bliver til nul.';
    $('daily-table').replaceChildren(...range.daily.map(row => { const tr = element('tr'); for (const value of [date(row.endTime), fmt(row.views), fmt(row.interactions), fmt(row.followers)]) tr.append(element('td', '', value)); return tr; }));
    selectedPoint = range.daily.length - 1;
    drawChart(); renderPosts();
  }

  function drawChart() {
    const host = $('chart'), width = Math.max(280, host.clientWidth), height = width < 600 ? 270 : 300;
    const margin = {left: 43, right: 12, top: 17, bottom: 35}, plotW = width - margin.left - margin.right, plotH = height - margin.top - margin.bottom;
    const rows = range.daily, numbers = rows.map(row => row[metric]).filter(value => value !== null);
    const ceiling = Math.max(1, ...numbers) * 1.12;
    const x = index => margin.left + (rows.length > 1 ? index / (rows.length - 1) : .5) * plotW;
    const y = value => margin.top + plotH * (1 - value / ceiling);
    const ns = 'http://www.w3.org/2000/svg';
    const svgNode = (name, attributes = {}, text) => { const node = document.createElementNS(ns, name); for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value)); if (text !== undefined) node.textContent = text; return node; };
    const svg = svgNode('svg', {viewBox: '0 0 ' + width + ' ' + height, 'aria-hidden': 'true'});
    const defs = svgNode('defs'), gradient = svgNode('linearGradient', {id: 'area-fill', x1: 0, y1: 0, x2: 0, y2: 1});
    gradient.append(svgNode('stop', {offset: '0%', 'stop-color': '#bfd9bd', 'stop-opacity': '.65'}), svgNode('stop', {offset: '100%', 'stop-color': '#eff5eb', 'stop-opacity': '.12'}));
    defs.append(gradient); svg.append(defs);
    for (let index = 0; index <= 4; index++) {
      const value = ceiling * index / 4, lineY = y(value);
      svg.append(svgNode('line', {x1: margin.left, y1: lineY, x2: width - margin.right, y2: lineY, stroke: '#e7ece3', 'stroke-dasharray': index ? '3 5' : 'none'}));
      svg.append(svgNode('text', {x: margin.left - 9, y: lineY + 4, 'text-anchor': 'end', fill: '#7b897e', 'font-size': 10}, new Intl.NumberFormat('da-DK', {notation: 'compact', maximumFractionDigits: 1}).format(value)));
    }
    const tickCount = width < 420 ? 3 : 5;
    for (let tick = 0; tick < tickCount; tick++) {
      const index = Math.round(tick / (tickCount - 1) * (rows.length - 1));
      svg.append(svgNode('text', {x: x(index), y: height - 8, 'text-anchor': tick === 0 ? 'start' : tick === tickCount - 1 ? 'end' : 'middle', fill: '#7b897e', 'font-size': 10}, date(rows[index].endTime)));
    }
    let segment = [];
    const flush = () => {
      if (!segment.length) return;
      const line = segment.map(([px, py], i) => (i ? 'L' : 'M') + px + ',' + py).join(' ');
      const area = line + ' L' + segment.at(-1)[0] + ',' + y(0) + ' L' + segment[0][0] + ',' + y(0) + ' Z';
      svg.append(svgNode('path', {d: area, fill: 'url(#area-fill)'}), svgNode('path', {d: line, fill: 'none', stroke: '#34714e', 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round'})); segment = [];
    };
    rows.forEach((row, index) => { if (row[metric] === null) flush(); else segment.push([x(index), y(row[metric])]); }); flush();
    const markerLine = svgNode('line', {stroke: '#718b72', 'stroke-dasharray': '3 4', y1: margin.top, y2: y(0)}), marker = svgNode('circle', {r: 4.5, fill: '#1a5e46', stroke: '#fff', 'stroke-width': 2});
    svg.append(markerLine, marker);
    function select(index) {
      selectedPoint = Math.max(0, Math.min(rows.length - 1, index));
      const row = rows[selectedPoint], value = row[metric];
      markerLine.setAttribute('x1', x(selectedPoint)); markerLine.setAttribute('x2', x(selectedPoint));
      marker.setAttribute('cx', x(selectedPoint)); marker.setAttribute('cy', y(value ?? 0)); marker.style.display = value === null ? 'none' : '';
      $('chart-readout').replaceChildren(document.createTextNode('Døgnslut ' + date(row.endTime)), element('strong', '', fmt(value) + ' ' + names[metric]));
      $('chart-readout').title = 'Kildens end_time: ' + row.endTime;
      host.setAttribute('aria-label', 'Døgnslut ' + date(row.endTime, true) + ': ' + fmt(value) + ' ' + names[metric] + '. Brug piletaster for flere dage.');
    }
    svg.addEventListener('pointermove', event => { const box = svg.getBoundingClientRect(); select(Math.round((((event.clientX - box.left) / box.width * width) - margin.left) / plotW * (rows.length - 1))); });
    host.onkeydown = event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); select(selectedPoint + (event.key === 'ArrowLeft' ? -1 : 1)); } };
    host.replaceChildren(svg); select(selectedPoint < 0 ? rows.length - 1 : selectedPoint);
  }

  function renderPosts() {
    const search = $('post-search').value.normalize('NFKC').toLocaleLowerCase('da-DK'), sort = $('post-sort').value;
    const inPeriod = $('post-scope').value === 'period', firstIndex = model.daily.length - range.length;
    const start = model.daily[firstIndex - 1]?.time ?? range.daily[0].time - 86400000, end = range.daily.at(-1).time;
    const posts = sortedPosts(sort).filter(post => (!inPeriod || (post.createdAt >= start && post.createdAt < end))
      && (post.message + post.headline).normalize('NFKC').toLocaleLowerCase('da-DK').includes(search));
    const visible = showAll ? posts : posts.slice(0, 10), maximum = Math.max(1, ...posts.map(post => post.views ?? 0));
    $('posts').replaceChildren();
    for (const [index, post] of visible.entries()) {
      const item = element('details', 'post'), summary = element('summary', 'post-summary');
      const main = element('span', 'post-main'), title = element('span', 'post-title', post.headline), bar = element('span', 'post-bar'), fill = element('span', 'post-bar-fill');
      fill.style.width = ((post.views ?? 0) / maximum * 100) + '%'; bar.append(fill); bar.setAttribute('aria-hidden', 'true');
      main.append(title, element('span', 'post-date', date(post.createdTime, true)), bar);
      summary.append(element('span', 'post-rank', String(index + 1).padStart(2, '0')), main);
      for (const [key, label] of [['views', 'Visninger'], ['viewers', 'Viewers'], ['reactions', 'Reaktioner'], ['comments', 'Kommentarer'], ['shares', 'Delinger']]) {
        const value = element('span', 'post-value' + (key === 'views' ? ' primary' : ''), fmt(post[key]));
        value.append(element('span', 'mobile-label', label)); summary.append(value);
      }
      const toggle = element('span', 'post-toggle', '›'); toggle.setAttribute('aria-hidden', 'true'); summary.append(toggle);
      summary.setAttribute('aria-label', post.headline + ', ' + fmt(post.views) + ' visninger. Åbn for hele teksten og flere tal.');
      const body = element('div', 'post-body'); body.append(element('p', '', post.message || 'Dette opslag har ingen tekst i udtrækket.'));
      body.append(element('p', '', 'Livstidstal: ' + fmt(post.reactions) + ' reaktioner · ' + fmt(post.comments) + ' kommentarer · ' + fmt(post.shares) + ' delinger. — betyder, at API’et ikke leverede tallet.'));
      if (post.url) { const link = element('a', '', 'Åbn opslaget på Facebook ↗'); link.href = post.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; body.append(link); }
      item.append(summary, body); $('posts').append(item);
    }
    if (!posts.length) $('posts').append(element('div', 'empty', 'Ingen opslag matcher søgningen eller perioden.'));
    $('show-more').hidden = posts.length <= 10;
    $('show-more').textContent = showAll ? 'Vis de 10 øverste' : 'Vis alle ' + posts.length + ' opslag';
    $('post-count').textContent = visible.length + ' af ' + posts.length + ' opslag vist. ' + (inPeriod ? 'Udgivelsesdato følger den valgte periode. ' : 'Alle opslagsdatoer er med. ') + 'Visninger og viewers er lifetime-tal ved hentningen.';
  }

  document.querySelectorAll('[data-range]').forEach(button => button.addEventListener('click', () => { range = model.ranges.find(item => item.id === button.dataset.range); updateOverview(); }));
  $('chart-metric').addEventListener('change', event => { metric = event.target.value; drawChart(); });
  $('post-search').addEventListener('input', () => { showAll = false; renderPosts(); });
  $('post-sort').addEventListener('change', renderPosts);
  $('post-scope').addEventListener('change', () => { showAll = false; renderPosts(); });
  $('show-more').addEventListener('click', () => { showAll = !showAll; renderPosts(); });
  let previousWidth = 0;
  new ResizeObserver(() => { const width = $('chart').clientWidth; if (Math.abs(width - previousWidth) > 1) { previousWidth = width; drawChart(); } }).observe($('chart'));
  updateOverview();
}
