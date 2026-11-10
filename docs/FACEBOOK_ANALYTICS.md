# Automatisk Facebook-statistik til TEB og Arthur

## Status den 11. november 2026

Arthur havde inviteret Marinus Hvelplund til TEB-siden med opgaven **Insights**.
Invitationen er accepteret efter brugerens udtrykkelige godkendelse. Meta viste
`Invite Accepted`, og TEBs Page- og opslagstal kunne læses i Business Suite.

Brugeren ønsker en automatisering eller et script. Manuel Business Suite-eksport
er derfor fravalgt. To rapporter blev startet under undersøgelsen, men de bruges
ikke som datagrundlag for løsningen. En download blev forsøgt uden en verificeret
lokal fil. Den offentlige profiladresse bruger `61594168058446`, mens Meta Business
Suite identificerede siden med `asset_id=1360070047179461`. API-identiteten skal
verificeres ved første rigtige kørsel; scriptet stopper ved forkert id eller navn.

Collector og scheduler-skabelon er implementeret. Ingen API-token er oprettet,
ingen live API-kørsel er verificeret, og ingen tidsplan er installeret endnu.

## En eksisterende eller delt Meta-app kan bruges

Der behøves ikke en separat app til hver Facebook-side. Brug en eksisterende,
betroet app, hvis dens tilladelser og adgangsniveau omfatter denne anvendelse.
TEB skal autorisere sin egen side. En anden sides token giver ikke TEB-adgang.
Godkendelse af en personlig Insights-invitation opretter heller ikke en API-token.

Den eksisterende **B&F - Reporting App**, app-id `739823815239924`, er bekræftet
i Metas dashboard. Under Permissions and Features viste alle tre tilladelser
`pages_show_list`, `pages_read_engagement` og `read_insights` **Advanced access
granted**. Appen er derfor en konkret mulighed for genbrug; en ny app er ikke
nødvendig for at komme videre. Det beviser endnu ikke, at TEB er autoriseret
eller at en Page-token virker. Live-opslag via AIOS-connectoren svarede 401.
Den nuværende AIOS-loginflow anmoder også om annonceadministration, hvilket skal
vurderes, før det bruges til denne afgrænsede læseopgave. Ingen AIOS-kode er ændret.

Collector er uafhængig af AIOS og app-ejeren. Den kræver en Page access token med
den nødvendige læseadgang, typisk `pages_read_engagement` og `read_insights` samt
`pages_show_list` under valg af side. App-ejeren skal verificere adgangsniveau,
eventuel App Review og den autoriserende persons Insights-opgave i Meta. Der
anmodes ikke om publicering, beskeder eller annonceændringer af collector-scriptet.

## Kør scriptet

Den nuværende implementering bruger Meta Graph API direkte. Composio er
undersøgt som alternativ, men er endnu ikke koblet på scriptet. Ingen
Composio-konto, forbindelse eller deling er oprettet i denne leverance.

Kræver Node.js 24 eller nyere. Der er ingen ekstra npm-afhængigheder.

```sh
node scripts/facebook-analytics.mjs --check-config
node scripts/facebook-analytics.mjs
```

Første kommando validerer kun konfigurationen. Den læser ingen token og kontakter
ikke Facebook. Anden kommando henter data fra Graph API, når token er tilgængelig.
Standardkonfigurationen ligger i `config/facebook-analytics.example.json`.
API-versionen er eksplicit fastlåst til `v26.0`; metrics er kandidater, som skal
bekræftes med den rigtige token. Ingen af dem er påstået liveverificeret for TEB.
En lokal konfiguration kan gemmes som ignoreret `config/facebook-analytics.local.json`
og vælges med `--config`. Konfigurationen må aldrig indeholde credentials.

En fast historisk periode kan vælges, eksempelvis:

```sh
node scripts/facebook-analytics.mjs --since 2026-10-13 --until 2026-11-10
```

`since` er inklusive og `until` eksklusive ved midnat UTC. Standard er de seneste
28 afsluttede UTC-dage for Page-statistik. Opslagslisten bruger separat 90 dages
publiceringshistorik, så performance for tidligere opslag bliver opdateret igen.
Alle opslag i det vindue gennemløbes med pagination, og hvert opslag har ét
sæt lifetime-statistik pr. snapshot. `--since` ændrer ikke opslagshistorikkens længde.
Tilpas `postLookbackDays`, hvis ældre opslag skal genmåles. Stories og særlige
reels-endpoints er ikke med; et reel, som findes i `published_posts`, behandles
som et opslag og kan have metrics, som kræver en konfigurationsændring.

## Token og private filer

Token læses fra `TEB_FB_PAGE_ACCESS_TOKEN`, injiceret af en secret manager eller
serverens scheduler. Giv aldrig token som kommandolinjeargument, i chat eller i Git.
På macOS kan scriptet i stedet læse en eksisterende generisk adgangskode i
login-Keychain med service/navn `TEB Facebook analytics` og konto `1360070047179461`.
Opret feltet direkte i Keychain Access; indsæt token som adgangskode der.
Scriptet opretter eller ændrer ikke credentials. Et eventuelt OS-adgangsspørgsmål
besvares af brugeren. Hvis API'et viser et andet Page-id, skal både konfiguration
og Keychain-konto bekræftes og ændres sammen.

