/**
 * INSIGNIAS — the pins on the page, as a stage window.
 *
 * There is no tray: the case is the page. The window draws two things into
 * the tray's rect, in order: the page's relief (paper.ts) — each earned pin
 * pressed into the paper, each locked trophy's die pressed blind — and the
 * die-struck enamel pins over it. The relief is shading only: this window
 * never paints paper, so wherever the page is flat the stage stays
 * transparent and <html>'s own paper shows through, pixel for pixel.
 *
 *   · the pin     an extruded, bevelled blank (the struck edge, polished);
 *                 its face samples the struck atlases (relief, enamel,
 *                 plating) under an epoxy dome (clearcoat with its own
 *                 lens-shaped normal); its back is the satin plate with the
 *                 engraving; a post and a butterfly clutch behind it.
 *   · the page    per slot, a tile of the paper's shading (a warm dark where
 *                 a slope turns from the key, a warm white where it turns
 *                 toward it, occlusion in the crease); per pin, its shadow on
 *                 the page — contact and ambient — which opens and softens
 *                 as the pin lifts, narrows as it turns and mirrors when it
 *                 lies face-down.
 *   · the light   a studio light box baked into a PMREM: the page itself
 *                 fills the lower half of the world (bevels and domes pick
 *                 up the paper they sit in), a dim room keeps polished metal
 *                 its darks, a softbox on the key, a graduated diffuser in
 *                 front, a strip and a kicker; plus one key light. The page
 *                 is shaded from the same key, so every shadow agrees.
 *   · the colour  pins are physically based, linear, and this window alone
 *                 renders them with Khronos PBR Neutral tone mapping (made
 *                 for product shots: enamel hues stay true while highlights
 *                 roll off), handing the renderer back untouched. The page's
 *                 shading is display-space coverage, never tone mapped.
 *
 * Motion only answers to people: a pointer over a pin tilts it on a damped
 * spring (lifting it off the page, its shadow opening); a click lifts it
 * out, turns it over and lays it face-down; keyboard focus presents it at a
 * fixed angle. At rest the case is a still picture and `isIdle()` lets the
 * engine stop drawing. Reduced motion: no spring, instant turns.
 */

import * as THREE from 'three'
import gsap from 'gsap'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { getStage, type WindowRenderContext } from '@/components/stage/engine'
import { cellTransform, engravingFonts, nacreThickness, strikeBacks, strikeFaces, type Atlas, type BackArtSpec } from './art'
import { FAMILY_METAL, METAL, fillOf } from './catalog'
import { BED_DEPTH, KEY, TILE, pressPaper, type PaperTiles } from './paper'
import { BLANK, FAMILIES, silhouettes, type Family, type Pt } from './shapes'

export interface CasePin extends BackArtSpec {
  earned: boolean
}

/** A slot's pin box: centre relative to the tray's centre (CSS px, y up) and side. */
export interface SlotRect {
  x: number
  y: number
  size: number
}

// ── proportions (units: the pin's own square) ───────────────────────────────

const THICK = BLANK.thick
const PIN_FILL = 0.88 // pin width inside its box
const TILT = 0.34 // rad, pointer at the pin's edge
const FOCUS_TILT: [number, number] = [0.5, 0.42]
const TILT_LIFT = 0.26 // tilted, it pivots off the page…
const HOVER_LIFT = 0.025 // …and rises a hair under the pointer
const TURN_LIFT = 0.55 // turning over, it clears its own width
const FOV = 18
const EXPOSURE = 1.05
/** Relief tile resolution per face-atlas cell (the relief is soft). */
const RELIEF_RES = 0.8

// The pin's shadow on the page: where it falls per unit of height (away
// from the key), where it sits at rest, how dark, and its quad's reach.
const FALL: [number, number] = [-KEY[0] / KEY[2], -KEY[1] / KEY[2]]
const CONTACT_AT = 0.045
const AMBIENT_AT = 0.06
const CONTACT_K = 0.55
const AMBIENT_K = 0.16
const SHADOW_QUAD = 1.3

// ── light ───────────────────────────────────────────────────────────────────

/**
 * The studio, as a scene to bake into a PMREM. Directions are in the
 * case's space: the page is the plane z = 0 and the viewer looks down −z,
 * so «in front» is +z and everything below the page is paper.
 */
