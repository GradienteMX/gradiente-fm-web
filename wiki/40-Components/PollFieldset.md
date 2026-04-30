---
type: component
status: current
tags: [poll, dashboard, form, author]
updated: 2026-04-30
---

# PollFieldset

> Shared poll-authoring section for every dashboard compose form. One toggle to opt the content item into a poll; per-kind UI behind it for prompt + choices + close date + multi-choice flag.

## Source

[components/dashboard/forms/shared/PollFieldset.tsx](../../components/dashboard/forms/shared/PollFieldset.tsx)

## Surface

Two states:

- **Off** — a single dashed `+ INCLUIR ENCUESTA` button. Clicking opt-ins; creates an empty poll with the kind derived from the parent content type.
- **On** — full editor panel (`//ENCUESTA · {KIND}`) with a `× QUITAR` chip in the header. Below the help text:
  - `PREGUNTA` text input — required; placeholder is the `POLL_DEFAULT_PROMPT[kind]` from [[polls]].
  - `OPCIONES` editor — **freeform only**. Add/remove rows, each row is a labeled input. For non-freeform kinds the help text explains that choices auto-derive from the parent (track list / tracklist / fixed attendance set).
  - `CIERRA (opcional)` datetime input — empty = open indefinitely.
  - `VOTO MÚLTIPLE` checkbox — defaults off.

## Per-type kind resolution

The fieldset reads `type` from the parent draft and picks the kind:

| ContentType | PollKind | Editor surface |
|---|---|---|
| `listicle` | `from-list` | prompt + close + multi |
| `mix` | `from-tracklist` | prompt + close + multi |
| `evento` | `attendance` | prompt + close + multi |
| `noticia` / `review` / `editorial` / `opinion` / `articulo` | `freeform` | prompt + **choices** + close + multi |
| `partner` | (none) | renders nothing |

Editors don't pick the kind — it's determined by *what they're composing*. This matches the [[Polls As Attachments]] decision: the parent type determines what kind of poll makes sense.

## Mount

Dropped into all 8 compose forms ([[Dashboard Forms]]) as a `<Section label="..." title="ENCUESTA (opcional)">` near the end (just before `<SubmitFooter>`). Section number varies per form because each form has a different number of preceding sections.

## Backend migration

Pure UI — no storage. The poll lives on the draft via `draft.poll`, which rides through the existing draft → published pipeline ([[drafts]]). When [[Supabase Migration]] lands, the poll attachment goes into the `content_items.poll` column (jsonb) alongside the rest of the item; this fieldset's onChange shape doesn't change.

## Links

- [[polls]] — `POLL_DEFAULT_PROMPT` + the data shape
- [[PollCardCanvas]] · [[PollSection]] — public-side consumers
- [[Dashboard Forms]] — the parent compose forms
- [[Polls As Attachments]] — the design decision
