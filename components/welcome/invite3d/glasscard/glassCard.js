// Tarjeta holográfica de vidrio (portada desde el prototipo card-3d) lista para
// vivir dentro de la experiencia del sobre. Construye el GLB + materiales +
// capas holográficas en un grupo `root` y expone la MISMA interfaz que la
// tarjeta plana anterior (root, update, setPointer, setInteractive, flipCard…),
// de modo que la coreografía GSAP del sobre funciona sin cambios.
import * as THREE from 'three';
import gsap from 'gsap';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  makeInteriorTexture, makeFoilTexture, loadFonts, setInvite,
} from './cardPrint.js';
import {
  createHologramMaterial, createSmudge, createLenticular, addHologramOverlay,
} from './hologram.js';
import { ROLES } from '../config.js';

const GLB = '/tarjeta/models/gradiente-card.glb?v=8';
const TEX = '/tarjeta/textures/';

// el modelo mide ~4.9 de ancho; lo escalamos para que ocupe un hueco similar
// a la tarjeta plana anterior (≈3.3) y quepa dentro del sobre.
const FIT = 0.67;

const texLoader = new THREE.TextureLoader();
async function loadTex(url, { srgb = false, repeat = [1, 1] } = {}) {
  const t = await texLoader.loadAsync(url);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8; return t;
}
function loadImage(url) {
  return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = url; });
}

