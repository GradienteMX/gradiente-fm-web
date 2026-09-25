'use client'

/**
 * UMBRAL — the field behind La Puerta.
 *
 * The original welcome's composition, kept: a river of ivory running from
 * the upper left off the lower right, open at both edges, widening into an
 * eye round the face; two dark banks along it (upper right, lower left),
 * the detail along their shores — ivory, sage, moss and a green-black ink,
 * with slate, ochre and mauve pigments. And it flows, as it did: the shores
 * drift downstream and undulate. What changed is
 * how it prints: instead of a recursive fractal, the way the rest of V2
 * prints. A coarse screen of cells; the density stepped into seven levels,
 * each level set in one pattern of the house library — bare paper, fine
 * dots, halftone dots, registration crosses, hazard stripes, pixel blocks,
 * solid ink with knocked-out crosses — and the pigments as a spot plate of
 * flat blocks in the transition, printed a hair out of register.
 *
 * The river flows in printed steps (FLOW_FPS a second; the engine skips
 * the frames in between); everything else is an event:
 *   print   on arrival the cells print in, in a dither order, heavy first
 *   hand    round the pointer the print develops toward the middle patterns,
 *           in stepped rings (in the dark and in the eye alike)
 *   pulse   a keystroke sends a ring of heavier print out from the eye
 *   cold    an unknown code: the print thins and the spot plate slips
 *   open    a valid code: the eye widens to receive the card
 *   aim     the eye travels to wherever the card lands (registration)
 * Reduced motion: printed at once, a still river, no hand, no pulses; the
 * eye opens at once.
 * Without WebGL the page's own radial gradient stands in (globals.css).
 *
 * A stage window (behind the DOM, under the credencial's window), portaled
 * to <body> so route transitions never move it.
 */

import { forwardRef, useImperativeHandle, useRef } from 'react'
import { createPortal } from 'react-dom'
import * as THREE from 'three'
import gsap from 'gsap'
import { useStageWindow } from '@/components/stage/api'
import { useHydrated } from '@/lib/useMedia'
import styles from './Puerta.module.css'

export interface UmbralHandle {
  /** A keystroke: a ring of heavier print runs out from the eye. */
  pulse: () => void
  /** An unknown or spent code: the print thins, the spot plate slips. */
  shudder: () => void
  /** A valid code: the eye widens to receive the card. */
  open: () => void
  /** Back to the closed eye. */
  close: () => void
  /** Move the eye to a viewport point (0..1, from the top-left), e.g. under the card. */
  aim: (x: number, y: number, opts?: { delay?: number; duration?: number }) => void
}

/** The river's printed steps per second (the frames between are skipped). */
const FLOW_FPS = 12

