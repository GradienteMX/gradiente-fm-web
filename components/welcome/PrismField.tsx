'use client'

// PrismField — el fondo de la landing de acceso (/welcome).
//
// Puerto directo del prototipo `landing-v2.html` ("prisma 2008") de
// _Gradiente Ops/prototypes/fractal-hero. Un solo pase de fragment shader por
// frame: un borde casi vertical que ondula, difracción por canal a la derecha
// (la rejilla que abre el arcoíris), textura orgánica de fbm a la izquierda.
//
// A diferencia de VibeFluid no hay simulación ni ping-pong de framebuffers —
// es trigonometría pura, sin iteración, así que sale más barato recalcularlo
// cada frame que cachearlo. WebGL2 crudo (sin three.js) porque el prototipo ya
// es exactamente eso y no hay escena que administrar.
//
// Etiqueta de perf de la casa: DPR tope 1.6, pausa con document.hidden y con
// IntersectionObserver, un solo frame asentado bajo prefers-reduced-motion,
// limpieza completa al desmontar, nunca loseContext.

import { useEffect, useRef } from 'react'

// Los valores que quedaron fijados en el tuner del prototipo (tecla P). No son
// arbitrarios: `edgeX` deja el borde a la izquierda del contenido centrado y
// `glowFloor` evita que el brillo caiga a negro lejos del borde — sin él la
// tinta oscura de la página deja de leerse sobre el lado derecho.
const P = {
  edgeX: -0.31,
  tilt: 0.1,
  wob: 0.014,
  wobFreq: 6.0,
  wobSpeed: 0.55,
  freq: 30.0,
  disp: 0.36,
  fall: 62.0,
  sharp: 1.5,
  weave: 0.95,
  weaveFreq: 300.0,
  weaveWarp: 90.0,
  glow: 1.55,
  glowSpread: 1.9,
  hueSpeed: 0.1,
  purity: 0.88,
  glowFloor: 0.46,
  grain: 0.02,
  exposure: 1.26,
  sat: 1.25,
  vig: 0.3,
} as const

const SPEED = 1.0
// Tiempo congelado que se pinta bajo prefers-reduced-motion / fuera de pantalla:
// un instante del ciclo elegido porque el prisma se ve completo ahí.
const SETTLED_T = 8.0

const VERT = `#version 300 es
void main(){
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

const FRAG = `#version 300 es
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform float uEdgeX, uTilt, uWob, uWobFreq, uWobSpeed;
uniform float uFreq, uDisp, uFall, uSharp;
uniform float uWeave, uWeaveFreq, uWeaveWarp;
uniform float uGlow, uGlowSpread, uHueSpeed, uPurity, uGlowFloor;
uniform float uGrain, uExposure, uSat, uVig;

out vec4 frag;

