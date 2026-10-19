# TEB projektets afleveringssted

Den samlede lokale pilot ligger i `/Users/marinushvelplund/Projects/teb-kalender-faerdig`
på `local/teb-pilot-ready`. Desktop-kopien og tidligere T3-worktrees er bevaret historik.
Se `docs/STATUS.md`, før du tager en eksisterende leverance eller gren i brug.

Ved afslutning af arbejde opdateres `docs/STATUS.md` med leverance, commit,
udførte kontroller og konkrete udeståender. Hvis en anden tråd arbejder videre,
skal dens opgave og afleveringssted stå i status, indtil leverancen er samlet.

`site/` og `calendar-worker/` er den aktive løsning. Prototyper, renderinger og
det tidligere WordPress-arkiv er referencer. Lokale databaser, postkasser,
mailnøgler og loginmateriale må ikke komme i Git.

Piloten gennemgås lokalt. Push til `main` kan automatisk udgive `site/` via
GitHub Actions og er ikke en del af almindelig samling på pilotgrenen.
