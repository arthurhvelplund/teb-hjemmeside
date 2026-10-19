# Fire retninger for foreningssiden

Åbn `index.html` direkte, eller brug den lokale visning på http://localhost:8794/.

Sammenligningen indeholder en gemt reference af den eksisterende side og fire forslag:

- Billedkort med korte beskrivelser og en separat loginindgang.
- Alfabetisk liste med udvidelige oplysninger og interessevalg.
- Foreninger grupperet efter det, besøgende har lyst til at deltage i.
- Kommende aktiviteter med en selvstændig oversigt over alle foreninger.

Forslagene genbruger `site/css/style.css`, sidens header, footer, logo og fotos.
De seks fiktive foreninger kommer fra den tidligere prototype i
`output/foreningsportal-enkel/prototype.js`. Arrangementernes datoer og korte
beskrivelser er eksempler. Billederne er stemningsfotos fra den eksisterende
hjemmeside og er ikke dokumentation for de viste foreninger.

Referencen er hentet fra http://localhost:8787/forening.html den 18. oktober 2026.
`current-source.html` er den indlæste sides HTML. `assets/current-1440.png`
er det faktiske skærmbillede ved 1440 pixels bredde. Referencevisningens links
og formularer er låst. Forslagenes login er en demonstration og sender intet.

Der er ingen ændringer i `site/` eller i kalenderens backend.

Rediger `variants.css`, `variants.js` og `comparison.html`, og kør:

```sh
python3 output/forening-retninger/build.py
```

Bygningen kræver Node og `cwebp`, som bruges til eksempeldata og billedkopier.
Den færdige `index.html` indeholder alle billeder og alle fem visninger.
Skrifttyperne hentes fra den samme Google Fonts-kilde som den eksisterende side.

Kontrolleret i browser ved 1440 og 390 pixels: fem visninger, billeder, ingen
vandret overflow, tom søgning, udvidelige rækker, profiler og loginets demoforløb.
