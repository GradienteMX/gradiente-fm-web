import type { ArticleBlock, ContentItem, ContentType } from '@/lib/types'
import { isClassifierTag } from '@/lib/genres'

// ── Publication readiness ─────────────────────────────────────────────────────
//
// Two levels, one list:
//   · hard — the row cannot exist without it. The composer disables the publish
//     button and POST /api/items rejects with 422. Applies to creates AND edits.
//   · soft — editorial recommendations. The review step lists them with a jump
//     link but never blocks, and the server never enforces them, so a piece
//     published under older rules stays editable ("guides, not gatekeepers").
//
// Draft saving has no gate at either level.

export type RequiredFieldKey =
  | 'title' | 'slug' | 'date' | 'body' | 'audio' | 'endDate' | 'vibe' | 'genres' | 'tags' | 'context'
export type ReadinessLevel = 'hard' | 'soft'
export const COMPOSE_ANCHOR_IDS: Record<RequiredFieldKey, string> = {
  title: 'compose-field-title', slug: 'compose-field-slug', date: 'compose-field-date',
  body: 'compose-field-body', audio: 'compose-field-audio', endDate: 'compose-field-end', vibe: 'compose-field-vibe',
  genres: 'compose-field-genres', tags: 'compose-field-tags', context: 'compose-field-context',
}
export interface RequiredField { key: RequiredFieldKey; label: string; done: boolean; anchorId: string; level: ReadinessLevel }
const text = (value: unknown): boolean => typeof value === 'string' && value.trim().length > 0
export function usableUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false
  try { return ['https:', 'http:'].includes(new URL(value).protocol) } catch { return false }
}
export function meaningfulBlock(block: ArticleBlock): boolean {
  switch (block.kind) {
    case 'divider': return false
    case 'image': return text(block.src)
    case 'list': return Array.isArray(block.items) && block.items.some(text)
    case 'track': return text(block.title) && text(block.artist)
    default: return text(block.text)
  }
}
// Tags that classify the piece for filters and affinity. Provenance markers
// ('ra', 'noticia', a bare year) are stamped by pipelines, never chosen, and do
// not count towards the requirement.
export function classifierTags(tags: readonly string[] | undefined): string[] {
  return (tags ?? []).filter(isClassifierTag)
}
function field(key: RequiredFieldKey, label: string, done: boolean, level: ReadinessLevel = 'hard'): RequiredField {
  return { key, label, done, anchorId: COMPOSE_ANCHOR_IDS[key], level }
}
// Shared by authoring and publication API.
export function requiredFields(type: ContentType, draft: ContentItem): RequiredField[] {
  const list = [field('title', 'Título', text(draft.title)), field('slug', 'Enlace de la publicación', text(draft.slug))]
  if (type === 'evento') {
    list.push(field('date', 'Fecha de inicio', text(draft.date) && Number.isFinite(Date.parse(draft.date!))))
    if (draft.endDate) list.push(field('endDate', 'Cierre posterior al inicio', Date.parse(draft.endDate) > Date.parse(draft.date ?? ''), 'soft'))
  } else if (type === 'articulo' || type === 'listicle') {
    list.push(field('body', type === 'listicle' ? 'Una entrada con artista y título' : 'Contenido de la pieza',
      Array.isArray(draft.articleBody) && draft.articleBody.some((b) => b && (type === 'listicle' ? b.kind === 'track' && meaningfulBlock(b) : meaningfulBlock(b))), 'soft'))
  } else if (['review', 'editorial', 'opinion', 'noticia'].includes(type)) {
    list.push(field('body', 'Texto de la pieza', text(draft.bodyPreview) || (type === 'noticia' && text(draft.excerpt)), 'soft'))
  } else if (type === 'mix' && !['proximamente', 'archivo', 'exclusivo'].includes(draft.mixStatus ?? 'disponible')) {
    list.push(field('audio', 'Enlace del audio', (Array.isArray(draft.embeds) && draft.embeds.some((e) => e && usableUrl(e.url))) || usableUrl(draft.mixUrl), 'soft'))
  }
  list.push(field('vibe', 'Ambiente entre 0 y 10', Number.isFinite(draft.vibeMin) && Number.isFinite(draft.vibeMax)
    && draft.vibeMin >= 0 && draft.vibeMax <= 10 && draft.vibeMin <= draft.vibeMax))
  // Classification is what makes the dial filter and the affinity map work
  // across every piece on the site, so it is a hard requirement everywhere.
  list.push(field('genres', 'Al menos un género', Array.isArray(draft.genres) && draft.genres.some(text)))
  list.push(field('tags', 'Al menos una etiqueta', classifierTags(draft.tags).length > 0))
  if (type !== 'franja') {
    const linked = (draft.entities?.length ?? 0) + (draft.franjaRefs?.length ?? 0)
    list.push(field('context', 'Vincula artistas, sellos o franjas', linked > 0, 'soft'))
  }
  return list
}
// Labels of the fields still pending at a level. Hard misses are what the
// publish button and the API act on; soft misses are recommendations.
export function errorsFrom(list: RequiredField[], level: ReadinessLevel = 'hard'): string[] {
  return list.filter((f) => !f.done && f.level === level).map((f) => f.label)
}
export function blockingFields(list: RequiredField[]): RequiredField[] { return list.filter((f) => !f.done && f.level === 'hard') }
export function recommendedFields(list: RequiredField[]): RequiredField[] { return list.filter((f) => !f.done && f.level === 'soft') }
export function completeness(list: RequiredField[]): { done: number; total: number } {
  const hard = list.filter((f) => f.level === 'hard')
  return { done: hard.filter((f) => f.done).length, total: hard.length }
}
