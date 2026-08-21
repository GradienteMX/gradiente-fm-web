'use client'

// Spatial Identity Canvas — partner identity strip (obi).
// Modeled on a Japanese vinyl obi for the Club Japan concept: a narrow paper
// band along the left edge of the focused viewport. Identity is CONTEXTUAL
// CHROME — it never consumes honeycomb cells and contains no category
// navigation (spec § Identity strip).

import Link from 'next/link'
import { X } from 'lucide-react'
import type { PartnerCluster } from '@/lib/mapa/layout'
import { KIND_LABEL } from '@/components/overlay/PartnerOverlay'

// Partner-customizable template accents within the controlled Gradiente
// template (spec allows per-partner skinning). Presentation-only strings —
// not content, not data.
const OBI_ACCENTS: Record<string, { vertical?: string }> = {
  'club-japan': { vertical: 'クラブ・ジャパン' },
}

// Derive a display label for the partner's contact link from real data.
// instagram.com/<handle> → @HANDLE; anything else → bare hostname.
function contactLabel(url: string): string {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'instagram.com') {
      const handle = u.pathname.split('/').filter(Boolean)[0]
      if (handle) return `@${handle.toUpperCase()}`
    }
    return host.toUpperCase()
  } catch {
    return url
  }
}

export interface PartnerObiProps {
  cluster: PartnerCluster
  /** Other clustered identities, most affine first — the carousel order. */
  relatedPartners: { slug: string; title: string }[]
  onFocusPartner: (slug: string) => void
  onZoomGlobal: () => void
}

