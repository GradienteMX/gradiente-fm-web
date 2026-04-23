---
type: module
status: current
tags: [module, types, schema]
updated: 2026-04-22
---

# types

> The canonical shape of a `ContentItem`. Single source of truth for the data model.

## Source

[lib/types.ts](../../lib/types.ts)

## Exports

```ts
type ContentType   = 'evento' | 'mix' | 'noticia' | 'review' | 'editorial' | 'opinion' | 'partner'
type PartnerKind   = 'promo' | 'label' | 'promoter' | 'venue' | 'sponsored'
type VibeScore     = number                      // 0-10, conceptually integer
type VibeRange     = [number, number]            // [min, max]
interface ContentItem { … }
interface Genre     { id; name; category: 'electronic' | 'club' | 'organic' | 'experimental' }
interface Tag       { id; name }
```

See [[Content Types]] for field-by-field usage.

## Design decisions

- **One interface for all types.** All fields optional beyond the required 7. Discriminated unions would be more correct but more ceremonious; pragma over purity. See [[Content Types]].
- **Dates as ISO strings, not `Date`.** Serializes cleanly, round-trips to any backend, survives `JSON.stringify`. `parseISO` at the read site.
- **Arrays of genre/tag ids, not objects.** Lookup via [[genres]]. Keeps items small; catalog centralized.
- **`VibeScore` is `number`**, not an integer type. TypeScript doesn't have int/float — convention is to keep it integer.

## Curation fields

```ts
hp?: number                     // current health, see [[HP Curation System]]
hpLastUpdatedAt?: string        // ISO snapshot timestamp
editorial?: boolean             // spawn HP boost
pinned?: boolean                // [[Pinned Hero]] candidate
```

All optional — when absent, [`currentHp`](../../lib/curation.ts) uses `spawnHp(item)` + `publishedAt`.

## Links

- [[Content Types]]
- [[mockData]]
- [[curation]]
