'use client'

import { ReactNode, useEffect, useRef } from 'react'

// Fragment shader — passthrough for Chunk 2 verification. Once we confirm the
// page renders correctly through the canvas, this gets replaced with barrel
// distortion + scanlines + chromatic aberration etc.
const VERT = `
  attribute vec2 a_pos;
  varying vec2 v_uv;
  void main() {
    v_uv = a_pos * 0.5 + 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`

const FRAG = `
  precision highp float;
  varying vec2 v_uv;
  uniform sampler2D u_src;
  void main() {
    // Flip Y — texElementImage2D delivers top-left origin, WebGL samples
    // bottom-left.
    vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
    gl_FragColor = texture2D(u_src, uv);
  }
`

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)
  if (!s) throw new Error(`createShader null (lost=${gl.isContextLost()})`)
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s) ?? '(no log)'
    gl.deleteShader(s)
    throw new Error(`compile failed: ${log}`)
  }
  return s
}

// WebGL extension for HTML-in-Canvas: `gl.texElementImage2D`. The type isn't
// in lib.dom.d.ts — we augment inline.
//
// Per the html-in-canvas spec the draw/upload methods may return a DOMMatrix
// describing the element→texture-space mapping. We capture it so the DOM's
// hit-test geometry can be kept in sync with the visual (see
// `syncHitTestTransform` below). Return type is `void | DOMMatrix` because
// Canary's experimental implementation may not yet return one.
type GLWithElementImage = WebGLRenderingContext & {
  texElementImage2D?: (
    target: number,
    level: number,
    internalformat: number,
    format: number,
    type: number,
    element: Element,
  ) => void | DOMMatrix
}

type CanvasWithPaint = HTMLCanvasElement & {
  requestPaint?: () => void
}

// Hit-test transform sync. The visual painted into the canvas may be shifted,
// scaled, or distorted relative to the real DOM layout. Assigning the returned
// DOMMatrix to `element.style.transform` moves the DOM's hit-test boxes to
// match the rendered position so clicks land where the eye sees the element.
//
// For passthrough this is identity (shader samples 1:1), and setting an
// identity transform would still create a new containing block for fixed
// descendants (OverlayRouter, CalendarSidebar) — which we don't want yet.
// So we skip when the matrix is effectively identity. Once barrel distortion
// lands the shader's inverse-distortion matrix (NOT the API return) will be
// assigned here instead.
function syncHitTestTransform(element: HTMLElement, matrix: DOMMatrix | void) {
  if (!matrix) return
  const isIdentity =
    matrix.a === 1 && matrix.b === 0 &&
    matrix.c === 0 && matrix.d === 1 &&
    matrix.e === 0 && matrix.f === 0 &&
    (matrix.is2D ?? true)
  if (isIdentity) {
    if (element.style.transform !== '') element.style.transform = ''
    return
  }
  const next = matrix.toString()
  if (element.style.transform !== next) element.style.transform = next
}

