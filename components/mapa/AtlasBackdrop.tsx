'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { HEX_R } from '@/lib/mapa/layout'

interface AtlasBackdropProps {
  bounds: { x: number; y: number; width: number; height: number }
  focus: { key: string; perimeter: string } | null
  continents: { itemIds: string[]; perimeter: string }[]
}

/** Printed guides and ink fields share the terrain's coordinate space.
 * Perimeters come directly from the existing engine; this paints no new cells. */
export function AtlasBackdrop({ bounds, focus, continents }: AtlasBackdropProps) {
  const reduced = useReducedMotion()
  const h = Math.sqrt(3) * HEX_R
  return (
    <svg aria-hidden width="1" height="1" className="pointer-events-none absolute left-0 top-0 overflow-visible">
      <defs>
        <pattern id="mapa-paper-grid" width={HEX_R * 3} height={h} patternUnits="userSpaceOnUse">
          <path d={`M ${HEX_R} 0 L ${HEX_R / 2} ${h / 2} L ${HEX_R} ${h} M ${HEX_R / 2} ${h / 2} H ${-HEX_R / 2} M ${HEX_R * 2} 0 L ${HEX_R * 2.5} ${h / 2} L ${HEX_R * 2} ${h} M ${HEX_R * 2.5} ${h / 2} H ${HEX_R * 3.5} M ${HEX_R} 0 H ${HEX_R * 2} M ${HEX_R} ${h} H ${HEX_R * 2}`} fill="none" stroke="#111111" strokeOpacity="0.12" strokeWidth="1" strokeDasharray="3 8" />
        </pattern>
      </defs>
      <rect x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} fill="url(#mapa-paper-grid)" />
      <AnimatePresence>
        {focus && (
          <motion.path key={focus.key} d={focus.perimeter} fill="#111111" stroke="#111111" strokeWidth="64" strokeLinejoin="miter"
            initial={{ opacity: 0, scale: reduced ? 1 : 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.65 }} />
        )}
      </AnimatePresence>
      {continents.map((c) => (
        <motion.path key={c.itemIds[0]} d={c.perimeter} fill="#111111" fillOpacity="0.06" stroke="#111111" strokeWidth="3" strokeDasharray="8 12"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : 0.7 }} />
      ))}
    </svg>
  )
}
