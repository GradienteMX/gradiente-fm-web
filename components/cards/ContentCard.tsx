'use client'

import Link from 'next/link'
import type { ContentItem } from '@/lib/types'
import { vibeToColor, vibeMid, categoryColor, fmtDateShort, fmtDayNumber, fmtMonthShort, fmtDayName, fmtTime, isExpired } from '@/lib/utils'
import { VibeMeter } from '@/components/VibeMeter'
import { getGenreById, getTagNames } from '@/lib/genres'
import { partnerAttributionPrefix } from '@/lib/partnerAttribution'
import { Play, Clock, MapPin, Ticket } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { useOverlay } from '@/components/overlay/useOverlay'
import { useCardTilt, CARD_TILT_PERSPECTIVE_PX } from '@/lib/hooks/useCardTilt'
import { useHeatReport } from '@/lib/hooks/useHeatReport'
import { recordHpEvent } from '@/lib/hpEvents'
import { useAuth } from '@/components/auth/useAuth'
import { currentHp } from '@/lib/curation'
import { GenreChipButton } from '@/components/genre/GenreChipButton'
import { PollCardCanvas } from '@/components/poll/PollCardCanvas'
import { SavedBadge } from './SavedBadge'
import { useDecayState } from '@/lib/hooks/useDecayState'
import { DecayErosion, useDissolveOnUnmount } from './DecayState'

// ── Fresh-published chrome ─────────────────────────────────────────────────
//
// Editor-composed items show a glitch chrome (border pulse, scanline sweep,
// cover flicker, [NUEVO] chip) for the first hour after publish so the new
// content is unmistakable in the feed. Excludes scraped events (source ===
// 'scraper:ra') so the Mon/Wed/Fri scrape batches don't all glitch at once.
const ONE_HOUR_MS = 60 * 60 * 1000
function freshAgeMs(item: ContentItem): number | null {
  if (item.source === 'scraper:ra') return null
  const ms = Date.parse(item.publishedAt)
  if (Number.isNaN(ms)) return null
  return Date.now() - ms
}

// Card-side helper — keeps ids + names paired for click-to-filter chips.
function genreEntries(ids: string[], limit: number) {
  return ids.slice(0, limit).map((id) => ({
    id,
    name: getGenreById(id)?.name ?? id,
  }))
}

export type CardSize = 'sm' | 'md' | 'lg'

// Shared props for the three size variants. imageZStyle/chromeZStyle are the
// tilt parallax depth layers from useCardTilt, threaded through to CardImage.
interface CardVariantProps {
  item: ContentItem
  isFresh: boolean
  mortality: number
  imageZStyle?: CSSProperties
  chromeZStyle?: CSSProperties
}

const TYPE_LABEL: Record<ContentItem['type'], string> = {
  evento: 'EVENTO',
  mix: 'MIX',
  noticia: 'NOTICIA',
  review: 'REVIEW',
  editorial: 'EDITORIAL',
  opinion: 'OPINIÓN',
  articulo: 'ARTÍCULO',
  listicle: 'LISTA',
  partner: 'PARTNER',
}

interface ContentCardProps {
  item: ContentItem
  size?: CardSize
}

// ── Publisher-only HL chip ────────────────────────────────────────────────
//
// Shows the item's current HL bracket on the publisher's OWN cards only —
// never visible to other viewers. Per [[project_user_hp_visibility]]:
// "The publisher's own feed cards show HL. Other viewers see the standard
// card. Per-viewer ternary on auth.uid() = items.created_by."
//
// Bracketed labels (DÉBIL → PLENO) rather than raw numbers — keeps the
// "no visible numeric engagement metrics" rule intact for everyone else
// while giving the publisher a coarse, glanceable read on their post's
// reach. The boundaries are loose; we can tune them as engagement data
// accumulates.
const HL_TIERS: { max: number; label: string; color: string }[] = [
  { max: 5,    label: 'DÉBIL',    color: '#6B7280' },  // dim grey
  { max: 15,   label: 'MODESTO',  color: '#A78BFA' },  // violet
  { max: 30,   label: 'NOTABLE',  color: '#22D3EE' },  // cyan
  { max: 60,   label: 'FUERTE',   color: '#F97316' },  // sys-orange
  { max: Infinity, label: 'PLENO', color: '#F87171' }, // red — heat
]

