# Samlet status for TEB hjemmesiden

Opdateret 22. oktober 2026. Den nye portal er live på teb-tistrup.dk. Dette er projektets fælles status og afleveringssted.
Status ved oprettelsen: 25 tråde, heraf 17 hovedtråde og 8 undertråde. Foreningsleverancen er samlet i `53cc3c0`. Kalenderens visuelle udtryk afventer brugerens designvalg.

## Det fælles arbejdssted

- Aktiv kode: `/Users/marinushvelplund/Projects/teb-kalender-faerdig`.
- Integrationsgren: `local/teb-pilot-ready`. Den gemmes på GitHub som arbejdsgren, adskilt fra produktionens `main`.
- Web og backend: `site/` og `calendar-worker/`.
- Denne status: `docs/STATUS.md`. Maskinlæsbar optælling: `docs/status/inventory.json`.
- Lokal pilot og gennemgang: [PILOT_KLAR.md](PILOT_KLAR.md). Drift: [PORTAL_DRIFT.md](PORTAL_DRIFT.md).

Desktop-mappen er den oprindelige kopi. Projects-kopien blev oprettet efter rapporterede filsystemfejl i Desktop.
Gamle worktrees og lokale data bevares. Nye leverancer skal samles i Projects, før de regnes som afleveret.

## Leverancer og åbent arbejde

| Område | Status |
| --- | --- |
| Det sker | Medielinks med billeder og Facebook. Gemte commits `ffc8e74` og `ec33f28`. |
| Kalender | Nyt uge/månedsoverblik, kommende arrangementer, kildesammenlægning og billeder gemt i `ce5272b`. Teknisk samlet. Visuelt design afventer nyt valg. |
| Opret arrangement | Fælles popup med billedupload og kalender/print-preview. Kun ønske om den trykte kalender kan vælges. Øvrige delingsmuligheder findes på den selvstændige infoside. |
| Foreninger | 24 importerede udkast, 18 med billede/logo. Direkte valg mellem Billede og Liste, søgning og intet interessefilter. |
| Login og adgang | Lokal mailkode. Én foreningsrolle og én side, Min forening, fra `8b028f7`. Ingen rigtig mail. |
| Foreningsprofil og ejerens side | Kompakt offentlig profil og ejerens arrangementer. Nyhedsoprettelse og foreningsnyheder er taget ud af brugerflowet efter brugerens ønske 20. oktober. Den fælles TEB-kø og historiske data er bevaret. |
| Trykt kalender | Det manuelle printforløb fra `1ce68e0` er integreret i `4209e48`. Hvert arrangement vælges, korrekturlæses og gemmes i en fast PDF. |
| Staging og produktion | Live på https://teb-tistrup.dk fra 21. oktober (Worker `teb-kalender-api`, D1 `teb-kalender-production`, R2 `teb-kalender-production-pdfs`). Testversion på https://test.teb-tistrup.dk (Worker `teb-kalender-staging-api`, D1 `teb-kalender-staging`, R2 `teb-kalender-staging-pdfs`). |

## Kontaktformular på Om TEB den 22. oktober 2026

- Kodecommit: `b535b7e` på `local/teb-pilot-ready`.
- Kontaktformularen fra kontaktsiden er også lagt nederst på Om TEB, før
  sidefoden. Samme felter, spamværn og POST til `/api/formular`.
- Kontroller: fælles layout på 16 sider og `git diff --check` består.
  Lokal browserkontrol ved 1280 og 320 px viser intet vandret overløb.
  Obligatoriske felter afviser tom formular og accepterer gyldige værdier;
  den fælles JavaScript-kode udfylder formularens starttidspunkt.
- Ingen rigtig besked sendt. Statisk lokal kontrol har ikke formular-API;
  faktisk mailafsendelse er derfor ikke afprøvet her.
- Pushet til `main` efter brugerens besked. Udgivelse startet i GitHub Actions
  `39796662229` fra `c788029`; udgivelsesresultat afventer kontrol.

## Ret og aflys i popuppen den 22. oktober 2026

- Ret fra Min forening åbner nu samme popup som Opret arrangement, med billede,
  forhåndsvisning og Aflys arrangementet. Man bliver på foreningssiden, og listen
  opdateres efter gem. Direkte links til `kalender.html?ret=` åbner også popuppen.
- Den gamle ret-side bruges kun som reserve, hvis man ikke er logget ind, eller
  arrangementet er en gæsteindsendelse uden forening.
- Testpostkassen (`kalender-postkasse.html`) fjernes nu før udgivelse til Pages
  og findes kun lokalt. `nyt-eksperiment.html` bevares som viderestilling for
  gamle mails, og opslags-API'et bevares til gamle kvitteringer og TEB-køen.
- Kontroller: 85 backendtests, 39 portal-browserscenarier (inkl. ret og aflys i
  popuppen), 8 kalenderscenarier, ret-billedkontrol og layoutkontrol består.
  To browserkontroller blev opdateret til husstandsomdelingens nye tekst og
  forsidens rækkefølge fra `0e06f6c` og `7c71333`.

## Sammenfoldet husstandsomdeling den 21. oktober 2026

- Kodecommit: `0e06f6c46d973250f57a019e22ea85812049015a` på `main`.
- Husstandsomdeling starter nu lukket med Se hvordan ligesom de øvrige
  delingsmuligheder. Ét klik viser afleveringssted, frister, begge årstabeller
  og praktiske oplysninger. Der er ingen ekstra indre foldud.
- Begge tabellers HTML er kontrolleret identisk før og efter rettelsen:
  uge- og datoopsætning, fredagsfrister og Kun kontingent er bevaret.
  CSS er uændret. Layoutkontrol på 16 sider og git diff --check består.
- Livekontrol: lukket ved indlæsning; klik åbner begge tabeller og alle seks
  datoer; klik lukker igen. Skærmbillede viser samme kompakte kortoversigt
  som de andre muligheder. Ingen udeståender for denne rettelse.
- Udgivet med succes i GitHub Actions `39678578933`, job `119494786999`.
  Afleveret på GitHub main og i trådens isolerede arbejdskopi;
  brugerens Projects-pilot er ikke opdateret.

## Husstandsomdeling 2026–2027 den 21. oktober 2026

- Kodecommit: `ffa9bf36474ebf64e0ab0c0bbd61b4a05cee1d87` på `main`.
- På Del jeres arrangement står omdelingsuger og afleveringsfrister nu
  synligt i Husstandsomdeling uden at åbne en foldud. Frist: senest fredagen
  før omdelingsugen. Kirsten Thorhauge og afleveringssted fremhæves særskilt.
