# TEB hjemmesiden

Læs [den fælles projektstatus](docs/STATUS.md) for tråde, worktrees, commits, kontroller og åbne opgaver.

Den aktive lokale kopi er `/Users/marinushvelplund/Projects/teb-kalender-faerdig` på `local/teb-pilot-ready`.
Hjemmesiden ligger i `site/`, og portalens backend i `calendar-worker/`.

Facebook-statistik hentes lokalt gennem Composio. Se
[opsætningen til Marinus og Arthur](docs/FACEBOOK_COMPOSIO.md).
Fra repoets rod: `sh scripts/setup-facebook-composio.sh`, derefter
`node scripts/facebook-composio.mjs pull`. Credentials og data gemmes uden for Git.
Hver kørsel opdaterer også den private `data/report.html`. Genbyg rapporten fra
seneste snapshot uden API-kald med `node scripts/facebook-report.mjs`.

Efter opsætning er den normale Facebook-arbejdsgang:

```sh
node scripts/facebook-composio.mjs pull
node scripts/facebook-report.mjs --email
```

Det opdaterer data og browserrapport samt bygger HTML-mailen. Åbn filerne i
`~/Library/Application Support/TEB/facebook-composio/data/`. Kommandoerne sender
ingen mail. Arthur står for en tilbagevendende opgave i ChatGPT, der sender
gennem hans almindelige Gmail-connector. Repoet skal ikke have en Gmail-CLI,
SMTP-login eller egen mailtransport. Opgaven skal have adgang til friske data
eller HTML gennem en tilgængelig kilde; Gmail-connectoren giver ikke adgang til
denne Macs lokale filer. PNG-previews er manuelle og opdateres ikke af `pull`.
Arthur kører setup-helperen med eget Composio-login. Følg den aktuelle
[Composio-vejledning](docs/FACEBOOK_COMPOSIO.md); den direkte Meta-guide er et alternativ.

Start den lokale pilot med `cd calendar-worker && npm run dev:pilot`.
Følg [pilotvejledningen](docs/PILOT_KLAR.md) for øveadgang og gennemgang.
Login bruger en lokal testpostkasse. Der sendes ingen rigtig mail.

Nye leverancer samles og registreres i `docs/STATUS.md`, før de afleveres.
Desktop-kopien, tidligere prototyper og gamle worktrees er historik.
Push til `main` kan udløse offentlig deploy. Pilotgrenen er til lokal gennemgang.
