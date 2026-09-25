/**
 * FORO — pure helpers for el Muro.
 *
 * Threads are not content items: no HL, no curation, never in the mosaic.
 * The only order is the bump (last reply, or creation), and only thirty
 * threads fit on the wall. Energy is read from the thread's genres through
 * the GENRE_VIBE stereotype map — the one place the foro touches the axis.
 */

import type { ForoReply, ForoThread, Tag } from '@/lib/types'
import { FORO_THREAD_CAP } from '@/lib/store/world-core'
import {
  canonicalizeGenre,
  genresIntersectVibeRange,
  getGenreById,
  getRollup,
  getTagById,
  tagLabel,
  vibeForGenre,
} from '@/lib/genres'

export { FORO_THREAD_CAP }

// ── order ───────────────────────────────────────────────────────────────────

const t = (iso: string) => {
  const v = Date.parse(iso)
  return Number.isNaN(v) ? 0 : v
}

export function byBump(a: ForoThread, b: ForoThread): number {
  return t(b.bumpedAt) - t(a.bumpedAt) || t(b.createdAt) - t(a.createdAt) || a.id.localeCompare(b.id)
}

/** The wall: live threads, bump order, cut at thirty. */
export function wallOrder(threads: Record<string, ForoThread>): string[] {
  return Object.values(threads)
    .filter((x) => !x.deletion)
    .sort(byBump)
    .slice(0, FORO_THREAD_CAP)
    .map((x) => x.id)
}

/** Live replies per thread (tombstones keep their place but don't count). */
export function replyCounts(replies: Record<string, ForoReply>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of Object.values(replies)) {
    if (r.deletion) continue
    out[r.threadId] = (out[r.threadId] ?? 0) + 1
  }
  return out
}

export function repliesOf(replies: Record<string, ForoReply>, threadId: string): ForoReply[] {
  return Object.values(replies)
    .filter((r) => r.threadId === threadId)
    .sort((a, b) => t(a.createdAt) - t(b.createdAt) || a.id.localeCompare(b.id))
}

