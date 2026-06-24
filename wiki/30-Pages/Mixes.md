---
type: page
status: current
tags: [page, mixes]
updated: 2026-04-22
---

# Mixes — `/mixes`

> Mixes only. DJ sets, radio shows, exclusive drops.

## Source

[app/mixes/page.tsx](../../app/mixes/page.tsx)

## What

`filterForCategory(MOCK_ITEMS, 'mix')` → [[ContentGrid]] in `mode="category"`.

## Copy

Header: `MIXES · MIXES & RADIO · {count} ENTRADAS`
Empty: `// SIN MIXES EN ESTE RANGO`

## Missing / potential

- No player. `mixUrl` opens in a new tab via the card; in-page playback would be a meaningful feature. See [[Open Questions]].
- `tracklist` data exists on items but isn't rendered anywhere yet.
- [[ContentCard]] handles mixes the same as anything else in the mosaic. (The old linear `MixCard` variant with its fake waveform was removed 2026-06-23 — dead code deleted. See [[Dual Feed Systems]].)

## Links

- [[ContentGrid]]
- [[Content Types]]
- [[Open Questions]]
