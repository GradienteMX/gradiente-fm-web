/**
 * LA MESA — the pure model of the composer.
 *
 * Steps and sections per format, publication readiness (hard / soft), the
 * composer prior for the energy band, formatting edits, parsers and the two
 * transforms every piece goes through: `previewOf` (what the preview may
 * render safely) and `finalize` (what the world receives on publish).
 *
 * Ported from espectro-fm-web (`lib/composeWorkflow.ts`,
 * `lib/contentReadiness.ts`, `lib/data/vibePriors.ts`, `lib/composeFormatting.ts`,
 * `lib/draftContent.ts`, the tracklist parser and the listicle rank logic).
 * No React, no DOM, no clock: every time value is passed in.
 */

import { format, isValid, parseISO } from 'date-fns'
import type { ArticleBlock, ContentItem, ContentType, EmbedPlatform, EntityRef, MixStatus, MixTrack, PollAttachment, PollKind, User } from '@/lib/types'
import type { EntityKind, EntityLink, ItemFormat, ItemSubjectKind } from '@/lib/types'
import { canonicalizeGenre, getDirectChildren, getGenreById, isClassifierTag, vibeForGenre } from '@/lib/genres'
import { effectiveBand } from '@/lib/vibe'
import { hasRole } from '@/lib/permissions'
import { hlBracket } from '@/lib/dashboard/hl'
import { SPAWN_HP_DEFAULT, SPAWN_HP_EDITORIAL } from '@/lib/store/world-core'
import { POLL_DEFAULT_PROMPT } from '@/lib/logic/polls'

// ── formats ─────────────────────────────────────────────────────────────────

export type Formato = Exclude<ContentType, 'franja'>

export const FORMATOS: Formato[] = ['evento', 'mix', 'noticia', 'review', 'editorial', 'opinion', 'articulo', 'listicle']

export function isFormato(v: string | null | undefined): v is Formato {
  return !!v && (FORMATOS as string[]).includes(v)
}

/** What each format is and how long it runs (user guide, «TIPOS DE CONTENIDO»). */
export const FORMATO_INFO: Record<Formato, { que: string; largo: string; target?: [number, number] }> = {
  evento: { que: 'Fiesta, festival, workshop.', largo: 'Fecha + lineup + boletos' },
  mix: { que: 'DJ set, sesión, radio show.', largo: 'Con tracklist y BPM' },
  noticia: { que: 'Hecho duro. Sin opinión. Decae.', largo: '150–300 palabras', target: [150, 300] },
  review: { que: 'Disco, EP, mix o evento pasado.', largo: '300–800 palabras', target: [300, 800] },
  editorial: { que: 'Voz de la casa. Declaración.', largo: '600–1,200 palabras', target: [600, 1200] },
  opinion: { que: 'Columna. Una postura, defendida.', largo: '400–700 palabras', target: [400, 700] },
  articulo: { que: 'Reportaje, entrevista, ensayo.', largo: '1,500–3,000 palabras', target: [1500, 3000] },
  listicle: { que: 'Lista rankeada con embebidos.', largo: 'Top N' },
}

/** Two-letter format codes (TRAMA indexing: «RS·03»). */
export const FORMATO_CODE: Record<Formato, string> = {
  evento: 'EV',
  mix: 'MX',
  noticia: 'NT',
  review: 'RS',
  editorial: 'ED',
  opinion: 'OP',
  articulo: 'AR',
  listicle: 'LI',
}

/** The format's flat pastel plate (a palette token). */
export const FORMATO_PLATE: Record<Formato, string> = {
  evento: 'var(--p-evento)',
  mix: 'var(--p-mix)',
  noticia: 'var(--p-noticia)',
  review: 'var(--p-review)',
  editorial: 'var(--p-texto)',
  opinion: 'var(--p-texto)',
  articulo: 'var(--p-texto)',
  listicle: 'var(--p-lista)',
}

/** Who carries each voice (mirror of `canCreateContent`). */
export const VOZ: Record<Formato, string> = {
  listicle: 'Curador en adelante, o el equipo de una franja.',
  mix: 'Guía o insider, o el equipo de una franja.',
  opinion: 'Guía o insider, o el equipo de una franja.',
  noticia: 'Guía o insider, o el equipo de una franja.',
  evento: 'Guía o insider, o el equipo de una franja.',
  editorial: 'Guía o insider: voz de la casa y de la escena.',
  review: 'Guía o insider: voz de la casa y de la escena.',
  articulo: 'Guía o insider: voz de la casa y de la escena.',
}

// ── steps & sections ────────────────────────────────────────────────────────

export type StepId = 'escribir' | 'portada' | 'detalles' | 'esencial' | 'cartel' | 'ambiente' | 'noticia' | 'revisar'

export interface Step {
  id: StepId
  label: string
  /** The step's heading: what to do here, in one line. */
  description: string
}

const WRITING_HEAD: Record<Exclude<Formato, 'evento' | 'noticia'>, string> = {
  articulo: 'Escribe primero. Los detalles pueden esperar.',
  mix: 'Audio y selección: dale contexto a lo que vamos a escuchar.',
  listicle: 'Tu selección: una entrada, una obra y una razón para escucharla.',
  review: 'La reseña: presenta la obra y desarrolla tu lectura crítica.',
  opinion: 'Tu columna: una postura clara, con espacio para tus argumentos.',
  editorial: 'La editorial: una idea que abra conversación desde la redacción.',
}

