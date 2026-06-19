import * as THREE from 'three';
import { ROLES } from '../config.js';

const W = 2048, H = 1244;
const MONO = '"IBM Plex Mono", monospace';
const DISP = '"Rajdhani", sans-serif';
const SERIF = '"Fraunces", serif';
const INVITE = { name: 'Invitada Cero', code: 'GRDNT-2026-VLCN-0001', role: 'curator' };

// medallón (geometría real): zona a dejar libre en el print
const MED = { x: 1636, y: 638, r: 268 };

function spaced(ctx, text, x, y, ls, align = 'left') {
  const ws = [...text].map((c) => ctx.measureText(c).width + ls);
  const total = ws.reduce((a, b) => a + b, -ls);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  for (let i = 0; i < text.length; i++) { ctx.fillText(text[i], cx, y); cx += ws[i]; }
}
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function star4(ctx, cx, cy, R, r) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i - Math.PI / 2, rad = i % 2 ? r : R;
    const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath(); ctx.fill();
}

function draw(ctx, mode) {
  const foil = mode === 'foil';
  if (foil) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  else {
    // sustrato oscuro cálido con leve degradado (la CardInterior es la tarjeta)
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#160d07'); bg.addColorStop(0.5, '#0f0805'); bg.addColorStop(1, '#0a0503');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  }

  const PEARL = '#e8eef3', AMBER = '#d2a24f', DIM = '#b59a72', DIMR = 'rgba(190,165,120,0.5)';
  ctx.textBaseline = 'alphabetic';

  // --- dot fields (esquinas) ---
  if (!foil) {
    ctx.fillStyle = 'rgba(214,178,120,0.42)';
    const dot = (x0, y0, cols, rows) => {
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        ctx.beginPath(); ctx.arc(x0 + i * 26, y0 + j * 26, 2.4, 0, 7); ctx.fill();
      }
    };
    dot(150, 90, 22, 5); dot(150, 980, 30, 6);
  }

  // --- circuit lines (sutiles, zona superior derecha) ---
  ctx.strokeStyle = foil ? 'rgba(255,255,255,0.5)' : 'rgba(214,176,112,0.5)';
  ctx.lineWidth = foil ? 3 : 2.6;
  const seg = [[1180,150,1320,150],[1320,150,1320,260],[1320,260,1500,260],
               [1180,360,1260,360],[1260,360,1260,470]];
  ctx.beginPath();
  for (const [a,b,c,d] of seg) { ctx.moveTo(a,b); ctx.lineTo(c,d); }
  ctx.stroke();

  // --- compass star + GRADIENTE ---
  if (foil) ctx.fillStyle = '#fff';
  else { ctx.fillStyle = PEARL; }
  star4(ctx, 130, 232, 40, 13);

  ctx.font = `700 128px ${DISP}`;
  if (foil) ctx.fillStyle = '#fff';
  else {
    // base gunmetal oscura: deja que el color holográfico (capa foil) resalte
    const g = ctx.createLinearGradient(210, 175, 210, 285);
    g.addColorStop(0, '#5a626c'); g.addColorStop(0.5, '#333941'); g.addColorStop(1, '#4c545e');
    ctx.fillStyle = g;
  }
  spaced(ctx, 'GRADIENTE', 210, 276, 12);

  // --- BETA CERRADA | 001/150 (ámbar, no holo) ---
  if (!foil) {
    ctx.fillStyle = AMBER; ctx.font = `500 40px ${MONO}`;
    spaced(ctx, 'BETA CERRADA  |  001/150', 1760, 210, 4, 'right');
  }

  // --- sello G (holo) ---
  ctx.lineWidth = foil ? 9 : 5;
  ctx.strokeStyle = foil ? '#fff' : AMBER;
  ctx.beginPath(); ctx.arc(1900, 196, 46, 0, 7); ctx.stroke();
  if (foil) ctx.fillStyle = '#fff'; else ctx.fillStyle = AMBER;
  ctx.font = `700 56px ${DISP}`; ctx.textAlign = 'center';
  ctx.fillText('G', 1900, 216); ctx.textAlign = 'left';

  // --- INVITACIÓN PARA (label tenue) + NOMBRE (perlado, holo suave) ---
  if (!foil) {
    ctx.fillStyle = DIM; ctx.font = `500 34px ${MONO}`;
    spaced(ctx, 'INVITACIÓN PARA', 215, 525, 7);
  }
  ctx.font = `500 116px ${SERIF}`; ctx.textAlign = 'left';
  if (foil) ctx.fillStyle = '#8a8a8a';            // máscara: shimmer parcial
  else {
    const g = ctx.createLinearGradient(210, 0, 980, 0);
    g.addColorStop(0, '#f2e9ff'); g.addColorStop(0.5, '#eaf2ff'); g.addColorStop(1, '#fff1e0');
    ctx.fillStyle = g;
  }
  ctx.fillText(INVITE.name, 212, 678);

  // --- DESIGNACIÓN DE ACCESO (rol) — en el lenguaje de la tarjeta: etiqueta
  // grabada + nivel, y el nombre del rol como FOIL (iridiscente, recibe el matiz
  // del rol) enmarcado por marcas de registro en las esquinas. El color del rol
  // lo lleva el matiz del holograma, no un relleno plano de "chip web". ---
  const role = ROLES[INVITE.role] || ROLES.user;
  if (!foil) {
    ctx.fillStyle = DIM; ctx.font = `500 30px ${MONO}`;
    spaced(ctx, 'DESIGNACIÓN DE ACCESO', 215, 748, 7);
    const lw = [...'DESIGNACIÓN DE ACCESO'].reduce((a, c) => a + ctx.measureText(c).width + 7, -7);
    ctx.fillStyle = AMBER;
    spaced(ctx, '/ ' + role.level, 215 + lw + 30, 748, 7);
  }
  // nombre del rol como foil (holo): base gunmetal + capa iridiscente encima
  ctx.font = `600 60px ${MONO}`;
  if (foil) ctx.fillStyle = '#fff';
  else {
    const g = ctx.createLinearGradient(240, 780, 240, 836);
    g.addColorStop(0, '#5c646e'); g.addColorStop(0.5, '#343a42'); g.addColorStop(1, '#4e565f');
    ctx.fillStyle = g;
  }
  spaced(ctx, role.label, 240, 822, 6);
  // marco de esquinas (registro ámbar, sólo interior), ajustado al nombre
  if (!foil) {
    ctx.font = `600 60px ${MONO}`;
    const rw = [...role.label].reduce((a, c) => a + ctx.measureText(c).width + 6, -6);
    const bx = 200, by = 766, bw = rw + 80, bh = 78, L = 28;
    ctx.strokeStyle = AMBER; ctx.lineWidth = 3;
    const corner = (cx, cy, sx, sy) => {
      ctx.beginPath();
      ctx.moveTo(cx + sx * L, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * L);
      ctx.stroke();
    };
    corner(bx, by, 1, 1); corner(bx + bw, by, -1, 1);
    corner(bx, by + bh, 1, -1); corner(bx + bw, by + bh, -1, -1);
  }

  // --- CÓDIGO DE ACCESO + caja + CÓDIGO (holo) ---
  if (!foil) {
    ctx.fillStyle = DIM; ctx.font = `500 30px ${MONO}`;
    spaced(ctx, 'CÓDIGO DE ACCESO', 215, 905, 7);
  }
  ctx.lineWidth = foil ? 8 : 4;
  ctx.strokeStyle = foil ? '#fff' : AMBER;
  rrect(ctx, 200, 938, 1010, 130, 22); ctx.stroke();
  ctx.font = `600 76px ${MONO}`;
  if (foil) ctx.fillStyle = '#fff';
  else {
    const g = ctx.createLinearGradient(240, 984, 240, 1046);
    g.addColorStop(0, '#5c646e'); g.addColorStop(0.5, '#343a42'); g.addColorStop(1, '#4e565f');
    ctx.fillStyle = g;
  }
  spaced(ctx, INVITE.code, 248, 1030, 3);

  // --- LA PUERTA ESTÁ ABIERTA + globo ---
  if (!foil) {
    ctx.strokeStyle = DIM; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(185, 1118, 22, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(163,1118); ctx.lineTo(207,1118);
    ctx.moveTo(185,1096); ctx.lineTo(185,1140); ctx.stroke();
    ctx.fillStyle = DIM; ctx.font = `500 32px ${MONO}`;
    spaced(ctx, 'LA PUERTA ESTÁ ABIERTA', 245, 1130, 5);
    // FOLIO
    ctx.fillStyle = DIM;
    spaced(ctx, 'FOLIO 001/150  ·  JUN 2026', 1850, 1130, 3, 'right');
    // footer microtext
    ctx.fillStyle = DIMR; ctx.font = `500 19px ${MONO}`;
    const f = 'GRADIENTE · CULTURA · TECNOLOGÍA · MEMORIA · COMUNIDAD · ';
    spaced(ctx, (f + f).slice(0, 110), W / 2, 1210, 2, 'center');
  }

  // el medallón es geometría real al frente: no se dibuja aquí
}

function canvasTex(mode, srgb) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  draw(c.getContext('2d'), mode);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.flipY = false; t.anisotropy = 8; t.needsUpdate = true;
  return t;
}

