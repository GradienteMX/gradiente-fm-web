'use client'

// ── CdmxSchematic — hand-drawn schematic CDMX (FINAL_SPEC §3.7) ─────────────
//
// SELF-CONTAINED SVG linework in the venueGeo coordinate space
// (x: 0 poniente → 100 oriente · y: 0 norte → 100 sur) — zero map-tile deps,
// zero imports from the forbidden app/mapa / components/mapa / lib/mapa
// trees. This is a *reference drawing*, not cartography: the axes a chilango
// orients by (Insurgentes, Reforma, Eje Central, Viaducto, Circuito,
// Periférico), Chapultepec, the Zócalo, the airport field, the Xochimilco
// canals — all in panel-text hairline ink on the black panel.
//
// Anchors (venueGeo.ts lockstep): Centro ≈ (62,38) · Juárez ≈ (50,44) ·
// Roma Norte ≈ (47,54) · Condesa ≈ (41,56) · Coyoacán ≈ (53,87).
//
// LAW: dots arrive ONLY from venueGeo-resolved events (the widget resolves;
// this component draws what it is handed — it fabricates nothing). N=1 is a
// designed composition: hairline crosshair reticle + venue caption +
// «1 SEÑAL ACTIVA» — a located transmission, not an empty map.
//
// Colors come from lib/dashboard/palette (the sanctioned programmatic
// source for SVG). Strokes use vector-effect: non-scaling-stroke so the
// hairline weight holds at any rendered size; preserveAspectRatio="none"
// keeps the SVG space congruent with the %-positioned HTML dot layer.
// Static drawing — no animation (motion constitution: nothing loops).

import { DASH_ACID, DASH_PANEL_TEXT } from '@/lib/dashboard/palette'

export interface SchematicDot {
  slug: string
  title: string
  venueLabel: string
  dateLabel: string
  // venueGeo schematic space, 0–100 both axes.
  x: number
  y: number
  saved: boolean
}

// Focus ring for controls ON the black panel — the shared FOCUS_RING is ink
// on ink here, so the panel variant outlines in panel-text instead.
const PANEL_FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-text'

const clampPct = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v))

// A small "+" survey mark at a reference neighborhood (pure graphic).
function AnchorMark({ x, y }: { x: number; y: number }) {
  return (
    <g stroke={DASH_PANEL_TEXT} strokeOpacity={0.45} vectorEffect="non-scaling-stroke">
      <line x1={x - 1.2} y1={y} x2={x + 1.2} y2={y} vectorEffect="non-scaling-stroke" />
      <line x1={x} y1={y - 1.2} x2={x} y2={y + 1.2} vectorEffect="non-scaling-stroke" />
    </g>
  )
}