export function stepsFor(t: Formato): Step[] {
  if (t === 'evento')
    return [
      { id: 'esencial', label: 'Lo esencial', description: 'Empieza por la fecha y el lugar.' },
      { id: 'cartel', label: 'Cartel y artistas', description: 'Dale una imagen y presenta a quienes participan.' },
      { id: 'ambiente', label: 'Ambiente y entradas', description: 'Ayuda a la comunidad a llegar y saber qué esperar.' },
      { id: 'revisar', label: 'Revisar', description: 'Comprueba los detalles antes de compartir tu evento.' },
    ]
  if (t === 'noticia')
    return [
      { id: 'noticia', label: 'La noticia', description: 'Qué pasó, dónde y por qué importa.' },
      { id: 'revisar', label: 'Revisar', description: 'Comprueba la noticia y su fuente antes de compartir.' },
    ]
  const steps: Step[] = [
    { id: 'escribir', label: 'Escribir', description: WRITING_HEAD[t] },
    {
      id: 'portada',
      label: 'Portada y contexto',
      description: t === 'articulo' ? 'Así encontrará la comunidad tu pieza.' : 'Presenta tu pieza y añade sus referencias.',
    },
  ]
  if (t === 'articulo') steps.push({ id: 'detalles', label: 'Más detalles', description: 'Añade contexto solo si tu pieza lo necesita.' })
  steps.push({ id: 'revisar', label: 'Revisar', description: 'Lee tu pieza antes de compartirla.' })
  return steps
}

export type SectionKey =
  | 'titulo'
  | 'texto'
  | 'cuerpo'
  | 'lista'
  | 'resena'
  | 'audio'
  | 'tracklist'
  | 'ficha'
  | 'fechas'
  | 'lugar'
  | 'cartel'
  | 'portada'
  | 'artistas'
  | 'resumen'
  | 'energia'
  | 'clasificacion'
  | 'entradas'
  | 'vinculos'
  | 'firma'
  | 'notas'
  | 'encuesta'

export interface SectionDef {
  key: SectionKey
  step: StepId
  label: string
  optional?: boolean
  /** Noticia: lives inside the optional disclosure. */
  disclosure?: boolean
}

export interface PlannedSection extends SectionDef {
  num: string
}

function S(key: SectionKey, step: StepId, label: string, extra?: Partial<SectionDef>): SectionDef {
  return { key, step, label, ...extra }
}

/** The section plan per format — numbering is continuous across steps. */
export function planFor(t: Formato): PlannedSection[] {
  let list: SectionDef[]
  switch (t) {
    case 'evento':
      list = [
        S('titulo', 'esencial', 'Nombre del evento'),
        S('fechas', 'esencial', 'Fecha y hora'),
        S('lugar', 'esencial', 'Lugar'),
        S('cartel', 'cartel', 'Cartel'),
        S('artistas', 'cartel', 'Artistas'),
        S('resumen', 'cartel', 'Resumen', { optional: true }),
        S('energia', 'ambiente', 'Energía'),
        S('clasificacion', 'ambiente', 'Géneros y etiquetas'),
        S('entradas', 'ambiente', 'Entradas', { optional: true }),
        S('vinculos', 'ambiente', 'Vínculos', { optional: true }),
        S('firma', 'ambiente', 'Enlace'),
        S('encuesta', 'ambiente', 'Encuesta', { optional: true }),
      ]
      break
    case 'mix':
      list = [
        S('titulo', 'escribir', 'Título y artista'),
        S('audio', 'escribir', 'Audio'),
        S('tracklist', 'escribir', 'Tracklist', { optional: true }),
        S('texto', 'escribir', 'Sobre la sesión', { optional: true }),
        S('portada', 'portada', 'Portada'),
        S('resumen', 'portada', 'Resumen', { optional: true }),
        S('energia', 'portada', 'Energía'),
        S('clasificacion', 'portada', 'Géneros y etiquetas'),
        S('ficha', 'portada', 'Ficha de la sesión', { optional: true }),
        S('vinculos', 'portada', 'Vínculos', { optional: true }),
        S('firma', 'portada', 'Enlace'),
        S('encuesta', 'portada', 'Encuesta', { optional: true }),
      ]
      break
    case 'noticia':
      list = [
        S('titulo', 'noticia', 'Titular'),
        S('texto', 'noticia', 'Qué pasó'),
        S('energia', 'noticia', 'Energía'),
        S('clasificacion', 'noticia', 'Géneros y etiquetas'),
        S('firma', 'noticia', 'Enlace'),
        S('portada', 'noticia', 'Imagen', { optional: true, disclosure: true }),
        S('resumen', 'noticia', 'Resumen', { optional: true, disclosure: true }),
        S('vinculos', 'noticia', 'Contexto', { optional: true, disclosure: true }),
        S('encuesta', 'noticia', 'Encuesta', { optional: true, disclosure: true }),
      ]
      break
    case 'review':
      list = [
        S('titulo', 'escribir', 'Título'),
        S('resena', 'escribir', 'Reseña de'),
        S('texto', 'escribir', 'Tu reseña'),
        S('portada', 'portada', 'Portada'),
        S('resumen', 'portada', 'Resumen', { optional: true }),
        S('energia', 'portada', 'Energía'),
        S('clasificacion', 'portada', 'Géneros y etiquetas'),
        S('vinculos', 'portada', 'Vínculos', { optional: true }),
        S('firma', 'portada', 'Firma y enlace'),
        S('encuesta', 'portada', 'Encuesta', { optional: true }),
      ]
      break
    case 'articulo':
      list = [
        S('titulo', 'escribir', 'Título'),
        S('cuerpo', 'escribir', 'Cuerpo'),
        S('portada', 'portada', 'Portada'),
        S('resumen', 'portada', 'Resumen', { optional: true }),
        S('energia', 'portada', 'Energía'),
        S('clasificacion', 'portada', 'Géneros y etiquetas'),
        S('firma', 'portada', 'Firma y enlace'),
        S('notas', 'detalles', 'Notas al pie', { optional: true }),
        S('vinculos', 'detalles', 'Vínculos', { optional: true }),
        S('encuesta', 'detalles', 'Encuesta', { optional: true }),
      ]
      break
    case 'listicle':
      list = [
        S('titulo', 'escribir', 'Título'),
        S('lista', 'escribir', 'La lista'),
        S('portada', 'portada', 'Portada'),
        S('resumen', 'portada', 'Resumen', { optional: true }),
        S('energia', 'portada', 'Energía'),
        S('clasificacion', 'portada', 'Géneros y etiquetas'),
        S('vinculos', 'portada', 'Vínculos', { optional: true }),
        S('firma', 'portada', 'Firma y enlace'),
        S('encuesta', 'portada', 'Encuesta', { optional: true }),
      ]
      break
    default:
      // editorial · opinion
      list = [
        S('titulo', 'escribir', 'Título'),
        S('texto', 'escribir', t === 'opinion' ? 'Tu columna' : 'La editorial'),
        S('portada', 'portada', 'Portada'),
        S('resumen', 'portada', 'Resumen', { optional: true }),
        S('energia', 'portada', 'Energía'),
        S('clasificacion', 'portada', 'Géneros y etiquetas'),
        S('vinculos', 'portada', 'Vínculos', { optional: true }),
        S('firma', 'portada', 'Firma y enlace'),
        S('encuesta', 'portada', 'Encuesta', { optional: true }),
      ]
  }
  return list.map((s, i) => ({ ...s, num: String(i + 1).padStart(2, '0') }))
}

