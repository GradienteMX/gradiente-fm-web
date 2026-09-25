/**
 * TRAMA — one transparent WebGL canvas *above* the DOM for every printing
 * gesture: text and images resolving out of blocks, portada plates crossing,
 * a reading coming off the press, the grid retuning, a commit's small burst.
 *
 * Contract (the pixel-reveal contract):
 *   · real DOM underneath, always; the canvas only paints while a gesture
 *     runs, then hands the element back 1:1 and stops — zero idle cost
 *   · no per-frame randomness: fronts are ragged by a stable per-cell hash
 *   · reduced motion or no WebGL → every gesture resolves instantly
 */

import * as THREE from 'three'
import { tramaFragment, tramaVertex } from './shaders'

export type Dir = 'up' | 'down' | 'left' | 'right' | 'center' | 'origin' | 'random'
export type Mode = 'text' | 'image' | 'cross' | 'mask' | 'sweep' | 'burst'

const MODE_ID: Record<Mode, number> = { text: 0, image: 1, cross: 2, mask: 3, sweep: 4, burst: 5 }
const DIR_ID: Record<Dir, number> = { up: 0, down: 1, left: 2, right: 3, center: 4, origin: 5, random: 6 }

type RGB = [number, number, number]

export interface EffectSpec {
  mode: Mode
  /** Tracked element; its live rect is the effect's rect. */
  el?: HTMLElement | null
  /** Fixed viewport rect when there's no element (bursts). */
  rect?: { x: number; y: number; width: number; height: number }
  texA?: { canvas: HTMLCanvasElement; scale: number } | null
  texB?: { canvas: HTMLCanvasElement; scale: number } | null
  duration: number
  delay?: number
  cell: number
  levels: number
  front: number
  dir: Dir
  /** Origin in viewport px (for dir 'origin'). */
  origin?: { x: number; y: number }
  ink?: RGB
  tint?: RGB
  paper?: RGB
  grey?: boolean
  bits?: boolean
  reverse?: boolean
  /** Called when the element is handed back (or the effect is cancelled). */
  onDone?: () => void
  /** Arbitrary grouping tag; `settle()` can filter on it. */
  tag?: string
}

interface Effect extends EffectSpec {
  id: number
  start: number
  seed: number
  tA: THREE.Texture | null
  tB: THREE.Texture | null
  clip: HTMLElement | null
  size0: { w: number; h: number } | null
  finished: boolean
}

const INK: RGB = [17 / 255, 17 / 255, 17 / 255]
const PAPER: RGB = [237 / 255, 235 / 255, 227 / 255]
const MAX_ACTIVE = 14

function makeTexture(src: { canvas: HTMLCanvasElement } | null | undefined): THREE.Texture | null {
  if (!src) return null
  const t = new THREE.CanvasTexture(src.canvas)
  t.colorSpace = THREE.NoColorSpace
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.magFilter = THREE.LinearFilter
  t.wrapS = THREE.ClampToEdgeWrapping
  t.wrapT = THREE.ClampToEdgeWrapping
  t.needsUpdate = true
  return t
}

/** First ancestor that clips its content (scrollers, overflow-hidden frames). */
function clipAncestor(el: HTMLElement): HTMLElement | null {
  let n = el.parentElement
  while (n && n !== document.body) {
    const cs = getComputedStyle(n)
    if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') return n
    n = n.parentElement
  }
  return null
}

class TramaEngine {
  private renderer: THREE.WebGLRenderer | null = null
  private scene = new THREE.Scene()
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private mat: THREE.ShaderMaterial | null = null
  private effects = new Map<number, Effect>()
  private nextId = 1
  private raf = 0
  private running = false
  private dirty = false
  private width = 1
  private height = 1
  private listeners: Array<() => void> = []
  private blank: THREE.DataTexture | null = null
  reduced = false
  failed = false
  /** Playback speed (development checks slow gestures down to inspect them). */
  speed = 1

  get available() {
    return Boolean(this.renderer) && !this.reduced && !this.failed
  }

