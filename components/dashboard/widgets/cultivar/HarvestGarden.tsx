'use client'

// ── HarvestGarden — «JARDÍN DE SEÑAL», the ONE three.js element (§5) ────────
//
// The user's own published items as slowly-settling flat-shaded masses inside
// CULTIVAR Zone C's black panel. Size = live currentHp() (30s recompute; prop
// updates already carry publishedItemsCache events through the provider's
// `published` slice, so the R1 harvest patch re-renders us synchronously).
// Harvested items render as split/cracked forms — the broken seal made
// physical; the crack itself is a GSAP timeline INSIDE the scene (the only
// GSAP use; killTweensOf teardown per the invite3d dispose pattern). When
// audio plays, the AudioPlayerProvider's stable dataRef FFT adds a quiet
// EMA-smoothed ripple, read inside our own rAF — never through React state.
// Ink ground, paper-toned masses, acid on the ripest item, normal alpha
// compositing — no additive bloom (light-panel language, §5).
//
// Hygiene (full house checklist — ParticleField3D/VibeFluid lineage):
//   · three.js + gsap load via `await import(...)` inside the mount effect,
//     so the chunk splits even if a consumer imports this file statically
//     (WP4 should still mount it next/dynamic ssr:false — belt and braces);
//   · requestIdleCallback mount; VibeFluid capability gate (≥1024px +
//     pointer:fine + deviceMemory≥4);
//   · ONE WebGLRenderer, powerPreference 'low-power', DPR≤2, 30fps
//     frame-time gate;
//   · visibilitychange + IntersectionObserver pause — offscreen or hidden
//     tab = ZERO rAF (the sole scheduler is updateRunning(), which cancels
//     the loop whenever any pause condition holds; a frozen frame remains);
//   · freezes while `frozen` (WP4's compose-open signal via props) OR while
//     any expanded visualizer holds the slot (useExpandedVisualizerActive —
//     covers MixOverlay's AudioPlayer3D AND LivePreview's compose preview);
//   · full manual dispose (rAF, observers, listeners, GSAP killTweensOf +
//     timeline kills, geometries, materials, renderer) — NEVER loseContext
//     (StrictMode/HMR trap);
//   · sizing via offsetWidth/offsetHeight only (grid reflow transforms make
//     getBoundingClientRect lie — house trap).
//
// Context budget by construction: CRTShader is OFF on /dashboard (§7.2), so
// steady state = 1 context (this garden). Worst case = 2: an expanded
// visualizer (MixOverlay / compose LivePreview) opens its own context and
// this one FREEZES (rAF cancelled) but keeps its context alive — under the
// ≤2 ceiling. Gated/failed/reduced-motion/zero-published = 0 contexts
// (GardenFallback, canvas-2D). Degradation ladder swaps rungs inside one
// absolutely-filled box — zero layout shift at any rung.

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  BufferAttribute,
  BufferGeometry,
  Group,
  LineBasicMaterial,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  WebGLRenderer,
} from 'three'
import { useAudioPlayer } from '@/components/audio/AudioPlayerProvider'
import { useExpandedVisualizerActive } from '@/lib/visualizerSlot'
import { currentHp } from '@/lib/curation'
import { hlBracket } from '@/lib/dashboard/hl'
import {
  DASH_ACID,
  DASH_PAPER,
  DASH_PAPER_RAISED,
  DASH_PANEL_TEXT,
} from '@/lib/dashboard/palette'
import type { ContentItem } from '@/lib/types'
import {
  GardenCaption,
  GardenFallback,
  GARDEN_HP_RECOMPUTE_MS,
} from './GardenFallback'

// ── Props contract (BUILD_PLAN Stage-2 dependency fact) ─────────────────────
// WP4's PublishedRail/CultivarWidget passes the provider's `published` slice,
// an onSelect that scrolls the rail card into view, and `frozen` = true while
// the ComposeSheet is open (the compose-open signal travels as this prop —
// no import from components/dashboard/compose/ needed here).
export interface HarvestGardenProps {
  items: ContentItem[]
  onSelect: (id: string) => void
  frozen?: boolean
}

// ── Tuning constants ────────────────────────────────────────────────────────

