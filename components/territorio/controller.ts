/**
 * TERRITORIO — the controller. Framework-agnostic: React hands it a model
 * and a view; everything that moves every frame lives here, inside the
 * stage window's render callback (one clock for GL and the DOM captions, so
 * text never swims against the land).
 *
 *   camera   pan · inertia · zoom-at-point · pinch · eased flights
 *   motion   reflow (focus / afinidad / compaction), dithered reveals, lift
 *   GL       tiles → coastlines → lifted offset shadow → lifted tiles
 *   input    drag, wheel, pinch, tap, double tap, hover picking (CPU)
 *
 * The look is printed, not lit: colors are the page's design tokens,
 * probed at runtime (palette.ts), so a palette flip reprints the land.
 *
 * No React state is touched per frame; hooks fire only on real changes
 * (hovered piece, caption set, zoom percentage).
 */

import * as THREE from 'three'
import gsap from 'gsap'
import type { WindowRenderContext } from '@/components/stage/engine'
import { Atlas, artSource } from './atlas'
import { paletteKey, readPalette, type Palette } from './palette'
import { ribbonFragment, ribbonVertex, tileFragment, tileVertex } from './shaders'
import { APOTHEM, R, type Box, type TerrainModel, type ViewTargets } from './model'

export const ZMIN = 0.05
export const ZMAX = 1.8

export interface Cam {
  cx: number
  cy: number
  z: number
}

export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
}

export interface ScreenRect {
  x: number
  y: number
  width: number
  height: number
}

export interface Hooks {
  /** The piece the chip describes (hover, or the keyboard cursor). */
  onChip(key: string | null, keyboard: boolean): void
  onActivate(key: string, rect: ScreenRect): void
  onZoom(z: number): void
  onCaptions(keys: string[]): void
  onInteract?(): void
}

export interface RibbonGroup {
  loops: { x: number; y: number }[][]
  /** Node whose live offset carries the loops (-1: static). */
  rider: number
}

const KIND_CODE = { pieza: 0, mercado: 1, franja: 2 } as const
const MAX_GROUPS = 32
const LIFT_CAP = 72
const HI_MIN_PX = 170

/** Semantic zoom: flat energy blocks below, printed labels above. */
export const farOf = (z: number) => 1 - sstep(0.055, 0.1, z)
/** A slab takes its label once its title reaches ~11 px on screen. */
const CAPTION_Z: Record<number, number> = { 1: 0.62, 3: 0.52, 7: 0.34 }
const captionOf = (z: number, size: number) => {
  const a = CAPTION_Z[size] ?? 0.62
  return sstep(a, a * 1.03, z)
}

const smooth = (dt: number, tau: number) => 1 - Math.exp(-dt / tau)
function clamp(v: number, a: number, b: number) {
  return Math.min(b, Math.max(a, v))
}
function sstep(a: number, b: number, x: number) {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

// ── GL helpers ───────────────────────────────────────────────────────────────

function hexagonGeometry(): THREE.BufferGeometry {
  const pos = [0, 0, 0]
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i
    pos.push(Math.cos(a), Math.sin(a), 0)
  }
  const idx: number[] = []
  for (let i = 0; i < 6; i++) idx.push(0, 1 + i, 1 + ((i + 1) % 6))
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  return g
}

interface CellBuffers {
  geo: THREE.InstancedBufferGeometry
  cap: number
  center: THREE.InstancedBufferAttribute
  local: THREE.InstancedBufferAttribute
  info: THREE.InstancedBufferAttribute
  state: THREE.InstancedBufferAttribute
  state2: THREE.InstancedBufferAttribute
  texLo: THREE.InstancedBufferAttribute
  texHi: THREE.InstancedBufferAttribute
  energy: THREE.InstancedBufferAttribute
}

function makeBuffers(base: THREE.BufferGeometry, cap: number): CellBuffers {
  const geo = new THREE.InstancedBufferGeometry()
  // Own copies: disposing one geometry must never delete another's buffers
  // (a shared attribute would leave a stale vertex array behind).
  geo.setIndex(base.getIndex()!.clone())
  geo.setAttribute('position', base.getAttribute('position').clone())
  const attr = (name: string, size: number) => {
    const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * size), size)
    a.setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute(name, a)
    return a
  }
  const b: CellBuffers = {
    geo,
    cap,
    center: attr('aCenter', 2),
    local: attr('aLocal', 4),
    info: attr('aInfo', 4),
    state: attr('aState', 4),
    state2: attr('aState2', 4),
    texLo: attr('aTexLo', 4),
    texHi: attr('aTexHi', 4),
    energy: attr('aEnergy', 4),
  }
  geo.instanceCount = 0
  return b
}

function fillSpectrum(tex: THREE.DataTexture, stops: readonly (readonly [number, number, number])[]) {
  const N = 256
  const data = tex.image.data as Uint8Array
  for (let i = 0; i < N; i++) {
    const e = (i / (N - 1)) * 10
    const k = Math.min(9, Math.floor(e))
    const f = e - k
    const a = stops[k]
    const b = stops[k + 1]
    data[i * 4] = Math.round((a[0] + (b[0] - a[0]) * f) * 255)
    data[i * 4 + 1] = Math.round((a[1] + (b[1] - a[1]) * f) * 255)
    data[i * 4 + 2] = Math.round((a[2] + (b[2] - a[2]) * f) * 255)
    data[i * 4 + 3] = 255
  }
  tex.needsUpdate = true
}

function spectrumTexture(stops: readonly (readonly [number, number, number])[]): THREE.DataTexture {
  const t = new THREE.DataTexture(new Uint8Array(256 * 4), 256, 1, THREE.RGBAFormat)
  t.colorSpace = THREE.NoColorSpace
  t.magFilter = THREE.LinearFilter
  t.minFilter = THREE.LinearFilter
  fillSpectrum(t, stops)
  return t
}

function ribbonGeometry(groups: RibbonGroup[]): THREE.BufferGeometry | null {
  const pos: number[] = []
  const nrm: number[] = []
  const side: number[] = []
  const arc: number[] = []
  const grp: number[] = []
  const idx: number[] = []
  groups.slice(0, MAX_GROUPS).forEach((g, gi) => {
    for (const loop of g.loops) {
      const n = loop.length
      if (n < 3) continue
      const base = pos.length / 3
      let s = 0
      for (let i = 0; i <= n; i++) {
        const p = loop[i % n]
        const prev = loop[(i - 1 + n) % n]
        const next = loop[(i + 1) % n]
        if (i > 0) s += Math.hypot(p.x - prev.x, p.y - prev.y)
        const l0 = Math.hypot(p.x - prev.x, p.y - prev.y) || 1
        const l1 = Math.hypot(next.x - p.x, next.y - p.y) || 1
        const d0x = (p.x - prev.x) / l0
        const d0y = (p.y - prev.y) / l0
        const d1x = (next.x - p.x) / l1
        const d1y = (next.y - p.y) / l1
        const n0x = -d0y
        const n0y = d0x
        let mx = n0x - d1y
        let my = n0y + d1x
        const ml = Math.hypot(mx, my) || 1
        mx /= ml
        my /= ml
        const len = 1 / Math.max(0.35, mx * n0x + my * n0y)
        for (const sd of [-1, 1]) {
          pos.push(p.x, p.y, 0)
          nrm.push(mx * len, my * len)
          side.push(sd)
          arc.push(s)
          grp.push(gi)
        }
        if (i < n) {
          const a = base + i * 2
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
        }
      }
    }
  })
  if (!idx.length) return null
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('aNrm', new THREE.Float32BufferAttribute(nrm, 2))
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1))
  g.setAttribute('aS', new THREE.Float32BufferAttribute(arc, 1))
  g.setAttribute('aGroup', new THREE.Float32BufferAttribute(grp, 1))
  g.setIndex(idx)
  return g
}

// ── the controller ───────────────────────────────────────────────────────────

interface Ribbon {
  mesh: THREE.Mesh | null
  mat: THREE.ShaderMaterial
  sig: string
  riders: number[]
  alpha: number
  target: number
  start: number
}

interface GLState {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.OrthographicCamera
  base: THREE.BufferGeometry
  main: CellBuffers
  lifted: CellBuffers
  tileMesh: THREE.Mesh
  shadowMesh: THREE.Mesh
  liftMesh: THREE.Mesh
  tileMat: THREE.ShaderMaterial
  shadowMat: THREE.ShaderMaterial
  liftMat: THREE.ShaderMaterial
  uniforms: Record<string, THREE.IUniform>
  spectrum: THREE.DataTexture
  coast: Ribbon
  ring: Ribbon
}

