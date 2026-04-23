import type { ContentItem } from '@/lib/types'
import { vibeToColor } from '@/lib/utils'
import { getGenreNames, getTagNames } from '@/lib/genres'
import { fmtDateShort } from '@/lib/utils'
import { Clock } from 'lucide-react'

const TYPE_LABEL: Record<ContentItem['type'], string> = {
  noticia: '//NOTICIA',
  review: '//REVIEW',
  editorial: '//EDITORIAL',
  opinion: '//OPINIÓN',
  evento: '//EVENTO',
  mix: '//MIX',
  partner: '//PARTNER',
}

interface ArticleCardProps {
  item: ContentItem
}

export function ArticleCard({ item }: ArticleCardProps) {
  const vibeColor = vibeToColor(item.vibe)
  const genres = getGenreNames(item.genres).slice(0, 3)
  const tags = getTagNames(item.tags).slice(0, 3)

  return (
    <article className="group relative border-b border-border py-4 transition-colors hover:bg-elevated">
      {/* Left accent */}
      <div
        className="absolute left-0 top-0 w-0.5"
        style={{ backgroundColor: vibeColor, height: '100%' }}
      />

      <div className="pl-5 pr-2">
        {/* Type + meta row */}
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <span className="sys-label" style={{ color: vibeColor }}>
            {TYPE_LABEL[item.type] ?? '//TEXTO'}
          </span>
          {item.editorial && (
            <span className="sys-label text-sys-red">//EDITORIAL</span>
          )}
          {item.publishedAt && (
            <span className="sys-label">{fmtDateShort(item.publishedAt)}</span>
          )}
          {item.author && (
            <span className="sys-label">BY {item.author.toUpperCase()}</span>
          )}
          {item.readTime && (
            <span className="sys-label flex items-center gap-1">
              <Clock size={9} />
              {item.readTime} MIN
            </span>
          )}
        </div>

        {/* Title */}
        <h2 className="mb-1 font-syne text-lg font-black leading-tight text-primary transition-colors group-hover:text-white">
          {item.title}
        </h2>
        {item.subtitle && (
          <p className="mb-2 font-mono text-xs text-secondary">{item.subtitle}</p>
        )}

        {/* Excerpt */}
        {item.excerpt && (
          <p className="mb-3 font-grotesk text-sm leading-relaxed text-secondary line-clamp-2">
            {item.excerpt}
          </p>
        )}

        {/* Tags / genres */}
        <div className="flex flex-wrap items-center gap-2">
          {genres.map((g) => (
            <span
              key={g}
              className="font-mono text-[9px] tracking-wide"
              style={{ color: vibeColor }}
            >
              [{g}]
            </span>
          ))}
          {tags.map((t) => (
            <span key={t} className="sys-label border border-border px-1.5 py-0.5">
              {t}
            </span>
          ))}
          <span className="ml-auto font-mono text-[10px] text-muted transition-colors group-hover:text-secondary">
            LEER →
          </span>
        </div>
      </div>
    </article>
  )
}