const MIN_FRAME_MS = 1000 / 30 - 2 // 30fps frame-time gate
const MAX_MASSES = 32 // defensive bound; prod per-user counts are far lower
const FFT_BINS = 24 // low bands only — bass carries the ripple
const FFT_EMA = 0.12 // ≈0.6Hz response at 30fps — well under the 3Hz rule
const BOB_HZ = 0.135 // 0.85 rad/s settling drift — sub-3Hz by design
const CRACK_SECONDS = 0.55

function scaleFor(hp: number): number {
  return 0.34 + 0.9 * Math.sqrt(Math.min(1, Math.max(0, hp) / 60))
}

// Deterministic per-item hash (photosensitivity rule: never per-frame RNG;
// stable across sessions so the garden composes the same way every visit).
function hashStr01(str: string, salt: number): number {
  let h = (2166136261 ^ Math.imul(salt, 2654435761)) >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h / 4294967295
}

// VibeFluid's capability gate, verbatim spirit (recon-12 house pattern).
function passesCapabilityGate(): boolean {
  if (typeof window === 'undefined') return false
  if (!window.matchMedia('(min-width: 1024px) and (pointer: fine)').matches) {
    return false
  }
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  if (mem !== undefined && mem < 4) return false
  return true
}

interface MassEntry {
  id: string
  item: ContentItem
  title: string
  group: Group
  solid: Mesh
  halfL: Mesh
  halfR: Mesh
  variant: boolean
  phase: number
  zJitter: number
  hp: number
  scaleTarget: number
  scaleNow: number
  harvested: boolean
  flashing: boolean
}

interface GardenControl {
  updateRunning: () => void
  reconcile: (items: ContentItem[]) => void
}

// ── GL core (mounted only when gated-in; all heavy modules load inside) ─────

