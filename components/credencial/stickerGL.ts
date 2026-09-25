/**
 * The stickers on one case: meshes, art textures, finishes, aging, press-in
 * and scrape tweens, the editor's ghost and marks, and hit-testing.
 *
 * A sticker is up to three meshes on one grid: its footprint (the press
 * shadow, the glue left under a lifted corner) and its body in two halves —
 * the skin facing the camera (drawn over the case, stacked by draw order)
 * and the skin facing away (drawn before the acrylic and depth-tested
 * against the card: what wrapped round the edge to the far face is seen
 * through the slab). Only a sticker that hangs past its face's flat needs
 * both halves and the dense grid (stickerWrap.ts); grids are shared by
 * density. Art comes from `stickerArt(def, px)` once per design (cached,
 * capped at 512 px, disposed with the layer; a lenticular also loads frame
 * 'b'); its alpha is also kept small on the CPU for picking. The finish is
 * uniforms (stickerFinish.ts), seeded per copy (copySeed(uid)). Uniform
 * objects are reused — nothing is allocated per frame.
 *
 * Development: `window.__calcosGL` forces finishes, moves placements and
 * fixes the age of every live case, for headless checks (never in production).
 */

import * as THREE from 'three'
import gsap from 'gsap'
import { stickerArt } from '@/lib/stickers/arte'
import { designOf } from '@/lib/stickers/finish'
import type { CardFace, StickerDef, StickerPlacement } from '@/lib/stickers/types'
import { footprintFragment, stickerFragment, stickerVertex } from './stickerShader'
import type { Estuche } from './estuche'
import { CARD_H, CARD_W, CASE_HX, CASE_HY, CASE_HZ, CASE_R } from './geometry'
import { buildSkin, gridGeometry, gridLines, onFlat, reachesEdge, unwrapFar, type Skin } from './stickerWrap'
import { finishUniforms, paintMotif, type FinishOverride } from './stickerFinish'

export interface StickerItem {
  placement: StickerPlacement
  def: StickerDef
}

export interface GhostSpec {
  def: StickerDef
  face: CardFace
  x: number
  y: number
  rot: number
  scale: number
  /** The copy being placed: its foil previews exactly as it will press (else a sample of the design). */
  uid?: string
}

const MARGIN = 0.085
const DAY = 86_400_000
/** Two years in the signal is a fully weathered sticker. */
const AGE_FULL_DAYS = 730
const GHOST = '__ghost__'

/** Face coords (0..1 over the printed card, from its top-left as seen) → face-view units. */
export function faceToUnits(x: number, y: number): [number, number] {
  return [(x - 0.5) * CARD_W, (0.5 - y) * CARD_H]
}

