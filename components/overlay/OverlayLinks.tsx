import { ExternalLink } from 'lucide-react'
import type { EntityLink } from '@/lib/types'

// Shared "ENLACES" block — the item's outbound CONTEXTO links rendered as
// external anchors. Used by the overlays whose metadata/CONTEXTO grids can't
// cleanly host a <dl> row (Mix/Listicle/Evento/Articulo); it's a self-contained
// labeled block, so it doesn't depend on the parent grid's column count.
// ReaderOverlay keeps its own dl-native LinkRow. Renders null when no link has
// both a label and a url, so a half-filled draft never emits a dead anchor.
export function OverlayLinks({
  links,
  color,
}: {
  links?: EntityLink[]
  color: string
}) {
  const valid = (links ?? []).filter((l) => l.url?.trim() && l.label?.trim())
  if (valid.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5">
      <span className="sys-label">ENLACES</span>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-xs">
        {valid.map((l, i) => (
          <a
            key={`${l.url}-${i}`}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline-offset-2 transition-opacity hover:underline hover:opacity-80"
            style={{ color }}
          >
            {l.label}
            <ExternalLink size={10} aria-hidden />
          </a>
        ))}
      </div>
    </div>
  )
}