export function CRTPostProcess({ children }: { children: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current as CanvasWithPaint | null
    const content = contentRef.current
    if (!canvas || !content) return

    const gl = canvas.getContext('webgl', {
      premultipliedAlpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
    }) as GLWithElementImage | null
    if (!gl) {
      console.warn('[CRTPostProcess] no WebGL — content will be invisible (layoutsubtree hides children until drawn)')
      // Disable layoutsubtree so children stay visible as a last-resort fallback.
      canvas.removeAttribute('layoutsubtree')
      return
    }

    // Defensive double-check — CRTOverlay only mounts this branch when the
    // feature is present, but if it were ever invoked otherwise we'd silently
    // paint nothing and the page would go blank.
    if (typeof gl.texElementImage2D !== 'function') {
      console.warn('[CRTPostProcess] gl.texElementImage2D missing — needs Chromium 147+ with #canvas-draw-element flag enabled')
      canvas.removeAttribute('layoutsubtree')
      return
    }

    let program: WebGLProgram | null = null
    let buffer: WebGLBuffer | null = null
    let texture: WebGLTexture | null = null

    try {
      const vs = compile(gl, gl.VERTEX_SHADER, VERT)
      const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
      program = gl.createProgram()!
      gl.attachShader(program, vs)
      gl.attachShader(program, fs)
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(`link failed: ${gl.getProgramInfoLog(program)}`)
      }
      gl.deleteShader(vs)
      gl.deleteShader(fs)
    } catch (err) {
      console.warn('[CRTPostProcess] shader setup failed', err)
      canvas.removeAttribute('layoutsubtree')
      return
    }

    gl.useProgram(program)

    buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const posLoc = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    texture = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.uniform1i(gl.getUniformLocation(program, 'u_src'), 0)

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

    // Sampling strategy — per `wiki/90-Decisions/CRT Approach.md`:
    //
    //   "Rasterising the DOM every frame is infeasible. Snapshot on mount,
    //    on scroll end, and on route/overlay changes. Accept ~100-200ms
    //    visual lag between DOM reality and distorted view."
    //
    // Earlier versions tried a 30fps rAF loop — in Canary each
    // texElementImage2D over this subtree costs 100-140ms of CPU, so at
    // 30fps we saturate the main thread and get rAF Violations and a
    // frozen page. We do NOT subscribe to `canvas.onpaint` either — the
    // NGE ticker and Navigation's 100ms clock would retrigger paint every
    // animation frame, and rate-limiting paint events still bleeds CPU
    // because the listener itself fires 60×/sec.
    //
    // Instead: sample on discrete user events (scroll end, resize end,
    // route/overlay change) plus an initial sample + a low-rate trailing
    // refresher to catch any missed changes. Animated DOM chrome (ticker,
    // clock) updates lazily at the trailing refresh rate — acceptable
    // per the wiki's documented tradeoff.
    let running = true
    let drawing = false

    const drawOnce = () => {
      if (!running || drawing || !gl.texElementImage2D) return
      drawing = true
      try {
        gl.bindTexture(gl.TEXTURE_2D, texture)
        try {
          const matrix = gl.texElementImage2D(
            gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, content,
          )
          // Passthrough: matrix is identity (or void) — syncHitTestTransform
          // no-ops. When distortion lands, swap the source here for the
          // shader's inverse-distortion mapping.
          syncHitTestTransform(content, matrix)
        } catch (err) {
          console.warn('[CRTPostProcess] texElementImage2D threw; skipping upload', err)
        }
        gl.clearColor(0, 0, 0, 1)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      } finally {
        drawing = false
      }
    }

    // Leading-edge throttle + trailing-edge flush. Sample fires immediately
    // if we're outside the cooldown window; otherwise it schedules one
    // sample at the end of the current window.
    const SAMPLE_COOLDOWN_MS = 250
    let lastSampleAt = -SAMPLE_COOLDOWN_MS
    let trailingTimer: number | null = null
    let rafHandle = 0

    const requestSample = () => {
      if (!running) return
      const now = performance.now()
      const since = now - lastSampleAt
      if (since >= SAMPLE_COOLDOWN_MS) {
        lastSampleAt = now
        cancelAnimationFrame(rafHandle)
        rafHandle = requestAnimationFrame(drawOnce)
      } else if (trailingTimer === null) {
        trailingTimer = window.setTimeout(() => {
          trailingTimer = null
          lastSampleAt = performance.now()
          cancelAnimationFrame(rafHandle)
          rafHandle = requestAnimationFrame(drawOnce)
        }, SAMPLE_COOLDOWN_MS - since)
      }
    }

    // Initial sample — after layout has settled. rAF twice so `children` has
    // definitely mounted and measured before we try to rasterise.
    requestAnimationFrame(() => requestAnimationFrame(requestSample))

    // Scroll end — debounced. The inner div is the scroll ancestor; listen
    // on it directly so we don't depend on document scroll.
    let scrollTimer: number | null = null
    const onScroll = () => {
      if (scrollTimer !== null) window.clearTimeout(scrollTimer)
      scrollTimer = window.setTimeout(() => {
        scrollTimer = null
        requestSample()
      }, 120)
    }
    content.addEventListener('scroll', onScroll, { passive: true })

    // Resize end — debounced. `resize()` updates canvas backing store
    // synchronously; the sample is the expensive part.
    let resizeTimer: number | null = null
    const onResize = () => {
      resize()
      if (resizeTimer !== null) window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => {
        resizeTimer = null
        requestSample()
      }, 120)
    }
    // Replace the old resize listener registered at setup time — we need
    // the debounced version so we don't sample mid-drag.
    window.removeEventListener('resize', resize)
    window.addEventListener('resize', onResize)

    // Route / overlay changes — watch the URL. Overlay state lives in
    // `?item=` and route changes in pathname. Both show up on popstate;
    // programmatic pushState/replaceState (Next router, overlay open/close)
    // don't fire events on window, so we patch history.
    const onUrlChange = () => requestSample()
    window.addEventListener('popstate', onUrlChange)

    const origPush = history.pushState.bind(history)
    const origReplace = history.replaceState.bind(history)
    history.pushState = function (...args: Parameters<typeof history.pushState>) {
      const r = origPush(...args)
      onUrlChange()
      return r
    }
    history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
      const r = origReplace(...args)
      onUrlChange()
      return r
    }

    // Safety-net trailing refresh — once per 2s, catch anything the event
    // hooks missed (font loads, async image decodes, live clock ticks).
    // Deliberately low-frequency: this is the "accept lag" escape hatch,
    // not a render loop.
    const trailingRefresh = window.setInterval(requestSample, 2000)

    const onVisibility = () => {
      if (document.hidden) {
        running = false
      } else if (!running) {
        running = true
        requestSample()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      running = false
      cancelAnimationFrame(rafHandle)
      if (scrollTimer !== null) window.clearTimeout(scrollTimer)
      if (resizeTimer !== null) window.clearTimeout(resizeTimer)
      if (trailingTimer !== null) window.clearTimeout(trailingTimer)
      window.clearInterval(trailingRefresh)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('popstate', onUrlChange)
      history.pushState = origPush
      history.replaceState = origReplace
      content.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVisibility)
      if (buffer) gl.deleteBuffer(buffer)
      if (texture) gl.deleteTexture(texture)
      if (program) gl.deleteProgram(program)
    }
  }, [])

  // Scroll model: inner `overflow-y: auto` on the content wrapper (scrollbar
  // hidden via .crt-pathb-scroll). Rejected alternative — body scroll via
  // a content-height spacer + `margin-top: -scrollY` on this wrapper —
  // would lose native `position: sticky` for Navigation/VibeSlider (the
  // paint-contained canvas is not a scroll ancestor, so sticky wouldn't
  // observe body scroll) and add invalidation churn. Inner scroll keeps
  // sticky + fixed + overlay positioning correct because the canvas box
  // itself is fixed at viewport dims, so its paint-containment containing
  // block *is* the viewport; the inner div is the scroll ancestor.
  return (
    <canvas
      ref={canvasRef}
      aria-hidden={false}
      // `layoutsubtree` opts direct children into layout + hit testing but
      // hides them visually until drawn via drawElementImage/texElementImage2D.
      // TS doesn't know about this attr yet — spread it.
      {...({ layoutsubtree: '' } as Record<string, string>)}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        display: 'block',
        zIndex: 0,
      }}
    >
      <div
        ref={contentRef}
        className="crt-pathb-scroll"
        style={{
          width: '100%',
          height: '100vh',
          overflowX: 'hidden',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
        }}
      >
        {children}
      </div>
    </canvas>
  )
}