export function makeInteriorTexture() { return canvasTex('interior', true); }
export function makeFoilTexture() { return canvasTex('foil', false); }

// rugosidad procedural sutil para la carcasa (smudges/microrrayas) — placeholder
// hasta tener los mapas reales; hace que la superficie de vidrio "exista".
export function makeGlassRoughness() {
  const s = 1024, c = document.createElement('canvas'); c.width = c.height = s;
  const x = c.getContext('2d');
  x.fillStyle = '#3a3a3a'; x.fillRect(0, 0, s, s);        // base bastante liso
  for (let i = 0; i < 46; i++) {                            // smudges suaves
    const cx = Math.random() * s, cy = Math.random() * s, r = 50 + Math.random() * 230;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    const up = Math.random() > 0.45;
    g.addColorStop(0, up ? 'rgba(200,200,200,0.10)' : 'rgba(12,12,12,0.12)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, s, s);
  }
  for (let i = 0; i < 26; i++) {                            // microrrayas finas
    x.strokeStyle = `rgba(210,210,210,${0.04 + Math.random() * 0.05})`;
    x.lineWidth = 0.8;
    const y = Math.random() * s, len = 80 + Math.random() * 360, a = (Math.random() - 0.5) * 0.5;
    x.save(); x.translate(Math.random() * s, y); x.rotate(a);
    x.beginPath(); x.moveTo(-len / 2, 0); x.lineTo(len / 2, 0); x.stroke(); x.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2.2, 1.5); t.anisotropy = 8;
  return t;
}
export function setInvite(data) {
  if (data?.name) INVITE.name = data.name;
  if (data?.code) INVITE.code = data.code;
  if (data?.role) INVITE.role = data.role;
}

export async function loadFonts() {
  const probes = ['700 128px "Rajdhani"', '600 56px "Rajdhani"',
    '500 40px "IBM Plex Mono"', '600 76px "IBM Plex Mono"', '500 116px "Fraunces"'];
  try { await Promise.all(probes.map((f) => document.fonts.load(f, 'GRADIENTE Invitada0123ÁÉ'))); await document.fonts.ready; }
  catch { /* fallback */ }
}
