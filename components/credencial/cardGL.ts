/**
 * The Credencial as a stage window: the printed card inside its collector's
 * case, the stickers pressed onto the case, two hard shadows.
 *
 * Motion is physical and only answers to people:
 *   · the pointer leans it a little, through a loose damped spring (a case
 *     held loosely)
 *   · press and drag turns it by hand — across, it yaws freely, through
 *     edge-on to the back and beyond; up and down, it pitches within ±30°
 *     (rubber-banded)
 *   · let go and it slings to the nearest face — the release speed can
 *     carry it over — on a strong underdamped spring: a snap, an overshoot,
 *     a couple of wobbles, rest
 *   · a click turns it over the same way (the target glides to the other
 *     face and the spring lands it)
 * There is no idle animation — at rest the picture is still and the window
 * reports idle (the foil is faint, the studio reflection frozen). Reduced
 * motion: no lean, the drag follows the hand exactly, a release or a flip
 * lands at once, stickers press in at once.
 *
 * Through the slab the inside is seen at its apparent depth (flat acrylic
 * makes what's under it look shallower, by 1/n): the card is drawn
 * compressed toward the face you look through, and the case shader traces
 * the pocket and the frosted band in the same compressed space — card,
 * pocket walls and frost stay in register as it turns.
 *
 * Draw order: pass 1 (layer 1) the shadows on the page — the case's, light,
 * and the card's, ink; pass 2 the card (opaque), the far face's stickers
 * (seen from behind, through the acrylic), the case, the near face's
 * stickers, the editor's ghost.
 */

import * as THREE from 'three'
import gsap from 'gsap'
import type { Role } from '@/lib/types'
import type { CardFace } from '@/lib/stickers/types'
import type { WindowRenderContext } from '@/components/stage/engine'
import { cardFragment, cardVertex, shadowFragment, shadowVertex } from './cardShader'
import { caseFragment, caseVertex } from './caseShader'
import { acquireEstuche, releaseEstuche, type Estuche } from './estuche'
import { foilFor } from './foils'
import { StickerLayer, type GhostSpec, type StickerItem } from './stickerGL'
import {
  CARD_DEPTH,
  CARD_FRAC,
  CARD_H,
  CARD_W,
  CASE_FILLET,
  CASE_HX,
  CASE_HY,
  CASE_HZ,
  CASE_R,
  EDGE_PATH,
  FROST_INSET,
  GL_BLEED_Y,
  LOOK_BLEED_X,
  LOOK_BLEED_Y,
  outlineDistance,
  POCKET_HX,
  POCKET_HY,
  POCKET_HZ,
  POCKET_R,
} from './geometry'
import { cardStock } from './data'
import { hexRGBA, paletteNow, unit } from './cssColor'

export { CARD_FRAC }

const FOV = 17 // a longer lens: turned edge-on, the near edge swells only so much
const RADIUS = 0.006 // a cut card: square, the corner only just eased
const TILT_Y = 0.2 // rad, pointer x → yaw (the lean)
const TILT_X = 0.15 // rad, pointer y → pitch
/** While the Taller edits the case the card barely leans (the face stays readable). */
const EDIT_TILT = 0.16
const SHADOW_PX = 4 // the one permitted shadow: hard, ink, offset
const LAYER_SHADOW = 1
const ETA = 1.49 // acrylic

