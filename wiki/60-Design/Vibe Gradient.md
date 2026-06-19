---
type: design
status: current
tags: [design, vibe, gradient, color, instrument-ramp]
updated: 2026-06-12
---

# Vibe Gradient

> The dominant visual motif. Glacial cyan → estática → ember orange, mapping to the [[Vibe Spectrum]] 0–10. One system, hard-stepped, since Redesign 2026.

## One expression (was three)

> **Redesign 2026:** the three fragmented scales this page used to document — the Tailwind 8-stop pastel `bg-vibe-gradient`, the saturated rainbow `vibeToColor` 11-step, and the slider's per-dash `interpolateVibeColor` RGB lerp — are all gone. The reconciliation that sat on [[Open Questions]] happened, just not as a `mode:` parameter: there is now exactly **one** palette and every consumer renders it stepped.

Canonical source: `VIBE_SLOT_COLORS` in [utils.ts](../../lib/utils.ts). Everything else — the Tailwind `vibe-0…vibe-10` tokens, the `--vibe-gradient` custom property — is a derived copy, changed in lockstep.

## The 11-slot thermo-diverging instrument ramp

```
0  #087487   GLACIAL   oklch(0.515 0.089 215)
1  #217B98   POLAR     oklch(0.545 0.092 224)
2  #48819E   CHILL     oklch(0.575 0.075 233)
3  #6586A0   COOL      oklch(0.605 0.055 243)
4  #7A8A9D   FRESH     oklch(0.628 0.034 253)
5  #948E85   GROOVE    oklch(0.648 0.014 75)   ← the hinge: signal dying into static
6  #C38174   WARM      oklch(0.668 0.085 32)
7  #E17756   HOT       oklch(0.684 0.140 38)
8  #FC6C0F   FUEGO     oklch(0.700 0.196 45)   ← brand orange, sRGB gamut cusp
9  #FC9414   BRASA     oklch(0.760 0.171 62)   ← broadcast amber
10 #FEB225   VOLCÁN    oklch(0.815 0.163 76)   ← heading white-hot
```

Two hue arms hinged through a near-neutral middle:

- **Glacial cyan arm (0–4)** — desaturating as it warms toward the hinge.
- **Estática hinge (5)** — near-gray `#948E85`. The midpoint of the spectrum is *no signal*, not "purple".
- **Ember / overload arm (6–10)** — saturation climbs back; slots 8–10 sit on the **brand-orange family**. The brand color IS the meter's overload zone.

OKLCH anchors are recorded inline beside each hex (for future P3 upgrades). Structure precedent: Kovesi "linear-diverging" colormaps / FLIR Arctic thermal palettes — not a rainbow.

## Why monotonic lightness

OKLCH lightness climbs strictly 0.515 → 0.815 across the ramp: **energy = brightness**. Dim is cold, bright is hot, and the scale survives grayscale conversion — the old rainbow (cyan→magenta→red) had non-monotonic lightness, the classic "AI gradient" tell. Hue never transits green/purple/magenta and never folds back. Every slot clears 3:1 non-text contrast on the `#0D0D0D` base.

## Hard-stepped, never smooth

The ramp renders as **11 discrete bands, never a continuous gradient**. Calibrated bands read as *measured*; a smooth lerp reads as *generated*. Concretely:

- `--vibe-gradient` in [globals.css](../../app/globals.css) is a linear-gradient of 11 hard color stops (each band 9.09% wide). This is now the **single canonical definition** backing `.bg-vibe-gradient` — the old duplicate in `tailwind.config.ts::backgroundImage` (which shadowed it) was removed.
- [[VibeSlider]]'s tape dashes are hard-assigned to a slot (`Math.floor(t * 11)`), no per-dash lerp. `interpolateVibeColor` is deleted.
- [[VibeMeter]] renders 11 discrete segments.

## Lit / unlit convention

Out-of-band slots dim to a **low-alpha version of their own hue** — unlit LEDs on a calibrated scale, never gray. The full scale always renders (the printed plate); the band reading is which slots are lit. [[VibeMeter]] uses `'33'` alpha (~20%), the slider tape uses opacity 0.16 (slightly dimmer — the tape sits on `bg-base`, the meter over imagery).

## vibeBandGradient → VibeMeter

The `vibeBandGradient()` CSS-gradient helper (smooth band strips on cards/overlays) is **deleted** from [utils.ts](../../lib/utils.ts) — zero call sites after every strip was replaced by the [[VibeMeter]] component, which is now the canonical band display.

## Visual identity

The vibe ramp is **the** signature of the site, and per the "one expressive variable" rule it's the only expressive color on cards (see [[Color System]]). If a user describes GRADIENTE in one sentence, they probably mention the temperature scale going from cold cyan to burning orange. It's the brand at a glance — literally: the brand orange is slot 8.

## Links

- [[Vibe Spectrum]]
- [[Color System]]
- [[VibeMeter]]
- [[VibeSlider]]
- [[utils]]