function lightBox(paper: THREE.Color): { scene: THREE.Scene; dispose: () => void } {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0.04, 0.04, 0.045)
  const geo = new THREE.PlaneGeometry(1, 1)
  const mats: THREE.Material[] = []
  const panel = (dir: readonly [number, number, number], w: number, h: number, intensity: number, tint: THREE.ColorRepresentation = 0xffffff, dist = 10) => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(tint).multiplyScalar(intensity), side: THREE.DoubleSide })
    mats.push(m)
    const mesh = new THREE.Mesh(geo, m)
    mesh.position.copy(new THREE.Vector3(...dir).normalize().multiplyScalar(dist))
    mesh.scale.set(w, h, 1)
    mesh.lookAt(0, 0, 0)
    scene.add(mesh)
  }
  // The page the pins sit in: the lower half of the world, lit.
  panel([0, 0, -1], 90, 90, 0.7, paper, 4)
  // The diffuser in front, graduated top → bottom: flat metal at rest shows
  // its middle; a pin tilting up or down walks the gradient.
  const steps = [1.05, 0.82, 0.6, 0.4, 0.24]
  steps.forEach((v, k) => {
    const e = ((2 - k) * 9.6 * Math.PI) / 180
    panel([0, Math.sin(e), Math.cos(e)], 13, 1.72, v)
  })
  panel(KEY, 8, 3, 6.5, 0xffffff, 9.5) // the softbox, on the key
  panel([-0.96, 0.16, 0.22], 1.1, 9, 3) // a strip on the left
  panel([0.93, 0.3, 0.2], 1.6, 3.4, 2.2, 0xfff0dc) // a warm kicker on the right
  panel([0, 1, 0.05], 7, 7, 1.3) // the ceiling
  return {
    scene,
    dispose: () => {
      geo.dispose()
      mats.forEach((m) => m.dispose())
    },
  }
}

// ── the page's shaders (display space: no colour-space or tone-map chunks) ──

const QUAD_VS = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

/** A relief tile: coverage of the warm dark (under) and warm white (over). */
const BED_FS = /* glsl */ `
uniform sampler2D map;
uniform float blind;
uniform vec3 shade;
uniform vec3 lite;
varying vec2 vUv;
void main() {
  vec4 t = texture2D(map, vUv);
  vec2 k = mix(t.rg, t.ba, blind);
  gl_FragColor = vec4(shade * k.x * (1.0 - k.y) + lite * k.y, k.y + k.x * (1.0 - k.y));
}
`

/** A pin's shadow: its footprint blurred twice, offset along the fall. */
const SHADOW_FS = /* glsl */ `
uniform sampler2D map;
uniform vec2 contact;
uniform vec2 ambient;
uniform float sx;
uniform float kc;
uniform float ka;
uniform float spread;
uniform float bias;
uniform float tile;
uniform float quad;
uniform vec3 shade;
varying vec2 vUv;
float within(vec2 uv) {
  return step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
}
vec2 tileUv(vec2 p, vec2 off, float grow) {
  vec2 q = (p - off) / grow;
  q.x /= sx;
  return q / (2.0 * tile) + 0.5;
}
void main() {
  vec2 p = (vUv * 2.0 - 1.0) * quad;
  vec2 uc = tileUv(p, contact, 1.0);
  vec2 ua = tileUv(p, ambient, spread);
  float c = texture2D(map, uc).r * within(uc);
  float a = texture2D(map, ua, bias).g * within(ua);
  float cover = 1.0 - (1.0 - kc * c) * (1.0 - ka * a);
  gl_FragColor = vec4(shade * cover, cover);
}
`

/** A CSS colour as display-space RGB 0…1 (hex only; the tokens are hex). */
function displayRGB(css: string | undefined, fallback: string): THREE.Vector3 {
  const hex = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(css ?? '') ? css! : fallback
  const c = new THREE.Color(hex)
  const t = { r: 0, g: 0, b: 0 }
  c.getRGB(t, THREE.SRGBColorSpace)
  return new THREE.Vector3(t.r, t.g, t.b)
}

// ── geometry ────────────────────────────────────────────────────────────────

function shapeOf(p: readonly Pt[]): THREE.Shape {
  const s = new THREE.Shape()
  p.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)))
  s.closePath()
  return s
}

interface FamilyGeo {
  body: THREE.BufferGeometry
  face: THREE.BufferGeometry
  back: THREE.BufferGeometry
  post: Pt
}