const VERT = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec2 uRes;
  uniform vec2 uOrigin;
  uniform float uDpr;
  uniform float uReveal;
  uniform vec3 uHover;
  uniform float uPulse;
  uniform float uPulseAmp;
  uniform float uCold;
  uniform float uOpen;
  uniform float uSeed;
  uniform vec2 uCentre;
  uniform float uTime;

  // The original's colours: ivory, sage, moss, green-black; the pigments.
  const vec3 PAPER = vec3(0.925, 0.918, 0.855);
  const vec3 SAGE = vec3(0.714, 0.722, 0.678);
  const vec3 MOSS = vec3(0.212, 0.239, 0.224);
  const vec3 INK = vec3(0.063, 0.082, 0.075);
  const vec3 SLATE = vec3(0.25, 0.44, 0.63);
  const vec3 OCHRE = vec3(0.66, 0.6, 0.36);
  const vec3 MAUVE = vec3(0.49, 0.43, 0.59);
  // The screen, in CSS px.
  const float CELL = 11.0;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
  }
  mat2 turn(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }
  float fbm(vec2 p) {
    float s = 0.0;
    float g = 0.5;
    for (int i = 0; i < 4; i++) {
      s += noise(p) * g;
      p = turn(0.6) * p * 2.1;
      g *= 0.5;
    }
    return s;
  }
  float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
  float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

  // The original composition: a river along the diagonal (upper left → lower
  // right), its two banks dark, an eye where it widens. The shores flow: the
  // whole field sways (the original's slow sin/cos), and the rough shoreline
  // drifts downstream. Far from the eye the river only greys a little, so it
  // stays open to both edges. uOpen widens the eye.
  float density(vec2 p) {
    vec2 downstream = vec2(0.838, -0.547);
    vec2 sway = vec2(sin(p.y * 6.0 + uTime * 0.52) * 0.028, cos(p.x * 4.5 - uTime * 0.38) * 0.022);
    vec2 q = p + sway;
    float rough = fbm(q * 7.0 - downstream * uTime * 0.16 + uSeed * 17.0) * 0.19;
    float band = abs(q.x * 0.62 + q.y * 0.95) + rough;
    float radius = length(q * vec2(0.65, 1.0));
    float border = smoothstep(0.1, 0.51, band);
    float centre = 1.0 - smoothstep(0.16 + uOpen * 0.22, 0.39 + uOpen * 0.36, radius);
    return max(border, 0.3 * smoothstep(0.3, 1.0, radius)) * (1.0 - centre);
  }

  // The ground, a stepped ramp: ivory → sage → moss → ink.
  vec3 ground(float L) {
    if (L < 0.5) return PAPER;
    if (L < 1.5) return mix(PAPER, SAGE, 0.3);
    if (L < 2.5) return mix(PAPER, SAGE, 0.72);
    if (L < 3.5) return mix(SAGE, MOSS, 0.3);
    if (L < 4.5) return mix(SAGE, MOSS, 0.6);
    if (L < 5.5) return MOSS;
    return mix(MOSS, INK, 0.72);
  }

  float plus(vec2 f, float arm, float w) {
    return max(step(abs(f.y), w) * step(abs(f.x), arm), step(abs(f.x), w) * step(abs(f.y), arm));
  }

  // One mark per cell, by level — the house's pattern library.
  float mark(float L, vec2 f, vec2 css, float aa) {
    float r = length(f);
    if (L < 0.5) return 0.0;
    if (L < 1.5) return 1.0 - smoothstep(0.1 - aa, 0.1 + aa, r);
    if (L < 2.5) return 1.0 - smoothstep(0.2 - aa, 0.2 + aa, r);
    if (L < 3.5) return plus(f, 0.32, 0.05);
    if (L < 4.5) return smoothstep(0.5 - aa, 0.5 + aa, fract((css.x + css.y) / CELL));
    if (L < 5.5) return step(max(abs(f.x), abs(f.y)), 0.31);
    return 0.0;
  }

  void main() {
    vec2 css = (gl_FragCoord.xy - uOrigin) / uDpr;
    vec2 size = uRes / uDpr;
    vec2 cell = floor(css / CELL);
    vec2 f = fract(css / CELL) - 0.5;
    vec2 cc = (cell + 0.5) * CELL;
    // composition space: the original's, centred at (0.48, 0.55) of the window
    // (y up) until the eye is aimed somewhere else
    vec2 p = (cc / size - uCentre) * vec2(size.x / size.y, 1.0);

    float d = density(p);
    // the hand develops the print: round the pointer the field is drawn
    // toward the pattern-rich middle levels, in three stepped rings — so it
    // reads in the dark masses and in the ivory eye alike
    float reach = 150.0 / size.y;
    float stress = (1.0 - smoothstep(reach * 0.2, reach, length(p - uHover.xy))) * uHover.z;
    d = mix(d, 0.47, floor(stress * 3.0 + 0.5) / 3.0);
    // a keystroke: a ring of heavier print runs out from the eye
    float rr = length(p * vec2(0.65, 1.0));
    d += uPulseAmp * (1.0 - smoothstep(0.015, 0.06, abs(rr - uPulse))) * 0.24;
    // cold: the print thins
    d -= uCold * 0.16;
    float L = floor(clamp(d, 0.0, 0.999) * 7.0);

    // print-in: cells arrive in a dither order, the heavy levels first; until
    // then the page's own gradient shows through
    if (uReveal < 0.999 && bayer4(cell) * 0.72 + (6.0 - L) * 0.045 >= uReveal) {
      gl_FragColor = vec4(0.0);
      return;
    }

    float aa = 1.2 / (CELL * uDpr);
    vec3 col = ground(L);

    // The spot plate: the pigments as flat blocks in the transition, a hair
    // out of register (more when the code goes cold).
    float cl = fbm(cell * 0.085 + uSeed * 5.0);
    float pick = hash(cell + floor(uSeed * 97.0));
    if (L > 1.5 && L < 4.5 && pick < 0.24 && abs(cl - 0.5) > 0.05) {
      vec3 spot = cl < 0.45 ? SLATE : (cl > 0.55 ? OCHRE : MAUVE);
      vec2 slip = vec2(0.11, -0.09) + uCold * vec2(0.2, 0.14) * sign(pick - 0.12);
      float blk = step(max(abs(f.x - slip.x), abs(f.y - slip.y)), 0.36);
      col = mix(col, spot, blk * 0.92);
    }

    // The ink plate on top; the solid level knocks out a cross every other cell.
    if (L < 5.5) {
      col = mix(col, INK, mark(L, f, css, aa) * (L < 1.5 ? 0.55 : 0.9));
    } else {
      col = mix(col, MOSS, plus(f, 0.28, 0.05) * mod(cell.x + cell.y, 2.0));
    }

    // paper tooth
    col += (hash(gl_FragCoord.xy + uSeed * 31.0) - 0.5) * 0.03;
    gl_FragColor = vec4(col, 1.0);
  }