// The springs (semi-implicit Euler, 240 Hz substeps).
/** The object follows the hand: stiff, critically damped (~30 ms behind). */
const K_HAND = 900
/** The lean toward the pointer: loose, a touch of overshoot. */
const K_LEAN = 60
const Z_LEAN = 0.6
/** The sling: strong and underdamped — ~2.7 Hz (under 3), a 20° overshoot from a 70° release, two or three wobbles, rest in about a second. */
const K_SLING = 300
const Z_SLING = 0.33
const SUB = 1 / 240
/** Pitch is held within ±30° (rubber-banded past it). */
const PITCH_MAX = 0.52
/** Seconds of release speed that count toward choosing the face (a fling carries it over). */
const FLING_T = 0.16
/** The most spin a release carries into the sling (rad/s). */
const MAX_SPIN = 7
/** It backs off a little while edge-on (the near edge swells in perspective). */
const DOLLY = 0.12
/** The click flip: the target glides to the other face, the sling lands it. */
const GLIDE_S = 0.46

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** The board: a rectangle, its corners only just eased, cut clean — flat walls, so the triplex shows at the edge. */
function cardGeometry(): THREE.BufferGeometry {
  const hx = CARD_W / 2
  const hy = CARD_H / 2
  const r = RADIUS
  const s = new THREE.Shape()
  s.moveTo(-hx + r, -hy)
  s.lineTo(hx - r, -hy)
  s.absarc(hx - r, -hy + r, r, -Math.PI / 2, 0, false)
  s.lineTo(hx, hy - r)
  s.absarc(hx - r, hy - r, r, 0, Math.PI / 2, false)
  s.lineTo(-hx + r, hy)
  s.absarc(-hx + r, hy - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(-hx, -hy + r)
  s.absarc(-hx + r, -hy + r, r, Math.PI, Math.PI * 1.5, false)
  const g = new THREE.ExtrudeGeometry(s, { depth: CARD_DEPTH, bevelEnabled: false, curveSegments: 3, steps: 1 })
  g.translate(0, 0, -CARD_DEPTH / 2)
  // Planar UVs: the flat faces print edge to edge, the shader picks the side.
  const pos = g.attributes.position as THREE.BufferAttribute
  const uv = g.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / CARD_W + 0.5, pos.getY(i) / CARD_H + 0.5)
  uv.needsUpdate = true
  return g
}

const CORNER_SEGS = 12

/** The outline at its widest point, sampled counter-clockwise: [x, y, nx, ny] (a point, its outward normal). */
function outlineSamples(): Array<[number, number, number, number]> {
  const cx = CASE_HX - CASE_R
  const cy = CASE_HY - CASE_R
  const centres: Array<[number, number]> = [
    [cx, cy],
    [-cx, cy],
    [-cx, -cy],
    [cx, -cy],
  ]
  const out: Array<[number, number, number, number]> = []
  centres.forEach(([ox, oy], q) => {
    for (let i = 0; i <= CORNER_SEGS; i++) {
      const a = ((q + i / CORNER_SEGS) * Math.PI) / 2
      const nx = Math.cos(a)
      const ny = Math.sin(a)
      out.push([ox + CASE_R * nx, oy + CASE_R * ny, nx, ny])
    }
  })
  return out
}

/**
 * The case's outer skin: EDGE_PATH swept round the outline (the section at
 * each inset is the outline offset inward — the same contract the stickers
 * wrap by, so they lie exactly on it), and the two flat faces as fans. The
 * normals are the profile's own, so the fillets shade round.
 */
function caseGeometry(): THREE.BufferGeometry {
  const ring = outlineSamples()
  const K = ring.length
  const P = EDGE_PATH.length
  // The profile's normal (outward, z): its tangent turned a quarter; the ends meet the faces.
  const pn = EDGE_PATH.map((_, j): [number, number] => {
    if (j === 0) return [0, 1]
    if (j === P - 1) return [0, -1]
    const a = EDGE_PATH[j - 1]
    const b = EDGE_PATH[j + 1]
    const to = a.inset - b.inset
    const tz = b.z - a.z
    const l = Math.hypot(to, tz) || 1
    return [-tz / l, to / l]
  })
  const pos: number[] = []
  const nrm: number[] = []
  const idx: number[] = []
  for (let k = 0; k < K; k++) {
    const [x, y, nx, ny] = ring[k]
    for (let j = 0; j < P; j++) {
      const { inset, z } = EDGE_PATH[j]
      pos.push(x - inset * nx, y - inset * ny, z)
      nrm.push(pn[j][0] * nx, pn[j][0] * ny, pn[j][1])
    }
  }
  for (let k = 0; k < K; k++) {
    const k1 = (k + 1) % K
    for (let j = 0; j < P - 1; j++) {
      const a = k * P + j
      const b = k1 * P + j
      const c = k * P + j + 1
      const d = k1 * P + j + 1
      idx.push(a, c, b, b, c, d)
    }
  }
  const face = (j: number, sz: 1 | -1) => {
    const base = pos.length / 3
    const { inset, z } = EDGE_PATH[j]
    pos.push(0, 0, z)
    nrm.push(0, 0, sz)
    for (let k = 0; k < K; k++) {
      const [x, y, nx, ny] = ring[k]
      pos.push(x - inset * nx, y - inset * ny, z)
      nrm.push(0, 0, sz)
    }
    for (let k = 0; k < K; k++) {
      const a = base + 1 + k
      const b = base + 1 + ((k + 1) % K)
      if (sz > 0) idx.push(base, a, b)
      else idx.push(base, b, a)
    }
  }
  face(0, 1)
  face(P - 1, -1)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}

