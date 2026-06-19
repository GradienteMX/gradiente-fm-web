'use client'

import { useEffect, useRef } from 'react'

// ── Re-curation sweep — the mosaic retunes like a live broadcast monitor ──────
//
// When the ranked set changes (filter change OR realtime re-curation — i.e. the
// identity/order of the visible items changes), a transient teletext/scanline
// band sweeps across the WHOLE grid container. The grid visibly "retunes" — a
// broadcast monitor reorganizing its channel — then the overlay removes itself.
//
// This is a pure VISUAL LAYER mounted ABOVE the cards (absolute, inset-0,
// pointer-events-none, high z within the grid). The real card DOM underneath is
// never touched: click-to-open-overlay, focus, text selection, screen-reader,
// the Framer layout="position" reflow and stepped-opacity entrants all keep
// running unobstructed beneath the band. The sweep only paints; it owns no
// interaction and intercepts no events.
//
// IMPLEMENTATION — transient canvas-2D (NO WebGL). Home idle already sits at the
// Safari WebGL context ceiling (CRTShader + VibeFluid). A 2D canvas costs zero
// GL context and gives the same teletext block-mosaic look as SignalTransition.
// The canvas is created on each play, animated for one shot (~500ms), then fully
// torn down (RAF cancelled, node removed). No persistent state, no leak.
//
// Vocabulary mirrors SignalTransition.tsx: CELL_PX teletext block grid, a
// ragged wavefront from a stable per-cell hash (deterministic — NEVER per-frame
// RNG, which would read as a strobe), smootherstep ease, grey "estática" base
// blended with a hint of the active vibe slot color at the wavefront. Here the
// band is a travelling SCANLINE (a moving stripe of block-noise) rather than a
// full mask-and-resolve, because the cards beneath must stay visible and usable
// the entire time — only a thin moving band is ever opaque.
//
// Photosensitivity: a SINGLE moving band, never a full-frame luminance flash.
// Luminance change at any pixel is one slow pass of the band, well under 3Hz.
// reduced-motion: the sweep is skipped entirely (instant, designed static path).

export interface RecurationSweepProps {
  /** Stable token for the current ranked set: visible ids (in order) + filter
   *  signature. The sweep replays whenever this changes (and never on first
   *  mount). Compute upstream so this component owns no ranking knowledge. */
  signature: string
  /** Active vibe slot color (#rrggbb) tinting the band — a hint of the live
   *  vibe, from vibeToColor(vibeMid(range)). Carries true filter state. */
  vibeColor: string
  /** Sweep travel direction. 'down' = top→bottom (default). 'up' lets a caller
   *  bias the origin (e.g. a filter that narrows). Reduced-motion ignores it. */
  direction?: 'down' | 'up'
}

// ── Tunables ────────────────────────────────────────────────────────────────
const CELL_PX = 16 // teletext block edge (px) — coarse signal grid, matches lineage
const DUR = 500 // sweep duration (ms) — within the 450-550 brief window
// Band height as a fraction of grid height. The opaque-ish scanline stripe that
// travels across; only cells inside it are painted, so the grid stays visible.
const BAND = 0.22
// Soft feather at each band edge (fraction of BAND) so the stripe fades in/out
// rather than presenting a hard luminance edge.
const FEATHER = 0.45
// Peak alpha of a fully-lit noise block at band center. Kept below 1 so even at
// the band's core the cards are dimmed/retuning, never fully occluded.
const PEAK_ALPHA = 0.82

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

// Deterministic per-cell hash → 0..1. Stable across frames so a cell's
// brightness step is a fixed static-grid texture, not animated RNG churn (which
// would strobe). Identity is the cell index — same approach as SignalTransition.
function cellHash(ix: number, iy: number): number {
  const s = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453
  return s - Math.floor(s)
}

