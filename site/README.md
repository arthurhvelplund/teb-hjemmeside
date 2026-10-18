# Tistrup Erhvervs- og Borgerforening – hjemmeside

Statisk hjemmeside (HTML/CSS/JS) for [teb-tistrup.dk](https://teb-tistrup.dk).

## Sider
- `index.html` – forside med hero, genveje, Facebook-embed
- `om-tistrup.html` – om byen
- `om-foreningen.html` – formål, bestyrelse, dokumenter
- `bestyrelse.html` – oversigt over bestyrelsen (navne, roller, kontakt)
- `bliv-medlem.html` – kontingent og indmeldelsesformular
- `kontakt.html` – kontaktinfo og kontaktformular
- `foreningsportal.html` – indsend arrangementer til TEBs godkendelse
- `kalender.html` – godkendte arrangementer og printudgaver
- `kalender-redaktion.html` – TEBs redaktion
- `mit-arrangement.html` – privat forhåndsvisning og rettelser

## Tistrup Kalenderen og foreningsportalen

Den fungerende pilot køres gennem `calendar-worker/`. Se
[opsætning og afprøvning](../calendar-worker/README.md).

```sh
cd calendar-worker
npm install
npm run dev
```

Åbn http://localhost:8787/kalender.html. I en anden terminal kan
`npm run seed` tilføje opdigtede eksempelarrangementer, hvis kalenderen er tom.

Foreninger indsender gennem `foreningsportal.html` og ser en privat
forhåndsvisning. TEB godkender hvert opslag, hver rettelse og hver aflysning i
`kalender-redaktion.html`. Kontaktmail og private links er ikke offentlige.
Kun godkendte arrangementer vises i `kalender.html` og i PDF-udgaverne.

I lokal drift gemmes mails i `kalender-postkasse.html`; ingen mails sendes.
Data gemmes i en lokal SQLite-database under den git-ignorerede `tmp/`-mappe.
Print bruger fælles kalenderdata og afsluttes som faste tomånedersudgaver.

Det tidligere, statiske preview på
https://preview.teb-foreningsportal-preview.pages.dev/ er stadig en ældre
prototype. Det er ikke opdateret til denne fungerende pilot. Den nye backend,
rigtig mail og offentlig pilot er endnu ikke aktiveret på Cloudflare.

En almindelig statisk webserver viser kun layoutet. Formularen lukker for
indsendelse, når kalenderens API ikke er tilgængeligt.

## Sådan kører du siden lokalt
Åbn `index.html` i en browser – eller kør en lille webserver:
```
cd site
python3 -m http.server 8000
```
og gå til http://localhost:8000

## Deployment til Vercel
1. Opret en konto på [vercel.com](https://vercel.com).
2. Læg mappen `site/` i et Git-repository (GitHub fx).
3. Import projektet i Vercel – ingen build-step nødvendig, Vercel serverer filerne direkte.
4. Tilføj `teb-tistrup.dk` som custom domain i Vercel-dashboard.
5. Peg domænets DNS-records hen på Vercel (de giver præcise instruktioner).

## Formularer – Cloudflare
Formularerne på `bliv-medlem.html` og `kontakt.html` sender til `/api/formular`.
Ruten håndteres af Cloudflare Workeren i `cloudflare-form-worker/`, som sender beskeden
til foreningens bekræftede modtageradresse gennem Cloudflare Email Service.

## Indhold der skal opdateres
- **Bestyrelsen** redigeres i `data/bestyrelsen.json` (eller via admin-panelet) og vises på `bestyrelse.html` og `om-foreningen.html`.
- **Bestyrelsesbilleder** kan tilføjes i `images/` og indsættes i `.person`-blokke.
- **Facebook-embed** virker kun hvis gruppen er offentlig; ellers skift til en simpel link-knap.
