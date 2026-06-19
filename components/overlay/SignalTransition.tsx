'use client'

import { useEffect, useRef } from 'react'

// ── Teletext signal-acquisition transition ───────────────────────────────────
//
// Replaces the old CRT-boot scaleX/scaleY keyframe (globals.css
// `overlay-panel-in`) with a broadcast "tuning in" reveal: the panel content is
// masked by an animated teletext block-mosaic that resolves from coarse signal
// noise into a clear picture in a sweep emanating from the clicked card's
// position. Reads as "SEÑAL ADQUIRIDA".
//
// IMPLEMENTATION — canvas-2D, NO WebGL. Home idle already sits at the Safari
// WebGL context ceiling (VibeFluid backdrop + ParticleField3D), and the overlay
// is the most-traversed surface on the site, so a new persistent GL context
// here is forbidden. A transient 2D canvas gives the same teletext look at zero
// context cost. The canvas is mounted only while the transition runs and is
// fully torn down on completion (RAF cancelled, canvas removed) — there is no
// GL state to dispose.
//
// The mask covers the PANEL ONLY. Sizing uses offsetWidth/offsetHeight on the
// panel element (NOT getBoundingClientRect — the panel transform makes gBCR
// return a near-zero box; documented trap). Block cells are colored from the
// grey ramp with a hint of the item's vibe slot color — not a full rainbow.
//
// Photosensitivity: the mosaic is continuous spatial resolution / one-shot,
// never a full-surface luminance oscillation. reduced-motion gets an instant
// opacity cut (designed static path), no mosaic at all.

export interface SignalTransitionProps {
  /** The panel element the mosaic masks. Sized via offset{Width,Height}. */
  panelRef: React.RefObject<HTMLDivElement | null>
  /** 'in' resolves noise → clear; 'out' de-resolves clear → noise then cuts. */
  phase: 'in' | 'out'
  /** Viewport-space center the sweep emanates from (clicked card center).
   *  Null → sweep from the panel center. */
  originPoint: { x: number; y: number } | null
  /** Vibe slot color (#rrggbb) tinting the live blocks. From vibeToColor. */
  vibeColor: string
  /** Fired once the mask is in place (canvas mounted, or immediately under
   *  reduced-motion) so the shell can flip the panel to opacity:1. The panel
   *  starts at opacity:0 to avoid a 1-frame flash of unmasked content; the
   *  canvas hides the now-opaque panel until cells resolve. The shell owns the
   *  opacity (state-driven) so re-renders don't clobber an imperative style. */
  onReveal: () => void
  /** Called once the transition completes (canvas already torn down). On the
   *  'out' phase the shell uses this to drop the panel and unmount. */
  onDone: () => void
}

// ── Tunables ──────────────────────────────────────────────────────────────
const CELL_PX = 14 // teletext block edge in CSS px — coarse signal grid
const DUR_IN = 520 // resolve duration (ms) — within the 450-550 brief window
const DUR_OUT = 300 // de-resolve + cut (ms) — faster, broadcast cut
// Width of the resolving wavefront as a fraction of the max sweep distance.
// Cells within this band of the front are mid-resolve (noisy/sharpening);
// behind it they're clear, ahead of it they're full coarse noise.
const FRONT_BAND = 0.28

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16,
  )
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Deterministic per-cell hash → 0..1. Stable across frames so a given cell
// resolves on a consistent schedule (no per-frame RNG churn that would read as
// strobing static). Identity is the cell index, not Math.random.
function cellHash(ix: number, iy: number): number {
  const s = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453
  return s - Math.floor(s)
}

