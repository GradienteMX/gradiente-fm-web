'use client'

// VibeFluid — a living teletext signal field behind the home feed.
// (redesign 2026 · SHOWPIECE)
//
// A full-viewport fixed background: a real-time 2D stable-fluids simulation
// (GPU Gems ch.38 lineage) run at LOW resolution, then quantized through a
// teletext block-mosaic display pass. Heat (the dye field) is mapped HARD onto
// the 11-slot thermal ramp from lib/utils — zero-heat reads as near-black, hot
// stirs read as brand-orange teletext blocks. The visitor stirs the signal with
// the pointer; a single slow carrier wave keeps the field alive at rest.
//
// All color comes from VIBE_SLOT_COLORS + black. No RNG anywhere — variation is
// pointer interaction + the deterministic carrier. Photosensitivity-safe: the
// only motion is continuous spatial flow; nothing oscillates full-surface
// luminance (the carrier period is ~20s, far below 3Hz).
//
// House perf etiquette (matches CRTShader / ParticleField3D): one WebGLRenderer,
// DPR clamped to 1, fps-capped, paused on document hidden, a single settled
// frame under prefers-reduced-motion, full disposal on unmount, NEVER
// loseContext. Mounted lazily after idle so LCP is untouched.

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { VIBE_SLOT_COLORS } from '@/lib/utils'
import { getHeatSources } from '@/lib/heatField'
import {
  VERT,
  ADVECT_FRAG,
  SPLAT_FRAG,
  DIVERGENCE_FRAG,
  PRESSURE_FRAG,
  GRADIENT_FRAG,
  AMBIENT_FRAG,
  DISPLAY_FRAG,
} from './shaders'

// ── KNOBS ────────────────────────────────────────────────────────────────────
// Simulation grid. Deliberately tiny — the mosaic pass quantizes the output to
// ~CELL_PX character cells, so finer sim detail would be invisible. This low
// res is the entire perf budget: ~9k cells, ~25 full-screen passes/frame.
const SIM_W = 128
const SIM_H = 72
// Teletext character-cell size in output px (at DPR 1). 12 reads as a teletext
// grid without turning into confetti; smaller = finer/denser, larger = chunkier.
const CELL_PX = 12
// Gap between the 2x3 subcells, in output px. The block-mosaic "grout".
const SUBCELL_GAP_PX = 1
// Heat a subcell must exceed to ignite. Higher = sparser, more selective blocks
// (field reads as quiet); lower = more coverage. The field rests near-empty.
const SUBCELL_THRESHOLD = 0.08
// Dye decay per advection step → the field always settles toward dark.
const DISSIPATION = 0.985
// Velocity decay per step — slightly stronger than dye so stirs calm down.
const VELOCITY_DISSIPATION = 0.965
// Pointer splat gaussian sigma (uv², aspect-corrected). Bigger = broader stir.
const SPLAT_RADIUS = 0.0009
// Heat injected per pointer splat (scaled further by pointer speed). Tuned so
// a calm stroke lands in the cool slots and a fast one reaches the warm/ember
// arc of the ramp — the visitor's energy literally heats the signal.
const SPLAT_HEAT = 0.32
// Velocity injected per pointer splat (scaled by pointer velocity).
const SPLAT_FORCE = 5200
// Ambient carrier strength (pre-dt). Keeps the field alive without input.
const AMBIENT_STRENGTH = 0.85
// Output alpha cap — the field NEVER competes with content legibility. The
// brief lives in the gaps/dark areas; cards are opaque and float above.
const LUMA_CAP = 0.45
// Frame-rate cap (frame-time gate, like CRTShader). 30 is plenty: the mosaic
// hides per-frame sim detail, and the carrier is slow.
const FPS_CAP = 30
// Pressure solve iterations. ~20 is the classic stable-fluids sweet spot.
const PRESSURE_ITERATIONS = 20
// Fixed sim timestep (decoupled from real frame time for stability).
const SIM_DT = 0.016

