KLIKPROTOTYPE · FORENINGSLIV I TISTRUP OG HODDE
19. oktober 2026

Åbn den kørende lokale visning:
http://localhost:8792/

prototype.html er den samme prototype samlet i én fil med billeder,
CSS, JavaScript og katalogdata. Den kan åbnes separat i en browser.
Webfonte bruger Google Fonts; uden net bruges browserens lokale fonte.

START HER
1. Se Solsidens offentlige foreningsside.
2. Brug rollevælgeren øverst til at skifte oplevelse.
3. Brug Guide til at springe til konkrete forløb.
4. Nulstil genskaber de oprindelige eksempeldata.

ROLLER
Besøgende, foreningsansvarlig, redaktør, TEB-redaktion og ny bruger.

PRØV BLANDT ANDET
- Foreningsoversigt med søgning og interessefilter.
- Offentlig profil, kontakt, nyheder og arrangementer.
- Opret, ret og aflys arrangementer.
- Opret, ret og fjern nyheder.
- Se indholdet i Kalender, Det sker og på foreningens side.
- Redigér profil og vælg et billede fra telefon/computer.
- Invitér og fjern redaktører, og sammenlign med redaktørens adgang.
- Indsend som gæst, følg status, og se TEBs svar.
- Bed om adgang og behandl anmodningen som TEB.
- Gennemgå nye indsendelser og rettelser i den samlede redaktion.
- Opret foreninger og tilknyt personer som TEB.
- Udvælg hvert arrangement til papir, ret printtekst, gennemgå korrektur,
  og gem en fast udgave. Senere netrettelser ændrer ikke udgaven.
- Åbn printvisningen og brug browserens Print / gem som PDF.

LOGIN, HVIS DU VIL PRØVE DET FORLØB
ansvarlig@example.test
redaktor@example.test
teb@example.test
En anden adresse viser første adgang.
Prøvekode: 123456. Der sendes ingen e-mail.

AFGRÆNSNING
Dette er en selvstændig designprototype med browserlagring.
Den sender ingen mails og kalder ikke den rigtige portals API.
Kontakter, opslag, arrangementer, adgangsændringer og printarkiv er
eksempeldata. Roller og private links demonstrerer brugerforløb,
ikke en produktionsklar sikkerhedsmodel.
De 24 foreningsudkast stammer fra det eksisterende lokale katalog.
Solsiden og dens indhold er opdigtet. Eksisterende billeder er
illustrationer til den lokale prototype og beholder kildernes ophav.
Mediekort linker til kilderne; prototypen henter ikke nyheder live.

KONTROLLERET
Offentlige profiler, filtrering, rollevalg, login og retur til opgave,
oprettelse/retning/fjernelse, aflysning, profilbillede, invitation,
redaktørbegrænsninger, gæstestatus, bevaret offentlig version ved
rettelse/afvisning, godkendelse af adgang, manuel printudvælgelse,
korrekturkrav og uændrede printudgaver efter netrettelser.
25 foreningsprofiler er åbnet. Repræsentative skærme er kontrolleret
på computer og telefon, inklusive 320 pixels bredde.
Den samlede HTML-fil er kontrolleret med indlejrede billeder og rollevalg.

LOKAL START IGEN
cd /Users/marinushvelplund/Desktop/TEB-hjemmeside/output/forening-prototype
python3 -m http.server 8792 --bind 127.0.0.1

KILDER
index.html, style.css, app.js, catalogue.js og assets/ er kildefilerne.
python3 build.py gendanner prototype.html efter ændringer.
Browserudgaven, den separate HTML-fil og den indlejrede chatvisning
har hver sin prototype-lagring.
