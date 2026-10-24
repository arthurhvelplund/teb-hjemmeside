# TEB foreninger og kalender

Den samlede lokale gennemgang starter med `npm run dev:pilot` og derefter
`npm run seed:pilot` i en anden terminal. Det bruger sin egen database,
opretter ingen eksempelarrangementer og bevarer de tidligere previewdata.
Se [pilotforløb og næste skridt](../docs/PILOT_KLAR.md).

Workerens kontrakt er `../docs/FORENING_IMPLEMENTATION.md`. Backend kører mod
Cloudflare D1/R2 i drift og samme SQL via Node SQLite og en lokal R2-adapter under
afprøvning. Den ændrer ikke hjemmesidens CMS, kontaktworker eller Pages-build.

## Lokal kørsel

Kræver Node 24.3 eller nyere og npm.

```sh
cd calendar-worker
npm ci
npm run dev
```

Serveren lytter kun på `127.0.0.1:8787`. Åbn `http://localhost:8787/` for den
rigtige `site/index.html`. Resten af `site/` serveres uden pilotens root-redirect
eller globale noindex. API ligger på `/api/kalender/*`.

Den nye lokale database, PDF-filer og en krypteringsnøgle ligger under
`calendar-worker/.wrangler/local-portal/`. Det oprindelige
`tmp/kalender-pilot/calendar.sqlite` åbnes eller ændres ikke automatisk.
`CALENDAR_DATA_DIR` og `PORT` kan vælge en anden lokal placering og port.

```sh
npm run seed
```

Seed tilføjer kun opdigtede eksempeldata via loopback-API. Den kan køres igen
uden at kopiere eksempelarrangementerne. Den opretter én forening, otte direkte
udgivne arrangementer, én gæsteindsendelse og følgende lokale logins:

- `tistrup.kalender@gmail.com`: lokal TEB-administrator, kan ændres med `TEB_ADMIN_EMAILS`.
- `ansvarlig@example.test`: foreningsansvarlig.
- `redaktor@example.test`: inviteret redaktør, aktiveres ved sit første OTP-login.

Alle tre kan anmode om en tilfældig engangskode på `/auth/request` og logge ind
med `/auth/verify`. Mail ses i `/api/kalender/local-mail`, som kræver både
`LOCAL_PREVIEW=true`, loopback-URL og en loopback `PUBLIC_ORIGIN`. Serveren
afviser desuden eksterne Host-headere. Lokal tilstand kalder aldrig en ekstern
mailbinding, heller ikke hvis der ved en fejl er sat en binding.

Der er ingen fast kode eller demo-session. Den lokale postkasse dekrypterer de
lokale mailjobs ved læsning. Nye koder og private links ligger ikke i klartekst
i SQLite. Den oprindelige pilots lokale postkasse bevares ved en eksplicit
opgradering og er underlagt samme loopback-kontrol.

## Eksterne kalenderbegivenheder

`GET /api/kalender/kilder/tistrup-nyt` læser kalenderen på
`https://tistrupnyt.dk/menu/kalender/lokal`. Datoer kommer fra kalenderens
måned/år og dagsoverskrifter, klokkeslæt fra begivenhedskortene. Kun Tistrup
Nyts egne `/cid/`-links med eksplicit dato importeres. Nabosiders kort og
nyhedsartikler udelades. Datoer gættes aldrig fra overskrifter.

`GET /api/kalender/kilder/pulsen` læser daterede `city-event`-kort på
`https://pulsenivest.dk/by/tistrup`. Artikler udelades. Kildernes viste
kalenderkort er omfanget, ikke komplette årsarkiver.

Cachen ligger i R2-bindingen `PDFS` under `calendar-sources/*-v2.json`,
separat fra gamle artikelcacher og PDF-objekter. Et besøg genbruger data i en
time og udløser derefter næste hentning. Samtidige forespørgsler deler
hentningen. Ved kildefejl beholdes seneste data med `stale:true`, og næste
forsøg sker efter fem minutter. Uden en gemt kopi returneres HTTP 503.
En genkendt, tom kalender er et gyldigt resultat. HTML og scripts sendes ikke
til browseren. De tidligere `/nyheder/*`-ruter er kompatible aliaser med samme
arrangementsdata og en tom `items`-liste.

