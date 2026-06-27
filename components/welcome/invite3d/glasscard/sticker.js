// Capa de CALCOMANÍAS (stickers) sobre el vidrio — el primer ladrillo del sistema
// de cosméticos de la tarjeta. A diferencia del texto grabado (que vive DETRÁS del
// vidrio, con refracción/parallax), una calcomanía va PEGADA ENCIMA del vidrio:
// nítida, en relieve DELGADO, con su propio tornasol holográfico. Hoy la lista la
// alimenta el partner que trae el código de invitación; mañana, los cosméticos que
// el usuario posea. La imagen llena TODA la cara redondeada (hasta las esquinas);
// la geometría redondea el troquel; un canto fino le da grosor sin volverse bloque.
import * as THREE from 'three';
import { createHologramMaterial } from './hologram.js';

function loadImage(url) {
  return new Promise((res) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // /partners/* es same-origin → canvas no se "tainta"
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = url;
  });
}

// Mata el reflejo DIRECTO de las fuentes de luz (los "blobs" especulares) igual que
// hace la tarjeta con hideLightSources, dejando sólo el reflejo del ENTORNO. Sin
// esto el sticker era la ÚNICA superficie con specular crudo de las 6 luces → glints
// que el bloom esparcía como un halo brillante sobre el vidrio de al lado.
function killDirectSpecular(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader) => {
    if (prev) prev(shader);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      '#include <lights_fragment_end>\n  reflectedLight.directSpecular *= 0.0;',
    );
  };
  mat.needsUpdate = true;
}

// THREE.Shape rounded-rect centrado en el origen, para extruir el CUERPO del chip.
function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// UV planares 0-1 desde el bounding box XY → mapea la imagen/tornasol sobre la cara
// redondeada (la geometría recorta las esquinas; la imagen llega hasta ellas).
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

// Logo recortado en COVER para llenar todo el cuadro (la geometría redondea las
// esquinas). Respaldo oscuro por si el logo trae transparencia.
function chipImageTexture(img, { s = 512 } = {}) {
  const c = document.createElement('canvas'); c.width = c.height = s;
  const x = c.getContext('2d');
  x.fillStyle = '#0e0a06'; x.fillRect(0, 0, s, s);
  if (img) {
    const ar = img.width / img.height;
    let dw = s, dh = s / ar;
    if (dh < s) { dh = s; dw = s * ar; } // cover
    x.drawImage(img, (s - dw) / 2, (s - dh) / 2, dw, dh);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true;
  return t;
}

// Construye UN chip: rounded-rect extruido DELGADO (cara = imagen, canto = filo
// oscuro sutil) + tornasol laminado encima. Devuelve { group, holoMat } o null.
// El caller orienta el grupo (rotation.y = π) para que mire al dorso.
export async function buildStickerChip({ url, size = 0.9, holoPattern = null }) {
  const img = await loadImage(url);
  if (!img) return null;
  const tex = chipImageTexture(img);
  const group = new THREE.Group();
  group.name = 'sticker-chip';

  const shape = roundedRectShape(size, size, size * 0.2);

  // cuerpo DELGADO con el FILO REDONDEADO (bisel generoso): el perfil es un domo
  // suave, no un canto recto → lee como sticker troquelado, no como bloque. UN solo
  // material con la imagen + UV planar: la imagen ENVUELVE el bisel hasta el canto,
  // así no queda contorno negro en los lados. emissiveMap = la propia imagen → se
  // mantiene legible (no la apaga la luz) y el clearcoat le da el laminado brillante.
  const depth = size * 0.02;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: size * 0.022, bevelSize: size * 0.024,
    bevelSegments: 4, steps: 1, curveSegments: 24,
  });
  reprojectPlanarUV(geo);
  const bodyMat = new THREE.MeshPhysicalMaterial({
    map: tex, emissive: new THREE.Color('#ffffff'), emissiveMap: tex, emissiveIntensity: 0.65,
    metalness: 0.0, roughness: 0.5, clearcoat: 1.0, clearcoatRoughness: 0.4,
    envMapIntensity: 0.6, side: THREE.FrontSide,
  });
  killDirectSpecular(bodyMat); // no es la única superficie sin suprimir → sin halo de luz
  const chip = new THREE.Mesh(geo, bodyMat);
  chip.renderOrder = 29;
  group.add(chip);

  // tornasol laminado sobre TODO el cuerpo (cap + bisel) → sigue el domo y enciende
  // el filo redondeado al inclinar, como una lámina holográfica de verdad. Cáscara
  // ligeramente mayor (mismo geo escalado) para evitar z-fighting.
  const holoMat = createHologramMaterial({
    pattern: holoPattern, patternScale: 1.4,
    edgeWeight: 0.6, surfaceWeight: 1.0, intensity: 1.4, opacity: 0.42, side: THREE.FrontSide,
  });
  // MISMA huella que el chip (sin escalar): antes scale 1.006 hacía que el tornasol
  // ADITIVO pintara 0.6% más grande que el chip → un halo iridiscente sobre el vidrio
  // de al lado. polygonOffset lo separa en profundidad (evita z-fighting) SIN agrandar
  // la huella, así el brillo queda confinado al chip.
  holoMat.polygonOffset = true;
  holoMat.polygonOffsetFactor = -2;
  holoMat.polygonOffsetUnits = -2;
  const holo = new THREE.Mesh(geo.clone(), holoMat);
  holo.renderOrder = 31;
  group.add(holo);

  return { group, holoMat, meshes: [chip, holo] };
}

// Coloca la lista de chips en la ZONA derecha del dorso. Devuelve los holoMats (para
// el loop de animación) y los grupos (el caller los oculta en la cara delantera —
// el cuerpo es geometría sólida, no se auto-culla como un quad de una cara).
export async function addStickers(stickers, parent, { anchor, size = 1.15, gap = 1.3, holoPattern = null } = {}) {
  const holoMats = [];
  const groups = [];
  const chips = await Promise.all(
    stickers.map((s) => buildStickerChip({ url: s.url, size, holoPattern })),
  );
  chips.filter(Boolean).forEach((chip, i) => {
    chip.group.rotation.y = Math.PI; // mira a -Z (dorso)
    chip.group.position.set(anchor.x, anchor.y - i * gap, anchor.z);
    parent.add(chip.group);
    holoMats.push(chip.holoMat);
    groups.push(chip.group);
  });
  return { holoMats, groups };
}
