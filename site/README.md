# Tistrup Erhvervs- og Borgerforening – hjemmeside

Statisk hjemmeside (HTML/CSS/JS) for [teb-tistrup.dk](https://teb-tistrup.dk).

## Sider
- `index.html` – forside med hero, genveje, Facebook-embed
- `om-tistrup.html` – om byen
- `om-foreningen.html` – formål, bestyrelse, dokumenter
- `bliv-medlem.html` – kontingent og indmeldelsesformular
- `kontakt.html` – kontaktinfo og kontaktformular

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

## Kontaktformular – Formspree
Formularerne på `bliv-medlem.html` og `kontakt.html` bruger [Formspree](https://formspree.io).

For at aktivere dem:
1. Opret en gratis konto på formspree.io med `afhvelplund@gmail.com`.
2. Opret et nyt formular-endpoint.
3. Erstat `YOUR_FORM_ID` i de to filer med det rigtige form-ID.

Gratis-planen tillader 50 indsendelser om måneden – rigeligt.

## Indhold der skal opdateres
- **Næstformand** på `om-foreningen.html` mangler (ny konstituering efter GF 26. marts 2026).
- **Bestyrelsesbilleder** kan tilføjes i `images/` og indsættes i `.person`-blokke på om-foreningen.
- **Facebook-embed** virker kun hvis gruppen er offentlig; ellers skift til en simpel link-knap.