function canvasTexture(c: HTMLCanvasElement, aniso: number): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.NoColorSpace
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.magFilter = THREE.LinearFilter
  t.generateMipmaps = true
  t.anisotropy = aniso
  t.needsUpdate = true
  return t
}

function setHex(v: THREE.Vector3, hex: string) {
  const [r, g, b] = unit(hexRGBA(hex))
  v.set(r, g, b)
}

export interface FaceHit {
  face: CardFace
  /** 0..1 over the printed card, from its top-left as seen (runs past 0..1 on the case's margin). */
  x: number
  y: number
  /** The point is on the case (inside its outline, not beside it). */
  onCase: boolean
}

interface Hand {
  yaw0: number
  pitch0: number
  yaw: number
  pitch: number
  /** Hand speed, rad/s (smoothed over ~50 ms of events). */
  v: number
  vp: number
  /** Last event, ms. */
  t: number
}

export class CardScene {
  ready = false
  /** Development only (headless checks): hold the foil's motion at a value. */
  debugMotion: number | null = null
  /** Development only (headless checks): hold a pose (radians). */
  debugPose: { yaw: number; pitch: number } | null = null
  /** Development only (headless checks): run the springs slower (1 = real time). */
  debugSpeed = 1
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(FOV, CARD_W / CARD_H, 0.1, 40)
  private pivot = new THREE.Group()
  private flipper = new THREE.Group()
  private est: Estuche
  private cardGeo: THREE.BufferGeometry
  private caseGeo: THREE.BufferGeometry
  private material: THREE.ShaderMaterial
  private caseMaterial: THREE.ShaderMaterial
  private cardShadow: THREE.ShaderMaterial
  private caseShadow: THREE.ShaderMaterial
  private caseEraser: THREE.ShaderMaterial
  private stickers: StickerLayer
  private print: THREE.CanvasTexture | null = null
  private relief: THREE.CanvasTexture | null = null
  private label: THREE.CanvasTexture | null = null
  private aniso: number
  private reduced: boolean
  private lastAspect = 0
  private dirty = true
  private editing = false
  private back = false
  private onEst = () => {
    this.dirty = true
  }

  // shared uniforms (one object, many materials)
  private uFade = { value: 1 }
  private uMotion = { value: 0 }
  /** The page's ink: shadows and the stickers' marks (not the card's own ink). */
  private uInk = { value: new THREE.Vector3(0.07, 0.07, 0.07) }
  private uTime = { value: 0 }
  private uOffset = { value: new THREE.Vector2() }
  private uStock = { value: new THREE.Vector3(1, 0.77, 0) }
  private uCore = { value: new THREE.Vector3(0.07, 0.07, 0.07) }
  /** The face the inside is seen through (±1, object z), and its apparent-depth factor. */
  private uSide = { value: 1 }
  private uDepthK = { value: 1 / ETA }
  private camObj = new THREE.Vector3()
  private faceW = new THREE.Vector3()

  // motion
  private yaw = 0
  private vyaw = 0
  private pitch = 0
  private vpitch = 0
  /** The face it rests on: a multiple of π (odd = the back). */
  private rest = 0
  private sling = false
  private glide = { y: 0, on: false }
  private glideTween: gsap.core.Tween | null = null
  private hand: Hand | null = null
  private lean = 0
  private target = { x: 0, y: 0 }
  private hover = 0
  private hoverTarget = 0
  private motion = 0
  private arriveState = { a: 1 }
  private tweens: gsap.core.Tween[] = []

  // picking (reused)
  private raycaster = new THREE.Raycaster()
  private ndc = new THREE.Vector2()
  private inv = new THREE.Matrix4()
  private ray = new THREE.Ray()
  private tmp = new THREE.Vector3()

  constructor(renderer: THREE.WebGLRenderer, opts: { reduced: boolean; artPx?: number }) {
    this.reduced = opts.reduced
    this.aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy())
    this.est = acquireEstuche(renderer)
    this.est.onChange.add(this.onEst)
    this.cardGeo = cardGeometry()
    this.caseGeo = caseGeometry()
    const env = { value: this.est.env }