// ── energy ──────────────────────────────────────────────────────────────────

/** A band the author hasn't placed yet. Invalid by the readiness rule. */
export const UNSET = -1

export function energySet(it: Pick<ContentItem, 'vibeMin' | 'vibeMax'>): boolean {
  const a = it.vibeMin
  const b = it.vibeMax
  return Number.isFinite(a) && Number.isFinite(b) && a >= 0 && b <= 10 && a <= b
}

/** The palette token for an energy (the palette can be re-skinned globally). */
export function eVar(e: number): string {
  return `var(--e${Math.round(Math.min(10, Math.max(0, e)))})`
}

/** A band as a gradient of palette tokens, one stop per integer energy. */
export function bandVar(min: number, max: number): string {
  const a = Math.round(Math.min(10, Math.max(0, min)))
  const b = Math.round(Math.min(10, Math.max(0, max)))
  if (a >= b) return eVar(a)
  const stops: string[] = []
  for (let i = a; i <= b; i++) stops.push(`var(--e${i}) ${(((i - a) / (b - a)) * 100).toFixed(1)}%`)
  return `linear-gradient(90deg, ${stops.join(', ')})`
}

// ── readiness ───────────────────────────────────────────────────────────────

export type NeedKey = 'title' | 'slug' | 'date' | 'energy' | 'genres' | 'tags' | 'endDate' | 'body' | 'list' | 'audio' | 'cover' | 'context' | 'poll'

export interface Need {
  key: NeedKey
  label: string
  level: 'hard' | 'soft'
  done: boolean
  section: SectionKey
}

/** DOM id of the control a readiness row jumps to. */
export const FIELD_ID: Record<NeedKey, string> = {
  title: 'mesa-f-title',
  slug: 'mesa-f-slug',
  date: 'mesa-f-date',
  endDate: 'mesa-f-end',
  energy: 'mesa-f-energy',
  genres: 'mesa-f-genres',
  tags: 'mesa-f-tags',
  body: 'mesa-f-body',
  list: 'mesa-f-list',
  audio: 'mesa-f-audio',
  cover: 'mesa-f-cover',
  context: 'mesa-f-context',
  poll: 'mesa-f-poll',
}

const text = (v: unknown): boolean => typeof v === 'string' && v.trim().length > 0

export function usableUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false
  try {
    return ['https:', 'http:'].includes(new URL(value.trim()).protocol)
  } catch {
    return false
  }
}

export function meaningfulBlock(b: ArticleBlock): boolean {
  switch (b.kind) {
    case 'divider':
      return false
    case 'image':
      return text(b.src)
    case 'list':
      return b.items.some(text)
    case 'track':
      return text(b.title) && text(b.artist)
    default:
      return text(b.text)
  }
}

export function classifierTags(tags: readonly string[] | undefined): string[] {
  return (tags ?? []).filter(isClassifierTag)
}

function sectionOfNeed(t: Formato, key: NeedKey): SectionKey {
  switch (key) {
    case 'title':
      return 'titulo'
    case 'slug':
      return 'firma'
    case 'date':
    case 'endDate':
      return 'fechas'
    case 'energy':
      return 'energia'
    case 'genres':
    case 'tags':
      return 'clasificacion'
    case 'body':
      return t === 'articulo' ? 'cuerpo' : 'texto'
    case 'list':
      return 'lista'
    case 'audio':
      return 'audio'
    case 'cover':
      return t === 'evento' ? 'cartel' : 'portada'
    case 'context':
      return 'vinculos'
    case 'poll':
      return 'encuesta'
  }
}

/**
 * One checklist, two levels. HARD blocks the hold-to-publish (and applies to
 * edits too); SOFT is editorial advice with a jump link — never enforced.
 */
