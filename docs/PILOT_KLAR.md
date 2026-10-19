# Lokal pilot af TEB-kalenderen

Første version samler Det sker, foreningsoversigten, login, TEBs godkendelse og
den manuelt redigerede papirkalender. Almindelige mails bliver ikke læst af AI,
og delingsønsker bestiller ikke Facebook-opslag, infoskærme eller omdeling.

Den samlede kode ligger i `/Users/marinushvelplund/Projects/teb-kalender-faerdig`
på grenen `local/teb-pilot-ready`. Desktop-mappens Git-filer gav filsystemfejl
og stod delvist som `dataless`. Originalmappen og dens data er bevaret.
Fortsæt derfor udviklingen i denne Projects-kopi.

Indholdet er samlet fra `tistrup-kalender` ved `08e2f57`, portalændringerne
gemt i `e7029d8`, kalenderens rækker i `aeb6ef9` og printleverancen `1ce68e0`.
Print og portal er sammenlignet mod deres fælles udgangspunkt og integreret
i denne kopi. Nye private kvitteringslinks og pilotopsætningen er tilføjet her.

## Ét lokalt preview

```sh
cd calendar-worker
npm run dev:pilot
```

I en anden terminal klargøres foreningsudkast og øveadgang:

```sh
cd calendar-worker
npm run seed:pilot
```

Åbn `http://localhost:8787/nyt.html`. Foreningsområdet findes på
`http://localhost:8787/forening.html` og den lokale postkasse på
`http://localhost:8787/kalender-postkasse.html`.

Pilotens database og fillager ligger i `calendar-worker/.wrangler/local-pilot/`.
Det tidligere preview i `.wrangler/local-portal/` og den oprindelige kalenderpilot
bliver bevaret. Brug ikke den gamle `npm run seed` til denne visning, da den
opretter fiktive offentlige arrangementer.

`seed:pilot` kan gentages. Den tilføjer de 24 foreningsudkast og en øveforening,
som udelades fra den offentlige oversigt. Den opretter ingen arrangementer,
overskriver ikke profiler og giver ingen personer adgang til rigtige foreninger.
Importerede nyheder og arrangementer fra lokale medier beholder deres kilder.
Opsætningen bruger én lokal loginanmodning. Som almindeligt login er den
begrænset til tre anmodninger pr. mailadresse på ti minutter.

## Gennemgang med TEB

1. Se Det sker på telefon og computer. Den kommende uge står som datoer med
   arrangementer på række. Afprøv søgning, dagvalg, måned og arrangementsdetaljer.
2. Se de 24 foreningsudkast. Kontrollér navn, beskrivelse, kilde og billedbrug.
   Udkastmarkering er ikke en bekræftelse fra foreningerne.
3. Log ind som `ansvarlig@example.test`. Find den nye sekscifrede kode i den
   lokale postkasse. Afprøv profil og billedvalg på øveforeningen.
4. Indsend et tydeligt mærket prøvearrangement uden login. Gem det private link
   fra kvitteringen. Det viser status, mens arrangementet afventer TEB.
5. Log ind som `tistrup.kalender@gmail.com` med kode fra den lokale postkasse.
   Godkend prøvearrangementet på Det sker. Kontrollér visningen som gæst.
6. Brug gæstens private link til at rette og derefter aflyse arrangementet.
   Begge handlinger skal godkendes af TEB. Den udgivne version skal bevares,
   indtil rettelsen eller aflysningen bliver godkendt.
7. Åbn TEBs Print-fane på Forening. Vælg periode og format, vælg hvert arrangement
   til eller fra, og ret eventuelt teksten til papir. Åbn korrekturen og
   kontrollér alle sider, før den faste udgave gemmes. Senere rettelser i
   netkalenderen må ikke ændre den gemte PDF.

Der sendes ingen rigtig mail i disse trin. Testpostkassen virker kun lokalt.
Øvekonti og prøvearrangementer må ikke importeres til offentlig drift.

## Pilot med to eller tre foreninger

TEB vælger foreninger og verificerer deres ansvarlige. Medtag en person, som
ikke er vant til digitale selvbetjeningsløsninger. Lad hver deltager prøve at
finde et arrangement, logge ind, oprette noget og rette det uden vejledning.
Notér de steder, hvor de går i stå, og ret dem før lancering.

Piloten er godkendt, når deltagerne kan gennemføre forløbene, TEB kan behandle
gæsteindhold og lave en papirudgave, og ingen uklare fejl eller manglende
kvitteringer står åbne. Deltagernes gennemgang er endnu ikke udført.

## Før staging og offentlig lancering

Følg `PORTAL_DRIFT.md`. Bekræft den rigtige Cloudflare-konto, domæne og
administratorer, og opret separat staging-database og fillager. De eksisterende
konfigurationsfiler indeholder stadig pladsholdere.

Afprøv faktisk modtagelse af login, invitation, kvittering og TEB-notifikation
med aftalte modtagere. Testpostkassen må ikke kunne åbnes på staging eller i
produktion. Tag backup af database og fillager, og afprøv gendannelse før
lancering. Bevar mailkrypteringsnøglen som en driftshemmelighed.

Importér et gennemgået foreningsregister uden øvekonti, private gæstelinks eller
testarrangementer. Portal-Workeren må kun håndtere `/api/kalender/*`.
Hjemmesidens kontaktformular og CMS har deres egne systemer.

En offentlig lancering sker først efter lokal gennemgang, foreningspilot og
afprøvet staging. Dette arbejde aktiverer ingen eksterne integrationer.
