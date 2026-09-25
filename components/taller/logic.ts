'use client'

/**
 * TALLER — derived state for the creator's desk.
 *
 * Everything here is a *read* of the world (the server snapshot + this
 * person's own rows, with what they just did applied on top). The
 * desk never invents a number: counts are rows, shares are proportions of
 * rows, HL is `currentHp` spoken as words, presence is the private scalar the
 * owner — and only the owner — may see.
 */

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { create } from 'zustand'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { ContentItem, ContentType, Draft, User } from '@/lib/types'
import { useItems, useWorld } from '@/lib/store/world'
import { perm, useSessionReady } from '@/lib/store/session'
import { bandLabel, effectiveBand, median, VIBE_CHECK_THRESHOLD } from '@/lib/vibe'
import { fmt, isLive } from '@/lib/logic/time'
import type { FranjaKind } from '@/lib/types'

// ── spaces ──────────────────────────────────────────────────────────────────

export type SpaceId = 'panel' | 'publicar' | 'recepcion' | 'credencial' | 'franja' | 'mercado'

export const SPACE_LABEL: Record<SpaceId, string> = {
  panel: 'Panel',
  publicar: 'Publicar',
  recepcion: 'Recepción',
  credencial: 'Credencial',
  franja: 'Franja',
  mercado: 'Mercado',
}

/** Params a space owns. Cleared when you move to another space. */
export const SPACE_PARAMS = ['vista', 'ventana', 'coleccion', 'orden', 'formato', 'pagina', 'estado', 'pieza']

/** Every format the Mesa composes, in the order the desk offers them. */
export const COMPOSE_TYPES: ContentType[] = ['evento', 'mix', 'noticia', 'review', 'editorial', 'opinion', 'articulo', 'listicle']

/** What each pictogram means (02-DIRECCION), in a few words. */
export const FORMAT_HINT: Record<ContentType, string> = {
  evento: 'Un lugar en el tiempo',
  mix: 'Una sesión',
  noticia: 'Lo que pasó',
  review: 'Un juicio',
  editorial: 'La voz de la casa',
  opinion: 'Una postura',
  articulo: 'Un cuerpo largo',
  listicle: 'Una lista con orden',
  franja: '',
}

/** Two-letter format codes for indexical labels («MX·014»). */
export const FORMAT_CODE: Record<ContentType, string> = {
  evento: 'EV',
  mix: 'MX',
  noticia: 'NT',
  review: 'RS',
  editorial: 'ED',
  opinion: 'OP',
  articulo: 'AR',
  listicle: 'LS',
  franja: 'FR',
}

/** The flat format plate for each format (TRAMA tokens). */
export const FORMAT_PLATE: Record<ContentType, string> = {
  evento: 'var(--p-evento)',
  mix: 'var(--p-mix)',
  noticia: 'var(--p-noticia)',
  review: 'var(--p-review)',
  editorial: 'var(--p-texto)',
  opinion: 'var(--p-texto)',
  articulo: 'var(--p-texto)',
  listicle: 'var(--p-lista)',
  franja: 'var(--p-franja)',
}

/**
 * «MX·014» = your fourteenth mix, counted in publication order. A reference
 * number, not a rank: it never changes with how a piece is received.
 */
export function pieceCodes(pieces: ContentItem[]): Map<string, string> {
  const byType = new Map<ContentType, ContentItem[]>()
  for (const p of pieces) {
    const arr = byType.get(p.type) ?? []
    arr.push(p)
    byType.set(p.type, arr)
  }
  const out = new Map<string, string>()
  for (const [type, list] of byType) {
    list
      .slice()
      .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))
      .forEach((p, i) => out.set(p.id, `${FORMAT_CODE[type]}·${String(i + 1).padStart(3, '0')}`))
  }
  return out
}

/** «04–07 · FRESH → HOT» — a band as a printed code. */
export function bandCode(min: number, max: number): string {
  const a = String(Math.round(min)).padStart(2, '0')
  const b = String(Math.round(max)).padStart(2, '0')
  return `${a === b ? a : `${a}–${b}`} · ${bandLabel(min, max)}`
}

export function canCreateAny(me: User): boolean {
  return COMPOSE_TYPES.some((t) => perm.canCreateContent(me, t))
}

/**
 * «No grant, no tab»: a space whose body would be dead is absent, never
 * disabled. PUBLICAR needs a voice or something already written; FRANJA and
 * MERCADO need a franja. RECEPCIÓN is universal — every account accrues
 * presence (a vibe check is enough). CREDENCIAL too: everyone carries a
 * card, and the house gives two stickers at the door.
 */
export function spacesFor(me: User, hasWork: boolean): SpaceId[] {
  const out: SpaceId[] = ['panel']
  if (hasWork || canCreateAny(me)) out.push('publicar')
  out.push('recepcion', 'credencial')
  if (me.franjaId) out.push('franja', 'mercado')
  return out
}

export function resolveSpace(raw: string | null, spaces: SpaceId[]): SpaceId {
  // `?espacio=recepción` (with the accent the label carries) still lands.
  const v = (raw ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') as SpaceId
  return spaces.includes(v) ? v : 'panel'
}

// ── readiness ───────────────────────────────────────────────────────────────

/**
 * The desk decides between «gate» and «desk» once the session and the world
 * are known — which, with both arriving from the server with the page, is the
 * first render. Kept as a hook so the desk has one place to ask.
 */
export function useTallerReady(): boolean {
  const worldReady = useWorld((s) => s.hydrated)
  const sessionReady = useSessionReady()
  return worldReady && sessionReady
}

// ── URL state ───────────────────────────────────────────────────────────────

export function useTallerParams() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname() ?? '/taller'
  const set = useCallback(
    (patch: Record<string, string | null>, mode: 'push' | 'replace' = 'replace') => {
      const sp = new URLSearchParams(window.location.search)
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === '') sp.delete(k)
        else sp.set(k, v)
      }
      const q = sp.toString()
      const url = q ? `${pathname}?${q}` : pathname
      if (mode === 'push') router.push(url, { scroll: false })
      else router.replace(url, { scroll: false })
    },
    [router, pathname],
  )
  return { params, set }
}

