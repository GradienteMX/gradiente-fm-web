import type { ComponentType } from 'react'
import type { ContentType } from '@/lib/types'
import type { ReaderProps } from './parts'
import { Texto } from './Texto'
import { Noche } from './Noche'
import { Cronica, Lista } from './Cronica'
import { Sesion } from './Sesion'
import { Estacion } from './Estacion'

/** One reader per format — per-type layouts for expressive latitude. */
export const Readers: Record<ContentType, ComponentType<ReaderProps>> = {
  evento: Noche,
  mix: Sesion,
  noticia: Texto,
  review: Texto,
  editorial: Texto,
  opinion: Texto,
  articulo: Cronica,
  listicle: Lista,
  franja: Estacion,
}