export function readiness(t: Formato, it: ContentItem): Need[] {
  const out: Need[] = []
  const add = (key: NeedKey, label: string, done: boolean, level: 'hard' | 'soft' = 'hard') =>
    out.push({ key, label, done, level, section: sectionOfNeed(t, key) })

  add('title', t === 'noticia' ? 'Titular' : t === 'evento' ? 'Nombre del evento' : 'Título', text(it.title))
  add('slug', 'Enlace de la publicación', text(it.slug))
  if (t === 'evento') add('date', 'Fecha de inicio', validIso(it.date))
  add('energy', 'Energía fijada en el horizonte', energySet(it))
  add('genres', 'Al menos un género', it.genres.some(text))
  add('tags', 'Al menos una etiqueta', classifierTags(it.tags).length > 0)

  if (t === 'evento' && it.endDate) add('endDate', 'Cierre después del inicio', Date.parse(it.endDate) > Date.parse(it.date ?? ''), 'soft')
  if (t === 'articulo') add('body', 'Cuerpo del artículo', (it.articleBody ?? []).some(meaningfulBlock), 'soft')
  if (t === 'listicle') add('list', 'Al menos una entrada con artista y título', (it.articleBody ?? []).some((b) => b.kind === 'track' && meaningfulBlock(b)), 'soft')
  if (t === 'review' || t === 'editorial' || t === 'opinion') add('body', 'Texto de la pieza', text(it.bodyPreview), 'soft')
  if (t === 'noticia') add('body', 'Texto de la noticia', text(it.bodyPreview) || text(it.excerpt), 'soft')
  if (t === 'mix' && !['proximamente', 'archivo', 'exclusivo'].includes(it.mixStatus ?? 'disponible'))
    add('audio', 'Enlace del audio', (it.embeds ?? []).some((e) => usableUrl(e.url)) || usableUrl(it.mixUrl), 'soft')
  add('cover', t === 'evento' ? 'Cartel' : 'Portada', text(safeImage(it.imageUrl)), 'soft')
  add('context', 'Vincula artistas, sellos o franjas', (it.entities?.length ?? 0) + (it.franjaRefs?.length ?? 0) > 0, 'soft')
  if (it.poll?.kind === 'freeform') add('poll', 'La encuesta necesita dos opciones', (it.poll.choices ?? []).filter((c) => text(c.label)).length >= 2, 'soft')
  return out
}

export const hardMisses = (list: Need[]) => list.filter((n) => n.level === 'hard' && !n.done)
export const softMisses = (list: Need[]) => list.filter((n) => n.level === 'soft' && !n.done)

// ── the empty piece ─────────────────────────────────────────────────────────

export function isStaff(u: User | null): boolean {
  return !!u && (u.role === 'guide' || u.role === 'insider' || u.role === 'admin')
}

export function canPin(u: User | null): boolean {
  return !!u && (u.role === 'guide' || u.role === 'admin')
}

export function emptyItem(t: Formato, id: string, o: { me: User; nowIso: string; franja: boolean }): ContentItem {
  const base: ContentItem = {
    id,
    slug: '',
    type: t,
    title: '',
    vibeMin: UNSET,
    vibeMax: UNSET,
    genres: [],
    tags: [],
    publishedAt: o.nowIso,
    editorial: isStaff(o.me) && (t === 'editorial' || t === 'articulo'),
    franjaId: o.franja && o.me.franjaId ? o.me.franjaId : undefined,
  }
  switch (t) {
    case 'evento':
      return { ...base, artists: [] }
    case 'mix':
      return { ...base, embeds: [], tracklist: [], mixStatus: 'disponible' }
    case 'review':
      return { ...base, subjectKind: 'record' }
    case 'articulo':
      return { ...base, articleBody: [], footnotes: [] }
    case 'listicle':
      return { ...base, articleBody: [] }
    default:
      return base
  }
}

/** Voice that comes only from the franja uses the franja's name by default. */
export function franjaByDefault(me: User, t: Formato, param: boolean): boolean {
  if (!me.franjaId) return false
  if (param) return true
  return t === 'listicle' ? !hasRole(me, 'curator') : !hasRole(me, 'guide')
}

// ── slugs ───────────────────────────────────────────────────────────────────

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
    .replace(/-+$/, '')
}

/** Title edits regenerate a slug that still follows the title (never a custom one). */
export function patchItem(it: ContentItem, p: Partial<ContentItem>, slugFollows: boolean): ContentItem {
  const next = { ...it, ...p }
  if (p.title !== undefined && slugFollows && (!it.slug || it.slug === slugify(it.title))) next.slug = slugify(p.title)
  return next
}

export function uniqueSlug(base: string, taken: (slug: string) => boolean): string {
  const root = base || 'pieza'
  if (!taken(root)) return root
  for (let n = 2; n < 500; n++) {
    const s = `${root}-${n}`
    if (!taken(s)) return s
  }
  return `${root}-${Date.now().toString(36)}`
}

// ── words ───────────────────────────────────────────────────────────────────

export function plainText(s: string): string {
  return s
    .replace(/\[\^[^\]]+\]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
}

export function countWords(s: string | undefined): number {
  const t = plainText(s ?? '').trim()
  return t ? t.split(/\s+/).length : 0
}

function blockText(b: ArticleBlock): string {
  switch (b.kind) {
    case 'track':
      return b.commentary ?? ''
    case 'list':
      return b.items.join(' ')
    case 'image':
      return b.caption ?? ''
    case 'divider':
      return ''
    default:
      return b.text
  }
}

export function wordsOf(it: ContentItem): number {
  if (it.articleBody?.length) return it.articleBody.reduce((n, b) => n + countWords(blockText(b)), 0)
  return countWords(it.bodyPreview)
}

export function readMinutes(words: number): number | undefined {
  return words > 0 ? Math.max(1, Math.ceil(words / 220)) : undefined
}