export function PartnerObi({
  cluster,
  relatedPartners,
  onFocusPartner,
  onZoomGlobal,
}: PartnerObiProps) {
  const p = cluster.partner
  const accent = OBI_ACCENTS[p.slug]
  const kind = p.partnerKind ? KIND_LABEL[p.partnerKind] : 'PARTNER'
  const location = p.marketplaceLocation ?? p.subtitle ?? null
  // Venues program per event — honest template copy, not fabricated data.
  const schedule = p.partnerKind === 'venue' ? 'HORARIO SEGÚN EVENTO' : null
  const description = p.excerpt ?? null
  const count = cluster.itemIds.length

  return (
    <aside
      data-mapa-ui
      aria-label={`${p.title}, partner enfocado, ${count} publicaciones en el mapa`}
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-30 flex max-h-[42dvh] flex-col overflow-y-auto bg-[#EDE6D4] text-[#111111] shadow-[0_-8px_40px_rgba(0,0,0,0.6)] lg:inset-x-auto lg:bottom-0 lg:left-0 lg:top-0 lg:max-h-none lg:w-[300px] lg:overflow-hidden lg:shadow-[8px_0_40px_rgba(0,0,0,0.6)]"
    >
      {/* Top band — system label + close */}
      <div className="flex items-center justify-between border-b border-[#11111122] px-4 py-2.5">
        <span className="font-mono text-[10px] tracking-[0.16em] text-[#111111]/60">
          {'//PARTNER · '}
          {kind}
        </span>
        <button
          type="button"
          onClick={onZoomGlobal}
          aria-label="Cerrar enfoque de partner"
          className="text-[#111111]/50 transition-colors hover:text-[#111111]"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex flex-1 flex-row gap-4 px-4 py-4 lg:flex-col lg:gap-5 lg:py-5">
        {/* Identity block — logo + vertical wordmark (desktop) */}
        <div className="flex shrink-0 items-start gap-3 lg:h-[38%] lg:gap-4">
          {p.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.imageUrl}
              alt={`Logo de ${p.title}`}
              className="h-14 w-14 border border-[#11111133] object-cover lg:h-16 lg:w-16"
            />
          )}
          <div className="flex min-w-0 items-start gap-2">
            <h2 className="font-syne text-2xl font-extrabold uppercase leading-none tracking-tight lg:text-[26px] lg:[writing-mode:vertical-rl]">
              {p.title}
            </h2>
            {accent?.vertical && (
              <span
                aria-hidden
                className="mt-0.5 font-mono text-[11px] tracking-[0.3em] text-[#111111]/55 lg:[writing-mode:vertical-rl]"
              >
                {accent.vertical}
              </span>
            )}
            {/* Red seal — Gradiente template mark */}
            <span
              aria-hidden
              className="ml-1 mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center border-2 border-[#C41E1E] font-mono text-[10px] font-bold text-[#C41E1E]"
            >
              {'//'}
            </span>
          </div>
        </div>

        {/* Data block */}
        <div className="flex min-w-0 flex-1 flex-col gap-2.5 font-mono text-[11px] leading-relaxed text-[#111111]/85">
          {p.verified && (
            <p className="tracking-[0.14em] text-[#C41E1E]">■ VERIFICADO</p>
          )}
          {description && (
            <p className="font-grotesk text-[12.5px] leading-snug text-[#111111]/80">
              {description}
            </p>
          )}
          <dl className="flex flex-col gap-1.5">
            {location && (
              <div className="flex gap-2">
                <dt className="shrink-0 text-[#111111]/45">UBICACIÓN</dt>
                <dd className="uppercase">{location}</dd>
              </div>
            )}
            {schedule && (
              <div className="flex gap-2">
                <dt className="shrink-0 text-[#111111]/45">HORARIO</dt>
                <dd>{schedule}</dd>
              </div>
            )}
            {p.partnerUrl && (
              <div className="flex gap-2">
                <dt className="shrink-0 text-[#111111]/45">CONTACTO</dt>
                <dd>
                  <a
                    href={p.partnerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-[#11111144] underline-offset-2 hover:text-[#C41E1E]"
                  >
                    {contactLabel(p.partnerUrl)}
                  </a>
                </dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="shrink-0 text-[#111111]/45">EN EL MAPA</dt>
              <dd>
                {count} {count === 1 ? 'PUBLICACIÓN' : 'PUBLICACIONES'}
              </dd>
            </div>
          </dl>
        </div>

        {/* Affine-partner carousel — ‹ › steps through the other clustered
            identities by content affinity to this one. Navigation between
            focus states, camera glides across the shared terrain. */}
        {relatedPartners.length > 0 && (
          <div className="flex shrink-0 flex-col gap-1.5">
            <span className="font-mono text-[9px] tracking-[0.18em] text-[#111111]/45">
              {'//'}PARTNERS AFINES
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Partner afín anterior"
                onClick={() =>
                  onFocusPartner(
                    relatedPartners[relatedPartners.length - 1].slug,
                  )
                }
                className="border border-[#11111155] px-2 py-1 font-mono text-[10px] text-[#111111]/70 transition-colors hover:border-[#111111] hover:text-[#111111]"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => onFocusPartner(relatedPartners[0].slug)}
                className="min-w-0 flex-1 truncate border border-[#11111155] px-2 py-1 text-center font-mono text-[10px] tracking-[0.12em] text-[#111111]/80 transition-colors hover:border-[#111111] hover:text-[#111111]"
              >
                {relatedPartners[0].title.toUpperCase()}
              </button>
              <button
                type="button"
                aria-label="Siguiente partner afín"
                onClick={() => onFocusPartner(relatedPartners[0].slug)}
                className="border border-[#11111155] px-2 py-1 font-mono text-[10px] text-[#111111]/70 transition-colors hover:border-[#111111] hover:text-[#111111]"
              >
                ›
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex shrink-0 flex-col justify-end gap-2 lg:mt-auto">
          <Link
            href={`/p/${p.slug}`}
            className="border border-[#111111] px-3 py-2 text-center font-mono text-[10px] tracking-[0.16em] text-[#111111] transition-colors hover:bg-[#111111] hover:text-[#EDE6D4]"
          >
            ENTRAR AL DOSSIER →
          </Link>
          <button
            type="button"
            onClick={onZoomGlobal}
            className="border border-[#11111155] px-3 py-2 font-mono text-[10px] tracking-[0.16em] text-[#111111]/70 transition-colors hover:border-[#111111] hover:text-[#111111]"
          >
            − ZOOM GLOBAL
          </button>
        </div>
      </div>
    </aside>
  )
}
