# TEB-redaktionspanelet

Det administrative panel ligger på **`/admin/`** (altså
`https://teb-tistrup.dk/admin/`) og giver bestyrelsen mulighed for at:

- rette navne, telefonnumre og roller på bestyrelsen
- opdatere repræsentanter, kontaktinfo og forsidens tal

Redaktørerne logger ind med **e-mail og adgangskode** – de skal IKKE have
nogen GitHub-konto.

---

## 1. Engangs-opsætning (én gang, ~20 min)

Setup'et bygger på Netlify (gratis hosting + login-håndtering). Selv hvis
domænet i øjeblikket peger på Vercel, er det her vi flytter til.

### Trin 1 — Opret Netlify-konto og forbind GitHub-repoet

1. Gå til <https://app.netlify.com/signup> og opret en gratis konto med
   `afhvelplund@gmail.com`.
2. Klik *Add new site → Import an existing project*.
3. Vælg GitHub som kilde, godkend Netlifys adgang og vælg `teb-hjemmeside`-
   repoet.
4. Netlify læser `netlify.toml` automatisk – publish-folder er sat til
   `site`. Klik *Deploy site*.
5. Når sitet er deployed (typisk under et minut), notér den midlertidige
   URL (fx `silly-cucumber-12345.netlify.app`) – den bruges som test-URL
   indtil DNS er flyttet.

### Trin 2 — Aktivér Identity og Git Gateway

1. I Netlify-dashboardet for sitet, klik *Site configuration → Identity*
   (eller *Identity* i venstre side – placeringen flyttes lejlighedsvis).
2. Klik *Enable Identity*.
3. Under *Identity → Registration preferences*: vælg **Invite only**.
   (Du vil ikke have at hvem som helst kan oprette login.)
4. Under *Identity → External providers*: lad være (e-mail/password er
   nok).
5. Scroll ned til *Git Gateway*: klik *Enable Git Gateway*. Det giver
   Identity-brugerne lov til at committe ændringer til GitHub-repoet
   uden selv at have GitHub-konti.

### Trin 3 — Inviter dig selv som første redaktør

1. *Identity → Invite users → afhvelplund@gmail.com → Send*.
2. Tjek mailen, klik på linket i invitationen.
3. Du lander på sitets forside med en link-stub som
   `…?invite_token=…`. Når du klikker, åbner et lille popup-vindue
   "Complete your signup". Sæt en adgangskode.
4. Gå til `[NETLIFY-URL]/admin/`. Klik *Login*. Log ind med din mail
   og kodeordet. Du ser nu redaktionspanelet.

> **Tip:** Hvis invitations-linket ikke åbner login-popup'en automatisk,
> så åbn Netlify-URL'en (eller `teb-tistrup.dk` når DNS er flyttet) og
> klip `?invite_token=…`-delen ind i adressefeltet manuelt.

### Trin 4 — Flyt domænet `teb-tistrup.dk` til Netlify

1. I Netlify-dashboardet: *Domain management → Add a domain →
   teb-tistrup.dk*. Følg vejledningen.
2. Hos jeres DNS-udbyder (typisk hvor I købte domænet): peg DNS-records
   mod Netlify – Netlify viser de præcise værdier (en CNAME for
   `www.teb-tistrup.dk` og en A-record for `teb-tistrup.dk`).
3. Vent ~1 time på DNS-propagation. Netlify slår automatisk HTTPS til
   bagefter.
4. Når domænet virker: deaktivér Vercel-projektet for ikke at have to
   sites kørende samme sted. (Eller behold det som backup uden domæne.)

### Trin 5 — Inviter de øvrige redaktører

Gå til *Identity → Invite users* og send invitationer til de personer
der skal kunne redigere. Hver person får en mail og
sætter selv et kodeord.

---

## 2. Opslag på Facebook

Foreningens opslag deles på Facebook. Hjemmesiden har ikke et separat
nyhedsfeed eller en opslagssamling i redaktionspanelet.

---

## 3. Sådan retter du andre ting

| Hvad du vil rette                                   | Vælg → derefter          |
|-----------------------------------------------------|--------------------------|
| Navne, telefonnumre, roller på bestyrelsen          | **Foreningen → Bestyrelse**     |
| Repræsentanter i andre råd                          | **Foreningen → Repræsentanter** |
| Formandens kontaktinfo, CVR                         | **Foreningen → Kontaktinfo**    |
| De tre tal i hero på forsiden (501, 46, 122)        | **Tal og fakta → Forsidens tal**|
| Tekst, layout eller struktur på selve sidernes HTML | (bed en udvikler)        |

For "Bestyrelse" og "Repræsentanter" — tilføj/slet rækker ved at klikke
*Add* eller papirkurv-ikonet, og træk rækker for at omarrangere.

---

## 4. Filer i dette setup

```
teb-hjemmeside/
├── netlify.toml          ← Netlify-deployment-config
├── site/
│   ├── admin/
│   │   ├── index.html    ← Decap CMS startside (det er denne /admin/ peger på)
│   │   ├── config.yml    ← konfiguration: backend, collections, felter
│   │   └── README.md     ← (denne fil)
│   ├── data/
│   │   ├── bestyrelsen.json   ← bestyrelsen — "Bestyrelse"
│   │   ├── repraesentanter.json
│   │   ├── kontakt.json
│   │   └── forside.json
│   ├── js/
│   │   └── data-loader.js     ← henter JSON-filerne og indsætter dem i siderne
│   ├── nyt.html               ← kalender og praktiske oplysninger
│   ├── index.html             ← forsiden
│   └── ...resten af siderne
```

## 5. Hvis noget går galt

- **Login virker ikke** → Tjek at *Identity* og *Git Gateway* er
  aktiveret i Netlify-dashboardet (begge to). De kan være slået fra.
- **Editoren viser fejl** → Tjek at den relevante fil i `site/data/` er gyldig
  JSON. Dårlig JSON gør at hele samlingen ikke kan loades.
- **Værste fald**: Rul ændringen tilbage med `git revert` på den
  pågældende commit – alle ændringer er almindelige Git-commits.
- **Behov for hjælp**: Sig fx: "Jeg har rettet bestyrelsen, men ændringen
  vises ikke" eller "Jeg vil tilføje en ny redaktør".
