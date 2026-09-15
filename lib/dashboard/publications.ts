import type { ContentItem, ContentType } from '@/lib/types'

export type PublicationType = Exclude<ContentType, 'franja' | 'editorial' | 'opinion'>
export type PublicationSort = 'date' | 'title' | 'type'
export interface PublicationRow { item: ContentItem; date: string }

export const PUBLICATION_LABELS: Record<PublicationType, string> = {
  mix: 'MIX', listicle: 'LISTA', evento: 'EVENTO', review: 'RESEÑA', articulo: 'TEXTO', noticia: 'NOTICIA',
}

// Group legacy text formats visually; keep the persisted type for editing.
export function publicationType(type: ContentType): PublicationType | null {
  return type === 'franja' ? null : type === 'editorial' || type === 'opinion' ? 'articulo' : type
}

export function publicationLabel(type: ContentType): string {
  const group = publicationType(type)
  return group ? PUBLICATION_LABELS[group] : 'FRANJA'
}

export function selectPublications(rows: PublicationRow[], sort: PublicationSort, filter: string): PublicationRow[] {
  return rows.filter(({ item }) => publicationType(item.type) !== null &&
    (filter === 'all' || publicationType(item.type) === filter)).sort((a, b) => {
      const time = (value: string) => Date.parse(value) || 0
      const order = sort === 'title' ? (a.item.title || 'Sin título').localeCompare(b.item.title || 'Sin título', 'es')
        : sort === 'type' ? publicationLabel(a.item.type).localeCompare(publicationLabel(b.item.type), 'es')
        : time(b.date) - time(a.date)
      return order || a.item.id.localeCompare(b.item.id)
    })
}