- Uger oplyst af brugeren: 2026 uge 44; 2027 uge 6, 15 (kun kontingent),
  24, 34 og 44. Fire ordinære omdelinger og den ekstra kontingentomdeling
  forklares, så uge 15 ikke fremstår som en almindelig omdeling.
- Beregnede fredagsfrister: 23. oktober 2026; 5. februar, 9. april,
  11. juni, 20. august og 29. oktober 2027. Omdelingsugernes
  mandag–søndag-datoer står sammen med ugenumrene.
- Kirstens afleveringssted, Diget 4, 6862 Tistrup, er fundet i den offentlige,
  søgeindekserede omtale af netop omdelingsordningen:
  https://www.tistrupnews.dk/nyheder/nemt-billigt-og-saerdeles-effektivt
  Artiklen knytter navnet og adressen direkte til aflevering af flyers.
  Direkte hentning af artiklen gav timeout; søgeresultatet indeholdt den
  relevante sætning. Ingen telefonbogsoplysninger er kopieret til siden.
  Pris, antal og materialekrav er ikke bekræftet og henvises til TEB.
- Kontrol: alle seks ISO-uger og fredagen før hver uge verificeret med
  datetime; markeringen Kun kontingent og modtager/adresse kontrolleret.
  Synkronisering, fælles layout på 16 sider og git diff --check består.
  Live-DOM og skærmbillede viser alle datoer og adressen; ingen tabelceller
  har vandret overløb i desktopvisningen. Mobil er ikke manuelt afprøvet.
- Udgivet med succes i GitHub Actions `39677759634`, job `119491958976`.
  Afleveret på GitHub main og i trådens isolerede arbejdskopi;
  brugerens Projects-pilot er ikke opdateret.

## Hele arrangementsbilleder i kalenderoversigten den 21. oktober 2026

- Kodecommit: `32df925ecb8504265a7e160c3509aebd7bb00904` på `main`.
- Brugerens skærmbillede viste ugeoversigten, hvor 4:3-billedfeltet
  beskårede det brede invitationsbillede med object-fit: cover.
  Den tidligere centrering gjaldt retteformularen. Ugeoversigten og
  Kommende arrangementer viser nu hele billedet med contain og centrering
  i det eksisterende felt. Billedfil og arrangementsdata er uændrede.
- Kontrol: assetversioner synkroniseret, fælles layout på 16 sider og
  `git diff --check` består. Livekontrol af Fællesmøde for byens foreninger
  viser hele invitationen uden beskæring; begge oversigters beregnede CSS
  er contain og 50% 50%. Kontrolleret i desktopbrowser; mobil er ikke
  manuelt afprøvet.
- Udgivet med succes i GitHub Actions `39677014478`, job `119489402352`.
  Afleveret på GitHub main og i trådens isolerede arbejdskopi;
  brugerens Projects-pilot er ikke opdateret.

## Centrerede billeder i retteformularen den 21. oktober 2026

- Kodecommit: `199c147b261c91bbd3c3d6648f3777439e61d758` på `main`.
- Brugeren bekræfter, at billedvalg ved rettelse fungerer. Det valgte billede
  er nu centreret både under billedfeltet og i den private forhåndsvisning.
  Billedets proportioner bevares, med højst 220 pixels højde og formularens bredde.
- Kontrol: assetversioner synkroniseret, fælles layout på 16 sider og
  `git diff --check` består. Den indloggede retteformular er ikke manuelt
  afprøvet i produktion, og brugerens arrangement er ikke ændret.
- Udgivet med succes i GitHub Actions `39676312109`, job `119486979043`.
  Afleveret på GitHub main og i trådens isolerede arbejdskopi;
  brugerens Projects-pilot er ikke opdateret.

## Billeder ved rettelse af eksisterende arrangementer den 21. oktober 2026

Kodecommit: `1afaafb03938856a2a91022eba702f97415b9bc9` på `main`.

- Årsagen var, at den ældre eventForm i kalenderens retteforløb helt manglede
  billedkontrol. Backend understøttede allerede imageUrl. Formularen har nu
  valg, privat forhåndsvisning, udskiftning og fjernelse af et billede.
  Den genbruger oprettelsesformularens validering og WebP-klargøring.
- Billedet uploades ved Gem, inden rettelsen sendes. Fejler upload, sendes
  rettelsen ikke uden billedet. En eksisterende billedsti bevares ved
  almindelige tekstrettelser; eksplicit fjernelse sender tom billedsti.
  Ved et usikkert gemmeforsøg genbruges samme payload og uploadede billedsti.
- Reproduktion: `node scripts/calendar-edit-image-check.mjs` fejlede før
  rettelsen med Ret arrangement skal have et felt til at vælge et billede.
  Samme kontrol består nu med fem forløb: tilføjelse til et eksisterende
  arrangement uden billede, bevarelse/fjernelse, genforsøg, ugyldigt filvalg
  og afvist upload. Kontrollen kører den rigtige eventForm med en lille
  DOM-adapter og simuleret billedklargøring/upload; den er ikke en browsertest.
- Øvrig kontrol: 85 backendtests, syntakskontrol af de to JavaScript-moduler,
  fælles layout/assetversioner på 16 sider og `git diff --check` består.
  Den offentlige kalender indlæses efter liveopdateringen. Det konkrete
  brugerarrangement er ikke ændret, og upload under brugerens login er
  ikke manuelt afprøvet i produktion.
- Udgivet i GitHub Actions `39675825394`, job `119485277660`, med succes.
  Kun hjemmesiden er udgivet. Afleveret på GitHub `main` og i trådens
  isolerede arbejdskopi; brugerens Projects-pilot er ikke opdateret.

## Hele logoer i foreningernes billedvisning den 21. oktober 2026

Kodecommit: `71519d52674649bae2c5f85aeb79328450c0527c` på `main`.

- Billedvisningens kort viser nu hele billedet centreret i et ensartet
  180 px felt med hvid baggrund og 16 px luft. Billedernes proportioner
  bevares, og små originaler bliver ikke forstørret. Manglende billeder
  beholder initialer på den eksisterende baggrund.
- Rettelsen er afgrænset til oversigtens Billede-visning. Listevisning,
  foreningsprofiler, uploads og data er uændrede.
- Kontrol: layout og assetversioner på 16 sider samt `git diff --check`
  består. Livekontrol af HTS Fodbold, THGU, Tistrup Boldklub, TEBs trolde
  og Tistrup Filmklub bekræfter hele logoer uden beskæring. THGUs original
  på 160 × 80 px vises ved 160 × 80; de større logoer skaleres proportionalt
  ned til billedfeltet.
