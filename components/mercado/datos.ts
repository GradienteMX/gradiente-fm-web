/**
 * MERCADO — franja-only commerce, as data.
 *
 * Listings live on their franja. Gradiente never processes a payment: every
 * route out of a listing (sale link, WhatsApp, mail) goes straight to the
 * seller. Order is recency, nothing else — listing `views` exist in the model
 * and are never read here, and nothing in the market touches HL.
 */

import type {
  ContentItem,
  MarketplaceListing,
  MarketplaceListingCategory,
  MarketplaceListingCondition,
  MarketplaceListingStatus,
  MarketplaceShippingMode,
} from '@/lib/types'

export const CATEGORY_ORDER: MarketplaceListingCategory[] = ['vinyl', 'cassette', 'cd', 'synth', 'drum-machine', 'turntable', 'mixer', 'outboard', 'merch', 'other']

export const CATEGORY_LABEL: Record<MarketplaceListingCategory, string> = {
  vinyl: 'Vinilo',
  cassette: 'Cassette',
  cd: 'CD',
  synth: 'Sintetizador',
  'drum-machine': 'Caja de ritmos',
  turntable: 'Tornamesa',
  mixer: 'Mezcladora',
  outboard: 'Outboard',
  merch: 'Merch',
  other: 'Otro',
}

export const CATEGORY_PLURAL: Record<MarketplaceListingCategory, string> = {
  vinyl: 'Vinilos',
  cassette: 'Cassettes',
  cd: 'CDs',
  synth: 'Sintes',
  'drum-machine': 'Cajas de ritmos',
  turntable: 'Tornamesas',
  mixer: 'Mezcladoras',
  outboard: 'Outboard',
  merch: 'Merch',
  other: 'Otros',
}

/** The catalog's subcategories are stored as-is; these read them in Spanish. */
const SUB_ES: Record<string, string> = {
  Album: 'Álbum',
  Compilation: 'Compilado',
  'Box Set': 'Caja',
  'Picture Disc': 'Picture disc',
  Coloured: 'De color',
  Analog: 'Análogo',
  Module: 'Módulo',
  Hybrid: 'Híbrido',
  'Direct Drive': 'Tracción directa',
  'Belt Drive': 'Tracción por banda',
  Cartridge: 'Cápsula / aguja',
  '2-channel': '2 canales',
  '4-channel': '4 canales',
  Rotary: 'Rotativa',
  Battle: 'Batalla',
  Effects: 'Efectos',
  Compressor: 'Compresor',
  Preamp: 'Preamplificador',
  Other: 'Otro',
}

export function subLabel(sub: string | undefined): string | null {
  if (!sub) return null
  return SUB_ES[sub] ?? sub
}

export const CONDITION: Record<MarketplaceListingCondition, { label: string; meaning: string }> = {
  NEW: { label: 'Nuevo', meaning: 'Sellado o sin abrir. Nunca se ha usado.' },
  NM: { label: 'Casi nuevo', meaning: 'Near Mint: sin marcas a la vista; suena y funciona como recién salido.' },
  'VG+': { label: 'Muy bueno +', meaning: 'Very Good Plus: marcas leves de uso que no afectan el sonido ni el funcionamiento.' },
  VG: { label: 'Muy bueno', meaning: 'Very Good: uso visible; algo de ruido de superficie en pasajes suaves.' },
  'G+': { label: 'Bueno +', meaning: 'Good Plus: desgaste evidente y ruido constante, pero se escucha completo, sin saltos.' },
  G: { label: 'Bueno', meaning: 'Good: mucho desgaste; ruido y clics. Para completar colección.' },
  F: { label: 'Regular', meaning: 'Fair: daño serio; puede saltar o fallar. Vale por su rareza.' },
}

export const STATUS_LABEL: Record<MarketplaceListingStatus, string> = {
  available: 'Disponible',
  reserved: 'Reservado',
  sold: 'Vendido',
}

export const STATUS_MEANING: Record<MarketplaceListingStatus, string> = {
  available: 'Se puede apartar o comprar ahora.',
  reserved: 'Alguien ya lo apartó; si el trato se cae, vuelve a estar disponible.',
  sold: 'Ya se fue. Queda en la tienda como registro.',
}

export const SHIPPING_LABEL: Record<MarketplaceShippingMode, string> = {
  shipping: 'Envío directo',
  local: 'Recogida local',
  both: 'Envío o recogida',
}

export const SHIPPING_MEANING: Record<MarketplaceShippingMode, string> = {
  shipping: 'Te lo mandan. Paquetería y costo se acuerdan con quien vende.',
  local: 'Se entrega en mano. Lugar y hora se acuerdan con quien vende.',
  both: 'Envío o entrega en mano, como acuerden.',
}

export interface MarketEntry {
  listing: MarketplaceListing
  franja: ContentItem
}

const ts = (iso: string) => {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}

/** A store's listings, newest first. Empty unless the market is enabled. */
export function listingsOf(franja: ContentItem): MarketplaceListing[] {
  if (!franja.marketplaceEnabled) return []
  return [...(franja.marketplaceListings ?? [])].sort((a, b) => ts(b.publishedAt) - ts(a.publishedAt))
}

/** Every listing across every open store, newest first. */
export function marketFeed(stores: ContentItem[]): MarketEntry[] {
  const out: MarketEntry[] = []
  for (const franja of stores) for (const listing of listingsOf(franja)) out.push({ listing, franja })
  return out.sort((a, b) => ts(b.listing.publishedAt) - ts(a.listing.publishedAt))
}

export function storeStats(listings: MarketplaceListing[]) {
  let available = 0
  let reserved = 0
  let sold = 0
  for (const l of listings) {
    if (l.status === 'available') available++
    else if (l.status === 'reserved') reserved++
    else sold++
  }
  return { total: listings.length, available, reserved, sold }
}

/** "$12,000" + "MXN", in the store's currency (es-MX grouping). */
export function formatPrice(price: number, currency = 'MXN'): { amount: string; code: string } {
  const code = (currency || 'MXN').toUpperCase()
  const digits = Number.isInteger(price) ? 0 : 2
  try {
    const amount = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(price)
    return { amount, code }
  } catch {
    return { amount: `$${price.toLocaleString('es-MX', { maximumFractionDigits: 2 })}`, code }
  }
}

/** An 11-character YouTube id from the usual URL shapes — or nothing. */
export function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})(?=$|[?&#/])/)
  return m ? m[1] : null
}

/** WhatsApp deep link with a prefilled first line. Accepts a number or a wa.me link. */
export function waHref(raw: string, text: string): string {
  const t = encodeURIComponent(text)
  if (/^https?:\/\//i.test(raw)) return raw.includes('text=') ? raw : `${raw}${raw.includes('?') ? '&' : '?'}text=${t}`
  const digits = raw.replace(/\D/g, '')
  return `https://wa.me/${digits}?text=${t}`
}

export function contactLine(title: string): string {
  return `Hola, vi «${title}» en Gradiente. ¿Sigue disponible?`
}

export function mercadoHref(franjaSlug: string, piezaId?: string): string {
  const q = new URLSearchParams({ franja: franjaSlug })
  if (piezaId) q.set('pieza', piezaId)
  return `/mercado?${q.toString()}`
}