`site/kalender.html` viser arrangementerne med kildelinks og fejlstatus.
`site/nyt.html` er en medieoversigt med links og TEBs Facebook-feed.
Forsiden har også Facebook nederst. Ingen af de to sider henter nyhedsartikler.
Parser og cache testes i `test/news.test.mjs` og `test/experiment.test.mjs`.

## Foreningsudkast til lokal prototype

Med serveren kørende kan `npm run seed:associations` tilføje 24 rigtige
foreninger og lokale fællesskaber til den lokale database. Importen kræver
loopback og lokal tilstand. Den sender ingen eksterne mails og opretter ingen
foreningsmedlemmer. Gentagelse bevarer eksisterende profiler uden dubletter
eller overskrivning. `CALENDAR_ORIGIN` kan vælge en anden lokal serverport.

Kataloget i `../site/data/foreninger-udkast.json` er undersøgt 18. oktober 2026
med Tistrup Nyts foreningsoversigt som udgangspunkt. Hver post har et kildelink
og eventuelt billedkilde, kreditering og researchnote. De 18 billeder/logoer i
`../site/images/foreninger/` er lokale kopier til prototypen. Fotografier og
logoer beholder deres ophav hos kilderne. Billedbrug skal afklares før en
offentlig lancering.

Siden viser udkastmarkering og kilde på profilerne i lokal tilstand. Seks
profiler mangler et eget billede: FTF, Horne-Tistrup Aftenskole, Janusbygningen,
jagtforeningen, Tistrup i bevægelse og Tistruplunds Venner. Janusbygningen,
hallen og forsamlingshuset er lokale kultur-/mødesteder. HTS er et samarbejde
på tværs af klubber. De er med i oversigten som fællesskaber, ikke som ekstra
selvstændige medlemsforeninger.

Den tidligere aftenskolehjemmeside gav 404. Beskrivelser af FTF, aftenskolen,
jagtforeningen og Tistruplunds Venner er derfor bevidst korte og afventer
bekræftelse. Ingen kontaktpersoner er gættet. Eksempelforeningen Solsiden
bevares i databasen og arbejdsområderne, men udelades fra den offentlige lokale
oversigt, når katalogets rigtige foreninger er indlæst. Der er ikke deployet.

## Adgang og revisioner

Kalender og oprettelse ligger på `/kalender.html`. Nye arrangementer bruger
`GET/POST /events` med de eksisterende private links, revisioner, rettelser,
aflysninger og ICS. Godkendte foreningsmedlemmer udgiver direkte. Gæster og
brugere uden foreningsadgang afventer TEB i Forening → TEBs arbejdsområde.

Ønsker om flyers, analoge byportaler, skærme og plakater gemmes i `channels`.
Ønsket om papirkalender gemmes i `printRequested`. De markeres under
oprettelse og bevares gennem rettelser og godkendelse. Papirkalender kræver
fortsat manuel udvælgelse, korrektur og et låst snapshot. Afsluttede PDF-filer
ændres ikke. Ekstern deling bestilles ikke automatisk. Præcise partnerlinks
afventer TEB.

Tidligere data i `posts` og `/posts`-API'en bevares. Gamle
`nyt.html?privat=...#adgang=...`-links viderestilles til
`kalender.html?indsendelse=...#adgang=...`. Det hemmelige token bliver i
fragmentet. Tidligere offentlige opslag og oprettelseslinks viderestilles
også. Gamle opslag kan gennemgås via `kalender.html#godkendelse`; udgivne
arrangementsopslag bruger stadig samme kanoniske arrangements-id. Nye
kvitteringsmails peger direkte på kalendersiden.

Den gamle `/experiment/*`-API og `experiment_posts` bevares som et separat,
kun lokalt sandkasselager. De er ikke datakilden til den offentlige kalender.

OTP har seks tilfældige cifre, ti minutters levetid og højst fem forsøg.
Der er mindst 60 sekunder mellem nye koder pr. mail, håndhævet atomisk i databasen.
Anmodninger begrænses desuden pr. mail, IP og globalt. Svaret indeholder
`resendAfterSeconds` og `accessState: linked|unlinked`, men ingen foreningsnavne
før verificering. HTTP 429 har `retryAfterSeconds` og `Retry-After`. Verifikation begrænses pr.
mail, IP og challenge. Ny kode ugyldiggør tidligere challenges og afventende
mailjobs. Databasen gemmer en HMAC af kode og challenge-id, aldrig selve koden.
Indløsning, brugeroprettelse, session og invitationsaccept sker atomisk.

