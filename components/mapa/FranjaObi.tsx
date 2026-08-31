'use client'

// Spatial Identity Canvas — franja identity strip (obi).
// Modeled on a Japanese vinyl obi (reference: the Club Japan obi mock,
// 2026-08-20): aged-paper band, large logo up top, a dominant VERTICAL
// wordmark flanked by ornamental katakana and a red seal, then the info
// block — name, address, contextual per-kind data, contact handle and a
// social-icon row. Identity is CONTEXTUAL CHROME — it never consumes
// honeycomb cells and contains no category navigation (spec § Identity
// strip). All data rows are real fields; nothing decorative pretends to be
// data (the katakana + seal are explicitly ornament).

import Link from 'next/link'
import { Facebook, Globe, Instagram, X, Youtube } from 'lucide-react'
import type { ContentItem } from '@/lib/types'
import type { FranjaCluster } from '@/lib/mapa/layout'
import { KIND_LABEL } from '@/components/overlay/FranjaOverlay'
import { fmtDateShort } from '@/lib/utils'

const PAPER = '#EDE6D4'
const INK = '#111111'
const SEAL = '#C41E1E'

// Franja-customizable ornament within the controlled Gradiente template
// (spec allows per-franja skinning). Presentation-only strings — not
// content, not data.
const OBI_KATAKANA: Record<string, string> = {
  'club-japan': 'クラブ・ジャパン',
  'noche-negra': 'ノーチェ・ネグラ',
  naafi: 'ナーフィ',
}

// Kind-derived ornamental fallback so every franja wears the obi's
// Japanese accent even without a bespoke transliteration.
const KIND_KATAKANA: Record<string, string> = {
  venue: 'クラブ',
  club: 'クラブ',
  promoter: 'プロモーター',
  label: 'レーベル',
  colectivo: 'コレクティボ',
  festival: 'フェスティバル',
  dealer: 'ディーラー',
  medios: 'メディア',
  'mix-series': 'ミックス',
  plataforma: 'プラットフォーム',
}

// Derive a display label for the franja's contact link from real data.
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

// Social platform detection for the icon row — from the franja's real
// links (ContentItem.links) + franjaUrl, deduped by URL.
type SocialPlatform =
  | 'instagram'
  | 'x'
  | 'youtube'
  | 'facebook'
  | 'soundcloud'
  | 'bandcamp'
  | 'mixcloud'
  | 'web'

function platformOf(url: string): SocialPlatform {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (host.includes('instagram.com')) return 'instagram'
    if (host === 'x.com' || host.includes('twitter.com')) return 'x'
    if (host.includes('youtube.com') || host === 'youtu.be') return 'youtube'
    if (host.includes('facebook.com')) return 'facebook'
    if (host.includes('soundcloud.com')) return 'soundcloud'
    if (host.includes('bandcamp.com')) return 'bandcamp'
    if (host.includes('mixcloud.com')) return 'mixcloud'
    return 'web'
  } catch {
    return 'web'
  }
}

function SocialIcon({ platform }: { platform: SocialPlatform }) {
  const cls = 'h-[15px] w-[15px]'
  switch (platform) {
    case 'instagram':
      return <Instagram className={cls} strokeWidth={1.8} />
    case 'x':
      return <X className={cls} strokeWidth={2.2} />
    case 'youtube':
      return <Youtube className={cls} strokeWidth={1.8} />
    case 'facebook':
      return <Facebook className={cls} strokeWidth={1.8} />
    case 'soundcloud':
      return <span className="font-mono text-[8px] font-bold tracking-tight">SC</span>
    case 'bandcamp':
      return <span className="font-mono text-[8px] font-bold tracking-tight">BC</span>
    case 'mixcloud':
      return <span className="font-mono text-[8px] font-bold tracking-tight">MC</span>
    case 'web':
      return <Globe className={cls} strokeWidth={1.8} />
  }
}

export interface FranjaObiProps {
  cluster: FranjaCluster
  /** The focused franja's member items — contextual per-kind data source. */
  items: ContentItem[]
  /** Other clustered identities, most affine first — the carousel order. */
  relatedFranjas: { slug: string; title: string }[]
  onFocusFranja: (slug: string) => void
  onZoomGlobal: () => void
}