    this.material = new THREE.ShaderMaterial({
      vertexShader: cardVertex,
      fragmentShader: cardFragment,
      defines: { ...this.est.envDefines },
      uniforms: {
        uPrint: { value: null },
        uRelief: { value: null },
        uHolo: this.est.holo,
        uBrushed: this.est.brushed,
        envMap: env,
        uReliefTexel: { value: new THREE.Vector2(1 / 512, 1 / 512) },
        uPrintTexel: { value: new THREE.Vector2(1 / 1024, 1 / 1024) },
        uStock: this.uStock,
        uInkCol: { value: new THREE.Vector3(0.07, 0.07, 0.07) },
        uCore: this.uCore,
        uHover: { value: 0 },
        uFade: this.uFade,
        uBump: { value: 1.7 },
        uDeboss: { value: 0.55 },
        uMotion: this.uMotion,
        uTime: this.uTime,
        uFoil: { value: 0 },
        uPhase: { value: 0 },
        uSpread: { value: 1 },
        uRest: { value: 0.62 },
        uAspect: { value: CARD_W / CARD_H },
        uSide: this.uSide,
        uDepthK: this.uDepthK,
        uHZ: { value: CASE_HZ },
        uHalfDepth: { value: CARD_DEPTH / 2 },
      },
      depthTest: true,
      depthWrite: true,
      side: THREE.FrontSide,
    })

    this.caseMaterial = new THREE.ShaderMaterial({
      vertexShader: caseVertex,
      fragmentShader: caseFragment,
      defines: { ...this.est.envDefines },
      uniforms: {
        envMap: env,
        uRough: this.est.rough,
        uLabel: { value: null },
        uLabelOk: { value: 0 },
        uLabelRect: { value: new THREE.Vector4(-POCKET_HX, -(CASE_HY - FROST_INSET), POCKET_HX, -POCKET_HY) },
        uGround: { value: new THREE.Vector3(0.93, 0.92, 0.89) },
        uCamObj: { value: this.camObj },
        uFaceW: { value: this.faceW },
        uHalf: { value: new THREE.Vector3(CASE_HX, CASE_HY, CASE_HZ) },
        uCorner: { value: CASE_R },
        uFillet: { value: CASE_FILLET },
        uFrostInset: { value: FROST_INSET },
        uPocket: { value: new THREE.Vector4(POCKET_HX, POCKET_HY, POCKET_HZ, POCKET_R) },
        uCardHalf: { value: new THREE.Vector3(CARD_W / 2, CARD_H / 2, CARD_DEPTH / 2) },
        uStock: this.uStock,
        uCore: this.uCore,
        uSide: this.uSide,
        uDepthK: this.uDepthK,
        uScuff: { value: 0.5 },
        uFade: this.uFade,
        uTilt: { value: 0 },
      },
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: THREE.FrontSide,
    })

    const shadowMat = (alpha: number, offset: boolean) =>
      new THREE.ShaderMaterial({
        vertexShader: shadowVertex,
        fragmentShader: shadowFragment,
        uniforms: { uOffset: offset ? this.uOffset : { value: new THREE.Vector2() }, uInk: this.uInk, uAlpha: { value: alpha }, uFade: this.uFade },
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.FrontSide,
      })
    // The case casts a light shadow — only where it isn't itself (like a
    // box-shadow; seen through the acrylic it would cloud it) — and the
    // card inside an ink one, seen through the clear parts.
    this.caseShadow = shadowMat(0.16, true)
    this.caseEraser = shadowMat(0, false)
    this.caseEraser.blending = THREE.CustomBlending
    this.caseEraser.blendEquation = THREE.AddEquation
    this.caseEraser.blendSrc = THREE.ZeroFactor
    this.caseEraser.blendDst = THREE.ZeroFactor
    this.cardShadow = shadowMat(1, true)
    const caseShadow = new THREE.Mesh(this.caseGeo, this.caseShadow)
    const eraser = new THREE.Mesh(this.caseGeo, this.caseEraser)
    const cardShadow = new THREE.Mesh(this.cardGeo, this.cardShadow)
    for (const m of [caseShadow, eraser, cardShadow]) m.layers.set(LAYER_SHADOW)
    caseShadow.renderOrder = 0
    eraser.renderOrder = 1
    cardShadow.renderOrder = 2

    const card = new THREE.Mesh(this.cardGeo, this.material)
    card.renderOrder = 1
    // Seen through the slab, the card is drawn nearer the face (see the
    // header): three's culling mustn't use the uncompressed box.
    card.frustumCulled = false
    const acrylic = new THREE.Mesh(this.caseGeo, this.caseMaterial)
    acrylic.renderOrder = 200