Sessions er serverlagrede og har otte timers absolut levetid. Cookien er
HttpOnly, SameSite=Strict og Secure ved HTTPS. Kun lokal loopback-drift tillader
HTTP. Alle mutationer kræver samme Origin og JSON. Autorisation kontrolleres
igen i selve SQL-skrivningen, så tilbagekaldte rettigheder ikke kan bruges af
et gammelt browserfaneblad eller et allerede igangsat write.

`TEB_ADMIN_EMAILS` er en kommasepareret liste over de godkendte administratorers
mailadresser. Et succesfuldt OTP-login til en af disse adresser opretter eller
ophøjer den eksisterende bruger til TEB-admin. Ingen klientfelter kan sætte
`isAdmin`. Fjernelse fra miljølisten alene tilbagekalder ikke en allerede tildelt
administratorrolle. Ved fratrædelse skal en operatør også sætte den pågældende
`users.is_admin=0` og udløbe brugerens sessions. Dette er ikke en offentlig API.

Ukendt verificeret mail giver kun adgang til egne adgangsanmodninger. En TEB-
godkendelse kræver `verified:true` og inviterer ansvarlig. Invitationen gælder
syv dage. Kun en OTP, som blev anmodet efter invitationen til den samme mail,
kan aktivere den. En gammel session eller en gammel kode aktiverer ikke en ny
invitation. Invitationen kan accepteres én gang. Ansvarlig inviterer kun
redaktører og kan kun fjerne redaktører. TEB kan tildele begge roller og fjerne
ansvarlige. TEBs ændring af en rolle kræver en ny OTP fra modtageren; den gamle
adgang ophører straks. Gentagen invitation med samme rolle genbruger den
igangværende invitation uden en ny mail.

Profiloplysninger til offentlig kontakt er adskilt fra loginmail og medlemsliste.
Foreningsmedlemmer kan ændre egen profil og direkte udgive, rette og aflyse egne
arrangementer. En gæsts oplyste forening giver aldrig medlemsrettigheder.

Gæsteindsendelser, rettelser og aflysninger godkendes af TEB. En ventende eller
afslået ændring erstatter ikke den offentliggjorte version. Privat adgang kræver
Bearer-tokenet, hvis hash ligger i databasen. Mailens link har kun tokenet i
URL-fragmentet: `kalender.html?privat=...#adgang=...`. Tokenet må ikke sendes som query-parameter og må aldrig indgå i offentlige links.

Offentlig event-state hedder `approved` eller `cancelled`. Privat wrapper-status
er `pending`, `approved` eller `rejected`. En godkendt aflysning har altså
`status:approved` og `published.state:cancelled`. `pendingKind` er kun `new`,
`edit`, `cancel` eller null. Gæste-POST accepterer både kontraktens `edit` og
pilotens `update`. Revisionstal og atomiske writes forhindrer tabte ændringer
og dobbeltgodkendelse. Database-triggers gemmer udgivelseshistorik i samme write.

## Mail og sikker genafsendelse

Mailjobs gemmes krypteret med AES-GCM i samme D1-transaktion som den tilhørende
handling. `MAIL_ENCRYPTION_KEY` skal være en hemmelig 32-byte nøgle som 64
hextegn. Den bruges også som HMAC-hemmelighed til OTP. Lokal server laver sin egen
fil med rettighed 0600. En ny nøgle kan ikke dekryptere gamle mailjobs eller
verificere gamle OTP'er. Bevar den derfor ved normal genstart og deployment.

Tilstande er `pending`, `sent`, `local`, `failed`, `uncertain` og `cancelled`.
`sent` betyder mailtjenestens accept, ikke bekræftet modtagelse i postkassen.
Gæstens API-kvittering har `notificationState` og `receiptState`; invitation og
OTP-anmodning har `deliveryState`. Frontend skal vise både `failed` og `uncertain`
ærligt og bevare gemte indsendelser/private links.

Workers Email Service understøtter den strukturerede `TEB_EMAIL.send()`-binding.
Konkrete afvisninger før afsendelse, eksempelvis ikke-verificeret afsender eller
rate limit, kan genafsendes. En manglende binding er også en sikker fejl før
forsendelse. Cron hver tiende minut og admin-POST `/admin/mail/retry` genforsøger
kun sådanne jobs, højst fem forsøg. Atomisk claim forhindrer samtidige afsendere.
Udløbne OTP'er, ugyldiggjorte koder og tilbagekaldte invitationer genforsøges ikke.

