import type { ContentItem } from '@/lib/types'
import { vibeToColor } from '@/lib/utils'
import { getGenreNames } from '@/lib/genres'
import { fmtDateShort } from '@/lib/utils'
import { Play } from 'lucide-react'

interface MixCardProps {
  item: ContentItem
}

export function MixCard({ item }: MixCardProps) {
  const vibeColor = vibeToColor(item.vibe)
  const genres = getGenreNames(item.genres).slice(0, 3)

  return (
    <article className="group relative border border-border bg-surface transition-colors hover:border-secondary hover:bg-elevated">
      {/* Top accent stripe — vibe colored */}
      <div className="h-0.5 w-full" style={{ backgroundColor: vibeColor }} />

      <div className="flex items-stretch gap-0">
        {/* Play zone */}
        <a
          href={item.mixUrl ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-14 flex-shrink-0 items-center justify-center border-r border-border transition-colors hover:bg-elevated"
        >
          <div
            className="flex h-8 w-8 items-center justify-center border"
            style={{ borderColor: vibeColor, color: vibeColor }}
          >
            <Play size={14} fill="currentColor" />
          </div>
        </a>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-4 py-3">
          {/* Header row */}
          <div className="flex items-center gap-2">
            <span className="sys-label text-muted">//MIX</span>
            {item.editorial && (
              <span className="sys-label" style={{ color: vibeColor }}>
                //EDITORIAL
              </span>
            )}
          </div>

          {/* Title + artist */}
          <div>
            <h2 className="font-syne text-base font-black leading-tight text-primary">
              {item.title}
            </h2>
            {item.subtitle && (
              <p className="font-mono text-xs text-secondary">{item.subtitle}</p>
            )}
          </div>

          {/* Fake waveform */}
          <div className="flex h-4 items-end gap-px opacity-60">
            {Array.from({ length: 32 }, (_, i) => {
              const h = Math.sin(i * 0.7 + item.vibe) * 0.4 + 0.6
              return (
                <div
                  key={i}
                  className="w-px flex-1 rounded-none"
                  style={{
                    height: `${Math.max(15, Math.round(h * 100))}%`,
                    backgroundColor: vibeColor,
                    opacity: i % 4 === 0 ? 1 : 0.5,
                  }}
                />
              )
            })}
          </div>

          {/* Meta row */}
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-1">
              {genres.map((g) => (
                <span
                  key={g}
                  className="font-mono text-[9px] tracking-wide"
                  style={{ color: vibeColor }}
                >
                  {g}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3">
              {item.publishedAt && (
                <span className="sys-label">{fmtDateShort(item.publishedAt)}</span>
              )}
              {item.duration && (
                <span className="font-mono text-[10px] text-secondary">{item.duration}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
