/**
 * STAGE — the WebGL context *behind* the DOM, for GL islands only.
 *
 * «TRAMA» retired the full-screen field: the page is paper (painted by
 * <html>), and this canvas is transparent. What remains are *windows*: DOM
 * elements whose rect becomes a scissored viewport with its own scene
 * (the map, the credencial, a rueda…). DOM above a window is left
 * transparent so the GL shows through; text and controls stay real DOM.
 *
 * The loop only runs while a window is registered; with none, nothing
 * renders at all. Temperature state (band, audio, intensity, dim) is still
 * tracked here because windows read it.
 *
 * Printing gestures (reveals, bursts) live in components/trama — the canvas
 * *above* the DOM. `flare()` forwards there.
 */

import * as THREE from 'three'
import { chispa } from '@/components/trama/api'

export interface WindowRect {
  x: number
  y: number
  width: number
  height: number
}

export interface StageWindow {
  el: HTMLElement
  /** Called every frame the window is visible; draw into the given viewport. */
  render: (ctx: WindowRenderContext) => void
  /** Lower draws first. */
  order?: number
  /** Resize hook (CSS pixels). */
  resize?: (w: number, h: number) => void
  /** Draw even when the element is off-screen (rare). */
  always?: boolean
  /**
   * Optional: true when the window's picture is at rest. When every window
   * is idle, nothing moved on screen and the temperature is settled, the
   * engine skips the GPU work (the canvas keeps its last frame).
   */
  idle?: () => boolean
}

export interface WindowRenderContext {
  renderer: THREE.WebGLRenderer
  time: number
  dt: number
  rect: WindowRect
  dpr: number
  state: StageState
}

export interface StageState {
  /** Target band 0..10 (the Horizonte). */
  band: [number, number]
  /** Smoothed band — temperature has inertia. */
  bandSmooth: [number, number]
  audio: { low: number; mid: number; high: number; level: number }
  pointer: { x: number; y: number; heat: number }
  intensity: number
  intensityTarget: number
  dim: number
  dimTarget: number
  reducedMotion: boolean
}

class StageEngine {
  renderer: THREE.WebGLRenderer | null = null
  canvas: HTMLCanvasElement | null = null
  private raf = 0
  private running = false
  private last = 0
  private t0 = performance.now()
  private windows = new Set<StageWindow>()
  private width = 1
  private height = 1
  private dpr = 1
  private listeners: Array<() => void> = []
  private cleared = true
  private needsFrame = true
  private lastRects = ''
  /** The last rendered frame already showed every window at rest. */
  private restDrawn = false

  state: StageState = {
    band: [0, 10],
    bandSmooth: [0, 10],
    audio: { low: 0, mid: 0, high: 0, level: 0 },
    pointer: { x: 0.5, y: 0.5, heat: 0 },
    intensity: 1,
    intensityTarget: 1,
    dim: 0,
    dimTarget: 0,
    reducedMotion: false,
  }