float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n21(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x),
             mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++){ v += a * n21(p); p *= 2.03; a *= 0.5; }
  return v;
}
vec3 hue(float t){ return 0.5 + 0.5 * cos(6.28318530718 * (t + vec3(0.0, 0.33, 0.67))); }

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = uTime;

  // ── el borde: casi vertical, inclinado, ondulando ──
  float w = uWob * (0.55 * sin(uv.y * uWobFreq        + t * uWobSpeed)
                  + 0.30 * sin(uv.y * uWobFreq * 2.37 - t * uWobSpeed * 1.43)
                  + 0.15 * sin(uv.y * uWobFreq * 5.11 + t * uWobSpeed * 2.21));
  // uEdgeX es fracción del ANCHO, no unidades uv. Así el borde se queda en el
  // mismo punto de la composición en cualquier proporción de pantalla, y no
  // se le mete por debajo al contenido centrado.
  float asp = uRes.x / uRes.y;
  float ex  = uEdgeX * asp + uv.y * uTilt + w;
  // d medido como fracción del ANCHO. Si se mide contra el alto, en pantallas
  // anchas la banda del prisma se encoge hasta volverse un detalle lateral.
  float d   = (uv.x - ex) / asp;
  float ad  = abs(d);

  // ── difracción ──
  // Cada canal difracta distinto. Junto al borde coinciden y sale blanco;
  // al alejarse se desfasan y aparece el arcoíris. Es lo que hace una rejilla.
  vec3 k  = vec3(1.0, 1.0 + uDisp, 1.0 + 2.0 * uDisp);
  vec3 fr = 0.5 + 0.5 * cos(6.28318530718 * (d * uFreq) * k + t * 0.6);
  fr = pow(fr, vec3(uSharp));
  // Asimétrica a propósito: hacia la textura las franjas se cortan rápido,
  // hacia el brillo se estiran.
  float amp = exp(-ad * uFall * (d < 0.0 ? 1.70 : 0.48));

  // ── la izquierda ──
  // Ruido estirado en vertical, no senos puros. Los senos daban una trama
  // regular tipo tejido de punto, y la referencia es mucho más orgánica.
  float big    = fbm(vec2(uv.x *  3.2, uv.y * 1.7 + t * 0.05));
  float streak = fbm(vec2(uv.x * 30.0, uv.y * 0.8 - t * 0.04));
  float grit   = fbm(vec2(uv.x * 95.0, uv.y * 2.4 + t * 0.09));
  float fine   = 0.5 + 0.5 * cos(uv.y * uWeaveFreq + big * 7.0 + sin(uv.x * uWeaveWarp) * 0.5);

  float tex = big * 0.52 + streak * 0.34 + grit * 0.14;
  float L   = smoothstep(0.012, -0.060, d);

  vec3 warm = vec3(1.14, 0.96, 0.68);
  vec3 cool = vec3(0.50, 0.68, 1.08);
  vec3 leftCol = mix(cool, warm, smoothstep(0.30, 0.70, tex))
               * (0.42 + 1.15 * tex)
               * (0.80 + 0.30 * fine);

  // ── la derecha: el brillo ──
  float R  = smoothstep(-0.012, 0.042, d);
  // Con piso. Sin él, lejos del borde el brillo cae a negro y la tinta de la
  // página se pierde. En la referencia el color llena todo el lado derecho.
  float g  = uGlowFloor + (1.0 - uGlowFloor) * exp(-pow(max(d, 0.0) * uGlowSpread, 1.6));
  float gv = 0.72 + 0.40 * sin(uv.y * 1.9 - t * 0.22) * sin(uv.x * 1.3 + t * 0.15);
  // El tono recorre todo el círculo, y en los azules profundos el brillo se
  // oscurece tanto que la tinta negra de la página deja de leerse. uPurity
  // lo acerca al blanco y le pone piso a la luminancia.
  vec3  gc = mix(vec3(1.0), hue(t * uHueSpeed), uPurity);

  vec3 col = vec3(0.0);
  col += gc * (uGlow * g * R * gv);
  col += fr * amp * 1.45;
  col += L * leftCol * uWeave;

  // banda oscura pegada al borde
  col *= 1.0 - 0.80 * exp(-pow(ad * 90.0, 2.0));

  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(lum), col, uSat);
  col *= uExposure;
  col += (h21(gl_FragCoord.xy + fract(t) * 37.0) - 0.5) * uGrain;

  vec2 q = gl_FragCoord.xy / uRes - 0.5;
  col *= 1.0 - uVig * dot(q, q);

  frag = vec4(clamp(col, 0.0, 1.0), 1.0);
}`

export function PrismField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    })
    // Sin WebGL2 el canvas se esconde y queda el degradado CSS de respaldo que
    // la página pinta debajo.
    if (!gl) {
      canvas.style.display = 'none'
      return
    }

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)
      if (!s) throw new Error('createShader failed')
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(s) ?? 'shader compile failed')
      }
      return s
    }

    let prog: WebGLProgram
    let vs: WebGLShader
    let fs: WebGLShader
    try {
      const p = gl.createProgram()
      if (!p) throw new Error('createProgram failed')
      prog = p
      vs = compile(gl.VERTEX_SHADER, VERT)
      fs = compile(gl.FRAGMENT_SHADER, FRAG)
      gl.attachShader(prog, vs)
      gl.attachShader(prog, fs)
      gl.linkProgram(prog)
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(prog) ?? 'link failed')
      }
    } catch (e) {
      console.error('[PrismField]', e)
      canvas.style.display = 'none'
      return
    }

    gl.useProgram(prog)
    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)

    const keys = Object.keys(P) as (keyof typeof P)[]
    const uniformName = (k: string) => 'u' + k[0].toUpperCase() + k.slice(1)
    const uRes = gl.getUniformLocation(prog, 'uRes')
    const uTime = gl.getUniformLocation(prog, 'uTime')
    const uParams = keys.map((k) => gl.getUniformLocation(prog, uniformName(k)))

    const sizeUp = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6)
      const w = Math.max(1, Math.round(window.innerWidth * dpr))
      const h = Math.max(1, Math.round(window.innerHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
    }

    const draw = (t: number) => {
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform1f(uTime, t)
      keys.forEach((k, i) => {
        const loc = uParams[i]
        if (loc) gl.uniform1f(loc, P[k])
      })
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    const start = performance.now()
    let raf = 0
    let onScreen = true
    // `painted` marca que ya se pintó el frame congelado: mientras esté en true
    // y sigamos en reposo, el loop no toca la GPU.
    let painted = false

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const idle = document.hidden || !onScreen || reduce.matches
      if (idle && painted) return
      draw(idle ? SETTLED_T : ((now - start) / 1000) * SPEED)
      painted = idle
    }

    const onVisibility = () => {
      painted = false
    }
    document.addEventListener('visibilitychange', onVisibility)

    let io: IntersectionObserver | null = null
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (es) => {
          onScreen = es[0].isIntersecting
          painted = false
        },
        { threshold: 0 },
      )
      io.observe(canvas)
    }

    let rt = 0
    const resize = () => {
      window.clearTimeout(rt)
      rt = window.setTimeout(() => {
        sizeUp()
        painted = false
      }, 160)
    }
    window.addEventListener('resize', resize)

    let ro: ResizeObserver | null = null
    if ('ResizeObserver' in window) {
      // La primera notificación llega en el montaje, cuando el tamaño ya es el
      // correcto — se ignora para no re-dimensionar de más.
      let first = true
      ro = new ResizeObserver(() => {
        if (first) {
          first = false
          return
        }
        resize()
      })
      ro.observe(document.documentElement)
    }

    sizeUp()
    draw(0)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(rt)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', resize)
      io?.disconnect()
      ro?.disconnect()
      gl.deleteProgram(prog)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      gl.deleteVertexArray(vao)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 block h-full w-full"
    />
  )
}
