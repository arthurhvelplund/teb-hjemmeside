# Fælles sideramme og sæsontema

Alle hjemmesidens 15 indholdssider bruger samme sideramme. HTML-filerne i
`site/` er færdige statiske sider. Browseren behøver ikke hente header eller
footer bagefter, og indholdet virker uden en separat frontendserver.

## Kilderne

- `scripts/site-layout/header.html` og `footer.html`: fælles header og footer.
- `scripts/site-layout/config.mjs`: navigation, aktive undersider og temadatoer.
- `scripts/site-layout/seasonal-controller.js`: temastart, udløb og udsmykning.
- `scripts/site-layout/*_decor.html`: de fælles figurer.
- `site/css/layout.css`: fælles overskriftslayout.
- `site/css/seasonal-themes.css`: temaets fælles baggrund og placering.
- `site/images/seasonal/`: temaets billeder, genbrugt af alle sider.

Redigér disse kilder, ikke den genererede `site/js/seasonal-theme.js`.
Sideindhold, formularer og sidespecifik funktionalitet bliver i deres egne filer.
Temaet kender ingen bestemte sidenavne, portal-klasser eller kalenderfunktioner.

## Opdatering

```sh
node scripts/sync-site.mjs
node scripts/sync-site.mjs --check
node scripts/site-layout-check.mjs
```

Generatoren opdaterer fælles header/footer, sideklasser og CSS/JS-versioner.
Versionerne beregnes fra filindholdet. Man skal ikke længere huske forskellige
datonumre på hver side. `--check` afviser forældede sider uden at ændre dem.
Den lokale `npm run dev` forbereder filerne automatisk ved opstart.
Det gamle `sync-navigation.mjs` kalder samme generator.

## En ny side

Brug denne grundstruktur og kør generatoren:

```html
<!doctype html>
<html lang="da">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sidens titel | TEB</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <header class="site-header"></header>
  <main>
    <section class="hero">
      <div class="wrap page-heading"><h1>Sidens titel</h1></div>
    </section>
    <section class="section"><div class="wrap">Sidens indhold</div></section>
  </main>
  <footer class="site-footer"></footer>
  <script src="js/main.js"></script>
</body>
</html>
```

Der skal ikke kopieres navigation, temakode eller udsmykning fra en anden side.
Sider med billedkolonne bruger den eksisterende `.hero-grid` i overskriften.
Forsidens `.hero-full` får automatisk den store udsmykning. Øvrige overskrifter
får samme fælles ramme med plads til figurer og indhold.

## Kontrol

```sh
node scripts/site-layout-browser-check.mjs
node scripts/mailbox-content-check.mjs
cd calendar-worker
npm run test:browser
npm run test:integration
```

Kontrollen starter midlertidige lokale servere og rydder dem op igen. Den
gennemgår alle indholdssider ved 1440, 390 og 320 px, kontrollerer manglende
assets, overliggende pynt og forældede temafiler. Den prøver også datoerne
før/efter Halloween, udløb mens siden er åben og gentagen indlæsning af temaet.
Postkassekontrollen prøver klikbare links, fejl/genforsøg, automatiske
opdateringer, fokus og bevarede gamle mails. Portalens loginforløb henter
engangskoden gennem den faktiske postkasseside.

Testworkflowet og deploymentworkflowet afviser forældede fælles filer.
Dette arbejde aktiverer ikke deployment eller rigtig mail.
