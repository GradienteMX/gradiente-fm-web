/**
 * CALCOS — the words stickers are spoken in. Spanish, short, true: what the
 * object is, what it's made of, how it got to you, how long it's been on.
 */

import type { HoloKind, Metal, Relieve, StickerDef, StickerForm, StickerMaterial, StickerSource, StickerVia } from '@/lib/stickers/types'
import { finishLabel, finishOf, HOLO_NOMBRE, isOneOfAKind, MATERIAL_NOMBRE, METAL_NOMBRE, RELIEVE_NOMBRE } from '@/lib/stickers/finish'

export const MATERIAL_LABEL: Record<StickerMaterial, string> = {
  papel: 'Papel',
  vinil: 'Vinil',
  holo: 'Holográfico',
  brillo: 'Brillo',
  transparente: 'Transparente',
  metal: 'Foil metálico',
  lenticular: 'Lenticular',
}

/** What the material does, in a few words. */
export const MATERIAL_NOTE: Record<StickerMaterial, string> = {
  papel: 'mate, con fibra',
  vinil: 'brillante, aguanta',
  holo: 'difracta la luz',
  brillo: 'diamantina que parpadea escama por escama',
  transparente: 'deja ver el estuche',
  metal: 'metal espejo donde no hay tinta',
  lenticular: 'dos imágenes: cambia al inclinarlo',
}

/** What each holo family does under the light. */
export const HOLO_NOTE: Record<HoloKind, string> = {
  prisma: 'el arcoíris barre sus líneas',
  galaxia: 'estrellas que destellan una a una',
  hielo: 'esquirlas, cada una con su color',
  diamante: 'facetas que destellan por cara',
  laser: 'arcos que giran como un CD',
  aceite: 'remolinos de aceite que cambian',
  escamas: 'lentejuelas que destellan en filas',
  motivo: 'un motivo grabado en el foil',
}

export const METAL_NOTE: Record<Metal, string> = {
  oro: 'espejo cálido donde no hay tinta',
  plata: 'espejo frío donde no hay tinta',
  cobre: 'espejo rosado donde no hay tinta',
  grafito: 'metal oscuro, cepillado en hilos',
}

export const RELIEVE_NOTE: Record<Relieve, string> = {
  liso: '',
  tinta: 'la tinta sobresale',
  gofrado: 'el diseño alzado desde atrás',
  hundido: 'el diseño prensado en el papel',
  barniz: 'brillo solo sobre la tinta',
  domo: 'bajo un domo de resina',
}

/** One short true line: each copy of a foil is its own. */
export const COPIA_UNICA = 'Su foil es solo suyo: ninguna otra copia refleja igual.'

export const FORM_LABEL: Record<StickerForm, string> = {
  logo: 'Troquelado',
  tipo: 'Tipográfico',
  cinta: 'Cinta',
  boleto: 'Talón',
  circulo: 'Círculo',
  sello: 'Sello',
}

export const SOURCE_LABEL: Record<StickerSource, string> = {
  franja: 'Franjas',
  evento: 'Noches',
  casa: 'De la casa',
}

/** How a copy got to you. */
export const VIA_LABEL: Record<StickerVia, string> = {
  compra: 'Obtenido en su tienda',
  boleto: 'Reclamado con boleto',
  regalo: 'Regalo de la casa',
  franja: 'Por ser parte de la franja',
  trofeo: 'Por un trofeo',
  participacion: 'Por participar',
  beta: 'Kit de la beta — se borra al lanzar',
  prueba: 'Hoja de prueba — se borra al lanzar',
}

const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']

/** «12 JUL 2026» */
export function fechaCorta(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** «hace 3 días», «hace 11 meses», «hace 1 año y 2 meses» — how long it has been on. */
export function edad(iso: string, now: Date): string {
  const s = Math.max(0, (now.getTime() - Date.parse(iso)) / 1000)
  if (s < 60) return 'hace un momento'
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`
  const d = Math.floor(s / 86400)
  if (d < 30) return `hace ${d} ${d === 1 ? 'día' : 'días'}`
  const months = Math.floor(d / 30.44)
  if (months < 12) return `hace ${months} ${months === 1 ? 'mes' : 'meses'}`
  const y = Math.floor(months / 12)
  const m = months % 12
  const years = `${y} ${y === 1 ? 'año' : 'años'}`
  return m ? `hace ${years} y ${m} ${m === 1 ? 'mes' : 'meses'}` : `hace ${years}`
}

/** «007/150» */
export function serialLabel(serial: number, edition: number): string {
  return `${String(serial).padStart(String(edition).length, '0')}/${edition}`
}

/** «$35 MXN» — what it will cost when payments exist. */
export function precio(def: StickerDef): string | null {
  if (def.price === undefined) return null
  try {
    return `${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0 }).format(def.price)} MXN`
  } catch {
    return `$${def.price} MXN`
  }
}

/** The name without the franja/night it belongs to (the context already says it). */
export function nombreCorto(def: StickerDef): string {
  const i = def.name.lastIndexOf(' — ')
  const s = i > 0 ? def.name.slice(i + 3) : def.name
  return s.charAt(0).toLocaleUpperCase('es-MX') + s.slice(1)
}

/** «Holo · Galaxia · Domo de resina» — the finish alone. */
export function acabado(def: StickerDef): string {
  return finishLabel(finishOf(def))
}

/** «Troquelado · Holo · Galaxia» — the form and the finish. */
export function formaMaterial(def: StickerDef): string {
  return `${FORM_LABEL[def.form]} · ${acabado(def)}`
}

/** «Holo · Galaxia · 007/150 · Domo de resina» — one copy: its finish and its number. */
export function lineaCopia(def: StickerDef, serial?: number): string {
  const f = finishOf(def)
  const parts: string[] = [MATERIAL_NOMBRE[f.material]]
  if (f.holo && f.material === 'holo') parts.push(HOLO_NOMBRE[f.holo])
  if (f.metal) parts.push(METAL_NOMBRE[f.metal])
  if (serial && def.edition) parts.push(serialLabel(serial, def.edition))
  if (f.relieve !== 'liso') parts.push(RELIEVE_NOMBRE[f.relieve])
  return parts.join(' · ')
}

/** What the finish does, in a few words: the stock (or its foil family / metal), then the relief. */
export function notaAcabado(def: StickerDef): string {
  const f = finishOf(def)
  const stock = f.holo && f.material === 'holo' ? HOLO_NOTE[f.holo] : f.metal ? METAL_NOTE[f.metal] : MATERIAL_NOTE[f.material]
  return f.relieve !== 'liso' ? `${stock} · ${RELIEVE_NOTE[f.relieve]}` : stock
}

/** Whether each copy of this sticker carries a foil laid out only for it. */
export function esUnica(def: StickerDef): boolean {
  return isOneOfAKind(finishOf(def))
}
