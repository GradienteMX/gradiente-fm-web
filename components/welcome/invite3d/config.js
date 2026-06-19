// Datos del invitado. En producción la app inyecta GRADIENTE_INVITE en el
// global (ver index.html) con los datos reales del registro; esto es el
// fallback demo. Se lee vía globalThis para que el módulo sea seguro de
// importar en SSR, y el merge solo acepta strings no vacíos para que datos
// parciales (p. ej. code: undefined) no rompan la experiencia.
const DEFAULTS = {
  name: "Invitada Cero",
  code: "GRDNT-2026-VLCN-0001", // código de acceso · 20 caracteres
  folio: "001/150",
  issued: "JUN 2026",
  role: "insider", // clave de rol (ver ROLES); la app real inyecta el del registro
};

const RAW =
  globalThis.GRADIENTE_INVITE && typeof globalThis.GRADIENTE_INVITE === "object"
    ? globalThis.GRADIENTE_INVITE
    : {};

export const INVITE = { ...DEFAULTS };
for (const k of Object.keys(DEFAULTS)) {
  if (typeof RAW[k] === "string" && RAW[k].trim()) INVITE[k] = RAW[k].trim();
}

// Roles de Gradiente: etiqueta del chip + color del rol. La iridiscencia no se
// pinta plana del color: su ARCOÍRIS se COMPRIME a una banda de tonos alrededor
// del tono del rol (`spread`: 1 = arcoíris completo, ~0.25 = familia del rol),
// así sigue tornasolando pero dentro de la familia del color (p.ej. violeta ↔
// magenta ↔ azul). USUARIO no comprime (arcoíris completo).
export const ROLES = {
  user:    { label: "USUARIO", color: "#d2a24f", spread: 1.0,  level: "00" },
  curator: { label: "CURADOR", color: "#c084fc", spread: 0.24, level: "01" }, // violeta
  guide:   { label: "GUÍA",    color: "#4ade80", spread: 0.24, level: "02" }, // verde
  insider: { label: "INSIDER", color: "#22d3ee", spread: 0.24, level: "03" }, // cian
  admin:   { label: "ADMIN",   color: "#f97316", spread: 0.24, level: "04" }, // naranja
};

export function inviteRole(invite = INVITE) {
  return ROLES[(invite.role || "user").toLowerCase()] || ROLES.user;
}

// Paleta Gradiente (de INVITACION_amarilla_v1 + variante oscura)
export const PALETTE = {
  paper: "#e8a623", // manila / mostaza — color firma
  paperDeep: "#c98c15",
  plate: "#fbf7ee", // crema
  ink: "#1c1813", // tinta café-negra
  inkSoft: "rgba(28,24,19,0.62)",
  inkHair: "rgba(28,24,19,0.30)",
  phosphor: "#ffb000", // fósforo ámbar (CRT)
  phosphorSoft: "#ffcf6a",
};

// Vibe Fader: gradiente canónico de 8 paradas con offsets no uniformes
// (cian → rojo, 0 Glacial → 10 Volcán), como en INVITACION_v2/v3/v4.
export const VIBE_STOPS = [
  ["#00ffff", 0],
  ["#0066ff", 0.18],
  ["#6600ff", 0.34],
  ["#ff00ff", 0.5],
  ["#ff0066", 0.62],
  ["#ff5500", 0.76],
  ["#ff2200", 0.9],
  ["#ff0000", 1],
];

export const COPY = {
  tagline: "Personas, no plataformas.",
  archive: "El archivo no tiene dueños. Solo custodios temporales.",
  door: "LA PUERTA ESTÁ ABIERTA",
  genre: "El género es una mentira.",
  gold: "Tu gusto vale oro.",
  needsTitle: "NECESITAS DOS COSAS",
  needsItems: ["1 — Tu código de acceso", "2 — Una primera publicación"],
  welcome: [
    "Si esto llegó a tus manos es porque confiamos",
    "en lo que piensas, lo que haces y lo que",
    "puedes aportar.",
    "",
    "Infraestructura y memoria para la escena",
    "underground de música y arte sonoro en México.",
    "",
    "Tecnología avanzada por dentro.",
    "Formato familiar y análogo por fuera.",
  ],
  roles: ["USER", "CURATOR", "GUIDE", "INSIDER", "ADMIN"],
  signature: "— Los custodios",
};
