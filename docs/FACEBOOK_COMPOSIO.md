# Facebook-statistik gennem Composio

## Virker lokalt den 11. november 2026

Composio CLI 0.6.0 er installeret på Marinus' Mac. Hans eksisterende Facebook-
forbindelse i **For You** er genbrugt. Det lokale CLI-login er godkendt af
brugeren, og TEBs Page-id `1360070047179461`, navn og `ANALYZE`-opgave er
bekræftet med API-kald. Der er ikke oprettet en ny Meta-app.

Et rigtigt historisk scriptkald hentede ni Page-metrics med hver 730 daglige
observationer for forespørgselsperioden 11. november 2024 til 11. november 2026.
Slutdatoen er eksklusive ved midnat UTC. Desuden kom 25 publicerede opslag
fra 22. september til 7. november 2026 med performance og engagementstal.
Det er de opslag, som API'et returnerede; det er ikke et løfte om hele sidens
historiske arkiv eller alle tal, der findes i Business Suite.

Ingen metrics blev meldt unsupported i denne kørsel. API'et kan returnere nul
også før sidens aktivitet begyndte; disse værdier er beholdt som leveret.
Der er ikke publiceret eller ændret Facebook-indhold. Ingen adgang er delt
med Arthur. En daglig scheduler er ikke aktiveret.

## Kør igen på denne Mac

Fra repoets rod:

```sh
node scripts/facebook-composio.mjs pull
```

Det gentager hele indsamlingen. For en kortere Page-periode, mens alle
publicerede opslag stadig genmåles:

```sh
node scripts/facebook-composio.mjs pull --days 28
```

En fast periode vælges med `--since YYYY-MM-DD --until YYYY-MM-DD`.
Perioden må være op til 730 afsluttede UTC-dage. Scriptet deler forespørgslerne
i vinduer på højst 90 dage. `check` validerer kun den lokale konfiguration
uden at kontakte Composio eller læse credentials.

## HTML-rapport efter hver kørsel

`pull` gemmer nu også `data/report.html` ved siden af `latest.json`.
Åbn filen i en browser. Den indeholder perioderne 7, 28 og 90 målte døgn samt
aktiv periode, sammenligning med foregående periode, en interaktiv dagsgraf
og alle opslag med søgning, sortering, fuld tekst og links til Facebook.
Første skærmbillede samler seks nøgletal, ugens udvikling, følgertilgang,
mest reagerede opslag, dagsgraf og top fem i kompakt form. Hele opslagslisten,
dagsdata og definitioner ligger i lukkede, foldbare sektioner. Klik et topopslag
for at læse teksten. På en 1280 × 720-skærm vises hele overblikket uden rulning.

Gendan rapporten fra allerede hentede data uden login eller nye API-kald:

```sh
node scripts/facebook-report.mjs
```

Andre snapshot- og outputstier kan vælges med `--input` og `--output`:

```sh
node scripts/facebook-report.mjs --input /privat/mappe/snapshot.json --output /privat/mappe/rapport.html
```

Rapporten er én selvstændig HTML-fil med indlejrede data og uden netværkskald,
eksterne billeder, biblioteker eller skrifttyper. Den kan åbnes offline og gives
til Arthur uden at give ham credentials. Den indeholder stadig sidens private
analysedata og skal opbevares privat. Generatoren ligger i Git; rapporten gør ikke.

Page-tal og opslagstal holdes særskilt: førstnævnte gælder valgt periode,
sidstnævnte er lifetime-tal ved hentningen. Opslagsfilteret gælder udgivelsesdatoen.
Daglige unikke viewers vises som gennemsnit, aldrig som summeret perioderækkevidde.
Følgerbeholdning summeres ikke. Manglende tal vises som en tankestreg;
berørte totaler beregnes ikke. Datoerne viser Metas døgnslut, ikke danske kalenderdøgn.
Hele manglende døgn eller modstridende duplikater afvises, så perioderne ikke forskydes.

Ved en kort `--days`-kørsel forkortes rapportens periode ligesom `latest.json`.
En procentændring vises kun med en fuld foregående periode og en positiv baseline.
Fejler HTML-genereringen efter gemt snapshot, siger collectoren det særskilt;
JSON-data er stadig gemt, og sidste gode HTML-rapport bevares. Gentag da kun generatoren.

