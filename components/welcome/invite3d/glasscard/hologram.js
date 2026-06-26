import * as THREE from 'three';

let whiteTex = null;
function white() {
  if (whiteTex) return whiteTex;
  whiteTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
  whiteTex.needsUpdate = true; whiteTex.colorSpace = THREE.NoColorSpace;
  return whiteTex;
}

export function createHologramMaterial({
  mask = null, pattern = null, patternScale = 3.0, edgeWeight = 1.0, surfaceWeight = 0.3,
  intensity = 1.5, opacity = 0.55, side = THREE.FrontSide,
} = {}) {
  return new THREE.ShaderMaterial({
    name: 'GradienteHologram',
    uniforms: {
      uTime: { value: 0 }, uHover: { value: 0 }, uPointer: { value: new THREE.Vector2() },
      uMask: { value: mask ?? white() }, uUseMask: { value: mask ? 1 : 0 },
      uPattern: { value: pattern ?? white() }, uUsePattern: { value: pattern ? 1 : 0 },
      uPatternScale: { value: patternScale },
      uEdgeWeight: { value: edgeWeight }, uSurfaceWeight: { value: surfaceWeight },
      uIntensity: { value: intensity }, uOpacity: { value: opacity },
      uRolePhase: { value: 0 }, uHueSpread: { value: 1 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      void main(){
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vView = mv.xyz; vN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime,uHover,uEdgeWeight,uSurfaceWeight,uIntensity,uOpacity,uUseMask;
      uniform float uUsePattern,uPatternScale;
      uniform vec2 uPointer; uniform sampler2D uMask; uniform sampler2D uPattern;
      uniform float uRolePhase; uniform float uHueSpread;
      varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      const float TAU = 6.28318530718;
      vec3 spectral(float p){ return 0.52 + 0.48*cos(TAU*(p + vec3(0.0,0.33,0.67))); }
      float rnd(vec2 c){ return fract(sin(dot(c,vec2(12.9898,78.233)))*43758.5453); }
      void main(){
        vec3 N = normalize(vN); vec3 V = normalize(-vView);
        float ndv = clamp(dot(N,V),0.0,1.0);
        float fres = pow(1.0-ndv, 2.4);
        // atan(0,0) es indefinido: en Metal (macOS) devuelve NaN cuando la cara mira
        // de frente a la cámara (N≈(0,0,1) ⇒ N.x=N.y=0). Ese NaN se propaga por el
        // blending ADITIVO al buffer HDR y el blur del bloom lo esparce a TODA la
        // pantalla → la escena se queda en negro ~2.5s SÓLO en Mac mientras la tarjeta
        // pasa de frente en la apertura (en Windows/D3D11 atan(0,0)=0, sin bug).
        // Devolvemos un ángulo estable en el caso degenerado.
        float ang = dot(N.xy, N.xy) > 1e-7 ? atan(N.y,N.x)/TAU + 0.5 : 0.5;
        float diag = vUv.x*0.72 + vUv.y*0.43;
        float pph = dot(uPointer, vec2(0.7,-0.5));
        // patrón de difracción real (holo-pattern.png) modula tono y brillo
        float pat = mix(0.5, texture2D(uPattern, vUv*uPatternScale).g, uUsePattern);
        float phase = diag*2.15 + ang*0.85 + pph + uTime*0.035 + (pat-0.5)*1.9;
        // banda de tono del rol: el barrido oscila SUAVEMENTE (seno, sin saltos)
        // dentro de una banda alrededor de uRolePhase; ancho = uHueSpread (1 =
        // arcoíris completo → sin comprimir; ~0.24 = familia del rol).
        if (uHueSpread < 0.999)
          phase = uRolePhase + 0.5 * uHueSpread * sin(TAU * (phase - uRolePhase));
        vec3 rainbow = spectral(phase);
        float bands = 0.5 + 0.5*sin((vUv.x*1.35 + vUv.y)*95.0 + uTime*0.7 + uPointer.x*3.0);
        bands = pow(bands, 12.0);
        float sweepC = mix(-0.35,1.35, fract(uTime*0.04 + uPointer.x*0.55 + 0.15));
        float sweep = exp(-pow((diag-sweepC)*9.0,2.0));
        float spk = smoothstep(0.997,1.0, rnd(floor(vUv*vec2(700.0,440.0)) + floor(uTime*3.0)));
        spk *= 0.2 + uHover*0.4;
        float m = mix(1.0, texture2D(uMask,vUv).r, uUseMask);
        float surf = uSurfaceWeight*(0.30 + bands*0.22 + sweep*0.6);
        float edge = uEdgeWeight*fres*(0.45 + uHover*0.70);
        float patMod = mix(1.0, 0.45 + pat, uUsePattern);
        float strength = (surf + edge + spk*0.30)*uIntensity*m*patMod;
        vec3 col = rainbow*strength + vec3(1.0,0.55,0.18)*sweep*0.14*m;
        float a = clamp((surf + edge + spk*0.15)*uOpacity*m, 0.0, 0.8);
        if(a < 0.005) discard;
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthTest: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side, toneMapped: false,
  });
}

// Lámina de foil holográfico de cara completa: muestra el patrón de difracción
// en arcoíris a través de TODO el frente y se desplaza con el puntero (hover)
// y la inclinación (facing). Es la capa "que aparece delante" tipo carta holo.
export function createHoloFoil({ pattern = null, scale = 3.0, intensity = 1.4, opacity = 0.5 } = {}) {
  return new THREE.ShaderMaterial({
    name: 'GradienteHoloFoil',
    uniforms: {
      uTime: { value: 0 }, uHover: { value: 0 }, uPointer: { value: new THREE.Vector2() },
      uPattern: { value: pattern ?? white() }, uScale: { value: scale },
      uIntensity: { value: intensity }, uOpacity: { value: opacity },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(position,1.0);
        vView = mv.xyz; vN = normalize(normalMatrix*normal);
        gl_Position = projectionMatrix*mv; }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uPattern; uniform float uTime,uScale,uIntensity,uOpacity; uniform vec2 uPointer;
      varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      const float TAU = 6.28318530718;
      vec3 spectral(float p){ return 0.52 + 0.48*cos(TAU*(p + vec3(0.0,0.33,0.67))); }
      void main(){
        vec3 N = normalize(vN); vec3 V = normalize(-vView);
        float facing = clamp(dot(N,V), 0.0, 1.0);
        vec2 uv = vUv*uScale;
        float p = texture2D(uPattern, uv).g;
        // el valor del patrón + puntero + inclinación deciden el tono → cambia al mover
        // gradiente espacial → arcoíris repartido por la cara (no un solo tono),
        // que se desplaza con el puntero/inclinación como un holograma real
        float hue = p*0.9 + (vUv.x*0.75 + vUv.y*0.45)
          + uPointer.x*0.6 - uPointer.y*0.45 + (1.0-facing)*0.6 + uTime*0.03;
        vec3 col = spectral(hue);
        // banda de brillo holográfica que viaja con el puntero
        float diag = vUv.x*0.6 + vUv.y*0.4;
        float band = fract(diag - uPointer.x*0.6 - uTime*0.04);
        float shine = smoothstep(0.42, 0.0, abs(band - 0.5));
        float bright = (0.22 + 0.78*p) * (0.62 + 0.55*shine);
        float a = clamp(bright*uOpacity*(0.55 + 0.45*facing), 0.0, 0.85);
        if (a < 0.004) discard;
        gl_FragColor = vec4(col*bright*uIntensity, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthTest: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.FrontSide, toneMapped: false,
  });
}

// Mancha iridiscente sutil: el mapa (smudge/brushed/diffraction) define dónde
// hay "suciedad" en la superficie; capta un arcoíris tenue según el ángulo de
// vista. uSide (-1 izq / +1 der / 0 siempre) hace que aparezca al rotar hacia
// ese lado, como manchas reales que sólo brillan en cierto ángulo.
export function createSmudge({ map = null, side = 0, scale = 2.0, opacity = 0.3, hue = 0, lo = 0.3, hi = 0.85, base = 0.3 } = {}) {
  return new THREE.ShaderMaterial({
    name: 'GradienteSmudge',
    uniforms: {
      uTime: { value: 0 }, uHover: { value: 0 }, uPointer: { value: new THREE.Vector2() },
      uMap: { value: map ?? white() }, uScale: { value: scale }, uSide: { value: side },
      uOpacity: { value: opacity }, uHue: { value: hue }, uLo: { value: lo }, uHi: { value: hi },
      uBase: { value: base },
      uRolePhase: { value: 0 }, uHueSpread: { value: 1 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(position,1.0);
        vView = mv.xyz; vN = normalize(normalMatrix*normal);
        gl_Position = projectionMatrix*mv; }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap; uniform float uTime,uScale,uSide,uOpacity,uHue,uLo,uHi,uBase; uniform vec2 uPointer;
      uniform float uRolePhase; uniform float uHueSpread;
      varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      const float TAU = 6.28318530718;
      vec3 spectral(float p){ return 0.52 + 0.48*cos(TAU*(p + vec3(0.0,0.33,0.67))); }
      void main(){
        vec3 N = normalize(vN); vec3 V = normalize(-vView);
        float facing = clamp(dot(N,V), 0.0, 1.0);
        float s = texture2D(uMap, vUv*uScale).g;
        float smear = smoothstep(uLo, uHi, s);            // estructura de la mancha
        // dirección de vista proyectada en la superficie: barre fuerte al rotar
        // → la iridiscencia recorre el espectro como una carta holográfica real
        vec3 lateral = V - N*max(dot(V,N), 0.0);
        float sweep = lateral.x*4.6 + lateral.y*3.2;
        float h = sweep + (vUv.x*0.3 + vUv.y*0.18) + s*0.5 + uPointer.x*0.3 + uHue + uTime*0.015;
        if (uHueSpread < 0.999) h = uRolePhase + 0.5 * uHueSpread * sin(TAU * (h - uRolePhase)); // banda suave de tono del rol
        vec3 col = spectral(h);
        // visibilidad según dirección de rotación (uSide * puntero.x)
        float dir = mix(1.0, clamp(0.18 + uSide*uPointer.x*2.2, 0.0, 1.0), step(0.001, abs(uSide)));
        float fres = pow(1.0 - facing, 1.1);
        float b = smear * (uBase + (1.0 - uBase)*fres) * dir;
        float a = clamp(b*uOpacity, 0.0, 0.55);
        if (a < 0.004) discard;
        gl_FragColor = vec4(col*b, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthTest: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.FrontSide, toneMapped: false,
  });
}

// Iridiscencia tipo IMPRESIÓN LENTICULAR: el mapa cepillado actúa como una
// rejilla de difracción / hoja lenticular → bandas finas de arcoíris alineadas
// con las líneas del cepillado, que SE DESPLAZAN por la superficie al inclinar.
export function createLenticular({ map = null, mask = null, scale = 1.0, freq = 12, sweep = 7, opacity = 0.28, angle = 2.356 } = {}) {
  return new THREE.ShaderMaterial({
    name: 'GradienteLenticular',
    uniforms: {
      uTime: { value: 0 }, uHover: { value: 0 }, uPointer: { value: new THREE.Vector2() },
      uMap: { value: map ?? white() }, uScale: { value: scale }, uFreq: { value: freq },
      uSweep: { value: sweep }, uOpacity: { value: opacity }, uAngle: { value: angle },
      uMask: { value: mask ?? white() }, uUseMask: { value: mask ? 1 : 0 },
      uRolePhase: { value: 0 }, uHueSpread: { value: 1 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(position,1.0);
        vView = mv.xyz; vN = normalize(normalMatrix*normal);
        gl_Position = projectionMatrix*mv; }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap, uMask; uniform float uTime,uScale,uFreq,uSweep,uOpacity,uAngle,uUseMask; uniform vec2 uPointer;
      uniform float uRolePhase; uniform float uHueSpread;
      varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      const float TAU = 6.28318530718;
      vec3 spectral(float p){ return 0.52 + 0.48*cos(TAU*(p + vec3(0.0,0.33,0.67))); }
      void main(){
        vec3 N = normalize(vN); vec3 V = normalize(-vView);
        float facing = clamp(dot(N,V), 0.0, 1.0);
        float b = texture2D(uMap, vUv*uScale).g;             // grano del cepillado
        float ca = cos(uAngle), sa = sin(uAngle);
        float across = vUv.x*ca + vUv.y*sa;                  // eje perpendicular a las líneas
        vec3 lateral = V - N*max(dot(V,N), 0.0);             // dir. de vista en el plano
        float tilt = (lateral.x*ca + lateral.y*sa);
        float center = 0.5 + tilt*uSweep;                    // el brillo se DESPLAZA al inclinar
        float d = across - center;
        float sheen = exp(-d*d*uFreq);                       // UNA banda de brillo suave (lenticular)
        float hue = tilt*1.6 + across*0.5 + uPointer.x*0.2 + uTime*0.02;
        if (uHueSpread < 0.999) hue = uRolePhase + 0.5 * uHueSpread * sin(TAU * (hue - uRolePhase)); // banda suave de tono del rol
        vec3 col = spectral(hue);
        // la iridiscencia sólo aparece SOBRE las vetas del cepillado (no en toda la cara)
        float grain = smoothstep(0.42, 0.72, b);
        // máscara opcional: confina el lenticular a una forma (p.ej. el logo)
        float mk = mix(1.0, texture2D(uMask, vUv).r, uUseMask);
        float amp = grain * sheen * mk;
        float a = clamp(amp*uOpacity, 0.0, 0.7);
        if (a < 0.004) discard;
        gl_FragColor = vec4(col*amp, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthTest: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.FrontSide, toneMapped: false,
  });
}

export function addHologramOverlay(src, mat, scale = 1.0025) {
  const o = new THREE.Mesh(src.geometry, mat);
  o.name = src.name + '_HOLO';
  o.position.copy(src.position); o.quaternion.copy(src.quaternion);
  o.scale.copy(src.scale).multiplyScalar(scale);
  o.renderOrder = (src.renderOrder || 0) + 1; o.frustumCulled = src.frustumCulled;
  src.parent.add(o);
  return o;
}
