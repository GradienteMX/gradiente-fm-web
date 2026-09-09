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
    <aside data-mapa-ui aria-label={`${p.title}, franja enfocada, ${count} publicaciones en el mapa`}
      className="group/obi pointer-events-auto absolute bottom-[76px] left-4 top-[180px] z-30 flex w-[192px] cursor-auto flex-col border border-ink/40 bg-paper-raised text-ink shadow-[3px_3px_0_0_#11111120] animate-fade-in motion-reduce:animate-none">
      <div className="flex shrink-0 items-center justify-between border-b border-ink/20 px-3 py-1">
        <span className="font-mono text-[9px] tracking-widest">// FRANJA · {kind}</span>
        <button type="button" onClick={onZoomGlobal} aria-label="Cerrar enfoque de franja" className="p-2 hover:bg-ink hover:text-paper"><X size={14} /></button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-hidden px-3 py-3">
        {p.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.imageUrl} alt={`Logo de ${p.title}`} className="h-10 w-10 shrink-0 border border-ink/20 object-cover" />
        )}
        <div className="flex min-h-0 flex-1 items-center justify-center gap-2 self-stretch overflow-hidden group-has-[[open]]/obi:hidden">
          <div aria-hidden className="flex shrink-0 flex-col items-center gap-3">
            {katakana && <span className="font-mono text-[11px] tracking-[0.2em] [writing-mode:vertical-rl]">{katakana}</span>}
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sys-red-paper font-mono text-[10px] text-paper">//</span>
          </div>
          <svg role="img" aria-label={p.title} viewBox="0 0 60 320" className="h-full min-h-0 w-16 overflow-visible">
            <text x="0" y="0" transform="translate(14 2) rotate(90)" textLength="310" lengthAdjust="spacingAndGlyphs" className="fill-ink font-syne text-[44px] font-extrabold uppercase">{p.title}</text>
          </svg>
        </div>
      </div>
      <details className="shrink-0 border-t border-ink/20 px-3 text-[10px]">
        <summary className="cursor-pointer py-2 font-mono tracking-wider">FICHA · {count} PIEZAS</summary>
        <div className="max-h-[18dvh] space-y-2 overflow-y-auto pb-3 font-mono">
          {location && <p>{location}</p>}
          {p.franjaUrl && <a href={p.franjaUrl} target="_blank" rel="noopener noreferrer" className="block truncate font-bold underline underline-offset-4">{contactLabel(p.franjaUrl)}</a>}
          {p.verified && <p className="text-sys-red-paper">■ VERIFICADO</p>}
          <dl>{contextRows.map((r) => <div key={r.label}><dt className="font-bold">{r.label}</dt><dd>{r.value}</dd></div>)}</dl>
          <div className="flex flex-wrap gap-1">{socialUrls.map((url) => <a key={url} href={url} target="_blank" rel="noopener noreferrer" aria-label={`${p.title} en ${platformOf(url)}`} className="flex h-8 w-8 items-center justify-center border border-ink hover:bg-ink hover:text-paper"><SocialIcon platform={platformOf(url)} /></a>)}</div>
        </div>
      </details>
      {relatedFranjas.length > 0 && <div className="flex shrink-0 items-center gap-1 border-t border-ink/20 px-2 py-1">
        <button type="button" aria-label="Franja afín anterior" onClick={() => onFocusFranja(relatedFranjas[relatedFranjas.length - 1].slug)} className="h-8 w-7 shrink-0 border border-ink/40 hover:bg-ink hover:text-paper">‹</button>
        <button type="button" onClick={() => onFocusFranja(relatedFranjas[0].slug)} className="min-w-0 flex-1 truncate py-2 font-mono text-[9px]" title={`Explorar ${relatedFranjas[0].title}`}>{relatedFranjas[0].title.toUpperCase()}</button>
        <button type="button" aria-label="Siguiente franja afín" onClick={() => onFocusFranja(relatedFranjas[0].slug)} className="h-8 w-7 shrink-0 border border-ink/40 hover:bg-ink hover:text-paper">›</button>
      </div>}
      <div className="flex shrink-0 flex-col gap-1.5 border-t border-ink/20 p-2">
        <Link href={`/f/${p.slug}`} className="border border-ink bg-acid px-2 py-2 font-mono text-[10px] font-bold hover:bg-ink hover:text-paper">ENTRAR AL DOSSIER ↗</Link>
        <button type="button" onClick={onZoomGlobal} className="border border-ink px-2 py-2 text-left font-mono text-[10px] hover:bg-ink hover:text-paper">SALIR DEL ENFOQUE</button>
      </div>
    </aside>
  )
}
