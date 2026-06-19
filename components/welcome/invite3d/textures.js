// Fábrica de texturas: todo el "impreso" del sobre, las páginas y la tarjeta
// se dibuja en canvas 2D y se sube como CanvasTexture. Así el contenido es
// 100% data-driven y fácil de poblar desde la app real.
import * as THREE from "three";
import { PALETTE, VIBE_STOPS, COPY } from "./config.js";

const FONT_MONO = '"IBM Plex Mono", monospace';
const FONT_SERIF = '"Fraunces", serif';
const FONT_GROTESK = '"Space Grotesk", sans-serif';
const FONT_DISPLAY = '"Rajdhani", sans-serif';

// ---------------------------------------------------------------- utilidades

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(canvas, { srgb = true } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  return tex;
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ruido determinista barato (sin Math.random): cada textura crea su propio
// generador con semilla fija, así cada factory es determinista por sí misma
// sin importar el orden o el número de invocaciones.
function makeRng(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function paperGrain(ctx, w, h, { dark = 0.05, light = 0.05, fibers = 420, rnd = makeRng(7) } = {}) {
  ctx.save();
  for (let i = 0; i < fibers; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const len = 4 + rnd() * 26;
    const ang = rnd() * Math.PI;
    const isDark = rnd() > 0.5;
    ctx.strokeStyle = isDark
      ? `rgba(28,24,19,${dark * rnd()})`
      : `rgba(255,250,235,${light * rnd()})`;
    ctx.lineWidth = 0.6 + rnd() * 0.9;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }
  // viñeta sutil en bordes
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(28,24,19,0.16)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function vibeGradient(ctx, x, y, w) {
  const g = ctx.createLinearGradient(x, y, x + w, y);
  VIBE_STOPS.forEach(([c, off]) => g.addColorStop(off, c));
  return g;
}

// reduce el tamaño de fuente hasta que el texto (con letterSpacing manual)
// quepa en maxWidth; devuelve el tamaño final y el ancho medido
function fitText(ctx, text, weightStyle, family, basePx, maxWidth, spacing = 0, minPx = 22) {
  let px = basePx;
  for (;;) {
    ctx.font = `${weightStyle} ${px}px ${family}`;
    const w = [...text].reduce((a, ch) => a + ctx.measureText(ch).width + spacing, -spacing);
    if (w <= maxWidth || px <= minPx) return { px, w };
    px -= 2;
  }
}

// zona suave para máscaras holo sin ctx.filter (no soportado en Safari < 18):
// pinta el rect en un canvas diminuto y lo re-escala con smoothing, lo que
// produce un borde difuminado equivalente a un box blur.
function softZone(mc, x, y, zw, zh, color) {
  // el núcleo lleno ocupa 40/64 del canvas diminuto; escalamos cada eje para
  // que ese núcleo cubra exactamente la zona pedida y el margen haga el fade
  const tiny = makeCanvas(64, 64);
  const t = tiny.getContext("2d");
  t.fillStyle = color;
  t.fillRect(12, 12, 40, 40);
  const spanX = zw / (40 / 64);
  const spanY = zh / (40 / 64);
  mc.save();
  mc.imageSmoothingEnabled = true;
  mc.imageSmoothingQuality = "high";
  mc.drawImage(tiny, x - (spanX - zw) / 2, y - (spanY - zh) / 2, spanX, spanY);
  mc.restore();
}

function drawFader(ctx, x, y, w, { knob = 0.72, labels = true, ink = PALETTE.ink } = {}) {
  ctx.save();
  ctx.fillStyle = vibeGradient(ctx, x, y, w);
  ctx.fillRect(x, y, w, 6);
  // marcas 0..10
  ctx.fillStyle = ink;
  for (let i = 0; i <= 10; i++) {
    const tx = x + (w * i) / 10;
    ctx.fillRect(tx - 1, y - 6, 2, 4);
  }
  // perilla
  const kx = x + w * knob;
  ctx.fillStyle = ink;
  ctx.fillRect(kx - 5, y - 10, 10, 26);
  ctx.fillStyle = PALETTE.plate;
  ctx.fillRect(kx - 1.5, y - 6, 3, 18);
  if (labels) {
    ctx.fillStyle = ink;
    ctx.font = `500 17px ${FONT_MONO}`;
    ctx.textAlign = "left";
    ctx.fillText("GLACIAL · 0", x, y + 38);
    ctx.textAlign = "right";
    ctx.fillText("10 · VOLCÁN", x + w, y + 38);
  }
  ctx.restore();
}

function letterSpaced(ctx, text, x, y, spacing, align = "left") {
  // canvas letterSpacing aún no es universal; lo hacemos a mano
  const widths = [...text].map((ch) => ctx.measureText(ch).width + spacing);
  const total = widths.reduce((a, b) => a + b, -spacing);
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  [...text].forEach((ch, i) => {
    ctx.fillText(ch, cx, y);
    cx += widths[i];
  });
  ctx.textAlign = prevAlign;
}

// --------------------------------------------------------------- sobre manila

export function envelopeFrontTexture(invite) {
  const w = 1024, h = 690;
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");

  ctx.fillStyle = PALETTE.paper;
  ctx.fillRect(0, 0, w, h);
  paperGrain(ctx, w, h, { fibers: 700, rnd: makeRng(11) });

  ctx.fillStyle = PALETTE.ink;

  // bloque destinatario (mecanografiado) — debajo del sticker de cierre
  ctx.font = `500 21px ${FONT_MONO}`;
  letterSpaced(ctx, "PARA:", 96, 492, 4);
  fitText(ctx, invite.name.toUpperCase(), "600", FONT_MONO, 40, w - 96 * 2, 3);
  letterSpaced(ctx, invite.name.toUpperCase(), 96, 546, 3);
  ctx.font = `500 19px ${FONT_MONO}`;
  ctx.fillStyle = "rgba(28,24,19,0.62)";
  letterSpaced(ctx, "DE: LOS CUSTODIOS · GRADIENTE MX", 96, 588, 3);

  // sello rectangular BETA CERRADA (queda bajo la solapa: se revela al abrir)
  ctx.save();
  ctx.translate(700, 132);
  ctx.rotate(-0.06);
  ctx.strokeStyle = "rgba(28,24,19,0.78)";
  ctx.lineWidth = 4;
  ctx.strokeRect(-130, -34, 260, 68);
  ctx.fillStyle = "rgba(28,24,19,0.78)";
  ctx.font = `700 26px ${FONT_MONO}`;
  ctx.textAlign = "center";
  letterSpaced(ctx, "BETA CERRADA", 0, 9, 5, "center");
  ctx.restore();

  // matasellos circular (también bajo la solapa)
  ctx.save();
  ctx.translate(430, 132);
  ctx.strokeStyle = "rgba(28,24,19,0.5)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 56, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 40, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(28,24,19,0.5)";
  ctx.font = `600 15px ${FONT_MONO}`;
  ctx.textAlign = "center";
  ctx.fillText("MMXXVI", 0, -4);
  ctx.fillText("MX", 0, 16);
  ctx.restore();

  return toTexture(c);
}

export function envelopeBackTexture() {
  const w = 1024, h = 690;
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  ctx.fillStyle = PALETTE.paper;
  ctx.fillRect(0, 0, w, h);
  paperGrain(ctx, w, h, { fibers: 600, rnd: makeRng(23) });
  return toTexture(c);
}

export function flapTexture() {
  const w = 1024, h = 512;
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  // tono ligeramente más profundo que el cuerpo para que la solapa se lea
  const base = ctx.createLinearGradient(0, h, 0, 0);
  base.addColorStop(0, "#dd9c1d");
  base.addColorStop(1, "#d3931a");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  paperGrain(ctx, w, h, { fibers: 380, rnd: makeRng(37) });
  // sombra de pliegue en la bisagra (la bisagra es v=1, arriba del canvas
  // según el mapeo UV de la solapa)
  const g = ctx.createLinearGradient(0, 0, 0, 90);
  g.addColorStop(0, "rgba(28,24,19,0.22)");
  g.addColorStop(1, "rgba(28,24,19,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, 90);
  return toTexture(c);
}

export function stickerTexture(emblem) {
  const s = 512;
  const c = makeCanvas(s, s);
  const ctx = c.getContext("2d");
  const cx = s / 2;

  // disco crema
  ctx.beginPath();
  ctx.arc(cx, cx, 246, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.plate;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = PALETTE.ink;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cx, 196, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.stroke();

  // texto en anillo
  const ring = "GRADIENTE · BETA · INVITACIÓN CERRADA · MMXXVI · ";
  ctx.fillStyle = PALETTE.ink;
  ctx.font = `600 34px ${FONT_MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const radius = 221;
  const step = (Math.PI * 2) / ring.length;
  [...ring].forEach((ch, i) => {
    const a = i * step - Math.PI / 2;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * radius, cx + Math.sin(a) * radius);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });

  // emblema grotesco al centro (si cargó) o fader
  if (emblem) {
    const size = 250;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.drawImage(emblem, cx - size / 2, cx - size / 2, size, size);
    ctx.restore();
  } else {
    drawFader(ctx, cx - 120, cx, 240, { labels: false });
  }

  const tex = toTexture(c);
  return tex;
}

// -------------------------------------------------------------------- páginas

function pageBase(title) {
  const w = 1024, h = 680;
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  ctx.fillStyle = PALETTE.plate;
  ctx.fillRect(0, 0, w, h);
  paperGrain(ctx, w, h, { fibers: 300, dark: 0.035, rnd: makeRng(title.length * 101 + 13) });

  // margen y folio de página
  ctx.strokeStyle = PALETTE.inkHair;
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, w - 80, h - 80);
  ctx.fillStyle = PALETTE.inkSoft;
  ctx.font = `500 16px ${FONT_MONO}`;
  ctx.textAlign = "left";
  letterSpaced(ctx, "GRADIENTE — " + title, 72, 86, 4);
  return { c, ctx, w, h };
}

export function pageLetterTexture(invite) {
  const { c, ctx, w } = pageBase("CARTA");

  ctx.fillStyle = PALETTE.ink;
  ctx.font = `500 52px ${FONT_SERIF}`;
  ctx.fillText(COPY.tagline, 72, 180);

  ctx.font = `400 25px ${FONT_GROTESK}`;
  ctx.fillStyle = "rgba(28,24,19,0.86)";
  COPY.welcome.forEach((line, i) => {
    ctx.fillText(line, 72, 244 + i * 38);
  });

  ctx.font = `italic 400 28px ${FONT_SERIF}`;
  ctx.fillStyle = PALETTE.inkSoft;
  ctx.fillText(COPY.signature, 72, 600);

  ctx.font = `500 17px ${FONT_MONO}`;
  ctx.textAlign = "right";
  ctx.fillStyle = PALETTE.inkSoft;
  letterSpaced(ctx, invite.issued, w - 72, 600, 3, "right");
  return toTexture(c);
}

export function pageFaderTexture() {
  const { c, ctx, w } = pageBase("CALIBRACIÓN");

  ctx.fillStyle = PALETTE.ink;
  ctx.font = `500 52px ${FONT_SERIF}`;
  ctx.fillText(COPY.genre, 72, 190);

  ctx.font = `400 24px ${FONT_GROTESK}`;
  ctx.fillStyle = "rgba(28,24,19,0.86)";
  ctx.fillText("Un solo eje de intensidad en lugar de silos", 72, 250);
  ctx.fillText("de género. Tu gusto subjetivo es lo que", 72, 288);
  ctx.fillText("tiene valor.", 72, 326);

  drawFader(ctx, 110, 440, w - 220, { knob: 0.72 });

  ctx.fillStyle = PALETTE.inkSoft;
  ctx.font = `500 17px ${FONT_MONO}`;
  ctx.textAlign = "center";
  letterSpaced(ctx, "TECNOLOGÍA ESCONDIDA · FORMATO ANÁLOGO", w / 2, 560, 4, "center");
  return toTexture(c);
}

export function pageRolesTexture() {
  const { c, ctx, w } = pageBase("ESTRUCTURA");

  ctx.fillStyle = PALETTE.ink;
  ctx.font = `500 48px ${FONT_SERIF}`;
  ctx.fillText("Guías que abren contexto.", 72, 180);

  COPY.roles.forEach((role, i) => {
    const y = 250 + i * 64;
    ctx.fillStyle = PALETTE.ink;
    ctx.font = `600 26px ${FONT_MONO}`;
    ctx.textAlign = "left";
    letterSpaced(ctx, role, 72, y, 5);
    // barra de "energía" creciente
    const g = ctx.createLinearGradient(330, 0, 330 + 540, 0);
    VIBE_STOPS.forEach(([col, off]) => g.addColorStop(off, col));
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = g;
    ctx.fillRect(330, y - 18, 540 * ((i + 1) / COPY.roles.length), 8);
    ctx.restore();
  });

  ctx.fillStyle = PALETTE.inkSoft;
  ctx.font = `italic 400 26px ${FONT_SERIF}`;
  ctx.fillText(COPY.gold, 72, 612);
  return toTexture(c);
}

// -------------------------------------------------------------------- tarjeta

// La tarjeta devuelve dos texturas por cara: el arte (map) y la máscara holo
// (qué zonas reciben el efecto iridiscente y con qué fuerza).
export function cardFrontTextures(invite, emblem) {
  const w = 1024, h = 640;
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");

  // base tinta profunda con leve degradado
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#1a1510");
  bg.addColorStop(1, "#0f0c08");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // emblema fantasma a la derecha (recortado en círculo para quitar el
  // texto de anillo que trae el arte original)
  if (emblem) {
    const ex = w - 235, ey = h / 2, er = 150;
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(emblem, ex - er * 1.85, ey - er * 1.85, er * 3.7, er * 3.7);
    ctx.restore();
  }

  // marco + esquinas
  ctx.strokeStyle = "rgba(232,166,35,0.85)";
  ctx.lineWidth = 3;
  roundedRect(ctx, 26, 26, w - 52, h - 52, 22);
  ctx.stroke();

  // cabecera
  ctx.fillStyle = PALETTE.plate;
  ctx.font = `700 52px ${FONT_DISPLAY}`;
  letterSpaced(ctx, "GRADIENTE", 64, 110, 14);
  ctx.fillStyle = PALETTE.paper;
  ctx.font = `500 20px ${FONT_MONO}`;
  ctx.textAlign = "right";
  letterSpaced(ctx, "BETA CERRADA · 150", w - 64, 104, 4, "right");
  ctx.textAlign = "left";

  // nombre — encogido si es largo, sin invadir el emblema ni el marco
  ctx.fillStyle = "rgba(251,247,238,0.55)";
  ctx.font = `500 18px ${FONT_MONO}`;
  letterSpaced(ctx, "INVITACIÓN PARA", 64, 232, 5);
  ctx.fillStyle = PALETTE.plate;
  const nameMax = (emblem ? w - 235 - 150 : w - 64) - 64 - 16;
  const { px: namePx, w: nameW } = fitText(ctx, invite.name, "500", FONT_SERIF, 60, nameMax);
  ctx.fillText(invite.name, 64, 304);

  // código de acceso — fósforo ámbar con glow
  ctx.fillStyle = "rgba(251,247,238,0.55)";
  ctx.font = `500 18px ${FONT_MONO}`;
  letterSpaced(ctx, "CÓDIGO DE ACCESO", 64, 392, 5);
  ctx.save();
  ctx.shadowColor = "rgba(255,140,0,0.9)";
  ctx.shadowBlur = 22;
  ctx.fillStyle = PALETTE.phosphor;
  const { px: codePx, w: codeW } = fitText(ctx, invite.code, "600", FONT_MONO, 47, w - 128, 2);
  letterSpaced(ctx, invite.code, 64, 452, 2);
  ctx.restore();

  // banda vibe + pie
  ctx.fillStyle = vibeGradient(ctx, 64, 0, w - 128);
  ctx.fillRect(64, 524, w - 128, 10);
  ctx.fillStyle = "rgba(251,247,238,0.7)";
  ctx.font = `500 18px ${FONT_MONO}`;
  letterSpaced(ctx, COPY.door, 64, 580, 5);
  ctx.textAlign = "right";
  letterSpaced(ctx, `FOLIO ${invite.folio} · ${invite.issued}`, w - 64, 580, 3, "right");
  ctx.textAlign = "left";

  // ----- máscara holográfica (blanco = más iridiscencia)
  const m = makeCanvas(w, h);
  const mc = m.getContext("2d");
  mc.fillStyle = "#2e2e2e"; // brillo base en toda la cara
  mc.fillRect(0, 0, w, h);
  mc.strokeStyle = "#ffffff";
  mc.lineWidth = 7;
  roundedRect(mc, 26, 26, w - 52, h - 52, 22);
  mc.stroke();
  if (emblem) {
    const ex = w - 235, ey = h / 2, er = 150;
    mc.save();
    mc.globalAlpha = 0.85;
    mc.beginPath();
    mc.arc(ex, ey, er, 0, Math.PI * 2);
    mc.clip();
    mc.drawImage(emblem, ex - er * 1.85, ey - er * 1.85, er * 3.7, er * 3.7);
    mc.restore();
  }
  mc.fillStyle = "#ffffff";
  mc.fillRect(64, 518, w - 128, 22); // banda vibe
  // zonas de nombre y código con borde difuminado, dimensionadas a la medida
  // real del texto (softZone evita ctx.filter, ignorado por Safari < 18)
  softZone(mc, 56, 304 - namePx, nameW + 24, namePx + 24, "#8d8d8d");
  softZone(mc, 56, 452 - codePx, codeW + 24, codePx + 16, "#a8a8a8");

  return { map: toTexture(c), holo: toTexture(m, { srgb: false }) };
}

export function cardBackTextures(invite) {
  const w = 1024, h = 640;
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");

  ctx.fillStyle = PALETTE.paper;
  ctx.fillRect(0, 0, w, h);
  paperGrain(ctx, w, h, { fibers: 320, rnd: makeRng(53) });

  ctx.strokeStyle = "rgba(28,24,19,0.6)";
  ctx.lineWidth = 3;
  roundedRect(ctx, 26, 26, w - 52, h - 52, 22);
  ctx.stroke();

  // instrucciones
  ctx.fillStyle = PALETTE.ink;
  ctx.font = `600 22px ${FONT_MONO}`;
  letterSpaced(ctx, COPY.needsTitle, 64, 112, 5);
  ctx.font = `400 25px ${FONT_GROTESK}`;
  ctx.fillStyle = "rgba(28,24,19,0.88)";
  COPY.needsItems.forEach((item, i) => ctx.fillText(item, 64, 168 + i * 42));

  // fader
  drawFader(ctx, 64, 300, 520, { knob: 0.72 });

  // "código de barras" derivado del código real
  const bx = 64, by = 420, bh = 110;
  let x = bx;
  ctx.fillStyle = PALETTE.ink;
  [...invite.code].slice(0, 24).forEach((ch) => {
    const v = ch.charCodeAt(0);
    const bw = 3 + (v % 5) * 2.6;
    if (ch !== "-") ctx.fillRect(x, by, bw, bh);
    x += bw + 5;
  });
  ctx.font = `500 19px ${FONT_MONO}`;
  letterSpaced(ctx, invite.code, bx, by + bh + 34, 4);

  // cita + URL
  ctx.font = `italic 400 27px ${FONT_SERIF}`;
  ctx.fillStyle = PALETTE.inkSoft;
  ctx.fillText(COPY.archive, 64, 600);
  ctx.font = `600 24px ${FONT_MONO}`;
  ctx.fillStyle = PALETTE.ink;
  ctx.textAlign = "right";
  letterSpaced(ctx, "GRADIENTE.ORG", w - 64, 116, 5, "right");
  ctx.textAlign = "left";

  // máscara holo de la cara trasera: fader + barras
  const m = makeCanvas(w, h);
  const mc = m.getContext("2d");
  mc.fillStyle = "#1c1c1c";
  mc.fillRect(0, 0, w, h);
  mc.fillStyle = "#ffffff";
  mc.fillRect(64, 286, 520, 30);
  mc.fillStyle = "#8d8d8d";
  mc.fillRect(bx, by, x - bx, bh);

  return { map: toTexture(c), holo: toTexture(m, { srgb: false }) };
}

// ------------------------------------------------------------- carga de assets

export function loadEmblem(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // sin emblema seguimos funcionando
    img.src = url;
  });
}

export async function waitForFonts(invite) {
  // un probe por cada cara (familia+peso+estilo) usada en los canvas; el
  // texto de muestra incluye los datos reales para forzar la descarga del
  // subset unicode correcto (nombres con glifos latin-ext, por ejemplo)
  const probes = [
    `500 21px ${FONT_MONO}`,
    `600 47px ${FONT_MONO}`,
    `700 26px ${FONT_MONO}`,
    `500 60px ${FONT_SERIF}`,
    `italic 400 27px ${FONT_SERIF}`,
    `400 25px ${FONT_GROTESK}`,
    `700 52px ${FONT_DISPLAY}`,
  ];
  const sample = "Gradiente0123ÁÉÍÑáéíóúñü" + (invite ? invite.name + invite.code : "");
  try {
    await Promise.all(probes.map((f) => document.fonts.load(f, sample)));
    await document.fonts.ready;
  } catch {
    /* si Font Loading API falla, seguimos con fallbacks */
  }
}