En timeout, en ukendt providerfejl, manglende messageId eller en afbrudt dispatch
kan være accepteret hos udbyderen. Sådanne jobs bliver `uncertain` og sendes ikke
automatisk igen. Cloudflares dokumenterede Workers-send-API har ingen
idempotency-key. Derfor kan systemet ikke love sikker automatisk genafsendelse
af tvetydige transporter. Undersøg leveringsloggen først. En bruger kan anmode
om en ny OTP, som ugyldiggør den gamle kode. Gentagelse af et event-POST med samme
`requestKey` genafsender aldrig mails og opretter ikke et nyt event.

`GET /admin/mail` viser kun job-id, tilstand, forsøg og tidspunkt, aldrig
mailindhold, modtager, kode eller private links. Applikationen logger ingen
persondata eller secrets. Beskyt også Cloudflare-observability mod at opsamle
request bodies og Authorization-/Cookie-headere.

Reference: https://developers.cloudflare.com/email-service/api/send-emails/workers-api/

## Print og uforanderlige PDF'er

Print bruger skabelonen Farver og fællesskab med stor kondenseret overskrift,
TEBs trolde, grønne og rosa månedsfelter, dato/ugedag og QR til netkalenderen.
Skabelonen bruger de medfølgende OFL-skrifter Anton og Noto Sans. Lange tekster
ombrydes, og fyldte sider fortsætter med månedsoverskrift på næste side.

TEBs printfane på `forening.html#teb?fane=print` kræver et til-/fravalg ved
hvert arrangement. Ingen arrangementer er valgt på forhånd. Redaktøren kan
forkorte titel, praktiske oplysninger og arrangør alene til print. Datofelt og
dato-note kan tilpasses til fx en ugentlig aktivitet. Det ændrer ikke den
offentlige begivenhed eller dens dato. En ny korrektur kræves efter hver ændring.

`GET /admin/editions/events` med periode, frist og format returnerer de mulige
arrangementer og `reviewHash`. `POST /admin/editions/preview` og finalisering
modtager samme parametre plus `eventIds`, `reviewHash` og valgfri
`printOverrides: { [eventId]: {title,details,association,dateLabel,dateNote} }`.
Finalisering kræver eksplicit udvælgelse. En ændring i kalendergrundlaget siden
gennemgangen giver 409, før en ny udgave reserveres. Et genforsøg efter en
usikker finalisering genbruger derimod det allerede reserverede snapshot.
Det gamle GET-preview bevares til gennemgang af hele periodens grundlag.

Print understøtter `start`, `end`, `deadline` og `format:poster|a3`.
`poster` er 500 × 700 mm, A3 er 297 × 420 mm. Intervallet må dække højst et år.
Legacy `month=YYYY-MM` dækker fortsat den måned og den næste. Preview tillader en
tom udgave; finalisering kræver mindst ét godkendt event og en frist, som ikke er
i fremtiden. Fristen omfatter hele datoen i Europe/Copenhagen, også ved sommertid.

Snapshot vælger den senest offentliggjorte revision pr. event ved fristen, før
intervallet filtreres. En senere flytning, rettelse eller aflysning kan derfor
ikke ændre udgaven. Aflyste events ved fristen medtages ikke i printet.

Frontend skal gemme og genbruge samme `requestKey` ved usikker finalisering.
Snapshot reserveres én gang i D1, PDF sættes og gemmes med betinget oprettelse i
R2, og først derefter afsluttes udgaven i D1. R2-fejl efterlader ingen offentlig
færdig udgave. Samme nøgle genoptager det gemte snapshot. Et mistet svar efter
R2-lagring kan derfor genprøves uden at overskrive filen. Udgavens SHA-256,
objektnøgle og sidetal gemmes. GET henter de gemte bytes og regenererer dem ikke.

Pilotens gamle D1-udgaver havde kun datakopi. Deres eksisterende snapshot og id
bevares; første PDF-hentning fryser filen i R2 én gang. Historiske PDF-filer i
hjemmesidens øvrige arkiv berøres ikke. Konfigurér ikke en R2-livscyklusregel,
som sletter færdige udgaver. DB og R2 skal sikkerhedskopieres sammen.

