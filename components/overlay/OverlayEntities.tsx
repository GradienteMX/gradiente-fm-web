'use client'

import type { EntityKind, EntityRef } from '@/lib/types'
import { EntityChipButton } from '@/components/entity/EntityChipButton'

// Shared CONTEXTO entity renderer for the overlays that lack ReaderOverlay's
// dl-native EntityRow (Mix/Listicle/Evento/Articulo). Renders the item's
// `subject` scene entities as labeled rows of clickable chips, grouped by kind
// in a fixed order. Self-contained block (own sys-labels), so it drops into any
// layout regardless of the host grid. Null when there are no subject entities.
const KIND_ORDER: EntityKind[] = ['artist', 'label', 'venue', 'promoter']
const KIND_LABEL: Record<EntityKind, string> = {
  artist: 'ARTISTAS',
  label: 'LABELS',
  venue: 'VENUES',
  promoter: 'PROMOTORAS',
}

export function OverlayEntities({
  entities,
  color,
}: {
  entities?: EntityRef[]
  color: string
}) {
  const subjects = (entities ?? []).filter(
    (e) => (e.relation ?? 'subject') === 'subject',
  )
  if (subjects.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      {KIND_ORDER.map((kind) => {
        const ofKind = subjects.filter((e) => e.kind === kind)
        if (ofKind.length === 0) return null
        return (
          <div
            key={kind}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-1"
          >
            <span className="sys-label shrink-0">{KIND_LABEL[kind]}</span>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs">
              {ofKind.map((e) => (
                <EntityChipButton key={e.id} entity={e} style={{ color }}>
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
