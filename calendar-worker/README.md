# Tistrup Kalenderen, pilot

Den aktive kalenderbackend ligger i `calendar-worker/`. Den bruger samme
applikationskode med lokal SQLite og Cloudflare D1. Den separate PWA i `app/`
er ikke ændret.

Alle indsendelser, rettelser og aflysninger skal godkendes af TEB. Hverken en
oplyst forening eller en e-mailadresse behandles som verificeret medlemskab.
Der oprettes ingen foreningskonti.

## Kør og prøv lokalt

Kræver Node 24 eller nyere. SQLite i Node 24 kan vise en experimental-advarsel.

```sh
cd calendar-worker
npm install
npm run dev
```

Åbn <http://localhost:8787/kalender.html>. Serveren binder kun til loopback og
gemmer data i `tmp/kalender-pilot/calendar.sqlite`, som er ignoreret af git.
Alle mails gemmes i den lokale testpostkasse. Ingen eksterne mails sendes.

I en anden terminal kan `npm run seed` tilføje 14 opdigtede, godkendte
arrangementer, én ventende indsendelse og en printudgave. Scriptet stopper, hvis
kalenderen allerede har offentlige arrangementer, og kan kun køre lokalt.

- `/foreningsportal.html`: indsendelse og forhåndsvisning.
- `/mit-arrangement.html`: privat link fra kvitteringen til rettelser/aflysning.
- `/kalender-redaktion.html`: TEBs godkendelse og printudgaver.
- `/kalender-postkasse.html`: lokal test af mails og adgangslinks.
- `/kalender.html`: kun offentliggjorte arrangementer og afsluttede PDF-udgaver.

Test forløbet ved at indsende, åbne TEBs besked i testpostkassen, åbne redaktionen
og trykke Godkend. At åbne et mail- eller adgangslink offentliggør ikke noget.

## Godkendelse og adgang

TEB får en mail for hver ny indsendelse og hver rettelse eller aflysning.
Mailen indeholder oplyst forening, kontaktmail og et link til redaktionen.
Adgangslinket kan bruges én gang og udløber efter 48 timer. Det giver en
HttpOnly-session med SameSite=Strict i otte timer. Linkets hemmelige del står i
URL-fragmentet, fjernes fra adresselinjen og sendes kun i en POST til serveren.

Afsenderens private link giver kun adgang til det pågældende arrangement.
Databasen gemmer hashes af adgangsnøglerne. En ventende rettelse ændrer ikke den
offentlige version. TEB kan rette teksten inden godkendelse. Afvisning kræver en
begrundelse, og afvisning af en rettelse bevarer den hidtil godkendte version.
Versionskontrol forhindrer godkendelse af et udkast, der er ændret undervejs.

Offentlige svar og PDF-filer indeholder ikke kontaktmail, adgangsnøgler eller
interne bemærkninger. Mulige dubletter vises til redaktionen; systemet sletter
eller sammenlægger dem ikke automatisk.

## Print

En udgave dækker to måneder og er 500 × 700 mm. Standardfristen er den 15. i
måneden før udgivelsen. TEB vælger fristen, gennemser PDF og afslutter udgaven.
En udgave kan ikke afsluttes med en fremtidig frist.

En afsluttet udgave er et uforanderligt snapshot af den senest godkendte version
pr. fristdato i Europe/Copenhagen. TEB skal afslutte udgaven efter den aftalte
indsendelsesfrist. Senere rettelser og aflysninger ændrer ikke en udgivet udgave.
PDF-filen hentes fra snapshotdata, ikke fra den aktuelle kalender.

Titel, forening, dato, tidspunkt og sted sættes automatisk. Lange beskrivelser
bliver på hjemmesiden. Travle måneder giver flere sider ved samme skriftstørrelse;
ingen arrangementer udelades. Tegn, skrifttypen ikke understøtter, giver en fejl
inden udgivelse. Print gennemgås i alle tilfælde af TEB før tryk.
Lokale PDF-filer mærkes PRØVEUDGAVE. Noto Sans er inkluderet med sin OFL-licens.

## Validering

```sh
npm test
npm run test:browser
npm run build
```

Backendtests bruger en separat database i hukommelsen. Browsertesten bruger en
isoleret lokal server på port 8788, en separat database og separate browserkonti
for afsender og TEB. Den rydder sin server og database op bagefter. Den bruger
en installeret Google Chrome på macOS; tilpas executablePath ved andre systemer.
Ingen af testene sender rigtig mail.

## Offentlig pilot på Cloudflare

Der er endnu ikke oprettet en offentlig Worker, database eller mailopsætning til
denne pilot. Den eksisterende TEB-produktion og Pages-preview er ikke ændret.
Den senest kontrollerede Wrangler-login har kun Pages-rettigheder på Business
and Fitness-kontoen. Konto og adgang til afsenderdomænet skal afklares først.

1. Bekræft korrekt Cloudflare-konto med `wrangler whoami`. Få Worker-, D1- og
   Email Service-rettigheder på den konto, der skal drive piloten.
2. Opret en separat database med `wrangler d1 create teb-kalender-pilot` og indsæt
   dens rigtige `database_id` i `wrangler.jsonc`.
3. Sæt `PUBLIC_ORIGIN` til pilotens præcise HTTPS-adresse, `EDITOR_EMAIL` til
   TEBs godkendte modtageradresse og `EMAIL_FROM` til en verificeret afsender.
   Brug ikke en offentlig localhost-adresse. `LOCAL_PREVIEW` skal være udeladt.
4. Aktivér Cloudflare Email Service og verificér afsenderdomænet. Afsendelse til
   foreningernes vilkårlige kontaktadresser kræver Workers Paid ifølge Cloudflare.
   Login-adgang alene aktiverer ikke denne tjeneste eller levering.
5. Kør `wrangler d1 migrations apply teb-kalender-pilot --remote` og derefter
   `npm run deploy`. Konfigurationen har ingen route til produktionsdomænet.
6. Test en konkret indsendelse, modtagelse hos TEB, eksplicit godkendelse,
   kvittering, privat rettelse og PDF på den rigtige adresse. Bekræft levering i
   postkassen; et messageId beviser kun mailtjenestens accept.

Hvis mail ikke er konfigureret, er offentlig indsendelse lukket. Hvis en
afsendelse fejler efter lagring, bevares indsendelsen, og fejlen vises i
kvitteringen og redaktionen. En usikker indsendelse genbruges med samme nøgle,
så et nyt klik ikke opretter et ekstra arrangement eller blindt sender mail igen.

Reference for mailbindingen:
<https://developers.cloudflare.com/email-service/api/send-emails/workers-api/>

## Afgrænsning

Indsendelse pr. almindelig mail går stadig til den eksisterende Gmail-postkasse.
TEB indtaster mailens arrangement gennem formularen og godkender det bagefter.
Automatisk læsning af Gmail, Facebook-publicering, Tistrup Nyt-integration og
partnerlinks er endnu ikke implementeret. De rigtige partnere skal oplyses først.

En parallel implementering er bevaret lokalt i `tmp/kalender-alternativ/`. Den
er ikke koblet til denne pilot. Produktions-CMS, kontakt-/indmeldelsesworker,
gamle hjemmesidearkiver og PWA er bevaret.
