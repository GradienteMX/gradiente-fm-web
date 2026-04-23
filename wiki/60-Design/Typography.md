---
type: design
status: current
tags: [design, typography, fonts]
updated: 2026-04-22
---

# Typography

> Three fonts, three roles. Syne for display, Space Grotesk for prose, Space Mono for system voice.

## The trio

| Font | Role | Used for |
|---|---|---|
| **Syne** | Display / headline | Titles, logo, featured card headings, section labels like `AGENDA` |
| **Space Grotesk** | Body / UI | Excerpts, subtitles, paragraphs, form-like text |
| **Space Mono** | System voice | `sys-label` chrome, timestamps, unit codes, chrome metadata |

Loaded via `next/font/google` in [app/layout.tsx:2](../../app/layout.tsx), all three with `display: 'swap'`. Weights loaded:

- Syne: 400 / 500 / 600 / 700 / **800** (the display voice goes to `font-black`)
- Space Grotesk: 300 / 400 / 500 / 600 / 700
- Space Mono: 400 / 700

## Tailwind classes

```
font-syne       → Syne
font-grotesk    → Space Grotesk (the `body` default)
font-mono       → Space Mono
```

See [tailwind.config.ts:12](../../tailwind.config.ts). `body` is set to `var(--font-space-grotesk)` in [globals.css:36](../../app/globals.css) so un-classed text defaults to Grotesk.

## Size scale (observed)

No formal scale file. In practice:

| Class | Used for |
|---|---|
| `text-4xl font-black` | [[HeroCard]] title on desktop, LG card title on featured |
| `text-3xl` | Big date number in event card blocks |
| `text-2xl` | LG card titles |
| `text-xl` | MD card titles, nav labels |
| `text-lg` | SM card titles, article card titles |
| `text-base` | hero body para 0 |
| `text-sm` | hero body para 1+, excerpt |
| `text-xs` | subtitle, meta rows |
| `text-[10px]` | `sys-label` chrome |
| `text-[9px]` | genre chips, date-block month/day-name |
| `text-[8px]` | MAGI labels, data-strip tokens |
| `text-[6px]` | subsystem labels in nav logo |

The very small sizes (<10px) are deliberate — they're "chrome you notice peripherally" that gives the EVA terminal feel without pulling focus.

## `sys-label` class

Defined in [globals.css:103](../../app/globals.css):

```css
.sys-label {
  font-family: var(--font-space-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #444;
}
```

The workhorse utility for all "system voice" metadata. ~half of mono text on the site is a `sys-label`.

## Spanish diacritics

All three fonts support extended Latin (Spanish `ñ`, `á`, etc.). Space Mono renders `·` (middle dot) cleanly — used as the standard separator everywhere (`MEXICO·CDMX`, `UNIT·ID`).

## Links

- [[NGE Aesthetic]]
- [[Color System]]
- [[Utility Classes]]
- [[Voice and Copy]]
