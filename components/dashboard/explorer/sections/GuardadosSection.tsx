'use client'

import { Bookmark, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import type { ContentType } from '@/lib/types'
import { categoryColor } from '@/lib/utils'

interface Props {
  /** When null, this is the union view ("Guardados · Feed"). */
  filter: ContentType | null
}

const FILTER_LABEL: Record<string, string> = {
  evento: 'eventos',
  noticia: 'noticias',
  review: 'reviews',
  mix: 'mixes',
  editorial: 'editoriales',
  articulo: 'artículos',
}

const FEED_HREF: Record<string, string> = {
  evento: '/agenda',
  noticia: '/noticias',
  review: '/reviews',
  mix: '/mixes',
  editorial: '/editorial',
  articulo: '/articulos',
}

export function GuardadosSection({ filter }: Props) {
  const color = filter ? categoryColor(filter) : '#22D3EE'
  const label = filter ? FILTER_LABEL[filter] ?? filter : 'contenido'
  const targetHref = filter ? FEED_HREF[filter] ?? '/' : '/'

  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 border border-dashed border-border/60 p-8 text-center">
      <Bookmark size={32} strokeWidth={1} style={{ color }} />

      <span className="font-mono text-[10px] tracking-widest" style={{ color }}>
        // BANDEJA DE GUARDADOS · VACÍA
      </span>

      <p className="max-w-md font-mono text-[11px] leading-relaxed text-secondary">
        Cuando guardes {label} desde el feed público aparecerán aquí. Esto te
        deja volver a lo que te marcó sin tener que rebuscar entre fechas y
        scroll.
      </p>

      <p className="max-w-md font-mono text-[10px] leading-relaxed text-muted">
        El gesto de guardar todavía no existe en la cara pública del sitio.
        Próximamente: un toggle en cada carta. Más adelante: marcar{' '}
        <span className="text-secondary">eventos a los que asististe</span> y,
        en colaboración con clubs, perks verificables para usuarios recurrentes.
      </p>

      <Link
        href={targetHref}
        className="mt-2 inline-flex items-center gap-2 border px-3 py-1.5 font-mono text-[10px] tracking-widest transition-colors"
        style={{
          borderColor: color,
          color,
          backgroundColor: `${color}10`,
        }}
      >
        IR AL FEED <ArrowRight size={11} strokeWidth={1.5} />
      </Link>
    </div>
  )
}