## Rapport som HTML-mail

Byg en statisk mailversion fra seneste snapshot:

```sh
node scripts/facebook-report.mjs --email
```

Det gemmer `data/report-email.html` privat ved siden af browserrapporten.
Mailversionen bruger tabeller og inline-CSS, seks nøgletal, korte indsigter,
top fem opslag med links og visninger i blokke af højst syv målte døgn.
Der er ingen JavaScript, eksterne billeder eller vedhæftninger i mailindholdet.
[Gmails CSS-reference](https://developers.google.com/workspace/gmail/design/css)
er brugt til layoutet. Outlooks klassiske renderer har en fast tabelbredde
via betinget markup. Browserkontrol erstatter ikke test i den konkrete mailklient.

`renderFacebookEmail(model)` fra `scripts/facebook-report-email.mjs` returnerer
`{subject, html, text}`. En mailintegration sender HTML som `text/html` i selve
beskeden og eventuelt `text` som `text/plain` i en `multipart/alternative`.
HTML-filen skal ikke tilføjes som attachment. Et faktisk testbrev er sendt til
brugerens egen Gmail-konto efter udtrykkeligt valg af modtager; readback bekræftede
INBOX, samme HTML-body og ingen vedhæftninger.

Kommandoen genererer kun filen. Hverken den eller `pull` sender mails automatisk.
Modtagere og en eventuel løbende udsendelse skal aftales særskilt. Mail-login og
private mailfiler gemmes ikke i repoet.

## Arthur sætter sin egen computer op

1. Hent repoet og checkout `local/teb-pilot-ready`. Kræver Node.js 24 eller nyere.
2. Kør opsætningen fra repoets rod:

   ```sh
   sh scripts/setup-facebook-composio.sh
   ```

3. Log ind på **sin egen** Composio-konto i browseren. Hvis Facebook ikke er
   forbundet, åbner helperen forbindelsesflowet. Vælg en Facebook-konto med
   Insights-adgang til TEB. En eksisterende Insights-invitation skal være accepteret.
4. Kør indsamlingen:

   ```sh
   node scripts/facebook-composio.mjs pull
   ```

Helperen installerer om nødvendigt CLI fra Composios officielle installer,
som verificerer releasearkivets checksum. Den installerer ingen agent-plugin
og ændrer ikke shellens opstartsfiler. CLI-login gemmes af Composio under
`~/.composio/`, uden for repoet. Browseren viser adgangens omfang, før login
godkendes. Der bruges ingen npm-pakker til selve collectoren.

Har man flere aktive Facebook-forbindelser, skal man vælge en konkret:

```sh
~/.local/bin/composio connections list --toolkit facebook
sh scripts/setup-facebook-composio.sh --account ca_CONNECTION_ID
```

Helperen genbruger eksisterende login. Den vil ikke selv vælge mellem flere
Facebook-konti. `TEB_COMPOSIO_CLI` kan pege på en anden CLI-installation.
På andre operativsystemer skal Node og Composio CLI installeres, før `setup`
køres. Node-collectoren kan køre på macOS og Linux; Windows kræver en shell
til helperen eller de tilsvarende manuelle CLI-kommandoer.

Manuel opsætning uden shell-helper:

```sh
composio login --no-skill-install --yes
composio link facebook
node scripts/facebook-composio.mjs setup
```

Spring `link facebook` over, hvis kontoen allerede er forbundet. Der skal
ikke kopieres loginfiler, Composio-nøgler eller Marinus' private konfiguration
til Arthur. Han får sin egen forbindelse og sine egne lokale filer.

## Hvor data og konfiguration ligger

Standardmappe:

```text
~/Library/Application Support/TEB/facebook-composio/
  config.json
  data/latest.json
  data/report.html
  data/report-email.html
  data/snapshot-<tidspunkt>-<uuid>.json
```

`config.json` indeholder Page-id, ønskede metrics og Composios konto-/projekt-id'er,
men ingen credentials. Den oprettes lokalt af `setup`; den deles ikke gennem Git.
På Linux bruges samme relative mappe under brugerens hjemmemappe, eller vælg
eksplicitte stier med `--config` og `--output`.

Hvert `snapshot` indeholder Page-profil, historikvinduer, rå metricnavne og
`end_time`, samt hvert opslags id, tekst, publiceringstid, permalink, billed-URL,
reaktioner, kommentarer, delinger og lifetime-statistik for views og viewers.
Kommentarernes tekst og personer hentes ikke; kun samlet antal.
Reaktioner, kommentarer eller delinger, som API'et ikke leverer, bliver `null`.
Tomme og unsupported metrics markeres, og unikke viewers summeres ikke.

Snapshot-filer er observationer fra den pågældende kørsel. Lifetime-tal kan
ændre sig mellem kørsler, og billed-URL'er kan udløbe. Billeder downloades ikke.
En kort `--days`-kørsel gør `latest.json` kortere, mens tidligere fulde snapshots
bevares. Der flettes ikke automatisk en historisk database på tværs af snapshots.

Mapper får 0700, filer 0600. Output inde i repoet eller websitet afvises, også
via en symlink. `latest.json` erstattes atomisk efter en gennemført indsamling.
Fejler adgang, pagination, API eller disk, bevares sidste gode snapshot.
En `.collector-lock` forhindrer parallelle kørsler i samme outputmappe. Fjern
kun en efterladt lås, når det er kontrolleret, at ingen collector stadig kører.

## Adgangsgrænser og livekontrol

CLI-login er en bred, lokal brugernøgle til brugerens Composio-organisationer
og projekter. Den er ikke en TEB-specifik læsenøgle. Den må ikke deles med
Arthur eller lægges i Git. Forbindelsen omfatter også andre Facebook-sider,
så collectoren verificerer TEBs id, navn og Insights-opgave før indsamling.
Hvert opslags-id kontrolleres mod samme Page-id.

Collectoren kalder kun fem faste Facebook-læseværktøjer. Den bruger ikke en
sprogmodel eller vilkårlig agentkode. Klienten afviser andre tool-slugs lokalt
og sender en sessionkonfiguration med kun disse værktøjer, fast forbindelse,
Instant slået fra, ingen proxy og intet workbench.

En ekstra livekontrol viste imidlertid, at sessionens execute-endpoint kunne
udføre et read-only identitetsværktøj uden for den konfigurerede værktøjsliste.
Derfor behandles Composios værktøjsliste **ikke som en verificeret sikkerhedsgrænse**
mod nogen, der har brugernøglen og kan sende egne API-kald. En publicationstest
med tomme argumenter blev afvist på manglende input og beviser ikke, at en
gyldig skrivehandling ville blive afvist. Ingen gyldig publicering blev forsøgt.

Denne leverance giver derfor ikke Arthur en session eller nøgle fra Marinus.
Egen loginforbindelse på Arthurs maskine er det understøttede setup. Hvis han
senere skal have adgang til Marinus' indsamling, bør det være gennem et særskilt
privat data-endpoint eller filadgang, uden provider- eller Composio-credentials.
TEB-forbindelsens egen Page-opgave er `ANALYZE`, men det erstatter ikke behovet
for at beskytte den bredere Composio-nøgle og andre tilknyttede konti.

## Scheduler og kontroller

`scripts/facebook-composio.launchd.example.plist` er en skabelon til kl. 07.15
i Mac'ens lokale tidszone. Erstat pladsholderne med absolut Node-sti, repo-sti
og en eksisterende privat logmappe. Installer den kun, når den ønskede tid og
værtsmaskine er aftalt. På en server kan samme `pull`-kommando kaldes af systemd
eller cron. Scriptet kræver ikke, at en chat er åben.

```sh
node --test scripts/facebook-composio.test.mjs scripts/facebook-analytics.test.mjs scripts/facebook-report.test.mjs
sh -n scripts/setup-facebook-composio.sh
plutil -lint scripts/facebook-composio.launchd.example.plist
```

Primære kilder undersøgt 11. november 2026:

- [Composio CLI og lokal login](https://docs.composio.dev/docs/cli).
- [For You og consumer-projekter](https://docs.composio.dev/docs/consumer-agents).
- [Facebook-værktøjernes aktuelle felter og metrics](https://docs.composio.dev/toolkits/facebook).
- [Session-API](https://docs.composio.dev/reference/api-reference/tool-router/postToolRouterSession).

Den tidligere direkte Graph API-collector er bevaret som alternativ i
`scripts/facebook-analytics.mjs`. Dens rå Page-token-opsætning bruges ikke af
Composio-løsningen.
