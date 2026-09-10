import type { ArticleBlock, ContentItem, ContentType } from '@/lib/types'

export type RequiredFieldKey = 'title' | 'slug' | 'date' | 'body' | 'audio' | 'endDate' | 'vibe'
export const COMPOSE_ANCHOR_IDS: Record<RequiredFieldKey, string> = {
  title: 'compose-field-title', slug: 'compose-field-slug', date: 'compose-field-date',
  body: 'compose-field-body', audio: 'compose-field-audio', endDate: 'compose-field-end', vibe: 'compose-field-vibe',
}
export interface RequiredField { key: RequiredFieldKey; label: string; done: boolean; anchorId: string }
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
function field(key: RequiredFieldKey, label: string, done: boolean): RequiredField {
  return { key, label, done, anchorId: COMPOSE_ANCHOR_IDS[key] }
}
// Shared by authoring and publication API. Draft saving has no content gate.
export function requiredFields(type: ContentType, draft: ContentItem): RequiredField[] {
  const list = [field('title', 'Título', text(draft.title)), field('slug', 'Enlace de la publicación', text(draft.slug))]
  if (type === 'evento') {
    list.push(field('date', 'Fecha de inicio', text(draft.date) && Number.isFinite(Date.parse(draft.date!))))
    if (draft.endDate) list.push(field('endDate', 'Cierre posterior al inicio', Date.parse(draft.endDate) > Date.parse(draft.date ?? '')))
  } else if (type === 'articulo' || type === 'listicle') {
    list.push(field('body', type === 'listicle' ? 'Una entrada con artista y título' : 'Contenido de la pieza',
      Array.isArray(draft.articleBody) && draft.articleBody.some((b) => b && (type === 'listicle' ? b.kind === 'track' && meaningfulBlock(b) : meaningfulBlock(b)))))
  } else if (['review', 'editorial', 'opinion', 'noticia'].includes(type)) {
    list.push(field('body', 'Texto de la pieza', text(draft.bodyPreview) || (type === 'noticia' && text(draft.excerpt))))
  } else if (type === 'mix' && !['proximamente', 'archivo'].includes(draft.mixStatus ?? 'disponible')) {
    list.push(field('audio', 'Enlace del audio', (Array.isArray(draft.embeds) && draft.embeds.some((e) => e && usableUrl(e.url))) || usableUrl(draft.mixUrl)))
  }
  list.push(field('vibe', 'Ambiente entre 0 y 10', Number.isFinite(draft.vibeMin) && Number.isFinite(draft.vibeMax)
    && draft.vibeMin >= 0 && draft.vibeMax <= 10 && draft.vibeMin <= draft.vibeMax))
  return list
}
export function errorsFrom(list: RequiredField[]): string[] { return list.filter((f) => !f.done).map((f) => f.label) }
export function completeness(list: RequiredField[]): { done: number; total: number } {
  return { done: list.filter((f) => f.done).length, total: list.length }
}