function strHash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function rng(seed: number) {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

interface Art {
  tex: THREE.CanvasTexture | null
  alpha: Uint8ClampedArray | null
  aw: number
  ah: number
  done: boolean
}

interface Sprite {
  uid: string
  def: StickerDef
  face: CardFace
  z: number
  wear: number
  /** It hangs past its face's flat: both halves drawn, the dense grid. */
  wraps: boolean
  /** Near half: the skin facing the camera. */
  body: THREE.Mesh
  /** Far half: the skin facing away, seen through the slab. */
  far: THREE.Mesh
  foot: THREE.Mesh
  /** Its own adaptive grid (null: the shared quad), and what it was built for. */
  own: THREE.BufferGeometry | null
  gridKey: string
  u: Record<string, THREE.IUniform>
  tweens: gsap.core.Tween[]
  /** When the placement left the world, it's finishing its last scrape. */
  leaving: boolean
}

/** One row of `__calcosGL.list()`. */
export interface CalcoDebugRow {
  uid: string
  id: string
  face: CardFace
  x: number
  y: number
  rot: number
  scale: number
  z: number
  material: string
  wraps: boolean
}

export class StickerLayer {
  readonly group = new THREE.Group()
  private grids = new Map<string, THREE.PlaneGeometry>()
  private skin: Skin
  private shared: Record<string, THREE.IUniform>
  private defines: Record<string, string | number>
  private sprites = new Map<string, Sprite>()
  /** The same sprites as a plain array, for the per-frame idle check. */
  private list: Sprite[] = []
  private arts = new Map<string, Art>()
  private motifs = new Map<string, THREE.CanvasTexture>()
  private artPx: number
  private synced = false
  private dirty = true
  private disposed = false
  private reduced: boolean
  private hover: string | null = null
  private selected: string | null = null
  private showingBack = false
  /** Near a quarter turn both faces are almost edge-on: every half is drawn. */
  private turning = false
  private nowMs = Date.now()
  private items: StickerItem[] = []
  private ghostUid: string | null = null
  // development only (window.__calcosGL)
  private forcedAll: FinishOverride | null = null
  private forced = new Map<string, FinishOverride>()
  private moved = new Map<string, Partial<StickerPlacement>>()
  private swapped = new Map<string, StickerDef>()
  private only: Set<string> | null = null
  private fixedAge: number | null = null
  private agedUid = new Map<string, number>()

  constructor(
    est: Estuche,
    shared: { uFade: THREE.IUniform; uMotion: THREE.IUniform; uInk: THREE.IUniform },
    opts: { reduced: boolean; artPx: number },
  ) {
    this.reduced = opts.reduced
    this.artPx = opts.artPx
    this.defines = { ...est.envDefines }
    this.skin = buildSkin()
    this.shared = {
      envMap: { value: est.env },
      uHolo: est.holo,
      uRough: est.rough,
      uBrushed: est.brushed,
      uFade: shared.uFade,
      uMotion: shared.uMotion,
      uInk: shared.uInk,
      uHalf: { value: new THREE.Vector3(CASE_HX, CASE_HY, CASE_HZ) },
      uCorner: { value: CASE_R },
      uMargin: { value: MARGIN },
      uPath: { value: this.skin.path },
      uPathInfo: { value: this.skin.info },
      uPathEnds: { value: this.skin.ends },
    }
    if (process.env.NODE_ENV !== 'production') registerDev(this)
  }

  setReduced(on: boolean) {
    this.reduced = on
  }

  setArtPx(px: number) {
    this.artPx = px
  }

  // ── state in ─────────────────────────────────────────────────────────────

  /** The owner's placements (any order); age is measured against `nowMs` (the world clock, coarse is fine). */
  sync(items: StickerItem[], nowMs: number) {
    this.items = items
    this.nowMs = nowMs
    const seen = new Set<string>()
    // One stack across both faces (a sticker that wraps meets the other
    // face's): bottom → top.
    const stack: StickerItem[] = []
    for (const it of items) {
      if (it.placement.face !== 'frente' && it.placement.face !== 'dorso') continue
      const uid = it.placement.uid
      if (this.only && !this.only.has(uid)) continue
      const m = this.moved.get(uid)
      const d = this.swapped.get(uid)
      stack.push(m || d ? { def: d ?? it.def, placement: m ? { ...it.placement, ...m } : it.placement } : it)
    }
    stack.sort((a, b) => a.placement.z - b.placement.z)
    stack.forEach((it, rank) => {
      const pl = it.placement
      seen.add(pl.uid)
      let s = this.sprites.get(pl.uid)
      const fresh = !s
      if (!s) s = this.make(pl.uid, it.def)
      s.leaving = false
      this.place(s, it.def, pl, rank)
      if (fresh) {
        s.u.uWear.value = pl.wear
        // Pressed just now (not merely loaded): it settles in, in steps.
        if (this.synced && !this.reduced && Date.now() - Date.parse(pl.at) < 120_000) this.pressIn(s)
        else s.u.uPress.value = 1
      } else if (pl.wear !== s.wear) this.scrapeTo(s, pl.wear)
      s.wear = pl.wear
    })
    for (const [uid, s] of this.sprites) {
      if (uid === GHOST || seen.has(uid) || s.leaving) continue
      // Scraped off for good: finish the last pass, then go.
      if (!this.reduced && s.wear >= 0.5) {
        s.leaving = true
        this.scrapeTo(s, 1, () => this.remove(uid))
      } else this.remove(uid)
    }
    this.synced = true
    this.applyMarks()
    this.applyOrder()
    this.dirty = true
  }

  setGhost(g: GhostSpec | null) {
    if (!g) {
      if (this.sprites.has(GHOST)) {
        this.remove(GHOST)
        this.dirty = true
      }
      return
    }
    let s = this.sprites.get(GHOST)
    const uid = g.uid ?? null
    if (s && (s.def.id !== g.def.id || uid !== this.ghostUid)) {
      this.remove(GHOST)
      s = undefined
    }
    this.ghostUid = uid
    if (!s) s = this.make(GHOST, g.def)
    s.face = g.face
    const u = s.u
    const [cx, cy] = faceToUnits(g.x, g.y)
    const w = g.def.size * g.scale * CARD_W
    const h = w / Math.max(0.1, g.def.aspect)
    ;(u.uCenter.value as THREE.Vector2).set(cx, cy)
    ;(u.uSize.value as THREE.Vector2).set(w, h)
    u.uRot.value = g.rot
    u.uFace.value = g.face === 'dorso' ? -1 : 1
    u.uLayer.value = 40
    u.uPress.value = 0
    u.uAge.value = 0
    u.uWear.value = 0
    u.uMark.value = 3
    ;(u.uPeelA.value as THREE.Vector4).set(0, 0, 0, 0)
    ;(u.uPeelB.value as THREE.Vector4).set(0, 0, 0, 0)
    this.applyFinish(s)
    this.fitGrid(s, cx, cy, w, h, g.rot)
    s.foot.renderOrder = 900
    s.body.renderOrder = 901
    s.far.renderOrder = 199
    this.applyVisibility()
    this.dirty = true
  }

  setHover(uid: string | null) {
    if (uid === this.hover) return
    this.hover = uid
    this.applyMarks()
    this.dirty = true
  }

  setSelected(uid: string | null) {
    if (uid === this.selected) return
    this.selected = uid
    this.applyMarks()
    this.dirty = true
  }

  /**
   * Which face is turned to the camera (called every frame, after the
   * scene's matrices update): it decides which halves are worth drawing.
   */
  setFacing(showingBack: boolean) {
    const e = this.group.matrixWorld.elements
    const az = e[10] / Math.max(1e-6, Math.hypot(e[8], e[9], e[10]))
    const turning = Math.abs(az) < 0.45
    if (showingBack === this.showingBack && turning === this.turning) return
    this.showingBack = showingBack
    this.turning = turning
    this.applyVisibility()
  }

  faceOf(uid: string): CardFace | null {
    return this.sprites.get(uid)?.face ?? null
  }

  // ── picking ──────────────────────────────────────────────────────────────

  /**
   * Topmost sticker under face coords (0..1 over the card as seen) on a
   * face — including the part of a sticker from the other face that wrapped
   * round onto this one.
   */
  pick(face: CardFace, x: number, y: number): string | null {
    const [fx, fy] = faceToUnits(x, y)
    let best: Sprite | null = null
    for (const s of this.sprites.values()) {
      if (s.uid === GHOST || s.leaving) continue
      if (best && s.z < best.z) continue
      let px = fx
      let py = fy
      if (s.face !== face) {
        if (!s.wraps) continue
        const p = unwrapFar(fx, fy, s.face, this.skin)
        if (!p) continue
        px = p[0]
        py = p[1]
      }
      const u = s.u
      const c = u.uCenter.value as THREE.Vector2
      const size = u.uSize.value as THREE.Vector2
      const r = u.uRot.value as number
      const dx = px - c.x
      const dy = py - c.y
      // undo the clockwise rotation
      const cs = Math.cos(r)
      const sn = Math.sin(r)
      const lx = dx * cs - dy * sn
      const ly = dx * sn + dy * cs
      const ux = lx / size.x + 0.5
      const uy = ly / size.y + 0.5
      if (ux < 0 || ux > 1 || uy < 0 || uy > 1) continue
      const art = this.arts.get(s.def.id)
      if (art?.alpha) {
        const ix = Math.min(art.aw - 1, Math.floor(ux * art.aw))
        const iy = Math.min(art.ah - 1, Math.floor((1 - uy) * art.ah))
        if (art.alpha[iy * art.aw + ix] < 100) continue
      }
      best = s
    }
    return best?.uid ?? null
  }

  // ── frame ────────────────────────────────────────────────────────────────

  /** Polled every frame by the engine, even at rest: no allocations here. */
  isIdle(): boolean {
    if (this.dirty) return false
    const list = this.list
    for (let i = 0; i < list.length; i++) {
      const tw = list[i].tweens
      for (let j = 0; j < tw.length; j++) if (tw[j].isActive()) return false
    }
    return true
  }

  /** Called by the scene each rendered frame. */
  frame() {
    this.dirty = false
  }

  dispose() {
    this.disposed = true
    unregisterDev(this)
    for (const uid of [...this.sprites.keys()]) this.remove(uid)
    this.arts.forEach((a) => a.tex?.dispose())
    this.arts.clear()
    this.motifs.forEach((t) => t.dispose())
    this.motifs.clear()
    this.grids.forEach((g) => g.dispose())
    this.grids.clear()
  }

  // ── development (window.__calcosGL) ──────────────────────────────────────

  /** Force a finish on every sticker (or on `uids`); null restores the catalog's. */
  debugForce(f: FinishOverride | null, uids?: string[]) {
    if (uids) {
      for (const uid of uids) {
        if (f) this.forced.set(uid, f)
        else this.forced.delete(uid)
      }
    } else {
      this.forcedAll = f
      if (!f) this.forced.clear()
    }
    this.resync()
  }

  /** Move a placement for a test (null: back to the world's). */
  debugPlace(uid: string, p: Partial<StickerPlacement> | null) {
    if (p) this.moved.set(uid, { ...(this.moved.get(uid) ?? {}), ...p })
    else this.moved.delete(uid)
    this.resync()
  }

  /** Age every sticker (or only `uids`) at 0..1 (null: their real age). */
  debugAge(a: number | null, uids?: string[]) {
    if (uids) {
      for (const uid of uids) {
        if (a === null) this.agedUid.delete(uid)
        else this.agedUid.set(uid, a)
      }
    } else this.fixedAge = a
    this.resync()
  }

  /** Print another design on a placement (null: its own). */
  debugDef(uid: string, def: StickerDef | null) {
    if (def) this.swapped.set(uid, def)
    else this.swapped.delete(uid)
    this.resync()
  }

  /** Show only these placements (null: all). */
  debugOnly(uids: string[] | null) {
    this.only = uids ? new Set(uids) : null
    this.resync()
  }

  debugReset() {
    this.forcedAll = null
    this.forced.clear()
    this.moved.clear()
    this.swapped.clear()
    this.only = null
    this.fixedAge = null
    this.agedUid.clear()
    this.resync()
  }

  debugList(): CalcoDebugRow[] {
    const out: CalcoDebugRow[] = []
    for (const it of this.items) {
      const s = this.sprites.get(it.placement.uid)
      const p = { ...it.placement, ...(this.moved.get(it.placement.uid) ?? {}) }
      out.push({
        uid: p.uid,
        id: it.def.id,
        face: p.face,
        x: p.x,
        y: p.y,
        rot: p.rot,
        scale: p.scale,
        z: p.z,
        material: it.def.material,
        wraps: Boolean(s?.wraps),
      })
    }
    return out.sort((a, b) => a.z - b.z)
  }

  debugDefs(): StickerDef[] {
    return this.items.map((it) => it.def)
  }

  private resync() {
    if (this.disposed) return
    this.sync(this.items, this.nowMs)
  }

  // ── internals ────────────────────────────────────────────────────────────

  private grid(sx: number, sy: number): THREE.PlaneGeometry {
    const key = `${sx}x${sy}`
    let g = this.grids.get(key)
    if (!g) {
      g = new THREE.PlaneGeometry(1, 1, sx, sy)
      this.grids.set(key, g)
    }
    return g
  }

  /**
   * The grid a sticker needs where it is: a flat, uncurled one is a quad;
   * otherwise an adaptive grid — fine only where it bends round the edge
   * (along the axis that crosses the fold), medium over a curling corner,
   * coarse on the flat (stickerWrap.gridLines).
   */
  private fitGrid(s: Sprite, cx: number, cy: number, w: number, h: number, rot: number) {
    const ext = 1 + 2 * MARGIN
    s.wraps = reachesEdge(cx, cy, w * ext * 1.03, h * ext * 1.03, rot, s.face, this.skin)
    const A = s.u.uPeelA.value as THREE.Vector4
    const B = s.u.uPeelB.value as THREE.Vector4
    let geo: THREE.BufferGeometry
    let key: string
    if (!s.wraps && A.w <= 0 && B.w <= 0) {
      geo = this.grid(1, 1)
      key = 'quad'
    } else {
      const peels = [A, B].filter((p) => p.w > 0).map((p) => [p.x, p.y, p.z, p.w] as const)
      const { xs, ys } = gridLines({ cx, cy, w: w * ext, h: h * ext, rot, face: s.face, peels }, this.skin)
      key = `${xs.map((v) => v.toFixed(4)).join(',')}|${ys.map((v) => v.toFixed(4)).join(',')}`
      if (key === s.gridKey) return
      geo = gridGeometry(xs, ys)
    }
    if (key === s.gridKey) return
    s.gridKey = key
    if (s.own) s.own.dispose()
    s.own = key === 'quad' ? null : geo
    s.body.geometry = geo
    s.far.geometry = geo
    s.foot.geometry = geo
  }

  private make(uid: string, def: StickerDef): Sprite {
    const u: Record<string, THREE.IUniform> = {
      ...this.shared,
      uArt: { value: null },
      uArtB: { value: null },
      uMotif: { value: null },
      uArtOk: { value: 0 },
      uArtPx: { value: new THREE.Vector2(512, 512) },
      uCenter: { value: new THREE.Vector2() },
      uRot: { value: 0 },
      uSize: { value: new THREE.Vector2(0.3, 0.3) },
      uFace: { value: 1 },
      uLayer: { value: 0 },
      uPeelA: { value: new THREE.Vector4() },
      uPeelB: { value: new THREE.Vector4() },
      uPress: { value: 1 },
      uAge: { value: 0 },
      uWear: { value: 0 },
      uSeed: { value: 0 },
      uMat: { value: 0 },
      uKind: { value: 0 },
      uRel: { value: 0 },
      uMetal: { value: new THREE.Vector4(0.93, 0.94, 0.96, 0.5) },
      uFoilA: { value: new THREE.Vector4(0, 1, 0, 0.5) },
      uFoilB: { value: new THREE.Vector4(0.5, 0.5, 0, 0.5) },
      uMark: { value: 0 },
    }
    const material = (fragmentShader: string, pass: number, foot: boolean) =>
      new THREE.ShaderMaterial({
        vertexShader: stickerVertex,
        fragmentShader,
        // one uniform record per half: all shared but the pass
        uniforms: { ...u, uPass: { value: pass } },
        defines: foot ? { ...this.defines, FOOTPRINT: '' } : this.defines,
        transparent: true,
        premultipliedAlpha: true,
        depthTest: true,
        // A curled corner overlaps itself: depth sorts the roll (stickers
        // are drawn bottom-up, so stacking still reads by z).
        depthWrite: !foot,
        side: foot ? THREE.FrontSide : THREE.DoubleSide,
      })
    const grid = this.grid(1, 1)
    const body = new THREE.Mesh(grid, material(stickerFragment, 0, false))
    const far = new THREE.Mesh(grid, material(stickerFragment, 1, false))
    const foot = new THREE.Mesh(grid, material(footprintFragment, 0, true))
    body.frustumCulled = false
    far.frustumCulled = false
    foot.frustumCulled = false
    // The near halves stack by draw order (bottom → top): a lower sticker's
    // curled corner is held down by the one pressed over it. Depth only
    // sorts a sticker against itself, so it starts fresh for each (the near
    // half is the skin facing the camera: nothing else can be in front).
    // Far halves keep the card's depth: the card hides them.
    foot.onBeforeRender = (renderer) => renderer.clearDepth()
    this.group.add(far, foot, body)
    const s: Sprite = { uid, def, face: 'frente', z: 0, wear: -1, wraps: false, body, far, foot, own: null, gridKey: 'quad', u, tweens: [], leaving: false }
    this.sprites.set(uid, s)
    this.list.push(s)
    this.loadArt(def, s, 'a')
    return s
  }

  private remove(uid: string) {
    const s = this.sprites.get(uid)
    if (!s) return
    s.tweens.forEach((t) => t.kill())
    this.group.remove(s.body, s.far, s.foot)
    ;(s.body.material as THREE.Material).dispose()
    ;(s.far.material as THREE.Material).dispose()
    ;(s.foot.material as THREE.Material).dispose()
    s.own?.dispose()
    this.sprites.delete(uid)
    const i = this.list.indexOf(s)
    if (i >= 0) this.list.splice(i, 1)
    if (this.hover === uid) this.hover = null
  }

  private loadArt(def: StickerDef, s: Sprite, frame: 'a' | 'b') {
    const px = Math.min(512, this.artPx)
    const key = frame === 'b' ? `${def.id}#b` : def.id
    const slot = frame === 'b' ? 'uArtB' : 'uArt'
    const have = this.arts.get(key)
    if (have) {
      if (have.done && have.tex) {
        s.u[slot].value = have.tex
        if (frame === 'a') {
          s.u.uArtOk.value = 1
          ;(s.u.uArtPx.value as THREE.Vector2).set(have.tex.image.width, have.tex.image.height)
        }
      }
      return
    }
    const art: Art = { tex: null, alpha: null, aw: 0, ah: 0, done: false }
    this.arts.set(key, art)
    stickerArt(def, px, frame)
      .then((canvas) => {
        if (this.disposed) return
        const tex = new THREE.CanvasTexture(canvas)
        tex.colorSpace = THREE.NoColorSpace
        tex.premultiplyAlpha = true
        tex.generateMipmaps = true
        tex.minFilter = THREE.LinearMipmapLinearFilter
        tex.magFilter = THREE.LinearFilter
        tex.anisotropy = 4
        tex.needsUpdate = true
        art.tex = tex
        // A small alpha map for picking (die-cut, not the bounding box).
        if (frame === 'a') {
          try {
            const aw = 64
            const ah = Math.max(4, Math.round(64 / Math.max(0.2, def.aspect)))
            const c = document.createElement('canvas')
            c.width = aw
            c.height = ah
            const x = c.getContext('2d', { willReadFrequently: true })
            if (x) {
              x.drawImage(canvas, 0, 0, aw, ah)
              const data = x.getImageData(0, 0, aw, ah).data
              const alpha = new Uint8ClampedArray(aw * ah)
              for (let i = 0; i < aw * ah; i++) alpha[i] = data[i * 4 + 3]
              art.alpha = alpha
              art.aw = aw
              art.ah = ah
            }
          } catch {
            /* picking falls back to the rectangle */
          }
        }
        art.done = true
        for (const sp of this.sprites.values()) {
          if (sp.def.id !== def.id) continue
          sp.u[slot].value = tex
          if (frame === 'a') {
            sp.u.uArtOk.value = 1
            ;(sp.u.uArtPx.value as THREE.Vector2).set(canvas.width, canvas.height)
          }
        }
        this.dirty = true
      })
      .catch(() => {
        art.done = true
      })
  }

  /** The code's letters for 'motivo' · código, once per design. */
  private motif(def: StickerDef): THREE.CanvasTexture {
    let t = this.motifs.get(def.id)
    if (!t) {
      t = new THREE.CanvasTexture(paintMotif(def.art.code))
      t.colorSpace = THREE.NoColorSpace
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.generateMipmaps = true
      t.minFilter = THREE.LinearMipmapLinearFilter
      t.magFilter = THREE.LinearFilter
      t.anisotropy = 4
      t.needsUpdate = true
      this.motifs.set(def.id, t)
    }
    return t
  }

  /** The finish of this copy (the catalog's, or a forced one in development). */
  private applyFinish(s: Sprite) {
    const u = s.u
    const over = this.forced.get(s.uid) ?? this.forcedAll
    // A copy is seeded by its uid; a ghost without one shows the shelf's sample (finish.ts sampleSeed).
    const seedKey = s.uid === GHOST ? (this.ghostUid ?? `muestra:${designOf(s.def)}`) : s.uid
    const f = finishUniforms(s.def, seedKey, over)
    u.uMat.value = f.mat
    u.uKind.value = f.kind
    u.uRel.value = f.rel
    u.uSeed.value = f.seed
    ;(u.uMetal.value as THREE.Vector4).set(f.metal[0], f.metal[1], f.metal[2], f.metal[3])
    ;(u.uFoilA.value as THREE.Vector4).set(f.foilA[0], f.foilA[1], f.foilA[2], f.foilA[3])
    ;(u.uFoilB.value as THREE.Vector4).set(f.foilB[0], f.foilB[1], f.foilB[2], f.foilB[3])
    if (f.finish.material === 'lenticular') this.loadArt(s.def, s, 'b')
    if (f.finish.holo === 'motivo' && f.layout.motif === 2) u.uMotif.value = this.motif(s.def)
  }

  private place(s: Sprite, def: StickerDef, pl: StickerPlacement, rank: number) {
    if (s.def.id !== def.id) {
      s.def = def
      s.u.uArtOk.value = 0
      this.loadArt(def, s, 'a')
    }
    s.def = def
    s.face = pl.face
    s.z = pl.z
    const u = s.u
    const [cx, cy] = faceToUnits(pl.x, pl.y)
    const w = def.size * pl.scale * CARD_W
    const h = w / Math.max(0.1, def.aspect)
    ;(u.uCenter.value as THREE.Vector2).set(cx, cy)
    ;(u.uSize.value as THREE.Vector2).set(w, h)
    u.uRot.value = pl.rot
    u.uFace.value = pl.face === 'dorso' ? -1 : 1
    u.uLayer.value = rank
    const days = Math.max(0, (this.nowMs - Date.parse(pl.at)) / DAY)
    const age = this.agedUid.get(pl.uid) ?? this.fixedAge ?? Math.min(1, days / AGE_FULL_DAYS)
    u.uAge.value = age
    this.peel(s, def, w, h, age, cx, cy, pl.rot)
    this.applyFinish(s)
    this.fitGrid(s, cx, cy, w, h, pl.rot)
  }

  /**
   * Corners lift with age: a line across the corner, the rest curls over.
   * Only a corner lying on the sticker's own flat lifts — one that went
   * round the edge is held by the wrap.
   */
  private peel(s: Sprite, def: StickerDef, w: number, h: number, age: number, cx: number, cy: number, rot: number) {
    const A = s.u.uPeelA.value as THREE.Vector4
    const B = s.u.uPeelB.value as THREE.Vector4
    A.set(0, 0, 0, 0)
    B.set(0, 0, 0, 0)
    const amt = smooth(0.16, 1, age)
    if (amt <= 0) return
    const r = rng(strHash(s.uid + ':peel'))
    const round = (def.form === 'circulo' || def.form === 'sello') && Math.abs(def.aspect - 1) < 0.15
    const short = Math.min(w, h)
    const c = Math.cos(rot)
    const sn = Math.sin(rot)
    const flat = (lx: number, ly: number) => onFlat(lx * c + ly * sn + cx, -lx * sn + ly * c + cy, s.face, this.skin, 0.01)
    const corner = (k: number): [number, number, number] => {
      if (round) {
        const a = r() * Math.PI * 2
        return [Math.cos(a), Math.sin(a), short / 2]
      }
      const sx = k & 1 ? 1 : -1
      const sy = k & 2 ? 1 : -1
      const len = Math.hypot(w / 2, h / 2)
      return [(sx * w) / 2 / len, (sy * h) / 2 / len, len]
    }
    // The first corner (in the seeded order) that is on the flat.
    const pick = (from: number, skip: number): [number, number, number, number] | null => {
      for (let j = 0; j < 4; j++) {
        const k = (from + j) % 4
        if (k === skip) continue
        const [dx, dy, e] = corner(k)
        if (flat(dx * e, dy * e)) return [dx, dy, e, k]
      }
      return null
    }
    const first = pick(Math.floor(r() * 4), -1)
    if (!first) return
    const [dx, dy, e, k0] = first
    const len = short * (0.08 + 0.24 * amt) * (0.65 + 0.7 * r())
    // The older, the tighter the roll: the tip turns past a quarter turn
    // (~115° at mid-age, ~155° at two years) and the white backing shows.
    A.set(dx, dy, e - len, len / (1.4 + 1.3 * amt))
    if (amt > 0.5 && r() > 0.4) {
      const second = pick((k0 + 1 + Math.floor(r() * 3)) % 4, round ? -1 : k0)
      if (!second) return
      const [ex, ey, e2] = second
      const len2 = len * (0.45 + 0.4 * r())
      B.set(ex, ey, e2 - len2, len2 / 1.8)
    }
  }

  private pressIn(s: Sprite) {
    s.u.uPress.value = 0
    s.tweens = s.tweens.filter((t) => t.isActive())
    s.tweens.push(gsap.to(s.u.uPress, { value: 1, duration: 0.42, ease: 'steps(4)', delay: 0.05 }))
  }

  /** One pass of the scraper: the damage opens in steps. */
  private scrapeTo(s: Sprite, to: number, done?: () => void) {
    s.tweens = s.tweens.filter((t) => t.isActive())
    if (this.reduced) {
      s.u.uWear.value = to
      this.dirty = true
      done?.()
      return
    }
    s.tweens.push(gsap.to(s.u.uWear, { value: to, duration: 0.3, ease: 'steps(3)', onComplete: done }))
  }

  private applyMarks() {
    for (const s of this.sprites.values()) {
      if (s.uid === GHOST) continue
      s.u.uMark.value = s.uid === this.selected ? 2 : s.uid === this.hover ? 1 : 0
    }
  }

  private applyOrder() {
    for (const s of this.list) {
      if (s.uid === GHOST) continue
      const rank = s.u.uLayer.value as number
      s.foot.renderOrder = 300 + rank * 2
      s.body.renderOrder = 301 + rank * 2
      // Seen through the slab the stack reads from the case outward: the
      // top of the stack is drawn first, the sticker nearest the acrylic last.
      s.far.renderOrder = 100 + Math.max(0, 95 - rank)
    }
    this.applyVisibility()
    this.dirty = true
  }

  /** Only the halves that can show: a sticker's own face if it's turned to us, both if it wraps (or mid-turn). */
  private applyVisibility() {
    for (const s of this.list) {
      const own = (s.face === 'dorso') === this.showingBack
      const near = own || s.wraps || this.turning
      s.body.visible = near
      s.foot.visible = near
      s.far.visible = !own || s.wraps || this.turning
    }
  }
}

// ── development: window.__calcosGL ────────────────────────────────────────

const live = new Set<StickerLayer>()

interface CalcosGLDev {
  /** Force a finish on every live case's stickers (or only `uids`); null: the catalog's again. */
  force: (f: FinishOverride | null, uids?: string[]) => number
  /** Move a placement for a test (x/y in face coords, may run past 0..1); null restores it. */
  place: (uid: string, p: Partial<StickerPlacement> | null) => number
  /** Age every sticker (or only `uids`) at 0..1 (null: their real age). */
  age: (a: number | null, uids?: string[]) => number
  /** Print another design (a StickerDef, e.g. from __calcos.defs()) on a placement; null: its own. */
  design: (uid: string, def: StickerDef | null) => number
  /** Show only these placements (null: all). */
  only: (uids: string[] | null) => number
  reset: () => number
  list: () => CalcoDebugRow[]
  /** The designs on the live cases (for `design`). */
  defs: () => StickerDef[]
}

function registerDev(layer: StickerLayer) {
  live.add(layer)
  if (typeof window === 'undefined') return
  const dev: CalcosGLDev = {
    force: (f, uids) => {
      live.forEach((l) => l.debugForce(f, uids))
      return live.size
    },
    place: (uid, p) => {
      live.forEach((l) => l.debugPlace(uid, p))
      return live.size
    },
    age: (a, uids) => {
      live.forEach((l) => l.debugAge(a, uids))
      return live.size
    },
    design: (uid, def) => {
      live.forEach((l) => l.debugDef(uid, def))
      return live.size
    },
    only: (uids) => {
      live.forEach((l) => l.debugOnly(uids))
      return live.size
    },
    reset: () => {
      live.forEach((l) => l.debugReset())
      return live.size
    },
    list: () => [...live].flatMap((l) => l.debugList()),
    defs: () => [...new Map([...live].flatMap((l) => l.debugDefs()).map((d) => [d.id, d])).values()],
  }
  ;(window as unknown as { __calcosGL?: CalcosGLDev }).__calcosGL = dev
}

function unregisterDev(layer: StickerLayer) {
  live.delete(layer)
}