// ── your work ───────────────────────────────────────────────────────────────

export function useMyPieces(meId: string): ContentItem[] {
  const items = useItems()
  return useMemo(
    () =>
      items
        .filter((i) => i.createdById === meId && i.type !== 'franja')
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    [items, meId],
  )
}

export function useMyDrafts(meId: string): Draft[] {
  const drafts = useWorld((s) => s.world.drafts)
  return useMemo(
    () =>
      Object.values(drafts)
        .filter((d) => d.authorId === meId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [drafts, meId],
  )
}

export interface SavedEntry {
  item: ContentItem
  savedAt: string
}

/** Your collection, most recently saved first. */
export function useSaved(meId: string): SavedEntry[] {
  const items = useItems()
  const saves = useWorld((s) => s.world.saves[meId])
  return useMemo(() => {
    if (!saves) return []
    const byId = new Map(items.map((i) => [i.id, i]))
    const out: SavedEntry[] = []
    for (const [id, at] of Object.entries(saves)) {
      const item = byId.get(id)
      if (item && item.type !== 'franja') out.push({ item, savedAt: at })
    }
    return out.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
  }, [items, saves])
}

// ── energy & life ───────────────────────────────────────────────────────────

export function pieceEnergy(item: Pick<ContentItem, 'vibeMin' | 'vibeMax' | 'vibeCheckCount' | 'vibeCheckMedianMin' | 'vibeCheckMedianMax'>) {
  const b = effectiveBand(item)
  return { min: b.min, max: b.max, mid: (b.min + b.max) / 2 }
}

/** Glow for an energy line: HL mapped to 0.1–1 (60 = PLENO saturates). */
export function lifeGlow(hl: number): number {
  return Math.max(0.1, Math.min(1, hl / 60))
}

// ── presence (private) ──────────────────────────────────────────────────────

export const PRESENCE_STEPS = [
  { key: 'presence_logged', target: 10 },
  { key: 'presence_deep', target: 25 },
  { key: 'presence_persistent', target: 50 },
  { key: 'presence_insider_track', target: 100 },
] as const

export function presenceProgress(p: number) {
  const next = PRESENCE_STEPS.find((s) => p < s.target) ?? null
  let prev = 0
  for (const s of PRESENCE_STEPS) if (p >= s.target) prev = s.target
  return { next, prev }
}

/** The one scale both the presence meter and the harvest flow share. */
export function presenceScale(...values: number[]): number {
  return Math.max(110, ...values.map((v) => v * 1.08))
}

// ── personal vibe (median of your own readings) ─────────────────────────────

export function personalVibra(readings: Record<string, Record<string, [number, number]>>, meId: string) {
  const lows: number[] = []
  const highs: number[] = []
  for (const r of Object.values(readings)) {
    const mine = r[meId]
    if (!mine) continue
    lows.push(mine[0])
    highs.push(mine[1])
  }
  const count = lows.length
  if (count < VIBE_CHECK_THRESHOLD) return { count, band: null as [number, number] | null }
  const lo = Math.max(0, Math.min(10, median(lows)))
  const hi = Math.max(0, Math.min(10, median(highs)))
  return { count, band: (lo <= hi ? [lo, hi] : [hi, lo]) as [number, number] }
}

// ── events ──────────────────────────────────────────────────────────────────

/** HOY, MAÑANA, the weekday, or «EN N DÍAS» — words, from the calendar. */
export function urgencyWord(item: ContentItem, now: Date): string {
  if (isLive(item, now)) return 'EN VIVO'
  if (!item.date) return 'PRÓXIMO'
  const days = differenceInCalendarDays(parseISO(item.date), now)
  if (days <= 0) return 'HOY'
  if (days === 1) return 'MAÑANA'
  if (days < 7) return fmt.weekdayLong(item.date).toUpperCase()
  return `EN ${days} DÍAS`
}

// ── franjas ─────────────────────────────────────────────────────────────────

export const FRANJA_KIND_LABEL: Record<FranjaKind, string> = {
  label: 'Sello',
  promoter: 'Promotora',
  venue: 'Venue',
  dealer: 'Dealer',
  colectivo: 'Colectivo',
  festival: 'Festival',
  club: 'Club',
  medios: 'Medio',
  'mix-series': 'Serie de mixes',
  plataforma: 'Plataforma',
}

// ── the harvest sheet (one per desk) ────────────────────────────────────────

interface CosechaState {
  itemId: string | null
  open: (itemId: string) => void
  close: () => void
}

export const useCosecha = create<CosechaState>((set) => ({
  itemId: null,
  open: (itemId) => set({ itemId }),
  close: () => set({ itemId: null }),
}))

// ── small formatting ────────────────────────────────────────────────────────

export const NUM1 = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
export const NUM0 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 })

export function plural(n: number, one: string, many: string): string {
  return `${NUM0.format(n)} ${n === 1 ? one : many}`
}

export function isHttpUrl(v: string): boolean {
  return /^https?:\/\/[^\s]+\.[^\s]+/.test(v.trim())
}

/** Avatar/image field: empty, an http(s) URL, or a site path like /flyers/x.jpg. */
export function isImageRef(v: string): boolean {
  const t = v.trim()
  return t === '' || isHttpUrl(t) || /^\/[^\s]+$/.test(t)
}
