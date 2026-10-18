# Tistrup Erhvervs- og Borgerforening

Den eksisterende hjemmeside ligger som HTML/CSS/JavaScript i `site/`.
Cloudflare Pages publicerer den via `.github/workflows/deploy-cloudflare-pages.yml`.
Det fælles design ligger i `css/style.css`; sæsonudsmykning ligger separat.

## Forening, Kalender og Det sker

- `forening.html`: offentlige foreningsprofiler, e-mailkode-login og privat
  arbejdsområde for foreninger og TEB.
- `kalender.html`: måned/uge, arrangementsdetaljer, oprettelse med preview,
  privat gæstestatus og printarkiv.
- `nyt.html`: Tistrup Nyt via backendens HTML-import og cache, Facebook-feed
  og links til eksterne kilder. Se `../calendar-worker/README.md` om importen.

Frontend kalder `/api/kalender/*`. Backend i `calendar-worker/` kontrollerer
login, adgang, data og offentliggørelse. Der er ingen faste prøvekoder eller
roller gemt i frontend. Gamle arrangementslinks viderestilles til de nye sider.

## Lokalt preview

Følg [backendens vejledning](../calendar-worker/README.md) for server og lokal
seed. Åbn hele hjemmesiden gennem backendserveren. En ren statisk server viser
kun layout og kan ikke håndtere login, database eller indsendelser.

Lokalt bruges SQLite og lokalt PDF-lager. Mails gemmes i
`kalender-postkasse.html` og sendes ikke eksternt. Visningen er kun tilgængelig
via lokal API på loopback. Den oprindelige pilots data bevares separat.

Den selvstændige browserprototype findes stadig i
`output/foreningsportal-enkel/`. Den er en funktionsreference, ikke den rigtige
portal eller en offentlig deployment.

## Arbejdsgange

TEB godkender første foreningsansvarlige. Ansvarlige kan invitere redaktører.
Godkendte foreningsbrugere kan rette egen profil og udgive egne arrangementer.
Gæsteopslag, gæsterettelser og gæsteaflysninger kræver TEB. En ventende rettelse
bevarer den offentlige version. TEBs arbejdsområde ligger på Forening efter
login. Det eksisterende `/admin/` er fortsat hjemmesidens eget CMS.

Print dannes fra offentliggørelseshistorikken ved den valgte frist.
En udgivet datakopi og PDF-fil gemmes fast. Fremtidige ændringer ændrer kun
webkalenderen og kommende printudgaver.

## Senere deployment

Der er valgt lokalt preview nu. Se [driftsvejledningen](../docs/PORTAL_DRIFT.md)
for staging, afsender, første administratorer, database, PDF-lager og backup.
Ingen Cloudflare-ressourcer eller rigtig mail aktiveres automatisk af lokale
kommandoer. Testworkflowet `portal-checks.yml` publicerer ikke hjemmesiden.

## Øvrige dele af hjemmesiden

Kontakt og indmeldelse sender fortsat til `/api/formular`, som håndteres af
`cloudflare-form-worker/`. Portal-Workeren må ikke overtage den route.
Bestyrelse og øvrige indholdsdata ligger fortsat i `site/data/`.
Navigation vedligeholdes med `node scripts/sync-navigation.mjs` fra projektroden.