- Udgivet i GitHub Actions `39673147854`, job `119475980335`, med succes.
  Kun hjemmesiden er udgivet. Afleveret på GitHub `main` og i trådens
  isolerede arbejdskopi; brugerens Projects-pilot er ikke opdateret.
  Ingen udeståender for denne ændring.

## Medlemsafsnit under Facebook på forsiden den 21. oktober 2026

Kodecommit: `7c71333af48a2419b7a0360b2d9b81f039d88d2a` på `main`.

- Sammen gør vi Tistrup endnu bedre/Bliv medlem er flyttet direkte efter
  Facebook-afsnittet, før den fælles sidefod. Sektionens HTML, tekst,
  knapper og design er bevaret; kun rækkefølgen er ændret.
- Kontrol: fælles layout og assetversioner, layoutkontrol på 16 sider og
  `git diff --check` består. Live-DOM bekræfter én medlemssektion direkte
  efter `#facebook`; Facebook-opslagene vises over den, og begge knappers
  links er bevaret (`bliv-medlem.html` og `kontakt.html`).
- Udgivet i GitHub Actions `39672204443`, job `119472716915`, med succes.
  Backend og formular-Worker er uændrede. Afleveret på GitHub `main` og i
  trådens isolerede arbejdskopi; brugerens Projects-pilot er ikke opdateret.
  Ingen udeståender for ændringen.

## Tydelig adgang til delingsmuligheder den 21. oktober 2026

Designcommit: `3f908cafe712cea870e9803fe89ee8aad4cc8134`. Endelig placering:
`5dbbf57a4fcf5a2313556d0667ec2a514c6661a8` på `main`.

- Vil I dele flere steder? ligger efter brugerens rettelse igen direkte under
  Kalenderen på papir/Hent PDF. Det godkendte design er bevaret: mørkegrøn
  boks, megafonikon, større overskrift og lys knap Se alle delingsmuligheder.
  Kun rækkefølgen og 32 px luft mellem de to bokse er justeret.
- Linker fortsat til den eksisterende infoside med alle seks muligheder.
  Ved mindre skærme flyttes knappen til næste række og fylder boksens bredde
  under 600 px. Tastaturfokus har en tydelig markering.
- Kontrol: fælles layout og assetversioner samt layoutkontrol på 16 sider og
  `git diff --check` består. Liveknappen åbner `/del-arrangement`; tilbage-linket
  åbner kalenderen, hvor arrangementerne fortsat indlæses. Ingen vandret
  overflow ved browserens kontrollerede bredde på 1363 px.
- Designet blev udgivet i GitHub Actions `39670990685`. Den endelige placering
  er udgivet i `39671734282`, job `119471075183`, med succes. Livekontrol
  bekræfter, at delingsboksen kommer lige efter printafsnittet, og at dens
  farver, indhold og link er bevaret. Layoutkontrol på 16 sider består igen.
  Kun hjemmesiden blev udgivet; backend- og formulartrinnene blev sprunget over.
- Afleveringssted: GitHub `main` og denne tråds isolerede arbejdskopi
  `/workspace/scratch/45b6135496c5/teb-calendar-local-filter`. Projects-piloten
  på brugerens computer er ikke opdateret. Ingen udeståender for ændringen.

## Filter for Hodde og Tistrup den 21. oktober 2026

Kodecommit: `afb22584f5e2fd34463d93533a6097ce91d24954` på `main`.

- Importerede arrangementer fra både Tistrup Nyt og Pulsen i Vest beholdes kun,
  hvis Hodde eller Tistrup står i overskrift, beskrivelse, sted eller selve
  arrangementets fulde tekst. Match er uafhængige af store/små bogstaver.
- Selve opslagets indhold læses; menuer, billedtekster, bytags og andre
  arrangementer på kildesiden giver ikke træffere. Fuld artikeltekst lagres
  ikke i API-svaret. Eksisterende foreningsarrangementer berøres ikke.
- Tidligere kildecacher kontrolleres på ny. Reglen gælder også en gemt kopi,
  hvis kilden midlertidigt er utilgængelig.
- Kontrol: 85 backendtests, Cloudflare dry-run og fælles layout på 16 sider
  består. De tre nye regressionstests dækker brødtekst efter metadataudsnittet,
  cacheopgradering/driftsfejl og de to kilders forskellige artikelstrukturer.
- Udgivet i produktion 21. oktober kl. 20.24 UTC i GitHub Actions-kørsel
  `39658461758`, forsøg 2, job `119464731363`. Alle 85 backendtests og
  layoutkontrollen består. Kalender-Worker og Cloudflare Pages er udgivet.
  Worker-version: `9c269cc2-d146-4ae3-80bd-0971f0fd037e`.
- Første forsøg blev afvist af Cloudflare. Brugeren tilføjede manuelt
  Workers Scripts Edit samt Workers Routes Edit og Zone Read for
  `teb-tistrup.dk` til den eksisterende TEB GitHub Pages-token; Pages-adgangen
  blev bevaret. Den samme GitHub-kørsel lykkedes derefter uden kodeændringer.
  Ingen credentials er kopieret til repoet.
- Livekontrol: Begge kilde-endpoints svarer friske data (`stale:false`).
  Tistrup Nyt har 49 arrangementer mod tidligere 50; Pulsen i Vest har 4 mod
  tidligere 6. Ølgod Kulturdage og HTS/Horne-kampen er væk fra kilderne.
  Byens kalender viser fortsat fællesmødet den 22. oktober, indoor cycling,
  Tistrup Cykelmotion og gudstjenesten i Hodde. Den 23. oktober vises
  Intet planlagt. Ingen udeståender for dette filter.
- Afleveringssted for denne tråd: GitHub `main`; isoleret arbejdskopi
  `/workspace/scratch/45b6135496c5/teb-calendar-local-filter`. Den lokale
  Projects-pilot på brugerens computer er ikke opdateret af denne tråd.

## Lancering på teb-tistrup.dk den 21. oktober 2026

Commit: `576b34f`. Udgivet ved at fast-forwarde `main` til `local/teb-pilot-ready`.

- Worker `teb-kalender-api` har to routes: `teb-tistrup.dk/api/kalender*` og `www.teb-tistrup.dk/*`.
  Den anden sender www videre til teb-tistrup.dk med 301 (`REDIRECT_HOST`), så login,
  formularen og cookies kun findes ét sted. `PUBLIC_ORIGIN` er https://teb-tistrup.dk.
  `teb-formular` og `/api/formular*` er uændrede.