export function SignalTransition({
  panelRef,
  phase,
  originPoint,
  vibeColor,
  onReveal,
  onDone,
}: SignalTransitionProps) {
  // Latest callbacks without re-running the effect (would restart the anim).
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const onRevealRef = useRef(onReveal)
  onRevealRef.current = onReveal

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) {
      onRevealRef.current()
      onDoneRef.current()
      return
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // ── Designed static path: instant cut, no mosaic ────────────────────────
    // The shell owns panel opacity (state). On 'in' we reveal immediately; on
    // 'out' the shell drops opacity when onDone → signalOutDone fires.
    if (reduced) {
      onRevealRef.current()
      onDoneRef.current()
      return
    }

    // ── Transient 2D canvas over the panel ──────────────────────────────────
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    // offsetWidth/offsetHeight — layout box, immune to the panel's transform.
    const cssW = Math.max(1, panel.offsetWidth)
    const cssH = Math.max(1, panel.offsetHeight)

    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(cssW * dpr)
    canvas.height = Math.floor(cssH * dpr)
    canvas.setAttribute('aria-hidden', 'true')
    canvas.style.position = 'absolute'
    canvas.style.inset = '0'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '40' // above content (phosphor flash is z-20, rail z-30)
    // Block-mosaic mask is OPAQUE where unresolved → it hides panel content
    // beneath it, then erases (clears) as cells resolve, revealing the panel.
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      // No 2D context (extreme edge) → fall back to an instant reveal/cut.
      onRevealRef.current()
      onDoneRef.current()
      return
    }
    panel.appendChild(canvas)

    // The panel is now opaque-masked by the canvas; tell the shell to flip it
    // to opacity:1 (on 'in' it was 0; on 'out' it's already 1). The canvas
    // hides the content beneath until cells resolve.
    onRevealRef.current()

    const cols = Math.ceil(cssW / CELL_PX)
    const rows = Math.ceil(cssH / CELL_PX)
    const cw = (cssW / cols) * dpr
    const ch = (cssH / rows) * dpr

    // Sweep origin in canvas-local CSS px (panel-local).
    let originX = cssW / 2
    let originY = cssH / 2
    if (originPoint) {
      // originPoint is viewport-space. We can't use getBoundingClientRect to
      // map it into panel-local space (the panel transform makes gBCR return a
      // near-zero box — documented trap). Instead we exploit the fact that the
      // shell's flex layout centers the panel in the viewport: approximate the
      // panel's viewport center as the window center and offset the local
      // origin by the click's displacement from there, clamped into the panel
      // box. The sweep then emanates from roughly where the card was.
      const vpCx = window.innerWidth / 2
      const vpCy = window.innerHeight / 2
      const dx = originPoint.x - vpCx
      const dy = originPoint.y - vpCy
      originX = Math.max(0, Math.min(cssW, cssW / 2 + dx))
      originY = Math.max(0, Math.min(cssH, cssH / 2 + dy))
    }

    // Per-cell normalized distance from origin (0 = at origin, 1 = farthest).
    const maxDist =
      Math.hypot(Math.max(originX, cssW - originX), Math.max(originY, cssH - originY)) ||
      1

    const [vr, vg, vb] = hexToRgb(vibeColor)
    // Grey-ramp base for the noise blocks (estática). Slot 5 #948E85 family,
    // darkened toward the panel base so blocks read as a dim signal grid.
    const GREY: [number, number, number] = [0x4a, 0x47, 0x44]

    const start = performance.now()
    const dur = phase === 'in' ? DUR_IN : DUR_OUT
    let raf = 0
    let running = true

    const finish = () => {
      running = false
      cancelAnimationFrame(raf)
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas)
      onDoneRef.current()
    }

    const draw = (now: number) => {
      if (!running) return
      const elapsed = now - start
      // p: 0→1 progress. For 'in', front sweeps origin→edges (cells clear as
      // the front passes). For 'out' we run the same front but inverted so the
      // picture de-resolves back into blocks, then the canvas cuts.
      const rawP = Math.min(1, elapsed / dur)
      // Ease — smootherstep so the lock feels like it settles.
      const p = rawP * rawP * rawP * (rawP * (rawP * 6 - 15) + 10)

      // Front position in normalized distance, padded so the band fully clears
      // the farthest cells by p=1.
      const front =
        phase === 'in'
          ? p * (1 + FRONT_BAND) // resolving: 0 → 1+band
          : (1 - p) * (1 + FRONT_BAND) // de-resolving: 1+band → 0

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (let iy = 0; iy < rows; iy++) {
        const cyCss = (iy + 0.5) * (cssH / rows)
        for (let ix = 0; ix < cols; ix++) {
          const cxCss = (ix + 0.5) * (cssW / cols)
          const dist = Math.hypot(cxCss - originX, cyCss - originY) / maxDist
          const h = cellHash(ix, iy)
          // Per-cell front offset (hash jitter) → ragged wavefront, not a clean
          // line. Reads as signal speckle resolving rather than a wipe bar.
          const cellFront = front - (dist + (h - 0.5) * 0.18 * FRONT_BAND)

          // coverage: 1 = full opaque noise block, 0 = cleared (panel shows).
          // Cells far ahead of the front: full noise. Within FRONT_BAND of the
          // front: sharpening (partial). Behind: cleared.
          let coverage: number
          if (cellFront <= 0) {
            coverage = 1 // ahead of front → solid noise
          } else if (cellFront >= FRONT_BAND) {
            coverage = 0 // behind front → cleared
          } else {
            coverage = 1 - cellFront / FRONT_BAND // mid-resolve
          }
          if (coverage <= 0) continue

          // Block alpha. Solid-noise cells sit near-opaque (0.86–1.0) so they
          // genuinely mask the content beneath — the picture has to resolve
          // OUT of the noise, not merely tint over a legible panel. The per-cell
          // brightness step comes from the STABLE hash (NOT per-frame RNG), so
          // it reads as a fixed static-grid texture, never an animated strobe.
          // Mid-resolve cells fade alpha→0 (coverage) so content sharpens in.
          const twinkle = 0.86 + h * 0.14
          const alpha = coverage * twinkle

          // Color: grey base for ahead-of-front noise; cells right at the
          // resolving front pick up a hint of the vibe color (the signal
          // "warming in"). Blend amount peaks in the front band.
          const warm =
            cellFront > 0 && cellFront < FRONT_BAND
              ? 1 - Math.abs(cellFront / FRONT_BAND - 0.5) * 2
              : 0
          const mix = warm * 0.55
          const r = Math.round(GREY[0] * (1 - mix) + vr * mix)
          const g = Math.round(GREY[1] * (1 - mix) + vg * mix)
          const b = Math.round(GREY[2] * (1 - mix) + vb * mix)

          ctx.globalAlpha = alpha
          ctx.fillStyle = `rgb(${r},${g},${b})`
          // Inset the block a hair so the grid shows as discrete teletext
          // cells with thin gaps (the character-grid lineage), not a flat fill.
          const gap = Math.max(0.5, cw * 0.06)
          ctx.fillRect(ix * cw + gap, iy * ch + gap, cw - gap * 2, ch - gap * 2)
        }
      }
      ctx.globalAlpha = 1

      if (elapsed >= dur) {
        // On 'out' the shell unmounts the whole panel when onDone fires
        // (signalOutDone → onExited), so no explicit opacity drop is needed —
        // the de-resolve ends on a fully-noised panel and the cut is the
        // unmount itself.
        finish()
        return
      }
      raf = requestAnimationFrame(draw)
    }

    // Prime one frame synchronously so the full-noise mask is painted into the
    // canvas backing store in the SAME commit that flips the panel to opacity:1.
    // Without this the opacity flip could composite one frame before the canvas
    // has drawn → a flash of unmasked content. (On 'out' this first frame is
    // blank, which is the correct fully-revealed start.) draw() schedules its
    // own next RAF, so we don't schedule again here (that would double-loop).
    draw(start)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas)
    }
    // phase/originPoint/vibeColor are captured at mount; the transition is a
    // one-shot per mount. panelRef is stable. onDone is read via ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