function familyGeometry(family: Family): FamilyGeo {
  const sil = silhouettes()[family]
  const shape = shapeOf(sil.outline)

  const extruded = new THREE.ExtrudeGeometry(shape, {
    depth: THICK - 2 * BLANK.bevelT,
    bevelEnabled: true,
    bevelThickness: BLANK.bevelT,
    bevelSize: BLANK.bevelS,
    bevelSegments: 3,
    steps: 1,
  })
  extruded.translate(0, 0, -(THICK - 2 * BLANK.bevelT) / 2)
  // Smooth around the rim, crisp where the cap meets the bevel. (For a
  // non-indexed geometry — ExtrudeGeometry is one — this returns the same
  // object with new normals, so only a copy made from it may be dropped.)
  const body = toCreasedNormals(extruded, 0.62)
  if (body !== extruded) extruded.dispose()

  const face = new THREE.ShapeGeometry(shape)
  const fp = face.attributes.position as THREE.BufferAttribute
  const fuv = face.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < fp.count; i++) {
    fuv.setXY(i, fp.getX(i) + 0.5, fp.getY(i) + 0.5)
    fp.setZ(i, THICK / 2)
  }

  // The back: the same outline facing −z; UVs mirrored so the engraving
  // reads when the pin lies face-down.
  const back = new THREE.ShapeGeometry(shape)
  const bp = back.attributes.position as THREE.BufferAttribute
  const buv = back.attributes.uv as THREE.BufferAttribute
  const bn = back.attributes.normal as THREE.BufferAttribute
  for (let i = 0; i < bp.count; i++) {
    buv.setXY(i, 0.5 - bp.getX(i), bp.getY(i) + 0.5)
    bp.setZ(i, -THICK / 2)
    bn.setXYZ(i, 0, 0, -1)
  }
  const idx = back.index
  if (idx) {
    const a = idx.array as Uint16Array | Uint32Array
    for (let i = 0; i < a.length; i += 3) {
      const t = a[i + 1]
      a[i + 1] = a[i + 2]
      a[i + 2] = t
    }
    idx.needsUpdate = true
  }

  return { body, face, back, post: sil.center }
}

interface SharedGeo {
  post: THREE.BufferGeometry
  tip: THREE.BufferGeometry
  clutch: THREE.BufferGeometry
  roll: THREE.BufferGeometry
  /** The page's quads (relief tiles and shadows), scaled per slot. */
  quad: THREE.BufferGeometry
}

const POST_LEN = 0.24
const CLUTCH_AT = 0.15

function sharedGeometry(): SharedGeo {
  const post = new THREE.CylinderGeometry(0.016, 0.016, POST_LEN, 14, 1)
  post.rotateX(Math.PI / 2)
  post.translate(0, 0, -THICK / 2 - POST_LEN / 2)
  const tip = new THREE.ConeGeometry(0.016, 0.034, 14)
  tip.rotateX(-Math.PI / 2)
  tip.translate(0, 0, -THICK / 2 - POST_LEN - 0.017)

  // A butterfly clutch: two lobes around the post (a plate across it), the
  // lobes' inner edges rolled over on the outer side to grip the post.
  const lobe = (sx: number) => {
    const pts: [number, number][] = []
    const a = 2.25
    for (let i = 0; i <= 18; i++) {
      const t = -a + (2 * a * i) / 18
      pts.push([sx * (0.068 + 0.078 * Math.cos(t)), 0.1 * Math.sin(t)])
    }
    return pts
  }
  // right lobe bottom → top (CCW), waist, left lobe top → bottom, waist
  const outline: Pt[] = [...lobe(1), [0, 0.07], ...lobe(-1).reverse(), [0, -0.07]]
  const clutch = new THREE.ExtrudeGeometry(shapeOf(outline), { depth: 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 })
  clutch.translate(0, 0, -THICK / 2 - CLUTCH_AT - 0.008)
  // Half tube along y, bulging toward −z (away from the pin).
  const roll = new THREE.CylinderGeometry(0.02, 0.02, 0.12, 14, 1, true, 0, Math.PI)
  roll.rotateY(Math.PI / 2)
  return { post, tip, clutch, roll, quad: new THREE.PlaneGeometry(1, 1) }
}

// ── textures ────────────────────────────────────────────────────────────────

function canvasTexture(c: HTMLCanvasElement, srgb: boolean, aniso: number): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.magFilter = THREE.LinearFilter
  t.anisotropy = aniso
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  t.needsUpdate = true
  return t
}

/** Coverage data (display space, rows bottom-up) as a mipmapped texture. */
function dataTexture(data: Uint8Array, size: number): THREE.DataTexture {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType)
  t.colorSpace = THREE.NoColorSpace
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.magFilter = THREE.LinearFilter
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  t.needsUpdate = true
  return t
}

function inCell<T extends THREE.Texture>(base: T, atlas: Atlas, i: number): T {
  const c = base.clone() as T
  const { offset, repeat } = cellTransform(atlas, i)
  c.offset.set(offset[0], offset[1])
  c.repeat.set(repeat[0], repeat[1])
  return c
}

