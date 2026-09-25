'use client'

/**
 * The printed pin — what the case shows where there is no WebGL: the same
 * die (silhouette, border, band, field, sigil) drawn flat in ink, with the
 * enamel as a flat plate of the trophy's colour, pressed into the page the
 * way the GL case is. An earned pin sits in its bed — the paper shaded
 * around it, a contact shadow under it; a locked slot is the pin's outline
 * pressed blind. Turned over, it shows the clutch and the month.
 *
 * The pressing is shading only (SVG filters, in the page's inks), never a
 * ground: inside a bed or a deboss the paper is the page's own paper. The
 * filters live once per case (<PressFilters>), in each pin's own units.
 */

import { TROPHY_SIGIL } from '@/components/credencial/sigils'
import type { TrophyKey } from '@/lib/trophies'
import { FAMILY_BAND, fillOf } from './catalog'
import { grow } from './field'
import { BLANK, svgPath, silhouettes, type Family } from './shapes'
import styles from './Insignias.module.css'

const BORDER = 0.05
const INNER = 0.145
/** The bed's wall, drawn where the GL bed is steepest (units past the footprint). */
const BED = 0.05

function circlePath(r: number, cx = 0, cy = 0): string {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`
}

/** The die's printed insets and pressings per family, traced once. */
const insets = new Map<Family, { band: string; field: string; backRim: string; bed: string; blind: string }>()
function insetsOf(family: Family) {
  let v = insets.get(family)
  if (!v) {
    const sil = silhouettes()[family]
    v = {
      band: sil.rays ? circlePath(0.405 - BORDER) : svgPath(grow(sil.body, -BORDER, 200, 280)),
      field: sil.rays ? circlePath(0.405 - INNER) : svgPath(grow(sil.body, -INNER, 200, 280)),
      backRim: svgPath(grow(sil.outline, -0.032, 200, 280), 1, true),
      // Paper doesn't follow a rayed rim into its notches: that bed is round.
      bed: sil.rays ? circlePath(0.5 + BLANK.bevelS + BED) : svgPath(grow(sil.outline, BLANK.bevelS + BED, 200, 280)),
      blind: svgPath(grow(sil.outline, BLANK.bevelS, 200, 280)),
    }
    insets.set(family, v)
  }
  return v
}

/**
 * An inner shadow on the side away from the key and an inner light on the
 * side toward it: a shape pressed into the page (sRGB, like the GL's).
 */
function Inset({ id, blur, fall, dark, light }: { id: string; blur: number; fall: [number, number]; dark: number; light: number }) {
  return (
    <filter id={id} x="-0.1" y="-0.1" width="1.2" height="1.2" colorInterpolationFilters="sRGB">
      <feGaussianBlur in="SourceAlpha" stdDeviation={blur} result="soft" />
      <feOffset in="soft" dx={fall[0]} dy={fall[1]} result="down" />
      <feComposite in="SourceAlpha" in2="down" operator="out" result="nw" />
      <feFlood style={{ floodColor: 'var(--ins-shade)', floodOpacity: dark }} />
      <feComposite in2="nw" operator="in" result="shade" />
      <feOffset in="soft" dx={-fall[0]} dy={-fall[1]} result="up" />
      <feComposite in="SourceAlpha" in2="up" operator="out" result="se" />
      <feFlood style={{ floodColor: 'var(--ins-lite)', floodOpacity: light }} />
      <feComposite in2="se" operator="in" result="lite" />
      <feMerge>
        <feMergeNode in="shade" />
        <feMergeNode in="lite" />
      </feMerge>
    </filter>
  )
}

/** The case's pressing filters, once per case; `id` prefixes their ids. */
export function PressFilters({ id }: { id: string }) {
  return (
    <svg className={styles.defs} width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <Inset id={`${id}-bed`} blur={0.03} fall={[0.024, 0.032]} dark={0.5} light={0.95} />
        <Inset id={`${id}-blind`} blur={0.016} fall={[0.014, 0.019]} dark={0.45} light={0.9} />
        {/* Contact and ambient, falling down-right from the key. */}
        <filter id={`${id}-pin`} x="-0.2" y="-0.2" width="1.4" height="1.4" colorInterpolationFilters="sRGB">
          <feDropShadow dx={0.018} dy={0.024} stdDeviation={0.012} style={{ floodColor: 'var(--ins-shade)', floodOpacity: 0.5 }} />
          <feDropShadow dx={0.03} dy={0.04} stdDeviation={0.03} style={{ floodColor: 'var(--ins-shade)', floodOpacity: 0.16 }} />
        </filter>
      </defs>
    </svg>
  )
}

export function PinPlate({
  trophy,
  family,
  color,
  earned,
  back = false,
  month,
  press,
}: {
  trophy: TrophyKey
  family: Family
  color: string
  earned: boolean
  back?: boolean
  month?: string | null
  /** The case's <PressFilters> id. */
  press: string
}) {
  const sil = silhouettes()[family]
  const outline = svgPath(sil.outline, 1, back)
  const ins = insetsOf(family)
  const common = {
    viewBox: '-0.53 -0.53 1.06 1.06',
    width: '100%',
    height: '100%',
    overflow: 'visible',
    'aria-hidden': true as const,
    focusable: false as const,
  }

  if (!earned)
    return (
      <svg {...common}>
        <path d={ins.blind} fill="#000" filter={`url(#${press}-blind)`} />
      </svg>
    )

  const bed = <path d={ins.bed} fill="#000" filter={`url(#${press}-bed)`} />

  if (back) {
    const [cx, cy] = [-sil.center[0], -sil.center[1]]
    return (
      <svg {...common}>
        {bed}
        <g filter={`url(#${press}-pin)`}>
          <path d={outline} fill="var(--paper-3)" stroke="currentColor" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
          <path d={ins.backRim} fill="none" stroke="currentColor" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
          {/* the butterfly clutch around the post */}
          <ellipse cx={cx - 0.068} cy={cy} rx={0.078} ry={0.1} fill="var(--paper-2)" stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <ellipse cx={cx + 0.068} cy={cy} rx={0.078} ry={0.1} fill="var(--paper-2)" stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <circle cx={cx} cy={cy} r={0.02} fill="currentColor" />
          {month ? (
            <text x={cx} y={cy - 0.2} textAnchor="middle" fontFamily="var(--font-mono)" fontWeight={700} fontSize={0.075} fill="currentColor">
              {month}
            </text>
          ) : null}
        </g>
      </svg>
    )
  }

  const band = FAMILY_BAND[family]
  const fill = fillOf(trophy)
  const pat = `${press}-pp-${trophy}`
  const box = sil.sigil
  const parts = TROPHY_SIGIL[trophy] ?? TROPHY_SIGIL.presence_logged
  return (
    <svg {...common}>
      {fill !== 'esmalte' ? (
        <defs>
          {fill === 'glitter' ? (
            <pattern id={pat} width={0.03} height={0.03} patternUnits="userSpaceOnUse">
              <rect width={0.03} height={0.03} fill={color} />
              <circle cx={0.008} cy={0.009} r={0.0045} fill="var(--paper-2)" />
              <circle cx={0.023} cy={0.022} r={0.003} fill="var(--ink)" />
            </pattern>
          ) : (
            <pattern id={pat} width={0.024} height={0.024} patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
              <rect width={0.024} height={0.024} fill={color} />
              <rect width={0.024} height={0.008} fill="var(--paper-2)" opacity={0.7} />
            </pattern>
          )}
        </defs>
      ) : null}
      {bed}
      <g filter={`url(#${press}-pin)`}>
        <path d={outline} fill="var(--paper-2)" stroke="currentColor" strokeWidth={1.3} vectorEffect="non-scaling-stroke" />
        <path d={ins.band} fill={band} stroke="currentColor" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
        <path d={ins.field} fill={fill === 'esmalte' ? color : `url(#${pat})`} stroke="currentColor" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
        <g
          transform={`translate(${sil.center[0] - box / 2} ${-sil.center[1] - box / 2}) scale(${box / 20})`}
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        >
          {parts.map((p, i) => (p.fill ? <path key={i} d={p.d} fill="currentColor" stroke="none" /> : <path key={i} d={p.d} />))}
        </g>
      </g>
    </svg>
  )
}
