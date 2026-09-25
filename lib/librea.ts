/**
 * LIBREA — the liveries. Every section and every format wears one, like a
 * Wipeout team: code, channel, a flat colour, a pattern, a pictogram.
 * Format colours descend from the real site's category colours, punched for
 * print. See docs/06-LIBREA.md.
 */

import type { ContentType, Role } from '@/lib/types'

export type Patron =
  | 'peligro' // hazard stripes
  | 'surcos' // record grooves
  | 'trama' // halftone
  | 'registro' // registration crosses
  | 'galones' // chevrons
  | 'renglones' // ruled lines
  | 'escala' // ranked bars
  | 'teletipo' // ticker dashes
  | 'dial' // frequency ticks
  | 'espectro' // the stepped energy ramp
  | 'muro' // poster grid
  | 'panal' // hexes
  | 'barras' // barcode
  | 'tapete' // cutting mat
  | 'rueda' // wheel rays

export type SeccionKey = 'campo' | 'agenda' | 'mixes' | 'lecturas' | 'foro' | 'mapa' | 'mercado' | 'taller' | 'central' | 'casa' | 'puerta' | 'credencial' | 'entidad' | 'franja'

export interface Librea {
  key: string
  /** Two-or-three-letter code, printed everywhere. */
  code: string
  /** Channel number, two digits. */
  canal: string
  /** Display name (uppercase in use). */
  nombre: string
  /** One true line about it — never slogan filler. */
  lema: string
  /** Flat livery colour. */
  color: string
  /** Text/ink colour that reads on it. */
  on: string
  /** A second colour for overprints and accents. */
  alt: string
  patron: Patron
  /** Anybody axes the name is set in. */
  wdth: number
  wght: number
}

const INK = '#111111'
const PAPER = '#edebe3'

export const LIBREA_FORMATO: Record<ContentType, Librea> = {
  evento: { key: 'evento', code: 'EV', canal: '01', nombre: 'Evento', lema: 'Una noche, un lugar, una hora.', color: '#e63329', on: PAPER, alt: INK, patron: 'peligro', wdth: 118, wght: 900 },
  mix: { key: 'mix', code: 'MX', canal: '02', nombre: 'Mix', lema: 'Una sesión grabada en la escena.', color: '#00b4d8', on: INK, alt: INK, patron: 'surcos', wdth: 150, wght: 800 },
  review: { key: 'review', code: 'RS', canal: '03', nombre: 'Reseña', lema: 'Una lectura crítica de una obra o una noche.', color: '#ffc400', on: INK, alt: INK, patron: 'trama', wdth: 96, wght: 900 },
  editorial: { key: 'editorial', code: 'ED', canal: '04', nombre: 'Editorial', lema: 'La voz de la casa.', color: '#7dc21e', on: INK, alt: INK, patron: 'registro', wdth: 130, wght: 880 },
  opinion: { key: 'opinion', code: 'OP', canal: '05', nombre: 'Opinión', lema: 'Una postura, firmada.', color: '#8b5cf6', on: PAPER, alt: INK, patron: 'galones', wdth: 84, wght: 900 },
  articulo: { key: 'articulo', code: 'AR', canal: '06', nombre: 'Artículo', lema: 'Largo aliento, con notas.', color: '#2f5bff', on: PAPER, alt: INK, patron: 'renglones', wdth: 140, wght: 760 },
  listicle: { key: 'listicle', code: 'LS', canal: '07', nombre: 'Lista', lema: 'Un orden que se puede discutir.', color: '#ec4899', on: PAPER, alt: INK, patron: 'escala', wdth: 70, wght: 900 },
  noticia: { key: 'noticia', code: 'NT', canal: '08', nombre: 'Noticia', lema: 'Lo que pasó, dicho corto.', color: INK, on: PAPER, alt: '#e63329', patron: 'teletipo', wdth: 110, wght: 860 },
  franja: { key: 'franja', code: 'FR', canal: '09', nombre: 'Franja', lema: 'Una estación en el dial.', color: '#9ca3af', on: INK, alt: INK, patron: 'dial', wdth: 122, wght: 820 },
}

/**
 * The credencial's stock by role: each role is printed on the colour of a
 * format in the feed — the hue family its old role colour belonged to
 * (lector gold → reseña yellow, curador violet → opinión, guía green →
 * editorial, insider cyan → mix, admin orange → evento red). Matte card,
 * ink in the livery's `on` colour.
 */
export const LIBREA_ROL: Record<Role, ContentType> = {
  user: 'review',
  curator: 'opinion',
  guide: 'editorial',
  insider: 'mix',
  admin: 'evento',
}

export function libreaDeRol(role: Role): Librea {
  return LIBREA_FORMATO[LIBREA_ROL[role]]
}