Standardoutput er `~/Library/Application Support/TEB/facebook-analytics/`.
Der gemmes daterede `snapshot-*.json` og atomisk opdateret `latest.json` med
schemaVersion, API-version, hentetidspunkt, datoperiode, Page-id, daglige
Page-metrics samt opslags-id, tekst, permalink, publiceringstid og lifetime-metrics.
Mapper får 0700 og filer 0600. `--output` kan vælge en anden privat mappe uden for
repoet. Output inde i Git-repoet eller websitet afvises, også gennem en symlink.
Arthur kan læse JSON-formatet fra sin egen server eller modtage filerne via en
aftalt privat overførsel. Ingen data sendes automatisk til Arthur eller en chat.

Der følges kun pagination på præcis samme Graph API-endpoint. Token sendes som
Authorization-header og fjernes fra pagination-URL'er. API-fejl skrives uden
Metas potentielt credentialbærende fejltekst. Udløbet token, manglende rettigheder
eller ugyldig metric giver exitkode 1; seneste gode snapshot bevares. En tom metric
markeres `empty`, aldrig som nul. Gentagne kørseler skaber nye snapshots uden
at ændre TEBs Facebook-side. En lås forhindrer samtidige kørseler i samme mappe.
Ved et afbrudt program kan `.collector-lock` blive stående; fjern den kun efter
kontrol af, at ingen collector kører. Rå `end_time` fra Meta bevares. De må ikke
automatisk omdøbes til danske kalenderdage eller summeres som unik rækkevidde.

## Daglig automatisering

`scripts/facebook-analytics.launchd.example.plist` er en macOS-skabelon, som
kører kl. 07.15 i computerens lokale tidszone. Erstat de tre sti-pladsholdere
med absolut Node-sti, repo-sti og en eksisterende privat logmappe. Placér den
færdige fil i `~/Library/LaunchAgents/dk.teb.facebook-analytics.plist` og aktivér
den med `launchctl bootstrap gui/$(id -u) <absolut-plist-sti>`. Token læses fra
Keychain. Computeren og den relevante brugersession skal være tilgængelige.

På Arthurs Linux-server kan samme Node-kommando kaldes af systemd eller cron
med en token injiceret fra hans secret manager og en eksplicit privat `--output`.
Der er ikke oprettet en Codex-påmindelse; det er selve scriptet, som skal køre.

Aktivering af en tidsplan følger først efter én vellykket live API-kørsel og
aftale om værtsmaskine. Test af mocks beviser ikke tokenens adgang, Metas
metric-understøttelse eller at en scheduler faktisk kører.

## Composio som alternativ og adgang til Arthur

Composios Facebook-toolkit dokumenterer managed OAuth samt Page Insights,
Post Insights og opslagshentning. Det kan derfor være et enklere første valg
end en ny Meta-app. Det skal dog prøves med TEBs konkrete Insights-adgang,
og de nødvendige scopes skal kontrolleres på samtykkeskærmen. Composio
erstatter forbindelses- og tokenhåndtering; en scheduler skal stadig køre
de deterministiske datakald uden et sprogmodel-loop.

Anbefalet første version: brugeren ejer en særskilt TEB-forbindelse og kører
collectoren på sin egen maskine eller server. Arthur får kun de indsamlede
JSON-data gennem en aftalt privat filoverførsel eller læse-API. Dermed skal
han ikke have brugerens Facebook-login, Meta-token eller Composio-projektnøgle.
Automatisk levering til Arthur er ikke implementeret eller aktiveret endnu.

Hvis Arthur senere skal have direkte adgang, kræver det eksplicit deling af
netop TEB-forbindelsen med hans identitet, fast valg af dens connection-id og
håndhævede begrænsninger til de relevante læsehandlinger. En session med få
værktøjer begrænser ikke i sig selv en bred projektnøgle, som kan kalde andre
endpoints. Del derfor ikke en fuld projektnøgle, og giv ikke projektadministration
til et script alene for at læse statistik. Composios shared-connection-ACL er
beskrevet som eksperimentel; den er ikke konfigureret eller testet her.

Det er fortsat en arkitekturanbefaling, ikke en påstand om, at en allerede delt
forbindelse er sikker. Den endelige adgang skal kontrolleres med et positivt
analytics-kald og afviste forsøg på publicering og adgang til andre konti.

- [Facebook-toolkit og managed OAuth](https://docs.composio.dev/toolkits/facebook).
- [Delte forbindelser og eksplicit ACL](https://docs.composio.dev/docs/extending-sessions/shared-connections).
- [Private forbindelser og projektnøgler](https://docs.composio.dev/kb/guide/consumer-project-boundaries-and-auth-selection).
- [Tilladelser for projektnøgler](https://docs.composio.dev/reference/authenticating-to-composio/project-api-key-permissions).

## Kontrol og kilder

```sh
node --test scripts/facebook-analytics.test.mjs
```

Testene dækker blandt andet forkert Page, pagination, dubletter, tidsvinduer,
tokenlækage, API-fejl, retry, tomme metrics og bevarelse af seneste gode snapshot.

Primære kodekilder undersøgt 10.–11. november 2026:

- [Metas SDK-konfiguration med API-version](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/apiconfig.py).
- [Metas Page SDK med Insights-parametre](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/page.py).
- [Metas Post SDK med Insights-parametre](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/post.py).
- [Airbytes egen Facebook Pages-integration og opsætningskrav](https://github.com/airbytehq/airbyte/blob/master/docs/integrations/sources/facebook-pages.md).

Metas dokumentationswebsite svarede HTTP 429 under undersøgelsen. Der blev
derfor også læst aktuelle, officielle SDK-kilder. Navne og adgang skal fortsat
bekræftes mod den rigtige Page og token inden drift.
