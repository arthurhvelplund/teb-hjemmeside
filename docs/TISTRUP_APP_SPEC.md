# Tistrup-app — produkt- og byggeplan

Status: arbejdsudkast · 2. august 2026

## 1. Formål

Tistrup-appen skal gøre det enkelt at svare på: **"Hvad sker der i Tistrup?"**

Den samler byens arrangementer, opslag og lokale aktører i ét mobilvenligt overblik. Den er en fælles indgang og en rute videre til foreningernes, virksomhedernes og institutionernes egne kanaler — ikke en erstatning for deres hjemmesider eller Facebook-sider.

## 2. Beslutninger for prototypen

| Emne | Valg nu |
| --- | --- |
| Primært behov | Kalender og digital opslagstavle |
| Målgruppe | Borgere, besøgende og potentielle tilflyttere |
| Indholdsejer | En lille TEB-redaktion på 1–2 personer |
| Udgivelse | Redaktionen opretter eller godkender indhold |
| Platform | Installérbar mobilweb-app (PWA), der også virker på computer |
| Distribution | QR-koder ved byportaler, links fra TEB og lokale aktører |
| Pilotindhold | 20–25 rigtige eller realistiske opslag fordelt på mindst fem kategorier |

## 3. MVP: det brugeren skal kunne

1. Åbne appen fra en QR-kode og straks se de næste relevante ting i byen.
2. Se hele kalenderen og filtrere på kategori.
3. Åbne et arrangement eller opslag med dato, sted, afsender og link til mere information.
4. Udforske lokale aktører og fortsætte til deres hjemmeside, Facebook-side eller kontakt.
5. Dele et arrangement og føje det til sin egen kalender.
6. Installere appen på telefonens hjemmeskærm.

### Sider

- **Hjem:** udvalgt højdepunkt, kommende aktiviteter, genveje til kategorier.
- **Kalender:** kronologisk liste, dato- og kategorifiltre, tydelige tomme tilstande.
- **Udforsk:** aktører og kategorier som sport, kultur, kirke og erhverv.
- **Detalje:** ét arrangement/opslag med handlingerne “Læs mere”, “Del” og “Føj til kalender”.
- **Aktør:** kort profil, eksterne links og næste aktivitet.
- **QR-landingsside:** kort forklaring og tydelig “Se hvad der sker”.

### Kategorier i pilot

- Foreninger og sport
- Kultur og Janus
- Kirke og menighed
- Ældre og fællesskab
- Erhverv og job
- Handel og lokale tilbud

## 4. Ikke med i første version

- Egne brugerprofiler, kommentarer og chat.
- Automatisk import eller scraping fra Facebook.
- Åben udgivelse for alle aktører.
- Personlige anbefalinger.
- App Store- og Google Play-udgivelse.
- Rigtige push-notifikationer. Vi viser hellere den planlagte oplevelse i testen og bygger den efter pilotens bevis.

## 5. Indhold og drift

### Roller

- **Besøgende:** læser, filtrerer, deler og følger links videre.
- **Redaktør:** opretter, retter, godkender og afpublicerer indhold.
- **Aktør (senere):** sender et arrangement ind som kladde til godkendelse.

### Data pr. arrangement/opslag

Titel, type (arrangement, nyhed, job eller tilbud), kategori, afsender, start/sluttidspunkt, sted, kort tekst, billede, kontakt, kilde/link, publiceringsstatus og udløbsdato.

Alle datoer skal have en udløbsregel, så gamle arrangementer ikke bliver vist som kommende.

## 6. Teknisk prototype

Vi bygger en separat, responsiv PWA ved siden af den eksisterende TEB-hjemmeside.

- **Frontend:** React + TypeScript + Vite, optimeret til mobil først.
- **PWA-lag:** manifest, app-ikoner, standalone-visning og service worker til grundlæggende cache/offline-visning.
- **Indhold og redaktion:** Supabase med database, login, billeder og roller. Det giver arrangementer deres egne kladde-/udgivelsesstatusser og undgår redigeringskonflikter i én fælles JSON-fil.
- **Hosting:** Netlify som separat preview-/pilotadresse, fx `app.teb-tistrup.dk`, når domænet er klar. Appen ligger i sit eget repository, så den ikke forstyrrer TEB-hjemmesiden.
- **Måling:** enkel anonym måling af QR-åbninger, sidevisninger, filtre og udgående klik.

