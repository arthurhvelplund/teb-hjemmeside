# Facebookrapport til Arthur

Én forbindelse, ét pull, færdig browserrapport og HTML-mail. Gmail-udsendelse
håndteres af Arthurs almindelige connector i ChatGPT. Der er ingen SMTP,
Gmail-CLI, lokal scheduler, database eller npm-pakker i rapportløsningen.

## Første gang

Kræver Node.js 24+, egen Composio-konto og en Facebook-konto med accepteret
Insights-adgang til Tistrup Erhvervs- og Borgerforening.

Hent repoets `local/teb-pilot-ready`-gren. Kør fra repoets rod:

```sh
sh scripts/setup-facebook-composio.sh
```

Helperen finder eller installerer Composios officielle CLI og åbner browserlogin
efter behov. Forbind Facebook, hvis det ikke allerede er gjort. Den verificerer
TEBs Page-id, navn og ANALYZE-adgang og gemmer konfigurationen lokalt.
Der skal ikke oprettes en ny Meta-app eller kopieres nøgler fra Marinus.

Hvis der er flere aktive Facebook-forbindelser, vælg en konkret:

```sh
~/.local/bin/composio connections list --toolkit facebook
sh scripts/setup-facebook-composio.sh --account ca_CONNECTION_ID
```

## Hver rapport

```sh
node scripts/facebook-composio.mjs pull
```

Det henter data og bygger begge rapporter. Intet ekstra build-trin er nødvendigt.
Resultatet ligger privat i:

```text
~/Library/Application Support/TEB/facebook-composio/
  config.json
  data/latest.json
  data/snapshot-<tidspunkt>-<uuid>.json
  data/report.html
  data/report-email.html
```

Åbn `report.html` for det interaktive overblik. `report-email.html` er den
færdige, statiske mailbody. HTML-mailen bruger tabeller og inline-CSS med
nøgletal, indsigter, top fem opslag og en enkel graf. Der er ingen scripts
eller eksterne billeder i mailen. Browserrapporten fungerer også offline.

## Send gennem ChatGPTs Gmail-connector

Giv ChatGPT adgang til den friske `report-email.html`, og brug fx:

> Læs report-email.html, og send hele dens HTML som mailens text/html-body
> gennem min Gmail-connector til [modtager]. Brug emnet TEB Facebookoverblik
> med rapportens dato. Rapporten skal stå i beskeden, ikke som vedhæftning.

Arthur vælger selv modtagere og tidsplan. En tilbagevendende opgave skal have
en tilgængelig kilde til frisk HTML/data. En lokal filsti alene giver ikke
ChatGPT adgang til filen. Denne overdragelse opsættes sammen med hans schedule.
Scriptet sender aldrig mail. En enkelt test til Marinus' egen konto er tidligere
sendt gennem Gmail-connectoren og læst tilbage med korrekt HTML og ingen attachments.

## Ved behov

Kortere Page-historik: `node scripts/facebook-composio.mjs pull --days 90`.
Det måler stadig alle publicerede opslag, som API'et returnerer. Standard er
op til 730 afsluttede UTC-dage. En kort kørsel forkorter latest og rapporterne;
tidligere snapshots bevares. Historik flettes ikke til en database.

Genbyg uden API-kald efter en templateændring eller en rapportfejl:

```sh
node scripts/facebook-report.mjs
node scripts/facebook-report.mjs --email
```

Hvis Facebook-adgangen udløber, forbind kontoen igen og kør setup-helperen.
`node scripts/facebook-composio.mjs check` validerer kun lokal konfiguration.

## Data og adgang

- Page-tal gælder den valgte periode. Opslagstal er lifetime-tal ved hentningen.
- Daglige unikke viewers vises som gennemsnit. Følgerbeholdninger summeres ikke.
- Manglende tal bliver ikke til nul. Metas døgnslut bevares.
- API'ets publicerede opslag er ikke et løfte om hele arkivet eller alle Business Suite-tal.
- Seneste fulde livekørsel på Marinus' Mac gav ni historikker á 730 observationer og 25 opslag.
- Hver person bruger eget login. Composios lokale nøgle er bredere end dette script;
  scriptets læseliste er ikke en sikkerhedsgrænse for andre, der får nøglen.
- Credentials, konfiguration og resultater ligger uden for Git. Mapper er 0700,
  filer 0600. Output i repoet afvises, også via symlink. API-fejl bevarer seneste
  gode snapshot, og samtidige pull i samme mappe afvises.
- PNG-filer fra den visuelle gennemgang er manuelle previews og er ikke del af pull.

## Kontrol

```sh
node --test scripts/facebook-storage.test.mjs scripts/facebook-composio.test.mjs scripts/facebook-report.test.mjs
```

Kun seks runtime-moduler, en setup-helper, en konfigurationsskabelon og tests.
Composio er den eneste dataforbindelse. Ingen alternativ Meta-collector eller
lokal scheduler skal vælges eller vedligeholdes.
