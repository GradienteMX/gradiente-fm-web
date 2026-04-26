---
type: component
status: current
tags: [overlay, mix, player, embed]
updated: 2026-04-24
---

# MixOverlay

> Dedicated overlay for the `mix` content type. Terminal-aesthetic multi-panel reader with source-tabs, decorative waveform, context metadata, and structured tracklist.

## What

Renders when [[OverlayRouter]] receives an item with `type: 'mix'`. File: [MixOverlay.tsx](../../components/overlay/MixOverlay.tsx).

Layout is a two-column `article` inside [[OverlayShell]]:

**Left column (editorial):**
- `[★ MIX]` type tag (orange border)
- Title + subtitle (Syne black, large)
- Excerpt
- Meta row (ARTISTA / PUBLICADO / DURACIÓN / VIBE with 10-bar fuel gauge)
- `bodyPreview` paragraphs
- Genre pills (orange bordered)

**Right column (system — three numbered panels):**
- `01 AUDIO EMBED // REPRODUCTOR` — source tabs (SoundCloud / YouTube / Spotify / Bandcamp / Mixcloud), cover + title, decorative seeded waveform, static timestamps, non-functional transport controls, `[ABRIR FUENTE]` link-out
- `02 CONTEXTO` — key-value grid (SERIE / GRABADO EN / FORMATO / BPM / KEY / ESTATUS)
- `03 TRACKLIST / ETIQUETAS` — numbered table `# | ARTISTA | TEMA | BPM`, then ETIQUETAS chips

Plus a bottom strip echoing the MODO ESCUCHA / `O ABRIR FUENTE` / `ESC CERRAR` shortcut hints.

## Why

Before 2026-04-24, mix fell through to [[GenericOverlay]] — image on top, simple metadata, tracklist unrendered. The mix is the primary content unit for the mixes vertical; it needed a dedicated surface matching the mockup the user shared.

Design goals (per the conversation that produced this):
- Visual prototype only — no real audio playback yet
- Terminal aesthetic, not streaming-platform mimicry
- Source tabs reflect the editorial reality that mixes often live on multiple platforms; the listener picks
- Waveform is decorative/seeded (deterministic per mix slug) — avoids locking to a single platform's waveform API (SoundCloud has one, others don't); swaps cleanly to audio-reactive later

## How

**Source tabs:** Driven by `item.embeds: MixEmbed[]`. Tabs only show for platforms with a URL. Active tab tracks React state and changes what `[ABRIR FUENTE]` + play button open.

**Decorative waveform:** `seededWaveform(item.slug, 64)` — deterministic PRNG hashed from the slug. `progress` is also seeded so each mix has a stable-looking "playhead" position even with no real audio.

**Transport controls:** Present but only the play button + `[ABRIR FUENTE]` + `O` hotkey are wired — they all open the active tab's URL in a new tab. Prev/back10/fwd10/next are `disabled` — placeholders until the audio-context session wires them to real state.

**Keyboard:** `O` opens active source. `P` reserved for future play/pause. ESC is owned by [[OverlayShell]].

**Graceful degradation:** All three panels handle missing data — empty CONTEXTO shows "Sin metadata de contexto.", empty tracklist shows "Tracklist no publicado.", mixes with no embeds fall back to the legacy `mixUrl`.

## Links

- [[Overlay System]]
- [[OverlayRouter]]
- [[OverlayShell]]
- [[Embed Primitive]]
- [[Content Types]]
- [[MixCard]]
- [[GenericOverlay]] — former fallback, now only used for `partner` (no partner overlay built) and anything else that slips through the switch

## Open questions

- Real audio playback — deferred to audio-context session. See [[Open Questions]].
- Custom transport controls wiring — same.
- Real SoundCloud waveform via their API — an option once audio session lands; would introduce per-platform parity issues.