// ── Card↔fluid thermal coupling (ADDITIVE — heatField consumer) ───────────────
// Each sim frame we poll lib/heatField for the live set of hot DOM cards and
// inject a FAINT ambient dye glow at each card's viewport position, scaled by
// its vibe temperature (0..1). The gutters around prominent HOT cards visibly
// warm; cold cards inject nothing. This is NOT a stir — heat sources are
// stationary glows, so velocity injection is near-zero (a tiny outward push so
// the warmth breathes with the carrier rather than sitting as a static blob).
// DISSIPATION already pulls dye back to dark, so the halos stay faint/localized.
//
// Cadence: inject every HEAT_INJECT_EVERY_N sim frames (not every frame) so the
// total splat cost stays bounded regardless of how many cards are hot, and so
// the warmth accumulates gently rather than saturating. Photosensitivity: this
// is continuous slow accumulation toward a steady state — no oscillation.
//
// Heat injected per source per injection = HEAT_INJECT_SCALE · heat. Tuned far
// below SPLAT_HEAT (0.32) so even a volcán card reads as a soft warm presence in
// the gutters, never a blob that competes with the pointer stir or the content.
const HEAT_INJECT_SCALE = 0.05
// Skip sources below this heat — cold/cool cards contribute nothing (and we
// avoid spending splats on them). A source must be at least lukewarm to glow.
const HEAT_INJECT_THRESHOLD = 0.35
// Inject once every N sim frames (gentle cadence; the rest of the time the dye
// just advects/dissipates). At FPS_CAP 30 this is ~7 injections/sec.
const HEAT_INJECT_EVERY_N = 4
// Broader, softer gaussian than the pointer splat — a card-sized halo, not a
// pinprick stir. Larger u_radius = wider, gentler warmth.
const HEAT_SPLAT_RADIUS = 0.006
// Tiny outward velocity so the warmth drifts/breathes instead of pooling. Two
// orders of magnitude below SPLAT_FORCE — this is a whisper, not a stir.
const HEAT_PUSH = 26
// Hard ceiling on sources processed per injection (defensive — keeps the splat
// count bounded if a huge grid ever reports many hot cards at once).
const HEAT_MAX_SOURCES = 24
// ──────────────────────────────────────────────────────────────────────────────

// Fullscreen triangle in clip space. 3-component (z=0) on purpose: three reads
// `position` as vec3 in computeBoundingSphere, so a vec2 buffer yields NaN z and
// spams "Computed radius is NaN". The vertex shader still declares `vec2 position`
// (GL feeds it the first two components). xy are [-1..3]; z is ignored.
const FULLSCREEN_TRI = new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0])

// Flatten VIBE_SLOT_COLORS into 11 THREE.Color uniforms (linear-correct for the
// renderer's color management). Done once at module load.
const RAMP_UNIFORM: THREE.Color[] = VIBE_SLOT_COLORS.map(
  (hex) => new THREE.Color(hex),
)

interface DoubleTarget {
  read: THREE.WebGLRenderTarget
  write: THREE.WebGLRenderTarget
  swap: () => void
}

function makeDoubleTarget(
  w: number,
  h: number,
  type: THREE.TextureDataType,
  filter: THREE.MagnificationTextureFilter,
): DoubleTarget {
  const opts: THREE.RenderTargetOptions = {
    type,
    format: THREE.RGBAFormat,
    minFilter: filter,
    magFilter: filter,
    depthBuffer: false,
    stencilBuffer: false,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
  }
  const dt: DoubleTarget = {
    read: new THREE.WebGLRenderTarget(w, h, opts),
    write: new THREE.WebGLRenderTarget(w, h, opts),
    swap() {
      const t = this.read
      this.read = this.write
      this.write = t
    },
  }
  return dt
}