- D1 `teb-kalender-production` har migreringerne 0001–0007. R2 er `teb-kalender-production-pdfs`.
  Secrets: `MAIL_ENCRYPTION_KEY`, `EDITOR_EMAIL` og `TEB_ADMIN_EMAILS`.
- 25 foreninger er indlæst. afhvelplund@gmail.com er TEB-administrator og aktivt medlem af
  "Tistrup Erhvervs- og Borgerforening · TEB". Brugeren blev oprettet direkte i D1.
  Ingen testdata, øvekonti eller lokale data er overført.
- Kontrol: 82 backendtests og Cloudflare-runtimecheck er bestået. Live-config svarer
  `submissionsEnabled:true`. www giver 301, og `/api/formular/config` giver 200.
- Rulles tilbage med `wrangler rollback` for Workeren og forrige Pages-deployment.
  Databasen indeholder kun de indlæste foreninger og nye indsendelser.

## Testversion på test.teb-tistrup.dk den 21. oktober 2026

Commits: `37bad2b`, `d463881` og `133d2ac` på `local/teb-pilot-ready`.

- Cloudflare-kontoen er afhvelplund@gmail.com's Account (`53e63615…`). Zonen teb-tistrup.dk og
  Pages-projektet `teb-tistrup` ligger der. Mailafsendelse er slået til for domænet.
- Worker `teb-kalender-staging-api` er udgivet som custom domain på test.teb-tistrup.dk. Den
  besvarer `/api/kalender/*` og henter hjemmesiden fra Pages-grenen `staging`
  (`SITE_ORIGIN`). Produktionens Worker-opsætning har ikke `SITE_ORIGIN`.
- D1 `teb-kalender-staging` har migreringerne 0001–0007. R2 er `teb-kalender-staging-pdfs`.
  `MAIL_ENCRYPTION_KEY` er sat som secret og gemmes ikke i Git.
- Afsenderen er kalender@teb-tistrup.dk, og svar går til tistrup.kalender@gmail.com. `EDITOR_EMAIL` kan nu
  indeholde flere adresser. Administratorer og modtagere af TEB-beskeder er sat som secrets
  (`TEB_ADMIN_EMAILS`, `EDITOR_EMAIL`) og står ikke i repoet.
- 25 foreninger er indlæst i testdatabasen. Det er de 24 udkast og Bødkerhuset · Café Magnus Bødker.
  Øveforening og øvepersoner er ikke indlæst.
- Testversionen sender `X-Robots-Tag: noindex`. Det gør også `*.teb-tistrup.pages.dev`.
- Kontrol: 82 backendtests er bestået. Live-config svarer `submissionsEnabled:true`. Den første loginkode til
  afhvelplund@gmail.com fik `deliveryState: sent`. Levering i indbakken skal bekræftes af brugeren.