Kun printskrifter, OFL-licenser og TEBs printlogo ligger i Workerens `assets/`. Interne asset-fetches
bruger ASSETS-bindingen. Workerens fetch-handler returnerer 404 uden for API,
så den hverken serverer hovedsitet eller laver pilotens redirect/noindex.

## Migration og validering

`0001_calendar.sql` er uændret. `0002_association_portal.sql` tilføjer tabeller,
kolonner og historiktriggers. Den lokale SQLite-adapter bruger `d1_migrations`,
anvender hver migration i én transaktion og kan genåbne en gammel pilotdatabase
uden at ændre eksisterende event-/printindhold. Tag en backup før en operatør
vælger at åbne en eksisterende database med `CALENDAR_DATA_DIR`.

```sh
npm test
npm run test:integration
npm run test:pdf
npm run test:cloudflare
```

Backendtests bruger hver sin database i hukommelsen og mock-mail. HTTP-testen
starter sin egen loopback-server, bruger en midlertidig database/R2, prøver seed
to gange, OTP, rettigheder, gæstegodkendelse, aflysning og PDF. Den rydder server
og data op efter sig. Den læser kun de eksisterende site-filer og er ingen
frontend-/browsertest; den endelige UI-test sker efter integration af site-koden.

PDF-testen kræver `pdftoppm` og `pdftotext` fra Poppler. Den laver poster/A3 med
45 fiktive events, kontrollerer at alle findes i PDF-teksten og renderer alle
sider til `calendar-worker/.wrangler/pdf-check/` til visuel kontrol.
Cloudflare-testen laver først en Wrangler dry-run og kører derefter den faktiske
workerd-motor med lokal D1/R2 og interne font-assets. Den dækker også historik-
triggers og D1s batch-/ændringstællere. Den lokale adapter tæller triggerwrites
på samme måde som D1. Intet uploades eller provisioneres.

`npm run build` kan desuden køres alene som en Wrangler dry-run.

## Staging og produktion

Ingen ressourcer oprettes af denne kodeleverance. `wrangler.jsonc` og
`wrangler.staging.jsonc` har placeholder DB-id'er og ingen routes. `workers_dev`
og preview-URL'er er deaktiveret. Erstat og kontrollér alle værdier før deployment.

Hvert miljø kræver sin egen D1, R2, mailnøgle, verificerede afsender og godkendte
TEB-administratorer. Staging har en eksplicit modtager-allowlist og skal bruge
en særskilt origin. `LOCAL_PREVIEW` skal være `false` i begge miljøer.

Operatørens rækkefølge efter separat godkendelse:

1. Vælg den rigtige Cloudflare-konto og allerede provisionerede D1/R2-ressourcer.
   Indsæt konto, database-id, bucket og den præcise same-origin HTTPS-adresse.
2. Sæt `EDITOR_EMAIL`, `EMAIL_FROM`, `TEB_ADMIN_EMAILS` og den hemmelige
   `MAIL_ENCRYPTION_KEY`. Bekræft Workers Email Service og afsenderverifikation.
3. Tag backup, og anvend migrationerne med den valgte miljøkonfiguration.
   Eksempel: `npx wrangler d1 migrations apply teb-kalender-staging --remote --config wrangler.staging.jsonc`.
4. Tilføj KUN routen `det-valgte-domæne/api/kalender/*`, med korrekt zone.
   Tilføj eventuelt samme route for et andet hostname kun hvis frontend faktisk
   bruges dér og har samme valgte `PUBLIC_ORIGIN`. Overtag aldrig `/`, `/admin/`,
   `/*` eller `/api/formular*`. Hjemmesiden bliver på den eksisterende Pages-drift.
5. Deploy Worker og site som separate leverancer. Afprøv OTP til godkendte
   modtagere, gæstegodkendelse, invitation, tilbagekaldelse og R2-download.
   Kontroller også gammel kontaktformular, CMS og hjemmesideforside.

Lokal succes eller et dry-run beviser ikke reel maillevering, provisionerede
Cloudflare-rettigheder, browseraccept eller produktionsdrift. De gamle
`/admin/login` og `/admin/session` magic-link-endpoints er erstattet af OTP.
Frontend skal bruge `/auth/request`, `/auth/verify`, `/auth/logout` og `/session`.