export function sameOrder(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

// ── energy ──────────────────────────────────────────────────────────────────

const rollupEnergy = new Map<string, number | null>()

/**
 * A genre's stereotype energy: GENRE_VIBE for the id (or its canonical
 * twin); for roots without an anchor, the mean of their descendants.
 */
export function genreEnergy(id: string): number | null {
  const direct = vibeForGenre(id) ?? vibeForGenre(canonicalizeGenre(id))
  if (direct !== null) return direct
  if (rollupEnergy.has(id)) return rollupEnergy.get(id) ?? null
  const vals = getRollup(id)
    .map((g) => vibeForGenre(g))
    .filter((v): v is number => v !== null)
  const e = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
  rollupEnergy.set(id, e)
  return e
}

export interface ThreadBand {
  min: number
  max: number
  /** Mean of the genres' GENRE_VIBE — the energy the subject is set at. */
  mid: number
  known: boolean
}

export function threadBand(genres: string[]): ThreadBand {
  const direct = genres.map(vibeForGenre).filter((v): v is number => v !== null)
  const vals = direct.length ? direct : genres.map(genreEnergy).filter((v): v is number => v !== null)
  if (!vals.length) return { min: 5, max: 5, mid: 5, known: false }
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const mid = vals.reduce((s, v) => s + v, 0) / vals.length
  return { min, max, mid, known: true }
}

/**
 * Energy as CSS variables (`--e0…--e10`), never literal colors, so the
 * palette can be re-set globally. Continuous energies snap to the nearest
 * stop; a band is the run of stops it covers.
 */
export function eVar(e: number): string {
  return `var(--e${Math.max(0, Math.min(10, Math.round(e)))})`
}

/** A band printed the way the ramp is printed: stepped, one block per stop. */
export function bandVar(min: number, max: number, dir = '90deg'): string {
  const a = Math.max(0, Math.min(10, Math.round(min)))
  const b = Math.max(a, Math.min(10, Math.round(max)))
  if (a === b) return eVar(a)
  const n = b - a + 1
  const stops: string[] = []
  for (let k = 0; k < n; k++) {
    stops.push(`var(--e${a + k}) ${((k / n) * 100).toFixed(2)}% ${(((k + 1) / n) * 100).toFixed(2)}%`)
  }
  return `linear-gradient(${dir}, ${stops.join(', ')})`
}

/**
 * Text set ON an energy ground: paper for e0–e1, ink for e2–e10 (the TRAMA
 * rule; mirrors lib/vibe's `energyOn` once it lands).
 */
export function onEnergy(e: number): string {
  return Math.round(e) <= 1 ? 'var(--paper, var(--obs-0))' : 'var(--rule, var(--ink))'
}

/** "06–08" — a band as a code. */
export function bandCode(min: number, max: number): string {
  const a = Math.round(min)
  const b = Math.round(max)
  return a === b ? pad2(a) : `${pad2(a)}–${pad2(b)}`
}

/** The Horizonte gate — exactly the production predicate. */
export function inRange(thread: ForoThread, lo: number, hi: number): boolean {
  if (lo <= 0 && hi >= 10) return true
  return genresIntersectVibeRange(thread.genres, lo, hi)
}

// ── names ───────────────────────────────────────────────────────────────────

export function genreName(id: string): string {
  return getGenreById(id)?.name ?? getGenreById(canonicalizeGenre(id))?.name ?? tagLabel(id)
}

/** First segment of "Dub / Reggae", without a trailing parenthetical. */
export function genreShort(id: string): string {
  return genreName(id).split(' / ')[0].replace(/\s*\(.*\)\s*$/, '')
}

export function tagName(id: string): string {
  return getTagById(id)?.name ?? tagLabel(id)
}

// ── search ──────────────────────────────────────────────────────────────────

export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

const hay = new WeakMap<ForoThread, string>()

function haystack(th: ForoThread): string {
  let h = hay.get(th)
  if (h === undefined) {
    h = fold(
      [th.subject, ...th.genres, ...th.genres.map(genreName), ...th.tags, ...th.tags.map(tagName)].join(' · '),
    )
    hay.set(th, h)
  }
  return h
}

/** Subject, genre and tag names (and ids). Every word must appear. */
export function matchesQuery(th: ForoThread, query: string): boolean {
  const q = fold(query.trim())
  if (!q) return true
  const h = haystack(th)
  return q.split(/\s+/).every((w) => h.includes(w))
}

// ── tags ────────────────────────────────────────────────────────────────────

/** Tags people created in the composer — the registry is the threads themselves. */
export function customTags(threads: Record<string, ForoThread>): Tag[] {
  const seen = new Set<string>()
  const out: Tag[] = []
  for (const th of Object.values(threads)) {
    for (const id of th.tags) {
      if (seen.has(id) || getTagById(id)) continue
      seen.add(id)
      out.push({ id, name: tagLabel(id), custom: true })
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

// ── quotes ──────────────────────────────────────────────────────────────────

/** `>>id` tokens, unique, in order; only ids of posts in this thread. */
export function parseQuotes(text: string, valid: Set<string>): string[] {
  const out: string[] = []
  for (const m of text.matchAll(/>>([a-z0-9-]+)/gi)) {
    const id = m[1].toLowerCase()
    if (valid.has(id) && !out.includes(id)) out.push(id)
  }
  return out
}

// ── ids ─────────────────────────────────────────────────────────────────────
//
// Threads and replies are uuid rows. The composers mint the uuid (newUuid,
// lib/store/ids.ts) and the routes keep it, so `>>id` quotes (parseQuotes
// matches uuids), replies and stubs name a post the moment it is written.
// The UI never shows an id: a quote reads as the @name of who wrote it.

// ── images ──────────────────────────────────────────────────────────────────

/**
 * An image as the composer holds it until the post is written: a data URL,
 * downscaled to ≤ 1600 px on the long edge and re-encoded as JPEG 0.85 so the
 * upload is light. The effect stores it (/api/ingest-image → WebP in the
 * uploads bucket — lib/store/efectos/foro.ts) before the row is created, so
 * the post carries a URL, never the bytes. Transparent art is laid on the
 * paper.
 */
export async function imageToDataUrl(file: File, max = 1600, quality = 0.85): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('not-image')
  let source: CanvasImageSource
  let w: number
  let h: number
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    source = bmp
    w = bmp.width
    h = bmp.height
  } catch {
    const url = URL.createObjectURL(file)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = () => reject(new Error('decode'))
        el.src = url
      })
      source = img
      w = img.naturalWidth
      h = img.naturalHeight
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  if (!w || !h) throw new Error('decode')
  const k = Math.min(1, max / Math.max(w, h))
  const cw = Math.max(1, Math.round(w * k))
  const ch = Math.max(1, Math.round(h * k))
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  // JPEG has no alpha: transparent art is laid on the page's own paper.
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim() || 'white'
  ctx.fillRect(0, 0, cw, ch)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, cw, ch)
  if ('close' in source && typeof source.close === 'function') source.close()
  return canvas.toDataURL('image/jpeg', quality)
}

/** Files from a drop or a paste, images only. */
export function imageFiles(list: FileList | File[] | null | undefined): File[] {
  if (!list) return []
  return Array.from(list).filter((f) => f.type.startsWith('image/'))
}

// ── time ────────────────────────────────────────────────────────────────────

/** 1 → fresh bump, fading over four days. Time, not attention. */
export function bumpWarmth(bumpedAt: string, now: number): number {
  const hours = Math.max(0, (now - t(bumpedAt)) / 3_600_000)
  return Math.max(0.14, Math.min(1, 1 - hours / 96))
}

export const pad2 = (n: number) => String(n).padStart(2, '0')
