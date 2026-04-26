'use client'

import type { ContentItem } from '@/lib/types'
import { categoryColor } from '@/lib/utils'
import { MixOverlay } from '@/components/overlay/MixOverlay'
import { ListicleOverlay } from '@/components/overlay/ListicleOverlay'
import { EventoOverlay } from '@/components/overlay/EventoOverlay'
import { ReaderOverlay } from '@/components/overlay/ReaderOverlay'
import { GenericOverlay } from '@/components/overlay/GenericOverlay'

// Renders a draft ContentItem through its real overlay component inside a
// preview frame — mimics the overlay chrome without taking over the screen.
export function LivePreview({ draft }: { draft: ContentItem }) {
  const color = categoryColor(draft.type)

  return (
    <div className="flex flex-col gap-3">
      {/* Header strip */}
      <div className="flex items-center justify-between border-y border-border py-2">
        <div className="flex items-center gap-3">
          <span
            className="font-mono text-[10px] tracking-widest"
            style={{ color }}
          >
            //PREVIEW
          </span>
          <span className="sys-label text-muted">
            {draft.type.toUpperCase()} · {draft.slug || 'sin-slug'}
          </span>
        </div>
        <span className="font-mono text-[10px] tracking-widest text-sys-green">
          ◉ LIVE
        </span>
      </div>

      {/* Frame */}
      <div
        className="eva-box eva-scanlines relative overflow-hidden bg-base"
        style={{ maxHeight: 'calc(100vh - 240px)' }}
      >
        {/* Chrome header (like OverlayShell) */}
        <div className="flex items-center justify-between gap-4 border-b border-border bg-base/95 px-3 py-2">
          <div className="flex items-center gap-2">
            <span
              className="font-mono text-[10px] tracking-widest"
              style={{ color }}
            >
              //{draft.type.toUpperCase()}
            </span>
            <span className="sys-label hidden truncate uppercase text-muted md:inline">
              {draft.slug || 'sin-slug'}
            </span>
          </div>
          <span className="font-mono text-[9px] tracking-widest text-muted">
            VISTA·PREVIA
          </span>
        </div>

        {/* Scrollable preview content */}
        <div
          className="overflow-y-auto"
          style={{ maxHeight: 'calc(100vh - 300px)' }}
        >
          <PreviewBody draft={draft} />
        </div>
      </div>

      <p className="font-mono text-[10px] leading-relaxed text-muted">
        La vista previa refleja cómo se verá la carta en el overlay real. Los
        controles de audio son visuales (sin reproducción) — eso llega en la
        sesión de audio.
      </p>
    </div>
  )
}

function PreviewBody({ draft }: { draft: ContentItem }) {
  switch (draft.type) {
    case 'mix':
      return <MixOverlay item={draft} />
    case 'listicle':
      return <ListicleOverlay item={draft} />
    case 'evento':
      return <EventoOverlay item={draft} />
    case 'editorial':
    case 'review':
    case 'opinion':
    case 'noticia':
      return <ReaderOverlay item={draft} />
    default:
      return <GenericOverlay item={draft} />
  }
}