function GardenGlCore({
  items,
  onSelect,
  frozen,
  onReady,
  onFail,
}: {
  items: ContentItem[]
  onSelect: (id: string) => void
  frozen: boolean
  onReady: () => void
  onFail: () => void
}) {
  // dataRef is identity-stable by provider contract; the loop reads
  // dataRef.current in place — zero React churn from the FFT.
  const { dataRef } = useAudioPlayer()
  const mountRef = useRef<HTMLDivElement | null>(null)
  const [caption, setCaption] = useState<{ title: string; bracket: string } | null>(
    null,
  )

  // Refs so the ONE build effect never re-runs (its deps are []).
  const itemsRef = useRef(items)
  itemsRef.current = items
  const frozenRef = useRef(frozen)
  const fftRef = useRef(dataRef)
  fftRef.current = dataRef
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady
  const onFailRef = useRef(onFail)
  onFailRef.current = onFail
  const controlRef = useRef<GardenControl | null>(null)

  // Prop-driven pause/resume — never rebuilds the scene.
  useEffect(() => {
    frozenRef.current = frozen
    controlRef.current?.updateRunning()
  }, [frozen])

  // Prop-driven data reconcile (adds, removals, size retargets, and the
  // harvest-crack transition when an item's harvestedAt appears).
  useEffect(() => {
    controlRef.current?.reconcile(items)
  }, [items])

  useEffect(() => {
    const mountEl = mountRef.current
    if (!mountEl) return
    // Declared non-null type: hoisted function declarations below (resize,
    // pick) don't inherit const narrowing, so the guard alone can't feed them.
    const el: HTMLDivElement = mountEl
    let disposed = false
    let disposeScene: (() => void) | null = null

    void (async () => {
      let THREE: typeof import('three')
      let gsap: typeof import('gsap')['default']
      try {
        const [threeMod, gsapMod] = await Promise.all([
          import('three'),
          import('gsap'),
        ])
        THREE = threeMod
        gsap = gsapMod.default
      } catch {
        if (!disposed) onFailRef.current()
        return
      }
      if (disposed) return

      // ── Renderer (the one context) ──────────────────────────────────────
      let renderer: WebGLRenderer
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          powerPreference: 'low-power',
        })
      } catch {
        onFailRef.current()
        return
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setClearColor(0x000000, 0) // panel ground shows through
      const canvas = renderer.domElement
      canvas.style.position = 'absolute'
      canvas.style.inset = '0'
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      el.appendChild(canvas)

      // ── Scene ───────────────────────────────────────────────────────────
      const scene: Scene = new THREE.Scene()
      const camera: PerspectiveCamera = new THREE.PerspectiveCamera(
        32,
        1,
        0.1,
        80,
      )

      scene.add(new THREE.AmbientLight(0xffffff, 0.6))
      const keyLight = new THREE.DirectionalLight(0xffffff, 1.0)
      keyLight.position.set(2.5, 4, 2.2)
      scene.add(keyLight)

      // Quiet instrument ground: a hairline grid in panel-text ink.
      const grid = new THREE.GridHelper(
        14,
        28,
        new THREE.Color(DASH_PANEL_TEXT),
        new THREE.Color(DASH_PANEL_TEXT),
      )
      // GridHelper's material is a LineBasicMaterial in three's typings —
      // transparent/opacity/dispose all live on the base Material contract.
      const gridMat: LineBasicMaterial = grid.material
      gridMat.transparent = true
      gridMat.opacity = 0.14
      scene.add(grid)

      // ── Shared materials + geometry variants ────────────────────────────
      const paperMat = new THREE.MeshLambertMaterial({
        color: new THREE.Color(DASH_PAPER),
        flatShading: true,
      })
      const raisedMat = new THREE.MeshLambertMaterial({
        color: new THREE.Color(DASH_PAPER_RAISED),
        flatShading: true,
      })
      const acidMat = new THREE.MeshLambertMaterial({
        color: new THREE.Color(DASH_ACID),
        flatShading: true,
      })

      // Three deterministic jittered icosahedra — organic masses, flat print
      // shading. Jitter keys off quantized vertex POSITION so shared corners
      // move together (PolyhedronGeometry is non-indexed — per-vertex jitter
      // would tear faces apart).
      function makeMassGeometry(seed: number): BufferGeometry {
        const geo = new THREE.IcosahedronGeometry(1, 1)
        const pos = geo.getAttribute('position') as BufferAttribute
        const v = new THREE.Vector3()
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i)
          const key = `${v.x.toFixed(3)}|${v.y.toFixed(3)}|${v.z.toFixed(3)}`
          const k = 1 + (hashStr01(key, seed) - 0.5) * 0.26
          v.multiplyScalar(k)
          pos.setXYZ(i, v.x, v.y, v.z)
        }
        pos.needsUpdate = true
        geo.computeVertexNormals()
        return geo
      }
      const massGeos = [makeMassGeometry(11), makeMassGeometry(23), makeMassGeometry(47)]
      const halfGeo: BufferGeometry = new THREE.IcosahedronGeometry(0.66, 0)

      // ── Entries ─────────────────────────────────────────────────────────
      let entries: MassEntry[] = []
      let ripestId: string | null = null
      const timelines = new Set<gsap.core.Timeline>()

      function baseMatFor(e: MassEntry): MeshLambertMaterial {
        if (e.id === ripestId) return acidMat
        return e.variant ? raisedMat : paperMat
      }

      function applyMats(e: MassEntry): void {
        const mat = baseMatFor(e)
        e.solid.material = mat
        if (!e.flashing) {
          e.halfL.material = mat
          e.halfR.material = mat
        }
      }

      function refreshRipest(): void {
        let best: MassEntry | null = null
        for (const e of entries) {
          if (!best || e.hp > best.hp) best = e
        }
        ripestId = best ? best.id : null
        for (const e of entries) applyMats(e)
      }

      // Final split pose — used directly for items that arrive already
      // harvested (no ceremony replay on reload).
      function setCrackPose(e: MassEntry): void {
        e.solid.visible = false
        e.halfL.visible = true
        e.halfR.visible = true
        e.halfL.position.set(-0.42, 0.06, 0)
        e.halfR.position.set(0.42, -0.02, 0)
        e.halfL.rotation.z = 0.42
        e.halfR.rotation.z = -0.35
      }

      // The GSAP harvest-crack ceremony (§5) — scene-only choreography, one
      // acid flash inside the seal (single 2-step event, never a loop).
      function crack(e: MassEntry): void {
        e.harvested = true
        e.solid.visible = false
        e.halfL.visible = true
        e.halfR.visible = true
        e.halfL.position.set(0, 0.02, 0)
        e.halfR.position.set(0, -0.02, 0)
        e.halfL.rotation.set(0, 0, 0)
        e.halfR.rotation.set(0, 0, 0)
        e.flashing = true
        e.halfL.material = acidMat
        e.halfR.material = acidMat
        const tl = gsap.timeline({
          onComplete: () => {
            timelines.delete(tl)
          },
        })
        tl.to(e.halfL.position, { x: -0.42, y: 0.06, duration: CRACK_SECONDS, ease: 'power3.out' }, 0)
        tl.to(e.halfR.position, { x: 0.42, y: -0.02, duration: CRACK_SECONDS, ease: 'power3.out' }, 0)
        tl.to(e.halfL.rotation, { z: 0.42, duration: CRACK_SECONDS, ease: 'power2.out' }, 0)
        tl.to(e.halfR.rotation, { z: -0.35, duration: CRACK_SECONDS, ease: 'power2.out' }, 0)
        tl.call(
          () => {
            e.flashing = false
            applyMats(e)
          },
          undefined,
          0.18,
        )
        timelines.add(tl)
      }

      function killEntryTweens(e: MassEntry): void {
        gsap.killTweensOf(e.halfL.position)
        gsap.killTweensOf(e.halfR.position)
        gsap.killTweensOf(e.halfL.rotation)
        gsap.killTweensOf(e.halfR.rotation)
      }

      function createEntry(item: ContentItem, grownIn: boolean): MassEntry {
        const geoIdx = Math.min(
          massGeos.length - 1,
          Math.floor(hashStr01(item.id, 4) * massGeos.length),
        )
        const solid = new THREE.Mesh(massGeos[geoIdx], paperMat)
        const halfL = new THREE.Mesh(halfGeo, paperMat)
        const halfR = new THREE.Mesh(halfGeo, paperMat)
        halfL.visible = false
        halfR.visible = false
        halfL.scale.set(1, 0.82, 0.9)
        halfR.scale.set(0.92, 0.78, 1)
        const group = new THREE.Group()
        group.add(solid, halfL, halfR)
        scene.add(group)
        const hp = currentHp(item)
        const target = scaleFor(hp)
        const e: MassEntry = {
          id: item.id,
          item,
          title: item.title,
          group,
          solid,
          halfL,
          halfR,
          variant: hashStr01(item.id, 2) > 0.5,
          phase: hashStr01(item.id, 1),
          zJitter: (hashStr01(item.id, 3) - 0.5) * 2.2,
          hp,
          scaleTarget: target,
          // Items added AFTER boot (a fresh publish) grow in from half size;
          // the boot population mounts settled (no entrance theater).
          scaleNow: grownIn ? target * 0.5 : target,
          harvested: false,
          flashing: false,
        }
        if (item.harvestedAt) {
          e.harvested = true
          setCrackPose(e)
        }
        return e
      }

      function removeEntry(e: MassEntry): void {
        killEntryTweens(e)
        scene.remove(e.group)
        // Geometries/materials are shared pool objects — disposed once, below.
      }

      function layout(): void {
        const n = entries.length
        const spread = n <= 1 ? 0 : Math.min(8.4, (n - 1) * 1.05)
        entries.forEach((e, i) => {
          const t = n <= 1 ? 0.5 : i / (n - 1)
          e.group.position.x = -spread / 2 + spread * t
          e.group.position.z = e.zJitter * (n > 6 ? 1 : 0.6)
        })
        camera.position.set(0, 3.1, 6.2 + spread * 0.42)
        camera.lookAt(0, 0.5, 0)
      }

      // Deterministic rest pose — the settled frame painted before the loop
      // starts (and the frame that persists whenever we freeze).
      function applyRestPose(): void {
        for (const e of entries) {
          e.group.scale.setScalar(e.scaleNow)
          e.group.position.y = e.scaleNow * 0.85
          e.group.rotation.y = e.phase * Math.PI * 2
        }
      }

      function reconcile(next: ContentItem[]): void {
        const bounded = next.slice(0, MAX_MASSES)
        const prevById = new Map(entries.map((e) => [e.id, e]))
        const nextEntries: MassEntry[] = []
        const booted = entries.length > 0
        for (const item of bounded) {
          const existing = prevById.get(item.id)
          if (existing) {
            prevById.delete(item.id)
            existing.item = item
            existing.title = item.title
            existing.hp = currentHp(item)
            existing.scaleTarget = scaleFor(existing.hp)
            const harvestedNow = !!item.harvestedAt
            if (harvestedNow && !existing.harvested) crack(existing)
            else if (!harvestedNow) existing.harvested = false
            nextEntries.push(existing)
          } else {
            nextEntries.push(createEntry(item, booted))
          }
        }
        for (const orphan of prevById.values()) removeEntry(orphan)
        entries = nextEntries
        layout()
        refreshRipest()
        renderOnce()
      }

      // ── The rAF loop (30fps gate; sole scheduler = updateRunning) ────────
      let raf = 0
      let last = 0
      let fftSmoothed = 0
      let pageVisible = document.visibilityState === 'visible'
      let intersecting = true
      let contextLost = false
      let readySent = false

      function tick(t: number): void {
        raf = requestAnimationFrame(tick)
        if (t - last < MIN_FRAME_MS) return
        last = t
        const time = t / 1000

        // FFT ripple — dataRef read in place, EMA-smoothed (≈0.6Hz), quiet.
        const d = fftRef.current?.current
        let level = 0
        if (d && d.length > 0) {
          const bins = Math.min(FFT_BINS, d.length)
          let sum = 0
          for (let i = 0; i < bins; i++) sum += d[i]
          level = sum / (bins * 255)
        }
        fftSmoothed += (level - fftSmoothed) * FFT_EMA

        for (const e of entries) {
          e.scaleNow += (e.scaleTarget - e.scaleNow) * 0.06
          e.group.scale.setScalar(e.scaleNow)
          const bobAmp = (0.045 + fftSmoothed * 0.22) * e.scaleNow
          e.group.position.y =
            e.scaleNow * 0.85 +
            Math.sin(time * (BOB_HZ * Math.PI * 2) + e.phase * Math.PI * 2) * bobAmp
          e.group.rotation.y = e.phase * Math.PI * 2 + time * 0.06
        }
        renderer.render(scene, camera)
      }

      // Single discrete repaint while paused (resize / reconcile) — a frozen
      // instrument may re-print its plate; it never re-starts its motor.
      function renderOnce(): void {
        if (disposed || contextLost || raf !== 0) return
        applyRestPose()
        renderer.render(scene, camera)
      }

      // THE scheduler: every pause condition funnels here. Offscreen or
      // hidden or frozen (compose/expanded-visualizer) ⇒ rAF cancelled ⇒
      // zero frames — DevTools-verifiable.
      function updateRunning(): void {
        const shouldRun =
          !disposed && !contextLost && !frozenRef.current && pageVisible && intersecting
        if (shouldRun && raf === 0) {
          last = 0
          raf = requestAnimationFrame(tick)
        } else if (!shouldRun && raf !== 0) {
          cancelAnimationFrame(raf)
          raf = 0
        }
      }

      // ── Sizing (offsetWidth/offsetHeight only — transform trap) ─────────
      // DPR sharpness (judge FIX-B 2): re-read devicePixelRatio (clamped ≤2
      // per §5) on EVERY resize and push it through setPixelRatio BEFORE
      // setSize, so the drawing buffer is w×dpr — never a CSS-pixel buffer
      // upscaled by the 100%-sized canvas. setSize(w, h, false) leaves the
      // canvas CSS at the inset-0 100%/100% set at mount, which is exactly
      // the same box — backing store and CSS size stay in sync by contract.
      function resize(): void {
        const w = el.offsetWidth
        const h = el.offsetHeight
        if (w < 4 || h < 4) return
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        if (renderer.getPixelRatio() !== dpr) renderer.setPixelRatio(dpr)
        renderer.setSize(w, h, false)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderOnce()
      }
      const ro = new ResizeObserver(resize)
      ro.observe(el)

      // Zoom / monitor-move changes devicePixelRatio WITHOUT firing the
      // ResizeObserver (CSS box unchanged) — watch it via a re-registered
      // resolution media query so the buffer re-sharpens immediately.
      let dprMql: MediaQueryList | null = null
      const onDprChange = () => {
        resize()
        watchDpr()
      }
      function watchDpr(): void {
        dprMql?.removeEventListener('change', onDprChange)
        dprMql = window.matchMedia(
          `(resolution: ${window.devicePixelRatio || 1}dppx)`,
        )
        dprMql.addEventListener('change', onDprChange)
      }
      watchDpr()

      // ── Pause plumbing ──────────────────────────────────────────────────
      const onVisibility = () => {
        pageVisible = document.visibilityState === 'visible'
        updateRunning()
      }
      document.addEventListener('visibilitychange', onVisibility)

      const io = new IntersectionObserver((obsEntries) => {
        for (const oe of obsEntries) intersecting = oe.isIntersecting
        updateRunning()
      })
      io.observe(el)

      const onContextLost = (ev: Event) => {
        ev.preventDefault()
        contextLost = true
        updateRunning()
        onFailRef.current() // demote to the finished canvas-2D rung
      }
      canvas.addEventListener('webglcontextlost', onContextLost)

      // ── Pointer: hover names item + bracket; click scrolls to card ──────
      const raycaster: Raycaster = new THREE.Raycaster()
      const pointer: Vector2 = new THREE.Vector2()
      let lastHoverId: string | null = null

      function pick(ev: PointerEvent | MouseEvent): MassEntry | null {
        const w = el.offsetWidth
        const h = el.offsetHeight
        if (!w || !h) return null
        pointer.set((ev.offsetX / w) * 2 - 1, -(ev.offsetY / h) * 2 + 1)
        raycaster.setFromCamera(pointer, camera)
        const meshes: Mesh[] = []
        for (const e of entries) {
          if (e.solid.visible) meshes.push(e.solid)
          if (e.halfL.visible) meshes.push(e.halfL, e.halfR)
        }
        const hits = raycaster.intersectObjects(meshes, false)
        const first = hits[0]
        if (!first) return null
        return (
          entries.find(
            (e) =>
              e.solid === first.object ||
              e.halfL === first.object ||
              e.halfR === first.object,
          ) ?? null
        )
      }

      const onPointerMove = (ev: PointerEvent) => {
        if (disposed) return
        const hit = pick(ev)
        const hitId = hit ? hit.id : null
        if (hitId === lastHoverId) return
        lastHoverId = hitId
        el.style.cursor = hit ? 'pointer' : ''
        setCaption(hit ? { title: hit.title, bracket: hlBracket(hit.hp) } : null)
      }
      const onPointerLeave = () => {
        if (disposed) return
        lastHoverId = null
        el.style.cursor = ''
        setCaption(null)
      }
      const onClick = (ev: MouseEvent) => {
        if (disposed) return
        const hit = pick(ev)
        if (hit) onSelectRef.current(hit.id)
      }
      el.addEventListener('pointermove', onPointerMove)
      el.addEventListener('pointerleave', onPointerLeave)
      el.addEventListener('click', onClick)

      // ── 30s live-HP recompute (same cadence as the fallback) ────────────
      const hpInterval = window.setInterval(() => {
        if (disposed) return
        const now = new Date()
        for (const e of entries) {
          e.hp = currentHp(e.item, now)
          e.scaleTarget = scaleFor(e.hp)
        }
        refreshRipest()
      }, GARDEN_HP_RECOMPUTE_MS)

      // ── Boot ────────────────────────────────────────────────────────────
      resize()
      reconcile(itemsRef.current)
      applyRestPose()
      renderer.render(scene, camera) // first frame before the fallback yields
      if (!readySent) {
        readySent = true
        onReadyRef.current()
      }
      controlRef.current = { updateRunning, reconcile }
      updateRunning()

      // ── Dispose (full manual — never loseContext) ───────────────────────
      disposeScene = () => {
        controlRef.current = null
        if (raf !== 0) cancelAnimationFrame(raf)
        raf = 0
        window.clearInterval(hpInterval)
        ro.disconnect()
        io.disconnect()
        dprMql?.removeEventListener('change', onDprChange)
        dprMql = null
        document.removeEventListener('visibilitychange', onVisibility)
        canvas.removeEventListener('webglcontextlost', onContextLost)
        el.removeEventListener('pointermove', onPointerMove)
        el.removeEventListener('pointerleave', onPointerLeave)
        el.removeEventListener('click', onClick)
        el.style.cursor = ''
        for (const tl of timelines) tl.kill()
        timelines.clear()
        for (const e of entries) killEntryTweens(e)
        entries = []
        for (const g of massGeos) g.dispose()
        halfGeo.dispose()
        grid.geometry.dispose()
        gridMat.dispose()
        paperMat.dispose()
        raisedMat.dispose()
        acidMat.dispose()
        renderer.dispose()
        if (canvas.parentNode === el) el.removeChild(canvas)
      }
      if (disposed) disposeScene()
    })()

    return () => {
      disposed = true
      disposeScene?.()
    }
    // Build once; every later input flows through refs + controlRef.
  }, [])

  return (
    <div className="absolute inset-0">
      {/* No numeral here — the zone's ONE count lives in the panel eyebrow
          (judge FIX-B 4). */}
      <div
        ref={mountRef}
        aria-label="Jardín de señal de tus publicaciones"
        className="absolute inset-0"
      />
      {caption && <GardenCaption title={caption.title} bracket={caption.bracket} />}
    </div>
  )
}

