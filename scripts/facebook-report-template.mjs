const escape = value => String(value).replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));

export function renderFacebookReport(model) {
  const data = JSON.stringify(model).replace(/[<>&\u2028\u2029]/g, character => '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0'));
  return `<!doctype html>
<html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'">
<title>Facebookrapport · ${escape(model.page.name)}</title>
<style>
:root{font-family:Arial,Helvetica,sans-serif;color:#17392e;background:#f4f6f2;color-scheme:light;--ink:#17392e;--muted:#66736b;--green:#226649;--line:#dce3d9}*{box-sizing:border-box}body{margin:0}button,input,select{font:inherit;color:inherit}button,select,summary{cursor:pointer}button,input,select{min-height:34px;border:1px solid var(--line);border-radius:6px;background:#fff;padding:6px 10px;font-size:12px}button:hover,summary:hover{background:#eff4ec}button:focus-visible,select:focus-visible,input:focus-visible,summary:focus-visible,a:focus-visible,[tabindex]:focus-visible{outline:3px solid #bd8b3d;outline-offset:2px}a{color:var(--green)}.wrap{max-width:1460px;margin:auto;padding:0 28px}.skip{position:absolute;top:-80px;left:16px;background:#fff;padding:12px;z-index:3}.skip:focus{top:8px}.top{background:var(--ink);color:#fff}.top-inner{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:52px}.brand{display:flex;align-items:center;gap:12px}.monogram{font-size:14px;font-weight:700;border:1px solid #769588;border-radius:5px;padding:6px}.brand h1{font-size:16px;margin:0;font-weight:600;letter-spacing:-.2px}.brand small{color:#b7cabe;font-size:11px;margin-left:9px}.report-meta{font-size:11px;color:#b7cabe;white-space:nowrap}.report-meta strong{font-weight:400;color:#fff}.toolbar{min-height:56px;display:flex;align-items:center;justify-content:space-between;gap:12px}.periods{display:flex;gap:3px}.periods button{background:transparent;border-color:transparent;min-width:67px}.periods button[aria-pressed=true]{background:var(--green);color:#fff}.period-title{font-size:11px;color:var(--muted);margin:0}.takeaway{display:flex;justify-content:space-between;align-items:baseline;gap:15px;margin:0 0 12px;min-height:29px}.takeaway h2{font-size:19px;line-height:1.3;margin:0;letter-spacing:-.4px;font-weight:600}.takeaway p{font-size:11px;line-height:1.5;margin:0;color:var(--muted);text-align:right}
.kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));background:#fff;border:1px solid var(--line);border-radius:9px;margin-bottom:12px;overflow:hidden}.kpi{padding:14px 17px;border-right:1px solid var(--line);min-width:0}.kpi:last-child{border:0}.kpi-label{font-size:11px;color:var(--muted);margin:0 0 7px;white-space:nowrap}.kpi-number{font-size:31px;font-weight:600;letter-spacing:-1px;line-height:1;margin:0 0 8px;font-variant-numeric:tabular-nums}.kpi-bottom{font-size:10px;color:var(--muted);display:flex;gap:5px;align-items:center;flex-wrap:wrap;line-height:1.4}.delta{color:#21613f;font-weight:700}.delta.down{color:#9a5b1a}.kpi-note{display:none}.main-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;margin-bottom:12px}.panel{background:#fff;border:1px solid var(--line);border-radius:9px;overflow:hidden;min-width:0}.panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 15px 0}.section-title{font-size:13px;font-weight:600;margin:0}.chart-panel{padding-bottom:11px}.chart-panel select{min-height:28px;font-size:10px;padding:4px 7px}.chart-readout{font-size:10px;color:var(--muted);height:24px;line-height:24px;padding:0 15px}.chart-readout strong{color:var(--ink);margin-left:7px}.chart{margin:0 9px;width:calc(100% - 18px);position:relative}.chart svg{width:100%;height:auto;display:block}.mini-stats{display:flex;gap:15px;flex-wrap:wrap;font-size:10px;color:var(--muted);padding:9px 15px 0;border-top:1px solid #eef1eb;margin-top:3px}.mini-stats strong{color:var(--ink)}
.leaders .panel-head{padding-bottom:10px}.leader-heading,.leader-summary{display:grid;grid-template-columns:18px minmax(0,1fr) 65px 47px 42px;gap:9px;align-items:center}.leader-heading{font-size:9px;color:var(--muted);padding:0 15px 5px}.leader-heading span:nth-child(n+3){text-align:right}.leader{border-top:1px solid #eef1eb}.leader-summary{padding:8px 15px;min-height:43px;list-style:none;cursor:pointer}.leader-summary::-webkit-details-marker{display:none}.leader-rank{font-size:10px;color:#819085}.leader-name{min-width:0}.leader-title{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px;font-weight:500;line-height:1.4}.leader-date{display:block;font-size:9px;color:var(--muted);line-height:1.3}.leader-value{text-align:right;font-size:12px;font-variant-numeric:tabular-nums}.leader-value.primary{font-weight:700}.leader .post-body{padding:0 15px 10px 42px}.leader .post-body p{font-size:11px;line-height:1.55}.scope-badge{font-size:9px;color:var(--muted);font-weight:400}
.signal-row{display:grid;grid-template-columns:1fr 1fr 1.3fr;border:1px solid var(--line);border-radius:8px;background:#eaf0e6;margin-bottom:12px}.signal{padding:11px 15px;border-right:1px solid #d4dfce;min-width:0}.signal:last-child{border:0}.signal h3{font-size:10px;color:#65745c;font-weight:400;margin:0 0 5px}.signal p{font-size:12px;line-height:1.4;margin:0}.signal strong{font-weight:700}.signal .caption{display:block;font-size:10px;color:var(--muted);margin-top:3px}
.disclosure{background:#fff;border:1px solid var(--line);border-radius:8px;margin-bottom:8px;overflow:hidden}.disclosure>summary{font-size:12px;font-weight:600;padding:11px 14px;list-style-position:inside}.disclosure>summary span{font-size:10px;font-weight:400;color:var(--muted);margin-left:8px}.disclosure-content{border-top:1px solid var(--line);padding:12px 14px}.details-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.details-row>.disclosure{align-self:start}.post-controls{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}.post-controls input{width:270px}.post-controls select{font-size:11px}.posts-heading,.post-summary{display:grid;grid-template-columns:24px minmax(160px,1fr) 74px 74px 67px 60px 55px 16px;gap:9px;align-items:center}.posts-heading{font-size:10px;color:var(--muted);padding:7px 10px}.posts-heading span:nth-child(n+3){text-align:right}.post{border-top:1px solid #e7ece3}.post-summary{padding:10px;list-style:none;cursor:pointer}.post-summary::-webkit-details-marker{display:none}.post-rank{font-size:10px;color:var(--muted)}.post-title{font-size:12px;line-height:1.4;font-weight:500;display:block}.post-date{display:block;font-size:10px;color:var(--muted);margin-top:3px}.post-bar{display:none}.post-value{font-size:12px;text-align:right;font-variant-numeric:tabular-nums}.post-value.primary{font-weight:700}.mobile-label{display:none}.post-toggle{font-size:16px;color:var(--muted);text-align:center}.post[open] .post-toggle{transform:rotate(90deg)}.post-body{padding:0 20px 15px 43px}.post-body p{white-space:pre-wrap;font-size:12px;line-height:1.6;margin:10px 0;overflow-wrap:anywhere}.post-body a{font-size:11px;padding:8px 0;display:inline-block}.post-count{font-size:10px;color:var(--muted);margin:9px 0 0}.show-more{display:block;margin:10px auto}.empty{font-size:12px;padding:16px;color:var(--muted)}.data-scroll{overflow:auto;max-height:260px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{padding:7px;border-bottom:1px solid var(--line);text-align:right;font-variant-numeric:tabular-nums}th:first-child,td:first-child{text-align:left}th{position:sticky;top:0;background:#fff;font-weight:500}.methods{font-size:11px;line-height:1.6;color:var(--muted)}.methods ul{margin:0;padding-left:16px}.methods p:last-child{margin-bottom:0}.quality,.comparison-note{font-size:11px;line-height:1.4;background:#f9efd9;border:1px solid #e2cfa5;border-radius:6px;padding:8px 12px;margin-bottom:9px}.footer{display:flex;justify-content:space-between;gap:15px;font-size:10px;color:var(--muted);padding:3px 0 17px}.footer button{padding:0;border:0;background:none;font-size:10px;min-height:20px;text-decoration:underline}
@media(max-width:1100px){.wrap{padding:0 20px}.brand small{display:none}.kpi{padding:13px 12px}.kpi-label{font-size:10px}.kpi-number{font-size:28px}.takeaway{display:block}.takeaway p{text-align:left;margin-top:5px}.leader-heading,.leader-summary{grid-template-columns:16px minmax(0,1fr) 55px 40px 35px;gap:6px}.signal p{font-size:11px}}
@media(max-width:760px){.wrap{padding:0 15px}.top-inner{min-height:49px}.brand h1{font-size:14px}.report-meta{font-size:10px}.private-label{display:none}.kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.kpi:nth-child(3){border-right:0}.kpi:nth-child(-n+3){border-bottom:1px solid var(--line)}.main-grid{grid-template-columns:1fr}.chart-panel{order:2}.leaders{order:1}.takeaway h2{font-size:17px}.takeaway p{font-size:10px}.toolbar{flex-wrap:wrap;padding:9px 0;gap:6px}.periods button{min-height:36px;min-width:0;padding:7px 10px;font-size:11px}.period-title{font-size:10px}.signal-row{grid-template-columns:1fr 1fr}.signal:last-child{grid-column:1/-1;border-top:1px solid #d4dfce}.signal:nth-child(2){border-right:0}.signal{padding:10px 12px}.details-row{display:block}.posts-heading{display:none}.post-summary{grid-template-columns:20px minmax(0,1fr) 57px 46px 16px;gap:6px;padding:11px 0}.post-value:nth-of-type(4),.post-value:nth-of-type(6),.post-value:nth-of-type(7){display:none}.post-title{font-size:11px}.post-value{font-size:11px}.mobile-label{display:block;font-size:8px;color:var(--muted);margin-top:3px}.post-controls input{width:100%}.post-controls select{flex:1;min-width:0}.post-body{padding:0 10px 12px 26px}.disclosure>summary{font-size:11px;padding:11px}.disclosure>summary span{font-size:9px}.footer{font-size:9px}.leader-title{font-size:11px}}
@media(max-width:390px){.wrap{padding:0 10px}.brand{gap:8px}.brand h1{font-size:13px}.report-meta{font-size:9px}.kpi{padding:11px 9px}.kpi-label{font-size:9px}.kpi-number{font-size:27px}.kpi-bottom{font-size:9px}.leader-heading,.leader-summary{grid-template-columns:13px minmax(0,1fr) 46px 29px 25px;gap:5px;padding-left:10px;padding-right:10px}.leader-title{font-size:10px}.leader-value{font-size:11px}.leader-heading{font-size:8px}.panel-head{padding:11px 10px 0}.takeaway h2{font-size:16px}.signal{padding:9px 10px}}
@media print{body{background:#fff}.wrap{padding:0}.top{background:#fff;color:var(--ink);border-bottom:1px solid var(--line)}.report-meta,.report-meta strong{color:var(--muted)}.toolbar button,.post-controls,.show-more,.footer button{display:none}.toolbar{min-height:35px}.kpis{grid-template-columns:repeat(6,minmax(0,1fr))}.main-grid{grid-template-columns:1fr 1fr}.panel,.signal-row,.kpis{break-inside:avoid}.details-row{display:block}.disclosure:not([open]){display:none}.leader-summary,.post-summary{break-inside:avoid}.post-body{display:none}.brand small{display:none}}
</style></head><body>
<a href="#main" class="skip">Gå til rapporten</a>
<header class="top"><div class="wrap top-inner"><div class="brand"><span class="monogram">TEB</span><h1>Facebookoverblik <small>${escape(model.page.name)}</small></h1></div><div class="report-meta"><span class="private-label">Privat · </span>Hentet <strong id="fetched"></strong></div></div></header>
<main id="main" class="wrap">
<div class="toolbar"><div class="periods" role="group" aria-label="Vælg periode"><button data-range="7" aria-pressed="false">7 døgn</button><button data-range="28" aria-pressed="true">28 døgn</button><button data-range="90" aria-pressed="false">90 døgn</button><button data-range="all" aria-pressed="false">Aktiv periode</button></div><p id="period-title" class="period-title"></p></div>
<section class="takeaway"><h2 id="takeaway"></h2><p>Ændringer mod foregående periode med samme længde.</p></section>
<div id="quality" class="quality" hidden></div><div id="comparison-note" class="comparison-note" hidden></div>
<section id="kpis" class="kpis" aria-label="Sidens nøgletal"></section>
<section class="signal-row" aria-label="Det vigtigste at tage med"><article id="signal-week" class="signal"></article><article id="signal-followers" class="signal"></article><article id="signal-content" class="signal"></article></section>
<section class="main-grid">
<div class="panel chart-panel"><div class="panel-head"><h2 class="section-title">Daglig udvikling</h2><select id="chart-metric" aria-label="Vælg tal i grafen"><option value="views">Visninger</option><option value="interactions">Opslagsinteraktioner</option><option value="followers">Følgere</option><option value="viewers">Daglige unikke viewers</option><option value="reactions">Reaktioner</option></select></div><div id="chart-readout" class="chart-readout" aria-live="polite"></div><div id="chart" class="chart" tabindex="0" role="img" aria-label="Udvikling pr. Meta-døgn. Brug piletasterne for værdier."></div><div id="mini-stats" class="mini-stats"></div></div>
<div class="panel leaders"><div class="panel-head"><h2 class="section-title">Top 5 opslag</h2><span class="scope-badge">Livstid · alle opslagsdatoer</span></div><div class="leader-heading" aria-hidden="true"><span>#</span><span>Opslag · klik for tekst</span><span>Visninger</span><span>Reakt.</span><span>Del.</span></div><div id="leaders"></div></div>
</section>
<details id="all-posts" class="disclosure"><summary>Alle opslag <span id="basis"></span></summary><section class="disclosure-content"><div class="post-controls"><input id="post-search" type="search" placeholder="Søg i opslagene" aria-label="Søg i opslagene"><select id="post-sort" aria-label="Sortér opslag"><option value="views">Flest visninger</option><option value="reactions">Flest reaktioner</option><option value="shares">Flest delinger</option><option value="createdAt">Nyeste først</option></select><select id="post-scope" aria-label="Vælg opslag"><option value="all">Alle opslag</option><option value="period">Udgivet i valgt periode</option></select></div><div class="posts-heading" aria-hidden="true"><span>#</span><span>Opslag</span><span>Visninger</span><span>Viewers</span><span>Reaktioner</span><span>Komm.</span><span>Delinger</span><span></span></div><div id="posts"></div><button id="show-more" class="show-more"></button><p id="post-count" class="post-count"></p></section></details>
<div class="details-row"><details class="disclosure"><summary>Dagsdata <span>Metas døgnslut</span></summary><div class="disclosure-content data-scroll"><table><thead><tr><th>Døgnslut</th><th>Visninger</th><th>Interaktioner</th><th>Følgere</th></tr></thead><tbody id="daily-table"></tbody></table></div></details>
<details class="disclosure methods"><summary>Om tallene <span>Definitioner og datagrundlag</span></summary><div class="disclosure-content"><ul><li>Page-tal gælder valgt periode. Ændringer sammenligner med lige mange foregående Meta-døgn. Datoerne er døgnslut, ikke danske kalenderdøgn.</li><li>Opslagstal er lifetime-tal ved hentningen. Ældre opslag har haft længere tid til at samle visninger. Opslagsfilteret gælder udgivelsesdato.</li><li>Visninger kan tælle samme person flere gange. Unikke viewers summeres ikke på tværs af døgn eller opslag. Kortet viser gennemsnit pr. døgn.</li><li>Følgere er beholdningen ved hentningen. Følgninger og afmeldinger er separate periodetal.</li><li>Opslagsinteraktioner er Metas brede aktivitetsmål, ikke kun reaktioner, kommentarer og delinger.</li><li>Page-visninger er ikke summen af de viste opslags lifetime-visninger. Udtrækket skelner ikke mellem organisk og betalt eksponering.</li><li>En tankestreg betyder manglende data. Tidlige nulværdier beviser ikke, hvornår siden blev oprettet.</li><li>Data viser ikke hjemmesidetrafik, tilmeldinger eller nye medlemmer. Nul kontaktklik er ikke dokumentation for nul hjemmesidebesøg.</li></ul><p id="coverage"></p><p>Selvstændig lokal fil. Ingen eksterne ressourcer eller løbende netværkskald.</p></div></details></div>
<footer class="footer"><span>Meta via Composio · <span id="footer-date"></span> · Privat, kan åbnes offline</span><button id="print">Print / gem PDF</button></footer>
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
  function signal(id, title, value, caption) {
    $(id).replaceChildren(element('h3', '', title), element('p', '', value), element('span', 'caption', caption));
  }
  function updateOverview() {
    document.querySelectorAll('[data-range]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.range === range.id)));
    $('period-title').textContent = range.length + ' målte døgn · døgnslut ' + date(range.firstEndTime) + '–' + date(range.lastEndTime);
    const before = key => range.previous[key] === null ? 'Ingen sammenligning' : 'før ' + fmt(range.previous[key]);
    $('kpis').replaceChildren(
      card('Visninger', range.totals.views, range.changes.views, null, before('views')),
      card('Interaktioner', range.totals.interactions, range.changes.interactions, null, before('interactions')),
      card('Følgere nu', range.followersNow, undefined, null, (range.netFollows > 0 ? '+' : '') + fmt(range.netFollows) + ' netto i perioden'),
      card('Viewers / døgn', range.averageDailyViewers, undefined, null, 'unikke, gennemsnit'),
      card('Reaktioner', range.totals.reactions, range.changes.reactions, null, before('reactions')),
      card('Udgivne opslag', range.publicationCount, undefined, null, model.posts.length + ' i hele udtrækket')
    );
    $('mini-stats').replaceChildren();
    for (const [value, label] of [[range.totals.videos, 'videovisninger > 3 sek.']]) {
      const text = element('span'); text.append(element('strong', '', fmt(value)), document.createTextNode(' ' + label)); $('mini-stats').append(text);
    }
    const delta = range.changes.views;
    const week = model.ranges.find(item => item.id === '7');
    $('takeaway').textContent = delta === null ? 'Sidens aktivitet i den valgte periode'
      : delta >= 0 && range.length > 7 && week.changes.views < 0 ? 'Flere visninger i perioden. Lavere tempo den seneste uge.'
      : delta >= 0 ? 'Flere visninger end i den foregående periode.' : 'Færre visninger end i den foregående periode.';
    const weekChange = week.changes.views === null ? 'uden sammenligning' : (week.changes.views > 0 ? '+' : '') + decimal(week.changes.views) + ' % mod ' + (week.length === 7 ? 'ugen før' : 'foregående periode');
    signal('signal-week', 'Seneste ' + week.length + ' målte døgn', fmt(week.totals.views) + ' visninger · ' + weekChange,
      fmt(week.totals.follows) + ' følgninger · ' + fmt(week.totals.unfollows) + ' afmeldinger');
    signal('signal-followers', 'Tilgang af følgere i valgt periode', fmt(range.totals.follows) + ' nye mod ' + fmt(range.previous.follows) + ' i forrige periode',
      fmt(range.totals.unfollows) + ' afmeldinger i perioden');
    const topReaction = sortedPosts('reactions').find(post => post.reactions !== null);
    signal('signal-content', 'Flest reaktioner · livstid', topReaction ? fmt(topReaction.reactions) + ' reaktioner · ' + topReaction.headline : 'Ingen reaktionstal',
      'Ældre opslag har haft længere tid til at samle aktivitet.');
    $('comparison-note').hidden = !range.comparisonIncludesInitialZeros;
    $('comparison-note').textContent = 'Den forrige periode omfatter dage før den første registrerede aktivitet. Procentændringer er derfor ikke en sammenligning af to fulde aktive perioder.';
    const missing = Object.entries(range.coverage.missing).filter(([, count]) => count > 0);
    $('quality').hidden = missing.length === 0;
    $('quality').textContent = 'Nogle daglige tal mangler i den valgte periode. Berørte totaler vises som —, så manglende data ikke bliver til nul.';
    $('daily-table').replaceChildren(...range.daily.map(row => { const tr = element('tr'); for (const value of [date(row.endTime), fmt(row.views), fmt(row.interactions), fmt(row.followers)]) tr.append(element('td', '', value)); return tr; }));
    selectedPoint = range.daily.length - 1;
    drawChart(); renderLeaders(); renderPosts();
  }

  function renderLeaders() {
    $('leaders').replaceChildren();
    const leaders = sortedPosts('views').slice(0, 5);
    for (const [index, post] of leaders.entries()) {
      const item = element('details', 'leader'), summary = element('summary', 'leader-summary');
      const name = element('span', 'leader-name'), title = element('span', 'leader-title', post.headline);
      title.title = post.headline;
      name.append(title, element('span', 'leader-date', date(post.createdTime)));
      summary.append(element('span', 'leader-rank', String(index + 1).padStart(2, '0')), name);
      for (const key of ['views', 'reactions', 'shares']) summary.append(element('span', 'leader-value' + (key === 'views' ? ' primary' : ''), fmt(post[key])));
      summary.setAttribute('aria-label', post.headline + ', ' + fmt(post.views) + ' lifetime-visninger. Åbn opslagsteksten.');
      const body = element('div', 'post-body');
      body.append(element('p', '', post.message || 'Opslag uden tekst.'), element('p', '', fmt(post.viewers) + ' unikke viewers · ' + fmt(post.comments) + ' kommentarer. Lifetime-tal.'));
      if (post.url) { const link = element('a', '', 'Åbn på Facebook ↗'); link.href = post.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; body.append(link); }
      item.append(summary, body); $('leaders').append(item);
    }
    if (!leaders.length) $('leaders').append(element('p', 'empty', 'Ingen opslag i udtrækket.'));
  }

  function drawChart() {
    const host = $('chart'), width = Math.max(260, host.clientWidth), height = 175;
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
