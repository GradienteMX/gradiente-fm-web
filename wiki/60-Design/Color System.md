---
type: design
status: current
tags: [design, color, palette]
updated: 2026-04-22
---

# Color System

> Black base. Grey ramp for chrome. Orange family for brand + alerts. Vibe gradient for content temperature. Category colors for type recognition.

## Five palettes

### 1. Base + greys (structural)

```
base         #000000   html background, absolute base
surface      #080808   slightly elevated (sidebar panels)
elevated     #111111   card fills, hover states
hover        #181818   explicit hover
border       #242424   main dividers
border-subtle #161616  faint dividers
primary      #F0F0F0   default text, headlines
secondary    #888888   subdued text
muted        #444444   chrome labels, meta
```

Defined in [tailwind.config.ts:17](../../tailwind.config.ts).

### 2. NGE system colors (accents)

```
sys-red      #E63329   brand red — section markers, hero accents, ★ badges
sys-orange   #F97316   hazard stripe orange
sys-amber    #F59E0B   (unused actively but defined)
sys-green    #4ADE80   live / online / pinned indicators
```

Plus an extensive inline palette in [[Navigation]] for EVA orange glow:
- `#FF6600` `#FF8800` `#FFAA00` `#FF9900` `#FFB800` `#FF2200` — the "MAGI fire" range
- Deep backgrounds `#1C1000` `#140B00` `#0C0500` `#030100` — near-black with orange tint
- `#00FF44` — MAGI status green

### 3. Vibe colors (content accent)

```
vibe-ice      #7DD3FC
vibe-cold     #38BDF8
vibe-cool     #818CF8
vibe-neutral  #A78BFA
vibe-warm     #E879F9
vibe-hot      #FB923C
vibe-fire     #F87171
vibe-volcano  #B91C1C
```

These are the **Tailwind** vibe color tokens (8 steps). A different, finer **11-step** discrete palette lives in [`vibeToColor`](../../lib/utils.ts) for per-item rendering.

Yes, there are two vibe palettes. See [[Vibe Gradient]] for the reconciliation and why it's like that.

### 4. Category colors (type indicators)

Returned by [`categoryColor`](../../lib/utils.ts):

| Type | Hex | Where it shows |
|---|---|---|
| evento | `#E63329` | red — the default brand accent |
| mix | `#22D3EE` | cyan — cool/aquatic |
| review | `#F59E0B` | amber — warm/critic |
| editorial | `#84CC16` | lime — fresh voice |
| noticia | `#F5F5F5` | near-white — neutral reportage |
| opinion | `#A78BFA` | violet — perspective |
| partner | `#6B7280` | grey — deliberately desaturated |

Used on the type badge `//EVENTO` label and the [[CategoryRail]] row labels.

### 5. The vibe gradient (full-spectrum fill)

An 8-stop horizontal gradient in `tailwind.config.ts::bg-vibe-gradient`:

```
#7DD3FC  0%   ice
#38BDF8  12%
#818CF8  28%
#A78BFA  42%
#E879F9  55%
#FB923C  70%
#F87171  83%
#B91C1C  100% volcano
```

Rendered whenever a continuous vibe bar is needed. See [[Vibe Gradient]].

## Selection color

`::selection { background: #E63329; color: #000 }` — highlighting any text paints it brand-red. Small but on-brand.

## Scrollbar

4px thin webkit scrollbar, `#333` thumb. See [globals.css:42](../../app/globals.css).

## Links

- [[NGE Aesthetic]]
- [[Typography]]
- [[Vibe Gradient]]
- [[Utility Classes]]