// ── per pin ─────────────────────────────────────────────────────────────────

interface Pin {
  i: number
  family: Family
  earned: boolean
  /** The pin itself (pins' scene). */
  slot: THREE.Group
  /** Its bed or blind deboss in the page (page scene). */
  bed: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>
  /** Its shadow on the page (page scene) — earned pins only. */
  shadow: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> | null
  holder: THREE.Group | null
  tilt: THREE.Group | null
  flipper: THREE.Group | null
  mats: THREE.Material[]
  texs: THREE.Texture[]
  /** px per unit, from the layout. */
  k: number
  rx: number
  ry: number
  vx: number
  vy: number
  tx: number
  ty: number
  hover: number
  hoverT: number
  focused: boolean
  pointer: boolean
  turn: { f: number }
  back: boolean
}

export interface PinCaseOptions {
  reduced: boolean
  /** The page's paper (a hex colour — `var(--paper)`): tints the relief's inks and the paper the metal reflects. */
  paper?: string
  /** Called once the first frame with pins has been drawn. */
  onShown?: () => void
  /** Called if building the case fails (the tray falls back to print). */
  onFail?: () => void
}

export class PinCase {
  ready = false
  private renderer: THREE.WebGLRenderer
  /** The pins. */
  private scene = new THREE.Scene()
  /** The page's relief and the pins' shadows — drawn first, no depth. */
  private page = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(FOV, 1, 1, 4000)
  private root = new THREE.Group()
  private env: THREE.WebGLRenderTarget | null = null
  private aniso: number
  private reduced: boolean
  private opts: PinCaseOptions

  private famGeo = new Map<Family, FamilyGeo>()
  private shared: SharedGeo
  private famMat = new Map<Family, THREE.MeshStandardMaterial>()
  private nacreTex: THREE.CanvasTexture | null = null
  /** The relief's inks, display space: a warm dark (under) and a warm white (over). */
  private shade: THREE.Vector3
  private lite: THREE.Vector3
  private paperRes = 0
  private reliefTex = new Map<Family, THREE.DataTexture>()
  private shadowTex = new Map<Family, THREE.DataTexture>()

  private faceTex: THREE.CanvasTexture[] = []
  private backTex: THREE.CanvasTexture[] = []
  private pins: Pin[] = []
  private gen = 0
  private disposed = false
  private shown = false

  private W = 0
  private H = 0
  private slots: SlotRect[] = []
  private layoutKey = ''
  private layoutDirty = true
  private camKey = ''
  private tweens: gsap.core.Tween[] = []

  constructor(renderer: THREE.WebGLRenderer, opts: PinCaseOptions) {
    this.renderer = renderer
    this.opts = opts
    this.reduced = opts.reduced
    this.aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy())

    const paper = displayRGB(opts.paper, '#edebe3')
    this.shade = new THREE.Vector3(paper.x * 0.3, paper.y * 0.28, paper.z * 0.24)
    this.lite = paper.clone().lerp(new THREE.Vector3(1, 1, 1), 0.92)

    // The light box, baked once per case; the key light sits in the softbox.
    const pmrem = new THREE.PMREMGenerator(renderer)
    const box = lightBox(new THREE.Color().setRGB(paper.x, paper.y, paper.z, THREE.SRGBColorSpace))
    this.env = pmrem.fromScene(box.scene, 0.02)
    box.dispose()
    pmrem.dispose()
    this.scene.environment = this.env.texture
    this.scene.environmentIntensity = 1
    const key = new THREE.DirectionalLight(0xffffff, 1.5)
    key.position.set(...KEY)
    this.scene.add(key, key.target)

