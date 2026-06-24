'use client'

// ParticleField3D — the marquee GPU particle audio visualizer (redesign 2026).
//
// Replaces the old Reproductor3D waterfall, keeping its prop interface (data,
// sampleRate, orientation, interactive) so the swap in AudioPlayer3D /
// NowPlayingHud was mechanical. Architecture:
//
//   • GPGPU via GPUComputationRenderer (three/examples/jsm/misc): two compute
//     variables — texturePosition + textureVelocity — ping-ponged in FBOs.
//     Velocity is advected by a divergence-free CURL-NOISE flow field around a
//     central attractor (components/audio/particleShaders.ts). Position
//     integrates velocity and RESPAWNS escaped/expired particles on a seeded
//     sphere near the center — so the cloud is stable and infinite-feeling.
//     Deterministic seeding by particle index (in-shader hashes), NO per-frame
//     RNG → reproducible, never strobes.
//
//   • ALIVE AT REST: the curl flow + attractor never stop, and the camera slow-
//     orbits, so the field looks gorgeous with zero audio. Audio is a
//     SUPERCHARGE layer applied through uniforms (band/energy extraction via
//     extractBands + a trackEnergy EMA, the same envelope idea as the old
//     waterfall):
//       bass  → relaxes attractor + radial expansion ("breath" on kicks)
//       energy→ flow speed + particle size + brightness/alpha
//       bright→ color position along VIBE_SLOT_COLORS (cool↔hot)
//       high  → fine turbulence / sparkle (finer curl scale, faster turnover)
//     When data is null these rest at a calm baseline (IDLE_BANDS).
//
//   • RENDER: additive-blended THREE.Points with a procedural soft circular
//     sprite (no texture file), size attenuation, color sampled ALONG the
//     11-slot thermal ramp (uniform array, on-ramp blends only).
//
//   • BLOOM: EffectComposer → RenderPass → UnrealBloomPass for the signature
//     glow. Strength breathes with energy but is SMOOTHED (EMA) and CLAMPED
//     (≤ BLOOM_STRENGTH_MAX, change ≤3Hz) so it never strobes.
//
// WebGL hygiene (matches VibeFluid / CRTShader): DPR clamp ≤2, fps cap,
// visibilitychange pause, powerPreference 'low-power', prefers-reduced-motion →
// a single settled static frame (no RAF), and FULL disposal on unmount (RAF
// cancel, GPUComputationRenderer.dispose, composer + bloom + their render
// targets, geometries/materials/textures, renderer, canvas removal). NEVER
// loseContext. This component opens exactly ONE context — the same one the old
// Reproductor3D opened — so the net context count is unchanged (home idle stays
// at 2: CRTShader + VibeFluid; this mounts only when a track is loaded).