export function FranjaObi({
  cluster,
  items,
  relatedFranjas,
  onFocusFranja,
  onZoomGlobal,
}: FranjaObiProps) {
  const p = cluster.franja
  const kind = p.franjaKind ? KIND_LABEL[p.franjaKind] : 'FRANJA'
  const katakana =
    OBI_KATAKANA[p.slug] ??
    (p.franjaKind ? KIND_KATAKANA[p.franjaKind] : undefined)
  const location = p.marketplaceLocation ?? p.subtitle ?? null
  const count = cluster.itemIds.length

  // ── Contextual rows per franja kind — all from real member data ─────────
  const eventos = items
    .filter((i) => i.type === 'evento' && i.date)
    .sort((a, b) => (a.date! < b.date! ? -1 : 1))
  const nowMs = Date.now()
  const upcoming = eventos.find(
    (e) => new Date(e.endDate ?? e.date!).getTime() >= nowMs,
  )
  const latestPast = [...eventos]
    .reverse()
    .find((e) => new Date(e.date!).getTime() < nowMs)
  const isVenue = p.franjaKind === 'venue' || p.franjaKind === 'club'
  const isPromoter =
    p.franjaKind === 'promoter' ||
    p.franjaKind === 'colectivo' ||
    p.franjaKind === 'festival'
  const listingsCount = p.marketplaceEnabled
    ? p.marketplaceListings?.length ?? 0
    : 0

  const contextRows: { label: string; value: string }[] = []
  if (isVenue) contextRows.push({ label: 'HORARIO', value: 'SEGÚN EVENTO' })
  if ((isVenue || isPromoter) && upcoming) {
    contextRows.push({
      label: 'PRÓXIMA',
      value: [fmtDateShort(upcoming.date!), upcoming.venue]
        .filter(Boolean)
        .join(' · '),
    })
  } else if (isPromoter && latestPast) {
    contextRows.push({
      label: 'ÚLTIMA',
      value: [fmtDateShort(latestPast.date!), latestPast.venue]
        .filter(Boolean)
        .join(' · '),
    })
  }
  if (listingsCount > 0) {
    contextRows.push({
      label: 'MERCADO',
      value: `${listingsCount} ${listingsCount === 1 ? 'ARTÍCULO' : 'ARTÍCULOS'} EN VENTA`,
    })
  }

  // Socials: real links + franjaUrl, deduped by URL.
  const socialUrls = [
    ...(p.links ?? []).map((l) => l.url),
    ...(p.franjaUrl ? [p.franjaUrl] : []),
  ].filter((url, i, arr) => arr.indexOf(url) === i)

  return (
    <aside
      data-mapa-ui
      aria-label={`${p.title}, franja enfocado, ${count} publicaciones en el mapa`}
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-30 flex max-h-[46dvh] flex-col overflow-y-auto shadow-[0_-8px_40px_rgba(0,0,0,0.6)] lg:inset-x-auto lg:bottom-0 lg:left-0 lg:top-0 lg:max-h-none lg:w-[300px] lg:overflow-y-auto lg:shadow-[8px_0_40px_rgba(0,0,0,0.6)]"
      style={{ backgroundColor: PAPER, color: INK }}
    >
      {/* Top band — system label + close */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#11111122] px-4 py-2.5">
        <span className="font-mono text-[10px] tracking-[0.16em] text-[#111111]/60">
          {'//FRANJA · '}
          {kind}
        </span>
        <button
          type="button"
          onClick={onZoomGlobal}
          aria-label="Cerrar enfoque de franja"
          className="font-mono text-[13px] leading-none text-[#111111]/50 transition-colors hover:text-[#111111]"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-5 py-4 lg:gap-5 lg:py-6">
        {/* ── Logo — large, the obi's printed mark ── */}
        {p.imageUrl && (
          <div className="flex shrink-0 justify-center lg:pt-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.imageUrl}
              alt={`Logo de ${p.title}`}
              className="h-20 w-20 border border-[#11111126] object-cover lg:h-24 lg:w-24"
            />
          </div>
        )}

        {/* ── Vertical hero — katakana + seal + dominant wordmark ──
            Desktop only: the vertical writing needs the strip's height. */}
        <div className="hidden min-h-0 flex-1 items-start justify-center gap-3 overflow-hidden lg:flex">
          <div className="flex flex-col items-center gap-3">
            {katakana && (
              <span
                aria-hidden
                className="font-mono text-[13px] leading-none tracking-[0.28em] text-[#111111]/55 [writing-mode:vertical-rl]"
              >
                {katakana}
              </span>
            )}
            {/* Red seal — Gradiente template mark (hanko ornament) */}
            <span
              aria-hidden
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold leading-none"
              style={{ backgroundColor: SEAL, color: PAPER }}
            >
              {'//'}
            </span>
          </div>
          <h2 className="max-h-full font-syne text-[44px] font-extrabold uppercase leading-[0.9] tracking-tight [writing-mode:vertical-rl]">
            {p.title}
          </h2>
        </div>

        {/* Mobile identity row — horizontal wordmark + inline ornament */}
        <div className="flex items-center gap-3 lg:hidden">
          <h2 className="min-w-0 flex-1 font-syne text-2xl font-extrabold uppercase leading-none tracking-tight">
            {p.title}
          </h2>
          {katakana && (
            <span
              aria-hidden
              className="shrink-0 font-mono text-[11px] tracking-[0.24em] text-[#111111]/55"
            >
              {katakana}
            </span>
          )}
          <span
            aria-hidden
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold leading-none"
            style={{ backgroundColor: SEAL, color: PAPER }}
          >
            {'//'}
          </span>
        </div>

        {/* ── Info block — name, address, contextual data, contact ── */}
        <div className="flex shrink-0 flex-col gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-mono text-[15px] font-bold tracking-[0.14em]">
              {p.title.toUpperCase()}
            </h3>
            {p.verified && (
              <span
                className="font-mono text-[9px] tracking-[0.14em]"
                style={{ color: SEAL }}
              >
                ■ VERIFICADO
              </span>
            )}
          </div>

          {location && (
            <div className="flex flex-col font-mono text-[12px] font-bold uppercase leading-relaxed tracking-[0.1em] text-[#111111]/85">
              {location.split(/\s*[,·]\s*/).map((line) => (
                <span key={line}>{line}</span>
              ))}
            </div>
          )}

          <dl className="flex flex-col gap-1 font-mono text-[11px] leading-relaxed">
            {contextRows.map((row) => (
              <div key={row.label} className="flex flex-col">
                <dt className="font-bold tracking-[0.14em] text-[#111111]/85">
                  {row.label}
                </dt>
                <dd className="uppercase tracking-[0.06em] text-[#111111]/65">
                  {row.value}
                </dd>
              </div>
            ))}
            <div className="flex flex-col">
              <dt className="font-bold tracking-[0.14em] text-[#111111]/85">
                EN EL MAPA
              </dt>
              <dd className="uppercase tracking-[0.06em] text-[#111111]/65">
                {count} {count === 1 ? 'PUBLICACIÓN' : 'PUBLICACIONES'}
              </dd>
            </div>
          </dl>

          {p.franjaUrl && (
            <a
              href={p.franjaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-fit font-mono text-[13px] font-bold tracking-[0.12em] underline decoration-[#11111133] underline-offset-4 transition-colors hover:text-[#C41E1E]"
            >
              {contactLabel(p.franjaUrl)}
            </a>
          )}

          {/* Social icon row — rounded ink chips, one per real link */}
          {socialUrls.length > 0 && (
            <div className="flex items-center gap-2">
              {socialUrls.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${p.title} en ${platformOf(url)}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition-opacity hover:opacity-70"
                  style={{ backgroundColor: INK, color: PAPER }}
                >
                  <SocialIcon platform={platformOf(url)} />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Affine-franja carousel — ‹ › steps through the other clustered
            identities by content affinity to this one. */}
        {relatedFranjas.length > 0 && (
          <div className="flex shrink-0 flex-col gap-1.5">
            <span className="font-mono text-[9px] tracking-[0.18em] text-[#111111]/45">
              {'//'}FRANJAS AFINES
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Franja afín anterior"
                onClick={() =>
                  onFocusFranja(
                    relatedFranjas[relatedFranjas.length - 1].slug,
                  )
                }
                className="border border-[#11111155] px-2 py-1 font-mono text-[10px] text-[#111111]/70 transition-colors hover:border-[#111111] hover:text-[#111111]"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => onFocusFranja(relatedFranjas[0].slug)}
                className="min-w-0 flex-1 truncate border border-[#11111155] px-2 py-1 text-center font-mono text-[10px] tracking-[0.12em] text-[#111111]/80 transition-colors hover:border-[#111111] hover:text-[#111111]"
              >
                {relatedFranjas[0].title.toUpperCase()}
              </button>
              <button
                type="button"
                aria-label="Siguiente franja afín"
                onClick={() => onFocusFranja(relatedFranjas[0].slug)}
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
            href={`/f/${p.slug}`}
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