    this.stickers = new StickerLayer(this.est, { uFade: this.uFade, uMotion: this.uMotion, uInk: this.uInk }, { reduced: this.reduced, artPx: opts.artPx ?? 512 })

    this.flipper.add(caseShadow, eraser, cardShadow, card, acrylic, this.stickers.group)
    this.pivot.add(this.flipper)
    this.scene.add(this.pivot)
  }

  setReduced(on: boolean) {
    this.reduced = on
    this.stickers.setReduced(on)
    this.material.uniforms.uRest.value = on ? 0.72 : 0.62
    if (on) {
      this.target.x = this.target.y = 0
      this.hoverTarget = 0
    }
    this.dirty = true
  }

  /** Upload (or re-upload) the printed atlases and the case's engraving; re-read the page's ink. */
  setPrint(print: HTMLCanvasElement, relief: HTMLCanvasElement, label?: HTMLCanvasElement | null) {
    if (!this.print || this.print.image !== print) {
      this.print?.dispose()
      this.print = canvasTexture(print, this.aniso)
    } else this.print.needsUpdate = true
    if (!this.relief || this.relief.image !== relief) {
      this.relief?.dispose()
      this.relief = canvasTexture(relief, 1)
    } else this.relief.needsUpdate = true
    if (label) {
      if (!this.label || this.label.image !== label) {
        this.label?.dispose()
        this.label = canvasTexture(label, this.aniso)
      } else this.label.needsUpdate = true
    }
    const u = this.material.uniforms
    u.uPrint.value = this.print
    u.uRelief.value = this.relief
    const cu = this.caseMaterial.uniforms
    cu.uLabel.value = this.label
    cu.uLabelOk.value = this.label ? 1 : 0
    ;(u.uReliefTexel.value as THREE.Vector2).set(1 / relief.width, 1 / relief.height)
    ;(u.uPrintTexel.value as THREE.Vector2).set(1 / print.width, 1 / print.height)
    const [ir, ig, ib] = unit(paletteNow().ink)
    this.uInk.value.set(ir, ig, ib)
    this.dirty = true
  }

  /** The role picks the stock (its livery), the ink on it and the foil (kind + hue band). */
  setRole(role: Role) {
    const f = foilFor(role)
    const u = this.material.uniforms
    u.uFoil.value = f.code
    u.uPhase.value = f.phase
    u.uSpread.value = f.spread
    const s = cardStock(role)
    setHex(this.uStock.value, s.stock)
    setHex(u.uInkCol.value as THREE.Vector3, s.ink)
    setHex(this.uCore.value, s.core)
    this.dirty = true
  }

  /** What's behind the case (the page), for the acrylic's clear parts. */
  setGround(rgb: [number, number, number]) {
    ;(this.caseMaterial.uniforms.uGround.value as THREE.Vector3).set(rgb[0], rgb[1], rgb[2])
    this.dirty = true
  }

  /** 0..1: how scuffed the case is (it grows with the member's time here). */
  setScuff(v: number) {
    this.caseMaterial.uniforms.uScuff.value = Math.min(1, Math.max(0, v))
    this.dirty = true
  }

  setArtPx(px: number) {
    this.stickers.setArtPx(px)
  }

  syncStickers(items: StickerItem[], nowMs: number) {
    this.stickers.sync(items, nowMs)
  }

  setGhost(g: GhostSpec | null) {
    this.stickers.setGhost(g)
  }

  setHover(uid: string | null) {
    this.stickers.setHover(uid)
  }

  setSelected(uid: string | null) {
    this.stickers.setSelected(uid)
  }

  stickerFace(uid: string): CardFace | null {
    return this.stickers.faceOf(uid)
  }

  /** Editing damps the lean so the face stays readable under the cursor. */
  setEditing(on: boolean) {
    if (on === this.editing) return
    this.editing = on
    this.dirty = true
  }

  /** nx, ny in −1..1 (y up): the lean. */
  setPointer(nx: number, ny: number, inside: boolean) {
    if (this.reduced) return
    this.target.x = inside ? nx : 0
    this.target.y = inside ? ny : 0
    this.hoverTarget = inside ? 1 : 0
  }

  // ── by hand ──────────────────────────────────────────────────────────────

  /** The hand takes it: from here `drag` turns it directly (whatever it was doing). */
  grab(t: number) {
    this.glideTween?.kill()
    this.glide.on = false
    this.sling = false
    this.hand = { yaw0: this.yaw, pitch0: this.pitch, yaw: this.yaw, pitch: this.pitch, v: 0, vp: 0, t }
    this.dirty = true
  }

  /** dx → yaw, dy → pitch: radians the hand has moved since `grab`; t: the event's time, ms. */
  drag(dx: number, dy: number, t: number) {
    const h = this.hand
    if (!h) return
    const yaw = h.yaw0 + dx
    const pitch = PITCH_MAX * Math.tanh((h.pitch0 + dy) / PITCH_MAX)
    const dt = Math.max(1, t - h.t) / 1000
    const k = 1 - Math.exp(-dt / 0.05)
    h.v += ((yaw - h.yaw) / dt - h.v) * k
    h.vp += ((pitch - h.pitch) / dt - h.vp) * k
    h.yaw = yaw
    h.pitch = pitch
    h.t = t
    this.dirty = true
  }

  /**
   * The hand lets go: it slings to the nearest face — the release speed can
   * carry it over to the next one. Returns whether it lands on its back.
   */
  release(t: number): boolean {
    const h = this.hand
    if (!h) return this.restsOnBack()
    this.hand = null
    // A hand that stopped before letting go carries nothing. The face is
    // chosen from where the hand had it (the object trails it a little).
    const carry = Math.exp(-Math.max(0, t - h.t) / 60)
    const v = h.v * carry
    const n0 = Math.round(h.yaw / Math.PI)
    const n = Math.max(n0 - 1, Math.min(n0 + 1, Math.round((h.yaw + v * FLING_T) / Math.PI)))
    this.rest = n * Math.PI
    if (this.reduced) {
      this.yaw = this.rest
      this.pitch = 0
      this.vyaw = this.vpitch = 0
    } else {
      this.vyaw = Math.max(-MAX_SPIN, Math.min(MAX_SPIN, v))
      this.vpitch = Math.max(-MAX_SPIN, Math.min(MAX_SPIN, h.vp * carry))
      this.sling = true
    }
    this.dirty = true
    return this.restsOnBack()
  }

  /** Whether the face it rests on (or is slinging to) is the back. */
  restsOnBack(): boolean {
    return Math.abs(Math.round(this.rest / Math.PI)) % 2 === 1
  }

  flip(toBack: boolean) {
    if (this.hand) return
    if (this.restsOnBack() === toBack) return
    const from = this.rest
    this.rest += toBack ? Math.PI : -Math.PI
    if (this.reduced) {
      this.yaw = this.rest
      this.vyaw = 0
      this.dirty = true
      return
    }
    this.sling = true
    this.glide.on = true
    this.glide.y = Math.abs(this.yaw - this.lean - from) < 1 ? this.yaw - this.lean : from
    this.glideTween?.kill()
    const glide = gsap.to(this.glide, {
      y: this.rest,
      duration: GLIDE_S,
      ease: 'power1.in',
      onComplete: () => {
        this.glide.on = false
      },
    })
    this.glideTween = glide
    this.tweens = this.tweens.filter((t) => t.isActive())
    this.tweens.push(glide)
  }

  /** The card comes out of the depth, turning, dithering into place. */
  arrive(delay = 0.1) {
    if (this.reduced) {
      this.arriveState.a = 1
      return
    }
    this.arriveState.a = 0
    this.tweens.push(gsap.to(this.arriveState, { a: 1, duration: 1.5, delay, ease: 'expo.out' }))
  }

  /** Development only (headless checks): hold a pose, radians (null lets go). */
  pose(yaw: number | null, pitch = 0) {
    this.debugPose = yaw === null ? null : { yaw, pitch }
    this.dirty = true
  }

  /** The face turned toward the viewer (as of the last frame). */
  showingBack(): boolean {
    return this.back
  }

  /** Where a client point lands on the visible face of the case (null: it misses the object's plane). */
  faceAt(clientX: number, clientY: number, rect: DOMRect | { left: number; top: number; width: number; height: number }): FaceHit | null {
    if (rect.width < 1 || rect.height < 1) return null
    this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -(((clientY - rect.top) / rect.height) * 2 - 1))
    this.raycaster.setFromCamera(this.ndc, this.camera)
    this.inv.copy(this.flipper.matrixWorld).invert()
    this.ray.copy(this.raycaster.ray).applyMatrix4(this.inv)
    const back = this.back
    const zf = back ? -CASE_HZ : CASE_HZ
    const d = this.ray.direction
    if (Math.abs(d.z) < 1e-5) return null
    const t = (zf - this.ray.origin.z) / d.z
    if (t < 0) return null
    const p = this.tmp.copy(d).multiplyScalar(t).add(this.ray.origin)
    const fx = back ? -p.x : p.x
    const fy = p.y
    return {
      face: back ? 'dorso' : 'frente',
      x: fx / CARD_W + 0.5,
      y: 0.5 - fy / CARD_H,
      onCase: outlineDistance(p.x, p.y) <= 0,
    }
  }

  /** The topmost applied sticker under a client point (visible face only). */
  pickAt(clientX: number, clientY: number, rect: DOMRect | { left: number; top: number; width: number; height: number }): string | null {
    const hit = this.faceAt(clientX, clientY, rect)
    if (!hit || !hit.onCase) return null
    return this.stickers.pick(hit.face, hit.x, hit.y)
  }

  /**
   * At rest: nothing in hand, no spring travel, no foil motion, no tween in
   * flight, nothing new to show. Polled every frame by the engine, even at
   * rest — so it allocates nothing.
   */
  isIdle(): boolean {
    if (!this.ready || !this.print) return false
    if (this.debugMotion !== null || this.hand) return false
    if (this.dirty || !this.stickers.isIdle()) return false
    if (this.debugPose) return true
    const k = this.editing ? EDIT_TILT : 1
    const ty = this.rest + this.target.x * TILT_Y * k
    const tp = -this.target.y * TILT_X * k
    if (
      this.vyaw !== 0 ||
      this.vpitch !== 0 ||
      Math.abs(ty - this.yaw) >= 1e-4 ||
      Math.abs(tp - this.pitch) >= 1e-4 ||
      Math.abs(this.hover - this.hoverTarget) >= 1e-3 ||
      this.motion !== 0 ||
      this.arriveState.a < 1
    )
      return false
    for (let i = 0; i < this.tweens.length; i++) if (this.tweens[i].isActive()) return false
    return true
  }

  render({ renderer, rect, dt, time }: WindowRenderContext) {
    if (!this.ready || !this.print) return
    const aspect = rect.width / Math.max(1, rect.height)
    if (Math.abs(aspect - this.lastAspect) > 1e-4) {
      this.lastAspect = aspect
      this.camera.aspect = aspect
      // The card fills CARD_FRAC of the slot, centred. The camera stands at
      // the designed framing (the slot grown by LOOK_BLEED, at the lens's
      // FOV); the window is the slot grown by GL_BLEED — more room — so the
      // view widens to cover it at the same scale: same card, same
      // perspective, nothing cut when it's turned.
      const t = Math.tan(THREE.MathUtils.degToRad(FOV) / 2)
      const lookH = (CARD_H / (2 * CARD_FRAC)) * (1 + 2 * LOOK_BLEED_Y)
      const lookW = (CARD_W / (2 * CARD_FRAC)) * (1 + 2 * LOOK_BLEED_X)
      const dist = Math.max(lookH / t, lookW / (t * (lookW / lookH)))
      const winH = (CARD_H / (2 * CARD_FRAC)) * (1 + 2 * GL_BLEED_Y)
      this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(winH / dist))
      this.camera.position.set(0, 0, dist)
      this.camera.lookAt(0, 0, 0)
      this.camera.updateProjectionMatrix()
    }

    const step = Math.min(dt, 1 / 20) * this.debugSpeed
    const tk = this.editing ? EDIT_TILT : 1
    this.lean = this.target.x * TILT_Y * tk
    const h = this.hand
    const ty = h ? h.yaw : (this.glide.on ? this.glide.y : this.rest) + this.lean
    const tp = h ? h.pitch : -this.target.y * TILT_X * tk
    if (this.debugPose) {
      this.yaw = this.debugPose.yaw
      this.pitch = this.debugPose.pitch
      this.vyaw = this.vpitch = 0
    } else if (this.reduced) {
      this.yaw = ty
      this.pitch = tp
      this.vyaw = this.vpitch = 0
    } else {
      const k = h ? K_HAND : this.sling ? K_SLING : K_LEAN
      const c = 2 * Math.sqrt(k) * (h ? 1 : this.sling ? Z_SLING : Z_LEAN)
      for (let t = 0; t < step - 1e-7; t += SUB) {
        const s = Math.min(SUB, step - t)
        this.vyaw += (k * (ty - this.yaw) - c * this.vyaw) * s
        this.yaw += this.vyaw * s
        this.vpitch += (k * (tp - this.pitch) - c * this.vpitch) * s
        this.pitch += this.vpitch * s
      }
      // Landed: settle exactly (the lean takes over from the sling).
      if (!h && !this.glide.on && Math.abs(ty - this.yaw) < 1e-3 && Math.abs(this.vyaw) < 1e-2 && Math.abs(tp - this.pitch) < 1e-3 && Math.abs(this.vpitch) < 1e-2) {
        this.yaw = ty
        this.pitch = tp
        this.vyaw = this.vpitch = 0
        this.sling = false
      }
    }
    // Many turns one way: fold the angle back (same pose, smaller numbers).
    if (!h && !this.glide.on && Math.abs(this.rest) > 4 * Math.PI) {
      const wrap = Math.round(this.rest / (2 * Math.PI)) * 2 * Math.PI
      this.rest -= wrap
      this.yaw -= wrap
    }
    this.hover += (this.hoverTarget - this.hover) * (1 - Math.exp(-step / 0.25))
    if (Math.abs(this.hover - this.hoverTarget) < 1e-3) this.hover = this.hoverTarget

    const a = this.arriveState.a
    const inv = 1 - a
    const turning = Math.abs(Math.sin(this.yaw))

    // How much the card is moving (not merely hovered): the foil lives
    // here and settles to 0, so a card at rest is the calm print.
    // (Reduced motion: nothing ever animates, so nothing is "moving".)
    const moving = this.reduced ? 0 : Math.min(1, (Math.abs(this.vyaw) + Math.abs(this.vpitch)) * 1.2 + inv * 1.2)
    this.motion += (moving - this.motion) * (1 - Math.exp(-step / 0.3))
    if (this.motion < 0.004) this.motion = 0
    if (this.debugMotion !== null) this.motion = this.debugMotion

    this.pivot.rotation.set(this.pitch + inv * 0.4, 0, -Math.sin(this.yaw) * 0.05)
    this.pivot.position.set(0, -inv * 0.2, -inv * 2.2 - turning * DOLLY)
    this.pivot.scale.setScalar(0.45 + 0.55 * a)
    this.flipper.rotation.set(turning * 0.03, this.yaw - inv * Math.PI, 0)

    const u = this.material.uniforms
    u.uHover.value = this.hover
    this.uFade.value = Math.min(1, a * 1.8)
    this.uMotion.value = this.reduced ? 0 : this.motion
    this.uTime.value = time
    this.caseMaterial.uniforms.uTilt.value = Math.min(1, Math.hypot(this.pitch, Math.sin(this.yaw - this.rest)) / 0.16)
    this.uOffset.value.set((2 * SHADOW_PX) / Math.max(1, rect.width), (-2 * SHADOW_PX) / Math.max(1, rect.height))

    // The camera seen from inside the case, which face is turned toward
    // it, and how deep the inside looks through that face.
    this.scene.updateMatrixWorld()
    this.inv.copy(this.flipper.matrixWorld).invert()
    this.camObj.copy(this.camera.position).applyMatrix4(this.inv)
    this.faceW.set(0, 0, 1).transformDirection(this.flipper.matrixWorld)
    const cz = this.camObj.z / Math.max(1e-6, this.camObj.length())
    this.uSide.value = cz >= 0 ? 1 : -1
    this.uDepthK.value = 1 + (1 / ETA - 1) * smoothstep(0.08, 0.4, Math.abs(cz))
    this.back = this.faceW.z < 0
    this.stickers.setFacing(this.back)
    this.stickers.frame()

    this.camera.layers.set(LAYER_SHADOW)
    renderer.render(this.scene, this.camera)
    this.camera.layers.set(0)
    renderer.render(this.scene, this.camera)
    this.dirty = false
  }

  dispose() {
    this.tweens.forEach((t) => t.kill())
    this.glideTween?.kill()
    this.stickers.dispose()
    this.cardGeo.dispose()
    this.caseGeo.dispose()
    this.material.dispose()
    this.caseMaterial.dispose()
    this.cardShadow.dispose()
    this.caseShadow.dispose()
    this.caseEraser.dispose()
    this.print?.dispose()
    this.relief?.dispose()
    this.label?.dispose()
    this.est.onChange.delete(this.onEst)
    releaseEstuche()
  }
}
