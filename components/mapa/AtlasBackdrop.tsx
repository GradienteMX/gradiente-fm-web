'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { forwardRef, useImperativeHandle, useRef } from 'react'
import { HEX_R } from '@/lib/mapa/layout'
import { cameraWindow, needsMapWindow, type MapCamera, type MapWindow } from '@/lib/mapa/viewport'

interface AtlasBackdropProps {
  focus: { key: string; perimeter: string } | null
  continents: { itemIds: string[]; perimeter: string }[]
}

export interface AtlasBackdropHandle {
  setCamera: (camera: MapCamera, w: number, h: number, settled?: boolean) => void
}

/** A viewport-sized SVG layer, separate from the flyer composite. Updating
 * its camera must never resize an overflowing SVG inside the image plane. */
export const AtlasBackdrop = forwardRef<AtlasBackdropHandle, AtlasBackdropProps>(function AtlasBackdrop({ focus, continents }, ref) {
  const reduced = useReducedMotion()
  const svgRef = useRef<SVGSVGElement>(null)
  const gridRef = useRef<SVGRectElement>(null)
  const anchorRef = useRef<{ camera: MapCamera; bounds: MapWindow; w: number; h: number } | null>(null)
  useImperativeHandle(ref, () => ({
    setCamera(camera, w, h, settled = false) {
      const svg = svgRef.current
      const grid = gridRef.current
      if (!svg || !grid) return
      let anchor = anchorRef.current
      if (!anchor || settled || anchor.w !== w || anchor.h !== h ||
          needsMapWindow(anchor.bounds, camera, w, h)) {
        const bounds = cameraWindow(camera, w, h)
        anchor = { camera: { ...camera }, bounds, w, h }
        anchorRef.current = anchor
        svg.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`)
        grid.setAttribute('x', String(bounds.x))
        grid.setAttribute('y', String(bounds.y))
        grid.setAttribute('width', String(bounds.width))
        grid.setAttribute('height', String(bounds.height))
      }
      // Reuse a bounded raster during movement. Changing viewBox on every
      // frame would rerasterize all dashed guides and affinity perimeters.
      svg.style.transform = `translate3d(${(anchor.camera.cx - camera.cx) * camera.z}px, ${(anchor.camera.cy - camera.cy) * camera.z}px, 0) scale(${camera.z / anchor.camera.z})`
    },
  }), [])
  const h = Math.sqrt(3) * HEX_R
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden [contain:strict]">
      <svg ref={svgRef} preserveAspectRatio="none" className="mapa-backdrop absolute -left-[30%] -top-[30%] h-[160%] w-[160%] origin-center overflow-hidden will-change-transform">
        <defs>
          <pattern id="mapa-paper-grid" width={HEX_R * 3} height={h} patternUnits="userSpaceOnUse">
            <path d={`M ${HEX_R} 0 L ${HEX_R / 2} ${h / 2} L ${HEX_R} ${h} M ${HEX_R / 2} ${h / 2} H ${-HEX_R / 2} M ${HEX_R * 2} 0 L ${HEX_R * 2.5} ${h / 2} L ${HEX_R * 2} ${h} M ${HEX_R * 2.5} ${h / 2} H ${HEX_R * 3.5} M ${HEX_R} 0 H ${HEX_R * 2} M ${HEX_R} ${h} H ${HEX_R * 2}`} fill="none" stroke="#111111" strokeOpacity="0.12" strokeWidth="1" strokeDasharray="3 8" />
          </pattern>
        </defs>
        <rect ref={gridRef} fill="url(#mapa-paper-grid)" />
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
    </div>
  )
})