export class TerrainController {
  readonly cam: Cam = { cx: 0, cy: 0, z: 0.2 }
  private view = { w: 1, h: 1 }
  private insets: Insets = { top: 80, right: 24, bottom: 80, left: 24 }
  private bounds: Box = { x: -500, y: -500, width: 1000, height: 1000 }
  private reduced = false
  private clock = 0
  private lastNow = 0
  private reflowEase = gsap.parseEase('power3.inOut')

  // model
  private model: TerrainModel | null = null
  private order = new Uint32Array(0)
  private srcLo: (string | null)[] = []
  private srcHi: (string | null)[] = []
  private nodesByLo = new Map<string, number[]>()
  private nodesByHi = new Map<string, number[]>()
  private capAnchor = new Float32Array(0) // per node: x, y (bbox-relative), w, h, size

  // per-node motion state
  private curX = new Float32Array(0)
  private curY = new Float32Array(0)
  private fromX = new Float32Array(0)
  private fromY = new Float32Array(0)
  private toX = new Float32Array(0)
  private toY = new Float32Array(0)
  private delay = new Float32Array(0)
  private lift = new Float32Array(0)
  private dim = new Float32Array(0)
  private dimT = new Float32Array(0)
  private vis = new Float32Array(0)
  private visT = new Float32Array(0)
  private visAt = new Float32Array(0)
  private emph = new Float32Array(0)
  private emphT = new Float32Array(0)
  private lo = new Float32Array(0)
  private loT = new Float32Array(0)
  private hi = new Float32Array(0)
  private hiT = new Float32Array(0)
  private ring = new Float32Array(0)
  private kin = new Float32Array(0)
  private kinAt = new Float32Array(0)
  private move = { active: false, t0: 0, dur: 0.9, span: 0.24 }
  private staticDirty = true
  private dynDirty = true

  // interaction
  private hover = -1
  private cursor = -1
  private cursorVisible = false
  private pointers = new Map<number, { x: number; y: number }>()
  private drag: { x: number; y: number; moved: boolean; samples: { x: number; y: number; t: number }[]; id: number } | null = null
  private pinch: { dist: number; mx: number; my: number } | null = null
  private vel: { x: number; y: number } | null = null
  private flight: { from: Cam; to: Cam; t0: number; dur: number; ease: (t: number) => number; dip: number } | null = null
  private pendingHover: { x: number; y: number } | null = null
  private lastTap: { t: number; x: number; y: number; hit: boolean } | null = null
  private lastZoomReport = -1
  private camMoved = true
  private lastHiCheck = 0

  // captions
  private captions = new Map<string, HTMLElement>()
  private captionKeys = '\u0000'
  private captionCheckAt = 0
  private chip: HTMLElement | null = null
  private chipSize = { w: 260, h: 96 }
  private chipRO: ResizeObserver | null = null
  private chipReported = -2
  private fieldDim = 0
  /** DOM (labels, chip) needs repositioning this frame. */
  private domDirty = true

  // GL
  private gl: GLState | null = null
  private loAtlas: Atlas
  private hiAtlas: Atlas
  private xlAtlas: Atlas
  /** Per node: which detail atlas serves it (0: 256 px slots, 1: 512 px). */
  private tier = new Uint8Array(0)
  private pendingRibbons: { which: 'coast' | 'ring'; groups: RibbonGroup[]; on: boolean; delay: number; sig: string }[] = []
  private pendingArrive: (() => Cam) | null = null
  private palette: Palette | null = null
  private paletteAt = 0
  private clearTmp = new THREE.Color()
  private groundTmp = new THREE.Color()
  private disposed = false
  private offs: (() => void)[] = []
  /** Development counters: JS time spent in render(), frame spacing. */
  private perf = { frames: 0, jsSum: 0, jsMax: 0, gapSum: 0, gapMax: 0, pump: 0, gl: 0, dom: 0 }

  constructor(
    private el: HTMLElement,
    private hooks: Hooks,
  ) {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    this.reduced = mq.matches
    const onMq = () => (this.reduced = mq.matches)
    mq.addEventListener('change', onMq)
    this.offs.push(() => mq.removeEventListener('change', onMq))
    const small = Math.min(window.innerWidth, window.innerHeight) < 700
    const d = small ? 1024 : 2048
    // Land (every piece, 128 px) · detail for singles (256) · detail for
    // trihexes and rosettes (512, fed from the 640 px optimizer variant).
    this.loAtlas = new Atlas(2048, 2048, 128, 6)
    this.hiAtlas = new Atlas(d, d, 256, 3)
    this.xlAtlas = new Atlas(d, d, 512, 2)
    this.loAtlas.onLoaded = (src) => this.texLoaded(src, false)
    this.hiAtlas.onLoaded = (src) => this.texLoaded(src, true)
    this.xlAtlas.onLoaded = (src) => this.texLoaded(src, true)
    this.loAtlas.onEvicted = (src) => this.texEvicted(src, false)
    this.hiAtlas.onEvicted = (src) => this.texEvicted(src, true)
    this.xlAtlas.onEvicted = (src) => this.texEvicted(src, true)
    const r = el.getBoundingClientRect()
    this.view = { w: Math.max(1, r.width), h: Math.max(1, r.height) }
    this.attachInput()
  }

  // ── public API ────────────────────────────────────────────────────────────

  get reducedMotion() {
    return this.reduced
  }

  /** Development: a snapshot for inspection / headless checks. */
  debug() {
    const m = this.model
    return {
      cam: { ...this.cam },
      view: { ...this.view },
      insets: { ...this.insets },
      bounds: { ...this.bounds },
      nodes: m?.nodes.length ?? 0,
      cells: m?.cells.length ?? 0,
      gl: Boolean(this.gl),
      instances: this.gl?.main.geo.instanceCount ?? 0,
      clock: this.clock,
      flight: Boolean(this.flight),
      moving: this.move.active,
      lo: this.lo.reduce((s, v) => s + (v > 0.5 ? 1 : 0), 0),
      hi: this.hi.reduce((s, v) => s + (v > 0.5 ? 1 : 0), 0),
      kin: this.kin.reduce((s, v) => s + v, 0) / Math.max(1, this.kin.length),
      captions: this.captions.size,
      perf: {
        frames: this.perf.frames,
        jsAvg: +(this.perf.jsSum / Math.max(1, this.perf.frames)).toFixed(3),
        jsMax: +this.perf.jsMax.toFixed(3),
        gapAvg: +(this.perf.gapSum / Math.max(1, this.perf.frames)).toFixed(2),
        gapMax: +this.perf.gapMax.toFixed(2),
        pumpMax: +this.perf.pump.toFixed(2),
        glMax: +this.perf.gl.toFixed(2),
        domMax: +this.perf.dom.toFixed(2),
      },
      hover: this.hover,
      cursor: this.cursor,
      cursorVisible: this.cursorVisible,
      chipReported: this.chipReported,
      chip: this.chip ? { on: this.chip.dataset.on !== undefined, html: this.chip.innerHTML.length, t: this.chip.style.transform } : null,
    }
  }

  /** Development: node keys of a kind with their current screen rects. */
  debugNodes(kind: 'pieza' | 'mercado' | 'franja') {
    const m = this.model
    if (!m) return []
    return m.nodes
      .map((n, i) => ({ key: n.key, kind: n.kind, vis: this.visT[i] }))
      .filter((n) => n.kind === kind && n.vis > 0.5)
      .map((n) => ({ key: n.key, rect: this.nodeRect(n.key) }))
  }

  get viewport() {
    return this.view
  }

  setInsets(i: Insets) {
    this.insets = i
  }

