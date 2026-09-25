/**
 * Lecturas — every text format on one surface. Pure module: the server page
 * parses `?tipo=` with it; the client surface renders from it.
 */

import type { ContentType } from '@/lib/types'

export type TipoLectura = 'editorial' | 'review' | 'opinion' | 'articulo' | 'listicle' | 'noticia'

/** Control order (as the house reads them, longest voice to shortest). */
export const TIPOS_LECTURA: TipoLectura[] = ['editorial', 'review', 'opinion', 'articulo', 'listicle', 'noticia']

export const TEXT_TYPES: ContentType[] = TIPOS_LECTURA

export const TIPO_LABEL: Record<TipoLectura, string> = {
  editorial: 'Editorial',
  review: 'Reseñas',
  opinion: 'Opinión',
  articulo: 'Artículos',
  listicle: 'Listas',
  noticia: 'Noticias',
}

/** One honest line per format — what it is, from the house guide. */
export const TIPO_DEK: Record<TipoLectura | 'todo', string> = {
  todo: 'Todo lo que la escena escribe sobre sí misma: editoriales, reseñas, columnas, reportajes, listas y noticias. Nadie te lo ordena por lo que ya leíste.',
  editorial: 'La voz de la casa. Una declaración, una posición sobre la escena, firmada.',
  review: 'Discos, EPs, mixes y noches que ya pasaron, escuchados con atención y contados por alguien de adentro.',
  opinion: 'Columnas. Una postura, defendida, por quien la sostiene.',
  articulo: 'Reportajes, entrevistas y ensayos largos. Para leer con tiempo.',
  listicle: 'Listas rankeadas con la música adentro: del diez al uno, con comentario en cada pista.',
  noticia: 'Hechos duros, sin opinión. Viven poco: su vida media es la más corta del campo.',
}

/** Plural nouns for honest empty states. */
export const TIPO_NOUN: Record<TipoLectura, string> = {
  editorial: 'editoriales',
  review: 'reseñas',
  opinion: 'columnas de opinión',
  articulo: 'artículos',
  listicle: 'listas',
  noticia: 'noticias',
}

/** Legacy routes keep their URLs; each opens the surface with its tipo set. */
export const LEGACY_PATH: Record<TipoLectura, string> = {
  editorial: '/editorial',
  review: '/reviews',
  opinion: '/opinion',
  articulo: '/articulos',
  listicle: '/listas',
  noticia: '/noticias',
}

export function parseTipo(raw: string | string[] | undefined): TipoLectura | null {
  const v = Array.isArray(raw) ? raw[0] : raw
  return v && (TIPOS_LECTURA as string[]).includes(v) ? (v as TipoLectura) : null
}

export function lecturasHref(tipo: TipoLectura | null): string {
  return tipo ? `/lecturas?tipo=${tipo}` : '/lecturas'
}
