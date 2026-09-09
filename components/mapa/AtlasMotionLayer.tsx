'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { HEX_R } from '@/lib/mapa/layout'
import { cameraWindow, type MapWindow, type MapCamera } from '@/lib/mapa/viewport'

export interface AtlasMotionHandle {
  begin: (plane: HTMLElement, camera: MapCamera, w: number, h: number) => void
  move: (camera: MapCamera) => void
  refresh: (plane: HTMLElement, camera: MapCamera, w: number, h: number) => void
  end: () => void
  coversViewport: (camera: MapCamera, w: number, h: number) => boolean
}

/** During direct manipulation, composite one bounded bitmap instead of
 * hundreds of independently clipped HTML images and SVG rims. The real DOM
 * remains mounted, including focus targets, and returns when motion settles.
 * This canvas is display-only: cross-origin flyers may taint it; never export
 * or read its pixels. Use the already loaded images, with no extra fetches. */
export const AtlasMotionLayer = forwardRef<AtlasMotionHandle>(function AtlasMotionLayer(_, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const anchorRef = useRef<MapCamera | null>(null)
  const activeRef = useRef(false)
  const coverageRef = useRef<MapWindow | null>(null)
  const latestCameraRef = useRef<MapCamera | null>(null)
  const jobRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    jobRef.current++
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  useImperativeHandle(ref, () => {
    function move(camera: MapCamera) {
      latestCameraRef.current = { ...camera }
      const anchor = anchorRef.current
      if (anchor && canvasRef.current) {
        canvasRef.current.style.transform = `translate3d(${(anchor.cx - camera.cx) * camera.z}px, ${(anchor.cy - camera.cy) * camera.z}px, 0) scale(${camera.z / anchor.z})`
      }
    }
    function capture(plane: HTMLElement, camera: MapCamera, w: number, h: number) {
      const canvas = canvasRef.current
      if (!canvas) return
      const job = ++jobRef.current
      if (timerRef.current) clearTimeout(timerRef.current)
      // Build into a separate bounded surface in short batches. Preparing
      // hundreds of clipped flyers synchronously would stall pointer-down.
      const staging = document.createElement('canvas')
      staging.width = Math.ceil(w * 1.6)
      staging.height = Math.ceil(h * 1.6)
      const context = staging.getContext('2d')
      if (!context) return
      context.imageSmoothingQuality = 'low'
      // Affinity perimeters are large SVG paths. Include them in the same
      // bounded raster so the browser need not tessellate them while panning.
      context.save()
      context.translate(w * 0.8 - camera.cx * camera.z, h * 0.8 - camera.cy * camera.z)
      context.scale(camera.z, camera.z)
      const tile = document.createElement('canvas')
      const hexH = Math.sqrt(3) * HEX_R
      tile.width = HEX_R * 3
      tile.height = Math.ceil(hexH)
      const grid = tile.getContext('2d')
      if (grid) {
        grid.strokeStyle = 'rgba(17,17,17,0.12)'
        grid.lineWidth = 1
        grid.setLineDash([3, 8])
        grid.stroke(new Path2D(`M ${HEX_R} 0 L ${HEX_R / 2} ${hexH / 2} L ${HEX_R} ${hexH} M ${HEX_R / 2} ${hexH / 2} H ${-HEX_R / 2} M ${HEX_R * 2} 0 L ${HEX_R * 2.5} ${hexH / 2} L ${HEX_R * 2} ${hexH} M ${HEX_R * 2.5} ${hexH / 2} H ${HEX_R * 3.5} M ${HEX_R} 0 H ${HEX_R * 2} M ${HEX_R} ${hexH} H ${HEX_R * 2}`))
        const pattern = context.createPattern(tile, 'repeat')
        if (pattern) {
          context.fillStyle = pattern
          context.fillRect(camera.cx - w * 0.8 / camera.z, camera.cy - h * 0.8 / camera.z, w * 1.6 / camera.z, h * 1.6 / camera.z)
        }
      }

      for (const path of plane.parentElement?.querySelectorAll<SVGPathElement>('.mapa-backdrop > path') ?? []) {
        const outline = path.getAttribute('d')
        if (!outline) continue
        const shape = new Path2D(outline)
        context.fillStyle = path.getAttribute('fill') ?? '#111111'
        context.globalAlpha = Number(path.getAttribute('fill-opacity') ?? 1)
        context.fill(shape)
        context.strokeStyle = path.getAttribute('stroke') ?? '#111111'
        context.globalAlpha = 1
        context.lineWidth = Number(path.getAttribute('stroke-width') ?? 1)
        context.setLineDash((path.getAttribute('stroke-dasharray') ?? '').split(/[ ,]+/).filter(Boolean).map(Number))
        context.stroke(shape)
      }
      context.restore()

      // Read all geometry before any visibility/transform writes.
      const pieces = [...plane.querySelectorAll<HTMLElement>('[data-item-id], [data-mapa-node]')].map(element => ({
        element,
        rect: element.getBoundingClientRect(),
      }))
      let index = 0
      function drawBatch() {
        if (job !== jobRef.current || !context) return
        const started = performance.now()
        while (index < pieces.length) {
          const { element, rect } = pieces[index++]
          if (element.getAttribute('aria-hidden') === 'true' || element.classList.contains('mapa-cell--off') ||
              rect.right < -w * 0.3 || rect.left > w * 1.3 || rect.bottom < -h * 0.3 || rect.top > h * 1.3) continue
          const path = element.querySelector<SVGPathElement>('svg path')
          const outline = path?.getAttribute('d')
          if (!outline) continue
          const image = element.querySelector<HTMLImageElement>('img')
          const shape = new Path2D(outline)
          const width = rect.width / camera.z
          const height = rect.height / camera.z
          context.save()
          context.translate(rect.left + w * 0.3, rect.top + h * 0.3)
          context.scale(camera.z, camera.z)
          context.save()
          context.clip(shape)
          context.globalAlpha = element.classList.contains('mapa-cell--dim') ? 0.3 : 1
          context.fillStyle = '#111111'
          context.fillRect(0, 0, width, height)
          if (image?.complete && image.naturalWidth > 0) {
            const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
            const iw = image.naturalWidth * scale
            const ih = image.naturalHeight * scale
            context.drawImage(image, (width - iw) / 2, (height - ih) / 2, iw, ih)
          }
          context.restore()
          context.strokeStyle = path?.getAttribute('stroke') ?? '#111111'
          context.globalAlpha = Number(path?.getAttribute('stroke-opacity') ?? 0.7)
          context.lineWidth = Number(path?.getAttribute('stroke-width') ?? 2)
          context.stroke(shape)
          context.restore()
          if (performance.now() - started > 4) break
        }
        if (index < pieces.length) {
          timerRef.current = setTimeout(drawBatch, 0)
          return
        }
        timerRef.current = null
        if (!canvas) return
        canvas.width = staging.width
        canvas.height = staging.height
        canvas.getContext('2d')?.drawImage(staging, 0, 0)
        anchorRef.current = { ...camera }
        coverageRef.current = cameraWindow(camera, w, h)
        move(latestCameraRef.current ?? camera)
        if (activeRef.current) {
          canvas.classList.remove('invisible')
          plane.parentElement?.classList.add('mapa-panning')
        }
      }
      timerRef.current = setTimeout(drawBatch, 0)
    }
    function coversViewport(camera: MapCamera, w: number, h: number) {
      const coverage = coverageRef.current
      const visible = cameraWindow(camera, w, h, 0)
      return !!(activeRef.current && coverage && visible.x >= coverage.x && visible.y >= coverage.y &&
        visible.x + visible.width <= coverage.x + coverage.width &&
        visible.y + visible.height <= coverage.y + coverage.height)
    }
    return {
      begin(plane, camera, w, h) {
        activeRef.current = true
        move(camera)
        if (anchorRef.current) {
          canvasRef.current?.classList.remove('invisible')
          plane.parentElement?.classList.add('mapa-panning')
        } else if (!timerRef.current) capture(plane, { ...camera }, w, h)
      },
      refresh(plane, camera, w, h) {
        if (coversViewport(camera, w, h)) return
        capture(plane, { ...camera }, w, h)
      },
      move,
      coversViewport,
      end() {
        activeRef.current = false
        const canvas = canvasRef.current
        canvas?.classList.add('invisible')
        canvas?.parentElement?.classList.remove('mapa-panning')
      },
    }
  }, [])

  return <canvas ref={canvasRef} aria-hidden className="mapa-motion pointer-events-none invisible absolute -left-[30%] -top-[30%] h-[160%] w-[160%] origin-center will-change-transform" />
})