export default function VibeFluid() {
  const containerRef = useRef<HTMLCanvasElement | null>(null)
  // Gate: only mount the heavy sim on capable surfaces (lg+, fine pointer,
  // deviceMemory >= 4) and after idle. Matches CRTOverlay.pickMode spirit.
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    // Capability gate first (cheap, synchronous).
    if (!window.matchMedia('(min-width: 1024px) and (pointer: fine)').matches) {
      return
    }
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
    if (typeof mem === 'number' && mem < 4) return

    // Defer mount until the browser is idle so LCP is untouched.
    let idleHandle = 0
    let timeoutHandle = 0
    const ric = (
      window as Window & {
        requestIdleCallback?: (cb: () => void) => number
      }
    ).requestIdleCallback
    if (typeof ric === 'function') {
      idleHandle = ric(() => setEnabled(true))
    } else {
      timeoutHandle = window.setTimeout(() => setEnabled(true), 1200)
    }
    return () => {
      const cic = (
        window as Window & { cancelIdleCallback?: (h: number) => void }
      ).cancelIdleCallback
      if (idleHandle && typeof cic === 'function') cic(idleHandle)
      if (timeoutHandle) window.clearTimeout(timeoutHandle)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    const canvas = containerRef.current
    if (!canvas) return

    // ── Renderer ──────────────────────────────────────────────────────────────
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        premultipliedAlpha: true,
        powerPreference: 'low-power',
        depth: false,
        stencil: false,
      })
    } catch {
      canvas.style.display = 'none'
      return
    }
    renderer.setPixelRatio(1) // DPR clamped to 1 — the mosaic hides resolution.
    renderer.autoClear = false
    renderer.setClearColor(0x000000, 0)

    // Float targets — HALF_FLOAT, the only widely-supported renderable float
    // type on WebGL1/2 without extra extensions.
    const gl = renderer.getContext()
    const isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext
    // Renderability of half-float color: WebGL2 core + EXT_color_buffer_*, or
    // WebGL1 + OES_texture_half_float.
    const canRenderHalfFloat = isWebGL2
      ? !!(gl.getExtension('EXT_color_buffer_half_float') || gl.getExtension('EXT_color_buffer_float'))
      : !!gl.getExtension('OES_texture_half_float')
    if (!canRenderHalfFloat) {
      renderer.dispose()
      canvas.style.display = 'none'
      return
    }
    // LINEAR filtering of half-float textures needs OES_texture_half_float_linear
    // (NOT guaranteed even on WebGL2). When absent, a LINEAR-sampled half-float
    // texture is "incomplete" and samples as ZERO — which silently blanks the
    // whole sim. Fall back to NEAREST: harmless here since the teletext mosaic
    // quantizes the field into ~CELL_PX cells far coarser than a sim texel.
    const SIM_FILTER: THREE.MagnificationTextureFilter = gl.getExtension(
      'OES_texture_half_float_linear',
    )
      ? THREE.LinearFilter
      : THREE.NearestFilter
    const FLOAT_TYPE = THREE.HalfFloatType

    // ── Scene + fullscreen geometry ─────────────────────────────────────────────
    const scene = new THREE.Scene()
    const camera = new THREE.Camera()
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(FULLSCREEN_TRI, 3))
    const quad = new THREE.Mesh(geometry)
    // CRITICAL: the clip-space triangle has no real bounding volume under the
    // identity-projection Camera; three would frustum-cull it and render
    // nothing (every pass writes zeros). Disable culling for the fullscreen
    // pass — the classic three.js fullscreen-quad gotcha.
    quad.frustumCulled = false
    scene.add(quad)

    const simTexel = new THREE.Vector2(1 / SIM_W, 1 / SIM_H)
    const aspect = SIM_W / SIM_H

    // ── Render targets ──────────────────────────────────────────────────────────
    const velocity = makeDoubleTarget(SIM_W, SIM_H, FLOAT_TYPE, SIM_FILTER)
    const dye = makeDoubleTarget(SIM_W, SIM_H, FLOAT_TYPE, SIM_FILTER)
    const divergenceRT = new THREE.WebGLRenderTarget(SIM_W, SIM_H, {
      type: FLOAT_TYPE,
      format: THREE.RGBAFormat,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: false,
      stencilBuffer: false,
    })
    // Pressure + divergence sample exact texel neighbors → always NEAREST.
    const pressure = makeDoubleTarget(SIM_W, SIM_H, FLOAT_TYPE, THREE.NearestFilter)

    // ── Materials (one per pass) ────────────────────────────────────────────────
    const advectMat = new THREE.RawShaderMaterial({
      vertexShader: VERT,
      fragmentShader: ADVECT_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        u_velocity: { value: null },
        u_source: { value: null },
        u_texel: { value: simTexel },
        u_dt: { value: SIM_DT },
        u_dissipation: { value: DISSIPATION },
      },
    })
    const splatMat = new THREE.RawShaderMaterial({
      vertexShader: VERT,
      fragmentShader: SPLAT_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        u_target: { value: null },
        u_value: { value: new THREE.Vector3() },
        u_point: { value: new THREE.Vector2() },
        u_radius: { value: SPLAT_RADIUS },
        u_aspect: { value: aspect },
      },
    })
    const divergenceMat = new THREE.RawShaderMaterial({
      vertexShader: VERT,
      fragmentShader: DIVERGENCE_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        u_velocity: { value: null },
        u_texel: { value: simTexel },
      },
    })
    const pressureMat = new THREE.RawShaderMaterial({
      vertexShader: VERT,
      fragmentShader: PRESSURE_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        u_pressure: { value: null },
        u_divergence: { value: null },
        u_texel: { value: simTexel },
      },
    })
    const gradientMat = new THREE.RawShaderMaterial({
      vertexShader: VERT,
      fragmentShader: GRADIENT_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        u_pressure: { value: null },
        u_velocity: { value: null },
        u_texel: { value: simTexel },
      },
    })
    const ambientMat = new THREE.RawShaderMaterial({
      vertexShader: VERT,
      fragmentShader: AMBIENT_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        u_velocity: { value: null },
        u_time: { value: 0 },
        u_strength: { value: 0 },
        u_aspect: { value: aspect },
      },
    })
    const displayMat = new THREE.RawShaderMaterial({
      vertexShader: VERT,
      fragmentShader: DISPLAY_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      // Premultiplied output (frag multiplies rgb by alpha), so blend One / 1-srcA.
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: {
        u_dye: { value: null },
        u_resolution: { value: new THREE.Vector2() },
        u_simTexel: { value: simTexel },
        u_cellPx: { value: CELL_PX },
        u_threshold: { value: SUBCELL_THRESHOLD },
        u_lumaCap: { value: LUMA_CAP },
        u_gapPx: { value: SUBCELL_GAP_PX },
        u_ramp: { value: RAMP_UNIFORM },
      },
    })

    const allMaterials = [
      advectMat,
      splatMat,
      divergenceMat,
      pressureMat,
      gradientMat,
      ambientMat,
      displayMat,
    ]

    // Render `material` into `target` (null = screen).
    const blit = (
      material: THREE.RawShaderMaterial,
      target: THREE.WebGLRenderTarget | null,
    ) => {
      quad.material = material
      renderer.setRenderTarget(target)
      renderer.render(scene, camera)
    }

    // ── Pointer state ────────────────────────────────────────────────────────────
    // Window-level pointer: the visitor stirs the signal. Dye scales with speed.
    const pointer = {
      x: 0,
      y: 0,
      dx: 0,
      dy: 0,
      moved: false,
      has: false,
    }
    const onPointerMove = (e: PointerEvent) => {
      const w = window.innerWidth
      const h = window.innerHeight
      const nx = e.clientX / w
      const ny = 1 - e.clientY / h // flip — sim uv origin is bottom-left
      if (pointer.has) {
        pointer.dx = nx - pointer.x
        pointer.dy = ny - pointer.y
      }
      pointer.x = nx
      pointer.y = ny
      pointer.has = true
      pointer.moved = true
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })

    // ── Sizing — offsetWidth/Height (never getBoundingClientRect) ────────────────
    const reducedMotionMq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const resize = () => {
      const w = Math.max(1, window.innerWidth)
      const h = Math.max(1, window.innerHeight)
      renderer.setSize(w, h, false)
      displayMat.uniforms.u_resolution.value.set(w, h)
    }
    resize()
    window.addEventListener('resize', resize)

    // ── Sim step ──────────────────────────────────────────────────────────────────
    const splat = (
      target: DoubleTarget,
      px: number,
      py: number,
      vx: number,
      vy: number,
      vz: number,
    ) => {
      splatMat.uniforms.u_target.value = target.read.texture
      splatMat.uniforms.u_point.value.set(px, py)
      splatMat.uniforms.u_value.value.set(vx, vy, vz)
      blit(splatMat, target.write)
      target.swap()
    }

    // Heat-coupling cadence counter (sim-frame index). Lives across step() calls
    // for this mount only; reset is irrelevant (just a modulo phase).
    let heatFrame = 0

    // ── Card↔fluid heat injection ────────────────────────────────────────────
    // Poll the shared heatField and inject a faint warm glow at each hot card's
    // position. Reuses the existing splat path (same SPLAT_FRAG / uniforms),
    // just with a broader radius, far lower amount, and a near-zero outward
    // push. NO-OP when no card clears the threshold. Must be called inside the
    // forcing phase (before divergence) so the tiny push is made div-free too.
    const injectHeatSources = () => {
      const srcs = getHeatSources()
      if (srcs.length === 0) return
      const radiusWas = splatMat.uniforms.u_radius.value
      splatMat.uniforms.u_radius.value = HEAT_SPLAT_RADIUS
      let processed = 0
      for (const s of srcs) {
        if (processed >= HEAT_MAX_SOURCES) break
        if (s.heat < HEAT_INJECT_THRESHOLD) continue
        // heatField x,y are normalized viewport (top-down). The sim uv origin is
        // bottom-left, so flip y — identical convention to onPointerMove.
        const px = s.x
        const py = 1 - s.y
        // Skip anything that resolved offscreen (defensive against stale coords).
        if (px < 0 || px > 1 || py < 0 || py > 1) continue
        const amount = HEAT_INJECT_SCALE * s.heat
        // Faint dye (the warm glow). Display reads the .x channel.
        splat(dye, px, py, amount, amount, amount)
        // Tiny outward push so the halo breathes with the carrier rather than
        // pooling — radial from field center, scaled by heat. Not a stir.
        const ox = px - 0.5
        const oy = py - 0.5
        const olen = Math.hypot(ox, oy) || 1
        const push = HEAT_PUSH * s.heat
        splat(velocity, px, py, (ox / olen) * push, (oy / olen) * push, 0)
        processed++
      }
      splatMat.uniforms.u_radius.value = radiusWas
    }

    const step = (time: number) => {
      // 1. Advect velocity along itself.
      advectMat.uniforms.u_velocity.value = velocity.read.texture
      advectMat.uniforms.u_source.value = velocity.read.texture
      advectMat.uniforms.u_dissipation.value = VELOCITY_DISSIPATION
      blit(advectMat, velocity.write)
      velocity.swap()

      // 2. Advect dye along velocity.
      advectMat.uniforms.u_velocity.value = velocity.read.texture
      advectMat.uniforms.u_source.value = dye.read.texture
      advectMat.uniforms.u_dissipation.value = DISSIPATION
      blit(advectMat, dye.write)
      dye.swap()

      // 3. Ambient carrier — one slow large-scale circulation force.
      ambientMat.uniforms.u_velocity.value = velocity.read.texture
      ambientMat.uniforms.u_time.value = time
      ambientMat.uniforms.u_strength.value = AMBIENT_STRENGTH * SIM_DT
      blit(ambientMat, velocity.write)
      velocity.swap()

      // 4. Pointer force + dye injection (true interaction; speed-scaled).
      if (pointer.moved) {
        const speed = Math.hypot(pointer.dx, pointer.dy)
        const fx = pointer.dx * SPLAT_FORCE
        const fy = pointer.dy * SPLAT_FORCE
        splat(velocity, pointer.x, pointer.y, fx, fy, 0)
        // Dye amount scales with pointer speed — fast strokes heat the signal.
        const heat = Math.min(SPLAT_HEAT * 4, SPLAT_HEAT + speed * 9)
        splat(dye, pointer.x, pointer.y, heat, heat, heat)
        pointer.moved = false
        pointer.dx = 0
        pointer.dy = 0
      }

      // 4b. Card heat coupling — faint warm glow at hot cards (additive). Gentle
      // cadence so cost is bounded; runs inside the forcing phase so its tiny
      // push is folded into the pressure solve. NO-OP when no hot cards exist.
      if (heatFrame % HEAT_INJECT_EVERY_N === 0) injectHeatSources()
      heatFrame++

      // 5. Divergence of the (now forced) velocity field.
      divergenceMat.uniforms.u_velocity.value = velocity.read.texture
      blit(divergenceMat, divergenceRT)

      // 6. Jacobi pressure solve. Clear pressure first (zero initial guess).
      renderer.setRenderTarget(pressure.read)
      renderer.clearColor()
      pressureMat.uniforms.u_divergence.value = divergenceRT.texture
      for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
        pressureMat.uniforms.u_pressure.value = pressure.read.texture
        blit(pressureMat, pressure.write)
        pressure.swap()
      }

      // 7. Subtract pressure gradient → divergence-free velocity.
      gradientMat.uniforms.u_pressure.value = pressure.read.texture
      gradientMat.uniforms.u_velocity.value = velocity.read.texture
      blit(gradientMat, velocity.write)
      velocity.swap()
    }

    const draw = () => {
      displayMat.uniforms.u_dye.value = dye.read.texture
      renderer.setRenderTarget(null)
      renderer.clear(true, false, false)
      blit(displayMat, null)
    }

    // ── Loop ──────────────────────────────────────────────────────────────────────
    const targetFrameMs = 1000 / FPS_CAP
    const start = performance.now()
    let lastDraw = 0
    let raf = 0
    let running = true
    let staticRendered = false

    const loop = (now: number) => {
      if (!running) return
      raf = requestAnimationFrame(loop)

      // Reduced motion: simulate a brief warm-up to populate the field, then
      // freeze on a single settled static frame (a frozen field is still a
      // field). Do this once and stop stepping.
      if (reducedMotionMq.matches) {
        if (!staticRendered) {
          // Seed a few DETERMINISTIC dye splats (fixed positions/temperatures —
          // no RNG) then let the carrier advect them into a structured field,
          // and freeze on that single settled frame. A frozen field is still a
          // field. No further stepping → zero ongoing motion.
          const seeds: [number, number, number][] = [
            [0.28, 0.62, 0.55],
            [0.55, 0.38, 0.8],
            [0.74, 0.66, 0.45],
          ]
          for (const [sx, sy, sh] of seeds) splat(dye, sx, sy, sh, sh, sh)
          for (let i = 0; i < 90; i++) step(i * SIM_DT * 4)
          draw()
          staticRendered = true
        }
        return
      }
      staticRendered = false

      if (now - lastDraw < targetFrameMs) return
      lastDraw = now

      step((now - start) / 1000)
      draw()
    }
    raf = requestAnimationFrame(loop)

    // Pause when tab hidden.
    const onVisibility = () => {
      if (document.hidden) {
        running = false
        cancelAnimationFrame(raf)
      } else if (!running) {
        running = true
        lastDraw = 0
        staticRendered = false
        raf = requestAnimationFrame(loop)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    // ── Disposal — thorough, no loseContext ──────────────────────────────────────
    return () => {
      running = false
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
      geometry.dispose()
      allMaterials.forEach((m) => m.dispose())
      velocity.read.dispose()
      velocity.write.dispose()
      dye.read.dispose()
      dye.write.dispose()
      pressure.read.dispose()
      pressure.write.dispose()
      divergenceRT.dispose()
      renderer.setRenderTarget(null)
      renderer.dispose()
      // No loseContext() — StrictMode/HMR re-runs this effect; a lost context
      // poisons the canvas for the next mount (CRTShader precedent).
    }
  }, [enabled])

  return (
    <canvas
      ref={containerRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 h-screen w-screen"
    />
  )
}
