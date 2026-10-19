# Forening og Kalender: fælles implementeringsaftale

Brugeren har godkendt fuld implementering. Designet SKAL være den eksisterende
TEB-hjemmesides header, footer, Fraunces/Manrope, farver og komponenter i
`site/css/style.css`. Standalone-prototypen i `output/foreningsportal-enkel/`
er kun reference for funktioner og brugerforløb, aldrig et nyt designgrundlag.

## Ansvar og filer

- Backend-agent: hele `calendar-worker/`. Ingen `site/`-ændringer.
- Forening-agent: `site/forening.html`, `site/js/forening.js`,
  `site/css/forening.css`. Offentlig oversigt/profiler, OTP-login,
  foreningsarbejdsområde og TEB-administration, inklusive printformular.
- Kalender-agent: `site/kalender.html`, `site/js/kalender.js`,
  `site/css/kalender.css`, `site/nyt.html`. Oprettelse, preview, privat
  gæstestatus/rettelser, måned/uge, offentlige detaljer og printarkiv.
- Hovedagent: fælles `site/js/portal-api.js`, `site/css/portal.css`, navigation,
  gamle links/viderestilling, deployment, integration og sluttest.
- Alle arbejder på egne branches/worktrees. Ingen deploy, push, main-merge,
  sletning af data eller eksterne mails fra agenterne. Commit kun egne filer.

## Produktregler

Tre offentlige indgange: `forening.html`, `kalender.html`, `nyt.html`.
Detaljer og arbejdsområder kan være query/hash-styrede visninger på samme side.
TEBs administration ligger bag verificeret login på Forening, ikke `/admin/`,
som tilhører hjemmesidens eksisterende CMS.

TEB verificerer første foreningsansvarlige. Ansvarlig inviterer/fjerner redaktører.
Medlemmer kan opdatere egen foreningsprofil og udgive/rette/aflyse egne events.
Login med en ukendt mail giver INGEN foreningsrettigheder. Roller kontrolleres
altid server-side. Offentlig formand/kontakt er adskilt fra loginpersoner.
Gæster kan indsende uden login; indsendelse, ændringer og aflysning kræver TEB.
En ventende eller afvist rettelse bevarer den senest offentliggjorte version.
Gæsten får privat adgangslink, hvis hemmelige del kun ligger i URL-fragmentet.
TEB kan administrere alle profiler, adgange, arrangementer og printudgaver.
Foreninger udgiver uden nyt website-build. Ingen demo-login, fast kode eller
browser-localStorage som sandhed i den rigtige frontend.

Kalender har måned/uge, på mobil læsbar liste grupperet i uger. Live preview ved
oprettelse, delbart eventlink, ICS, aflysningsmarkering, kalender/PDF fra samme
offentliggjorte data. Gæsters kontaktmail vises aldrig offentligt.
Delingsmuligheder vises ved oprettelse og efter indsendelse med ærlige kontakt-
pladsholdere, hvor aftaler mangler. Ingen automatisk Facebook/Gmail/partnerimport.
Det sker beholder eksisterende Facebook-embed + eksterne links. TEBs egne
kalenderbokse flyttes til Kalender. Historiske PDF'er bevares i arkivet.

## API-aftale

Alt under `/api/kalender`, JSON, POST for mutationer. `portal-api.js` tilbyder
`api(path,{body,token,method})`, `getSession()`, `escapeHTML`, `randomToken`,
`requestKey`, `dateText`, `today`, `showMessage`, `showMode`, `busy`.
`api` bruger same-origin HttpOnly-cookie, tilføjer Origin automatisk via browser,
og Bearer-header ved gæsteadgang. Fejl er `{error}` med HTTP status.

Association = `{id,name,category,description,chair,email,phone,website,place,revision}`.
Medlemskab = `{id,associationId,role:'manager'|'editor',association}` i session.
Person i medlemsliste = `{id,email,name,role,status:'active'|'invited'}`.
Session GET `/session` = `{authenticated,user:{id,email,isAdmin}|null,memberships:[]}`.
Gæster returneres med authenticated false, ikke som en fejl.

- POST `/auth/request` `{email}` -> `{challengeId,mode}`. Lokal kode findes i
  den lokale testpostkasse, aldrig en fast kode i UI eller offentligt API.
- POST `/auth/verify` `{challengeId,code}` -> session, sætter HttpOnly-cookie.
- POST `/auth/logout` `{}` -> `{saved:true}` og udløber cookie/session.
- GET `/associations` -> `{associations}`. GET `/associations/:id` -> `{association}`.
- POST `/associations/:id` `{association,revision}` -> `{association}`.
- GET `/associations/:id/members` -> `{members}`. Kun medlemmer/TEB.
- POST `/associations/:id/invitations` `{email,name}` -> `{saved,deliveryState}`.
- POST `/associations/:id/members/:memberId/revoke` `{}` -> `{saved}`.
- GET `/me/events` -> `{events}` med private event-wrappers nedenfor.
- GET `/me/access-requests` -> `{requests}`.
- POST `/access-requests` `{associationId|newAssociationName,name,roleNote}`.
  Kræver verificeret session; e-mail tages fra session. -> `{id,status}`.
- GET `/admin/access-requests` -> `{requests}`. Request har
  `{id,email,name,associationId,newAssociationName,roleNote,status}`.
- POST `/admin/access-requests/:id` `{action:'approve'|'reject',verified,note}`.
- POST `/admin/associations` `{association,requestKey}` -> `{association}`.
  Klienten beholder samme UUID ved genforsøg indtil oprettelsen er bekræftet.
  Serveren opretter højst én forening pr. nøgle, også ved samtidige kald.
  Genbrug kræver samme TEB-bruger og validerede profilfelter samt fortsat
  administratoradgang. Ændret indhold eller anden bruger afvises med 409.