// Fase del arcoíris (la paleta coseno del shader: 0.52+0.48*cos(TAU*(p+[0,.33,.67])))
// más cercana al color del rol. Es el CENTRO de la banda de tonos de la
// iridiscencia, así el tornasol queda dentro de la familia del color del rol.
// Se compara en lineal (THREE.Color guarda lineal con colorManagement), que es
// el espacio donde opera spectral() antes del tonemapping.
function rolePhaseFor(color) {
  const TAU = 6.28318530718;
  const spec = (p) => [0, 0.33, 0.67].map((o) => 0.52 + 0.48 * Math.cos(TAU * (p + o)));
  let best = 0, bestD = Infinity;
  for (let i = 0; i < 512; i++) {
    const p = i / 512, s = spec(p);
    const d = (s[0] - color.r) ** 2 + (s[1] - color.g) ** 2 + (s[2] - color.b) ** 2;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

// Entorno del vidrio. Antes era studio.hdr: un estudio brillante con paneles de
// luz que la tarjeta reflejaba como manchas blancas y "lavaban" el vidrio. En su
// lugar generamos un equirectangular SUAVE, OSCURO y CÁLIDO, en paleta con la
// escena: el vidrio refleja algo tranquilo y con clima, no un estudio. Un único
// "softbox" ámbar apagado le da un brillo vivo al inclinarse, sin quemar.
function softWarmEnvTexture() {
  const w = 1024, h = 512;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  // base: techo cálido-tenue -> horizonte -> suelo ámbar MUY apagado.
  // El suelo nunca llega a negro: el vidrio refleja el entorno en cada ángulo,
  // así que un suelo negro hacía que la tarjeta se apagara a negro puro al
  // inclinarse (la reflexión Fresnel barría hacia la zona sin luz). Un ember
  // cálido tenue mantiene la tarjeta "viva" en todo el rango de tilt.
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0.0, '#33210f');
  g.addColorStop(0.42, '#241608');
  g.addColorStop(0.5, '#1f1409');
  g.addColorStop(1.0, '#171009');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  // softbox cálido (key): brillo suave que el vidrio engancha al inclinarse.
  // ámbar apagado, nunca blanco, para no recortar.
  const key = x.createRadialGradient(w * 0.58, h * 0.30, 0, w * 0.58, h * 0.30, w * 0.26);
  key.addColorStop(0.0, 'rgba(176,120,66,0.95)');
  key.addColorStop(0.5, 'rgba(120,80,44,0.45)');
  key.addColorStop(1.0, 'rgba(120,80,44,0.0)');
  x.fillStyle = key; x.fillRect(0, 0, w, h);
  // relleno frío muy sutil al lado opuesto: separa el canto sin enfriar la escena
  const fill = x.createRadialGradient(w * 0.16, h * 0.46, 0, w * 0.16, h * 0.46, w * 0.5);
  fill.addColorStop(0.0, 'rgba(70,104,150,0.28)');
  fill.addColorStop(1.0, 'rgba(70,104,150,0.0)');
  x.fillStyle = fill; x.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// el vidrio se ilumina con este entorno (lo llama el host una vez). PMREM lo
// prefiltra para los distintos niveles de roughness del material.
export function setupGlassEnvironment(renderer, scene, intensity = 1.1) {
  const src = softWarmEnvTexture();
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const env = pmrem.fromEquirectangular(src).texture;
  src.dispose();
  pmrem.dispose();
  scene.environment = env;
  scene.environmentIntensity = intensity;
  scene.environmentRotation = new THREE.Euler(0, THREE.MathUtils.degToRad(-25), 0);
}

// Texturas del/los logo(s) para el área EMBOSS_FACE, a partir de line-art (tinta
// oscura sobre fondo claro, como grotesco-face.png). Devuelve dos mapas:
//   · print: "impresión" gunmetal con alpha = tinta (siempre legible, SIN reflejo)
//   · mask:  blanco en la tinta / negro fuera, para el shader de foil iridiscente
// Compositar más logos = pasar más imágenes en `imgs` (se centran/enciman aquí).
function logoTextures(imgs, { print = '#7a838f', cover = 0.72 } = {}) {
  const s = 1024;
  const base = document.createElement('canvas'); base.width = base.height = s;
  const bx = base.getContext('2d');
  bx.fillStyle = '#ffffff'; bx.fillRect(0, 0, s, s); // fondo claro = sin tinta
  imgs.filter(Boolean).forEach((img) => {
    const ar = img.width / img.height, dw = s * cover, dh = dw / ar;
    bx.drawImage(img, (s - dw) / 2, (s - dh) / 2, dw, dh);
  });
  const d = bx.getImageData(0, 0, s, s).data;
  const maskArr = new Uint8ClampedArray(d.length);
  const printArr = new Uint8ClampedArray(d.length);
  const pr = parseInt(print.slice(1, 3), 16), pg = parseInt(print.slice(3, 5), 16), pb = parseInt(print.slice(5, 7), 16);
  for (let i = 0; i < d.length; i += 4) {
    const ink = 255 - (d[i] + d[i + 1] + d[i + 2]) / 3; // 255 tinta, 0 fondo claro
    maskArr[i] = maskArr[i + 1] = maskArr[i + 2] = ink; maskArr[i + 3] = 255;
    printArr[i] = pr; printArr[i + 1] = pg; printArr[i + 2] = pb; printArr[i + 3] = ink;
  }
  const mk = (arr, srgb) => {
    const cc = document.createElement('canvas'); cc.width = cc.height = s;
    cc.getContext('2d').putImageData(new ImageData(arr, s, s), 0, 0);
    const t = new THREE.CanvasTexture(cc);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8; t.needsUpdate = true; return t;
  };
  return { print: mk(printArr, true), mask: mk(maskArr, false) };
}

// UV planas a partir de los límites XY de la geometría: centra el logo en la malla
// EMBOSS_FACE sin depender de las UV que traiga el GLB.
function reprojectPlanarUV(geometry) {
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  const w = (bb.max.x - bb.min.x) || 1, h = (bb.max.y - bb.min.y) || 1;
  const pos = geometry.attributes.position;
  let uv = geometry.attributes.uv;
  if (!uv) { uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2); geometry.setAttribute('uv', uv); }
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) - bb.min.x) / w, (pos.getY(i) - bb.min.y) / h);
  }
  uv.needsUpdate = true;
}

// cara trasera: código + barcode grabados en vidrio
function backTexture(invite) {
  const w = 2048, h = 1244, c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  const bg = x.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#160d07'); bg.addColorStop(0.5, '#0f0805'); bg.addColorStop(1, '#0a0503');
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  x.fillStyle = '#b59a72';
  x.font = '500 40px "IBM Plex Mono", monospace';
  x.fillText('NECESITAS DOS COSAS', 150, 220);
  x.font = '400 34px "IBM Plex Mono", monospace';
  x.fillStyle = 'rgba(220,210,195,0.8)';
  x.fillText('1 — Tu código de acceso', 150, 300);
  x.fillText('2 — Una primera publicación', 150, 352);
  // barcode derivado del código
  let bx = 150; const by = 470, bh = 150;
  x.fillStyle = '#cdd4db';
  [...invite.code].slice(0, 24).forEach((ch) => {
    const v = ch.charCodeAt(0), bw = 4 + (v % 5) * 3;
    if (ch !== '-') x.fillRect(bx, by, bw, bh);
    bx += bw + 6;
  });
  x.font = '600 60px "IBM Plex Mono", monospace';
  x.fillStyle = '#cdd4db';
  x.fillText(invite.code, 150, by + bh + 70);
  x.font = 'italic 400 44px "Fraunces", serif';
  x.fillStyle = 'rgba(190,165,120,0.7)';
  x.fillText('El archivo no tiene dueños. Solo custodios temporales.', 150, 900);
  x.font = '600 38px "IBM Plex Mono", monospace';
  x.fillStyle = '#b59a72';
  x.fillText('GRADIENTE.ORG', 150, 1000);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 8;
  return t;
}

