# Tistrup Erhvervs- og Borgerforening – hjemmeside

Statisk hjemmeside (HTML/CSS/JS) for [teb-tistrup.dk](https://teb-tistrup.dk).

## Sider
- `index.html` – forside med hero, genveje, Facebook-embed
- `om-tistrup.html` – om byen
- `om-foreningen.html` – formål, bestyrelse, dokumenter
- `bestyrelse.html` – oversigt over bestyrelsen (navne, roller, kontakt)
- `bliv-medlem.html` – kontingent og indmeldelsesformular
- `kontakt.html` – kontaktinfo og kontaktformular
- `foreningsportal.html` – enkel prototype til indsendelse af arrangementer

## Foreningsportal, prototype

Delbart preview: https://preview.teb-foreningsportal-preview.pages.dev/

Previewet er udgivet i det separate Cloudflare Pages-projekt
`teb-foreningsportal-preview` på Business and Fitness-kontoen, branch `preview`.
Det indeholder kun portalen og dens nødvendige billeder, CSS og JavaScript.
Links til forsiden, kontakt og kalenderen går til den offentlige TEB-hjemmeside.
Previewet har `noindex` og kræver ikke login. TEB's eksisterende projekt er ikke
ændret af denne preview-udgivelse.

Portalen findes fra forsiden, fra “Det sker” og i sidernes genveje. Den består af
én kort formular med store felter til arrangement, forening, dato, klokkeslæt,
sted, valgfri beskrivelse og kontaktmail. Ved siden af vises et kalenderkort, som
opdateres, mens brugeren skriver. Kontaktmailen vises ikke på kortet. En e-mailknap og et telefonnummer er
alternativer for dem, der hellere vil kontakte TEB direkte.

Formularen er en lokal prøve. Den sender eller gemmer ingen oplysninger og
opdaterer hverken kalenderen, Facebook eller print. Ved indsendelse vises en kort
prøvekvittering. Brugeren kan gå tilbage uden at miste sine oplysninger.
E-mailknappen åbner en mailkladde til `tistrup.kalender@gmail.com` med de felter,
brugeren allerede har udfyldt. Brugeren sender selv mailen.

Før rigtig indsendelse aktiveres, skal modtagelse, redaktionens godkendelse og en
fælles datakilde til aktiviteterne aftales. Kalender, Facebook, print og senere
AI-hjælp kan derefter bruge de samme oplysninger. Ekstra hjælp med flyers,
plakater og grafik er samlet i en kort kontaktsektion. Partnerlisten mangler endnu.

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
