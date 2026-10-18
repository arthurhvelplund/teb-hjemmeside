# Samlet Det sker, lokalt forsøg

Den gemte portal før forsøget er commit `137c149` på `tistrup-kalender`.
Åbn `/nyt-eksperiment.html` via den normale lokale server:

```sh
cd calendar-worker
npm run dev
```

`nyt.html` bevarer den eksisterende visning med et link til forsøget.
TEBs Facebook-feed er flyttet til `index.html#facebook`.
Push til denne branch starter tests. Produktionsworkflowet udgiver kun `main`.

## Visning og kilder

Overblik viser nyheder og en ugekalender ved siden af hinanden. På mobil står
den korte kalender først. Nyheder og Kalender kan også vælges hver for sig.
Kalenderen har uge/måned, søgning og dagvalg i månedsoversigten.

Tistrup Nyt og Pulsen i Vest hentes fra deres offentlige forsider. Pulsen
leverer også daterede arrangementskort fra bysiden. Importen gennemgår ikke
alle deres sider eller fremtidige kalendermåneder. Tistrupnews, VORES Tistrup
og Fællesskaber i Varde er direkte links, som ikke importeres i forsøget.

Backendens cache genbruges med separat nøgle per kilde. Kopier overlever
genstart og opdateres efter en time ved næste besøg. Ved kildefejl vises seneste
kopi med fejlstatus. Browseren kontrollerer igen ved Opdatér eller hvert minut,
når det ikke forstyrrer læsning/oprettelse. Hentetid er ikke udgivelsesdato.

Kilde og originalt læselink vises altid. Identiske overskrifter på mindst
35 tegn samles i ét kort med begge kildelinks. Korte generiske overskrifter
og selvstændige lokale opslag sammenlægges ikke. Kalenderdatoer læses kun
fra kildens datofelter. Der gættes ikke på datoer i brødtekst/overskrifter.

## Oprettelse og godkendelse

Der oprettes én post med typen `event`, `news` eller `both`. En post med typen
`both` vises som historie og kalenderpunkt med samme id. Fælles overskrift,
beskrivelse, valgfri længere tekst, billedlink og ønsker til deling gemmes
sammen. Billeder angives som https-adresser. Filupload er ikke bygget her.

Eksisterende OTP-login og sessionskontrol genbruges. Verificerede medlemmer
udgiver direkte for deres egen forening. TEB kan også udgive direkte. En
mailkode alene giver ikke en ny bruger foreningsadgang. Serveren fastsætter
foreningens navn ved medlemsopslag.

Gæster får preview og indsender til TEBs godkendelse. TEB og gæsten får
beskeder i den lokale testpostkasse. TEB logger ind og godkender eller afviser
på forsøgssiden. Indtil da er posten privat. Den fælles mailkø krypterer
indholdet som i resten af portalen. Ingen rigtig e-mail sendes.

Data ligger i en separat `experiment_posts`-tabel i lokal SQLite. API-ruterne
`/api/kalender/experiment/*` kræver både lokal tilstand og loopback-adresse og
er lukkede i produktion. Idempotensnøgler forhindrer dubletter ved afbrudte svar.
Adgang kontrolleres igen ved genforsøg og atomisk ved udgivelse/godkendelse.

## Papir og andre kanaler

Afsluttede PDF-udgaver åbnes fra den eksisterende kalender. Nye prøveopslag
ændrer hverken kalenderens `events`-tabel eller printudgaverne. Tilvalg til
analog kalender og ønsker om flyers, byportaler, infoskærme og plakater gemmes
med posten og vises for TEB ved godkendelse. Der oprettes ingen nye PDF-udgaver
eller eksterne bestillinger i forsøget. Udbyderkontakter afventer TEBs aftaler.

Forsøget omfatter oprettelse og moderation. Hvis modellen vælges til drift,
skal redigering/aflysning, filupload, printfrister og kildeaftaler indarbejdes
i den fælles produktionsmodel. Der er ikke tilføjet kommentarer eller forum.

## Kontrol

```sh
node scripts/sync-site.mjs --check
node scripts/site-layout-check.mjs
node scripts/site-layout-browser-check.mjs
node scripts/det-sker-browser-check.mjs
cd calendar-worker
npm test
npm run test:browser
npm run test:cloudflare
```

Browserkontrollen starter og rydder egen server/database op. Den prøver
kildesøgning, visninger, tre skærmbredder, preview, tabt kvittering, login med
retur til forsøget, godkendelse, direkte udgivelse, nyheder uden kalenderdato
og flytningen af Facebook. UI-kilderne er deterministiske fixtures. Rigtige
parserudtræk og cache testes separat, og levende kilder kontrolleres lokalt.
