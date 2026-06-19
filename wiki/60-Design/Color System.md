---
type: design
status: current
tags: [design, color, palette]
updated: 2026-06-12
---

# Color System

> Charcoal base. Grey ramp for chrome. Orange family for brand + alerts. Vibe ramp for content temperature — the **one expressive variable** on cards. Category colors demoted to non-card chrome.

## Five palettes

### 1. Base + greys (structural)

> **Redesign 2026:** base moved `#000000` → `#0D0D0D` deep charcoal (pure black fails nighttime readability — RA brutalism teardown). The whole grey ramp was re-derived to keep the original elevation deltas above the new base.

```
base         #0D0D0D   html background, deep charcoal
surface      #141414   slightly elevated (sidebar panels)
elevated     #1B1B1B   card fills, hover states
hover        #222222   explicit hover
border       #2E2E2E   main dividers
border-subtle #202020  faint dividers
primary      #F0F0F0   default text, headlines
secondary    #888888   subdued text
muted        #4A4A4A   chrome labels, meta
```

Defined in [tailwind.config.ts](../../tailwind.config.ts).

### 2. System colors (accents)

```
sys-red      #E63329   brand red — section markers, hero accents, ★ badges
sys-orange   #F97316   hazard stripe orange
sys-amber    #F59E0B   (unused actively but defined)
sys-green    #4ADE80   live / online / pinned indicators
```

> **Redesign 2026:** the extensive inline "MAGI fire" palette in [[Navigation]] (`#FF6600`…`#FF2200`, near-black orange-tinted backgrounds, `#00FF44` status green — 18 inline hexes) is gone, replaced by the tokens above. The `.eva-glow` / `.eva-glow-sm` / `holo-flicker` CSS was deleted (Navigation was the last consumer).

### 3. Vibe colors (content accent)

```
vibe-0   #087487   GLACIAL
vibe-1   #217B98   POLAR
vibe-2   #48819E   CHILL
vibe-3   #6586A0   COOL
vibe-4   #7A8A9D   FRESH
vibe-5   #948E85   GROOVE — estática hinge
vibe-6   #C38174   WARM
vibe-7   #E17756   HOT
vibe-8   #FC6C0F   FUEGO — brand orange
vibe-9   #FC9414   BRASA
vibe-10  #FEB225   VOLCÁN
```

The Tailwind `vibe-0…vibe-10` tokens (they replaced the old 8-step pastel `vibe-ice…vibe-volcano` set in Redesign 2026). Single source of truth is `VIBE_SLOT_COLORS` in [utils.ts](../../lib/utils.ts) — the tokens are a copy, changed in lockstep. One palette now, not two. See [[Vibe Gradient]] for structure + rationale.

**The "one expressive variable" rule:** vibe temperature is the only expressive color on cards. Everything else on a card is greys + system colors (★ editorial stays sys-red, PINNED sys-green, //PRESENTA orange — system colors, not category hues).

### 4. Category colors (type indicators — demoted on cards)

Returned by [`categoryColor`](../../lib/utils.ts):

| Type | Hex | Note |
|---|---|---|
| evento | `#E63329` | red — the default brand accent |
| mix | `#22D3EE` | cyan — cool/aquatic |
| review | `#F59E0B` | amber — warm/critic |
| editorial | `#84CC16` | lime — fresh voice |
| noticia | `#F5F5F5` | near-white — neutral reportage |
| opinion | `#A78BFA` | violet — perspective |
| articulo | `#FDE68A` | pale gold — longform |
| listicle | `#FB923C` | orange — curated lists |
| partner | `#6B7280` | grey — deliberately desaturated |

> **Redesign 2026:** category hues are retired from card chrome — the `//EVENTO` type badge is plain `text-secondary` now, per the one-expressive-variable rule (§3). `categoryColor()` still exists and still colors the `fresh-glitch` border suite plus non-card uses: [[CategoryRail]] row labels, [[FeedHeader]], [[SearchOverlay]] results, overlay headers, dashboard chrome, empty states.

### 5. The vibe gradient (full-spectrum fill)

`--vibe-gradient` in [globals.css](../../app/globals.css) — **11 hard slot steps** of the instrument ramp (each band 9.09% wide), backing the `.bg-vibe-gradient` utility. This is the single canonical definition; the old smooth 8-stop duplicate in `tailwind.config.ts::backgroundImage` (which shadowed it) was removed. Stepped, not smooth — see [[Vibe Gradient]].

## Selection color

`::selection { background: #E63329; color: #000 }` — highlighting any text paints it brand-red. Small but on-brand.

## Scrollbar

4px thin webkit scrollbar, `#333` thumb on `#0D0D0D` track. See [globals.css](../../app/globals.css).

## Links

- [[NGE Aesthetic]]
- [[Typography]]
- [[Vibe Gradient]]
- [[Utility Classes]]
