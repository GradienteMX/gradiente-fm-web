'use client'

import { useEffect, useRef } from 'react'

// Procedural fractal: hover opens its own recursive cutouts until the thin
// connections break. No surface tiles, image sampling, or coordinate warping.
const SPEED = 1.0
const SETTLED_T = 0.0
const VERT = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`
const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uCssHeight;
uniform vec3 uHover;
out vec4 frag;
const vec3 PAPER = vec3(0.92,0.915,0.85);
const vec3 INK = vec3(0.025,0.036,0.033);
mat2 turn(float a) { return mat2(cos(a),-sin(a),sin(a),cos(a)); }
float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p) {
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);
}
float fbm(vec2 p) {
  float sum=0.0, gain=0.5;
  for(int i=0;i<4;i++) { sum+=noise(p)*gain; p=turn(0.6)*p*2.1; gain*=0.5; }
  return sum;
}
// Local stress, with one bounded influence even while the pointer is still.
float stressAt(vec2 p) {
  float reach=88.0/uCssHeight;
  return (1.0-smoothstep(reach*0.15,reach,length(p-uHover.xy)))*uHover.z;
}
// Generalized Sierpinski subdivision: alternating triangular and diamond
// cutouts, rotated between generations, recursively perforate the material.
// The same recursion supplies both the continuous material and its shards.
vec3 fractal(vec2 p, float density) {
  mat2 oblique=mat2(1.0,0.0,-0.57735027,1.15470054);
  vec2 z=oblique*p;
  mat2 basis=oblique*turn(-0.38)*4.8;
  vec2 origin=oblique*vec2(0.27,0.41);
  float solid=1.0, generation=0.0, rims=0.0, scale=4.8;
  for(int i=0;i<9;i++) {
    float branch=hash(floor(z)+float(i)*13.7);
    vec2 f=fract(z);
    if(f.x+f.y>1.0) f=1.0-f;
    f=(f-vec2(0.333333))*(0.8+branch*0.85)+vec2(0.333333);
    float triangular=min(min(0.5-f.x,0.5-f.y),(f.x+f.y-0.5)*0.70710678)-0.014;
    float diamond=0.145-abs(f.x-0.30)-abs(f.y-0.30);
    float distance=branch<0.7 ? triangular : diamond;
    // Widen the actual recursive voids at the middle generations. Once they
    // cross the thin connecting bridges, smaller self-similar islands separate.
    // Stress is constant per branch, so its straight contours stay straight.
    if(i>=1 && i<=4 && uHover.z>0.001) {
      vec2 branchCenter=inverse(basis)*(floor(z)+vec2(0.5)-origin);
      float stress=stressAt(branchCenter);
      distance+=stress*(0.048+0.028*branch);
    }
    float aa=max(0.0002,scale/uRes.y*0.45);
    float hole=smoothstep(-aa,aa,distance);
    // Larger cavities emerge only toward the dark outer mass. The smaller
    // descendants continue into the pale transition, matching the reference.
    float reveal=smoothstep(0.65-float(i)*0.065,0.98-float(i)*0.075,density);
    rims+=exp(-abs(distance)*70.0)*solid*reveal*0.13;
    generation+=solid*hole*reveal*float(i);
    solid*=1.0-hole*reveal;
    z=turn(0.78539816)*z*2.13+vec2(0.17,0.31);
    basis=turn(0.78539816)*basis*2.13;
    origin=turn(0.78539816)*origin*2.13+vec2(0.17,0.31);
    scale*=2.13;
    if(scale>uRes.y*0.45) break;
  }
  return vec3(solid,generation,rims);
}
// Motion belongs exclusively to the reveal mask, never to fractal coordinates.
float densityAt(vec2 p) {
  vec2 flow=vec2(
    sin(p.y*6.0+uTime*0.52)*0.028,
    cos(p.x*4.5-uTime*0.38)*0.022
  );
  vec2 q=p+flow;
  // Composition, independently of the fractal: ivory center, opposing dark
  // masses at lower left and upper right, smaller detail along their boundary.
  float rough=fbm(q*7.0+vec2(0.0,uTime*0.035))*0.19;
  float band=abs(q.x*0.62+q.y*0.95)+rough;
  float radius=length(q*vec2(0.65,1.0));
  float border=smoothstep(0.10,0.51,band);
  float center=1.0-smoothstep(0.16,0.39,radius);
  float density=max(border,0.63*smoothstep(0.20,0.70,radius))*(1.0-center);
  return density;
}
vec3 shadeAt(vec2 p, float density) {
  vec2 axis=turn(-0.38)*p;
  vec3 f=fractal(axis*4.8+vec2(0.27,0.41),density);
  // Two continuous clocks avoid phase jumps when hover starts/stops.
  // Ambient: ~28 seconds per breath. Local hover adds an ~8-second accent.
  // Only pigment changes; the ivory, geometry, and boundary motion keep theirs.
  float slowBreath=sin(uTime*0.22439948);
  float hoverBreath=sin(uTime*0.78539816)*stressAt(p);
  float pigmentShift=slowBreath*0.020+hoverBreath*0.045;
  float pigmentGain=1.0+slowBreath*0.008+hoverBreath*0.018;
  float chroma=clamp(fbm(p*29.0)+pigmentShift,0.0,1.0);
  vec3 mineral=mix(vec3(0.25,0.44,0.63),vec3(0.66,0.60,0.36),chroma);
  mineral=mix(mineral,vec3(0.49,0.43,0.59),smoothstep(1.0,5.0,f.y)*0.45);
  mineral*=pigmentGain;
  vec3 ground=mix(PAPER,mix(vec3(0.36,0.40,0.37),mineral,0.65),density*0.85);
  vec3 color=mix(INK,ground,f.x);
  color+=f.z*mineral*0.7;
  color=mix(color,mineral, (1.0-f.x)*smoothstep(2.0,6.0,f.y)*0.55);
  color=mix(ground,color,smoothstep(0.08,0.85,density));
  color*=1.0-0.48*smoothstep(0.65,1.0,density);
  float inkGrain=hash(floor(gl_FragCoord.xy/2.0));
  color+=vec3(0.08,-0.018,0.10)*(inkGrain-0.5)*density;
  float grainCell=hash(floor(gl_FragCoord.xy/6.0));
  float ringRadius=0.18+grainCell*0.17;
  float ring=1.0-smoothstep(0.025,0.10,abs(length(fract(gl_FragCoord.xy/6.0)-0.5)-ringRadius));
  vec3 inkTint=mix(vec3(0.22,0.36,0.54),vec3(0.64,0.49,0.53),clamp(grainCell+pigmentShift,0.0,1.0))*pigmentGain;
  color=mix(color,inkTint,ring*density*f.x*0.48);
  float dotSize=4.0;
  vec2 dotUV=gl_FragCoord.xy/dotSize;
  float dots=1.0-smoothstep(0.18,0.42,length(fract(dotUV)-0.5));
  color-=dots*(0.02+density*0.065);
  color+=(hash(gl_FragCoord.xy)-0.5)*(0.035+density*0.10);
  return clamp(color,0.0,1.0);
}

void main() {
  vec2 uv=gl_FragCoord.xy/uRes;
  vec2 p=(uv-vec2(0.48,0.55))*vec2(uRes.x/uRes.y,1.0);
  frag=vec4(shadeAt(p,densityAt(p)),1.0);
}`

