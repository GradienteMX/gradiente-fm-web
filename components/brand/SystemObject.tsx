'use client'

// ── SystemObject — the living ASCII brand mark ────────────────────────────────
//
// A slowly rotating icosahedron — the canonical "transmission node" lattice —
// projected to 2D each frame and rasterized into a small MONO CHARACTER GRID
// inside a canvas-2D (NO WebGL: the geometry is projected by hand and sampled to
// a glyph ramp). It sits in the Navigation logo lockup beside GRADIENTE,
// replacing dead chrome with a living, data-true brand object.
//
// TRUE DATA drives it. `signalStrength` is the live count of pieces in the feed
// (Navigation passes useFeedPulse().activeCount). It maps to three honest knobs:
//   • DENSITY  — a busy night lowers the per-glyph brightness threshold, so more
//                cells light and brighter ramp glyphs ( *#@ ) appear; the lattice
//                fills in. A quiet night is sparse ( ·: ).
//   • SPEED    — rotation rate scales with the count (busy = faster spin).
//   • HEAT     — the thermal ramp position climbs the orange family with the
//                count: quiet sits near the GROOVE hinge (dim, cool-grey), busy
//                glows FUEGO→BRASA. The brightest core glyphs go VOLCÁN.
// No raw number is ever shown — the density/heat IS the readout (honest, no fake
// metric). Null (anonymous / pre-load) → a calm dim baseline.
//
// CANVAS-2D hygiene (mirrors SignalTransition + the WebGL components' contract):
// DPR clamp ≤2, ~26fps frame-time gate, visibilitychange pause, FULL teardown on
// unmount (RAF cancel + canvas removed). reduced-motion → a single static
// projected frame, zero RAF. Rotation is continuous (≤3Hz, no full-surface
// luminance flicker) — photosensitivity-safe. Per-cell texture comes from a
// STABLE index hash, never per-frame RNG.

import { useEffect, useRef, useState } from 'react'
import { VIBE_SLOT_COLORS } from '@/lib/utils'

export interface SystemObjectProps {
  /** Live feed piece count (useFeedPulse activeCount). null → calm baseline. */
  signalStrength: number | null
  /** CSS edge of the square mark, px. Default 40 (the nav lockup size). */
  size?: number
  className?: string
}

// ── KNOBS ─────────────────────────────────────────────────────────────────────
const GRID_COLS = 22 // character cells across
const GRID_ROWS = 13 // character cells down (the mark is squarish, slightly tall)
const FPS_CAP = 26 // frame-time gate — a brand mark needs no more
const DPR_CAP = 2
// Brightness → glyph ramp, dim→bright. Space first (empty cell), then the
// teletext-adjacent density ramp. The signal "writes itself" out of blank space.
const GLYPH_RAMP = ' ·:+*#@'
// Edge thickness in grid-cell units: how close a cell must be to a projected
// edge to register signal. A touch over 1 so adjacent diagonals connect.
const EDGE_RADIUS = 1.15
// Rotation speed (rad/sec) at zero signal → at full signal. Busy night = faster.
const SPIN_MIN = 0.22
const SPIN_MAX = 0.62
// Count that reads as a "full" night — saturates the heat/density/speed knobs.
// ~24 live pieces is a busy CDMX weekend; above that the mark is fully lit.
const SIGNAL_FULL = 24
// Thermal-ramp slot range the mark's COLOR rides as signal climbs. Quiet sits at
// the GROOVE hinge (5, signal dying into static); busy rides FUEGO→VOLCÁN (8→10).
const HEAT_SLOT_MIN = 5
const HEAT_SLOT_MAX = 10
// Per-glyph brightness threshold band. A higher floor = sparser mark; signal
// lowers the floor so more cells cross into the ramp.
const THRESH_FLOOR_QUIET = 0.5 // quiet night: only the strongest edges show
const THRESH_FLOOR_BUSY = 0.14 // busy night: faint lattice fills in
// ──────────────────────────────────────────────────────────────────────────────