  setModel(model: TerrainModel) {
    const old = this.model
    const n = model.nodes.length
    const cursorKey = old && this.cursor >= 0 ? (old.nodes[this.cursor]?.key ?? null) : null
    const prev = old
      ? {
          byKey: old.byKey,
          nodes: old.nodes,
          curX: this.curX,
          curY: this.curY,
          vis: this.vis,
          dim: this.dim,
          emph: this.emph,
          kin: this.kin,
          kinAt: this.kinAt,
        }
      : null
    const booting = !old
    this.model = model
    const alloc = () => new Float32Array(n)
    this.curX = alloc()
    this.curY = alloc()
    this.fromX = alloc()
    this.fromY = alloc()
    this.toX = alloc()
    this.toY = alloc()
    this.delay = alloc()
    this.lift = alloc()
    this.dim = alloc()
    this.dimT = alloc()
    this.vis = alloc()
    this.visT = alloc()
    this.visAt = alloc()
    this.emph = alloc()
    this.emphT = alloc()
    this.lo = alloc()
    this.loT = alloc()
    this.hi = alloc()
    this.hiT = alloc()
    this.ring = alloc()
    this.kin = alloc()
    this.kinAt = alloc()
    this.move.active = false

    // Land center for the boot ripple.
    const b = model.bounds
    const cx = b.x + b.width / 2
    const cy = b.y + b.height / 2
    const maxR = Math.max(1, Math.hypot(b.width, b.height) / 2)

    for (let i = 0; i < n; i++) {
      const node = model.nodes[i]
      const was = prev ? prev.byKey.get(node.key) : undefined
      if (prev && was !== undefined) {
        // Continuity: appear exactly where it was, then glide home.
        const ob = prev.nodes[was].bbox
        this.curX[i] = ob.x + prev.curX[was] - node.bbox.x
        this.curY[i] = ob.y + prev.curY[was] - node.bbox.y
        this.vis[i] = this.visT[i] = prev.vis[was]
        this.dim[i] = this.dimT[i] = prev.dim[was]
        this.emph[i] = this.emphT[i] = prev.emph[was]
        this.kin[i] = prev.kin[was]
        this.kinAt[i] = prev.kinAt[was]
      } else {
        this.vis[i] = this.visT[i] = node.focusOf ? 0 : 1
        const d = Math.hypot(node.bbox.x + node.bbox.width / 2 - cx, node.bbox.y + node.bbox.height / 2 - cy) / maxR
        this.kin[i] = this.reduced ? 1 : 0
        this.kinAt[i] = this.clock + (booting ? 0.3 + d * 0.95 : 0.1)
      }
      this.fromX[i] = this.toX[i] = this.curX[i]
      this.fromY[i] = this.toY[i] = this.curY[i]
    }

    // Texture sources, deduplicated across nodes.
    this.srcLo = model.nodes.map((nd) => artSource(nd.image, 128))
    this.tier = Uint8Array.from(model.nodes.map((nd) => (nd.size > 1 ? 1 : 0)))
    this.srcHi = model.nodes.map((nd) => artSource(nd.image, nd.size > 1 ? 640 : 256))
    this.nodesByLo.clear()
    this.nodesByHi.clear()
    model.nodes.forEach((_, i) => {
      const lo = this.srcLo[i]
      const hi = this.srcHi[i]
      if (lo) {
        const l = this.nodesByLo.get(lo)
        if (l) l.push(i)
        else this.nodesByLo.set(lo, [i])
        if (this.loAtlas.has(lo)) this.lo[i] = this.loT[i] = 1
      }
      if (hi) {
        const l = this.nodesByHi.get(hi)
        if (l) l.push(i)
        else this.nodesByHi.set(hi, [i])
        if (this.detail(i).has(hi)) this.hi[i] = this.hiT[i] = 1
      }
    })
    for (const [src, list] of this.nodesByLo) {
      const first = list[0]
      this.loAtlas.request(src, () => this.priorityOf(first, 0))
    }

    // Caption box per node, bbox-relative (plane px). Singles and trihexes:
    // inside their lowest cell's widest band; rosettes: the lower belly.
    this.capAnchor = new Float32Array(n * 5)
    model.nodes.forEach((node, i) => {
      const pts = node.cells.map((c) => ({ x: R * 1.5 * c.q, y: R * Math.sqrt(3) * (c.r + c.q / 2) }))
      let x: number
      let y: number
      let w: number
      let h: number
      if (node.size === 7) {
        const ccx = pts.reduce((s, p) => s + p.x, 0) / pts.length
        const ccy = pts.reduce((s, p) => s + p.y, 0) / pts.length
        w = R * 3.3
        h = APOTHEM * 1.24
        x = ccx - w / 2 - node.bbox.x
        y = ccy + APOTHEM * 0.62 - node.bbox.y
      } else {
        let low = pts[0]
        for (const p of pts) if (p.y > low.y + 0.1 || (Math.abs(p.y - low.y) < 0.1 && p.x < low.x)) low = p
        w = R * 1.32
        h = APOTHEM * 0.8
        x = low.x - w / 2 - node.bbox.x
        y = low.y - APOTHEM * 0.06 - node.bbox.y
      }
      this.capAnchor.set([x, y, w, h, node.size], i * 5)
    })

    this.order = new Uint32Array(model.cells.length)
    for (let i = 0; i < this.order.length; i++) this.order[i] = i
    this.hover = -1
    delete this.el.dataset.hover
    this.cursor = cursorKey ? (model.byKey.get(cursorKey) ?? -1) : -1
    if (this.cursor < 0) this.cursorVisible = false
    this.chipReported = -2
    this.staticDirty = true
    this.dynDirty = true
    this.captionKeys = '\u0000'
    this.ensureBuffers()
  }