function hlTier(hp: number): { label: string; color: string } {
  for (const t of HL_TIERS) {
    if (hp < t.max) return { label: t.label, color: t.color }
  }
  return HL_TIERS[HL_TIERS.length - 1]
}

function PublisherHlChip({ item }: { item: ContentItem }) {
  const { currentUser } = useAuth()
  // Three gates: caller must be authed, must be the creator, and the item
  // must have a real createdById (seed items default to undefined). Guards
  // against SSR / pre-hydration leakage — currentUser is null server-side
  // and during the first paint, so the chip only appears post-hydration
  // for the matching viewer.
  if (!currentUser || !item.createdById) return null
  if (currentUser.id !== item.createdById) return null

  const hp = currentHp(item, new Date())
  const { label, color } = hlTier(hp)
  return (
    <span
      className="border bg-black/85 px-1.5 py-1 font-mono text-[10px] tracking-widest backdrop-blur-sm"
      style={{ borderColor: color, color }}
      title={`HL · sólo tú puedes ver esto en tus publicaciones`}
    >
      HL·{label}
    </span>
  )
}

// ── Creator chip ──────────────────────────────────────────────────────────
//
// Renders @username linked to /u/[username]. stopPropagation so the link
// doesn't also trigger the card's overlay-open. Kept distinct from the
// `item.author` byline string — the chip is the actual platform identity,
// while `author` is editorial free-text ("Redacción Espectro", etc.).
function CreatorChip({ item, dim = false }: { item: ContentItem; dim?: boolean }) {
  if (!item.creator) return null
  return (
    <Link
      href={`/u/${item.creator.username}`}
      onClick={(e) => e.stopPropagation()}
      className={`font-mono text-[9px] tracking-wide transition-colors hover:text-sys-orange ${
        dim ? 'text-muted' : 'text-secondary'
      }`}
      title={`Perfil de ${item.creator.displayName}`}
    >
      @{item.creator.username}
    </Link>
  )
}

// ── Partner attribution chip ──────────────────────────────────────────────────
//
// Renders //PRESENTA · CLUB JAPAN (or //SELLO · X, //PROMOTORA · X, etc.) on
// cards whose `partner` field is populated by the server-side self-join. The
// chip is clickable through to the partner's MarketplaceOverlay when the
// partner is marketplace-enabled; non-clickable otherwise (the attribution
// itself does the trust work — the click is a discovery affordance).
//
// stopPropagation on click so the chip's navigation doesn't also trigger the
// card's overlay-open handler.
//
// See wiki/90-Decisions/Partner Authoring.md.
function PartnerAttributionChip({ item }: { item: ContentItem }) {
  // Defensive on partner.title — server mapper occasionally hands back a
  // partial shape (e.g. when the embed returned as an array we couldn't
  // normalize). Skip rendering rather than crash.
  if (!item.partner || !item.partner.title) return null
  const { partner } = item
  const label = `${partnerAttributionPrefix(partner.kind)} · ${partner.title.toUpperCase()}`
  const chipStyle: CSSProperties = {
    borderColor: '#FF8800',
    color: '#FF8800',
    boxShadow: '0 0 6px rgba(255,136,0,0.35)',
  }
  const baseClass =
    'border bg-black/85 px-1.5 py-1 font-mono text-[10px] tracking-widest backdrop-blur-sm'

  if (partner.marketplaceEnabled) {
    return (
      <Link
        href={`/marketplace?partner=${encodeURIComponent(partner.slug)}`}
        onClick={(e) => e.stopPropagation()}
        className={`${baseClass} transition-opacity hover:opacity-80`}
        style={chipStyle}
        title={`Ver perfil de ${partner.title} en marketplace`}
      >
        {label}
      </Link>
    )
  }

  return (
    <span
      className={baseClass}
      style={chipStyle}
      title={`Publicado por ${partner.title}`}
    >
      {label}
    </span>
  )
}

