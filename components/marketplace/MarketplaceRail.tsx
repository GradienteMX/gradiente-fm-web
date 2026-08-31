import Link from 'next/link'
import type { ContentItem } from '@/lib/types'
import { SmartImage } from '@/components/SmartImage'

// ── MERCADO · CATÁLOGO — home-page marketplace entry («EL PLIEGO» fase B) ───
//
// Mounted directly below the FranjasRail in the right column. Product-forward:
// a 3×2 grid of real listing portadas (ink-ground cells, deep-linking to the
// listing on /marketplace) instead of the old text rows. Per-franja
// availability moves to a mono footer line; the CTA keeps /marketplace.
//
// Receives franjas from the home page server prefetch (real DB) so newly
// approved franjas appear on the next render. Renders nothing until at least
// one franja is marketplace-enabled (no empty rail in the bare seed state).
// When the rail franjas' listings carry no images at all, the body falls back
// to paper text rows — never invented imagery.

const MAX_RAIL = 3
const MAX_TILES = 6

const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function MarketplaceRail({ franjas }: { franjas: ContentItem[] }) {
  // Render nothing until at least one franja is approved — keeps the home
  // page from showing an empty rail in the bare seed state.
  if (franjas.length === 0) return null

  // Pick the most-stocked franjas for the rail; full catalog is one click
  // away via the CTA. Sort matches MarketplaceCatalog default.
  const rail = [...franjas]
    .sort((a, b) => {
      const ac = a.marketplaceListings?.length ?? 0
      const bc = b.marketplaceListings?.length ?? 0
      if (bc !== ac) return bc - ac
      return a.title.localeCompare(b.title)
    })
    .slice(0, MAX_RAIL)

  // Product tiles — real portadas only (first image = portada convention).
  // Available pieces first (stable sort keeps franja order inside each band).
  const tiles = rail
    .flatMap((p) =>
      (p.marketplaceListings ?? [])
        .filter((l) => Boolean(l.images[0]))
        .map((l) => ({
          key: `${p.id}-${l.id}`,
          src: l.images[0],
          title: l.title,
          franjaSlug: p.slug,
          listingId: l.id,
          available: l.status === 'available',
        })),
    )
    .sort((a, b) => Number(b.available) - Number(a.available))
    .slice(0, MAX_TILES)

  // Per-franja availability — the old row-level «NN/NN DISP», as one footer
  // line. Counts only when > 0: zero-listing franjas contribute no segment.
  const dispLine = rail
    .filter((p) => (p.marketplaceListings?.length ?? 0) > 0)
    .map((p) => {
      const total = p.marketplaceListings?.length ?? 0
      const available =
        p.marketplaceListings?.filter((l) => l.status === 'available').length ?? 0
      return `${p.title.toUpperCase()} ${pad(available)}/${pad(total)} DISP`
    })
    .join(' · ')

  return (
    <section
      aria-label="Marketplace"
      className="border border-ink bg-paper-raised"
    >
      <header className="flex items-baseline justify-between gap-2 border-b border-ink px-3 py-2">
        <h2 className="font-mono text-d11 font-bold uppercase tracking-widest text-ink">
          MERCADO · CATÁLOGO
        </h2>
        {/* Count — franjas.length > 0 is guaranteed here (early null). */}
        <span className="font-mono text-d11 uppercase tracking-widest text-ink-soft tabular-nums">
          {pad(franjas.length)} ACTIVOS
        </span>
      </header>

      {tiles.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2 p-3">
          {tiles.map((t) => (
            <li key={t.key}>
              <Link
                href={`/marketplace?franja=${encodeURIComponent(t.franjaSlug)}&listing=${encodeURIComponent(t.listingId)}`}
                aria-label={`Ver ${t.title} en el mercado`}
                className={`relative block aspect-square overflow-hidden border border-ink bg-panel ${FOCUS_RING}`}
              >
                <SmartImage src={t.src} alt="" sizes="80px" className="object-cover" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        // No listing images among the rail franjas — honest fallback: paper
        // text rows (franja name + logo thumb), availability stays below.
        <ul className="flex flex-col gap-2 p-3">
          {rail.map((p) => (
            <li key={p.id}>
              <Link
                href={`/marketplace?franja=${encodeURIComponent(p.slug)}`}
                className={`group flex min-h-11 items-center gap-2 border border-ink bg-paper p-1.5 transition-colors hover:bg-ink ${FOCUS_RING}`}
              >
                <span className="relative block h-8 w-8 shrink-0 overflow-hidden border border-ink bg-panel">
                  {p.imageUrl ? (
                    <SmartImage src={p.imageUrl} alt="" sizes="32px" className="object-contain p-0.5" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-mono text-d11 font-bold uppercase text-panel-text">
                      {p.title.slice(0, 2)}
                    </span>
                  )}
                </span>
                <span className="truncate font-grotesk text-d13 font-bold text-ink transition-colors group-hover:text-paper">
                  {p.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Availability line — mono, declarative, tabular. Omitted entirely
          when no rail franja has listings yet. */}
      {dispLine.length > 0 && (
        <p className="border-t border-ink px-3 py-2 font-mono text-d11 uppercase tracking-widest text-ink-soft tabular-nums">
          {dispLine}
        </p>
      )}

      <Link
        href="/marketplace"
        className={`flex min-h-11 items-center justify-between gap-2 border-t border-ink px-3 font-mono text-d11 font-bold uppercase tracking-widest text-ink transition-colors hover:bg-ink hover:text-paper ${FOCUS_RING}`}
      >
        <span>IR AL MERCADO</span>
        <span aria-hidden>→</span>
      </Link>
    </section>
  )
}