export const LIBREA_SECCION: Record<SeccionKey, Librea> = {
  campo: { key: 'campo', code: 'CMP', canal: '00', nombre: 'Campo', lema: 'Todo lo que vive, por energía.', color: INK, on: PAPER, alt: '#feb225', patron: 'espectro', wdth: 150, wght: 900 },
  agenda: { ...LIBREA_FORMATO.evento, key: 'agenda', code: 'AGD', canal: '01', nombre: 'Agenda', lema: 'Las noches de la escena, una por una.' },
  mixes: { ...LIBREA_FORMATO.mix, key: 'mixes', code: 'MXS', canal: '02', nombre: 'Mixes', lema: 'Sets, sesiones y radio grabados en la escena.' },
  lecturas: { ...LIBREA_FORMATO.articulo, key: 'lecturas', code: 'LCT', canal: '03', nombre: 'Lecturas', lema: 'Lo que la escena escribe sobre sí misma.' },
  foro: { key: 'foro', code: 'FRO', canal: '04', nombre: 'Foro', lema: 'Un muro de treinta hilos; el nuevo empuja al último.', color: '#8b5cf6', on: PAPER, alt: INK, patron: 'muro', wdth: 96, wght: 900 },
  mapa: { key: 'mapa', code: 'MPA', canal: '05', nombre: 'Mapa', lema: 'El territorio por afinidad.', color: '#00a36c', on: INK, alt: INK, patron: 'panal', wdth: 134, wght: 860 },
  mercado: { key: 'mercado', code: 'MRC', canal: '06', nombre: 'Mercado', lema: 'Lo que las franjas venden directo.', color: '#9ca3af', on: INK, alt: INK, patron: 'barras', wdth: 112, wght: 900 },
  taller: { key: 'taller', code: 'TLL', canal: '07', nombre: 'Taller', lema: 'Tu mesa de trabajo.', color: '#d8ff00', on: INK, alt: INK, patron: 'tapete', wdth: 104, wght: 900 },
  central: { key: 'central', code: 'CTR', canal: '08', nombre: 'Central', lema: 'El instrumento de administración.', color: INK, on: PAPER, alt: '#e63329', patron: 'peligro', wdth: 90, wght: 900 },
  casa: { key: 'casa', code: 'CAS', canal: '09', nombre: 'Casa', lema: 'Qué es esto y quiénes lo cuidan.', color: INK, on: PAPER, alt: '#e63329', patron: 'registro', wdth: 128, wght: 860 },
  puerta: { key: 'puerta', code: 'PTA', canal: '10', nombre: 'La Puerta', lema: 'Se entra por invitación.', color: '#e8a623', on: INK, alt: INK, patron: 'rueda', wdth: 120, wght: 900 },
  credencial: { key: 'credencial', code: 'CRD', canal: '11', nombre: 'Credencial', lema: 'Quién eres aquí.', color: INK, on: PAPER, alt: '#d2a24f', patron: 'registro', wdth: 116, wght: 900 },
  entidad: { key: 'entidad', code: 'ENT', canal: '12', nombre: 'Entidad', lema: 'Una persona, un lugar, un nombre en los carteles.', color: PAPER, on: INK, alt: INK, patron: 'espectro', wdth: 124, wght: 880 },
  franja: { ...LIBREA_FORMATO.franja, key: 'franja-pagina', code: 'FRJ', canal: '09', nombre: 'Franja' },
}

/** The section a pathname belongs to. */
export function seccionDe(pathname: string): SeccionKey {
  const p = pathname || '/'
  if (p === '/') return 'campo'
  if (p.startsWith('/agenda')) return 'agenda'
  if (p.startsWith('/mixes')) return 'mixes'
  if (['/lecturas', '/editorial', '/reviews', '/opinion', '/articulos', '/noticias', '/listas'].some((r) => p.startsWith(r))) return 'lecturas'
  if (p.startsWith('/foro')) return 'foro'
  if (p.startsWith('/mapa')) return 'mapa'
  if (p.startsWith('/mercado') || p.startsWith('/marketplace')) return 'mercado'
  if (p.startsWith('/taller')) return 'taller'
  if (p.startsWith('/central') || p.startsWith('/admin')) return 'central'
  if (p.startsWith('/about') || p.startsWith('/manifesto') || p.startsWith('/equipo')) return 'casa'
  if (p.startsWith('/welcome') || p.startsWith('/espera')) return 'puerta'
  if (p.startsWith('/u/')) return 'credencial'
  if (p.startsWith('/e/')) return 'entidad'
  if (p.startsWith('/f/')) return 'franja'
  return 'casa'
}

export function libreaDe(pathname: string): Librea {
  return LIBREA_SECCION[seccionDe(pathname)]
}