    for (const f of FAMILIES) {
      this.famGeo.set(f, familyGeometry(f))
      const m = METAL[FAMILY_METAL[f]]
      this.famMat.set(f, new THREE.MeshStandardMaterial({ color: m.color, metalness: 1, roughness: m.edge }))
    }
    this.shared = sharedGeometry()
    this.scene.add(this.root)
  }

  // ── inputs ────────────────────────────────────────────────────────────────

  setReduced(on: boolean) {
    this.reduced = on
    if (on)
      for (const p of this.pins) {
        p.tx = p.ty = 0
        p.hoverT = 0
      }
    this.wake()
  }

  /**
   * Which pins exist and what their backs say. Faces are struck once per
   * resolution (cached), and so is the page; backs are engraved for this
   * member.
   */
  async setPins(pins: CasePin[], cell: number) {
    const gen = ++this.gen
    try {
      const specs = pins.map(({ key, family, color }) => ({ key, family, color }))
      const [faces, fonts, paper] = await Promise.all([strikeFaces(specs, cell), engravingFonts(), pressPaper(cell * RELIEF_RES)])
      if (this.disposed || gen !== this.gen) return
      const backs = await strikeBacks(pins, cell, fonts)
      if (this.disposed || gen !== this.gen) return

      // Replace the atlases and every pin (earned states may have changed).
      this.clearPins()
      this.faceTex.forEach((t) => t.dispose())
      this.backTex.forEach((t) => t.dispose())
      const color = canvasTexture(faces.color, true, this.aniso)
      const normal = canvasTexture(faces.normal, false, this.aniso)
      const orm = canvasTexture(faces.orm, false, this.aniso)
      const coat = canvasTexture(faces.coat, false, 1)
      const bNormal = canvasTexture(backs.normal, false, this.aniso)
      const bOrm = canvasTexture(backs.orm, false, this.aniso)
      this.faceTex = [color, normal, orm, coat]
      this.backTex = [bNormal, bOrm]
      if (pins.some((p) => fillOf(p.key) === 'nacar') && !this.nacreTex) this.nacreTex = canvasTexture(nacreThickness(), false, 1)
      this.usePaper(paper)

      pins.forEach((p, i) => this.pins.push(this.buildPin(p, i, faces.atlas, backs.atlas, { color, normal, orm, coat, bNormal, bOrm })))
      this.layoutDirty = true

      if (!this.ready) {
        // Compile before the first frame so the case never stutters in —
        // the pins under the same tone mapping the frames use (it's in the
        // program key); compile() itself is synchronous, only the wait is.
        this.applyLayout()
        const r = this.renderer
        const tm = r.toneMapping
        let compiled: Promise<unknown> | null = null
        try {
          compiled = r.compileAsync(this.page, this.camera)
          r.toneMapping = THREE.NeutralToneMapping
          compiled = Promise.all([compiled, r.compileAsync(this.scene, this.camera)])
        } catch {
          /* compiled on first draw instead */
        } finally {
          r.toneMapping = tm
        }
        await compiled?.catch(() => {})
        if (this.disposed || gen !== this.gen) return
        this.ready = true
      }
      this.wake()
    } catch {
      if (!this.disposed) this.opts.onFail?.()
    }
  }

  /** Tray size and the slots' pin boxes, in CSS px. */
  setLayout(width: number, height: number, slots: SlotRect[]) {
    const key = `${width.toFixed(1)}x${height.toFixed(1)}|${slots.map((s) => `${s.x.toFixed(1)},${s.y.toFixed(1)},${s.size.toFixed(1)}`).join(';')}`
    if (key === this.layoutKey) return
    this.layoutKey = key
    this.W = width
    this.H = height
    this.slots = slots
    this.layoutDirty = true
    this.wake()
  }

  /** Pointer over pin i: nx, ny in −1…1 across its box (y up). */
  setPointer(i: number, nx: number, ny: number, inside: boolean) {
    const p = this.pins[i]
    if (!p || !p.earned) return
    p.pointer = inside
    if (this.reduced) return
    if (inside) {
      p.tx = Math.max(-1, Math.min(1, nx))
      p.ty = Math.max(-1, Math.min(1, ny))
      p.hoverT = 1
    } else if (p.focused) {
      ;[p.tx, p.ty] = FOCUS_TILT
    } else {
      p.tx = p.ty = 0
      p.hoverT = 0
    }
    this.wake()
  }

  /** Keyboard focus presents the pin at an angle (the sheen shows). */
  setFocus(i: number, on: boolean) {
    const p = this.pins[i]
    if (!p || !p.earned) return
    p.focused = on
    if (this.reduced || p.pointer) return
    ;[p.tx, p.ty] = on ? FOCUS_TILT : [0, 0]
    p.hoverT = on ? 1 : 0
    this.wake()
  }

  /** Turn pin i over (or to a given side). */
  flip(i: number, back?: boolean) {
    const p = this.pins[i]
    if (!p || !p.earned) return
    const next = back ?? !p.back
    if (next === p.back) return
    p.back = next
    this.tweens = this.tweens.filter((t) => t.isActive())
    if (this.reduced) p.turn.f = next ? 1 : 0
    else this.tweens.push(gsap.to(p.turn, { f: next ? 1 : 0, duration: 0.9, ease: 'power2.inOut', overwrite: true }))
    this.wake()
  }

  /**
   * At rest when no spring travels and no turn is in flight. A pending
   * layout is not motion: `wake()` already asked for the one frame that
   * applies it, and an off-screen tray must never keep the stage awake.
   */
  isIdle(): boolean {
    if (!this.ready) return true // nothing to show yet: nothing to spend
    if (this.tweens.some((t) => t.isActive())) return false
    for (const p of this.pins) {
      if (!p.earned) continue
      if (Math.abs(p.vx) + Math.abs(p.vy) > 1e-4) return false
      if (Math.abs(p.tx * TILT - p.ry) > 1e-4 || Math.abs(-p.ty * TILT - p.rx) > 1e-4) return false
      if (Math.abs(p.hover - p.hoverT) > 1e-3) return false
    }
    return true
  }

  // ── building ──────────────────────────────────────────────────────────────

  /** The page's relief and shadow tiles, as textures (once per resolution). */
  private usePaper(paper: PaperTiles) {
    if (paper.res === this.paperRes && this.reliefTex.size) return
    this.reliefTex.forEach((t) => t.dispose())
    this.shadowTex.forEach((t) => t.dispose())
    this.reliefTex.clear()
    this.shadowTex.clear()
    for (const f of FAMILIES) {
      this.reliefTex.set(f, dataTexture(paper.relief[f], paper.res))
      this.shadowTex.set(f, dataTexture(paper.shadow[f], paper.shadowRes))
    }
    this.paperRes = paper.res
  }

  private pageMaterial(fragmentShader: string, uniforms: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: { ...uniforms, shade: { value: this.shade }, lite: { value: this.lite } },
      vertexShader: QUAD_VS,
      fragmentShader,
      transparent: true,
      premultipliedAlpha: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    })
  }

  private buildPin(
    spec: CasePin,
    i: number,
    faceAtlas: Atlas,
    backAtlas: Atlas,
    t: {
      color: THREE.CanvasTexture
      normal: THREE.CanvasTexture
      orm: THREE.CanvasTexture
      coat: THREE.CanvasTexture
      bNormal: THREE.CanvasTexture
      bOrm: THREE.CanvasTexture
    },
  ): Pin {
    const geo = this.famGeo.get(spec.family)!
    const slot = new THREE.Group()
    const bed = new THREE.Mesh(
      this.shared.quad,
      this.pageMaterial(BED_FS, { map: { value: this.reliefTex.get(spec.family) }, blind: { value: spec.earned ? 0 : 1 } }),
    )
    bed.renderOrder = 0
    this.page.add(bed)
    const pin: Pin = {
      i,
      family: spec.family,
      earned: spec.earned,
      slot,
      bed,
      shadow: null,
      holder: null,
      tilt: null,
      flipper: null,
      mats: [],
      texs: [],
      k: 1,
      rx: 0,
      ry: 0,
      vx: 0,
      vy: 0,
      tx: 0,
      ty: 0,
      hover: 0,
      hoverT: 0,
      focused: false,
      pointer: false,
      turn: { f: 0 },
      back: false,
    }
    this.root.add(slot)
    if (!spec.earned) return pin

    pin.shadow = new THREE.Mesh(
      this.shared.quad,
      this.pageMaterial(SHADOW_FS, {
        map: { value: this.shadowTex.get(spec.family) },
        contact: { value: new THREE.Vector2() },
        ambient: { value: new THREE.Vector2() },
        sx: { value: 1 },
        kc: { value: 0 },
        ka: { value: 0 },
        spread: { value: 1 },
        bias: { value: 0 },
        tile: { value: TILE },
        quad: { value: SHADOW_QUAD },
      }),
    )
    pin.shadow.renderOrder = 1
    this.page.add(pin.shadow)

    const nacar = fillOf(spec.key) === 'nacar'
    const cColor = inCell(t.color, faceAtlas, i)
    const cNormal = inCell(t.normal, faceAtlas, i)
    const cOrm = inCell(t.orm, faceAtlas, i)
    const cCoat = inCell(t.coat, faceAtlas, i)
    const cBackN = inCell(t.bNormal, backAtlas, i)
    const cBackO = inCell(t.bOrm, backAtlas, i)
    pin.texs.push(cColor, cNormal, cOrm, cCoat, cBackN, cBackO)

    const faceMat = new THREE.MeshPhysicalMaterial({
      map: cColor,
      normalMap: cNormal,
      normalScale: new THREE.Vector2(1, 1),
      roughnessMap: cOrm,
      metalnessMap: cOrm,
      roughness: 1,
      metalness: 1,
      clearcoat: 1,
      clearcoatRoughness: 0.035,
      clearcoatNormalMap: cCoat,
      clearcoatNormalScale: new THREE.Vector2(1, 1),
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -4,
    })
    if (nacar && this.nacreTex) {
      faceMat.iridescence = 0.85
      faceMat.iridescenceIOR = 1.55 // aragonite, the stuff of nacre
      faceMat.iridescenceThicknessRange = [300, 620]
      faceMat.iridescenceMap = cOrm
      faceMat.iridescenceThicknessMap = this.nacreTex
    }
    const m = METAL[FAMILY_METAL[spec.family]]
    const backMat = new THREE.MeshStandardMaterial({
      color: m.color,
      metalness: 1,
      roughness: 1,
      normalMap: cBackN,
      roughnessMap: cBackO,
      metalnessMap: cBackO,
      aoMap: cBackO,
      aoMapIntensity: 1,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -4,
    })
    pin.mats.push(faceMat, backMat)

    const metal = this.famMat.get(spec.family)!
    const holder = new THREE.Group()
    const tilt = new THREE.Group()
    const flipper = new THREE.Group()
    const inner = new THREE.Group()
    inner.add(
      new THREE.Mesh(geo.body, metal),
      new THREE.Mesh(geo.face, faceMat),
      new THREE.Mesh(geo.back, backMat),
      new THREE.Mesh(this.shared.post, metal),
      new THREE.Mesh(this.shared.tip, metal),
      new THREE.Mesh(this.shared.clutch, metal),
    )
    for (const sx of [-1, 1]) {
      const roll = new THREE.Mesh(this.shared.roll, metal)
      roll.position.set(sx * 0.026, 0, -THICK / 2 - CLUTCH_AT - 0.012)
      inner.add(roll)
    }
    // Post and clutch (children 3…) are soldered at the field's centre —
    // above the tail on a bubble; the pin itself turns about its own centre.
    inner.children.forEach((c, n) => {
      if (n >= 3) c.position.x += geo.post[0]
      if (n >= 3) c.position.y += geo.post[1]
    })
    flipper.add(inner)
    tilt.add(flipper)
    holder.add(tilt)
    slot.add(holder)
    pin.holder = holder
    pin.tilt = tilt
    pin.flipper = flipper
    return pin
  }

  private clearPins() {
    for (const p of this.pins) {
      this.root.remove(p.slot)
      this.page.remove(p.bed)
      p.bed.material.dispose()
      if (p.shadow) {
        this.page.remove(p.shadow)
        p.shadow.material.dispose()
      }
      p.mats.forEach((m) => m.dispose())
      p.texs.forEach((t) => t.dispose())
    }
    this.pins = []
    this.tweens.forEach((t) => t.kill())
    this.tweens = []
  }

  /** Camera on the page plane (z = 0 maps 1:1 onto the window); slots. */
  private applyLayout() {
    this.layoutDirty = false
    const W = Math.max(1, this.W)
    const H = Math.max(1, this.H)
    const camKey = `${W}x${H}`
    if (camKey !== this.camKey) {
      this.camKey = camKey
      const D = H / 2 / Math.tan(THREE.MathUtils.degToRad(FOV) / 2)
      this.camera.aspect = W / H
      this.camera.position.set(0, 0, D)
      this.camera.near = Math.max(1, D - Math.max(W, H))
      this.camera.far = D + Math.max(W, H)
      this.camera.lookAt(0, 0, 0)
      this.camera.updateProjectionMatrix()
    }
    this.pins.forEach((p, n) => {
      const s = this.slots[n]
      const on = Boolean(s && s.size > 0)
      p.slot.visible = p.bed.visible = on
      if (p.shadow) p.shadow.visible = on
      if (!s || !on) return
      const k = s.size * PIN_FILL
      p.k = k
      p.slot.position.set(s.x, s.y, 0)
      p.bed.position.set(s.x, s.y, 0)
      p.bed.scale.setScalar(2 * TILE * k)
      if (p.shadow) {
        p.shadow.position.set(s.x, s.y, 0)
        p.shadow.scale.setScalar(2 * SHADOW_QUAD * k)
      }
      if (p.holder) p.holder.scale.setScalar(k)
    })
  }

  // ── frame ─────────────────────────────────────────────────────────────────

  private wake() {
    // The engine polls idle(); this makes sure a sleeping loop looks again.
    if (!this.disposed) getStage().invalidate()
  }

  private step(dt: number) {
    const h = Math.min(dt, 1 / 30)
    const K = 95
    const C = 2 * Math.sqrt(K) * 0.58
    for (const p of this.pins) {
      if (!p.earned || !p.holder || !p.tilt || !p.flipper) continue
      const ry = p.tx * TILT
      const rx = -p.ty * TILT
      if (this.reduced) {
        p.rx = p.ry = p.vx = p.vy = 0
        p.hover = 0
      } else {
        p.vy += (K * (ry - p.ry) - C * p.vy) * h
        p.ry += p.vy * h
        p.vx += (K * (rx - p.rx) - C * p.vx) * h
        p.rx += p.vx * h
        p.hover += (p.hoverT - p.hover) * (1 - Math.exp(-h / 0.12))
        if (Math.abs(p.ry - ry) < 1e-4 && Math.abs(p.vy) < 1e-4) {
          p.ry = ry
          p.vy = 0
        }
        if (Math.abs(p.rx - rx) < 1e-4 && Math.abs(p.vx) < 1e-4) {
          p.rx = rx
          p.vx = 0
        }
        if (Math.abs(p.hover - p.hoverT) < 1e-3) p.hover = p.hoverT
      }
      const f = p.turn.f
      // Face up it rests in its bed, sunk into the page. Turned over it
      // can't go back in — mirrored, a bubble's tail no longer fits its own
      // bed — so it lies face-down on the page, over it.
      const inBed = -BED_DEPTH + THICK / 2 + 0.002
      const onPage = THICK / 2 + 0.004
      const rest = inBed + (onPage - inBed) * f
      // Tilted, it pivots off the page; turning, it clears its own width.
      const lift = TILT_LIFT * Math.sin(Math.min(1.2, Math.hypot(p.rx, p.ry))) + p.hover * HOVER_LIFT + Math.sin(Math.PI * f) * TURN_LIFT
      p.holder.position.z = (rest + lift) * p.k
      p.tilt.rotation.set(p.rx, p.ry, -p.ry * 0.08)
      p.flipper.rotation.set(Math.sin(Math.PI * f) * 0.12, Math.PI * f, 0)
      if (p.shadow) this.cast(p.shadow.material.uniforms, lift, f)
    }
  }

  /** The pin's shadow for a lift (units above its rest) and a turn (0…1). */
  private cast(u: Record<string, THREE.IUniform>, lift: number, f: number) {
    const c = Math.cos(Math.PI * f)
    u.sx.value = (c < 0 ? -1 : 1) * Math.max(Math.abs(c), 0.06)
    ;(u.contact.value as THREE.Vector2).set(FALL[0] * (CONTACT_AT + lift), FALL[1] * (CONTACT_AT + lift))
    ;(u.ambient.value as THREE.Vector2).set(FALL[0] * (AMBIENT_AT + lift), FALL[1] * (AMBIENT_AT + lift))
    u.kc.value = CONTACT_K * Math.exp(-lift / 0.035)
    u.ka.value = AMBIENT_K / (1 + lift / 0.4)
    u.spread.value = 1 + lift * 0.3
    u.bias.value = Math.log2(1 + lift / 0.02)
  }

  render({ renderer, rect, dt }: WindowRenderContext) {
    if (!this.ready) return
    if (Math.abs(rect.width - this.W) > 0.5 || Math.abs(rect.height - this.H) > 0.5) {
      // The engine's rect is the truth for the camera; slots follow from React.
      this.W = rect.width
      this.H = rect.height
      this.layoutDirty = true
    }
    if (this.layoutDirty) this.applyLayout()
    this.step(dt)
    // The page first: coverage over the transparent stage, never tone
    // mapped (its materials carry no tone-map or colour-space chunks).
    renderer.render(this.page, this.camera)
    const tm = renderer.toneMapping
    const te = renderer.toneMappingExposure
    renderer.toneMapping = THREE.NeutralToneMapping
    renderer.toneMappingExposure = EXPOSURE
    renderer.render(this.scene, this.camera)
    renderer.toneMapping = tm
    renderer.toneMappingExposure = te
    if (!this.shown) {
      this.shown = true
      requestAnimationFrame(() => requestAnimationFrame(() => !this.disposed && this.opts.onShown?.()))
    }
  }

  dispose() {
    this.disposed = true
    this.clearPins()
    this.famGeo.forEach((g) => {
      g.body.dispose()
      g.face.dispose()
      g.back.dispose()
    })
    Object.values(this.shared).forEach((g) => g.dispose())
    this.famMat.forEach((m) => m.dispose())
    this.nacreTex?.dispose()
    this.faceTex.forEach((t) => t.dispose())
    this.backTex.forEach((t) => t.dispose())
    this.reliefTex.forEach((t) => t.dispose())
    this.shadowTex.forEach((t) => t.dispose())
    this.env?.dispose()
    this.env = null
  }
}