  /** Apply a view (targets per node). Motion radiates from the pivot. */
  setView(v: ViewTargets, animate: boolean) {
    const m = this.model
    if (!m) return
    this.bounds = v.bounds
    const n = m.nodes.length
    let maxD = 1
    const dist = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const b = m.nodes[i].bbox
      const d = Math.hypot(b.x + b.width / 2 + v.tx[i] - v.pivot.x, b.y + b.height / 2 + v.ty[i] - v.pivot.y)
      dist[i] = d
      if (d > maxD) maxD = d
    }
    const still = this.reduced || !animate
    for (let i = 0; i < n; i++) {
      this.fromX[i] = this.curX[i]
      this.fromY[i] = this.curY[i]
      this.toX[i] = v.tx[i]
      this.toY[i] = v.ty[i]
      this.delay[i] = (dist[i] / maxD) * this.move.span
      const wasVisT = this.visT[i]
      this.visT[i] = v.vis[i]
      this.dimT[i] = v.dim[i]
      this.emphT[i] = v.emph[i]
      // Focus furniture kindles after the gather; everything else at once.
      if (v.vis[i] > wasVisT) this.visAt[i] = this.clock + (still ? 0 : m.nodes[i].focusOf ? 0.62 : 0.12)
      if (still) {
        this.curX[i] = this.toX[i]
        this.curY[i] = this.toY[i]
        this.vis[i] = this.visT[i]
        this.dim[i] = this.dimT[i]
        this.emph[i] = this.emphT[i]
      }
    }
    this.move.active = !still
    this.move.t0 = this.clock
    // Draw order: what matters now sits on top while things cross.
    const cells = m.cells
    const idx = Array.from(this.order.keys())
    const rank = (ci: number) => {
      const nd = cells[ci].node
      return v.emph[nd] + (v.dim[nd] < 0.5 ? 0.5 : 0)
    }
    idx.sort((a, b) => rank(a) - rank(b) || a - b)
    this.order = Uint32Array.from(idx)
    this.staticDirty = true
    this.dynDirty = true
    this.camMoved = true
  }

  /**
   * Coastlines (afinidad) or the ring around a focus. Same signature as the
   * ribbon already drawn → only its riders are refreshed (no re-fade).
   */
  setRibbons(which: 'coast' | 'ring', groups: RibbonGroup[], on: boolean, delay = 0, sig = '') {
    this.pendingRibbons.push({ which, groups, on, delay, sig })
  }

  setCursor(key: string | null, keyboard: boolean) {
    const m = this.model
    this.cursor = key && m ? (m.byKey.get(key) ?? -1) : -1
    this.cursorVisible = keyboard && this.cursor >= 0
    this.dynDirty = true
    this.domDirty = true
  }

  hideCursor() {
    this.cursorVisible = false
  }

  get cursorKey(): string | null {
    return this.cursor >= 0 && this.model ? this.model.nodes[this.cursor].key : null
  }

  /** The piece nearest the middle of the free viewport (keyboard entry). */
  centralKey(): string | null {
    const m = this.model
    if (!m) return null
    const i = this.insets
    const sx = (i.left + this.view.w - i.right) / 2
    const sy = (i.top + this.view.h - i.bottom) / 2
    const px = this.cam.cx + (sx - this.view.w / 2) / this.cam.z
    const py = this.cam.cy + (sy - this.view.h / 2) / this.cam.z
    let best = -1
    let bd = Infinity
    for (let n = 0; n < m.nodes.length; n++) {
      if (m.nodes[n].kind !== 'pieza' || this.visT[n] < 0.5) continue
      const b = m.nodes[n].bbox
      const d = Math.hypot(b.x + b.width / 2 + this.curX[n] - px, b.y + b.height / 2 + this.curY[n] - py)
      if (d < bd) {
        bd = d
        best = n
      }
    }
    return best >= 0 ? m.nodes[best].key : null
  }

  registerCaption(key: string, el: HTMLElement | null) {
    if (el) this.captions.set(key, el)
    else this.captions.delete(key)
    this.domDirty = true
  }

  registerChip(el: HTMLElement | null) {
    this.chipRO?.disconnect()
    this.chipRO = null
    this.chip = el
    if (el && typeof ResizeObserver !== 'undefined') {
      this.chipRO = new ResizeObserver(() => {
        this.chipSize = { w: el.offsetWidth || 260, h: el.offsetHeight || 96 }
        this.domDirty = true
      })
      this.chipRO.observe(el)
    }
  }

  /** Screen rect of a node right now (viewport CSS px). */
  nodeRect(key: string): ScreenRect | null {
    const m = this.model
    const i = m?.byKey.get(key)
    if (!m || i === undefined) return null
    const b = m.nodes[i].bbox
    const z = this.cam.z
    const r = this.el.getBoundingClientRect()
    return {
      x: (b.x + this.curX[i] - this.cam.cx) * z + this.view.w / 2 + r.left,
      y: (b.y + this.curY[i] - this.cam.cy) * z + this.view.h / 2 + r.top,
      width: b.width * z,
      height: b.height * z,
    }
  }

  // ── camera ────────────────────────────────────────────────────────────────

  private clampCam(c: Cam): Cam {
    const b = this.bounds
    const z = clamp(c.z, ZMIN, ZMAX)
    // Keep some land in view: the center may not cross the last stretch of
    // the terrain (a quarter screen, or 12 % of the land, whichever is less).
    const ix = Math.min(b.width * 0.12, (this.view.w * 0.25) / z)
    const iy = Math.min(b.height * 0.12, (this.view.h * 0.25) / z)
    return {
      cx: clamp(c.cx, b.x + ix, b.x + b.width - ix),
      cy: clamp(c.cy, b.y + iy, b.y + b.height - iy),
      z,
    }
  }

  private measure() {
    const r = this.el.getBoundingClientRect()
    if (r.width > 1 && r.height > 1) {
      this.view.w = r.width
      this.view.h = r.height
    }
  }

  /** Camera that frames a plane box inside the free (non-chrome) area. */
  frameFor(box: Box, opts: { maxZ?: number; minZ?: number; pad?: number; extraLeft?: number } = {}): Cam {
    this.measure()
    const i = this.insets
    const left = i.left + (opts.extraLeft ?? 0)
    const aw = Math.max(80, this.view.w - left - i.right)
    const ah = Math.max(80, this.view.h - i.top - i.bottom)
    const pad = opts.pad ?? 28
    const z = clamp(Math.min((aw - pad * 2) / box.width, (ah - pad * 2) / box.height), opts.minZ ?? ZMIN, opts.maxZ ?? 1.1)
    return {
      cx: box.x + box.width / 2 - (left - i.right) / 2 / z,
      cy: box.y + box.height / 2 - (i.top - i.bottom) / 2 / z,
      z,
    }
  }

  jumpTo(c: Cam) {
    this.flight = null
    this.vel = null
    Object.assign(this.cam, this.clampCam(c))
    this.camMoved = true
  }

  flyTo(target: Cam, dur = 1.0, ease = 'power3.inOut') {
    this.vel = null
    const to = this.clampCam(target)
    if (this.reduced || dur <= 0) {
      this.jumpTo(to)
      return
    }
    const from = { ...this.cam }
    // Long hops dip out a little (van Wijk-lite): you see where you go.
    const travel = Math.hypot(to.cx - from.cx, to.cy - from.cy) * Math.min(from.z, to.z)
    const dip = clamp((travel / Math.max(this.view.w, this.view.h) - 0.6) * 0.35, 0, 0.45)
    this.flight = { from, to, t0: this.clock, dur, ease: gsap.parseEase(ease), dip }
  }

  /**
   * Boot camera. The target is computed on the first real frame, when the
   * window has its size; the land then prints itself in around it.
   */
  arrive(target: () => Cam) {
    this.pendingArrive = target
  }

  private doArrive(target: Cam) {
    // No fly-in: the camera is already there; the land prints itself in
    // (the kindle ripple — an ordered dither from the center out).
    this.jumpTo(target)
  }

  zoomBy(factor: number, at?: { x: number; y: number }, dur = 0.34) {
    const base = this.flight ? this.flight.to : this.cam
    const z = clamp(base.z * factor, ZMIN, ZMAX)
    const sx = at ? at.x : this.view.w / 2
    const sy = at ? at.y : this.view.h / 2
    const px = base.cx + (sx - this.view.w / 2) / base.z
    const py = base.cy + (sy - this.view.h / 2) / base.z
    this.flyTo({ cx: px - (sx - this.view.w / 2) / z, cy: py - (sy - this.view.h / 2) / z, z }, dur, 'expo.out')
  }

  ensureVisible(key: string) {
    const r = this.nodeRect(key)
    if (!r) return
    const box = this.el.getBoundingClientRect()
    const i = this.insets
    const m = 48
    const cx = r.x - box.left + r.width / 2
    const cy = r.y - box.top + r.height / 2
    if (cx < i.left + m || cx > this.view.w - i.right - m || cy < i.top + m || cy > this.view.h - i.bottom - m) {
      const px = this.cam.cx + (cx - this.view.w / 2) / this.cam.z
      const py = this.cam.cy + (cy - this.view.h / 2) / this.cam.z
      this.flyTo({ cx: px - (i.left - i.right) / 2 / this.cam.z, cy: py - (i.top - i.bottom) / 2 / this.cam.z, z: this.cam.z }, 0.45, 'power2.out')
    }
  }

  stopMotion() {
    this.flight = null
    this.vel = null
  }

  // ── input ─────────────────────────────────────────────────────────────────

  private isUi(t: EventTarget | null) {
    return t instanceof Element && Boolean(t.closest('[data-ui]'))
  }

  private local(e: { clientX: number; clientY: number }) {
    const r = this.el.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  private beginDrag(id: number, p: { x: number; y: number }, moved: boolean) {
    this.drag = { x: p.x, y: p.y, moved, samples: [{ x: p.x, y: p.y, t: performance.now() }], id }
  }

  private attachInput() {
    const el = this.el
    const on = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      el.addEventListener(type, fn as EventListener, opts)
      this.offs.push(() => el.removeEventListener(type, fn as EventListener, opts))
    }

    on('pointerdown', (e) => {
      if (this.isUi(e.target)) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      this.hooks.onInteract?.()
      this.stopMotion()
      if (this.cursorVisible) {
        this.cursorVisible = false
        this.dynDirty = true
      }
      const p = this.local(e)
      this.pointers.set(e.pointerId, p)
      if (this.pointers.size === 1) {
        this.beginDrag(e.pointerId, p, false)
        this.pinch = null
      } else if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()]
        this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }
        if (this.drag) this.drag.moved = true
        this.setHover(-1)
      }
    })

    on('pointermove', (e) => {
      const p = this.local(e)
      if (!this.pointers.has(e.pointerId)) {
        if (e.pointerType === 'mouse') this.pendingHover = this.isUi(e.target) ? { x: -1e5, y: -1e5 } : p
        return
      }
      this.pointers.set(e.pointerId, p)
      const cam = this.cam
      if (this.pointers.size >= 2 && this.pinch) {
        const [a, b] = [...this.pointers.values()]
        const dist = Math.hypot(a.x - b.x, a.y - b.y)
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2
        const f = this.pinch.dist > 0 ? dist / this.pinch.dist : 1
        const z = clamp(cam.z * f, ZMIN, ZMAX)
        const px = cam.cx + (this.pinch.mx - this.view.w / 2) / cam.z
        const py = cam.cy + (this.pinch.my - this.view.h / 2) / cam.z
        Object.assign(cam, this.clampCam({ cx: px - (mx - this.view.w / 2) / z, cy: py - (my - this.view.h / 2) / z, z }))
        this.pinch = { dist, mx, my }
        this.camMoved = true
        return
      }
      const d = this.drag
      if (!d || d.id !== e.pointerId) return
      const dx = p.x - d.x
      const dy = p.y - d.y
      const threshold = e.pointerType === 'mouse' ? 4 : 9
      if (!d.moved && Math.hypot(dx, dy) < threshold) return
      if (!d.moved) {
        d.moved = true
        try {
          el.setPointerCapture(e.pointerId)
        } catch {
          /* capture is best-effort */
        }
        el.dataset.dragging = ''
        this.setHover(-1)
      }
      Object.assign(cam, this.clampCam({ cx: cam.cx - dx / cam.z, cy: cam.cy - dy / cam.z, z: cam.z }))
      d.x = p.x
      d.y = p.y
      const now = performance.now()
      d.samples.push({ x: p.x, y: p.y, t: now })
      while (d.samples.length > 2 && now - d.samples[0].t > 110) d.samples.shift()
      this.camMoved = true
    })

    const end = (e: PointerEvent) => {
      if (!this.pointers.has(e.pointerId)) return
      const p = this.local(e)
      this.pointers.delete(e.pointerId)
      const d = this.drag
      if (this.pointers.size < 2) this.pinch = null
      if (this.pointers.size === 1) {
        // Pinch → one finger: keep panning from the remaining finger.
        const [id, q] = [...this.pointers.entries()][0]
        this.beginDrag(id, q, true)
        return
      }
      if (this.pointers.size === 0) delete el.dataset.dragging
      this.drag = null
      if (!d || d.id !== e.pointerId) return
      if (d.moved) {
        if (e.type === 'pointerup' && !this.reduced && d.samples.length >= 2) {
          const a = d.samples[0]
          const b = d.samples[d.samples.length - 1]
          const dt = Math.max(16, b.t - a.t) / 1000
          const vx = (b.x - a.x) / dt
          const vy = (b.y - a.y) / dt
          if (Math.hypot(vx, vy) > 70 && performance.now() - b.t < 90) this.vel = { x: vx, y: vy }
        }
        return
      }
      if (e.type !== 'pointerup') return
      // A tap.
      const hit = this.pick(p.x, p.y)
      const now = performance.now()
      const lt = this.lastTap
      if (e.pointerType !== 'mouse' && hit < 0 && lt && !lt.hit && now - lt.t < 320 && Math.hypot(p.x - lt.x, p.y - lt.y) < 30) {
        this.zoomBy(1.8, p, 0.45)
        this.lastTap = null
        return
      }
      this.lastTap = { t: now, x: p.x, y: p.y, hit: hit >= 0 }
      if (hit >= 0 && this.model) {
        const key = this.model.nodes[hit].key
        const r = this.nodeRect(key)
        if (r) this.hooks.onActivate(key, r)
      }
    }
    on('pointerup', end)
    on('pointercancel', end)
    on('lostpointercapture', (e) => {
      if (this.pointers.has(e.pointerId)) end(e)
    })
    on('pointerleave', (e) => {
      if (e.pointerType === 'mouse') this.pendingHover = { x: -1e5, y: -1e5 }
    })

    on(
      'wheel',
      (e) => {
        if (this.isUi(e.target)) return
        e.preventDefault()
        this.hooks.onInteract?.()
        this.flight = null
        this.vel = null
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.view.h : 1
        const p = this.local(e)
        const cam = this.cam
        if (e.ctrlKey || e.metaKey) {
          const f = Math.exp(-e.deltaY * unit * 0.0024)
          const z = clamp(cam.z * f, ZMIN, ZMAX)
          const px = cam.cx + (p.x - this.view.w / 2) / cam.z
          const py = cam.cy + (p.y - this.view.h / 2) / cam.z
          Object.assign(cam, this.clampCam({ cx: px - (p.x - this.view.w / 2) / z, cy: py - (p.y - this.view.h / 2) / z, z }))
        } else {
          Object.assign(cam, this.clampCam({ cx: cam.cx + (e.deltaX * unit) / cam.z, cy: cam.cy + (e.deltaY * unit) / cam.z, z: cam.z }))
        }
        this.camMoved = true
        this.pendingHover = p
      },
      { passive: false },
    )

    on('dblclick', (e) => {
      if (this.isUi(e.target)) return
      const p = this.local(e)
      if (this.pick(p.x, p.y) >= 0) return
      this.zoomBy(e.shiftKey ? 1 / 1.8 : 1.8, p, 0.45)
    })
  }

  // ── picking ───────────────────────────────────────────────────────────────

  /** Topmost visible node under a viewport point, or -1. */
  pick(sx: number, sy: number): number {
    const m = this.model
    if (!m) return -1
    const px = this.cam.cx + (sx - this.view.w / 2) / this.cam.z
    const py = this.cam.cy + (sy - this.view.h / 2) / this.cam.z
    const a = APOTHEM
    for (let s = this.order.length - 1; s >= 0; s--) {
      const c = m.cells[this.order[s]]
      const n = c.node
      if (this.visT[n] < 0.5 || this.vis[n] < 0.3) continue
      const x = Math.abs(px - (c.x + this.curX[n]))
      const y = Math.abs(py - (c.y + this.curY[n]))
      if (y <= a && 0.8660254 * x + 0.5 * y <= a) return n
    }
    return -1
  }

  private setHover(i: number) {
    if (i === this.hover) return
    this.hover = i
    this.dynDirty = true
    this.domDirty = true
    if (i >= 0) this.el.dataset.hover = ''
    else delete this.el.dataset.hover
  }

  // ── textures ──────────────────────────────────────────────────────────────

  private texLoaded(src: string, hi: boolean) {
    const list = (hi ? this.nodesByHi : this.nodesByLo).get(src)
    if (!list) return
    for (const i of list) {
      if (hi) this.hiT[i] = 1
      else this.loT[i] = 1
      if (this.reduced) {
        if (hi) this.hi[i] = 1
        else this.lo[i] = 1
      }
    }
    this.staticDirty = true
  }

  private texEvicted(src: string, hi: boolean) {
    const list = (hi ? this.nodesByHi : this.nodesByLo).get(src)
    if (!list) return
    for (const i of list) {
      if (hi) this.hi[i] = this.hiT[i] = 0
      else this.lo[i] = this.loT[i] = 0
    }
    this.staticDirty = true
  }

  /** Lower is sooner: distance to the camera center, on-screen first. */
  private priorityOf(i: number, tier: number): number {
    const m = this.model
    if (!m || i >= m.nodes.length) return Infinity
    const b = m.nodes[i].bbox
    const z = this.cam.z
    const x = (b.x + b.width / 2 + this.curX[i] - this.cam.cx) * z
    const y = (b.y + b.height / 2 + this.curY[i] - this.cam.cy) * z
    const off = Math.abs(x) > this.view.w / 2 + 80 || Math.abs(y) > this.view.h / 2 + 80
    if (tier === 1 && off) return Infinity
    const hidden = this.visT[i] < 0.5 ? 1e6 : 0
    return Math.hypot(x, y) + (off ? 1e5 : 0) + hidden
  }

  private detail(i: number): Atlas {
    return this.tier[i] ? this.xlAtlas : this.hiAtlas
  }

  private updateHiRes(nowMs: number) {
    const m = this.model
    if (!m) return
    const z = this.cam.z
    const far = farOf(z)
    for (let i = 0; i < m.nodes.length; i++) {
      const src = this.srcHi[i]
      const lo = this.srcLo[i]
      const b = m.nodes[i].bbox
      const x = (b.x + this.curX[i] - this.cam.cx) * z + this.view.w / 2
      const y = (b.y + this.curY[i] - this.cam.cy) * z + this.view.h / 2
      const w = b.width * z
      const h = b.height * z
      const onScreen = x < this.view.w && x + w > 0 && y < this.view.h && y + h > 0 && this.vis[i] > 0.05
      const atlas = this.detail(i)
      if (onScreen) {
        if (lo) this.loAtlas.touch(lo, nowMs)
        if (src) atlas.touch(src, nowMs)
      }
      if (!src) continue
      const want = onScreen && far < 0.5 && Math.max(w, h) >= HI_MIN_PX && this.visT[i] > 0.5
      if (want) {
        if (!atlas.has(src) && !atlas.isFailed(src)) atlas.request(src, () => this.priorityOf(i, 1))
      } else if (atlas.isPending(src)) {
        atlas.cancel(src)
      }
    }
  }

  // ── per-frame ─────────────────────────────────────────────────────────────

  private step(dt: number) {
    const m = this.model
    const cam = this.cam
    // Camera flight.
    const f = this.flight
    if (f) {
      if (this.clock >= f.t0) {
        const t = clamp((this.clock - f.t0) / f.dur, 0, 1)
        const e = f.ease(t)
        const lz = Math.log(f.from.z) + (Math.log(f.to.z) - Math.log(f.from.z)) * e
        cam.z = Math.exp(lz) * (1 - f.dip * Math.sin(Math.PI * e))
        cam.cx = f.from.cx + (f.to.cx - f.from.cx) * e
        cam.cy = f.from.cy + (f.to.cy - f.from.cy) * e
        this.camMoved = true
        if (t >= 1) {
          Object.assign(cam, f.to)
          this.flight = null
        }
      }
    } else if (this.vel) {
      const v = this.vel
      Object.assign(cam, this.clampCam({ cx: cam.cx - (v.x * dt) / cam.z, cy: cam.cy - (v.y * dt) / cam.z, z: cam.z }))
      const k = Math.exp(-dt / 0.3)
      v.x *= k
      v.y *= k
      this.camMoved = true
      if (Math.hypot(v.x, v.y) < 9) this.vel = null
    }
    if (!m) return

    const n = m.nodes.length
    const still = this.reduced
    let active = false

    // Reflow.
    if (this.move.active) {
      const el = this.clock - this.move.t0
      for (let i = 0; i < n; i++) {
        const p = clamp((el - this.delay[i]) / this.move.dur, 0, 1)
        const e = this.reflowEase(p)
        this.curX[i] = this.fromX[i] + (this.toX[i] - this.fromX[i]) * e
        this.curY[i] = this.fromY[i] + (this.toY[i] - this.fromY[i]) * e
      }
      if (el > this.move.dur + this.move.span + 0.02) {
        this.move.active = false
        this.curX.set(this.toX)
        this.curY.set(this.toY)
      }
      active = true
    }
    // Satellites ride their anchors.
    for (let i = 0; i < n; i++) {
      const a = m.nodes[i].anchor
      if (a >= 0) {
        this.curX[i] = this.curX[a]
        this.curY[i] = this.curY[a]
      }
    }

    const kLift = still ? 1 : smooth(dt, 0.09)
    const kDim = still ? 1 : smooth(dt, 0.3)
    const kVis = still ? 1 : smooth(dt, 0.26)
    const kTex = still ? 1 : smooth(dt, 0.3)
    const kRing = still ? 1 : smooth(dt, 0.1)
    const approach = (arr: Float32Array, i: number, target: number, k: number) => {
      const d = target - arr[i]
      if (d === 0) return
      arr[i] = Math.abs(d) < 0.002 ? target : arr[i] + d * k
      active = true
    }
    for (let i = 0; i < n; i++) {
      const lit = i === this.hover || (i === this.cursor && this.cursorVisible)
      approach(this.lift, i, lit ? 1 : 0, kLift)
      approach(this.dim, i, this.dimT[i], kDim)
      if (this.clock >= this.visAt[i] || this.visT[i] < this.vis[i]) approach(this.vis, i, this.visT[i], kVis)
      approach(this.emph, i, this.emphT[i], kDim)
      approach(this.lo, i, this.loT[i], kTex)
      approach(this.hi, i, this.hiT[i], kTex)
      approach(this.ring, i, i === this.cursor && this.cursorVisible ? 1 : 0, kRing)
      if (this.kin[i] < 1) {
        const p = still ? 1 : clamp((this.clock - this.kinAt[i]) / 0.95, 0, 1)
        this.kin[i] = p >= 1 ? 1 : 1 - Math.pow(1 - p, 3)
        active = true
      }
    }
    if (active) this.dynDirty = true
  }

  private ensureBuffers() {
    const g = this.gl
    const m = this.model
    if (!g || !m) return
    const need = m.cells.length
    if (need > g.main.cap) {
      const cap = Math.max(256, 1 << Math.ceil(Math.log2(need + 32)))
      g.main.geo.dispose()
      g.main = makeBuffers(g.base, cap)
      g.tileMesh.geometry = g.main.geo
    }
    g.main.geo.instanceCount = need
    this.staticDirty = true
    this.dynDirty = true
  }

  private writeStatic(buf: CellBuffers, cellIdx: ArrayLike<number>, count: number) {
    const m = this.model!
    const local = buf.local.array as Float32Array
    const info = buf.info.array as Float32Array
    const tl = buf.texLo.array as Float32Array
    const th = buf.texHi.array as Float32Array
    const en = buf.energy.array as Float32Array
    for (let s = 0; s < count; s++) {
      const c = m.cells[cellIdx[s]]
      const n = c.node
      const node = m.nodes[n]
      const o = s * 4
      local[o] = c.lx
      local[o + 1] = c.ly
      local[o + 2] = c.w
      local[o + 3] = c.h
      info[o] = c.mask
      info[o + 1] = KIND_CODE[node.kind]
      info[o + 2] = node.archive ? 1 : 0
      info[o + 3] = this.tier[n]
      const lo = this.srcLo[n] ? this.loAtlas.rectOf(this.srcLo[n]!) : null
      const hi = this.srcHi[n] ? this.detail(n).rectOf(this.srcHi[n]!) : null
      if (lo) {
        tl[o] = lo.u0
        tl[o + 1] = lo.v0
        tl[o + 2] = lo.u1
        tl[o + 3] = lo.v1
      } else tl[o] = -1
      if (hi) {
        th[o] = hi.u0
        th[o + 1] = hi.v0
        th[o + 2] = hi.u1
        th[o + 3] = hi.v1
      } else th[o] = -1
      en[o] = node.band[0]
      en[o + 1] = node.band[1]
      en[o + 2] = node.life
      en[o + 3] = 1
    }
    buf.local.needsUpdate = true
    buf.info.needsUpdate = true
    buf.texLo.needsUpdate = true
    buf.texHi.needsUpdate = true
    buf.energy.needsUpdate = true
  }

  private writeDynamic(buf: CellBuffers, cellIdx: ArrayLike<number>, count: number) {
    const m = this.model!
    const center = buf.center.array as Float32Array
    const st = buf.state.array as Float32Array
    const st2 = buf.state2.array as Float32Array
    for (let s = 0; s < count; s++) {
      const c = m.cells[cellIdx[s]]
      const n = c.node
      center[s * 2] = c.x + this.curX[n]
      center[s * 2 + 1] = c.y + this.curY[n]
      const o = s * 4
      st[o] = this.lift[n]
      st[o + 1] = this.dim[n]
      st[o + 2] = this.vis[n]
      st[o + 3] = this.lo[n]
      st2[o] = this.hi[n]
      st2[o + 1] = this.kin[n]
      st2[o + 2] = this.ring[n]
      st2[o + 3] = this.emph[n]
    }
    buf.center.needsUpdate = true
    buf.state.needsUpdate = true
    buf.state2.needsUpdate = true
  }

  private initGL(renderer: THREE.WebGLRenderer) {
    const base = hexagonGeometry()
    const main = makeBuffers(base, 256)
    const lifted = makeBuffers(base, LIFT_CAP)
    const palette = readPalette()
    this.palette = palette
    const spectrum = spectrumTexture(palette.spectrum)
    this.loAtlas.attach(renderer)
    this.hiAtlas.attach(renderer)
    this.xlAtlas.attach(renderer)
    const uniforms: Record<string, THREE.IUniform> = {
      uCam: { value: new THREE.Vector3() },
      uView: { value: new THREE.Vector2(1, 1) },
      uR: { value: R },
      uLiftScale: { value: 0 },
      uLiftRaise: { value: 2 },
      uLo: { value: this.loAtlas.texture },
      uHi: { value: this.hiAtlas.texture },
      uXl: { value: this.xlAtlas.texture },
      uSpec: { value: spectrum },
      uGround: { value: new THREE.Vector3(...palette.ground) },
      uPlate: { value: new THREE.Vector3(...palette.plate) },
      uInk: { value: new THREE.Vector3(...palette.ink) },
      uA: { value: APOTHEM },
      uSeamW: { value: 5 },
      uSeamK: { value: 1 },
      uRimW: { value: 10 },
      uDot: { value: 20 },
      uFar: { value: 0 },
      uRange: { value: new THREE.Vector2(0, 10) },
      uFieldDim: { value: 0 },
      uShadowOff: { value: new THREE.Vector2(4, 4) },
    }
    const mat = (mode: number) =>
      new THREE.ShaderMaterial({
        vertexShader: tileVertex,
        fragmentShader: tileFragment,
        defines: { MODE: mode },
        uniforms: { ...uniforms, uPad: { value: 2 } },
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.NormalBlending,
      })
    const tileMat = mat(0)
    const shadowMat = mat(2)
    const liftMat = mat(0)
    const mesh = (geo: THREE.BufferGeometry, m: THREE.Material, order: number) => {
      const x = new THREE.Mesh(geo, m)
      x.frustumCulled = false
      x.renderOrder = order
      return x
    }
    const tileMesh = mesh(main.geo, tileMat, 1)
    const shadowMesh = mesh(lifted.geo, shadowMat, 6)
    const liftMesh = mesh(lifted.geo, liftMat, 7)
    const scene = new THREE.Scene()
    scene.add(tileMesh, shadowMesh, liftMesh)
    const ribbon = (dash: number, halfW: number): Ribbon => ({
      mesh: null,
      sig: '',
      mat: new THREE.ShaderMaterial({
        vertexShader: ribbonVertex,
        fragmentShader: ribbonFragment,
        uniforms: {
          uCam: uniforms.uCam,
          uView: uniforms.uView,
          uHalfW: { value: halfW },
          uOff: { value: Array.from({ length: MAX_GROUPS }, () => new THREE.Vector2()) },
          uColor: uniforms.uInk,
          uAlpha: { value: 0 },
          uDash: { value: dash },
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      riders: [],
      alpha: 0,
      target: 0,
      start: 0,
    })
    this.gl = {
      renderer,
      scene,
      camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
      base,
      main,
      lifted,
      tileMesh,
      shadowMesh,
      liftMesh,
      tileMat,
      shadowMat,
      liftMat,
      uniforms,
      spectrum,
      coast: ribbon(7, 0.6),
      ring: ribbon(0, 0.6),
    }
    // Compile every program now, and draw each pass once invisibly during
    // the boot reveal (drivers that build pipelines lazily at first draw
    // would otherwise stall the first hover or the first coastline).
    const warmGeo = ribbonGeometry([{ loops: [[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]], rider: -1 }])
    if (warmGeo) {
      const warm = new THREE.Mesh(warmGeo, this.gl.coast.mat)
      warm.frustumCulled = false
      scene.add(warm)
      this.warm = { mesh: warm, frames: 3 }
    }
    renderer.compile(scene, this.gl.camera)
    this.ensureBuffers()
  }

  private warm: { mesh: THREE.Mesh; frames: number } | null = null

  /** Invisible first draws of the lift / shadow / ribbon pipelines. */
  private warmUp(): boolean {
    const w = this.warm
    const g = this.gl
    if (!w || !g || !this.model || !this.model.cells.length) return false
    if (w.frames-- <= 0) {
      g.scene.remove(w.mesh)
      w.mesh.geometry.dispose()
      this.warm = null
      return false
    }
    if (g.lifted.geo.instanceCount === 0) {
      // One lifted copy of cell 0 with vis = 0: every fragment discards.
      this.writeStatic(g.lifted, [0], 1)
      this.writeDynamic(g.lifted, [0], 1)
      ;(g.lifted.state.array as Float32Array)[2] = 0
      g.lifted.geo.instanceCount = 1
      g.shadowMesh.visible = true
      return true
    }
    return false
  }

  /** The tokens changed (a palette flip): reprint with the new colors. */
  private syncPalette(now: number) {
    const g = this.gl
    if (!g || now - this.paletteAt < 1500) return
    this.paletteAt = now
    const key = paletteKey()
    if (this.palette && key === this.palette.key) return
    const p = readPalette()
    this.palette = p
    ;(g.uniforms.uGround.value as THREE.Vector3).set(...p.ground)
    ;(g.uniforms.uPlate.value as THREE.Vector3).set(...p.plate)
    ;(g.uniforms.uInk.value as THREE.Vector3).set(...p.ink)
    fillSpectrum(g.spectrum, p.spectrum)
  }

  private applyRibbons() {
    const g = this.gl
    if (!g) return
    for (const r of this.pendingRibbons) {
      const rb = r.which === 'coast' ? g.coast : g.ring
      if (r.on && rb.mesh && r.sig && rb.sig === r.sig) {
        rb.riders = r.groups.slice(0, MAX_GROUPS).map((x) => x.rider)
        rb.target = 1
        continue
      }
      if (r.on) {
        if (rb.mesh) {
          g.scene.remove(rb.mesh)
          rb.mesh.geometry.dispose()
          rb.mesh = null
        }
        const geo = ribbonGeometry(r.groups)
        if (geo) {
          const mesh = new THREE.Mesh(geo, rb.mat)
          mesh.frustumCulled = false
          mesh.renderOrder = r.which === 'coast' ? 2 : 3
          g.scene.add(mesh)
          rb.mesh = mesh
          rb.sig = r.sig
          rb.riders = r.groups.slice(0, MAX_GROUPS).map((x) => x.rider)
          rb.alpha = 0
          rb.target = 1
          rb.start = this.clock + (this.reduced ? 0 : r.delay)
        }
      } else {
        rb.target = 0
        rb.sig = ''
      }
    }
    this.pendingRibbons = []
  }

  private updateRibbon(rb: Ribbon, dt: number, maxAlpha: number) {
    if (!rb.mesh || !this.gl) return
    if (this.clock >= rb.start || rb.target === 0) {
      const k = this.reduced ? 1 : smooth(dt, 0.35)
      rb.alpha += (rb.target - rb.alpha) * k
    }
    if (rb.target === 0 && rb.alpha < 0.003) {
      this.gl.scene.remove(rb.mesh)
      rb.mesh.geometry.dispose()
      rb.mesh = null
      return
    }
    rb.mat.uniforms.uAlpha.value = rb.alpha * maxAlpha
    const off = rb.mat.uniforms.uOff.value as THREE.Vector2[]
    rb.riders.forEach((r, i) => {
      if (r >= 0 && r < this.curX.length) off[i].set(this.curX[r], this.curY[r])
      else off[i].set(0, 0)
    })
  }

  resetPerf() {
    this.perf = { frames: 0, jsSum: 0, jsMax: 0, gapSum: 0, gapMax: 0, pump: 0, gl: 0, dom: 0 }
  }

  /** The stage window's render callback. */
  render(ctx: WindowRenderContext) {
    if (this.disposed) return
    const t0 = performance.now()
    this.renderFrame(ctx)
    const t1 = performance.now()
    const p = this.perf
    const gap = this.lastNow ? t0 - this.perfLast : 0
    this.perfLast = t0
    p.frames++
    p.jsSum += t1 - t0
    p.jsMax = Math.max(p.jsMax, t1 - t0)
    p.gapSum += gap
    p.gapMax = Math.max(p.gapMax, gap)
  }

  private perfLast = 0

  private renderFrame(ctx: WindowRenderContext) {
    if (!this.gl) this.initGL(ctx.renderer)
    const g = this.gl!
    const now = performance.now()
    const dtReal = this.lastNow ? Math.min(0.1, (now - this.lastNow) / 1000) : 1 / 60
    this.lastNow = now
    // Tempo follows temperature (the horizon sets the global timeScale).
    const dt = dtReal * gsap.globalTimeline.timeScale()
    this.clock += dt
    if (ctx.rect.width !== this.view.w || ctx.rect.height !== this.view.h) {
      this.view.w = ctx.rect.width
      this.view.h = ctx.rect.height
      this.camMoved = true
    }
    if (this.pendingArrive && this.model) {
      const t = this.pendingArrive
      this.pendingArrive = null
      this.doArrive(t())
    }

    if (this.pendingRibbons.length) this.applyRibbons()

    // Hover pick, coalesced to one per frame.
    if (this.pendingHover && !this.drag?.moved && !this.pinch) {
      const p = this.pendingHover
      this.pendingHover = null
      this.setHover(this.pick(p.x, p.y))
    }

    this.step(dt)
    const m = this.model
    const z = this.cam.z
    if (this.camMoved || this.dynDirty || Math.abs(ctx.state.dim - this.fieldDim) > 0.001) this.domDirty = true

    // Atlases: start loads, touch what's visible, ask for detail.
    if (this.camMoved || now - this.lastHiCheck > 220) {
      this.lastHiCheck = now
      this.updateHiRes(now)
    }
    const tp = performance.now()
    this.loAtlas.pump(now)
    this.hiAtlas.pump(now)
    this.xlAtlas.pump(now)
    this.perf.pump = Math.max(this.perf.pump, performance.now() - tp)

    if (m) {
      const count = m.cells.length
      const wasDirty = this.staticDirty || this.dynDirty
      if (this.staticDirty) this.writeStatic(g.main, this.order, count)
      if (this.staticDirty || this.dynDirty) this.writeDynamic(g.main, this.order, count)
      if (wasDirty) {
        // Lifted pieces are drawn again on top, over their own shadow.
        const lifted: number[] = []
        for (let s = 0; s < count && lifted.length < LIFT_CAP; s++) {
          const ci = this.order[s]
          if (this.lift[m.cells[ci].node] > 0.004) lifted.push(ci)
        }
        g.lifted.geo.instanceCount = lifted.length
        if (lifted.length) {
          this.writeStatic(g.lifted, lifted, lifted.length)
          this.writeDynamic(g.lifted, lifted, lifted.length)
        }
      }
      this.staticDirty = false
      this.dynDirty = false
    }

    // Uniforms.
    this.syncPalette(now)
    const u = g.uniforms
    ;(u.uCam.value as THREE.Vector3).set(this.cam.cx, this.cam.cy, z)
    ;(u.uView.value as THREE.Vector2).set(this.view.w, this.view.h)
    u.uFar.value = farOf(z)
    // Print sizes are screen sizes: one px of seam, a 1.5–3 px energy rim,
    // a 4.5 px halftone screen — whatever the zoom.
    u.uSeamW.value = 1 / z
    u.uSeamK.value = 0.45 + 0.55 * sstep(0.06, 0.2, z)
    u.uRimW.value = (1.5 + 1.5 * sstep(0.15, 0.8, z)) / z
    u.uDot.value = 4.5 / z
    ;(u.uShadowOff.value as THREE.Vector2).set(4 / z, 4 / z)
    g.shadowMesh.visible = g.lifted.geo.instanceCount > 0
    ;(u.uRange.value as THREE.Vector2).set(ctx.state.bandSmooth[0], ctx.state.bandSmooth[1])
    u.uFieldDim.value = ctx.state.dim
    this.fieldDim = ctx.state.dim
    g.tileMat.uniforms.uPad.value = 2 / z
    g.liftMat.uniforms.uPad.value = 2 / z
    g.shadowMat.uniforms.uPad.value = 8 / z

    this.updateRibbon(g.coast, dt, 0.55)
    this.updateRibbon(g.ring, dt, 0.7)

    // The land is printed on paper, never on the field: clear this window to
    // the ground token first (the stage may be transparent or not).
    const r = g.renderer
    r.getClearColor(this.clearTmp)
    const clearA = r.getClearAlpha()
    const gr = this.palette?.ground ?? [1, 1, 1]
    r.setClearColor(this.groundTmp.setRGB(gr[0], gr[1], gr[2], THREE.SRGBColorSpace), 1)
    r.clear(true, false, false)
    r.setClearColor(this.clearTmp, clearA)
    const warming = this.warmUp()
    const tg = performance.now()
    r.render(g.scene, g.camera)
    const td = performance.now()
    if (warming) {
      g.lifted.geo.instanceCount = 0
      this.dynDirty = true
    }
    this.perf.gl = Math.max(this.perf.gl, td - tg)

    this.positionDom(now)
    this.perf.dom = Math.max(this.perf.dom, performance.now() - td)
    if (this.camMoved) {
      const pct = Math.round(z * 100)
      if (pct !== this.lastZoomReport) {
        this.lastZoomReport = pct
        this.hooks.onZoom(z)
      }
    }
    this.camMoved = false
  }

  // ── DOM: captions + the hover chip ────────────────────────────────────────

  private positionDom(now: number) {
    const m = this.model
    if (!m) return
    const z = this.cam.z
    const hw = this.view.w / 2
    const hh = this.view.h / 2

    // Which pieces carry a label right now (checked ~8×/s).
    if (now - this.captionCheckAt > 120) {
      this.captionCheckAt = now
      const keys: { k: string; d: number }[] = []
      if (z >= CAPTION_Z[7]) {
        for (let i = 0; i < m.nodes.length; i++) {
          if (this.visT[i] < 0.5 || this.dimT[i] > 0.5) continue
          if (captionOf(z, m.nodes[i].size) <= 0) continue
          const b = m.nodes[i].bbox
          const x = (b.x + this.curX[i] - this.cam.cx) * z + hw
          const y = (b.y + this.curY[i] - this.cam.cy) * z + hh
          const w = b.width * z
          const h = b.height * z
          if (x > this.view.w + 60 || x + w < -60 || y > this.view.h + 60 || y + h < -60) continue
          keys.push({ k: m.nodes[i].key, d: Math.hypot(x + w / 2 - hw, y + h / 2 - hh) })
        }
      }
      keys.sort((a, b) => a.d - b.d)
      const list = keys.slice(0, 48).map((x) => x.k)
      const joined = list.join('|')
      if (joined !== this.captionKeys) {
        this.captionKeys = joined
        this.hooks.onCaptions(list)
      }
    }

    const dirty = this.domDirty
    this.domDirty = false
    for (const [key, el] of this.captions) {
      if (!dirty) break
      const i = m.byKey.get(key)
      if (i === undefined) continue
      const b = m.nodes[i].bbox
      const a = i * 5
      const sx = (b.x + this.curX[i] + this.capAnchor[a] - this.cam.cx) * z + hw
      const sy = (b.y + this.curY[i] + this.capAnchor[a + 1] - this.cam.cy) * z + hh
      const o = captionOf(z, m.nodes[i].size) * this.vis[i] * (1 - this.dim[i]) * (this.kin[i] >= 1 ? 1 : 0) * (1 - this.fieldDim * 0.7)
      el.style.transform = `translate3d(${sx.toFixed(2)}px, ${sy.toFixed(2)}px, 0) scale(${z.toFixed(4)})`
      el.style.opacity = o.toFixed(3)
      el.style.width = `${this.capAnchor[a + 2]}px`
      el.style.height = `${this.capAnchor[a + 3]}px`
    }

    // Chip: follows the hovered piece (or the keyboard cursor).
    const node = this.hover >= 0 ? this.hover : this.cursorVisible ? this.cursor : -1
    if (node !== this.chipReported) {
      this.chipReported = node
      this.hooks.onChip(node >= 0 ? m.nodes[node].key : null, node >= 0 && this.hover < 0)
    }
    const chip = this.chip
    if (chip && dirty) {
      if (node >= 0) {
        const b = m.nodes[node].bbox
        const x = (b.x + this.curX[node] - this.cam.cx) * z + hw
        const y = (b.y + this.curY[node] - this.cam.cy) * z + hh
        const w = b.width * z
        const h = b.height * z
        const { w: cw, h: ch } = this.chipSize
        const i = this.insets
        let cx = x + w / 2 - cw / 2
        let cy = y - ch - 14
        if (cy < i.top + 4) cy = y + h + 14
        cx = clamp(cx, 12, this.view.w - cw - 12)
        cy = clamp(cy, 12, this.view.h - ch - 12)
        chip.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`
        if (chip.dataset.on === undefined) chip.dataset.on = ''
      } else if (chip.dataset.on !== undefined) {
        delete chip.dataset.on
      }
    }
  }

  dispose() {
    this.disposed = true
    this.offs.forEach((f) => f())
    this.offs = []
    this.chipRO?.disconnect()
    this.loAtlas.dispose()
    this.hiAtlas.dispose()
    this.xlAtlas.dispose()
    const g = this.gl
    if (g) {
      g.main.geo.dispose()
      g.lifted.geo.dispose()
      g.base.dispose()
      g.tileMat.dispose()
      g.shadowMat.dispose()
      g.liftMat.dispose()
      g.spectrum.dispose()
      for (const rb of [g.coast, g.ring]) {
        rb.mesh?.geometry.dispose()
        rb.mat.dispose()
      }
    }
    this.gl = null
  }
}