// ── Orchestrator: capability gate + idle mount + degradation ladder ─────────

type GardenMode = 'pending' | 'gl' | 'fallback'

export function HarvestGarden({ items, onSelect, frozen = false }: HarvestGardenProps) {
  const [mode, setMode] = useState<GardenMode>('pending')
  const [glReady, setGlReady] = useState(false)
  // The visualizer-slot freeze (MixOverlay AND LivePreview compose preview)
  // — the same subscription NowPlayingHud uses to yield its context.
  const expandedActive = useExpandedVisualizerActive()

  const demote = useCallback(() => {
    setGlReady(false)
    setMode('fallback')
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    let idleId: number | null = null
    let timeoutId: number | null = null
    if (mq.matches || !passesCapabilityGate()) {
      // Reduced motion / gated out: the finished canvas-2D rung, zero rAF.
      setMode('fallback')
    } else {
      // Idle mount — the garden never rides the first-paint chain (§5).
      const w = window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
        cancelIdleCallback?: (id: number) => void
      }
      if (w.requestIdleCallback) {
        idleId = w.requestIdleCallback(() => setMode('gl'), { timeout: 2000 })
      } else {
        timeoutId = window.setTimeout(() => setMode('gl'), 250)
      }
    }
    // Live demotion if the OS preference flips to reduce mid-session.
    const onChange = () => {
      if (mq.matches) demote()
    }
    mq.addEventListener('change', onChange)
    return () => {
      mq.removeEventListener('change', onChange)
      const w = window as Window & { cancelIdleCallback?: (id: number) => void }
      if (idleId !== null && w.cancelIdleCallback) w.cancelIdleCallback(idleId)
      if (timeoutId !== null) window.clearTimeout(timeoutId)
    }
  }, [demote])

  // Zero published items ⇒ zero contexts (§5 ladder) — the GL core unmounts
  // (full dispose) and the fallback prints the empty ruling.
  const showGl = mode === 'gl' && items.length > 0

  // If the GL rung retires (empty data / demotion), the understudy must be
  // back in place before any future remount's first frame.
  useEffect(() => {
    if (!showGl) setGlReady(false)
  }, [showGl])

  return (
    <div className="relative h-full w-full bg-panel">
      {(!showGl || !glReady) && (
        <div className="absolute inset-0">
          <GardenFallback items={items} onSelect={onSelect} />
        </div>
      )}
      {showGl && (
        <GardenGlCore
          items={items}
          onSelect={onSelect}
          frozen={frozen || expandedActive}
          onReady={() => setGlReady(true)}
          onFail={demote}
        />
      )}
    </div>
  )
}
