---
type: design
status: current
tags: [design, voice, copy, spanish]
updated: 2026-04-22
---

# Voice and Copy

> Spanish UI. English code. Two tonal registers: **editorial voice** for content, **system voice** for chrome.

## Language split

- **UI copy, editorial copy, item content** → **Spanish** (`<html lang="es">`)
- **Code, types, file names, git messages** → **English**

All content in [[mockData]] is Spanish. All TypeScript types, function names, and component names are English. Don't cross.

## Editorial voice

- Informal-but-informed. Uses scene vocabulary without irony.
- Full Spanish: accents, `ñ`, `¿`, `¡`.
- Can name-drop without context: "DJ Python b2b Cøsmetic" doesn't need "the DJ known as" preamble — readers know or look up.
- Okay to mix Spanish + English where that's how the scene talks: "closing party", "b2b", "all night long".

Example from [[mockData]]:

> _"El productor oaxaqueño presenta su nuevo proyecto audiovisual en vivo: síntesis modular, procesamiento en tiempo real y el Popocatépetl como eje narrativo."_

## System voice

The chrome speaks a different language — mono-font, all-caps, `//` tokens, NGE terminology:

| Place | Copy |
|---|---|
| Home feed header | `TODO LO QUE VIENE · 12 ENTRADAS · PROMINENCIA ORGÁNICA · SEÑAL + FRESCURA` |
| Hero header | `// EN PORTADA · SE ACTUALIZA SEMANALMENTE` · `● PINNED` |
| Empty state | `// SIN CONTENIDO EN ESTE RANGO DE VIBE` |
| Footer | `© 2026 · DESDE ADENTRO DE LA ESCENA MEXICANA` · `● ONLINE` |
| Nav data strip | `CDMX·UNDERGROUND // MUSICA·ELECTRONICA // FREQ·ACTIVA·128BPM // MAGI·SYSTEM·NOMINAL // A·T·FIELD·STABLE // BIOPATTERN·LOCKED` |
| MAGI indicators | `CASPAR · OK` / `BALTHASAR · OK` / `MELCHIOR · OK` |
| Vibe labels | `GLACIAL · POLAR · CHILL · COOL · FRESH · GROOVE · WARM · HOT · FUEGO · BRASA · VOLCÁN` |

## Rules

1. **Single-line chrome is uppercase.** Multi-line body never is.
2. **`//` is the section marker.** Don't use `---`, `▪`, or other dividers inline.
3. **`·` (middle dot) is the standard separator** in compact metadata: `CDMX · Monterrey 56, Roma Norte`.
4. **Empty states and failures get EVA phrasing.** `// SIN EVENTOS EN ESTE RANGO` is better than "No events found". Stay in character.
5. **`SE ACTUALIZA SEMANALMENTE` and similar system annotations are promises** — copy that implies a cadence commits the editor to that cadence.

## Avoid

- Generic "Welcome to our site" / "Subscribe to our newsletter" voice.
- English chrome in the UI (`HOME`, `MIXES`, `AGENDA` are OK as they're international titles; `Loading…` is not — use `CARGANDO` or `// SINC`).
- Corporate/sponsored copy voice anywhere outside the `partner` card label.

## Links

- [[NGE Aesthetic]]
- [[Typography]]
- [[mockData]]