function roundedRectGeo(w, h, r) {
  const x = -w / 2, y = -h / 2;
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ShapeGeometry(s, 16);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h);
  uv.needsUpdate = true;
  return g;
}

export async function buildGlassCard({ invite, reduced = false } = {}) {
  setInvite(invite);
  // rol del invitado → fase del arcoíris (centro de la banda de tonos de la
  // iridiscencia) + ancho de banda; y el color para el chip impreso.
  const role = ROLES[(invite?.role || 'user').toLowerCase()] || ROLES.user;
  const rolePhase = rolePhaseFor(new THREE.Color(role.color));
  const roleSpread = role.spread ?? 1.0;
  const [grotesco, caseRough, holoPattern, caseBrushed] = await Promise.all([
    loadImage(TEX + 'grotesco-face.png'),
    loadTex(TEX + 'case-roughness.png', { repeat: [1.6, 1.6] }),
    loadTex(TEX + 'holo-pattern.png', { repeat: [2.4, 2.4] }),
    loadTex(TEX + 'case-brushed.png', { repeat: [1.0, 1.0] }),
  ]);
  await loadFonts(invite);
  const interiorTex = makeInteriorTexture();
  const gltf = await new GLTFLoader().loadAsync(GLB);
  const model = gltf.scene;

  const hologramMats = [];
  const get = (n) => model.getObjectByName(n);

  // Ocultar el REFLEJO de las fuentes de luz sin perder su iluminación. El reflejo
  // de un material tiene dos partes: el specular DIRECTO (la imagen-espejo de las
  // luces analíticas = los "blobs") y el INDIRECTO (el reflejo del entorno = el
  // brillo suave y la iridiscencia). uLightSpec escala SÓLO el directo: en 0 las
  // luces siguen iluminando (difuso) pero ya no se ven como fuentes; el entorno
  // sigue dando el reflejo glaseado. Compartido por todos los materiales del cuerpo.
  // Ajustable en vivo con __glass.lightSpec(v) (0 = sin reflejo de luces).
  const lightSpec = { value: 0.0 };
  const hideLightSources = (mat) => {
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (shader) => {
      if (prev) prev(shader);
      shader.uniforms.uLightSpec = lightSpec;
      shader.fragmentShader = 'uniform float uLightSpec;\n' + shader.fragmentShader.replace(
        '#include <lights_fragment_end>',
        '#include <lights_fragment_end>\n  reflectedLight.directSpecular *= uLightSpec;',
      );
    };
    mat.needsUpdate = true;
  };

  // ---------- materiales ----------
  const glass = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#ffffff'), metalness: 0, roughness: 0.17, roughnessMap: caseRough,
    transmission: 1, ior: 1.5, thickness: 0.55,
    attenuationColor: new THREE.Color('#c98a5a'), attenuationDistance: 3.5,
    clearcoat: 1, clearcoatRoughness: 0.34, clearcoatRoughnessMap: caseRough, // reflejo difuso, sin punto cegador
    // iridescencia del vidrio BAJA: es un arcoíris de capa fina SIN teñir por el
    // rol; al reducirla, la iridiscencia teñida (capas holo) domina y el color
    // del rol se lee limpio en lugar de diluirse con arcoíris.
    iridescence: 0.22, iridescenceIOR: 1.3, iridescenceThicknessRange: [120, 700],
    envMapIntensity: 1.0, transparent: true, depthWrite: false, side: THREE.FrontSide,
  });
  hideLightSources(glass);
  // La cara impresa tiene albedo casi negro (#0f0805), así que se ve casi sólo
  // por el especular angular: al inclinar fuera del reflejo se apagaba a negro.
  // emissiveMap usa esa MISMA textura oscura, así que subir emissiveIntensity no
  // levanta el sustrato (mapa oscuro × número = oscuro). La solución real es un
  // PISO emissive UNIFORME, independiente del mapa Y del ángulo: un ámbar tenue
  // sumado a toda la cara para que nunca llegue a negro puro. Ajustable en vivo
  // con __glass.intFloor(v). Mantenemos emissiveMap (glow del texto) y env fill.
  const interiorFloor = { value: 0.012 };
  const interior = new THREE.MeshPhysicalMaterial({
    map: interiorTex, roughness: 0.5, metalness: 0.0,
    emissive: new THREE.Color('#ffffff'), emissiveMap: interiorTex, emissiveIntensity: 0.42,
    clearcoat: 0.25, clearcoatRoughness: 0.4, envMapIntensity: 0.9,
  });
  interior.onBeforeCompile = (shader) => {
    shader.uniforms.uFloor = interiorFloor;
    shader.fragmentShader = 'uniform float uFloor;\n' + shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n  totalEmissiveRadiance += vec3(0.95, 0.72, 0.45) * uFloor;',
    );
  };
  hideLightSources(interior); // compone con el patch del piso (lo envuelve)
  const assign = (n, m, ro) => { const o = get(n); if (o && o.isMesh) { o.material = m; if (ro !== undefined) o.renderOrder = ro; } };
  assign('CardInterior', interior, 0);
  assign('Card3D', glass, 10);

  // ---------- emblema (logo) en EMBOSS_FACE ----------
  // EMBOSS_FACE ya NO es un medallón de vidrio: sólo marca DÓNDE va el logo. Se
  // pinta como FOIL iridiscente (igual que el texto GRADIENTE), no como vidrio, así
  // no añade reflejos ni participa en la iluminación. Dos capas sobre esa malla: una
  // "impresión" gunmetal SIN luz (MeshBasicMaterial, siempre legible) y un foil
  // arcoíris (createHologramMaterial con el logo como máscara) que reacciona a la
  // dirección de la tarjeta vía la normal y el puntero, exactamente como GRADIENTE.
  const logoMeshes = [];
  const embNames = [];
  model.traverse((o) => { if (/EMBOSS/i.test(o.name)) embNames.push(o.name + (o.isMesh ? '·mesh' : '')); });
  console.log('Gradiente: EMBOSS en GLB →', embNames.join(', ') || '(ninguno)');
  const embRing = get('EMBOSS_RING'); if (embRing) embRing.visible = false; // geometría vieja
  const embFace = get('EMBOSS_FACE');
  if (embFace && embFace.isMesh && grotesco) {
    reprojectPlanarUV(embFace.geometry);
    const { print, mask } = logoTextures([grotesco]);

    embFace.material = new THREE.MeshBasicMaterial({
      map: print, transparent: true, depthWrite: false, side: THREE.FrontSide,
    });
    embFace.renderOrder = 12;
    logoMeshes.push(embFace);

    const logoFoilMat = createHologramMaterial({
      mask, edgeWeight: 0.0, surfaceWeight: 1.0, intensity: 3.0, opacity: 0.92, side: THREE.FrontSide,
    });
    const lf = new THREE.Mesh(embFace.geometry, logoFoilMat);
    lf.position.copy(embFace.position); lf.quaternion.copy(embFace.quaternion); lf.scale.copy(embFace.scale);
    lf.position.z += 0.006; lf.renderOrder = 14;
    embFace.parent.add(lf);
    hologramMats.push(logoFoilMat); logoMeshes.push(lf);

    // lenticular SUTIL sobre el logo, confinado por la máscara del logo. El interior
    // usa sweep +3; aquí lo ponemos NEGATIVO para que la banda viaje en sentido
    // CONTRARIO al inclinar (reacciona al revés que el lenticular de la cara).
    const logoLentMat = createLenticular({
      map: caseBrushed, mask, scale: 2.0, freq: 5, sweep: -3, opacity: 0.4, angle: 2.356,
    });
    const ll = new THREE.Mesh(embFace.geometry, logoLentMat);
    ll.position.copy(embFace.position); ll.quaternion.copy(embFace.quaternion); ll.scale.copy(embFace.scale);
    ll.position.z += 0.009; ll.renderOrder = 15;
    embFace.parent.add(ll);
    hologramMats.push(logoLentMat); logoMeshes.push(ll);

    window.__glass = Object.assign(window.__glass || {}, {
      logoFoil: (v) => { logoFoilMat.uniforms.uIntensity.value = v; console.log('logo foil intensity', v); },
      logoOpacity: (v) => { logoFoilMat.uniforms.uOpacity.value = v; console.log('logo foil opacity', v); },
      logoLent: (v) => { logoLentMat.uniforms.uOpacity.value = v; console.log('logo lenticular opacity', v); },
      logoSweep: (v) => { logoLentMat.uniforms.uSweep.value = v; console.log('logo lenticular sweep (negativo = opuesto)', v); },
      logoFlip: () => { print.flipY = !print.flipY; mask.flipY = !mask.flipY; print.needsUpdate = mask.needsUpdate = true; console.log('logo flipY', print.flipY); },
    });
  } else if (embFace) {
    embFace.visible = false; // sin logo: no dejar el material viejo del GLB
  }

  // ---------- capas holográficas ----------
  const caseMesh = get('Card3D');
  if (caseMesh) {
    const edge = createHologramMaterial({
      pattern: holoPattern, patternScale: 2.4,
      edgeWeight: 1.6, surfaceWeight: 0.05, intensity: 2.1, opacity: 0.7, side: THREE.FrontSide,
    });
    addHologramOverlay(caseMesh, edge, 1.001).renderOrder = 12;
    hologramMats.push(edge);

    const ciB = get('CardInterior');
    if (ciB) {
      const lent = createLenticular({ map: caseBrushed, scale: 1.0, freq: 5, sweep: 3, opacity: 0.6, angle: 2.356 });
      const bm = new THREE.Mesh(ciB.geometry, lent);
      bm.position.copy(ciB.position); bm.quaternion.copy(ciB.quaternion); bm.scale.copy(ciB.scale);
      bm.position.z += 0.004; bm.renderOrder = 15;
      ciB.parent.add(bm); hologramMats.push(lent);
    }
    const surfGeo = roundedRectGeo(4.78, 2.96, 0.3);
    const addSurf = (map, side, opacity, hue, scale, lo, hi, ro) => {
      const m = createSmudge({ map, side, scale, opacity, hue, lo, hi });
      const mesh = new THREE.Mesh(surfGeo, m);
      mesh.position.set(0, 0, 0.004); mesh.renderOrder = ro;
      model.add(mesh); hologramMats.push(m);
    };
    addSurf(holoPattern, -1, 0.32, 0.0, 2.0, 0.3, 0.5, 16);
    addSurf(caseRough, 1, 0.3, 0.5, 1.6, 0.4, 0.9, 17);
  }

  // foil reactivo sobre GRADIENTE + código
  const ci = get('CardInterior');
  if (ci) {
    const fm = createHologramMaterial({
      mask: makeFoilTexture(), edgeWeight: 0.0, surfaceWeight: 1.0,
      intensity: 3.0, opacity: 0.92, side: THREE.FrontSide,
    });
    const foil = new THREE.Mesh(ci.geometry, fm);
    foil.position.copy(ci.position); foil.quaternion.copy(ci.quaternion); foil.scale.copy(ci.scale);
    foil.position.z += 0.012; foil.renderOrder = 13;
    ci.parent.add(foil); hologramMats.push(fm);
  }

  // ---------- cara trasera (vidrio grabado) ----------
  if (ci) {
    const backTex = backTexture(invite);
    // El dorso era un espejo LIMPIO (sin roughnessMap), así que reflejaba el
    // "softbox" cálido del entorno como un blob suave. La cara delantera no lo hace
    // porque su roughnessMap cepillado (caseRough) + las capas holo rompen el
    // reflejo en vetas. Le damos al dorso el mismo tratamiento: roughnessMap
    // cepillado, más rugosidad base y menos envMapIntensity => el reflejo del
    // entorno se dispersa en un brillo cepillado suave, sin blob.
    const backMat = new THREE.MeshPhysicalMaterial({
      map: backTex, roughness: 0.62, roughnessMap: caseRough, metalness: 0,
      emissive: new THREE.Color('#ffffff'), emissiveMap: backTex, emissiveIntensity: 0.2,
      envMapIntensity: 0.5, side: THREE.FrontSide,
    });
    hideLightSources(backMat); // por si acaso: mata cualquier reflejo de luz directa
    window.__glass = Object.assign(window.__glass || {}, {
      backRough: (v) => { backMat.roughness = v; console.log('backMat.roughness', v); },
      backEnv: (v) => { backMat.envMapIntensity = v; console.log('backMat.envMapIntensity', v); },
    });
    const back = new THREE.Mesh(ci.geometry, backMat);
    back.position.copy(ci.position); back.scale.copy(ci.scale);
    back.rotation.y = Math.PI;          // mira a -Z; tras el flip de 180° queda legible (no espejada)
    back.position.z -= 0.02; back.renderOrder = 1;
    ci.parent.add(back);

    // iridiscencia también en la CARA TRASERA: antes sólo la delantera tenía las
    // capas holográficas, así que al girar la tarjeta el dorso se veía plano. Aquí
    // espejamos el lenticular + una mancha mirando a -Z, justo POR FUERA del panel
    // trasero (z un poco más negativo => queda delante al ver el dorso). Aditivas,
    // así que sólo añaden brillo iridiscente, nunca oscurecen.
    const addBack = (mat, dz, ro) => {
      const m = new THREE.Mesh(ci.geometry, mat);
      m.position.copy(ci.position); m.scale.copy(ci.scale);
      m.rotation.y = Math.PI; m.position.z -= dz; m.renderOrder = ro;
      ci.parent.add(m); hologramMats.push(mat);
    };
    addBack(createLenticular({ map: caseBrushed, scale: 1.0, freq: 5, sweep: 3, opacity: 0.55, angle: 2.356 }), 0.026, 15);
    addBack(createSmudge({ map: caseRough, side: 0, scale: 1.6, opacity: 0.26, hue: 0.5, lo: 0.4, hi: 0.9 }), 0.03, 16);
  }

  // ---------- jerarquía: root → tilt → flip → model ----------
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  model.position.sub(box.getCenter(new THREE.Vector3()));

  const flip = new THREE.Group(); flip.name = 'glass-flip'; flip.add(model);
  const tilt = new THREE.Group(); tilt.name = 'glass-tilt'; tilt.add(flip);
  const root = new THREE.Group(); root.name = 'glass-card'; root.add(tilt);
  root.scale.setScalar(FIT);

  // raycast: usar la geometría de la carcasa
  const meshes = [caseMesh].filter(Boolean);

  const target = new THREE.Vector2(0, 0);
  const smoothed = new THREE.Vector2(0, 0);
  const D2R = THREE.MathUtils.degToRad;
  const damp = (a, b, l, dt) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-l * dt));
  const state = { interactive: false, flipped: false, flipping: false, reduced };

  function setPointer(x, y) { target.set(x, y); }
  function setInteractive(on) {
    state.interactive = on;
    if (!on) { target.set(0, 0); }
  }
  function setReduced(on) { state.reduced = on; }
  function flipCard() {
    if (state.flipping) return;
    state.flipping = true; state.flipped = !state.flipped;
    gsap.to(flip.rotation, {
      y: state.flipped ? Math.PI : 0,
      duration: state.reduced ? 0.2 : 0.9, ease: state.reduced ? 'power1.inOut' : 'power3.inOut',
      onComplete: () => (state.flipping = false),
    });
  }

  function update(dt, elapsed, active = true) {
    if (!active) return;
    // ocultar el logo cuando la cara delantera no mira a cámara (trasera)
    const showFront = Math.cos(flip.rotation.y) > 0;
    for (const m of logoMeshes) m.visible = showFront;
    for (const m of hologramMats) {
      m.uniforms.uTime.value = elapsed;
      if (m.uniforms.uHover) m.uniforms.uHover.value = 0.4 + 0.6 * Math.min(1, smoothed.length());
      if (m.uniforms.uPointer) m.uniforms.uPointer.value.copy(smoothed);
    }
    if (!state.interactive) return;
    const k = state.reduced ? 0.3 : 1.0;       // reduce el rango si prefiere menos movimiento
    const idleX = state.reduced ? 0 : Math.sin(elapsed * 0.4) * 0.01;
    const idleY = state.reduced ? 0 : Math.sin(elapsed * 0.31) * 0.012;
    smoothed.x = damp(smoothed.x, target.x, 6.5, dt);
    smoothed.y = damp(smoothed.y, target.y, 6.5, dt);
    // giro 3D amplio que sigue al cursor (+ ligero balanceo y deriva)
    tilt.rotation.y = D2R(-3) + smoothed.x * 0.62 * k + idleY;
    tilt.rotation.x = D2R(2) - smoothed.y * 0.46 * k + idleX;
    tilt.rotation.z = -smoothed.x * 0.06 * k;
    tilt.position.x = smoothed.x * 0.12 * k;
    tilt.position.y = smoothed.y * 0.08 * k;
  }

  // --- ajuste de reflejo en vivo (consola): __glass.env(0.5), .coat(0.4)… ---
  window.__glass = Object.assign(window.__glass || {}, {
    env: (v) => { glass.envMapIntensity = v; console.log('glass.envMapIntensity', v); },
    coat: (v) => { glass.clearcoatRoughness = v; console.log('clearcoatRoughness', v); },
    rough: (v) => { glass.roughness = v; console.log('roughness', v); },
    irid: (v) => { glass.iridescence = v; console.log('iridescence', v); },

    // --- AISLAR el "negro": apaga capas para ver qué se apaga ---
    // Inclina la tarjeta a un ángulo negro y prueba:
    //   __glass.glassOff()  → si la interior SIGUE negra, el problema es la cara
    //                         impresa (no el vidrio). __glass.glassOn() restaura.
    //   __glass.holoOff()   → descarta las capas aditivas (holo/foil/lenticular).
    glassOff: () => { glass.visible = false; console.log('glass OFF (solo cara interior)'); },
    glassOn: () => { glass.visible = true; console.log('glass ON'); },
    holoOff: () => { hologramMats.forEach((m) => { m.visible = false; }); console.log('holo layers OFF'); },
    holoOn: () => { hologramMats.forEach((m) => { m.visible = true; }); console.log('holo layers ON'); },

    // --- reflejo de las FUENTES de luz (0 = no se ven, sólo iluminan) ---
    lightSpec: (v) => { lightSpec.value = v; console.log('reflejo de fuentes (directSpecular)', v); },

    // --- afinar la cara interior (la que parece apagarse a negro) ---
    intFloor: (v) => { interiorFloor.value = v; console.log('interior emissive floor', v); },
    intEmissive: (v) => { interior.emissiveIntensity = v; console.log('interior.emissiveIntensity', v); },
    intEnv: (v) => { interior.envMapIntensity = v; console.log('interior.envMapIntensity', v); },
    intRough: (v) => { interior.roughness = v; console.log('interior.roughness', v); },

    // --- COLOR del cuerpo de la tarjeta (el vidrio). El "negro de algunos lados"
    // NO es el lenticular (es aditivo, sólo aclara): es el vidrio reflejando el
    // entorno oscuro + absorción. Calienta/aclara el cuerpo con estos: ---
    glassColor: (hex) => { glass.color.set(hex); med.color.set(hex); console.log('glass.color', hex); },
    atten: (hex) => { glass.attenuationColor.set(hex); med.attenuationColor.set(hex); console.log('attenuationColor', hex); },
    attenDist: (v) => { glass.attenuationDistance = v; console.log('attenuationDistance', v); },
  });

  // --- iridiscencia por rol: COMPRIME el arcoíris a una banda alrededor del
  // tono del rol (sigue tornasolando, pero dentro de la familia del color). El
  // centro es rolePhase; el ancho es spread (1 = arcoíris completo). USUARIO
  // tiene spread 1 → arcoíris completo. Ajustable: __glass.roleHue(0.2).
  const applyRoleHue = (spread) => {
    for (const m of hologramMats) {
      if (m.uniforms && m.uniforms.uRolePhase) {
        m.uniforms.uRolePhase.value = rolePhase;
        m.uniforms.uHueSpread.value = spread;
      }
    }
  };
  applyRoleHue(roleSpread);
  window.__glass = Object.assign(window.__glass || {}, {
    roleHue: (spread) => { applyRoleHue(spread); console.log('role hue band →', role.label, 'spread', spread, 'phase', rolePhase.toFixed(3)); },
  });

  return { root, tilt, flip, meshes, update, setPointer, setInteractive, setReduced, flipCard, state };
}