export function CdmxSchematic({
  dots,
  onSelect,
}: {
  dots: readonly SchematicDot[]
  onSelect: (slug: string) => void
}) {
  const single = dots.length === 1 ? dots[0] : null

  return (
    <div className="relative h-full w-full overflow-hidden">
      <svg
        aria-hidden
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <g fill="none" stroke={DASH_PANEL_TEXT} strokeWidth={1}>
          {/* City limit — the old lake-bed edge, dashed and quiet */}
          <path
            d="M 20,10 L 55,6 L 78,12 L 90,34 L 86,62 L 70,92 L 48,97 L 28,88 L 14,64 L 12,32 Z"
            strokeOpacity={0.22}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
          {/* Periférico — western arc */}
          <path
            d="M 22,16 C 12,36 12,58 20,76 C 25,86 34,93 46,96"
            strokeOpacity={0.35}
            vectorEffect="non-scaling-stroke"
          />
          {/* Circuito Interior — the inner loop */}
          <path
            d="M 36,32 C 52,26 68,30 72,42 C 75,54 66,66 52,68 C 38,70 28,58 29,46 C 29.6,40 31,35 36,32 Z"
            strokeOpacity={0.35}
            vectorEffect="non-scaling-stroke"
          />
          {/* Av. Insurgentes — the long north–south spine */}
          <path
            d="M 50,6 C 49,22 47,38 46.5,50 C 46,62 49,76 54,96"
            strokeOpacity={0.7}
            vectorEffect="non-scaling-stroke"
          />
          {/* Paseo de la Reforma — Chapultepec → Centro diagonal */}
          <path
            d="M 30,53 L 40,48 L 52,42 L 62,36 L 67,30"
            strokeOpacity={0.7}
            vectorEffect="non-scaling-stroke"
          />
          {/* Eje Central Lázaro Cárdenas */}
          <path
            d="M 58,8 L 58.5,40 L 59,72"
            strokeOpacity={0.5}
            vectorEffect="non-scaling-stroke"
          />
          {/* Viaducto — east–west */}
          <path
            d="M 16,62 L 45,60.5 L 84,58"
            strokeOpacity={0.5}
            vectorEffect="non-scaling-stroke"
          />
          {/* Bosque de Chapultepec */}
          <path
            d="M 27,45 C 31,42 37,43 39,47 C 41,51 38,55 33,55 C 28,55 25,49 27,45 Z"
            fill={DASH_PANEL_TEXT}
            fillOpacity={0.1}
            strokeOpacity={0.45}
            vectorEffect="non-scaling-stroke"
          />
          {/* Zócalo */}
          <rect
            x={61}
            y={37}
            width={3}
            height={2.4}
            strokeOpacity={0.7}
            vectorEffect="non-scaling-stroke"
          />
          {/* AICM — airport field + runways */}
          <rect
            x={74}
            y={29}
            width={8}
            height={6}
            strokeOpacity={0.35}
            strokeDasharray="2 2"
            vectorEffect="non-scaling-stroke"
          />
          <line x1={75} y1={34} x2={81} y2={30} strokeOpacity={0.5} vectorEffect="non-scaling-stroke" />
          <line x1={74.5} y1={32.5} x2={80.5} y2={28.5} strokeOpacity={0.5} vectorEffect="non-scaling-stroke" />
          {/* Xochimilco canals — south-east hatches */}
          <line x1={60} y1={91} x2={66} y2={89} strokeOpacity={0.4} vectorEffect="non-scaling-stroke" />
          <line x1={63} y1={94} x2={69} y2={92} strokeOpacity={0.4} vectorEffect="non-scaling-stroke" />
          <line x1={67} y1={90} x2={72} y2={88} strokeOpacity={0.4} vectorEffect="non-scaling-stroke" />

          {/* Reference neighborhood marks (venueGeo anchors) */}
          <AnchorMark x={62} y={38} />
          <AnchorMark x={47} y={54} />
          <AnchorMark x={41} y={56} />
          <AnchorMark x={53} y={87} />

          {/* N=1 reticle — hairline crosshair through the lone signal */}
          {single && (
            <g strokeOpacity={0.6} strokeDasharray="2 2">
              <line x1={0} y1={single.y} x2={100} y2={single.y} vectorEffect="non-scaling-stroke" />
              <line x1={single.x} y1={0} x2={single.x} y2={100} vectorEffect="non-scaling-stroke" />
            </g>
          )}
        </g>
        {/* Acid ring around the reticled signal (acid is legal on the panel) */}
        {single && (
          <circle
            cx={single.x}
            cy={single.y}
            r={4}
            fill="none"
            stroke={DASH_ACID}
            strokeOpacity={0.9}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {/* Compass — the one fixed caption of the drawing itself */}
      <span
        aria-hidden
        className="pointer-events-none absolute right-2 top-2 font-mono text-d11 font-bold tracking-widest text-panel-text"
      >
        N↑
      </span>

      {/* Dot layer — HTML so labels keep computed sizes and hit targets.
          Touch safety is by redundancy (§3.7): the adjacent list always
          carries the same payload, so small dots are a bonus, not the door. */}
      {dots.map((dot) => (
        <button
          key={dot.slug}
          type="button"
          onClick={() => onSelect(dot.slug)}
          title={`${dot.title} — ${dot.venueLabel} · ${dot.dateLabel}`}
          aria-label={`Abrir ${dot.title} en ${dot.venueLabel}, ${dot.dateLabel}`}
          data-cue="tick"
          style={{ left: `${dot.x}%`, top: `${dot.y}%` }}
          className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 p-2 ${PANEL_FOCUS_RING}`}
        >
          <span
            aria-hidden
            className={`block h-3 w-3 rounded-full ${
              dot.saved
                ? 'border border-ink bg-acid'
                : 'border border-panel-text bg-transparent'
            }`}
          />
        </button>
      ))}

      {/* Venue captions — only while few enough to read as a composition */}
      {dots.length <= 4 &&
        dots.map((dot) => (
          <span
            key={`label:${dot.slug}`}
            style={{
              left: `${clampPct(dot.x, 12, 88)}%`,
              top: `${clampPct(dot.y, 4, 88)}%`,
            }}
            className="pointer-events-none absolute -translate-x-1/2 translate-y-3 whitespace-nowrap text-center font-mono text-d11 font-bold uppercase tracking-widest text-panel-text"
          >
            {dot.venueLabel}
            {single && (
              <span className="block font-normal tracking-widest">
                1 SEÑAL ACTIVA
              </span>
            )}
          </span>
        ))}
    </div>
  )
}
