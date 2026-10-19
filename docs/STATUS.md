# Samlet status for TEB hjemmesiden

Opdateret 19. oktober 2026. Dette er projektets fælles status og afleveringssted.
Status ved oprettelsen: 25 tråde, heraf 17 hovedtråde og 8 undertråde. Foreningsområdet bygges fortsat. Kalenderens visuelle udtryk afventer brugerens designvalg.

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
| Opret arrangement | Fælles pop-up, billedupload og kalender/print-preview er integreret med den nye kalender i `313eac2`. |
| Foreninger | 24 importerede udkast, 18 med billede/logo. Kompakt oversigt gemt i `6ea99c2`. |
| Login og adgang | Lokal mailkode, profil og adgangsstyring samlet i pilotens `4209e48`. Ingen rigtig mail. |
| Foreningsprofil og ejerens side | Leveret lokalt i `53cc3c0`: kompakt offentlig profil, ejerens indhold, egne nyheder og fælles TEB-kø. 81 backendtests og 42 portalforløb består. |
| Trykt kalender | Det manuelle printforløb fra `1ce68e0` er integreret i `4209e48`. Hvert arrangement vælges, korrekturlæses og gemmes i en fast PDF. |
| Staging og produktion | Ny portal er ikke lanceret. Database, fillager, afsender, administratorer og staging skal stadig opsættes og afprøves. |

## Tråde

Rækkerne beskriver både færdige og stadig åbne tråde. De otte undertråde er historiske.

T3-status fortæller, om en kørsel er afsluttet. Den betyder ikke i sig selv, at kode er testet, committet eller udgivet.
`settled` betyder, at tråden er flyttet ud af den aktive liste.

| Tråd | Kørsel ved aflæsning | Leverance |
| --- | --- | --- |
| [Samlet status over tråde og worktrees](t3-thread://v1/3846890d-c6d1-4a6b-884d-a742be850123) | running | Denne samling og status. |
| [Foreningsside og ejerens startvisning](t3-thread://v1/103b95cc-5ffc-40b4-8120-27115e9ce1da) | running | Leveret i `53cc3c0`: offentlig profil, ejerens startside, nyheder og fælles redaktion. 81 backendtests, 42 portalforløb og 8 kalenderforløb består. Ingen deploy. |
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
| Desktop/TEB-hjemmeside, tistrup-kalender | `aeb6ef9` | Oprindelig kopi med ugemt pop-up og støttemateriale. Bevares og snapshots gemmes særskilt. |
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
Foreningstråden har desuden en kølagt opfølgning efter den igangværende kørsel.
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