import { useEffect, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { VIBE_SLOT_COLORS } from '@/lib/utils'
import {
  extractBands,
  IDLE_BANDS,
  POSITION_FRAG,
  VELOCITY_FRAG,
  RENDER_VERT,
  RENDER_FRAG,
  type BandEnergies,
} from './particleShaders'

// ── Prop interface — IDENTICAL to Reproductor3DProps (mechanical swap) ────────
export interface ParticleField3DProps {
  // Latest FFT magnitudes from an AnalyserNode.getByteFrequencyData call.
  // When null/absent, the field runs its at-rest procedural flow. Used by the
  // /lab/audio (audio-element) path.
  data?: Uint8Array | null
  // Preferred for the live tab-capture path: a STABLE ref whose .current holds
  // the latest FFT (updated in place each frame). Lets the provider expose the
  // feed without re-rendering 60×/s — the field reads dataRef.current in its
  // render loop. Takes precedence over `data` when both are present.
  dataRef?: RefObject<Uint8Array | null>
  // Sample rate of the AudioContext that produced `data`. Defaults to 44100.
  sampleRate?: number
  className?: string
  // 'landscape' (default) — large, the star of the mix overlay.
  // 'portrait'  — narrow rail mount: smaller particle budget, tighter framing.
  orientation?: 'landscape' | 'portrait'
  // When false, skip OrbitControls (small embedded viewports).
  interactive?: boolean
}

// ── KNOBS ─────────────────────────────────────────────────────────────────────
// Compute texture edge. 256×256 = 65,536 particles (desktop / landscape).
const PARTICLE_TEX = 256
// Smaller budget for the narrow portrait rail (128×128 = 16,384 particles).
const PARTICLE_TEX_PORTRAIT = 128
// Curl-noise spatial frequency. Higher = tighter, busier swirls.
const CURL_SCALE = 0.32
// Base advection speed (audio energy raises it).
const FLOW_SPEED = 0.9
// Pull toward the central attractor (bass relaxes it).
const ATTRACTOR_STRENGTH = 0.55
// Velocity damping per step (<1 → field settles, never explodes).
const VELOCITY_DAMPING = 0.96
// Soft outer bound of the cloud, world units.
const FIELD_RADIUS = 3.4
// Respawn radius — particles re-seed within this of the center.
const RESPAWN_RADIUS = 1.1
// Life consumed per second (≈ 9–14s lifespan, faster under audio).
const LIFE_RATE = 0.08
// Base point size (px at unit view distance, pre-DPR).
const POINT_SIZE = 26
const POINT_SIZE_PORTRAIT = 18
// Bloom — tasteful glow on bright cores only.
const BLOOM_STRENGTH = 0.6
const BLOOM_STRENGTH_MAX = 0.92 // hard ceiling for the energy-breathing strength
const BLOOM_RADIUS = 0.6
const BLOOM_THRESHOLD = 0.32 // only brighter cores bloom — keeps the field from washing out
// Frame-rate cap (frame-time gate, like VibeFluid/CRTShader).
const FPS_CAP = 60
// Energy gain applied to the INSTANTANEOUS band energy before it drives motion
// + size (fast attack — see applyAudio). Higher = the field surges harder on
// loud passages.
const ENERGY_GAIN = 1.9
// Kick onset gain — multiplies how far the live low band sits above its running
// mean. Higher = more sensitive kick detection (more frequent/stronger bursts).
const KICK_GAIN = 7.0
// DPR clamp.
const DPR_CAP = 2
// Fixed sim timestep (decoupled from real frame time for stability).
const SIM_DT = 0.016
// ──────────────────────────────────────────────────────────────────────────────

// VIBE ramp as linear THREE.Color → flat Float32 for the uniform array. The
// render fragment shader samples ALONG this (on-ramp blends only).
const RAMP_COLORS: THREE.Color[] = VIBE_SLOT_COLORS.map((hex) => new THREE.Color(hex))

export function ParticleField3D({
  data,
  dataRef,
  sampleRate = 44100,
  className,
  orientation = 'landscape',
  interactive = true,
}: ParticleField3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  // Stable refs to latest inputs so the render loop reads them without remount.
  // dataPropRef mirrors the `data` prop (the /lab path); the external `dataRef`
  // prop, when provided, takes precedence in the render loop.
  const dataPropRef = useRef<Uint8Array | null>(data ?? null)
  // Stable holder for the external dataRef prop (the live tab-capture feed) so
  // the WebGL effect reads it without depending on the prop identity.
  const externalDataRef = useRef(dataRef)
  const sampleRateRef = useRef(sampleRate)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])
  useEffect(() => {
    dataPropRef.current = data ?? null
  }, [data])
  useEffect(() => {
    externalDataRef.current = dataRef
  }, [dataRef])
  useEffect(() => {
    sampleRateRef.current = sampleRate
  }, [sampleRate])

  useEffect(() => {
    if (!mounted) return
    const container = containerRef.current
    if (!container) return

    const portrait = orientation === 'portrait'
    const texSize = portrait ? PARTICLE_TEX_PORTRAIT : PARTICLE_TEX
    const pointSize = portrait ? POINT_SIZE_PORTRAIT : POINT_SIZE

    // ── Renderer ────────────────────────────────────────────────────────────
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: true,
        powerPreference: 'low-power',
      })
    } catch {
      return
    }
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP)
    renderer.setPixelRatio(dpr)
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'

    // GPUComputationRenderer needs float render targets. Prefer HalfFloat
    // (broadly renderable on WebGL2 + EXT_color_buffer_*); fall back to Float
    // where half isn't color-renderable. If neither works, bail to a static
    // non-canvas state rather than render a blank context.
    const gl = renderer.getContext()
    const isWebGL2 =
      typeof WebGL2RenderingContext !== 'undefined' &&
      gl instanceof WebGL2RenderingContext
    const halfRenderable = isWebGL2
      ? !!(
          gl.getExtension('EXT_color_buffer_half_float') ||
          gl.getExtension('EXT_color_buffer_float')
        )
      : !!gl.getExtension('OES_texture_half_float')
    const floatRenderable = isWebGL2
      ? !!gl.getExtension('EXT_color_buffer_float')
      : !!gl.getExtension('OES_texture_float')
    if (!halfRenderable && !floatRenderable) {
      renderer.dispose()
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
      return
    }

    // ── GPGPU compute ─────────────────────────────────────────────────────────
    const gpu = new GPUComputationRenderer(texSize, texSize, renderer)
    if (halfRenderable) gpu.setDataType(THREE.HalfFloatType)

    // Initial state textures. Position .xyz seeded on a sphere shell, .w = life;
    // velocity ≈ 0 (the curl flow accelerates them from rest). Deterministic —
    // a hash of the texel index, NOT Math.random — so the field is reproducible
    // and HMR/StrictMode remounts look identical.
    const posTex = gpu.createTexture()
    const velTex = gpu.createTexture()
    const pArr = posTex.image.data as Float32Array
    const vArr = velTex.image.data as Float32Array
    const count = texSize * texSize
    const hash = (n: number) => {
      const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
      return s - Math.floor(s)
    }
    for (let i = 0; i < count; i++) {
      const h1 = hash(i + 1)
      const h2 = hash(i + 1.37)
      const h3 = hash(i + 2.71)
      // Uniform-ish point on a sphere shell at varied radius.
      const theta = h1 * Math.PI * 2
      const phi = Math.acos(2 * h2 - 1)
      const rad = RESPAWN_RADIUS * (0.3 + h3 * 1.7)
      pArr[i * 4 + 0] = rad * Math.sin(phi) * Math.cos(theta)
      pArr[i * 4 + 1] = rad * Math.sin(phi) * Math.sin(theta)
      pArr[i * 4 + 2] = rad * Math.cos(phi)
      pArr[i * 4 + 3] = 0.2 + hash(i + 5.3) * 0.8 // staggered initial life
      vArr[i * 4 + 0] = 0
      vArr[i * 4 + 1] = 0
      vArr[i * 4 + 2] = 0
      vArr[i * 4 + 3] = 1
    }

    const velVar = gpu.addVariable('textureVelocity', VELOCITY_FRAG, velTex)
    const posVar = gpu.addVariable('texturePosition', POSITION_FRAG, posTex)
    gpu.setVariableDependencies(velVar, [velVar, posVar])
    gpu.setVariableDependencies(posVar, [velVar, posVar])

    const velUniforms = velVar.material.uniforms
    velUniforms.u_time = { value: 0 }
    velUniforms.u_dt = { value: SIM_DT }
    velUniforms.u_curlScale = { value: CURL_SCALE }
    velUniforms.u_flowSpeed = { value: FLOW_SPEED }
    velUniforms.u_attractor = { value: ATTRACTOR_STRENGTH }
    velUniforms.u_bass = { value: 0 }
    velUniforms.u_mid = { value: 0 }
    velUniforms.u_high = { value: 0 }
    velUniforms.u_kick = { value: 0 }
    velUniforms.u_energy = { value: 0 }
    velUniforms.u_damping = { value: VELOCITY_DAMPING }
    velUniforms.u_fieldRadius = { value: FIELD_RADIUS }

    const posUniforms = posVar.material.uniforms
    posUniforms.u_dt = { value: SIM_DT }
    posUniforms.u_time = { value: 0 }
    posUniforms.u_fieldRadius = { value: FIELD_RADIUS }
    posUniforms.u_respawnRadius = { value: RESPAWN_RADIUS }
    posUniforms.u_lifeRate = { value: LIFE_RATE }
    posUniforms.u_energy = { value: 0 }

    const gpuError = gpu.init()
    if (gpuError !== null) {
      // Compute couldn't initialize — tear down cleanly, render nothing.
      gpu.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
      return
    }

    // ── Scene + camera ────────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100)
    // Portrait rail: pull in tighter and frame closer.
    const camDist = portrait ? 6.2 : 7.2
    camera.position.set(0, 0, camDist)
    camera.lookAt(0, 0, 0)

    // ── Particle geometry: one vertex per compute texel ─────────────────────
    const refs = new Float32Array(count * 2)
    const seeds = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const x = i % texSize
      const y = Math.floor(i / texSize)
      refs[i * 2 + 0] = (x + 0.5) / texSize
      refs[i * 2 + 1] = (y + 0.5) / texSize
      seeds[i] = hash(i + 9.1)
    }
    const geometry = new THREE.BufferGeometry()
    // Dummy position attribute (the real position comes from the texture in the
    // vertex shader); three needs a `position` attribute to size the draw call.
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(count * 3), 3),
    )
    geometry.setAttribute('a_ref', new THREE.BufferAttribute(refs, 2))
    geometry.setAttribute('a_seed', new THREE.BufferAttribute(seeds, 1))
    // Static bounding sphere so three never frustum-culls the whole cloud while
    // the GPU moves the points (the on-CPU `position` attr stays at origin).
    geometry.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, 0, 0),
      FIELD_RADIUS * 2,
    )

    const rampFlat = new Float32Array(RAMP_COLORS.length * 3)
    RAMP_COLORS.forEach((c, i) => {
      rampFlat[i * 3 + 0] = c.r
      rampFlat[i * 3 + 1] = c.g
      rampFlat[i * 3 + 2] = c.b
    })

    const particleMat = new THREE.ShaderMaterial({
      vertexShader: RENDER_VERT,
      fragmentShader: RENDER_FRAG,
      uniforms: {
        u_posTex: { value: gpu.getCurrentRenderTarget(posVar).texture },
        u_pointSize: { value: pointSize },
        u_energy: { value: 0 },
        u_kick: { value: 0 },
        u_brightness: { value: IDLE_BANDS.brightness },
        u_dpr: { value: dpr },
        u_time: { value: 0 },
        u_ramp: { value: rampFlat },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    })
    const points = new THREE.Points(geometry, particleMat)
    points.frustumCulled = false
    scene.add(points)

    // ── Orbit controls — slow auto-orbit at rest; range-locked when interactive
    // (copied from Reproductor3D: damped, zoom/pan locked, narrow band). ──────
    let controls: OrbitControls | null = null
    if (interactive) {
      controls = new OrbitControls(camera, renderer.domElement)
      controls.target.set(0, 0, 0)
      controls.enableZoom = false
      controls.enablePan = false
      controls.enableDamping = true
      controls.dampingFactor = 0.08
      controls.rotateSpeed = 0.45
      controls.autoRotate = true
      controls.autoRotateSpeed = 0.35 // gentle continuous orbit at rest
      const initialOffset = new THREE.Vector3().subVectors(
        camera.position,
        controls.target,
      )
      const initialSph = new THREE.Spherical().setFromVector3(initialOffset)
      const POLAR_RANGE = 0.5
      controls.minPolarAngle = Math.max(0.05, initialSph.phi - POLAR_RANGE)
      controls.maxPolarAngle = Math.min(Math.PI - 0.05, initialSph.phi + POLAR_RANGE)
      // azimuth left free → the auto-orbit sweeps all the way around
    }

    // ── Bloom composer ──────────────────────────────────────────────────────
    const composer = new EffectComposer(renderer)
    composer.renderToScreen = true
    const renderPass = new RenderPass(scene, camera)
    renderPass.clearAlpha = 0 // keep the canvas transparent (CRT chrome behind)
    composer.addPass(renderPass)
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(1, 1), // sized in resize()
      BLOOM_STRENGTH,
      BLOOM_RADIUS,
      BLOOM_THRESHOLD,
    )
    composer.addPass(bloomPass)

    // ── prefers-reduced-motion ──────────────────────────────────────────────
    const reducedMotionMq = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reducedMotion = reducedMotionMq.matches
    const onReducedMotion = () => {
      reducedMotion = reducedMotionMq.matches
      // Re-arm the loop: motion → RAF, reduced → settle once then stop.
      cancelAnimationFrame(raf)
      running = true
      if (controls) controls.autoRotate = !reducedMotion
      startLoop()
    }
    reducedMotionMq.addEventListener('change', onReducedMotion)

    // ── Render loop state ─────────────────────────────────────────────────────
    const start = performance.now()
    const targetFrameMs = 1000 / FPS_CAP
    let lastDraw = 0
    let raf = 0
    let running = true
    let trackEnergy = 0 // slow EMA — the "vibe of the moment" (drives COLOR only)
    let lowAvg = 0 // slow running mean of the low band, for kick onset detection
    // Smoothed audio inputs. Motion-driving signals (energy/kick/bass/mid/high)
    // attack FAST so transients read as real hits; only color drifts slowly.
    let sEnergy = 0
    let sBass = 0
    let sMid = 0
    let sHigh = 0
    let sKick = 0
    let sBright = IDLE_BANDS.brightness
    // Smoothed bloom strength — its own EMA + hard clamp (≤3Hz change, no flash).
    let sBloom = BLOOM_STRENGTH

    // Snappy envelope: near-instant attack, quick release — so a kick rises in
    // ~1 frame and falls over a few. Per-particle pops are spatial (not a
    // full-surface luminance flip), so this stays photosensitivity-safe.
    const env = (prev: number, target: number, atk: number, rel: number) =>
      target >= prev ? prev + (target - prev) * atk : prev + (target - prev) * rel

    const applyAudio = (bands: BandEnergies) => {
      // Slow EMA — ONLY the color/vibe drift now (≈1s half-life). Motion no
      // longer hangs off this, which is what made the field feel mushy.
      trackEnergy = trackEnergy * 0.985 + bands.energy * 0.015
      sBright = sBright + (bands.brightness - sBright) * 0.06

      // INSTANTANEOUS energy (not the slow EMA) drives motion + size, with a
      // fast attack so loud passages surge immediately.
      const energyDrive = Math.min(1, bands.energy * ENERGY_GAIN)
      sEnergy = env(sEnergy, energyDrive, 0.6, 0.18)

      // KICK ONSET: a transient detector on the low band. lowAvg is a slow
      // running mean; when the live low band jumps well above it, that's an
      // attack → fire a kick pulse that snaps up and falls fast. This is the
      // punch the field was missing (the old code only had a smoothed bass).
      lowAvg = lowAvg * 0.9 + bands.low * 0.1
      const onset = Math.max(0, bands.low - lowAvg * 1.25) * KICK_GAIN
      const kickTarget = Math.min(1, onset)
      sKick = kickTarget >= sKick ? kickTarget : sKick * 0.80 // snap up, decay fast

      // Per-band envelopes — each gets a distinct visual (see the shader):
      // bass = sustained radial breath, mid = swirl, high = turbulence/sparkle.
      sBass = env(sBass, Math.min(1, bands.low * 1.5), 0.5, 0.14)
      sMid = env(sMid, Math.min(1, bands.mid * 1.8), 0.5, 0.16)
      sHigh = env(sHigh, Math.min(1, bands.high * 1.7), 0.6, 0.20)

      velUniforms.u_energy.value = sEnergy
      velUniforms.u_bass.value = sBass
      velUniforms.u_mid.value = sMid
      velUniforms.u_high.value = sHigh
      velUniforms.u_kick.value = sKick
      posUniforms.u_energy.value = sEnergy
      particleMat.uniforms.u_energy.value = sEnergy
      particleMat.uniforms.u_kick.value = sKick
      particleMat.uniforms.u_brightness.value = sBright

      // Bloom breathes with energy + kick, but stays smoothed + hard-clamped so
      // the GLOBAL surface luminance can't oscillate faster than ~3Hz (the punch
      // lives in the per-particle pops above, which are spatial and safe).
      const bloomTarget = Math.min(
        BLOOM_STRENGTH_MAX,
        BLOOM_STRENGTH + sEnergy * 0.18 + sKick * 0.2,
      )
      sBloom = sBloom + (bloomTarget - sBloom) * 0.08
      bloomPass.strength = sBloom
    }

    const stepAndDraw = (elapsedSec: number) => {
      velUniforms.u_time.value = elapsedSec
      posUniforms.u_time.value = elapsedSec
      particleMat.uniforms.u_time.value = elapsedSec

      const liveData = externalDataRef.current?.current ?? dataPropRef.current
      const bands = liveData
        ? extractBands(liveData, sampleRateRef.current)
        : IDLE_BANDS
      applyAudio(bands)

      gpu.compute()
      // After compute the current position target holds the latest positions.
      particleMat.uniforms.u_posTex.value =
        gpu.getCurrentRenderTarget(posVar).texture

      if (controls) {
        // Interactive: OrbitControls owns the camera (auto-orbit + damped drag).
        controls.update()
      } else {
        // Non-interactive (portrait rail): a slow manual orbit so the field is
        // never a static silhouette. Deterministic — a function of elapsed time.
        const a = elapsedSec * 0.12
        camera.position.set(
          Math.sin(a) * camDist,
          Math.sin(elapsedSec * 0.07) * 0.6,
          Math.cos(a) * camDist,
        )
        camera.lookAt(0, 0, 0)
      }
      composer.render()
    }

    const loop = (now: number) => {
      if (!running) return
      raf = requestAnimationFrame(loop)
      if (now - lastDraw < targetFrameMs) return
      lastDraw = now
      stepAndDraw((now - start) / 1000)
    }

    // Settle into a structured static frame for reduced-motion: advance the sim
    // a fixed number of deterministic steps (curl flow shapes the cloud) then
    // freeze on that single frame. A frozen field is still a field; zero RAF.
    const renderStaticSettled = () => {
      for (let i = 0; i < 140; i++) {
        velUniforms.u_time.value = i * SIM_DT * 4
        posUniforms.u_time.value = i * SIM_DT * 4
        applyAudio(IDLE_BANDS)
        gpu.compute()
      }
      particleMat.uniforms.u_posTex.value =
        gpu.getCurrentRenderTarget(posVar).texture
      particleMat.uniforms.u_time.value = 0
      controls?.update()
      composer.render()
    }

    const startLoop = () => {
      cancelAnimationFrame(raf)
      if (reducedMotion) {
        running = false
        renderStaticSettled()
        return
      }
      running = true
      lastDraw = 0
      raf = requestAnimationFrame(loop)
    }

    // ── Resize — offsetWidth/offsetHeight (immune to OverlayShell CRT scale) ──
    const resize = () => {
      const w = Math.max(1, container.offsetWidth)
      const h = Math.max(1, container.offsetHeight)
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      // EffectComposer sizes its internal read/write targets AND iterates its
      // passes' setSize — including the bloom pass — multiplying CSS px by the
      // renderer's pixelRatio (captured at composer construction) internally.
      // So one call resizes everything; no separate bloomPass.setSize needed.
      composer.setSize(w, h)
      // After a resize while reduced-motion, repaint the settled frame so the
      // panel never shows a stale/blank buffer (the RAF handles the live case).
      if (reducedMotion) renderStaticSettled()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    if (controls) controls.autoRotate = !reducedMotion
    startLoop()

    // ── Pause when tab hidden ─────────────────────────────────────────────────
    const onVisibility = () => {
      if (document.hidden) {
        running = false
        cancelAnimationFrame(raf)
      } else if (!reducedMotion) {
        if (!running) {
          running = true
          lastDraw = 0
          raf = requestAnimationFrame(loop)
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    // ── Disposal — thorough, no loseContext ───────────────────────────────────
    return () => {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      reducedMotionMq.removeEventListener('change', onReducedMotion)
      controls?.dispose()
      // GPUComputationRenderer owns its variable materials, render targets and
      // initial-value textures + an internal fullscreen quad — its dispose()
      // tears all of those down.
      gpu.dispose()
      // Composer owns renderTarget1/2; bloom owns its blur/bright targets +
      // materials. Dispose both (passes are not auto-disposed by the composer).
      bloomPass.dispose()
      composer.dispose()
      geometry.dispose()
      particleMat.dispose()
      renderer.setRenderTarget(null)
      renderer.dispose()
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    }
  }, [mounted, orientation, interactive])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%', position: 'relative' }}
    />
  )
}