En PWA kan bruges som et almindeligt website og installeres som en app fra enheds-browseren. Appens manifest definerer bl.a. navn, ikon og standalone-adfærd; service worker bruges til offline/cache-funktioner. [MDN: Making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)

### Kernedata og adgang

- **Aktør:** navn, kategori, beskrivelse, billede/logo, website, Facebook og kontakt.
- **Arrangement:** titel, tidspunkt, sted, kategori, arrangør, beskrivelse, billede, link, status og udløb.
- **Opslag:** titel, resumé, indhold, kategori, arrangør, billede, link, status, fastgørelse og udløb.
- **Kategori og sted:** visningsnavn, rækkefølge, ikon/farve samt lokation.
- **Redaktørprofil:** rolle som `owner` eller `editor`.

Besøgende kan kun se offentliggjort indhold. Kun inviterede redaktører kan ændre det; databaseadgang beskyttes med row-level security.

## 7. Byggeplan

### Fase 0 — indhold og pilotramme (2–3 dage)

- Navngiv appen og vælg fem til seks kategorier.
- Vælg redaktionen og en enkel publiceringsregel.
- Indsaml testindhold fra mindst ti lokale aktører.
- Aftal tre konkrete testopgaver og succeskriterier.

### Fase 1 — klikbar og visuel prototype (3–4 dage)

- Design mobilflowet for hjem, kalender, udforsk og detalje.
- Afprøv med TEB og 3–5 lokale brugere, før teknik bygges færdig.

### Fase 2 — fundament og funktionel PWA (6–9 dage)

- Opret separat app-repository, preview-deploy, database, redaktørroller og adgangsregler.
- Byg sider, filtrering, detaljer, eksterne links, deling og “føj til kalender”.
- Tilføj installérbar PWA-shell samt QR-landingsside.
- Byg det lille redaktørflow til kladde, publicering og afpublicering.

### Fase 3 — indhold og kvalitet (3–5 dage)

- Indlæs pilotindhold.
- Kontrollér datoer, links, kategorier og mobiltilgængelighed.
- Test på mindst én iPhone og én Android-enhed.

### Fase 4 — lokal pilot (1–2 uger)

- Del QR-kode og testlink med 15–30 borgere.
- Bed alle teste: find en weekendaktivitet, filtrér på sport og åbn en lokal aktør.
- Saml korte svar: "fandt du det?", "ville du åbne appen igen?" og "hvad manglede?".

### Fase 5 — beslutning om v2

Byg kun push-notifikationer, aktørlogins og App Store/Google Play, hvis piloten viser brug og redaktionel kapacitet.

Samlet er der ca. 16–23 udviklingsdage for en fuld pilotklar prototype, efterfulgt af 2–3 ugers lokal pilot.

## 8. Definition af en vellykket pilot

- Mindst 20 aktuelle opslag/arrangementer og 10 repræsenterede aktører.
- Mindst 60 % af testpersonerne løser alle tre opgaver uden hjælp.
- Flertallet forstår, at appen er byens overblik — ikke endnu en foreningsside.
- Redaktionen kan selv oprette og rette indhold uden kode.
- Ingen udløbne arrangementer vises som kommende.

## 9. Største risici og modtræk

| Risiko | Modtræk |
| --- | --- |
| Kalenderen bliver tom eller forældet | Start smalt, udpeg redaktør og aftal fast ugentlig gennemgang |
| TEB bliver content-flaskehals | Brug korte indsendelser og godkendelsesflow; giv først flere rettigheder efter piloten |
| Appen prøver at løse alt | Hold v1 til kalender, opslag og rute videre |
| Aktører har ujævn deltagelse | Vis aktørprofil og ekstern linkværdi, også når de ikke har aktuelle events |
| Push-notifikationer bliver et støjproblem | Udsæt dem, til vi kan definere frekvens, samtykke og reel værdi |

## 10. Næste produktbeslutninger

1. Hvad skal appen hedde: **Tistrup**, **Det sker i Tistrup** eller noget tredje?
2. Skal “erhverv og tilbud” indgå i pilot, eller først efter kalenderen virker?
3. Hvilke 1–2 personer er redaktion i de første tre måneder?
4. Hvilke ti aktører skal levere de første oplysninger?