- POST `/admin/associations/:id/members` `{email,name,role}` -> `{saved,deliveryState}`.
  TEB kan tilknytte ansvarlig eller redaktør; aktivering kræver modtagerens OTP.

Event-data beholder pilotens felter:
`{title,association,associationId,date,time,endDate,endTime,location,description,price,link,state}`.
Public state = `approved` eller `cancelled`, ikke prototype-ordet published.
Offentlig event = `{id,...eventData}`. Privat wrapper =
`{id,data,published,pendingKind,status,revision,note,associationId,notificationState,receiptState}`.
pendingKind = `new`/`edit`/`cancel` eller null; status normalt pending/approved/rejected.

- GET `/events?from=YYYY-MM-DD&to=YYYY-MM-DD` -> `{events}` inklusive aflyste og
  historiske inden for interval. Uden interval beholdes kommende events.
- GET `/events/:id` -> `{event}` for offentliggjort event, også historisk.
- POST `/events` `{event,associationId,email,authorToken,requestKey,startedAt,website:''}`.
  Auth: server slår medlemskab op og udgiver direkte for associationId.
  Gæst: eksisterende pilotforløb, stærk authorToken, idempotent requestKey.
  -> `{id,status,notificationState,receiptState,published:boolean}`.
- POST `/member/events/:id` `{event,associationId,action:'update'|'cancel',revision}`.
- GET/POST `/private/:id` med Bearer authorToken bevares. POST beholder pilotens
  `{event,action:'edit'|'cancel',revision}`; agent skal kontrollere eksisterende
  pilotkode for præcis legacy-action og tilbyde edit-alias ved behov.
- GET `/admin/events` -> `{events}` private wrappers. POST `/admin/events/:id`
  `{action:'approve'|'reject',revision,event?,note?}` bevarer gæstegodkendelse.
  TEB direkte rettelse/aflysning kan bruge `/member/events/:id`.

Printudgave = `{id,start,end,deadline,format,createdAt,eventCount,month?}`.
- GET `/editions` -> `{editions}`. GET `/editions/:id/pdf` -> lagret PDF.
- GET `/admin/editions/preview?start=&end=&deadline=&format=poster|a3` -> PDF.
- GET `/admin/editions/events?start=&end=&deadline=&format=` -> godkendte kandidater
  og `reviewHash`. Redaktionen vælger til eller fra ved hvert arrangement.
- POST `/admin/editions/preview` `{start,end,deadline,format,eventIds,reviewHash,printOverrides?}` -> PDF.
- POST `/admin/editions` `{start,end,deadline,format,requestKey,eventIds,reviewHash,printOverrides?}` -> `{id,pages,eventCount}`.
- `printOverrides` er valgfri tekst pr. valgt event-id med felterne
  `title,details,association,dateLabel,dateNote`. Teksterne gemmes kun i udgaven.
  Intet forvalg i redaktionen. Ændret grundlag kræver ny gennemgang og korrektur.
- Historik anvendes pr. frist i Europe/Copenhagen, også hvis event senere er
  rettet/aflyst. Kun godkendt indhold ved fristen inden for datointervallet.
- Gem selve den endelige PDF i R2 og datakopi i D1. Lokal R2-adapter til test.
  Ingen produktion-finalisering uden lagring. Legacy month-parametre understøttes.

GET `/config` bevares med `{mode,submissionsEnabled,editorEmail}`.
GET `/local-mail` er KUN mulig på loopback med LOCAL_PREVIEW=true og må aldrig
afsløre koder/private links på offentlig deployment.

## Sikkerhed, drift og afgrænsning

OTP tilfældig, enkeltbrug, ti minutters levetid, fem forsøg; begræns både
afsendelse og verifikation pr. mail/IP/challenge. Ingen plaintext-secrets i DB.
Sessions HttpOnly/Secure/SameSite og server-side rettigheder ved hver mutation.
Invitation kan kun accepteres af samme verificerede mail. Ingen rolleeskalation.
Revisioner og atomiske writes forhindrer races, dobbeltudgivelse og token-replay.
Mailfejl bevarer data og vises ærligt. Implementér sikker retry af ventende mails
uden at lække OTP eller sende dubletter. Ingen persondata/secrets i logs.

Frontend holdes simpel og bruger progressive loading/error/empty states. Ingen
opfundne foreninger i produktion. Lokal seed er eksplicit, separat og opdigtet.
Bevar den eksisterende lokale database og demo-prototype. Ingen bulk-import eller
rigtige invitationer uden eksplicit valgte modtagere. Opsætning og rettigheder
kan blokere offentlig drift, men ikke færdiggørelse af kode og lokale tests.

Eksisterende site kører Pages via GitHub Actions. `/api/formular*` har egen Worker
og må ikke ændres. Ny Worker skal kun route `/api/kalender/*`; ikke overtage `/`,
CMS, kontaktformular eller hele domænet. Staging og produktion har adskilte DB,
R2, afsenderkonfiguration og adgang. Pilotens globale noindex og root-redirect må
ikke komme på produktionshjemmesiden.

## Accept

Meningsfulde backendtests: OTP expiry/replay/bruteforce, invites/revocation,
cross-association access, gæstegodkendelse og bevaret publiceret revision,
konkurrente ændringer, mailfejl/idempotens, PDF-snapshot ved frist og fast PDF-fil.
Browser: gæst -> TEB -> publiceret; OTP -> profil -> invitation -> direkte
event -> rettelse/aflysning; TEB print; mobil/desktop; fejl/empty states.
Kontrollér PDF visuelt samt uafhængigt review. Lokal succes er ikke bevis på
maillevering, Cloudflare-provisionering eller produktionsdrift.
