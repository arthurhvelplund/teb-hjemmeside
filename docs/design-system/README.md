# Tistrup Design System

Uddraget fra `site/css/style.css`, `site/css/foreningsportal.css` og `app/src/styles.css`, og samlet til ét sprog.

## Filer
- `tokens.css` – farver, typografi, spacing, former, skygger, motion (CSS-variabler)
- `components.css` – base + komponenter (knapper, kort, datoflise, pille, formular, nav, tabs)
- `index.html` – levende specimen (åbn i browser)

## Principper
1. **Læsbar for alle aldre.** 19 px brødtekst, 52 px formularfelter, 3 px fokusring, mål ≥ 40–48 px.
2. **Editorial, ikke app-agtig.** Serif-display (Fraunces) mod ren sans (Manrope); tynde streger frem for tunge kasser.
3. **Én varm accent.** Skovgrøn bærer designet; terracotta bruges sparsomt (hover, streger, eyebrows).
4. **Papir, ikke hvid.** Baggrund er altid varm råhvid; ren `#fff` kun i inputfelter.

## Hvad der er forenet (fund i koden)
| Emne | Website | App | Nyt system |
|---|---|---|---|
| Display-font | Fraunces | Playfair Display | **Fraunces** |
| Body-font | Manrope | DM Sans | **Manrope** |
| Grøn | `#243b2b` | `#123d2e` / `#2e7154` | **`--forest-900` / `--forest-700`** |
| Accent | terracotta `#c45a3b` | coral `#e76043` | **`--terra-500`** |
| Baggrund | `#f6f1e4` | `#f7f7f3` | **`--paper-200`** |
| Radius | 4 / 14 / 999 (+ 5, 6, 8 ad hoc) | 8–27 ad hoc | **4 / 8 / 14 / 22 / pill** |
| Breakpoints | 520, 620, 700, 760, 820, 900 … | 420, 760 | **520 / 760 / 820** |

## Tokens i korte træk
- **Farver:** primitives (`--forest-900`) → semantiske (`--color-primary`, `--color-text-muted`). Brug altid de semantiske i komponenter.
- **Type:** `--text-xs … --text-3xl`; display bruger `--display-variation`, `--tracking-display`.
- **Spacing:** 4-pt skala `--space-1…8`; sektion = `--space-8`, gutter = `--gutter`.
- **Former:** `--radius-sm/md/lg/xl/pill`. Knapper og filtre er altid pill; kort er `lg`; paneler/formularer `md`.

## Regler
- **Kontrast:** `--terra-500` (≈3,9:1 på papir) må kun bruges til store tekster, streger og ikoner. Små tekster (eyebrow, kicker, fejl) bruger `--terra-700`.
- **Links:** forest med moss-understregning; hover → terracotta.
- **Fokus:** brug `--focus-ring`; fjern aldrig outline.
- **Bevægelse:** brug `--dur-*`; de nulstilles ved `prefers-reduced-motion`.
- **Mørke flader:** `.band--forest` – overskrifter paper, eyebrow `--terra-200`, knap `.btn--paper`.

## Migrering
1. Importér `tokens.css` før `style.css`; alias gamle navne: `--ink→--ink-900`, `--paper→--paper-200`, `--forest→--forest-900`, `--terra→--terra-500`, `--line→--line-300`, `--muted→--muted-700`.
2. Erstat hårdkodede hex (`#a69d87`, `#e4eadc`, `#8d3d26` …) med tokens.
3. Skift app'ens fonte og farver til tokens; indfør `.btn`, `.card`, `.pill`, `.date-tile` i stedet for lokale varianter (`.portal-button`, `.notice-card`, `.filter-strip button`).
4. Selv-host fonte (`site/fonts/`) før lancering, i stedet for Google Fonts-`@import`.
