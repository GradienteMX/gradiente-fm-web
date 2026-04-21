import type { ContentItem, ContentType } from '@/lib/types'
import { categoryColor } from '@/lib/utils'

const CATEGORIES: { type: ContentType; label: string; href: string }[] = [
  { type: 'evento',    label: 'EVENTO',    href: '/agenda' },
  { type: 'mix',       label: 'MIX',       href: '/mixes' },
  { type: 'review',    label: 'REVIEW',    href: '/reviews' },
  { type: 'editorial', label: 'EDITORIAL', href: '/editorial' },
  { type: 'noticia',   label: 'NOTICIA',   href: '/noticias' },
  { type: 'opinion',   label: 'OPINIÓN',   href: '/opinion' },
]

interface CategoryRailProps {
  items: ContentItem[]
}

export function CategoryRail({ items }: CategoryRailProps) {
  const counts = items.reduce<Partial<Record<ContentType, number>>>((acc, item) => {
    acc[item.type] = (acc[item.type] ?? 0) + 1
    return acc
  }, {})

  return (
    <aside className="hidden w-[100px] shrink-0 lg:block">
      <div className="sticky top-[105px]">
        <div className="nge-divider mb-3">
          <span className="font-mono text-[9px] tracking-widest text-muted">SECCIÓN</span>
        </div>
        <nav className="flex flex-col gap-0">
          {CATEGORIES.map(({ type, label, href }) => {
            const count = counts[type] ?? 0
            const color = categoryColor(type)
            return (
              <a
                key={type}
                href={href}
                className="group flex items-center justify-between border-b border-border/40 py-2 transition-colors hover:bg-surface"
              >
                <span
                  className="font-mono text-[9px] tracking-widest transition-colors"
                  style={{ color }}
                >
                  //{label}
                </span>
                <span className="font-mono text-[9px] text-muted group-hover:text-secondary">
                  {count}
                </span>
              </a>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
