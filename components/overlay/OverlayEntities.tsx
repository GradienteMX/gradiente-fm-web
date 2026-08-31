'use client'

import type { EntityKind, EntityRef } from '@/lib/types'
import { EntityChipButton } from '@/components/entity/EntityChipButton'

// Shared CONTEXTO entity renderer for the overlays that lack ReaderOverlay's
// dl-native EntityRow (Mix/Listicle/Evento/Articulo). Renders the item's
// `subject` scene entities as labeled rows of clickable chips, grouped by kind
// in a fixed order. Self-contained block (own headers), so it drops into any
// layout regardless of the host grid. Null when there are no subject entities.
//
// Fase C («EL PLIEGO»): printed on paper — mono d11 kind headers on hairlines,
// chips as bordered ink chips with fill-inversion hover. EntityChipButton's
// close+navigate gesture is untouched; only its dress changes, imposed from
// this call site.
const KIND_ORDER: EntityKind[] = ['artist', 'label', 'venue', 'promoter']
const KIND_LABEL: Record<EntityKind, string> = {
  artist: 'ARTISTAS',
  label: 'LABELS',
  venue: 'VENUES',
  promoter: 'PROMOTORAS',
}

// Paper chip dress for EntityChipButton. The component bakes in the dark-ground
// hover (scale/brightness pop) and a 1px current-color focus outline; it sits
// outside this fase's file ownership, so the print grammar is imposed from the
// caller. The `!` (important) utilities are deliberate: they must beat the
// baked-in hover:scale-110 / hover:brightness-150 / outline-1 regardless of
// generated-stylesheet order — hover on paper is a straight fill inversion,
// never a pop.
const PAPER_CHIP =
  'inline-flex items-center border border-ink px-2 py-1 font-mono text-d11 text-ink transition-colors hover:bg-ink hover:text-paper-raised hover:!scale-100 hover:!brightness-100 focus-visible:!outline-2 focus-visible:!outline-ink focus-visible:outline-offset-2'

export function OverlayEntities({
  entities,
}: {
  entities?: EntityRef[]
  // Legacy accent from pre-paper callers — intentionally ignored on paper.
  color?: string
}) {
  const subjects = (entities ?? []).filter(
    (e) => (e.relation ?? 'subject') === 'subject',
  )
  if (subjects.length === 0) return null
  return (
    <div className="flex flex-col gap-3">
      {KIND_ORDER.map((kind) => {
        const ofKind = subjects.filter((e) => e.kind === kind)
        if (ofKind.length === 0) return null
        return (
          <div key={kind} className="flex flex-col gap-1.5">
            <span className="border-b border-ink-faint pb-1 font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
              {KIND_LABEL[kind]}
            </span>
            <span className="flex flex-wrap items-center gap-1.5">
              {ofKind.map((e) => (
                <EntityChipButton key={e.id} entity={e} className={PAPER_CHIP}>
                  {e.name}
                </EntityChipButton>
              ))}
            </span>
          </div>
        )
      })}
    </div>
  )
}