  mount(canvas: HTMLCanvasElement) {
    if (this.renderer) return
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        premultipliedAlpha: true,
        powerPreference: 'default',
      })
    } catch {
      this.failed = true
      return
    }
    const r = this.renderer
    r.setClearColor(0x000000, 0)
    r.autoClear = false
    r.outputColorSpace = THREE.SRGBColorSpace

    this.blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, THREE.RGBAFormat)
    this.blank.needsUpdate = true

    this.mat = new THREE.ShaderMaterial({
      vertexShader: tramaVertex,
      fragmentShader: tramaFragment,
      uniforms: {
        uMode: { value: 0 },
        uRes: { value: new THREE.Vector2(1, 1) },
        uP: { value: 0 },
        uCell: { value: 24 },
        uLevels: { value: 3 },
        uFront: { value: 0.8 },
        uDir: { value: 3 },
        uOrigin: { value: new THREE.Vector2() },
        uSeed: { value: 0 },
        uScaleA: { value: 1 },
        uScaleB: { value: 1 },
        uTexA: { value: this.blank },
        uTexB: { value: this.blank },
        uInk: { value: new THREE.Vector3(...INK) },
        uTint: { value: new THREE.Vector3(...INK) },
        uPaper: { value: new THREE.Vector3(...PAPER) },
        uGrey: { value: 0 },
        uBits: { value: 0 },
        uReverse: { value: 0 },
      },
      transparent: true,
      premultipliedAlpha: true,
      depthTest: false,
      depthWrite: false,
    })
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat))

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    this.reduced = mq.matches
    const onMq = () => {
      this.reduced = mq.matches
      if (this.reduced) this.settle()
    }
    mq.addEventListener('change', onMq)
    this.listeners.push(() => mq.removeEventListener('change', onMq))

    const onResize = () => this.resize()
    window.addEventListener('resize', onResize)
    this.listeners.push(() => window.removeEventListener('resize', onResize))

    const onVis = () => {
      // A hidden tab would freeze gestures mid-print; finish them instead.
      if (document.hidden) this.settle()
    }
    document.addEventListener('visibilitychange', onVis)
    this.listeners.push(() => document.removeEventListener('visibilitychange', onVis))

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      this.settle()
      this.failed = true
    })

    this.resize()
  }

  unmount() {
    this.settle()
    this.stop()
    this.listeners.forEach((off) => off())
    this.listeners = []
    this.mat?.dispose()
    this.blank?.dispose()
    this.renderer?.dispose()
    this.renderer = null
  }

  private resize() {
    if (!this.renderer) return
    // The canvas is 100% of the fixed containing block: the viewport minus
    // scrollbars — exactly the space getBoundingClientRect() measures in.
    this.width = document.documentElement.clientWidth || window.innerWidth
    this.height = document.documentElement.clientHeight || window.innerHeight
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setSize(this.width, this.height, false)
    this.dirty = true
    if (this.effects.size) this.start()
  }

  /** Queue a gesture. Resolves when the element is handed back. */
  add(spec: EffectSpec): Promise<void> {
    return new Promise((resolve) => {
      const done = () => {
        spec.onDone?.()
        resolve()
      }
      if (!this.available || this.effects.size >= MAX_ACTIVE || this.underModal(spec.el)) {
        done()
        return
      }
      let size0: Effect['size0'] = null
      if (spec.el) {
        const r = spec.el.getBoundingClientRect()
        size0 = { w: r.width, h: r.height }
      }
      const e: Effect = {
        ...spec,
        onDone: done,
        id: this.nextId++,
        start: performance.now(),
        seed: Math.random() * 1000,
        tA: makeTexture(spec.texA),
        tB: makeTexture(spec.texB),
        clip: spec.el ? clipAncestor(spec.el) : null,
        size0,
        finished: false,
      }
      this.effects.set(e.id, e)
      this.start()
    })
  }

  /**
   * The canvas sits above every layer, so a gesture on the page underneath an
   * open dialog would print over the dialog. Those resolve instantly instead.
   */
  private underModal(el: HTMLElement | null | undefined): boolean {
    if (!el) return false
    const modals = document.querySelectorAll('[role="dialog"][aria-modal="true"]')
    if (!modals.length) return false
    const top = modals[modals.length - 1]
    return !top.contains(el)
  }

  /** Finish gestures now (all, or those matching). The DOM is handed back. */
  settle(match?: (e: EffectSpec) => boolean) {
    for (const e of [...this.effects.values()]) {
      if (match && !match(e)) continue
      this.finish(e)
    }
    this.dirty = true
    if (this.renderer && this.effects.size === 0) this.clear()
  }

  private finish(e: Effect) {
    if (e.finished) return
    e.finished = true
    this.effects.delete(e.id)
    e.tA?.dispose()
    e.tB?.dispose()
    e.onDone?.()
  }

  private start() {
    if (this.running || !this.renderer) return
    this.running = true
    const loop = (now: number) => {
      if (!this.running) return
      this.frame(now)
      if (this.effects.size === 0) {
        this.clear()
        this.running = false
        return
      }
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  private stop() {
    this.running = false
    cancelAnimationFrame(this.raf)
  }

  private clear() {
    const r = this.renderer
    if (!r) return
    r.setScissorTest(false)
    r.setViewport(0, 0, this.width, this.height)
    r.clear(true, false, false)
    this.dirty = false
  }

  private frame(now: number) {
    const r = this.renderer
    const mat = this.mat
    if (!r || !mat) return
    r.setScissorTest(false)
    r.setViewport(0, 0, this.width, this.height)
    r.clear(true, false, false)
    this.dirty = false

    const u = mat.uniforms
    const retire: Effect[] = []
    r.setScissorTest(true)
    for (const e of this.effects.values()) {
      const t = (now - e.start) * this.speed - (e.delay ?? 0)
      const p = Math.max(0, Math.min(1, t / Math.max(1, e.duration)))
      let rect: { x: number; y: number; width: number; height: number }
      if (e.el) {
        if (!e.el.isConnected) {
          retire.push(e)
          continue
        }
        const b = e.el.getBoundingClientRect()
        // A reflow mid-gesture would smear the raster: hand back at once.
        if (e.size0 && (Math.abs(b.width - e.size0.w) > 2 || Math.abs(b.height - e.size0.h) > 2)) {
          retire.push(e)
          continue
        }
        rect = { x: b.left, y: b.top, width: b.width, height: b.height }
      } else if (e.rect) {
        rect = e.rect
      } else {
        retire.push(e)
        continue
      }

      // Visible part of the rect: viewport ∩ clipping ancestor.
      let x0 = Math.max(0, rect.x)
      let y0 = Math.max(0, rect.y)
      let x1 = Math.min(this.width, rect.x + rect.width)
      let y1 = Math.min(this.height, rect.y + rect.height)
      if (e.clip) {
        const c = e.clip.getBoundingClientRect()
        x0 = Math.max(x0, c.left)
        y0 = Math.max(y0, c.top)
        x1 = Math.min(x1, c.right)
        y1 = Math.min(y1, c.bottom)
      }
      if (p >= 1) retire.push(e)
      if (x1 - x0 < 1 || y1 - y0 < 1 || rect.width < 1 || rect.height < 1) continue

      r.setViewport(rect.x, this.height - rect.y - rect.height, rect.width, rect.height)
      r.setScissor(x0, this.height - y1, x1 - x0, y1 - y0)

      u.uMode.value = MODE_ID[e.mode]
      ;(u.uRes.value as THREE.Vector2).set(rect.width, rect.height)
      u.uP.value = p
      u.uCell.value = e.cell
      u.uLevels.value = e.levels
      u.uFront.value = e.front
      u.uDir.value = DIR_ID[e.dir]
      const o = e.origin
      ;(u.uOrigin.value as THREE.Vector2).set(o ? o.x - rect.x : rect.width / 2, o ? o.y - rect.y : rect.height / 2)
      u.uSeed.value = e.seed
      u.uTexA.value = e.tA ?? this.blank
      u.uTexB.value = e.tB ?? this.blank
      u.uScaleA.value = e.texA?.scale ?? 1
      u.uScaleB.value = e.texB?.scale ?? 1
      ;(u.uInk.value as THREE.Vector3).set(...(e.ink ?? INK))
      ;(u.uTint.value as THREE.Vector3).set(...(e.tint ?? e.ink ?? INK))
      ;(u.uPaper.value as THREE.Vector3).set(...(e.paper ?? PAPER))
      u.uGrey.value = e.grey ? 1 : 0
      u.uBits.value = e.bits ? 1 : 0
      u.uReverse.value = e.reverse ? 1 : 0
      r.render(this.scene, this.cam)
    }
    r.setScissorTest(false)
    // Hand back after the final frame is on screen: one frame of overlap
    // (canvas crisp over DOM crisp) instead of one frame of nothing.
    if (retire.length) requestAnimationFrame(() => retire.forEach((e) => this.finish(e)))
  }
}

let engine: TramaEngine | null = null

export function getTrama(): TramaEngine {
  if (!engine) engine = new TramaEngine()
  return engine
}

export type { TramaEngine }
