# MarketplaceListingDetail

> `components/marketplace/MarketplaceListingDetail.tsx` — listing-level sub-overlay inside [[MarketplaceOverlay]].

## What it does

Opened when the URL has both `?partner=<slug>&listing=<id>`. Stacks at z-60 above [[MarketplaceOverlay]] (z-50) so the partner overlay stays visible underneath — closing this drops back to the partner card, not the catalog grid. ESC / CERRAR strips `listing=` only; the parent overlay's close handler strips `partner=`.

## Layout (two-column)

```
┌─ Chrome ──────────────────────────────────────────────────────┐
│ //LIST · NAAFI/01    [← VOLVER A NAAFI]        [ESC] CERRAR   │
├─ Left 55% ──────────────────┬─ Right 45% ──────────────────── ┤
│ ImageGallery                │ ★ MARKET · NAAFI                 │
│  - Main image (4:3)         │ Title + category                 │
│  - Thumbnail strip          │ Price                            │
│                             │ Condition + status pill          │
│                             │ //FUENTES (embeds, if any)       │
│                             │ //DESCRIPCIÓN                    │
│                             │ //ETIQUETAS                      │
│                             │ //ENTREGA (shipping mode)        │
│                             │ //VENDEDOR (← back button)       │
└─────────────────────────────┴──────────────────────────────────┘
```

Embeds are link-out chips (same [[Embed Primitive]] idiom as [[ArticuloOverlay]]) — GRADIENTE FM does not process payments or shipping, just surfaces contact info.

## Related

- [[MarketplaceOverlay]] — parent overlay that opens this
- [[MarketplaceListingCard]] — card that triggers the open
- [[Embed Primitive]] — shared platform label/detection