// ── formatting (Negrita · Cursiva · Enlace) ─────────────────────────────────

export interface Selection {
  start: number
  end: number
}

export interface Edit extends Selection {
  text: string
}

export function emphasize(text: string, sel: Selection, marker: '**' | '*'): Edit {
  const { start, end } = sel
  const selected = text.slice(start, end)
  // Repeating the action on the inner selection removes the same emphasis.
  const before = text.slice(0, start).match(/\*+$/)?.[0].length ?? 0
  const after = text.slice(end).match(/^\*+/)?.[0].length ?? 0
  const count = Math.min(before, after)
  const active = marker === '*' ? count % 2 === 1 : count >= 2
  if (active) {
    return {
      text: text.slice(0, start - marker.length) + selected + text.slice(end + marker.length),
      start: start - marker.length,
      end: end - marker.length,
    }
  }
  const content = selected || 'texto'
  return {
    text: text.slice(0, start) + marker + content + marker + text.slice(end),
    start: start + marker.length,
    end: start + marker.length + content.length,
  }
}

export function linkify(text: string, sel: Selection, label: string, url: string): Edit | null {
  let target: URL
  try {
    target = new URL(url.trim())
  } catch {
    return null
  }
  if (!['https:', 'http:'].includes(target.protocol) || !label.trim()) return null
  const safeUrl = target.href.replace(/\(/g, '%28').replace(/\)/g, '%29')
  const safeLabel = label.trim().replace(/\[/g, '［').replace(/\]/g, '］').replace(/\n/g, ' ')
  const inserted = `[${safeLabel}](${safeUrl})`
  const at = sel.start + inserted.length
  return { text: text.slice(0, sel.start) + inserted + text.slice(sel.end), start: at, end: at }
}

export function hasMarkup(s: string): boolean {
  return /\*[^*\n]+\*|\[[^\]]+\]\(https?:|\[\^[^\]]+\]/.test(s)
}

// ── audio ───────────────────────────────────────────────────────────────────

export function detectPlatform(url: string): EmbedPlatform | null {
  try {
    const { hostname } = new URL(url.trim())
    if (hostname.includes('soundcloud.com')) return 'soundcloud'
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'youtube'
    if (hostname.includes('spotify.com')) return 'spotify'
    if (hostname.includes('bandcamp.com')) return 'bandcamp'
    if (hostname.includes('mixcloud.com')) return 'mixcloud'
    return null
  } catch {
    return null
  }
}

export const MIX_STATUS: Array<{ id: MixStatus; label: string; meaning: string }> = [
  { id: 'disponible', label: 'Disponible', meaning: 'Se escucha ya.' },
  { id: 'exclusivo', label: 'Exclusivo', meaning: 'Estreno de Gradiente; puede no tener enlace público.' },
  { id: 'archivo', label: 'Archivo', meaning: 'Una grabación de otro tiempo; el audio puede faltar.' },
  { id: 'proximamente', label: 'Próximamente', meaning: 'Anuncia la sesión; el enlace llega después.' },
]

export function durationOk(d: string): boolean {
  return /^\d{1,2}:[0-5]\d(:[0-5]\d)?$/.test(d.trim())
}

/**
 * One tracklist line: "01. Artist - Title (134)", "Artist — Title 134 BPM",
 * "Artist - Title". Blank and `#` lines are skipped.
 */
