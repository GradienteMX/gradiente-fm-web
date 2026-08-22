'use client'

// ── MAPA — a screenshot door to /mapa (revision-2 point 15) ─────────────────
//
// Iker: «que sea un screenshot, pero para no jalar demasiado recurso, que le
// tengas que dar click y te lleve a tu view de mapa». No live schematic, no
// dots, no lists — ONE static capture of the real /mapa terrain
// (public/dash/mapa-screenshot.jpg, refresh it when the map changes shape)
// and the whole surface is a single click → /mapa. Zero runtime cost.
//
// CdmxSchematic + the venueGeo dot pipeline are retired from this widget
// (venueGeo itself stays — the provider still derives from it).

import { useRouter } from 'next/navigation'
import type { DashboardWidgetProps } from '@/components/dashboard/grid/WidgetGrid'
import { FOCUS_RING, WidgetFrame } from '@/components/dashboard/grid/WidgetFrame'
import { dashWidgetDomId } from '@/components/dashboard/shell/StatusStrip'
import { SmartImage } from '@/components/SmartImage'
import { PANEL_SCRIM } from '@/lib/dashboard/palette'

const MAPA_SHOT = '/dash/mapa-screenshot.jpg'

export function MapaWidget({ compact }: DashboardWidgetProps) {
  const router = useRouter()
  const goMapa = () => router.push('/mapa')

  if (compact) {
    return (
      <div id={dashWidgetDomId('mapa')} className="h-full scroll-mt-14">
        <WidgetFrame
          title="MAPA"
          compact
          action={{ label: 'ABRIR MAPA', onClick: goMapa, external: true, cue: 'tick' }}
        >
          <p className="min-w-0 font-mono text-d13 text-ink-soft">
            El terreno de señales de la ciudad.
          </p>
        </WidgetFrame>
      </div>
    )
  }

  return (
    <div id={dashWidgetDomId('mapa')} className="h-full scroll-mt-14">
      <WidgetFrame title="MAPA">
        {/* The whole surface is the door — one click, one destination. */}
        <button
          type="button"
          onClick={goMapa}
          data-cue="tick"
          aria-label="Abrir el mapa"
          className={`group relative block h-full w-full overflow-hidden border border-ink bg-panel text-left ${FOCUS_RING}`}
        >
          <SmartImage
            src={MAPA_SHOT}
            alt="Vista del mapa de señales"
            className="object-cover opacity-90 transition-opacity group-hover:opacity-100"
            sizes="600px"
          />
          <span
            className="absolute bottom-0 right-0 flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-d13 font-bold uppercase tracking-widest text-panel-text"
            style={{ background: PANEL_SCRIM }}
          >
            ABRIR MAPA <span aria-hidden>↗</span>
          </span>
        </button>
      </WidgetFrame>
    </div>
  )
}