export function RecurationSweep({
  signature,
  vibeColor,
  direction = 'down',
}: RecurationSweepProps) {
  // Host element: the sweep mounts its transient canvas as a child of this, so
  // the canvas is positioned/clipped to the grid container the host sits in.
  const hostRef = useRef<HTMLDivElement | null>(null)
  // Skip the very first signature (initial mount): only subsequent changes —
  // genuine re-curations / filter changes — should fire the sweep.
  const lastSig = useRef<string | null>(null)
  // Latest vibe color / direction without restarting the effect on their change
  // alone (the effect keys on signature; color is read at play time).
  const vibeColorRef = useRef(vibeColor)
  vibeColorRef.current = vibeColor
  const directionRef = useRef(direction)
  directionRef.current = direction

  useEffect(() => {
    // First signature seen → record it, play nothing. Subsequent distinct
    // signatures → play one sweep.
    if (lastSig.current === null) {
      lastSig.current = signature
      return
    }
    if (lastSig.current === signature) return
    lastSig.current = signature

    const host = hostRef.current
    if (!host) return

    // The host is a 0-box marker inside the grid; its offsetParent is the grid
    // container (position:relative). We size the canvas to that container so the
    // band covers the whole mosaic. Cards live outside any overlay transform, so
    // offsetWidth/Height of the parent is correct here.
    const container = host.offsetParent as HTMLElement | null
    if (!container) return

    // reduced-motion → no sweep at all (designed static / instant path).
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const cssW = Math.max(1, container.offsetWidth)
    const cssH = Math.max(1, container.offsetHeight)
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(cssW * dpr)
    canvas.height = Math.floor(cssH * dpr)
    canvas.setAttribute('aria-hidden', 'true')
    canvas.style.position = 'absolute'
    canvas.style.inset = '0'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.pointerEvents = 'none' // cards beneath stay fully interactive
    canvas.style.zIndex = '5' // above cards within the grid, below page chrome
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    host.appendChild(canvas)

    const cols = Math.ceil(cssW / CELL_PX)
    const rows = Math.ceil(cssH / CELL_PX)
    const cw = (cssW / cols) * dpr
    const ch = (cssH / rows) * dpr

    const [vr, vg, vb] = hexToRgb(vibeColorRef.current)
    // Grey "estática" base — dim signal grid, matches SignalTransition's GREY.
    const GREY: [number, number, number] = [0x4a, 0x47, 0x44]
    const dir = directionRef.current

    const start = performance.now()
    let raf = 0
    let running = true

    const finish = () => {
      running = false
      cancelAnimationFrame(raf)
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas)
    }

    const draw = (now: number) => {
      if (!running) return
      const elapsed = now - start
      const rawP = Math.min(1, elapsed / DUR)
      // smootherstep — the retune settles rather than stops dead.
      const p = rawP * rawP * rawP * (rawP * (rawP * 6 - 15) + 10)

      // Band center travels across the full height plus one band-width of
      // padding at each end, so it enters from fully offscreen and exits fully
      // offscreen (no band clipped at the edges on the first/last frame).
      const travel = -BAND + p * (1 + 2 * BAND)
      const centerY = dir === 'up' ? 1 - travel : travel

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (let iy = 0; iy < rows; iy++) {
        // Cell center in normalized grid height [0,1].
        const ny = (iy + 0.5) / rows
        const d = Math.abs(ny - centerY) / (BAND * 0.5)
        if (d > 1) continue // outside the band → untouched (cards fully visible)

        // Triangular band profile with a feathered core: alpha peaks at the
        // band center and feathers to 0 at the edges → a soft travelling stripe,
        // never a hard full-width luminance edge.
        const edge = 1 - d
        const profile = edge < FEATHER ? edge / FEATHER : 1
        const rowAlpha = profile * PEAK_ALPHA

        for (let ix = 0; ix < cols; ix++) {
          const h = cellHash(ix, iy)
          // Stable per-cell brightness step (fixed static texture, not RNG).
          const twinkle = 0.7 + h * 0.3
          const alpha = rowAlpha * twinkle
          if (alpha <= 0.01) continue

          // Color: grey estática base, warmed toward the active vibe at the
          // band core (signal "tuning into" the live vibe). Mix peaks at center.
          const mix = profile * 0.5
          const r = Math.round(GREY[0] * (1 - mix) + vr * mix)
          const g = Math.round(GREY[1] * (1 - mix) + vg * mix)
          const b = Math.round(GREY[2] * (1 - mix) + vb * mix)

          ctx.globalAlpha = alpha
          ctx.fillStyle = `rgb(${r},${g},${b})`
          // Inset each block a hair → discrete teletext cells with thin gaps
          // (the character-grid lineage), not a flat stripe.
          const gap = Math.max(0.5, cw * 0.06)
          ctx.fillRect(ix * cw + gap, iy * ch + gap, cw - gap * 2, ch - gap * 2)
        }
      }
      ctx.globalAlpha = 1

      if (elapsed >= DUR) {
        finish()
        return
      }
      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas)
    }
  }, [signature])

  // A zero-box marker. Must stay laid out (NOT display:none — that nulls
  // offsetParent/offsetWidth) so its offsetParent resolves to the nearest
  // positioned ancestor: the position:relative grid container the caller renders
  // it inside. The transient canvas attaches here and covers that container.
  // Zero-size + nothing painted → invisible and inert.
  return (
    <div
      ref={hostRef}
      aria-hidden
      style={{
        position: 'absolute',
        width: 0,
        height: 0,
        overflow: 'visible',
        pointerEvents: 'none',
      }}
    />
  )
}
