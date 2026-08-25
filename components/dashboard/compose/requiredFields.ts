// ── requiredFields — the ONE source of required-field truth for the light
//    composer («EL PLIEGO DE COMPOSICIÓN v2») ────────────────────────────────
//
// The dark forms (components/dashboard/forms/** — untouched, /admin depends)
// each carry an inline `errors: string[]` block with 2-4 FALTA rules. This
// module lifts those EXACT rules into one per-type map so the light composer
// derives BOTH the rail checklist (✓/○ rows + completeness bar) and the
// submit gate (`errors` / `canSubmit`) from a single computation.
//
// PARITY IS THE LAW: every rule below is copied from its dark original —
// same field, same truthiness check, same display label, same order. No new
// requirements are invented here; if a dark form's rules change, this map
// changes in lockstep. Sources (branch dashboard/aaa-revamp):
//
//   MixForm.tsx:112-115        TÍTULO · SLUG
//   EventoForm.tsx:113-117     TÍTULO · SLUG · INICIO (!draft.date)
//   ReviewForm.tsx:128-132     TÍTULO · SLUG · CUERPO (!draft.bodyPreview?.trim())
//   NoticiaForm.tsx:84-87      TITULAR · SLUG
//   EditorialForm.tsx:85-89    TÍTULO · SLUG · CUERPO (!draft.bodyPreview?.trim())
//   OpinionForm.tsx:86-90      TÍTULO · SLUG · CUERPO (!draft.bodyPreview?.trim())
//   ArticuloForm.tsx:134-141   TÍTULO · SLUG · CUERPO ((draft.articleBody ?? []).length === 0)
//   ListicleForm.tsx:109-113   TÍTULO · SLUG · CUERPO ((draft.articleBody ?? []).length === 0)
//
// KEEPS today's coupling: required-incomplete gates BOTH GUARDAR BORRADOR and
// PUBLICAR (the dark SubmitFooter disables both) — the rail only makes the
// gate legible («FALTAN n CAMPOS»), it never loosens or tightens it.

import type { ContentItem } from '@/lib/types'
import type { ComposeType } from '@/components/dashboard/widgets/cultivar/CrearZone'

// ── Anchor contract ─────────────────────────────────────────────────────────
// Each required field maps to ONE stable DOM id. The light form for a type
// attaches `id={COMPOSE_ANCHOR_IDS.<key>}` to the wrapper of the matching
// field; the rail checklist calls `onAnchor(anchorId)` and the form owner
// scrolls it into view. Only one composer mounts at a time, so the ids never
// collide across types.

export type RequiredFieldKey = 'title' | 'slug' | 'date' | 'body'

export const COMPOSE_ANCHOR_IDS: Record<RequiredFieldKey, string> = {
  title: 'compose-field-title',
  slug: 'compose-field-slug',
  date: 'compose-field-date',
  body: 'compose-field-body',
}

export interface RequiredField {
  key: RequiredFieldKey
  // Display label — EXACTLY the string the dark form pushes into `errors`
  // (noticia says TITULAR, evento's date says INICIO). Feeds both the
  // checklist rows and the FALTA copy.
  label: string
  done: boolean
  anchorId: string
}

// ── The per-type rules ──────────────────────────────────────────────────────

function field(key: RequiredFieldKey, label: string, done: boolean): RequiredField {
  return { key, label, done, anchorId: COMPOSE_ANCHOR_IDS[key] }
}

/**
 * Required-field list for `type`, evaluated against the live draft.
 * Order matches the dark forms' push order (title → slug → type-specific),
 * so `errorsFrom()` joins in the same sequence as the dark FALTA chip.
 */
export function requiredFields(type: ComposeType, draft: ContentItem): RequiredField[] {
  const list: RequiredField[] = [
    // NoticiaForm alone labels the title TITULAR; every other form says TÍTULO.
    field('title', type === 'noticia' ? 'TITULAR' : 'TÍTULO', Boolean(draft.title)),
    field('slug', 'SLUG', Boolean(draft.slug)),
  ]

  switch (type) {
    case 'evento':
      // EventoForm:116 — `if (!draft.date) errors.push('INICIO')`
      list.push(field('date', 'INICIO', Boolean(draft.date)))
      break
    case 'review':
    case 'editorial':
    case 'opinion':
      // ReviewForm:131 / EditorialForm:88 / OpinionForm:89 —
      // `if (!draft.bodyPreview?.trim()) errors.push('CUERPO')`
      list.push(field('body', 'CUERPO', Boolean(draft.bodyPreview?.trim())))
      break
    case 'articulo':
    case 'listicle':
      // ArticuloForm:140 / ListicleForm:112 —
      // `if (blocks.length === 0) errors.push('CUERPO')` with
      // `blocks = draft.articleBody ?? []`
      list.push(field('body', 'CUERPO', (draft.articleBody ?? []).length > 0))
      break
    case 'mix':
    case 'noticia':
      // Title + slug only (MixForm:112-115, NoticiaForm:84-87).
      break
  }

  return list
}

// ── Derivations (single source feeding rail + gate) ─────────────────────────

/** Display labels of the still-pending fields — the dark `errors` array. */
export function errorsFrom(list: RequiredField[]): string[] {
  return list.filter((f) => !f.done).map((f) => f.label)
}

/** «n/m campos obligatorios» for the rail's COMPLETITUD readout + bar. */
export function completeness(list: RequiredField[]): { done: number; total: number } {
  return {
    done: list.filter((f) => f.done).length,
    total: list.length,
  }
}
