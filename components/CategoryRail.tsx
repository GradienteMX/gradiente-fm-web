import type { ContentItem, ContentType } from '@/lib/types'
import { categoryColor } from '@/lib/utils'
import { Waveform } from './Waveform'

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
    <aside className="hidden w-[120px] shrink-0 lg:block">
      <div className="sticky top-[105px] flex flex-col gap-5">
        <div>
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

        {/* ── Waveform HUD — idle trace today, reactive when audio lands ── */}
        <div className="border border-border/60 bg-black/40 p-2">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="font-mono text-[8px] tracking-widest text-sys-orange/70">
              WAVEFORM·10-A
            </span>
            <span className="font-mono text-[7px] tabular-nums text-muted">78.6 Hz</span>
          </div>
          <span className="font-mono text-[7px] tracking-[0.2em] text-muted">
            SUB·FRECUENCIA
          </span>
          <Waveform height={64} className="mt-1" />
          <div className="mt-1 flex items-center justify-between">
            <span className="font-mono text-[7px] text-muted">●○</span>
            <span className="font-mono text-[7px] tabular-nums text-muted">10·F</span>
          </div>
        </div>

        {/* ── ANALIZANDO ESPECTRO — idle subsystem block ── */}
        <div className="border border-border/60 bg-black/40 p-2">
          <span className="font-mono text-[8px] tracking-widest text-sys-orange/70">
            ANALIZANDO·ESPECTRO
          </span>
          <div className="mt-2 h-[40px] relative overflow-hidden">
            <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-full w-full">
              <path
                d="M0,22 C18,10 32,30 50,18 S82,28 100,14"
                fill="none"
                stroke="rgba(255, 102, 0, 0.55)"
                strokeWidth="0.5"
              />
              <path
                d="M0,28 C22,22 40,34 58,24 S86,20 100,26"
                fill="none"
                stroke="rgba(255, 153, 0, 0.25)"
                strokeWidth="0.4"
              />
            </svg>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="font-mono text-[7px] text-muted">▶</span>
            <span className="font-mono text-[7px] tabular-nums text-muted">1·0</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