// ── Shared image layer ────────────────────────────────────────────────────────
function CardImage({
  item,
  size,
  isFresh,
  mortality,
  imageZStyle,
  chromeZStyle,
}: {
  item: ContentItem
  size: CardSize
  isFresh: boolean
  mortality: number
  // Parallax depth layers from useCardTilt. The image plane recesses behind the
  // chrome plane so a pointer-tilt reveals depth (panel-under-glass). When tilt
  // is disabled (touch / reduced-motion) these are translateZ(0)-equivalent
  // visually flat — they're harmless no-ops on a non-3D ancestor. Optional so
  // any other caller of CardImage keeps working unchanged.
  imageZStyle?: CSSProperties
  chromeZStyle?: CSSProperties
}) {
  const vibeColor = vibeToColor(vibeMid(item))
  const isDraftOnly = item._draftState === 'draft'
  const typeColor = categoryColor(item.type)

  // Document-mount — archival at-rest treatment (redesign 2026). The flyer
  // rests as a grayscale print tinted by the item's vibe temperature, under
  // a halftone scrim; hover/focus "develops" it to full color (see
  // .flyer-* in globals.css). Exceptions: fresh (<1h) items keep their
  // glitch chrome untreated — fresh-cover-flicker owns `filter`, and a
  // just-published item isn't archived yet — and drafts keep their existing
  // draft treatment. Imageless cards never reach this branch.
  const isMounted = !isFresh && !isDraftOnly

  return (
    // 3D depth root for the tilt parallax. NOT overflow-hidden (that would
    // flatten the translateZ planes). The image plane below carries the clip
    // instead. transform-style is preserve-3d so the two planes separate into
    // real depth under the inner tilt wrapper. When tilt is off the planes are
    // visually coplanar (no perspective ancestor → translateZ has no visible
    // effect), so the flat designed state is unchanged.
    <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
      {/* ── Recessed IMAGE plane — sits behind the chrome ────────────────── */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={imageZStyle}
      >
      {item.imageUrl ? (
        isMounted ? (
          <div className="flyer-mount">
            <img
              src={item.imageUrl}
              alt={item.title}
              className="flyer-img h-full w-full object-cover object-top group-hover:scale-105"
              loading="lazy"
            />
            {/* Slot-tint — the item's true vibe temperature, inline because
                the color is per-item data (vibeToColor 11-slot ramp). */}
            <div
              className="flyer-tint"
              style={{ backgroundColor: vibeColor }}
              aria-hidden
            />
            {/* Halftone scrim — print grain, the at-rest/archived marker. */}
            <div className="flyer-halftone" aria-hidden />
          </div>
        ) : (
          <img
            src={item.imageUrl}
            alt={item.title}
            className={`h-full w-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-105 ${
              isFresh ? 'fresh-cover-flicker' : ''
            }`}
            loading="lazy"
          />
        )
      ) : (
        <div className="h-full w-full bg-elevated" />
      )}

      {/* HP death ritual — decay erosion. Sits over the image, under the text
          scrim + chrome below. Data-true (mortality from currentHp), CSS-only,
          static. Renders only when the item is in the dying tail. Never on
          fresh items (the fresh-cover-flicker owns `filter`). */}
      {!isFresh && mortality > 0 && <DecayErosion mortality={mortality} />}

      {/* Gradient: stronger at bottom where text lives */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/10" />
      </div>
      {/* ── /Recessed IMAGE plane ──────────────────────────────────────── */}

      {/* ── Lifted CHROME plane — frame, meter + badges float above image ─ */}
      <div className="absolute inset-0" style={chromeZStyle}>

      {/* Vibe meter — top strip. Full 11-slot scale; the lit segments are
          the item's band reading. */}
      <VibeMeter
        item={item}
        size="sm"
        className="absolute right-0 top-0"
      />

      {/* Saved indicator — top-right corner, only visible when bookmarked */}
      <div className="absolute right-3 top-3">
        <SavedBadge itemId={item.id} />
      </div>

      {/* Fresh-published scanline sweep — single thin line traversing
          top→bottom. Inherits the type color via the card-level CSS variable. */}
      {isFresh && <div className="fresh-scanline" aria-hidden />}

      {/* Type badge — top left */}
      <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
        <span className="bg-black/70 px-2 py-1 font-mono text-[10px] tracking-widest text-secondary backdrop-blur-sm">
          //{TYPE_LABEL[item.type]}
        </span>
        {item.editorial && (
          <span className="bg-sys-red/90 px-1.5 py-1 font-mono text-[10px] tracking-widest text-white backdrop-blur-sm">
            ★
          </span>
        )}
        {isFresh && (
          <span
            className="fresh-chip-flicker border bg-black/85 px-1.5 py-1 font-mono text-[10px] tracking-widest backdrop-blur-sm"
            style={{
              borderColor: typeColor,
              color: typeColor,
              boxShadow: `0 0 8px color-mix(in srgb, ${typeColor} 50%, transparent)`,
            }}
            title="Recién publicado"
          >
            [NUEVO]
          </span>
        )}
        {isDraftOnly && (
          <span
            className="border bg-black/80 px-1.5 py-1 font-mono text-[10px] tracking-widest backdrop-blur-sm"
            style={{
              borderColor: '#F97316',
              color: '#F97316',
            }}
            title="Borrador local — solo visible en esta sesión"
          >
            BORRADOR
          </span>
        )}
        <PartnerAttributionChip item={item} />
        <PublisherHlChip item={item} />
      </div>

      {/* NGE corner bracket — bottom right */}
      <div className="absolute bottom-3 right-3">
        <div
          className="h-3 w-3 border-b border-r"
          style={{ borderColor: `${vibeColor}60` }}
        />
      </div>

      {/* Poll affordance — chip when closed, full canvas when open. Lives
          inside the image container so the canvas borrows the image's real
          estate. See [[PollCardCanvas]]. */}
      <PollCardCanvas item={item} />
      </div>
      {/* ── /Lifted CHROME plane ───────────────────────────────────────── */}
    </div>
  )
}

// ── SM card — 1×1 ────────────────────────────────────────────────────────────
function SmCard({ item, isFresh, mortality, imageZStyle, chromeZStyle }: CardVariantProps) {
  const vibeColor = vibeToColor(vibeMid(item))
  const genres = genreEntries(item.genres, 2)

  return (
    <article className="group relative h-full overflow-hidden border border-border cursor-pointer">
      <CardImage item={item} size="sm" isFresh={isFresh} mortality={mortality} imageZStyle={imageZStyle} chromeZStyle={chromeZStyle} />

      {item.type === 'evento' && item.date && (
        <div className="absolute right-2 top-3 flex flex-col items-center border border-white/20 bg-black/70 px-2 py-1 backdrop-blur-sm">
          <span className="font-mono text-[8px] font-bold tracking-widest text-white">{fmtMonthShort(item.date)}</span>
          <span className="font-syne text-2xl font-black leading-none text-white">{fmtDayNumber(item.date)}</span>
          <span className="font-mono text-[8px] font-bold tracking-widest text-white">{fmtDayName(item.date)}</span>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-3">
        <h2 className="mb-1 font-syne text-sm font-black leading-tight text-white line-clamp-2">
          {item.title}
        </h2>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {item.date && (
            <span className="font-mono text-[9px] tracking-wide text-secondary">
              {fmtDateShort(item.date ?? item.publishedAt)}
            </span>
          )}
          {item.venue && (
            <span className="font-mono text-[9px] text-muted">{item.venue}</span>
          )}
          {item.author && (
            <span className="font-mono text-[9px] text-muted">{item.author}</span>
          )}
          <CreatorChip item={item} dim />
        </div>

        {genres.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {genres.map(({ id, name }) => (
              <GenreChipButton
                key={id}
                genreId={id}
                className="font-mono text-[9px]"
                style={{ color: vibeColor }}
              >
                [{name}]
              </GenreChipButton>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}

// ── MD card — 2×1 (wide) or 1×2 (tall) ──────────────────────────────────────
function MdCard({ item, isFresh, mortality, imageZStyle, chromeZStyle }: CardVariantProps) {
  const vibeColor = vibeToColor(vibeMid(item))
  const genres = genreEntries(item.genres, 3)
  const tags = getTagNames(item.tags).slice(0, 3)
  const time = item.date ? fmtTime(item.date) : ''
  const isMix = item.type === 'mix'

  return (
    <article className="group relative h-full overflow-hidden border border-border cursor-pointer">
      <CardImage item={item} size="md" isFresh={isFresh} mortality={mortality} imageZStyle={imageZStyle} chromeZStyle={chromeZStyle} />

      {item.type === 'evento' && item.date && (
        <div className="absolute right-2 top-3 flex flex-col items-center border border-white/20 bg-black/70 px-2 py-1.5 backdrop-blur-sm">
          <span className="font-mono text-[8px] font-bold tracking-widest text-white">{fmtMonthShort(item.date)}</span>
          <span className="font-syne text-3xl font-black leading-none text-white">{fmtDayNumber(item.date)}</span>
          <span className="font-mono text-[8px] font-bold tracking-widest text-white">{fmtDayName(item.date)}</span>
          {time && <span className="mt-0.5 font-mono text-[9px] text-secondary">{time}</span>}
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-4">
        {/* Artists row for events */}
        {item.artists && item.artists.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-x-2">
            {item.artists.slice(0, 3).map((a) => (
              <span key={a} className="font-mono text-[10px] tracking-wide text-secondary">
                {a}
              </span>
            ))}
          </div>
        )}

        <h2 className="mb-1.5 font-syne text-lg font-black leading-tight text-white line-clamp-2">
          {item.title}
        </h2>

        {item.subtitle && (
          <p className="mb-1.5 font-grotesk text-xs text-secondary line-clamp-1">{item.subtitle}</p>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {item.date && !isMix && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-secondary">
              <MapPin size={9} />
              {item.venue}
              {time && ` · ${time}`}
            </span>
          )}
          {isMix && item.duration && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-secondary">
              <Play size={9} />
              {item.duration}
            </span>
          )}
          {item.readTime && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-muted">
              <Clock size={9} />
              {item.readTime} min
            </span>
          )}
          {genres.slice(0, 2).map(({ id, name }) => (
            <GenreChipButton
              key={id}
              genreId={id}
              className="font-mono text-[9px] transition-colors hover:text-white"
              style={{ color: vibeColor }}
            >
              [{name}]
            </GenreChipButton>
          ))}
          {item.price && (
            <span className="ml-auto flex items-center gap-1 font-mono text-[9px] text-secondary">
              <Ticket size={9} />
              {item.price}
            </span>
          )}
        </div>
      </div>
    </article>
  )
}

// ── LG card — 2×2 (big featured) ─────────────────────────────────────────────
function LgCard({ item, isFresh, mortality, imageZStyle, chromeZStyle }: CardVariantProps) {
  const vibeColor = vibeToColor(vibeMid(item))
  const genres = genreEntries(item.genres, 4)
  const tags = getTagNames(item.tags).slice(0, 4)
  const time = item.date ? fmtTime(item.date) : ''

  return (
    <article className="group relative h-full overflow-hidden border border-border cursor-pointer">
      <CardImage item={item} size="lg" isFresh={isFresh} mortality={mortality} imageZStyle={imageZStyle} chromeZStyle={chromeZStyle} />

      {/* Date block for events — top right inside image */}
      {item.type === 'evento' && item.date && (
        <div className="absolute right-3 top-10 mt-2 flex flex-col items-center border border-white/20 bg-black/70 px-3 py-2 backdrop-blur-sm">
          <span className="font-mono text-[9px] font-bold tracking-widest text-white">
            {fmtMonthShort(item.date)}
          </span>
          <span className="font-syne text-4xl font-black leading-none text-white">
            {fmtDayNumber(item.date)}
          </span>
          <span className="font-mono text-[9px] font-bold tracking-widest text-white">
            {fmtDayName(item.date)}
          </span>
          {time && (
            <span className="mt-1 font-mono text-[10px] text-secondary">{time}</span>
          )}
        </div>
      )}

      {/* Bottom content area */}
      <div className="absolute bottom-0 left-0 right-0 p-5">
        {/* Artists */}
        {item.artists && item.artists.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1">
            {item.artists.slice(0, 4).map((a) => (
              <span key={a} className="font-mono text-xs tracking-wide text-secondary">
                {a}
              </span>
            ))}
          </div>
        )}

        <h2 className="mb-2 font-syne text-2xl font-black leading-tight text-white md:text-3xl">
          {item.title}
        </h2>

        {item.subtitle && (
          <p className="mb-2 font-mono text-xs text-secondary">{item.subtitle}</p>
        )}

        {item.excerpt && (
          <p className="mb-3 font-grotesk text-sm leading-relaxed text-secondary line-clamp-2 md:line-clamp-3">
            {item.excerpt}
          </p>
        )}

        {/* Genres + tags */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {genres.map(({ id, name }) => (
            <GenreChipButton
              key={id}
              genreId={id}
              className="px-2 py-0.5 font-mono text-[9px] tracking-wide"
              style={{ backgroundColor: `${vibeColor}20`, color: vibeColor }}
            >
              {name}
            </GenreChipButton>
          ))}
          {tags.map((t) => (
            <span key={t} className="border border-white/10 px-2 py-0.5 font-mono text-[9px] text-muted">
              {t}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {item.venue && (
              <span className="flex items-center gap-1 font-mono text-[10px] text-muted">
                <MapPin size={10} />
                {item.venue}
                {item.venueCity && ` · ${item.venueCity}`}
              </span>
            )}
            {item.price && (
              <span className="flex items-center gap-1 font-mono text-[10px] text-secondary">
                <Ticket size={10} />
                {item.price}
              </span>
            )}
            {item.type === 'mix' && item.duration && (
              <span className="flex items-center gap-1 font-mono text-[10px] text-secondary">
                <Play size={10} />
                {item.duration}
              </span>
            )}
            {item.author && (
              <span className="font-mono text-[10px] text-muted">by {item.author}</span>
            )}
            <CreatorChip item={item} dim />

            {item.readTime && (
              <span className="flex items-center gap-1 font-mono text-[10px] text-muted">
                <Clock size={10} />
                {item.readTime} min
              </span>
            )}
          </div>
          {item.ticketUrl && (
            <a
              href={item.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-white/20 px-3 py-1.5 font-mono text-[10px] tracking-widest text-white backdrop-blur-sm transition-colors hover:bg-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              TICKETS →
            </a>
          )}
        </div>
      </div>
    </article>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export function ContentCard({ item, size = 'sm' }: ContentCardProps) {
  const { open } = useOverlay()
  // Mutable element ref written by the merged setRootRef callback below. Typed
  // `| null` so `.current` is assignable (a bare useRef<HTMLDivElement>(null)
  // infers a read-only RefObject).
  const ref = useRef<HTMLDivElement | null>(null)

  // Signal-panel tilt — subtle 3D pointer-tilt + parallax depth. Pure visual
  // layer: applies its transform to an INNER wrapper (never the MosaicItem
  // Framer controls), wires pointer/focus on the host (this root), and is a
  // no-op on touch / reduced-motion (flat designed state). See useCardTilt.
  const { hostProps, tiltProps, imageZStyle, chromeZStyle } = useCardTilt()
  // Merge the tilt host's callback ref with our object ref (the root needs BOTH
  // — `ref` feeds getBoundingClientRect for the overlay origin + the
  // dissolve-on-unmount observer; the tilt host needs the node to measure the
  // pointer position). One callback writes both.
  const setRootRef = (node: HTMLDivElement | null) => {
    ref.current = node
    hostProps.ref(node)
  }

  // Thermal coupling — a hot card (high vibe temperature) reports its live
  // viewport position + heat to the shared heatField; VibeFluid warms the
  // signal field in the gutters around it. Cold cards + non-desktop are no-ops
  // (the hook gates internally). Heat = the card's vibe temperature 0..1.
  useHeatReport(ref, item.id, vibeMid(item) / 10)

  // HP death ritual — live mortality readout (0 = healthy, 1 = about to die).
  // Drives the always-on erosion treatment and arms the dissolve-on-unmount.
  const { mortality, isDying, reducedMotion } = useDecayState(item)
  // The dissolve only fires when the card is genuinely dying AND not a past
  // evento (past eventos already get the //PASADO chrome + grayscale demote;
  // their exit is the calendar, not the ritual). computeMortality already
  // returns 0 for past eventos, so `isDying` is sufficient here.
  useDissolveOnUnmount(ref, isDying, reducedMotion)

  // Compute initial fresh state from the item's age. Editor-composed items
  // (source !== 'scraper:ra') glitch for the first hour after publish.
  const initialAge = freshAgeMs(item)
  const initialFresh =
    initialAge !== null && initialAge >= 0 && initialAge < ONE_HOUR_MS
  const [isFresh, setIsFresh] = useState(initialFresh)

  // Per-card timer flips fresh → stale exactly at the 1-hour mark so
  // long-lived sessions don't keep glitching past the boundary. No
  // setInterval — one shot at `(publishedAt + 1hr) - now` ms, then we're
  // done.
  useEffect(() => {
    if (!initialFresh || initialAge === null) return
    const remaining = ONE_HOUR_MS - initialAge
    if (remaining <= 0) {
      setIsFresh(false)
      return
    }
    const timer = window.setTimeout(() => setIsFresh(false), remaining)
    return () => window.clearTimeout(timer)
  }, [initialFresh, initialAge])

  const handleOpen = () => {
    const rect = ref.current?.getBoundingClientRect()
    // Fire-and-forget engagement event. Server gates on auth.uid() — anon
    // clicks 401 silently. See lib/hpEvents.ts + lib/curation.ts.
    recordHpEvent(item.id, 'click')
    open(
      item.slug,
      rect
        ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        : undefined,
    )
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleOpen()
    }
  }

  const Inner = size === 'lg' ? LgCard : size === 'md' ? MdCard : SmCard
  // Past evento (within filterForHome's grace window). Visually demoted so
  // it doesn't compete with upcoming items for the eye.
  const past = item.type === 'evento' && isExpired(item)
  // Set the type color as a CSS custom property so the keyframe animations
  // (border pulse, scanline, chip glow) inherit it without needing a
  // per-instance class. `perspective` establishes the 3D viewing frustum the
  // inner tilt wrapper rotates within — harmless when tilt is disabled (the
  // wrapper stays flat, so no perspective distortion is ever visible).
  const wrapperStyle: CSSProperties = {
    perspective: `${CARD_TILT_PERSPECTIVE_PX}px`,
    ...(isFresh
      ? ({ borderWidth: 1, '--glitch-color': categoryColor(item.type) } as CSSProperties)
      : {}),
  }

  return (
    <div
      ref={setRootRef}
      data-card-id={item.id}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      onPointerMove={hostProps.onPointerMove}
      onPointerLeave={hostProps.onPointerLeave}
      onFocus={hostProps.onFocus}
      onBlur={hostProps.onBlur}
      role="button"
      tabIndex={0}
      aria-label={`Abrir ${item.title}`}
      className={`flyer-scope relative h-full focus:outline-none focus-visible:ring-1 focus-visible:ring-sys-red ${
        isFresh ? 'fresh-glitch border' : ''
      } ${past ? 'opacity-70 grayscale-[30%]' : ''}`}
      style={wrapperStyle}
    >
      {/* Inner tilt wrapper — the element that actually rotateX/Y's. Kept
          SEPARATE from this host (the host owns perspective + listeners) and
          from MosaicItem (Framer's layout transform). preserve-3d here lets the
          image plane recess behind the chrome plane (parallax). */}
      <div {...tiltProps}>
        <Inner
          item={item}
          isFresh={isFresh}
          mortality={mortality}
          imageZStyle={imageZStyle}
          chromeZStyle={chromeZStyle}
        />
      </div>
      {past && (
        <span
          className="pointer-events-none absolute bottom-3 right-3 z-10 border bg-black/85 px-1.5 py-1 font-mono text-[10px] tracking-widest backdrop-blur-sm"
          style={{ color: '#9CA3AF', borderColor: '#6B7280' }}
        >
          //PASADO
        </span>
      )}
    </div>
  )
}
