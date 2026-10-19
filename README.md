# TEB hjemmesiden

Læs [den fælles projektstatus](docs/STATUS.md) for tråde, worktrees, commits, kontroller og åbne opgaver.

Den aktive lokale kopi er `/Users/marinushvelplund/Projects/teb-kalender-faerdig` på `local/teb-pilot-ready`.
Hjemmesiden ligger i `site/`, og portalens backend i `calendar-worker/`.

Start den lokale pilot med `cd calendar-worker && npm run dev:pilot`.
Følg [pilotvejledningen](docs/PILOT_KLAR.md) for øveadgang og gennemgang.
Login bruger en lokal testpostkasse. Der sendes ingen rigtig mail.

Nye leverancer samles og registreres i `docs/STATUS.md`, før de afleveres.
Desktop-kopien, tidligere prototyper og gamle worktrees er historik.
Push til `main` kan udløse offentlig deploy. Pilotgrenen er til lokal gennemgang.