export function FractalField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.hidden = false
    const gl = canvas.getContext('webgl2', {
      antialias: false, alpha: false, depth: false, stencil: false,
      powerPreference: 'low-power',
    })
    if (!gl) { canvas.hidden = true; return }

    const shaders: WebGLShader[] = []
    const program = gl.createProgram()
    const vao = gl.createVertexArray()
    const dispose = () => {
      shaders.forEach((shader) => gl.deleteShader(shader))
      gl.deleteProgram(program)
      gl.deleteVertexArray(vao)
    }
    try {
      if (!program || !vao) throw new Error('WebGL allocation failed')
      for (const [type, source] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, FRAG]] as const) {
        const shader = gl.createShader(type)
        if (!shader) throw new Error('Shader allocation failed')
        shaders.push(shader)
        gl.shaderSource(shader, source)
        gl.compileShader(shader)
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          throw new Error(gl.getShaderInfoLog(shader) ?? 'Shader compilation failed')
        }
        gl.attachShader(program, shader)
      }
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) ?? 'Shader linking failed')
      }
    } catch (error) {
      console.warn('[FractalField] Using static background', error)
      canvas.hidden = true
      dispose()
      return
    }

    const uRes = gl.getUniformLocation(program, 'uRes')
    const uTime = gl.getUniformLocation(program, 'uTime')
    const uCssHeight = gl.getUniformLocation(program, 'uCssHeight')
    const uHover = gl.getUniformLocation(program, 'uHover')
    const pointer = { x: -10, y: -10, strength: 0, target: 0 }
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let raf = 0
    let lastFrame = 0
    let elapsed = 0
    let lost = false
    let visible = true
    const draw = () => {
      if (lost) return
      gl.useProgram(program)
      gl.bindVertexArray(vao)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform3f(uHover, pointer.x, pointer.y, reducedMotion.matches ? 0 : pointer.strength)
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform1f(uCssHeight, canvas.clientHeight)
      gl.uniform1f(uTime, reducedMotion.matches ? SETTLED_T : elapsed * SPEED)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    const frame = (now: number) => {
      if (now - lastFrame >= 1000 / 30) {
        const dt = Math.min((now - lastFrame) / 1000, 0.1)
        elapsed += dt
        pointer.strength += (pointer.target-pointer.strength)*(1-Math.exp(-dt*6))
        lastFrame = now
        draw()
      }
      raf = requestAnimationFrame(frame)
    }
    const resume = () => {
      cancelAnimationFrame(raf)
      if (lost || document.hidden || !visible) return
      draw()
      if (!reducedMotion.matches) {
        lastFrame = performance.now()
        raf = requestAnimationFrame(frame)
      }
    }
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr))
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr))
      resume()
    }
    // Keep the CSS background and working controls if the GPU is lost.
    const onContextLost = () => {
      lost = true
      canvas.hidden = true
      cancelAnimationFrame(raf)
    }
    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      pointer.x = (event.clientX-rect.left-rect.width*0.48)/rect.height
      pointer.y = (rect.height*0.45-event.clientY+rect.top)/rect.height
      pointer.target = 1
    }
    const onPointerLeave = () => { pointer.target = 0 }
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') onPointerLeave()
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerdown', onPointerMove, { passive: true })
    window.addEventListener('pointerup', onPointerUp, { passive: true })
    window.addEventListener('pointercancel', onPointerLeave)
    window.addEventListener('blur', onPointerLeave)
    document.documentElement.addEventListener('pointerleave', onPointerLeave)
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      resume()
    })
    observer.observe(canvas)
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', resume)
    reducedMotion.addEventListener('change', resume)
    canvas.addEventListener('webglcontextlost', onContextLost)
    resize()

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerLeave)
      window.removeEventListener('blur', onPointerLeave)
      document.documentElement.removeEventListener('pointerleave', onPointerLeave)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', resume)
      reducedMotion.removeEventListener('change', resume)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      dispose()
    }
  }, [])

  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 z-0 h-full w-full" />
}
