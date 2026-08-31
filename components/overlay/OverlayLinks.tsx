import type { EntityLink } from '@/lib/types'

// Shared "ENLACES" block — the item's outbound CONTEXTO links rendered as
// external anchors. Used by the overlays whose metadata/CONTEXTO grids can't
// cleanly host a <dl> row (Mix/Listicle/Evento/Articulo); it's a self-contained
// labeled block, so it doesn't depend on the parent grid's column count.
// ReaderOverlay keeps its own dl-native LinkRow. Renders null when no link has
// both a label and a url, so a half-filled draft never emits a dead anchor.
//
// Fase C («EL PLIEGO»): printed on paper — mono d11 header on a hairline,
// anchors as bordered ink chips with fill-inversion hover and the ↗ house
// glyph. Hue is never a signal here, so the legacy `color` prop is accepted
// (call-site compatibility while every overlay converts) but unused.
export function OverlayLinks({
  links,
}: {
  links?: EntityLink[]
  // Legacy accent from pre-paper callers — intentionally ignored on paper.
  color?: string
}) {
  const valid = (links ?? []).filter((l) => l.url?.trim() && l.label?.trim())
  if (valid.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5">
      <span className="border-b border-ink-faint pb-1 font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
        ENLACES
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {valid.map((l, i) => (
          <a
            key={`${l.url}-${i}`}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 border border-ink px-2 py-1 font-mono text-d11 text-ink transition-colors hover:bg-ink hover:text-paper-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2"
          >
            {l.label}
            <span aria-hidden>↗</span>
          </a>
        ))}
      </div>
    </div>
  )
}
