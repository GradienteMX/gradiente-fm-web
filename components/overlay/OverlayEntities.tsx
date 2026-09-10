'use client'

import { useRouter } from 'next/navigation'
import type { EntityKind, EntityRef, FranjaKind, FranjaRef } from '@/lib/types'
import { EntityChipButton } from '@/components/entity/EntityChipButton'
import { useOverlay } from '@/components/overlay/useOverlay'

// Shared CONTEXTO entity renderer for the overlays that lack ReaderOverlay's
// dl-native EntityRow (Mix/Listicle/Evento/Articulo). Renders the item's
// `subject` scene entities as labeled rows of clickable chips, grouped by kind
// in a fixed order, followed by the franjas the piece is ABOUT (item_franjas,
// migration 0051) as a FRANJAS row whose chips lead to /f/[slug]. Self-
// contained block (own headers), so it drops into any layout regardless of
// the host grid. Null when there is nothing to show.
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
const FRANJA_KIND_LABEL: Record<FranjaKind, string> = {
  label: 'SELLO', venue: 'LUGAR', promoter: 'PROMOTORA', colectivo: 'COLECTIVO', dealer: 'DEALER',
  festival: 'FESTIVAL', club: 'CLUB', medios: 'MEDIOS', 'mix-series': 'SERIE', plataforma: 'PLATAFORMA',
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
const FRANJA_CHIP =
  'inline-flex items-center gap-1.5 border border-ink px-2 py-1 font-mono text-d11 text-ink transition-colors hover:bg-ink hover:text-paper-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2'

// Franja chip — same gesture as EntityChipButton (close the overlay, then
// route) but to the franja dossier at /f/[slug].
export function FranjaChip({ franja }: { franja: FranjaRef }) {
  const { close } = useOverlay()
  const router = useRouter()
  return (
    <button
      type="button"
      title={`Ver franja · ${franja.title}`}
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        close()
        router.push(`/f/${franja.slug}`)
      }}
      className={FRANJA_CHIP}
    >
      <span className="text-ink-faint">{FRANJA_KIND_LABEL[franja.kind] ?? franja.kind.toUpperCase()}</span>
      {franja.title}
    </button>
  )
}

export function OverlayEntities({
  entities,
  franjaRefs,
}: {
  entities?: EntityRef[]
  franjaRefs?: FranjaRef[]
  // Legacy accent from pre-paper callers — intentionally ignored on paper.
  color?: string
}) {
  const subjects = (entities ?? []).filter(
    (e) => (e.relation ?? 'subject') === 'subject',
  )
  const franjas = franjaRefs ?? []
  if (subjects.length === 0 && franjas.length === 0) return null
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
      {franjas.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="border-b border-ink-faint pb-1 font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
            FRANJAS
          </span>
          <span className="flex flex-wrap items-center gap-1.5">
            {franjas.map((f) => <FranjaChip key={f.id} franja={f} />)}
          </span>
        </div>
      )}
    </div>
  )
}