- Udestår: TEB inviterer Bødkerhusets kontaktperson. Derefter følger
  produktionsdatabase, -lager og -Worker på teb-tistrup.dk/api/kalender/*, og merge til `main`.

## Min forening og én rolle den 21. oktober 2026

Kodecommit: `8b028f7` på `local/teb-pilot-ready`.

Brugeren fandt foreningslogin forvirrende. Det er forenklet efter en skitse,
som brugeren har godkendt. Det overordnede princip er det samme som før: Alt ligger
på Foreninger. Man logger ind dér, og der er intet nyt punkt i hovedmenuen.

- To roller: forening og TEB. Forskellen på foreningsansvarlig og redaktør
  er fjernet i backend og brugerflade. Alle aktive medlemmer kan invitere og
  fjerne andre, men ikke sig selv. Nye invitationer gemmes som `manager`.
  Gamle `editor`-rækker har fået de samme rettigheder. Databaseskemaet er uændret.
- `forening.html#min-forening` samler foreningens arrangementer med status,
  foreningens side med Ret, og personer med adgang med invitation. Menuen
  "Mere", fanen `personer` og søgningen i egne arrangementer er fjernet.
  `#arbejdsrum` og `#adgang` åbner stadig samme side.
- Logget ind uden forening: anmodningen om adgang ligger direkte på Min forening.
- Opret arrangement åbner fortsat popup'en på stedet. Ret åbner fortsat
  kalenderens retteside, som nu linker tilbage til Min forening.
- Gæster kan stadig oprette uden login og rette via det private link.
- Fjernet: `foreningsportal.html`, `mit-arrangement.html`, `kalender-redaktion.html`,
  `js/portal-redirect.js` og ruterne `#skriv` og `#opslag`. Nyhedsbackend,
  TEB-køen for ældre opslag, `site/admin/` og `nyt-eksperiment.html` er ikke ændret.

Kontroller: 81 backendtests, 37 portalforløb, 8 kalenderforløb og fælles layout
på 16 sider. Alle er bestået med isolerede prøvedata.
[Kontrolresultater](status/min-forening-2026-10-21.json).
Lokalt preview på port 8790 med en kopi af pilotens data i
`calendar-worker/.wrangler/local-min-forening/`. Pilotdata i `local-pilot` er urørt.

## Deling flyttet til infoside den 20. oktober 2026

Kodecommit: `ffa147d` på `local/teb-pilot-ready`. Status og kontrolrapport
gemmes i det efterfølgende dokumentationscommit på samme gren.

Brugeren har efter gennemgang ændret placeringen af delingsvejledningen.
Denne leverance erstatter formularens seks delingsvalg fra `0a8acd0`.

- Popup og retteformular har kun valget om at komme med i den trykte kalender.
  Teksten forklarer, at TEB gennemgår ønsket og vælger indholdet manuelt til
  hver udgave. Markeringen reserverer ikke en plads. Kalender/print-preview
  og den eksisterende `printRequested`-lagring er bevaret.
- Overblikket er flyttet til `site/del-arrangement.html`, Del jeres arrangement.
  Seks kort med enkle SVG-illustrationer giver overblik. Kontakt, pris, materiale
  og frister foldes ud under hvert kort. Siden fungerer uden JavaScript.
- Infosiden findes fra Vil I dele flere steder? under kalenderens printsektion.
  Kalender er aktivt menupunkt på infosiden. Den private status har et almindeligt
  link til infosiden. Den fulde vejledning er fjernet fra popup, retteformular
  og popup-kvittering.
- Kirsten, kommunens links og bannertilbuddet med Jens Ejnar Antonsens kontakt
  er flyttet med. Uafklarede frister og mulige opslagstavler er fortsat markeret.
  Det aktuelle indhold vedligeholdes direkte i infosidens HTML; den tidligere
  `site/js/event-sharing.js` er fjernet. `site/js/print-request.js` deler den
  korte printforespørgsel mellem oprettelse og rettelse.
- Nye indsendelser sender ingen øvrige delingsønsker. Gamle gemte `channels`
  slettes ikke fra eksisterende arrangementer ved rettelse. Lokale databaser,
  arkiver og worktrees er bevaret.

Kontroller: 37 portalforløb og 8 kalenderforløb med rigtig lokal API og isolerede
prøvedata. Printønsket følger kladde, TEB-godkendelse, rettelse og manuel PDF.
Infosiden er kontrolleret ved 1440, 390 og 320 px, også med alle detaljer åbne
på telefon. Ingen vandret overflow. Fælles layout består nu på 16 sider.
Backendkode og kontrakt er uændrede; de 81 backendtests fra forrige leverance
blev ikke kørt igen. Ingen rigtig mail, bestilling eller deploy.
[Kontrolresultater](status/print-request-info-2026-10-20.json).

## Forenkling og deling den 20. oktober 2026

Kodecommit: `0a8acd0` på `local/teb-pilot-ready`. Status og kontrolrapport
gemmes i det efterfølgende dokumentationscommit på samme gren.

- Foreningsoversigten har kun de to visningsvalg Billede og Liste ved siden af
  søgningen. Filtre-knappen og interessefilteret er fjernet. Valget huskes, og
  billedvisning og liste er forskellige også på telefoner.
- Nyt fra foreningerne og Skriv en nyhed er fjernet fra Det sker. Min forening
  viser arrangementer og profilredigering. Foreningsprofiler viser arrangementer
  uden nyhedssektionen. Gamle links til nyhedsoprettelse fører til Opret arrangement.
  Lokale medielinks og Facebook er bevaret. Eksisterende opslag, deres backend
  og tidligere kvitteringer er bevaret som historik; API'et til ældre opslag
  er ikke fjernet i denne leverance.
- Tilføj arrangement har et direkte link til seks delingsmuligheder. Ønsker om
  husstandsomdeling, infoskærme, bannere og opslagstavler gemmes som `channels`,
  og ønsket om den trykte kalender som `printRequested`. Ønskerne følger
  kladden, TEB-godkendelsen og rettelser. De bestiller ikke ekstern deling.
- Oprettelse, den eksisterende retteformular og kvitteringer bruger den samme
  vejledning fra `site/js/event-sharing.js`. Oprette- og retteformularen er
  stadig to komponenter, som beskrevet i flowgennemgangen længere nede.

Bekræftet indhold og kilder:

- Online fælleskalender: foreningsadgang udgiver direkte; gæster afventer TEB.
- Husstandsomdeling: fire gange om året via vejformænd. Indlevering til Kirsten
  Thorhauge, oplyst af brugeren. Indleveringsfrister og omdelingsdatoer har hver
  sin plads. Datoer, Kirstens kontaktoplysninger, afleveringssted, pris og antal
  mangler endnu.
- Infoskærme: [Varde Kommunes regler og priser](https://vardekommune.dk/kommunen/byportal/)
  læst 20. oktober 2026. To skærme i Billum og Varde syd, fem hverdages frist,
  JPG/PNG og offentlig adgang/almen interesse. Siden angiver 750 kr. ekskl.
  moms pr. påbegyndt uge for begge skærme. Prisangivelsen er fra 2018, hvilket
  fremgår af vejledningen sammen med besked om at bekræfte prisen. Direkte
  link til kommunens bestillingsformular er indsat. Ingen bestilling er sendt.
- Tre byportaler med bannere: brugerens videresendte tilbud fra Jens Ejnar
  Antonsen, dateret 11. oktober 2026. Tre bannere på 2000 × 1445 mm koster
  1.200 kr. ekskl. moms i alt, leveret hos Jens. Filer skal være klar til print;
  filtilretning koster 400 kr. pr. time ekskl. moms. Første bestillinger kan gå
  gennem Jens, tlf. 28 94 98 42 og jemantonsen@bbsyd.dk. Ophængning, bestillingsfrist
  og ophængningsperiode er ikke oplyst i tilbuddet og står som uafklarede.
  Hele mailtråden og de øvrige afsenderes oplysninger er ikke gemt i Git.
- Opslagstavler: hallen, Trim og Brugsen er mulige steder fra brugeren,
  udtrykkeligt markeret som ubekræftede. Ansvarlige, regler og frister mangler.
- Trykt kalender til lygtepæle og opslagstavler: kræver TEBs manuelle udvælgelse.
  Frist for næste udgave, ophængningsdato og ansvarlige mangler endnu.

Kontroller: 81 backendtests, 37 portalforløb med rigtig lokal API, 8 kalenderforløb
og fælles layout på 15 sider. Mobilkontrol ved 390 og 320 px omfatter begge
foreningsvisninger, offentlig kontakt, ejerområdet og alle udvidede delingsfelter.
Browserforløbene bruger isolerede databaser, testkilder til eksterne arrangementer
og lokal mail. Ingen rigtig mail, deling eller produktion er afprøvet eller udgivet.
Tidligere 42 portalforløb omfattede ni nyhedsforløb; disse er erstattet af fire
kontroller af det forenklede foreningsflow. Testgenererede billeder/PDF'er indgår
ikke i leverancen. [Kontrolresultater](status/association-sharing-2026-10-20.json).

## Tråde

Rækkerne beskriver både færdige og stadig åbne tråde. De otte undertråde er historiske.

T3-status fortæller, om en kørsel er afsluttet. Den betyder ikke i sig selv, at kode er testet, committet eller udgivet.
`settled` betyder, at tråden er flyttet ud af den aktive liste.

| Tråd | Kørsel ved aflæsning | Leverance |
| --- | --- | --- |
| [Samlet status over tråde og worktrees](t3-thread://v1/3846890d-c6d1-4a6b-884d-a742be850123) | running | Samlingen er afleveret på GitHub. Alle færdige leverancer og syv arkivgrene er bevaret. |
| [Foreningsside og ejerens startvisning](t3-thread://v1/103b95cc-5ffc-40b4-8120-27115e9ce1da) | completed | Leveret i `53cc3c0`: offentlig profil, ejerens startside, nyheder og fælles redaktion. 81 backendtests, 42 portalforløb og 8 kalenderforløb består. Ingen deploy. |
| [Redesign kalender og fysisk kalender](t3-thread://v1/5e4e6bd7-5f88-44bd-875a-677f22ae3794) | completed | Kalender gemt i `ce5272b`, popup samlet i `313eac2`. Nyt designønske kl. 22.20. Tre stilforslag præsenteret. Afventer brugerens valg og stillingtagen til Halloween-temaet. |
| [Tilføj arrangementer med kalenderpreview](t3-thread://v1/3516ed04-6e1a-4d3d-8976-a6941ace66e6) | completed | Færdig pop-up med formular, kalender/print-preview og billed-upload. Samlet med Projects i `313eac2`. 32 portalforløb består. |
| [Kortlæg kalenderarbejde og status](t3-thread://v1/2e5d2bcf-9fee-4798-9496-6bf262a3eda3) | completed, settled | Samlet pilot i Projects, commit 4209e48. Seneste kompakte foreningsoversigt 6ea99c2. Ældre statusvisning i output/status er afløst af denne status. |
| [Saml Det sker her med billeder](t3-thread://v1/cdba8b01-0d2e-4997-846d-dfb6b61296d7) | completed, settled | Det sker som medielinks og Facebook. Gemte commits ffc8e74 og ec33f28 i Projects. |
| [Importer Foreninger](t3-thread://v1/01060cc4-789f-44b3-92b8-29f30ef1cef2) | completed, settled | 24 foreningsudkast, 18 med billeder/logoer. Kode/import er gemt i den samlede pilot. Indhold skal godkendes før lancering. |
| [Foreningsportal](t3-thread://v1/ca12ef24-ae62-488b-8d3f-2a842970cd09) | completed, settled | Login i to trin, Min forening, adgangsstyring og upload. Indarbejdet i pilotens 4209e48. |
| [Det Sker](t3-thread://v1/3fd0ea69-0d67-497d-997b-37cb671f488d) | completed, settled | Tidligere hovedtråd for backend, kalender, portal, fælles layout og kilder. Videreført i den samlede pilot. |
| [Analog Kalender Design](t3-thread://v1/94860d72-18d8-4eae-84ff-eaa904f95900) | completed, settled | Printlayout, manuel udvælgelse, A3/50 x 70 cm og faste PDF-udgaver i 1ce68e0. Indarbejdet i 4209e48. |
| [Final review of portal fixes](t3-thread://v1/thread:delegated-task:command%3Amcp%3A390dc0df-c838-43f7-9008-ffe3ff4eb7b0%3Adelegate-task%3Ateb-real-review-r2) | completed, undertråd | Historisk review. Se worktree og fund nedenfor. Ingen aktiv kørsel. |
| [Review af samlet portal: adgang, data og PDF](t3-thread://v1/thread:delegated-task:command%3Amcp%3A390dc0df-c838-43f7-9008-ffe3ff4eb7b0%3Adelegate-task%3Ateb-real-review-r1) | completed, undertråd | Historisk review. Se worktree og fund nedenfor. Ingen aktiv kørsel. |
| [Kalender: måned/uge, formular, gæster og Det sker](t3-thread://v1/thread:delegated-task:command%3Amcp%3A390dc0df-c838-43f7-9008-ffe3ff4eb7b0%3Adelegate-task%3Ateb-real-kalender-r1) | completed, undertråd | Historisk delleverance til hovedtråden. Indarbejdet i senere integration. Ingen aktiv kørsel. |
| [Forening: register, login og privat administration](t3-thread://v1/thread:delegated-task:command%3Amcp%3A390dc0df-c838-43f7-9008-ffe3ff4eb7b0%3Adelegate-task%3Ateb-real-forening-r1) | completed, undertråd | Historisk delleverance til hovedtråden. Indarbejdet i senere integration. Ingen aktiv kørsel. |
| [Backend: adgang, foreninger, arrangementer og print](t3-thread://v1/thread:delegated-task:command%3Amcp%3A390dc0df-c838-43f7-9008-ffe3ff4eb7b0%3Adelegate-task%3Ateb-real-backend-r1) | completed, undertråd | Historisk delleverance til hovedtråden. Indarbejdet i senere integration. Ingen aktiv kørsel. |
| [Redesign Det sker og eksterne nyheder](t3-thread://v1/a90816fc-52fb-463e-9927-c31c28ddf62a) | completed, settled | Tidligere design og kildeimport. Nyere kalender/medielinks afløser visningen. |
| [/root/shared_site_review](t3-thread://v1/thread:provider:codex:native-thread:01a14fb9-04f0-7141-8f7e-42da4918cf93) | idle, undertråd | Historisk review. Se worktree og fund nedenfor. Ingen aktiv kørsel. |
| [/root/mailbox_complete](t3-thread://v1/thread:provider:codex:native-thread:01a14fae-c919-72d3-a5c4-977468cabec0) | idle, undertråd | Historisk delleverance til hovedtråden. Indarbejdet i senere integration. Ingen aktiv kørsel. |
| [/root/association_retry](t3-thread://v1/thread:provider:codex:native-thread:01a14f87-16ef-79a1-8308-77c9f35a9788) | idle, undertråd | Historisk delleverance til hovedtråden. Indarbejdet i senere integration. Ingen aktiv kørsel. |
| [Tistrup Foreningsportal Design](t3-thread://v1/ba815170-d32c-4636-a5b4-62daad4e2366) | completed, settled | Stoppet efter filoverlap med den daværende hovedtråd. Ingen aktiv leverance. Den nyere integrerede løsning er gældende. |
| [Foreningsportal til fælles kalender](t3-thread://v1/3065d4f5-8d23-4a0a-9644-b5988e574503) | failed, settled | Ældre UI-preview. Seneste kørsel fejlede. Videreført i nyere portaltråde. |
| [Compare Website With GitHub](t3-thread://v1/28666362-60b0-4fea-903d-cb34ee830ec9) | interrupted, settled | Historisk GitHub-synkronisering. Seneste kørsel afbrudt. Lokalt arkiv bevares. |
| [Sæt GitHub og Cloudflare op](t3-thread://v1/82dd0e4f-8db8-4147-85ed-7acb6e2890ff) | idle, settled | Historisk GitHub/Cloudflare-opsætning. Produktionsworkflow er fortsat knyttet til main. |
| [Tilføj bestyrelse til hjemmesiden](t3-thread://v1/62c2f7ef-4f5f-46ab-b20f-15b84d99ff73) | idle, settled | Historisk bestyrelsesside og oprydning i testopslag. Leverancen er i Git-historikken. |
| [Gem hele hjemmesiden lokalt](t3-thread://v1/6f21fab3-851a-482f-9bf3-267694b0c2b7) | idle, settled | Lokalt spejl af den tidligere hjemmeside i teb-tistrup-arkiv. Referencearkiv, ikke app-backend. |

## Worktrees og separate kopier

| Mappe eller gren | Commit ved første aflæsning | Vurdering |
| --- | --- | --- |
| Projects/teb-kalender-faerdig, local/teb-pilot-ready | `6ea99c2` | Kanonisk integration. Selvstændig Git-kopi, ikke et worktree under Desktop. |
| Desktop/TEB-hjemmeside, tistrup-kalender | `aeb6ef9` | Oprindelig kopi. Hele filindholdet er gemt i arkivgrenen nedenfor. Pop-up’en er integreret i pilotgrenen. |
| t3-2aec174b, t3/association-calendar-portal | `3a210ba` | Ren. Tidlig kalenderleverance. Senere versioner er integreret i hovedhistorikken. |
| t3-70b4d892, t3/implement-association-portal | `c20fbdd` | Ren. Tidlig portal. Senere versioner er integreret i hovedhistorikken. |
| t3-8a1ddbcd, t3/review-teb-portal | `03478b2` | Ren. Historisk reviewgrundlag. |
| t3-a3174bf9, t3/calendar-worker-backend | `1ce68e0` | Printleverancen er indarbejdet i pilot. Udkast/PDF-renderinger er gemt i `64a7710`. |
| t3-bdf217c0, t3/review-association-retries | `f2a72ef` | Ren. Historisk reviewgrundlag. |

Worktrees ligger under `/Users/marinushvelplund/.t3/worktrees/TEB-hjemmeside/`.
Der slettes ingen grene eller worktrees som del af samlingen.

De tidlige kalender- og portalcommits blev indarbejdet med andre commit-ID'er.
Manglende direkte Git-ancestry er derfor ikke alene et tegn på manglende kode.
Printleverancen er samlet som indhold i `4209e48`, ikke som en blind merge af den gamle backendgren.

## Tidligere reviewfund

- Review ved `f2a72ef` fandt, at et ulæseligt successvar kunne nulstille foreningsoprettelsens genforsøgsnøgle og skabe dubletter.
  Den kanoniske `site/js/forening.js` kontrollerer nu forenings-ID før nøglen fjernes.
- Fælles layoutreview fandt manglende `position:relative` på `.page-hero`. Det findes nu i `site/css/layout.css`.
- De gamle rapporter gælder deres egne commits. Ny funktionalitet kræver kontrol mod den samlede version.

## Før offentlig lancering

1. Gennemgå den leverede foreningsside med brugeren, og vælg kalenderens visuelle retning.
2. Gennemgå foreningsoplysninger, billedbrug og indhold med TEB.
3. Afprøv brugerforløbene med to eller tre foreninger.
4. Opsæt og test særskilt staging, rigtig mail, backup og gendannelse efter `PORTAL_DRIFT.md`.
5. Aftal offentlig lancering særskilt. Push til `main` kan udløse automatisk deploy af hjemmesiden.

AI-læsning af indsendte mails, automatisk Facebook-publicering og levering til infoskærme eller omdeling er ikke aktiv drift.
Gemte delingsønsker bestiller ikke noget hos andre.

## Sådan afleveres næste ændring

Den tråd, der afslutter en leverance, opdaterer dens række ovenfor og tilføjer commit, testresultat og eventuelle udeståender nedenfor.
Commit kun den pågældende leverances filer. Bevar andre trådes ændringer.
Forenings- og kalendertråden har begge modtaget besked om dette afleveringssted.
Foreningstrådens leverance og opfølgning er afsluttet og registreret.
Gem på integrationsgrenen og push den efter kontrol, så den fælles kopi også findes på GitHub.

## Samlingens commits og kontrol

| Commit | Leverance |
| --- | --- |
| `4209e48` | Tidligere samling af portal, print og lokal pilot. |
| `6ea99c2` | Kompakt foreningsoversigt. |
| `ce5272b` | Ny kalender, arrangementskort, billeder og kildesammenlægning. |
| `313eac2` | Fælles arrangementspop-up, billedupload og integration med kalender/forening. |
| `53cc3c0` | Kompakte profiler, ejerens indhold, udgiv/redigér/fjern nyheder, fælles TEB-kø og nye tests. |
| `d4f2573` | Fælles status, afleveringsregler og reviewartefakter. |
| `64a7710` | Historiske printudkast og PDF-eksempler på backendgrenen. |

Kontrolleret i denne samling: 74 backendtests, 32 portalforløb, 8 kalenderforløb,
fælles layout på 15 sider, gentagen pilotopsætning og Worker-build med `--dry-run`.
Browserforløbene bruger isolerede testdatabaser og sender ingen rigtig mail.
Resultaterne gælder den færdige kalender/popup ved `313eac2`.
Foreningsleverancen `53cc3c0` er derefter kontrolleret med:

- `npm test`: 81 backendtests, heraf 7 nye tests for nyhedsadgang, revisioner,
  billedrettigheder, fjernelse, privat feedback og filtrering før feedgrænsen.
- `npm run test:browser`: 42 forløb mod rigtig lokal API, session, OTP og fillager.
  Nyheder oprettes med billede, genforsøges efter tabt svar, rettes og fjernes.
  Gæster godkendes/afvises i fælles kø, og private kvitteringer viser feedback.
  Adgangsanmodninger kræver TEBs bekræftelse. Den fælles popup og faste PDF'er består.
- `node scripts/det-sker-browser-check.mjs`: 8 kalenderforløb. Gamle gæste- og
  godkendelseslinks bevares og fører til den fælles kø.
- `node scripts/site-layout-check.mjs`: 15 sider, lokale assets og gentagelig generering.
- `npm run test:pilot`: gentagen opsætning uden dubletter eller offentligt prøveindhold.
- `npm run build`: Worker dry-run består; intet deploy.

Desktop, 390 px og 320 px er kontrolleret. Efter den sidste mobile justering er
320 px desuden målt i det fælles preview uden vandret overløb og med Opret
arrangement over folden. Resultater gemmes i `output/portal-integreret/checks.json`
og `output/kalender-flytning/checks.json`.

Migration `0007_news_management.sql` er anvendt i den lokale pilot og skal med på
kommende staging. Ingen rigtig mail er sendt. Koden er committet på
`local/teb-pilot-ready`; koordineringstråden håndterer push af integrationsgrenen.

## Lokale data og previews

| Placering eller port | Observeret tilstand |
| --- | --- |
| Projects, `.wrangler/local-pilot/calendar.sqlite` | 25 foreninger inklusive øveforeningen, 0 egne arrangementer, 0 opslag, 0 PDF-udgaver. Importerede kilder ligger i cache og er ikke med i arrangementstællingen. |
| Desktop, `.wrangler/local-portal/calendar.sqlite` | 25 foreninger, 9 arrangementer, 0 opslag og 1 PDF-udgave. Bevares separat. |
| Desktop, `.wrangler/event-composer-preview/calendar.sqlite` | 1 forening, 12 prøvearrangementer. |
| Port 8787 | Opdateret foreningspilot fra Projects, startet med `npm run dev:pilot`. Nyhedsmigration anvendt. |
| Port 8797 | HTTP 200 på lokal config. Separat kalendertest fra Projects. |
| Port 8789 | HTTP 200 på lokal config. Popup-preview fra Desktop. |
| Port 8792 | Statisk foreningsprototype fra Desktop. |

En kørende Node-server indlæser backendmoduler ved opstart. Filer på disken og
allerede startede previewservere kan derfor vise forskellige backendversioner.
Port 8787 er startet fra Projects efter nyhedsændringerne og bruger `.wrangler/local-pilot`.
De øvrige previewservere og deres databaser er bevaret.

Offentlige `/kalender`, `/nyt` og `/api/kalender/config` svarede HTTP 403 på
HTTP-læsning i denne samling. Der udledes ingen ny produktionsstatus af det.
Produktionsworkflowet deployer ved relevante push til `main`; denne samling
pusher arbejds- og arkivgrene og udfører ingen deploy.

## Arkiveringen af de tidligere kopier

Alle nedenstående grene er bevaret i samme GitHub-repository. Den aktive løsning
er fortsat `local/teb-pilot-ready`. Arkivgrenene er historik og skal ikke flettes
ind som nyere udgaver af pilotens kode.

| Arkivgren på GitHub | Indhold |
| --- | --- |
| [archive/desktop-snapshot-2026-10-19](https://github.com/arthurhvelplund/teb-hjemmeside/tree/archive/desktop-snapshot-2026-10-19) | Hele Desktop-projektet, 1.332 filer og cirka 315 MB. Kode, app-demo, designsystem, præsentationer, 111 outputfiler og 970 filer fra det tidligere website. Commit `c4bccf1`. |
| `archive/original-tistrup-kalender` | Den oprindelige Desktop-gren ved `aeb6ef9`, inklusive de to commits efter det tidligere GitHub-head. |
| `archive/desktop/t3/association-calendar-portal` | Tidlig kalenderleverance, `3a210ba`. |
| `archive/desktop/t3/implement-association-portal` | Tidlig foreningsportal, `c20fbdd`. |
| `archive/desktop/t3/review-teb-portal` | Første reviewgrundlag, `03478b2`. |
| `archive/desktop/t3/review-association-retries` | Review af genforsøg, `f2a72ef`. |
| `archive/desktop/t3/calendar-worker-backend` | Backend/print og gemte printudkast, `64a7710`. De tidligere `def0cfc` og `1ce68e0` er bevaret i historikken. |

Desktop-filerne er snapshots gemt direkte i Projects-repoets Git-objekter.
Den oprindelige Desktop-mappe beholder sin tidligere branch, sit indeks og sine
lokale ændringer. Et snavset `git status` dér betyder derfor ikke, at filernes
indhold mangler i arkivet. Projects er den fælles arbejdsmappe fremover.

Desktop-Git havde også to cloudkopier af backend-ref-filen med endelserne
` 2` og ` 3`. De peger på `def0cfc` og `1ce68e0`, som begge er bevaret på den
arkiverede backendgren. De ugyldige refnavne er ikke kopieret ind som grene.
Originalerne er urørte.

Lokale databaser, testpostkasser, mailnøgler, credentials, node_modules og
maskinspecifik agentkonfiguration er bevaret lokalt og udeladt fra Git.
De lokale previewservere og eksisterende worktrees er bevaret.

[Desktop-snapshottets optælling](status/desktop-snapshot.json) og
[oversigten over Git-grene og worktrees](status/repositories.json) indeholder
de konkrete stier og commit-ID'er.

## Flowgennemgang den 20 oktober 2026

Den aktive kode er samlet og pushet på én pilotgren, men løsningen er udviklet
ved at integrere nye dele med den eksisterende hjemmeside. Den er ikke en helt
ensartet ny implementering. Arkivgrenene er historik og indlæses ikke af piloten.

Den pushede version `c92d153` er kontrolleret igen i en midlertidig kopi med
isolerede databaser. 81 backendtests, 42 portalforløb, 8 kalenderforløb, fælles
layout på 15 sider og gentagen pilotopsætning består. Formular-Workerens 7
unittests består også med en simuleret mailadapter. Pilotens egne data er bevaret.

Der er fortsat konkrete forskelle mellem ældre og nyere brugerforløb:

- Nye arrangementer oprettes i den fælles popup. Rettelser fra medlemmer og
  gæster bruger stadig den ældre formular i `site/js/kalender.js`. Den bevarer
  eksisterende billeder, men har ingen kontrol til at erstatte eller fjerne dem.
- Foreningssiden indlæser det nyere `forening-v2.css` oven på de tidligere
  `portal.css` og `forening.css`. Det er en viderebygning af den eksisterende stil.
- Gamle links og kvitteringer understøttes af redirects og
  `kalender-opslag.js`. De er kontrolleret og bevarer tidligere indsendelser.
- Kontakt og indmeldelse bruger deres egen `cloudflare-form-worker` under
  `/api/formular`. De er ikke koblet ind i kalenderpilotens lokale server.
  På en frisk lokal server svarer begge formularsider HTTP 200, mens
  `/api/formular/config` svarer HTTP 404. Rigtig afsendelse er ikke afprøvet.

Portalens login, foreningsdata, arrangementer, nyheder, TEB-kø og manuelle
printforløb deler backend og lokal lagring. Nyheder har deres egen editor.
Browserkontrollen bruger testkilder til eksterne arrangementer og lokal mail,
så de grønne tests er ikke en gennemført produktionslancering.

Næste arbejde for et ensartet forløb er at samle oprettelse og rettelse af
arrangementer i samme komponent, konsolidere foreningssidens styling og gøre
kontakt/indmeldelse afprøvelig i det samlede lokale preview. Dette audit ændrer
ikke produktkoden eller designvalget.

[Kontrolresultater og kodehenvisninger](status/flow-audit-2026-10-20.json).
