# Drift af Forening og Kalender

## Arbejdsform nu

Brugeren har valgt lokalt preview. Ingen Cloudflare-provisionering, deploy,
DNS-ændring eller eksterne mails skal ske som del af denne implementering.
Produktion aktiveres senere. Hjemmesidens eksisterende design og eventuelle
sæsonudsmykning bevares. `/admin/` og `/api/formular` tilhører de eksisterende
systemer og er ikke portalens arbejdsområde eller backend.

Den selvstændige prototype er bevaret i `output/foreningsportal-enkel/` som
reference. Den integrerede løsning ligger i `site/` og `calendar-worker/`.
Der er ingen fast prøvekode eller browserbaseret rolleomskifter i løsningen.

## Lokalt preview

Se `calendar-worker/README.md` for aktuelle kommandoer. Den lokale server
serverer hele `site/`, API, SQLite og lokal fillagring til PDF-udgaver.
Brug en separat datamappe til previewet, så den oprindelige pilots database
i `tmp/kalender-pilot/` bevares. Seed opretter kun eksplicitte eksempeldata.

Kalendermailen `tistrup.kalender@gmail.com` er foreløbig TEB-administrator
lokalt. Login skal stadig ske med en tilfældigt genereret engangskode.
Koden lander i den lokale testpostkasse, ikke på Gmail. Konti og forenings-
rettigheder kontrolleres af serveren og gemmes i den lokale database.

## Før senere deployment

1. Bekræft TEBs rigtige Cloudflare-konto, domæneadgang og afsenderdomæne.
   Globalt Wrangler-login var senest Pages-begrænset på Business and Fitness,
   og den projektspecifikke token gav 9109 Invalid access token. Ingen af dem
   må uden ny kontrol antages at have produktionsadgang.
2. Opret staging med egen D1-database, eget PDF-lager og korrekt PUBLIC_ORIGIN.
   Udelad LOCAL_PREVIEW. Staging må ikke bruge eller eksportere lokal postkasse.
3. Verificér mailafsender og begræns test til aftalte modtagere. Test modtagelse
   af kode, invitation, kvittering og TEB-notifikation i modtagernes postkasser.
   En accepteret afsendelse fra mailtjenesten er ikke bevis på levering.
4. Vælg de første TEB-administratorer. Brug serverens eksplicitte konfiguration;
   en offentlig formandsmail eller en ny loginadresse giver aldrig TEB-rolle.
5. Opret et gennemgået foreningsregister. Importér ikke eksempelpersoner,
   testarrangementer, lokale login-koder eller gæsternes private links.
6. Test det fulde forløb med få aftalte foreninger før offentlig lancering.

## Integration på hoveddomænet

Behold Cloudflare Pages til hjemmesiden. Portal-Workeren skal kun tage
`teb-tistrup.dk/api/kalender/*`. Bevar eksisterende `/api/formular*`, CMS,
forside og øvrige sider. Ingen ny Worker-route på hele domænet.

PDF-skrifter skal være tilgængelige for Workerens PDF-motor. Udgivne PDF-filer
gemmes som filer i PDF-lageret; genberegn dem ikke ved hver download efter
senere layoutændringer. D1 gemmer metadata, frist og indholdskopi.

Staging og produktion skal bruge forskellige ressourcer. Produktion må ikke
få pilotens globale noindex-header eller redirect af forsiden til kalenderen.
Private konti og API-svar må ikke caches offentligt. Offentlige profiler og
arrangementsdetaljer skal have brugbare titler og delbare links.

## Udgivelse og tilbagerulning

Den samlede browsertest findes i `scripts/portal-browser-check.mjs` og kan køres
fra projektroden med `node scripts/portal-browser-check.mjs`, efter backendens
afhængigheder er installeret. Den starter sin egen server på port 8794 med
en midlertidig database og rydder server og testdata op igen. Den bruger Chrome
på macOS eller Playwrights Chromium på Linux. Resultater ligger i
`output/portal-integreret/`. Den bruger kun lokal testmail.

Kør backendtest, browsertest og Cloudflare dry-run før en udgivelse. Workflowet
`portal-checks.yml` validerer ændringer uden at deploye. Det eksisterende Pages-
workflow publicerer fra main; merge derfor først, når backend og konfiguration
er klar, og udgivelsesomfanget er aftalt.

Før databaseændringer tages en eksport/backup. Migreringer skal være kompatible
med eksisterende poster. Test en gendannelse af databasen og PDF-lageret.
Kode kan rulles tilbage til forrige Worker/Pages-version; det må ikke slette
indsendelser eller nye foreningsoplysninger. En databasegendannelse skal
vurderes særskilt, fordi den kan fjerne ændringer modtaget efter backupen.

## Løbende opgaver for TEB

- Gennemse gæsteindsendelser og anmodninger om foreningsadgang.
- Hjælp med skifte af ansvarlig, og fjern adgang ved behov.
- Vælg printperiode og frist, gennemse PDF og udgiv udgaven.
- Vedligehold links og kontakter til omdeling, byportaler og infoskærme.
- Hold øje med fejl i mailafsendelse og ubehandlede indsendelser.

Der bygges ikke automatisk Gmail-import, opslag hos medier eller Facebook-
publicering. Det sker viser kalenderen, lokale opslag og importerede kort fra
Tistrup Nyt og Pulsen i Vest. TEBs eget Facebook-feed ligger på forsiden.

## Kontrol af den integrerede lokale version

Valideret 19. oktober 2026: 67 backendtests, HTTP-integration, lokal
Cloudflare-runtime med D1/R2, 28 portalforløb og 7 Det sker-forløb. Den nye
pilotopsætning er desuden afprøvet to gange uden dubletter, ekstra invitationer
eller fiktive offentlige arrangementer. Browserkontrollen omfatter
faktiske kvitteringslinks, genforsøg efter mistede, afkortede og ufuldstændige
svar uden dubletter, rettigheder,
forhåndsvisning og gemt PDF samt 320 og 390 px mobilbredde. Plakat og A3 er
gennemset visuelt, også med 45 arrangementer fordelt over flere sider.

Ubrugte scripts og CSS fra den gamle pilot er fjernet. De gamle HTML-adresser
bevares som viderestillinger. Prototypen og pilotens lokale data er bevaret.

Resultater og skærmbilleder findes lokalt i `output/portal-integreret/`.
I denne færdiggørelsesrunde er der ikke sendt eksterne mails, pushet commits
eller deployet ressourcer. Lokal gennemgang og pilot med rigtige foreninger
afventer. Se `PILOT_KLAR.md` for den samlede kodeplacering og gennemgangen.

## Fælles sideramme

Header, footer, navigation, overskriftslayout og sæsontema vedligeholdes
centralt. Se [kilder, ny side og kontroller](SHARED_SITE_LAYOUT.md).
Den lokale server forbereder siderne ved opstart. CI afviser manglende
siderammer eller forældede assetversioner. Browserkontrollen gennemgår alle
15 sider ved tre bredder, samt temaets start/slut og postkassens mailforløb.
