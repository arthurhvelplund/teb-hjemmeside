# Det sker i Tistrup

Selvstændig, mobil-først PWA til Tistrups kalender, opslag og lokale aktører.

## Lokal start

```bash
npm install
npm run dev
```

MVP'en bruger realistisk demoindhold i `src/data`, så den kan testes uden konto eller backend. Redaktionsdemoens statusændringer gemmes i browserens `localStorage`, så de overlever en genindlæsning på samme enhed. Brug knappen **Nulstil demoindhold** i redaktionen for at vende tilbage til udgangspunktet.

## Deploy

Opret en separat Netlify-site med `app/` som base directory. `netlify.toml` i denne mappe bygger til `dist/` og laver fallback for appens ruter. Der kræves ingen database eller miljøvariabler.

Alt pilotindhold er demoindhold og skal bekræftes af de respektive aktører før offentlig pilot.
