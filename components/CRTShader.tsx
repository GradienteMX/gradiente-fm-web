'use client'

import { useEffect, useRef } from 'react'

const VERT = `
  attribute vec2 a_pos;
  void main() {
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`

const FRAG = `
  precision highp float;

  uniform float u_time;
  uniform vec2  u_resolution;
  uniform float u_scanlineIntensity;
  uniform float u_vignetteStrength;
  uniform float u_noiseIntensity;
  uniform float u_flickerIntensity;
  uniform float u_rollingBarIntensity;
  uniform float u_reducedMotion;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    float aspect = u_resolution.x / u_resolution.y;

    // Aspect-corrected centred coords for the tube SDF
    vec2 p = uv * 2.0 - 1.0;
    p.x *= aspect;

    // Horizontal scanlines every 2 physical px
    float scanline = step(1.0, mod(gl_FragCoord.y, 2.0)) * u_scanlineIntensity;

    // Rounded-rectangle tube mask — fakes CRT curvature by darkening
    // everything outside a bulged-corner rectangle. Radius controls how
    // "bubble" the corners look.
    vec2 halfSize = vec2(aspect - 0.08, 0.92);
    float cornerRadius = 0.35;
    vec2 d = abs(p) - halfSize + cornerRadius;
    float sdf = length(max(d, vec2(0.0))) + min(max(d.x, d.y), 0.0) - cornerRadius;
    // Inside the tube: lit. Past the edge: darkened through a feather band.
    float tube = smoothstep(-0.06, 0.22, sdf) * u_vignetteStrength;

    // Temporal grain — quantised so it reads as noise, not static
    float gTick = u_reducedMotion > 0.5 ? 0.0 : floor(u_time * 24.0) / 24.0;
    float grain = (hash(gl_FragCoord.xy + gTick) - 0.5) * u_noiseIntensity;

    // Mains flicker — two sine layers to avoid a pure hum rhythm
    float flicker = u_reducedMotion > 0.5
      ? 0.0
      : (sin(u_time * 24.0) + sin(u_time * 60.0 + 1.3)) * 0.5 * u_flickerIntensity;

    // Slow rolling scan bar — soft vertical travelling band
    float barPos = u_reducedMotion > 0.5 ? -1.0 : fract(u_time * 0.08);
    float barDist = abs(uv.y - barPos);
    float rollingBar = (1.0 - smoothstep(0.0, 0.12, barDist)) * u_rollingBarIntensity;

    float darkness = scanline + tube + grain + flicker - rollingBar;
    darkness = clamp(darkness, 0.0, 1.0);

    // Dark neutral grey — needs to have enough luminance so the overlay
    // renders visibly on already-black page content. Pure-black tint is
    // invisible on black backgrounds regardless of alpha.
    vec3 tint = vec3(0.22, 0.20, 0.23);
    gl_FragColor = vec4(tint, darkness);
  }
`

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type)
  if (!shader) {
    throw new Error(`createShader returned null (lost=${gl.isContextLost()})`)
  }
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  const status = gl.getShaderParameter(shader, gl.COMPILE_STATUS)
  if (!status) {
    const log = gl.getShaderInfoLog(shader) ?? '(no infoLog)'
    const err = gl.getError()
    const lost = gl.isContextLost()
    gl.deleteShader(shader)
    const kind = type === gl.VERTEX_SHADER ? 'VERT' : 'FRAG'
    throw new Error(
      `Shader compile failed [${kind}] status=${status} err=${err} lost=${lost} log=${log}`,
    )
  }
  return shader
}

export interface CRTShaderProps {
  scanlineIntensity?: number
  vignetteStrength?: number
  noiseIntensity?: number
  flickerIntensity?: number
  rollingBarIntensity?: number
}

export function CRTShader({
  scanlineIntensity = 0.55,
  vignetteStrength = 1.0,
  noiseIntensity = 0.10,
  flickerIntensity = 0.04,
  rollingBarIntensity = 0.10,
}: CRTShaderProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl =
      (canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false }) as WebGLRenderingContext | null) ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null)

    if (!gl) {
      canvas.style.display = 'none'
      return
    }

    let program: WebGLProgram | null = null
    try {
      const vs = compile(gl, gl.VERTEX_SHADER, VERT)
      const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
      program = gl.createProgram()!
      gl.attachShader(program, vs)
      gl.attachShader(program, fs)
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(`Program link failed: ${gl.getProgramInfoLog(program)}`)
      }
      gl.deleteShader(vs)
      gl.deleteShader(fs)
    } catch (err) {
      console.warn('[CRTShader] shader setup failed, hiding overlay', err)
      canvas.style.display = 'none'
      return
    }

    // Fullscreen triangle
    const buffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)

    gl.useProgram(program)
    const posLoc = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    // blendFuncSeparate so the alpha channel isn't doubly multiplied by src.a
    // (which was halving the overlay's effective opacity before).
    gl.enable(gl.BLEND)
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    const uTime = gl.getUniformLocation(program, 'u_time')
    const uRes = gl.getUniformLocation(program, 'u_resolution')
    const uScan = gl.getUniformLocation(program, 'u_scanlineIntensity')
    const uVig = gl.getUniformLocation(program, 'u_vignetteStrength')
    const uNoise = gl.getUniformLocation(program, 'u_noiseIntensity')
    const uFlicker = gl.getUniformLocation(program, 'u_flickerIntensity')
    const uRolling = gl.getUniformLocation(program, 'u_rollingBarIntensity')
    const uReduced = gl.getUniformLocation(program, 'u_reducedMotion')

    const reducedMotionMq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const readReducedMotion = () => (reducedMotionMq.matches ? 1 : 0)

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.floor(window.innerWidth * dpr)
      const h = Math.floor(window.innerHeight * dpr)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      gl.viewport(0, 0, w, h)
    }
    resize()
    window.addEventListener('resize', resize)

    gl.uniform1f(uScan, scanlineIntensity)
    gl.uniform1f(uVig, vignetteStrength)
    gl.uniform1f(uNoise, noiseIntensity)
    gl.uniform1f(uFlicker, flickerIntensity)
    gl.uniform1f(uRolling, rollingBarIntensity)

    const start = performance.now()
    const targetFrameMs = 1000 / 30 // cap at 30fps — texture churn from grain is the cost, 60 is overkill
    let lastDraw = 0
    let raf = 0
    let running = true

    const loop = (now: number) => {
      if (!running) return
      raf = requestAnimationFrame(loop)
      if (now - lastDraw < targetFrameMs) return
      lastDraw = now

      gl.uniform1f(uTime, (now - start) / 1000)
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform1f(uReduced, readReducedMotion())
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    raf = requestAnimationFrame(loop)

    const onVisibility = () => {
      if (document.hidden) {
        running = false
        cancelAnimationFrame(raf)
      } else if (!running) {
        running = true
        lastDraw = 0
        raf = requestAnimationFrame(loop)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', resize)
      // Don't loseContext() — StrictMode/HMR re-runs this effect and a lost
      // context poisons the canvas for the next mount. Let GC clean up.
      gl.deleteBuffer(buffer)
      if (program) gl.deleteProgram(program)
    }
  }, [scanlineIntensity, vignetteStrength, noiseIntensity, flickerIntensity, rollingBarIntensity])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[100] h-screen w-screen"
    />
  )
}
