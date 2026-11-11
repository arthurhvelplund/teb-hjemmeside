# TEB hjemmesiden

Læs [den fælles projektstatus](docs/STATUS.md) for tråde, worktrees, commits, kontroller og åbne opgaver.

Den aktive lokale kopi er `/Users/marinushvelplund/Projects/teb-kalender-faerdig` på `local/teb-pilot-ready`.
Hjemmesiden ligger i `site/`, og portalens backend i `calendar-worker/`.

Facebook-rapporten har én arbejdsgang. Se [Arthurs korte guide](docs/FACEBOOK_COMPOSIO.md).

```sh
# Kun første gang, med eget Composio/Facebook-login:
sh scripts/setup-facebook-composio.sh
# Hver gang der skal laves en frisk rapport:
node scripts/facebook-composio.mjs pull
```

Pull gemmer data, browserrapport og HTML-mail privat uden for Git.
Arthur sender mailen gennem sin almindelige Gmail-connector i ChatGPT.
Hans tilbagevendende opgave skal have adgang til frisk HTML/data.
Der er ingen Gmail-CLI, SMTP-opsætning eller lokal scheduler i løsningen.

Start den lokale pilot med `cd calendar-worker && npm run dev:pilot`.
Følg [pilotvejledningen](docs/PILOT_KLAR.md) for øveadgang og gennemgang.
Login bruger en lokal testpostkasse. Der sendes ingen rigtig mail.

Nye leverancer samles og registreres i `docs/STATUS.md`, før de afleveres.
Desktop-kopien, tidligere prototyper og gamle worktrees er historik.
Push til `main` kan udløse offentlig deploy. Pilotgrenen er til lokal gennemgang.