export function parseTrackLine(raw: string): MixTrack | null {
  let s = raw.trim()
  if (!s || s.startsWith('#')) return null
  s = s.replace(/^#?\d+[.)\-\s]+/, '').trim()
  if (!s) return null
  let bpm: number | undefined
  let body = s
  const paren = body.match(/\s*[([](\d{2,3})[)\]]\s*$/)
  const suffix = body.match(/\s+(\d{2,3})\s*BPM\s*$/i)
  const trailing = body.match(/\s+(\d{2,3})\s*$/)
  const pick = paren ?? suffix ?? trailing
  if (pick) {
    const n = parseInt(pick[1], 10)
    // Unmarked trailing numbers are only BPM inside a narrower band ("Summer 85").
    const lo = pick === trailing ? 100 : 50
    const hi = pick === trailing ? 200 : 250
    if (n >= lo && n <= hi) {
      bpm = n
      body = body.slice(0, pick.index).trim()
    }
  }
  const dash = body.match(/^(.+?)\s*[—–-]\s*(.+)$/)
  if (dash) return { artist: dash[1].trim(), title: dash[2].trim(), bpm }
  return { artist: '', title: body, bpm }
}

export function parseTracklist(text: string): MixTrack[] {
  return text
    .split(/\r?\n/)
    .map(parseTrackLine)
    .filter((t): t is MixTrack => t !== null)
}

// ── lists: ranks ────────────────────────────────────────────────────────────

type TrackBlock = Extract<ArticleBlock, { kind: 'track' }>

export function trackRanks(blocks: ArticleBlock[]): number[] {
  return blocks
    .filter((b): b is TrackBlock => b.kind === 'track')
    .map((b) => b.rank)
    .filter((r): r is number => typeof r === 'number')
}

/** Countdown ("10 → 1") or ascending, read from the first and last rank. */
export function listOrder(blocks: ArticleBlock[]): 'desc' | 'asc' | null {
  const r = trackRanks(blocks)
  if (r.length < 2) return null
  return r[0] > r[r.length - 1] ? 'desc' : 'asc'
}

/** The rank a new entry should carry, continuing the list's direction. */
export function nextRank(blocks: ArticleBlock[]): number | undefined {
  const r = trackRanks(blocks)
  if (!r.length) return undefined
  if (r.length === 1) return r[0] > 1 ? r[0] - 1 : r[0] + 1
  if (r[0] > r[r.length - 1]) {
    const min = Math.min(...r)
    return min > 1 ? min - 1 : undefined
  }
  return Math.max(...r) + 1
}

export function renumber(blocks: ArticleBlock[], dir: 'desc' | 'asc'): ArticleBlock[] {
  const n = blocks.filter((b) => b.kind === 'track').length
  let k = 0
  return blocks.map((b) => {
    if (b.kind !== 'track') return b
    const rank = dir === 'desc' ? n - k : k + 1
    k++
    return { ...b, rank }
  })
}

// ── images ──────────────────────────────────────────────────────────────────

/**
 * Why a portada can't be shown, in one line — or null if it can. Any https
 * address renders: components/kit/Imagen optimizes the allow-listed hosts
 * (our Storage among them) and shows the rest as they are.
 */
export function imageProblem(src: string | undefined): string | null {
  const s = (src ?? '').trim()
  if (!s) return null
  if (s.startsWith('/')) {
    return /^\/[^\s?#]+\.(jpe?g|png|webp|avif|gif)$/i.test(s) ? null : 'Una ruta de la colección apunta a una imagen, como /flyers/rf-012.jpg.'
  }
  let u: URL
  try {
    u = new URL(s)
  } catch {
    return 'Escribe una dirección completa (https://…) o una ruta de la colección (/flyers/…).'
  }
  if (u.protocol !== 'https:') return 'Solo direcciones seguras: https://…'
  return null
}

export function safeImage(src: string | undefined): string | undefined {
  const s = (src ?? '').trim()
  return s && !imageProblem(s) ? s : undefined
}

// ── dates ───────────────────────────────────────────────────────────────────

export function validIso(s: string | undefined): boolean {
  return !!s && !Number.isNaN(Date.parse(s))
}

/** ISO → the value a `datetime-local` input wants (local wall time). */
export function isoToLocal(iso: string | undefined): string {
  if (!iso) return ''
  const d = parseISO(iso)
  return isValid(d) ? format(d, "yyyy-MM-dd'T'HH:mm") : ''
}

export function localToIso(local: string): string | undefined {
  if (!local) return undefined
  const d = new Date(local)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

// ── life (words only — the author sees brackets, never numbers) ─────────────

const HALF_LIFE_DAYS: Record<Formato, number> = {
  evento: 3,
  mix: 21,
  editorial: 7,
  review: 14,
  noticia: 2,
  opinion: 10,
  articulo: 14,
  listicle: 14,
}

export function halfLifeWords(t: Formato): string {
  const d = HALF_LIFE_DAYS[t]
  const base = d % 7 === 0 && d >= 14 ? `${d / 7} semanas` : d === 7 ? 'una semana' : `${d} días`
  return t === 'evento' ? `${base}, más lento conforme se acerca la noche y en pausa mientras suena` : base
}

export function birthBracket(editorial: boolean): string {
  return hlBracket(editorial ? SPAWN_HP_EDITORIAL : SPAWN_HP_DEFAULT)
}

// ── the composer prior (Vibe Philosophy, idea 3: the system learns context) ─

export interface Prior {
  min: number
  max: number
  basis: string
  samples: number
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))

/** Stereotype anchor for a genre id; roots without one average their leaves. */
export function genreEnergy(id: string): number | null {
  const direct = vibeForGenre(id) ?? vibeForGenre(canonicalizeGenre(id))
  if (direct !== null) return direct
  const kids = getDirectChildren(id)
    .map((g) => vibeForGenre(g.id))
    .filter((v): v is number => v !== null)
  if (kids.length) return kids.reduce((a, b) => a + b, 0) / kids.length
  const g = getGenreById(id)
  if (g?.parents.length) {
    const parent = vibeForGenre(g.parents[0])
    if (parent !== null) return parent
    const sib = getDirectChildren(g.parents[0])
      .map((x) => vibeForGenre(x.id))
      .filter((v): v is number => v !== null)
    if (sib.length) return sib.reduce((a, b) => a + b, 0) / sib.length
  }
  return null
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/**
 * A suggested band from three sources, each a weighted set: the chosen
 * genres (their GENRE_VIBE anchors), the venue's past nights, and the
 * author's own history. Confidence narrows the band — consistent history
 * gives a tight suggestion, a single genre a wide one. Never auto-applied;
 * returns null when there is nothing honest to suggest.
 */
export function composerPrior(input: { genres: string[]; venue?: string; authorId: string; items: ContentItem[]; excludeId?: string }): Prior | null {
  const W = { genre: 3, venue: 2, author: 1.5 }
  const samples: Array<{ v: number; w: number }> = []

  const g = input.genres.map(genreEnergy).filter((v): v is number => v !== null)
  g.forEach((v) => samples.push({ v, w: W.genre / g.length }))

  const venue = input.venue ? norm(input.venue) : ''
  const byVenue = venue
    ? input.items.filter((i) => i.id !== input.excludeId && i.type === 'evento' && i.venue && norm(i.venue) === venue).slice(-60)
    : []
  byVenue.forEach((i) => {
    const b = effectiveBand(i)
    samples.push({ v: (b.min + b.max) / 2, w: W.venue / byVenue.length })
  })

  const mine = input.items
    .filter((i) => i.id !== input.excludeId && i.createdById === input.authorId && i.type !== 'franja' && energySet(i))
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))
    .slice(-60)
  mine.forEach((i) => {
    const b = effectiveBand(i)
    samples.push({ v: (b.min + b.max) / 2, w: W.author / mine.length })
  })

  const n = samples.length
  if (!n) return null
  const wSum = samples.reduce((s, x) => s + x.w, 0)
  const center = samples.reduce((s, x) => s + x.w * x.v, 0) / wSum
  const sd = Math.sqrt(samples.reduce((s, x) => s + x.w * (x.v - center) ** 2, 0) / wSum)
  const half = clamp(sd + 2.5 / Math.sqrt(n), 0.75, 3)
  const lo = clamp(Math.round(center - half), 0, 10)
  const hi = clamp(Math.round(center + half), 0, 10)

  const parts: string[] = []
  if (g.length) parts.push(g.length === 1 ? 'el género elegido' : 'los géneros elegidos')
  if (byVenue.length) parts.push('el venue')
  if (mine.length) parts.push('tu historial')
  const basis = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}` : parts[0]
  return { min: Math.min(lo, hi), max: Math.max(lo, hi), basis: `por ${basis}`, samples: n }
}

// ── polls ───────────────────────────────────────────────────────────────────

export function pollKindFor(t: Formato): PollKind {
  if (t === 'listicle') return 'from-list'
  if (t === 'mix') return 'from-tracklist'
  if (t === 'evento') return 'attendance'
  return 'freeform'
}

export const POLL_KIND_LABEL: Record<PollKind, string> = {
  'from-list': 'Tu favorito · sale de la lista',
  'from-tracklist': 'Mejor del set · sale del tracklist',
  attendance: 'Asistencia · VOY / TAL VEZ / NO PUEDO',
  freeform: 'Libre · tú escribes las opciones',
}

export function emptyPoll(kind: PollKind, id: string, nowIso: string): PollAttachment {
  return { id, kind, prompt: POLL_DEFAULT_PROMPT[kind], choices: kind === 'freeform' ? [] : undefined, createdAt: nowIso }
}

// ── entities ────────────────────────────────────────────────────────────────

export const ENTITY_LABEL: Record<EntityKind, { one: string; many: string }> = {
  artist: { one: 'Artista', many: 'Artistas' },
  label: { one: 'Sello', many: 'Sellos' },
  venue: { one: 'Venue', many: 'Venues' },
  promoter: { one: 'Promotora', many: 'Promotoras' },
}

export function entityRef(kind: EntityKind, name: string, known?: EntityRef): EntityRef {
  const slug = slugify(name) || 'sin-nombre'
  return known ?? { id: `ent-${kind}-${slug}`, kind, name: name.trim(), slug, relation: 'subject' }
}

export const SUBJECTS: Array<{ id: ItemSubjectKind; label: string }> = [
  { id: 'record', label: 'Disco' },
  { id: 'book', label: 'Libro' },
  { id: 'event', label: 'Evento' },
  { id: 'exhibition', label: 'Exposición' },
]

export const FORMATS_BY_SUBJECT: Record<ItemSubjectKind, Array<{ id: ItemFormat; label: string }>> = {
  record: [
    { id: 'vinyl', label: 'Vinilo' },
    { id: 'cassette', label: 'Casete' },
    { id: 'cd', label: 'CD' },
    { id: 'digital', label: 'Digital' },
    { id: 'mix', label: 'Mix' },
    { id: 'other', label: 'Otro' },
  ],
  book: [
    { id: 'hardcover', label: 'Tapa dura' },
    { id: 'paperback', label: 'Rústica' },
    { id: 'ebook', label: 'E-book' },
    { id: 'zine', label: 'Zine' },
    { id: 'other', label: 'Otro' },
  ],
  event: [],
  exhibition: [],
}

export const isHappening = (s: ItemSubjectKind | undefined) => s === 'event' || s === 'exhibition'

// ── preview & publish transforms ────────────────────────────────────────────

function cleanBlocks(blocks: ArticleBlock[] | undefined, forPublish: boolean): ArticleBlock[] | undefined {
  if (!blocks) return undefined
  const out: ArticleBlock[] = []
  for (const b of blocks) {
    switch (b.kind) {
      case 'image': {
        const src = safeImage(b.src)
        if (src) out.push({ ...b, src, alt: b.alt?.trim() || undefined, caption: b.caption?.trim() || undefined })
        break
      }
      case 'track': {
        if (forPublish && !text(b.artist) && !text(b.title)) break
        out.push({
          ...b,
          artist: b.artist.trim(),
          title: b.title.trim() || (forPublish ? '' : 'Sin título'),
          imageUrl: safeImage(b.imageUrl),
          embeds: (b.embeds ?? []).filter((e) => usableUrl(e.url)).map((e) => ({ ...e, url: e.url.trim() })),
          commentary: b.commentary?.trim() || undefined,
          year: typeof b.year === 'string' ? b.year.trim() || undefined : b.year,
        })
        break
      }
      case 'list': {
        const items = b.items.map((x) => x.trim()).filter(Boolean)
        if (items.length || !forPublish) out.push({ ...b, items })
        break
      }
      case 'divider':
        out.push(b)
        break
      case 'qa':
        if (forPublish && !text(b.text)) break
        out.push({ ...b, speaker: b.speaker.trim(), text: b.text.trim() })
        break
      case 'quote':
      case 'blockquote':
        if (forPublish && !text(b.text)) break
        out.push({ ...b, text: b.text.trim(), cite: b.cite?.trim() || undefined })
        break
      case 'h2':
        if (forPublish && !text(b.text)) break
        out.push({ ...b, text: b.text.trim(), id: b.id ? slugify(b.id) || undefined : undefined })
        break
      default:
        if (forPublish && !text(b.text)) break
        out.push({ ...b, text: b.text.trim() })
    }
  }
  return out
}

const opt = (s: string | undefined) => {
  const v = s?.trim()
  return v ? v : undefined
}

/** What the preview may render: every image routable, every date parseable. */
export function previewOf(it: ContentItem, o: { authorId: string; nowIso: string; existing?: ContentItem | null }): ContentItem {
  const set = energySet(it)
  const spawn = it.editorial ? SPAWN_HP_EDITORIAL : SPAWN_HP_DEFAULT
  const poll = it.poll
    ? { ...it.poll, choices: it.poll.choices?.map((c, i) => ({ ...c, label: c.label.trim() || `Opción ${i + 1}` })) }
    : undefined
  return {
    ...it,
    title: it.title.trim() || 'Sin título',
    vibeMin: set ? it.vibeMin : 5,
    vibeMax: set ? it.vibeMax : 5,
    imageUrl: safeImage(it.imageUrl),
    date: validIso(it.date) ? it.date : undefined,
    endDate: validIso(it.endDate) ? it.endDate : undefined,
    articleBody: cleanBlocks(it.articleBody, false),
    embeds: (it.embeds ?? []).filter((e) => usableUrl(e.url)),
    links: (it.links ?? []).filter((l) => usableUrl(l.url)).map((l) => ({ label: l.label.trim() || hostOf(l.url), url: l.url.trim() })),
    poll,
    createdById: o.existing?.createdById ?? o.authorId,
    publishedAt: o.existing?.publishedAt ?? o.nowIso,
    hp: o.existing ? o.existing.hp : spawn,
    hpLastUpdatedAt: o.existing ? o.existing.hpLastUpdatedAt : o.nowIso,
    vibeCheckCount: undefined,
    vibeCheckMedianMin: undefined,
    vibeCheckMedianMax: undefined,
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url.trim()).hostname.replace(/^www\./, '')
  } catch {
    return 'Enlace'
  }
}

/** The piece exactly as the world should receive it. */
export function finalize(
  it: ContentItem,
  o: { id: string; slug: string; source: ContentItem['source']; franjaId?: string; editorial: boolean; pinned: boolean; readTime?: number },
): ContentItem {
  // Provenance markers an older piece already carries are kept; the picker
  // only ever adds classifier tags.
  const tags = [...new Set(it.tags.filter(text))]
  const genres = [...new Set(it.genres.filter(text))]
  let poll: PollAttachment | undefined = it.poll
  if (poll) {
    const prompt = poll.prompt.trim() || POLL_DEFAULT_PROMPT[poll.kind]
    if (poll.kind === 'freeform') {
      const choices = (poll.choices ?? []).map((c) => ({ ...c, label: c.label.trim() })).filter((c) => c.label)
      poll = choices.length >= 2 ? { ...poll, prompt, choices } : undefined
    } else {
      poll = { ...poll, prompt, choices: undefined }
    }
    if (poll && poll.closesAt && !validIso(poll.closesAt)) poll = { ...poll, closesAt: undefined }
  }
  const entities = dedupeEntities(it.entities ?? [])
  const links: EntityLink[] = (it.links ?? []).filter((l) => usableUrl(l.url)).map((l) => ({ label: l.label.trim() || hostOf(l.url), url: l.url.trim() }))
  const out: ContentItem = {
    ...it,
    id: o.id,
    slug: o.slug,
    title: it.title.trim(),
    subtitle: opt(it.subtitle),
    excerpt: opt(it.excerpt),
    bodyPreview: opt(it.bodyPreview),
    author: opt(it.author),
    heroCaption: opt(it.heroCaption),
    imageUrl: safeImage(it.imageUrl),
    vibeMin: Math.round(it.vibeMin),
    vibeMax: Math.round(it.vibeMax),
    genres,
    tags,
    entities: entities.length ? entities : undefined,
    franjaRefs: it.franjaRefs?.length ? it.franjaRefs : undefined,
    links: links.length ? links : undefined,
    venue: opt(it.venue),
    venueCity: opt(it.venueCity),
    price: opt(it.price),
    ticketUrl: usableUrl(it.ticketUrl) ? it.ticketUrl!.trim() : undefined,
    artists: it.artists ? it.artists.map((a) => a.trim()).filter(Boolean) : undefined,
    date: validIso(it.date) ? it.date : undefined,
    endDate: validIso(it.endDate) ? it.endDate : undefined,
    embeds: it.embeds ? it.embeds.filter((e) => usableUrl(e.url)).map((e) => ({ ...e, url: e.url.trim() })) : undefined,
    tracklist: it.tracklist ? it.tracklist.filter((t) => text(t.artist) || text(t.title)).map((t) => ({ ...t, artist: t.artist.trim(), title: t.title.trim() })) : undefined,
    duration: opt(it.duration),
    mixSeries: opt(it.mixSeries),
    recordedIn: opt(it.recordedIn),
    mixFormat: opt(it.mixFormat),
    bpmRange: opt(it.bpmRange),
    musicalKey: opt(it.musicalKey),
    country: opt(it.country),
    articleBody: cleanBlocks(it.articleBody, true),
    footnotes: it.footnotes ? it.footnotes.filter((f) => text(f.id) && text(f.text)).map((f) => ({ id: f.id.trim(), text: f.text.trim() })) : undefined,
    readTime: o.readTime,
    poll,
    source: o.source,
    franjaId: o.franjaId,
    editorial: o.editorial,
    pinned: o.pinned,
    attributeFranja: undefined,
    _draftState: undefined,
    vibeCheckCount: undefined,
    vibeCheckMedianMin: undefined,
    vibeCheckMedianMax: undefined,
  }
  return out
}

function dedupeEntities(list: EntityRef[]): EntityRef[] {
  const seen = new Set<string>()
  return list.filter((e) => {
    const k = `${e.kind}:${e.slug}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