`

export const Umbral = forwardRef<UmbralHandle>(function Umbral(_, ref) {
  const mounted = useHydrated()
  const elRef = useRef<HTMLDivElement>(null)
  const api = useRef<UmbralHandle | null>(null)

  useImperativeHandle(
    ref,
    () => ({
      pulse: () => api.current?.pulse(),
      shudder: () => api.current?.shudder(),
      open: () => api.current?.open(),
      close: () => api.current?.close(),
      aim: (x, y, opts) => api.current?.aim(x, y, opts),
    }),
    [],
  )

  useStageWindow(
    elRef,
    () => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const uniforms = {
        uRes: { value: new THREE.Vector2(1, 1) },
        uOrigin: { value: new THREE.Vector2(0, 0) },
        uDpr: { value: 1 },
        uReveal: { value: 0 },
        uHover: { value: new THREE.Vector3(-9, -9, 0) },
        uPulse: { value: -1 },
        uPulseAmp: { value: 0 },
        uCold: { value: 0 },
        uOpen: { value: 0 },
        uSeed: { value: 0.37 },
        uCentre: { value: new THREE.Vector2(0.48, 0.55) },
        uTime: { value: 0 },
      }
      const geometry = new THREE.PlaneGeometry(2, 2)
      const material = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms,
        transparent: true,
        premultipliedAlpha: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.frustumCulled = false
      const scene = new THREE.Scene()
      scene.add(mesh)
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

      // Everything the picture depends on; tweens write here, render reads.
      const st = { reveal: reduced ? 1 : 0, open: 0, cold: 0, pulse: -1, pulseAmp: 0, hx: -9, hy: -9, hs: 0, tx: -9, ty: -9, ht: 0, cx: 0.48, cy: 0.55 }
      const tweens: gsap.core.Animation[] = []
      const run = (t: gsap.core.Animation) => {
        for (let i = tweens.length - 1; i >= 0; i--) if (!tweens[i].isActive()) tweens.splice(i, 1)
        tweens.push(t)
      }
      let dirty = true
      // The flow's clock: wall time in printed steps, so skipped frames don't stall it.
      const t0 = performance.now()
      const flowStep = () => (reduced ? 0 : Math.floor(((performance.now() - t0) / 1000) * FLOW_FPS))
      let drawnStep = -1
      if (!reduced) run(gsap.to(st, { reveal: 1, duration: 1.25, delay: 0.1, ease: 'steps(14)' }))

      const onMove = (e: PointerEvent) => {
        const w = window.innerWidth
        const h = window.innerHeight
        st.tx = (e.clientX / w - st.cx) * (w / h)
        st.ty = 1 - e.clientY / h - st.cy
        st.ht = e.pointerType === 'touch' ? 0 : 1
        dirty = true
      }
      const onLeave = () => {
        st.ht = 0
        dirty = true
      }
      if (!reduced) {
        window.addEventListener('pointermove', onMove, { passive: true })
        window.addEventListener('blur', onLeave)
        document.documentElement.addEventListener('pointerleave', onLeave)
      }

      api.current = {
        pulse: () => {
          if (reduced) return
          st.pulse = 0
          st.pulseAmp = 1
          run(gsap.to(st, { pulse: 1.35, duration: 0.95, ease: 'steps(12)' }))
          run(gsap.to(st, { pulseAmp: 0, duration: 0.95, ease: 'power1.in' }))
        },
        shudder: () => {
          if (reduced) return
          run(
            gsap
              .timeline()
              .to(st, { cold: 1, duration: 0.14, ease: 'steps(3)' })
              .to(st, { cold: 0, duration: 0.5, delay: 0.35, ease: 'steps(5)' }),
          )
        },
        open: () => {
          if (reduced) {
            st.open = 1
            dirty = true
            return
          }
          run(gsap.to(st, { open: 1, duration: 1.2, ease: 'expo.inOut' }))
        },
        close: () => {
          if (reduced) {
            st.open = 0
            dirty = true
            return
          }
          run(gsap.to(st, { open: 0, duration: 0.6, ease: 'expo.out' }))
        },
        aim: (x, y, opts) => {
          const cx = Math.max(0, Math.min(1, x))
          const cy = 1 - Math.max(0, Math.min(1, y))
          if (reduced) {
            st.cx = cx
            st.cy = cy
            dirty = true
            return
          }
          run(gsap.to(st, { cx, cy, duration: opts?.duration ?? 1.15, delay: opts?.delay ?? 0, ease: 'expo.inOut' }))
        },
      }

      return {
        order: -10,
        render: ({ renderer, rect, dt, dpr }) => {
          // The hand eases in and out; the screen steps it into rings.
          const k = 1 - Math.exp(-dt * 7)
          st.hs += (st.ht - st.hs) * k
          if (st.hx < -5) {
            st.hx = st.tx
            st.hy = st.ty
          } else {
            st.hx += (st.tx - st.hx) * k
            st.hy += (st.ty - st.hy) * k
          }
          uniforms.uRes.value.set(rect.width * dpr, rect.height * dpr)
          uniforms.uOrigin.value.set(rect.x * dpr, (window.innerHeight - rect.y - rect.height) * dpr)
          uniforms.uDpr.value = dpr
          uniforms.uReveal.value = st.reveal
          uniforms.uHover.value.set(st.hx, st.hy, st.hs)
          uniforms.uPulse.value = st.pulse
          uniforms.uPulseAmp.value = st.pulseAmp
          uniforms.uCold.value = st.cold
          uniforms.uOpen.value = st.open
          uniforms.uCentre.value.set(st.cx, st.cy)
          drawnStep = flowStep()
          uniforms.uTime.value = drawnStep / FLOW_FPS + 40
          renderer.render(scene, camera)
          dirty = false
        },
        idle: () =>
          !dirty &&
          flowStep() === drawnStep &&
          !tweens.some((t) => t.isActive()) &&
          Math.abs(st.ht - st.hs) < 0.002 &&
          Math.abs(st.tx - st.hx) < 0.0005 &&
          Math.abs(st.ty - st.hy) < 0.0005,
        dispose: () => {
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('blur', onLeave)
          document.documentElement.removeEventListener('pointerleave', onLeave)
          for (const t of tweens) t.kill()
          geometry.dispose()
          material.dispose()
          api.current = null
        },
      }
    },
    [mounted],
  )

  if (!mounted) return null
  return createPortal(<div ref={elRef} className={styles.umbral} aria-hidden="true" />, document.body)
})