  mount(canvas: HTMLCanvasElement) {
    if (this.renderer) return
    this.canvas = canvas
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        premultipliedAlpha: true,
        // Windows render on demand: the last frame must survive recomposites
        // (screenshots, printing, a context repaint) while nothing redraws.
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      })
    } catch {
      canvas.dataset.failed = '1'
      return
    }
    renderer.setClearColor(0x000000, 0)
    renderer.autoClear = false
    renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer = renderer

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    this.state.reducedMotion = mq.matches
    const onMq = () => {
      this.state.reducedMotion = mq.matches
      this.invalidate()
    }
    mq.addEventListener('change', onMq)
    this.listeners.push(() => mq.removeEventListener('change', onMq))

    const onResize = () => this.resize()
    window.addEventListener('resize', onResize)
    this.listeners.push(() => window.removeEventListener('resize', onResize))

    const onPointer = (e: PointerEvent) => {
      this.state.pointer.x = e.clientX / window.innerWidth
      this.state.pointer.y = 1 - e.clientY / window.innerHeight
      this.state.pointer.heat = Math.min(1, this.state.pointer.heat + 0.08)
    }
    window.addEventListener('pointermove', onPointer, { passive: true })
    this.listeners.push(() => window.removeEventListener('pointermove', onPointer))

    const onVis = () => {
      if (document.hidden) this.stop()
      else this.invalidate()
    }
    document.addEventListener('visibilitychange', onVis)
    this.listeners.push(() => document.removeEventListener('visibilitychange', onVis))

    this.resize()
  }

  unmount() {
    this.stop()
    this.listeners.forEach((off) => off())
    this.listeners = []
    this.renderer?.dispose()
    this.renderer = null
    this.canvas = null
  }

  resize() {
    if (!this.renderer) return
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.renderer.setPixelRatio(this.dpr)
    this.renderer.setSize(this.width, this.height, false)
    this.windows.forEach((w) => {
      const r = w.el.getBoundingClientRect()
      w.resize?.(r.width, r.height)
    })
    this.invalidate()
  }

  /** Wake the loop (it sleeps whenever there is nothing to draw). */
  invalidate() {
    this.needsFrame = true
    if (this.running || !this.renderer || document.hidden) return
    this.running = true
    this.last = performance.now()
    const loop = (now: number) => {
      if (!this.running) return
      const keep = this.frame(now)
      if (!keep) {
        this.running = false
        return
      }
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  /** Kept for API compatibility: the loop starts on demand. */
  start() {
    this.invalidate()
  }

  stop() {
    this.running = false
    cancelAnimationFrame(this.raf)
  }

  // ── state inputs ─────────────────────────────────────────────────────────

  setBand(min: number, max: number) {
    this.state.band = [min, max]
    if (this.state.reducedMotion || this.windows.size === 0) this.state.bandSmooth = [min, max]
    this.invalidate()
  }

  setAudio(low: number, mid: number, high: number, level: number) {
    const a = this.state.audio
    // Envelope followers: fast-ish attack, slow release, never faster than ~3 Hz swings.
    a.low = low > a.low ? a.low + (low - a.low) * 0.35 : a.low + (low - a.low) * 0.06
    a.mid = mid > a.mid ? a.mid + (mid - a.mid) * 0.25 : a.mid + (mid - a.mid) * 0.05
    a.high = high > a.high ? a.high + (high - a.high) * 0.25 : a.high + (high - a.high) * 0.08
    a.level = level
  }

  setIntensity(v: number) {
    this.state.intensityTarget = v
    if (this.windows.size === 0) this.state.intensity = v
    this.invalidate()
  }

  setDim(v: number) {
    this.state.dimTarget = v
    if (this.windows.size === 0) this.state.dim = v
    this.invalidate()
  }

  /** A commit landed at viewport coordinates (CSS px): a small printed burst. */
  flare(clientX: number, clientY: number, energy: number) {
    chispa(clientX, clientY, energy)
  }

  addWindow(w: StageWindow) {
    this.windows.add(w)
    const r = w.el.getBoundingClientRect()
    w.resize?.(r.width, r.height)
    this.invalidate()
    return () => {
      this.windows.delete(w)
      this.invalidate()
    }
  }

  // ── frame ────────────────────────────────────────────────────────────────

  /** Returns whether the loop should keep running. */
  private frame(now: number): boolean {
    const renderer = this.renderer
    if (!renderer) return false
    const dt = Math.min(0.1, (now - this.last) / 1000)
    this.last = now
    const s = this.state
    const still = s.reducedMotion

    // Temperature inertia: the world heats and cools, it doesn't jump.
    const k = still ? 1 : 1 - Math.exp(-dt / 0.45)
    s.bandSmooth[0] += (s.band[0] - s.bandSmooth[0]) * k
    s.bandSmooth[1] += (s.band[1] - s.bandSmooth[1]) * k
    const ki = still ? 1 : 1 - Math.exp(-dt / 0.35)
    s.intensity += (s.intensityTarget - s.intensity) * ki
    s.dim += (s.dimTarget - s.dim) * ki
    s.pointer.heat *= Math.exp(-dt / 0.9)

    if (this.windows.size === 0) {
      if (!this.cleared) {
        renderer.setScissorTest(false)
        renderer.setViewport(0, 0, this.width, this.height)
        renderer.clear(true, true, true)
        this.cleared = true
      }
      return false
    }

    const list = [...this.windows].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const rects = list.map((w) => (w.el.isConnected ? w.el.getBoundingClientRect() : null))
    // Rest: every window idle, nothing moved, temperature settled → keep the
    // last frame and spend nothing (the loop keeps watching for movement).
    const key = rects.map((r) => (r ? `${r.left | 0},${r.top | 0},${r.width | 0},${r.height | 0}` : '-')).join('|')
    const settling =
      Math.abs(s.band[0] - s.bandSmooth[0]) + Math.abs(s.band[1] - s.bandSmooth[1]) > 0.001 ||
      Math.abs(s.intensity - s.intensityTarget) > 0.001 ||
      Math.abs(s.dim - s.dimTarget) > 0.001
    // Only windows that can be seen count: one scrolled off-screen draws
    // nothing (its own settling only advances while it renders), so it must
    // not keep the others rendering. Scrolling it back moves the rects,
    // which wakes a frame, and it resumes from there.
    const shown = (i: number) => {
      const r = rects[i]
      if (!r || r.width < 1 || r.height < 1) return false
      return Boolean(list[i].always) || !(r.bottom < 0 || r.top > this.height || r.right < 0 || r.left > this.width)
    }
    const allIdle = list.every((w, i) => !shown(i) || w.idle?.() === true)
    // A window that just came to rest still needs the frame that shows it
    // at rest; only after that one is drawn does the engine stop spending.
    const resting = allIdle && this.restDrawn && !this.needsFrame && !settling && key === this.lastRects
    this.lastRects = key
    this.needsFrame = false
    if (resting) return true
    this.restDrawn = allIdle && !settling

    renderer.setScissorTest(false)
    renderer.setViewport(0, 0, this.width, this.height)
    renderer.clear(true, true, true)
    this.cleared = false
    const time = (now - this.t0) / 1000

    renderer.setScissorTest(true)
    for (let i = 0; i < list.length; i++) {
      const w = list[i]
      const r = rects[i]
      if (!r || !shown(i)) continue
      const x = r.left
      const y = this.height - r.bottom
      renderer.setViewport(x, y, r.width, r.height)
      renderer.setScissor(x, y, r.width, r.height)
      renderer.clearDepth()
      w.render({
        renderer,
        time,
        dt,
        rect: { x: r.left, y: r.top, width: r.width, height: r.height },
        dpr: this.dpr,
        state: s,
      })
    }
    renderer.setScissorTest(false)
    renderer.setViewport(0, 0, this.width, this.height)
    return true
  }
}

let engine: StageEngine | null = null

export function getStage(): StageEngine {
  if (!engine) engine = new StageEngine()
  return engine
}

export type { StageEngine }
