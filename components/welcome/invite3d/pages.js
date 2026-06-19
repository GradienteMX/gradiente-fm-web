// Las 5 "cartas" del carrusel: cada una es un plano con la textura rasterizada
// de un SVG de diseño (card-templates). Los SVG usan Fraunces + IBM Plex Mono;
// como un <img> de SVG NO ve las fuentes web de la página, EMBEBEMOS las fuentes
// como @font-face base64 dentro del SVG antes de rasterizarlo.
import * as THREE from "three";

export const PAGE_W = 4.4;
export const PAGE_H = 2.82; // ≈ proporción del viewBox 1000×640

const SVG_DIR = "/tarjeta/cards/";
const FONT_DIR = "/tarjeta/fonts/";
// Orden = orden en el carrusel.
const CARDS = ["bienvenido", "niveles", "archivo-vivo", "calibracion-analogica", "la-puerta"];

async function b64(file) {
  const buf = await (await fetch(FONT_DIR + file)).arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  }
  return btoa(bin);
}

let _fontCSS = null;
async function fontCSS() {
  if (_fontCSS) return _fontCSS;
  const [fr, monoM, monoS] = await Promise.all([
    b64("Fraunces.ttf"),
    b64("IBMPlexMono-Medium.ttf"),
    b64("IBMPlexMono-SemiBold.ttf"),
  ]);
  const face = (fam, weight, data, style = "normal") =>
    `@font-face{font-family:'${fam}';font-weight:${weight};font-style:${style};src:url(data:font/ttf;base64,${data}) format('truetype');}`;
  _fontCSS =
    face("Fraunces", 400, fr) +
    face("Fraunces", 400, fr, "italic") +
    face("IBM Plex Mono", 400, monoM) +
    face("IBM Plex Mono", 600, monoS);
  return _fontCSS;
}

async function svgTexture(name, css) {
  const raw = await (await fetch(SVG_DIR + name + ".svg")).text();
  // Inyecta las @font-face embebidas dentro del primer <defs> para que apliquen
  // al rasterizar el SVG como imagen.
  const withFonts = raw.replace("<defs>", `<defs><style>${css}</style>`);
  const blob = new Blob([withFonts], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode(); // espera a que el SVG (con sus fuentes embebidas) esté listo
    const W = 1500, H = Math.round((1500 * 640) / 1000); // 1500×960
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    c.getContext("2d").drawImage(img, 0, 0, W, H);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Devuelve 5 mallas (una por SVG), en el orden de CARDS.
export async function buildPages() {
  const css = await fontCSS();
  const texes = await Promise.all(CARDS.map((n) => svgTexture(n, css)));
  return texes.map((map, i) => {
    const mat = new THREE.MeshStandardMaterial({
      map,
      roughness: 0.9,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(PAGE_W, PAGE_H, 1, 1), mat);
    mesh.name = `card-${CARDS[i]}`;
    return mesh;
  });
}
