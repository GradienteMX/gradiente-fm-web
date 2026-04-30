---
type: component
status: current
tags: [poll, overlay, section, vote]
updated: 2026-04-30
---

# PollSection

> Overlay-level poll surface. Sibling of [[PollCardCanvas]] — same data, same anonymous-until-vote gate — but laid out as a permanent section with the overlay's larger padding and font sizes.

## Source

[components/poll/PollSection.tsx](../../components/poll/PollSection.tsx)

## Layout

`<section>` block with eva-style border + `bg-elevated/30`. Three rows:

- **Header** — `//ENCUESTA` label (amber gold) + total-vote count when results are visible.
- **Prompt** — large title (Syne 18px bold).
- **Choices** — vibe-colored bordered rows. Pre-vote: clickable. Post-vote: bordered + filled with vibe-tinted result bar; `%` + `(count)` on the right.

When the viewer hasn't voted (and the poll isn't closed), a footer line reads `//ANÓNIMO·HASTA·VOTAR — los resultados aparecen cuando emitas tu voto. Inicia sesión para participar.` (login hint omitted when already authed).

## Mount points

- [[ListicleOverlay]] — between the ranked body and `//SIGUIENTES·LISTAS`. The list's `track` blocks become the choices automatically.
- [[MixOverlay]] — between the tracklist panel and the hotkeys footer. Tracklist rows become choices.
- [[EventoOverlay]] — between the artists/genres section and the `COMPRAR BOLETOS` CTA. Attendance variant — VOY / TAL VEZ / NO PUEDO.
- [[ReaderOverlay]] — between the article body and the sticky reader footer. Freeform variant.
- [[ArticuloOverlay]] — between body+footnotes and `//SIGUIENTES·LECTURAS`. Freeform variant.

Each overlay renders `{item.poll && <PollSection item={item} ... />}` so polls only appear when the parent has one.

## Why two surfaces

Same poll, two contexts:

- **PollCardCanvas** — for the casual voter who never opens the overlay. Borrows the card image temporarily.
- **PollSection** — for the deep-engaged reader inside the overlay. Permanent, roomier, sits in context with the rest of the article.

Both flow into the same vote store, so a vote cast on either surface is reflected on the other. See [[Polls As Attachments]].

## Anonymous-until-vote

Same gate as the card canvas: counts hidden until `useUserVote(...) !== null` or the poll closes. The overlay surface adds an explicit "Inicia sesión para participar" hint for logged-out viewers because the overlay is the more committed reading context.

## Links

- [[polls]] — store + hooks + per-type resolver
- [[PollCardCanvas]] — sibling card-level component
- [[PollFieldset]] — author-side editing
- [[ListicleOverlay]] · [[MixOverlay]] · [[EventoOverlay]] · [[ReaderOverlay]] · [[ArticuloOverlay]] — mount points
- [[Polls As Attachments]] — the design decision
