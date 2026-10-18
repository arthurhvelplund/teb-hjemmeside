# Enkel Tistrup-prototype

Åbn `index.html` direkte i en browser. Hele prototypen ligger i denne ene fil.
Den kræver hverken installation, server, loginopsætning eller internet.
Links til eksterne medier kræver naturligvis internet.

Der er ikke ændret i den eksisterende hjemmeside eller kalenderpilot.

## Prøv den

Brug vælgeren nederst til at skifte mellem besøgende, foreningsansvarlig,
redaktør og TEB. Den vælger er kun et hjælpemiddel i prototypen.

- **Forening:** søg og filtrér, åbn profiler, ret egne oplysninger, se egne
  arrangementer, invitér og fjern redaktører.
- **Kalender:** måned og uge, læsbare ugelister på telefonen, detaljer, deling
  med link, eksport til egen kalender, oprettelse med løbende preview, rettelse
  og aflysning.
- **Det sker:** links til lokale medier og fællesskaber. Facebook vises som
  en tydeligt mærket pladsholder.
- **TEB:** gennemse, ret og godkend gæsteopslag; afvis med begrundelse;
  godkend foreningsadgang; administrér ansvarlige og redaktører; lav print.
- **Print:** vælg fra- og tildato samt frist, gennemse og gem en fast udgave.
  Åbn udgaven, vælg "Print / gem som PDF", og brug browserens PDF-destination.
  Printlayoutet er A3 i prototypen; endeligt format er ikke besluttet.
- **Del flere steder:** vejledning om flyers, byportaler, infoskærme,
  opslag og medier ved oprettelse og efter indsendelse.

## Login uden password

Prøv `anna@forening.example`, `mikkel@forening.example` eller
`teb@prototype.example`. Prøvekoden er `123456` og accepteres i ti minutter
efter anmodningen. En forkert kode afvises. En inviteret redaktør kan også
logge ind med sin invitationsadresse og prøvekoden.

Andre mailadresser kan logge ind og anmode TEB om adgang til en eksisterende
eller en ny forening. Selve login giver ingen foreningsrettigheder.

## Afgrænsning

Dette er en browserprototype. Alle data, rettigheder og loginforløb er
simulerede, og der er ingen sikker backend. Brug kun eksempeloplysninger.
Der sendes ingen mails, invitationer eller opslag til eksterne tjenester.

Data gemmes lokalt i browseren under nøglepræfikset `teb-standalone-`.
Knappen "Nulstil eksempeldata" gendanner eksemplerne. Browseren kan begrænse
lagring, når filen åbnes direkte; forløbene virker stadig i den aktuelle fane.
Gamle foreningsprofiler, login, database og print fra `calendar-worker/`
bruges ikke af denne prototype.

Kontaktoplysninger til omdeling og skærmudbydere er ikke opfundet.
De fremgår som endnu ikke aftalt. Eksterne medier åbnes via almindelige links.
"Fællesskaber i Varde" linker til kommunens indgang til fællesskabsoversigten.

`prototype.js` er redigeringskilden til det script, der er indlejret i
`index.html`. Filen behøver ikke følge med, når HTML-filen deles.

## Lokal server, hvis ønsket

```sh
python3 -m http.server 8790 --bind 127.0.0.1 --directory output/foreningsportal-enkel
```

Åbn `http://localhost:8790/`.