// Icosahedron: 12 vertices, 30 edges. The "transmission node" lattice. Vertices
// from the golden-ratio construction; normalized to unit-ish radius at draw.
const PHI = (1 + Math.sqrt(5)) / 2
const ICO_VERTS: ReadonlyArray<readonly [number, number, number]> = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
]
// The 30 edges (unique vertex pairs of the icosahedron).
const ICO_EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [0, 5], [0, 7], [0, 10], [0, 11],
  [1, 5], [1, 7], [1, 8], [1, 9],
  [2, 3], [2, 4], [2, 6], [2, 10], [2, 11],
  [3, 4], [3, 6], [3, 8], [3, 9],
  [4, 5], [4, 9], [4, 11],
  [5, 9], [5, 11],
  [6, 7], [6, 8], [6, 10],
  [7, 8], [7, 10],
  [8, 9],
  [10, 11],
]

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Deterministic per-cell hash → 0..1 (matches SignalTransition's cellHash). Used
// for a stable static-grid jitter texture, never per-frame randomness.
function cellHash(ix: number, iy: number): number {
  const s = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453
  return s - Math.floor(s)
}

// Map a vibe slot (may be fractional) into an interpolated #rrggbb on the ramp.
function rampColorAt(slot: number): [number, number, number] {
  const s = Math.max(0, Math.min(10, slot))
  const lo = Math.floor(s)
  const hi = Math.min(10, lo + 1)
  const f = s - lo
  const c0 = hexToRgb(VIBE_SLOT_COLORS[lo])
  const c1 = hexToRgb(VIBE_SLOT_COLORS[hi])
  return [
    Math.round(c0[0] + (c1[0] - c0[0]) * f),
    Math.round(c0[1] + (c1[1] - c0[1]) * f),
    Math.round(c0[2] + (c1[2] - c0[2]) * f),
  ]
}

export function SystemObject({ signalStrength, size = 40, className }: SystemObjectProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  // Latest signal in a ref so the loop reads it without restarting the effect.
  const signalRef = useRef<number | null>(signalStrength)
  signalRef.current = signalStrength
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP)
    canvas.width = Math.floor(size * dpr)
    canvas.height = Math.floor(size * dpr)

    // Cell geometry in device px.
    const cw = canvas.width / GRID_COLS
    const ch = canvas.height / GRID_ROWS
    const fontPx = Math.min(cw, ch) * 1.32 // glyphs slightly overfill their cell
    ctx.font = `${fontPx}px var(--font-space-mono), monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Projection: orthographic-ish with a light perspective divide. The lattice
    // is centered; radius leaves a 1-cell margin so glyphs never clip the box.
    const cxDev = canvas.width / 2
    const cyDev = canvas.height / 2
    const projR = Math.min(canvas.width, canvas.height) * 0.40

    // Per-cell signal buffer (brightness 0..1), reused each frame (no per-frame
    // allocation). Index = iy * GRID_COLS + ix.
    const field = new Float32Array(GRID_COLS * GRID_ROWS)

    // Project the 12 vertices for a given rotation and rasterize the 30 edges
    // into `field`. depth (z, -1..1 after norm) modulates brightness so the
    // front of the form reads brighter than the back — the lattice has volume.
    const buildField = (angY: number, angX: number) => {
      field.fill(0)
      const cosY = Math.cos(angY)
      const sinY = Math.sin(angY)
      const cosX = Math.cos(angX)
      const sinX = Math.sin(angX)

      // Project verts → grid space (fractional col/row) + depth.
      const px = new Float32Array(12)
      const py = new Float32Array(12)
      const pz = new Float32Array(12)
      for (let i = 0; i < 12; i++) {
        let [x, y, z] = ICO_VERTS[i]
        // normalize to unit radius (ico verts have |v| = sqrt(1+phi^2))
        const inv = 1 / Math.sqrt(1 + PHI * PHI)
        x *= inv; y *= inv; z *= inv
        // rotate Y then X
        const x1 = x * cosY + z * sinY
        const z1 = -x * sinY + z * cosY
        const y2 = y * cosX - z1 * sinX
        const z2 = y * sinX + z1 * cosX
        // light perspective: nearer (z2>0) points spread slightly
        const persp = 1 + z2 * 0.18
        const sx = cxDev + x1 * projR * persp
        const sy = cyDev + y2 * projR * persp
        // → fractional grid cell
        px[i] = sx / cw - 0.5
        py[i] = sy / ch - 0.5
        pz[i] = z2 // -1..1 depth
      }

      // Rasterize each edge as a line of signal samples in grid space. The
      // number of samples is proportional to the edge's grid length so density
      // is even regardless of orientation.
      for (let e = 0; e < ICO_EDGES.length; e++) {
        const [a, b] = ICO_EDGES[e]
        const ax = px[a], ay = py[a], az = pz[a]
        const bx = px[b], by = py[b], bz = pz[b]
        const dx = bx - ax
        const dy = by - ay
        const len = Math.hypot(dx, dy)
        const samples = Math.max(2, Math.ceil(len * 2.2))
        for (let s = 0; s <= samples; s++) {
          const t = s / samples
          const gx = ax + dx * t
          const gy = ay + dy * t
          const gz = az + (bz - az) * t
          // depth → brightness: back of the form dimmer (0.45) front brighter (1)
          const depthLit = 0.45 + (gz * 0.5 + 0.5) * 0.55
          // stamp a small radius around (gx,gy) so the edge reads ~1 cell thick
          const minIx = Math.max(0, Math.floor(gx - EDGE_RADIUS))
          const maxIx = Math.min(GRID_COLS - 1, Math.ceil(gx + EDGE_RADIUS))
          const minIy = Math.max(0, Math.floor(gy - EDGE_RADIUS))
          const maxIy = Math.min(GRID_ROWS - 1, Math.ceil(gy + EDGE_RADIUS))
          for (let iy = minIy; iy <= maxIy; iy++) {
            for (let ix = minIx; ix <= maxIx; ix++) {
              const d = Math.hypot(ix - gx, iy - gy)
              if (d > EDGE_RADIUS) continue
              const falloff = 1 - d / EDGE_RADIUS
              const v = depthLit * falloff
              const k = iy * GRID_COLS + ix
              if (v > field[k]) field[k] = v // keep the brightest contributor
            }
          }
        }
      }
    }

    // Render `field` to glyphs. `signal` 0..1 sets density (threshold floor) +
    // heat (ramp slot). A stable per-cell hash adds fixed texture so the lattice
    // doesn't read as a clean vector — it's a signal sampled into characters.
    const renderField = (signal: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const threshFloor =
        THRESH_FLOOR_QUIET + (THRESH_FLOOR_BUSY - THRESH_FLOOR_QUIET) * signal
      const heatSlot = HEAT_SLOT_MIN + (HEAT_SLOT_MAX - HEAT_SLOT_MIN) * signal

      for (let iy = 0; iy < GRID_ROWS; iy++) {
        for (let ix = 0; ix < GRID_COLS; ix++) {
          const k = iy * GRID_COLS + ix
          let v = field[k]
          if (v <= 0) continue
          // Stable per-cell jitter — fixed texture, NOT per-frame RNG. Biases the
          // ramp pick a hair so the lattice has a hand-rasterized grain.
          const h = cellHash(ix, iy)
          v = v * (0.82 + h * 0.18)
          // Below the (signal-driven) floor → cell stays empty (sparse at rest).
          if (v < threshFloor) continue
          // Normalize the visible band [floor..1] across the glyph ramp.
          const norm = (v - threshFloor) / (1 - threshFloor)
          const gi = Math.min(
            GLYPH_RAMP.length - 1,
            1 + Math.floor(norm * (GLYPH_RAMP.length - 1)),
          )
          const glyph = GLYPH_RAMP[gi]
          if (glyph === ' ') continue
          // Color: brighter cells ride hotter up the ramp (core → VOLCÁN), so a
          // busy mark glows orange at its dense crossings. Capped at slot 10.
          const cellSlot = Math.min(10, heatSlot + norm * 2.2)
          const [r, g, b] = rampColorAt(cellSlot)
          // Alpha tracks brightness so faint edges sit back — depth + glow.
          ctx.globalAlpha = 0.55 + norm * 0.45
          ctx.fillStyle = `rgb(${r},${g},${b})`
          ctx.fillText(glyph, (ix + 0.5) * cw, (iy + 0.5) * ch)
        }
      }
      ctx.globalAlpha = 1
    }

    // signalStrength → normalized 0..1 (null → a low calm baseline of 0.12).
    const normSignal = (): number => {
      const s = signalRef.current
      if (s == null) return 0.12
      return Math.max(0, Math.min(1, s / SIGNAL_FULL))
    }

    // ── reduced-motion: one static settled frame, zero RAF ─────────────────────
    const reducedMq = window.matchMedia('(prefers-reduced-motion: reduce)')

    const targetFrameMs = 1000 / FPS_CAP
    let lastDraw = 0
    let raf = 0
    let running = false
    let angY = 0.6 // a flattering 3/4 starting attitude
    let angX = 0.35

    const drawStatic = () => {
      buildField(angY, angX)
      renderField(normSignal())
    }

    const loop = (now: number) => {
      if (!running) return
      raf = requestAnimationFrame(loop)
      if (now - lastDraw < targetFrameMs) return
      const dt = lastDraw === 0 ? 0 : (now - lastDraw) / 1000
      lastDraw = now
      const sig = normSignal()
      const spin = SPIN_MIN + (SPIN_MAX - SPIN_MIN) * sig
      angY += spin * dt // primary spin about Y
      angX += spin * 0.18 * dt // slight tumble about X so it reads 3D
      buildField(angY, angX)
      renderField(sig)
    }

    const startLoop = () => {
      cancelAnimationFrame(raf)
      if (reducedMq.matches) {
        running = false
        drawStatic()
        return
      }
      running = true
      lastDraw = 0
      raf = requestAnimationFrame(loop)
    }

    const onReduced = () => startLoop()
    reducedMq.addEventListener('change', onReduced)

    const onVisibility = () => {
      if (document.hidden) {
        running = false
        cancelAnimationFrame(raf)
      } else if (!reducedMq.matches && !running) {
        running = true
        lastDraw = 0
        raf = requestAnimationFrame(loop)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    startLoop()

    return () => {
      running = false
      cancelAnimationFrame(raf)
      reducedMq.removeEventListener('change', onReduced)
      document.removeEventListener('visibilitychange', onVisibility)
      // Canvas is owned by React (the JSX element); clear it so an unmount/remount
      // never composites a stale frame for one tick.
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [mounted, size])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{ width: size, height: size, display: 'block' }}
    />
  )
}
