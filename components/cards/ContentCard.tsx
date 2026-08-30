'use client'

import Link from 'next/link'
import { SmartImage } from '@/components/SmartImage'
import type { ContentItem } from '@/lib/types'
import {
  effectiveVibeBand,
  vibeMid,
  fmtDateShort,
  fmtDayNumber,
  fmtMonthShort,
  fmtDayName,
  fmtTime,
  isExpired,
} from '@/lib/utils'
import { VibeMeterLight } from '@/components/dashboard/widgets/shared/VibeMeterLight'
import { getGenreById, getTagNames } from '@/lib/genres'
import { franjaAttributionPrefix } from '@/lib/franjaAttribution'
import {
  categoryColorOnLight,
  typeCode,
  typeDisplayLabel,
  PANEL_SCRIM_GRADIENT,
} from '@/lib/dashboard/palette'
import { hlBracket } from '@/lib/dashboard/hl'
import { Play, Clock, MapPin, Ticket } from 'lucide-react'
import { memo, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useOverlay } from '@/components/overlay/useOverlay'
import { useHeatReport } from '@/lib/hooks/useHeatReport'
import { recordHpEvent } from '@/lib/hpEvents'
import { useAuth } from '@/components/auth/useAuth'
import { currentHp } from '@/lib/curation'
import { GenreChipButton } from '@/components/genre/GenreChipButton'
import { PollCardCanvas } from '@/components/poll/PollCardCanvas'
import { SavedBadge } from './SavedBadge'

// ── Fresh-published chrome ─────────────────────────────────────────────────
//
// Editor-composed items wear the .print-fresh out-of-register pulse (paper
// translation of the old CRT glitch kit — plate-ghost box shadows, stepped)
// plus a NUEVO chip for the first hour after publish so the new content is
// unmistakable in the feed. Excludes scraped events (source === 'scraper:ra')
// so the Mon/Wed/Fri scrape batches don't all pulse at once.
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

// Shared props for the three size variants.
interface CardVariantProps {
  item: ContentItem
  isFresh: boolean
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
// Bracket words (DÉBIL → PLENO) rather than raw numbers — keeps the
// "no visible numeric engagement metrics" rule intact for everyone else
// while giving the publisher a coarse, glanceable read on their post's
// reach. Bracket boundaries + labels live in lib/dashboard/hl.ts (the one
// shared copy — tune there, not here). On paper the chip is plain ink: the
// word carries the tier, no per-tier colors.
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
  return (
    <span
      className="border border-ink bg-paper-raised px-1.5 py-0.5 font-mono text-d11 font-bold tracking-widest text-ink"
      title={`HL · sólo tú puedes ver esto en tus publicaciones`}
    >
      ◇ HL·{hlBracket(hp)}
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
      className={`font-mono text-[9px] tracking-wide transition-colors hover:text-sys-red-paper ${
        dim ? 'text-ink-faint' : 'text-ink-soft'
      }`}
      title={`Perfil de ${item.creator.displayName}`}
    >
      @{item.creator.username}
    </Link>
  )
}

// ── Franja attribution chip ──────────────────────────────────────────────────
//
// Renders //PRESENTA · CLUB JAPAN (or //SELLO · X, //PROMOTORA · X, etc.) on
// cards whose `franja` field is populated by the server-side self-join. The
// ONE surviving slash idiom on paper surfaces — it is the brand stamp — set
// in sys-red-paper. The chip is clickable through to the franja's
// MarketplaceOverlay when the franja is marketplace-enabled; non-clickable
// otherwise (the attribution itself does the trust work — the click is a
// discovery affordance).
//
// stopPropagation on click so the chip's navigation doesn't also trigger the
// card's overlay-open handler.
//
// See wiki/90-Decisions/Franja Authoring.md.
function FranjaAttributionChip({ item }: { item: ContentItem }) {
  // Defensive on franja.title — server mapper occasionally hands back a
  // partial shape (e.g. when the embed returned as an array we couldn't
  // normalize). Skip rendering rather than crash.
  if (!item.franja || !item.franja.title) return null
  const { franja } = item
  const label = `//${franjaAttributionPrefix(franja.kind)} · ${franja.title.toUpperCase()}`
  const baseClass =
    'font-mono text-[10px] font-bold tracking-widest text-sys-red-paper'

  if (franja.marketplaceEnabled) {
    return (
      <Link
        href={`/marketplace?franja=${encodeURIComponent(franja.slug)}`}
        onClick={(e) => e.stopPropagation()}
        className={`${baseClass} transition-colors hover:bg-sys-red-paper hover:text-paper-raised`}
        title={`Ver perfil de ${franja.title} en marketplace`}
      >
        {label}
      </Link>
    )
  }

  return (
    <span className={baseClass} title={`Publicado por ${franja.title}`}>
      {label}
    </span>
  )
}

// ── Type chip ─────────────────────────────────────────────────────────────
//
// The caption's identity mark: 9px category swatch + 2-letter code + display
// label. Category color is never the only signal — the code rides beside the
// swatch (review/articulo ambers alias by design).
function TypeChip({ item }: { item: ContentItem }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-d11 font-bold uppercase tracking-widest text-ink">
      <span
        aria-hidden
        className="h-[9px] w-[9px] shrink-0"
        style={{ backgroundColor: categoryColorOnLight(item.type) }}
      />
      {typeCode(item.type)} · {typeDisplayLabel(item.type)}
    </span>
  )
}

// ── Caption chip row ──────────────────────────────────────────────────────
//
// One row, all tiers: type identity + state chips (editorial ★, NUEVO,
// BORRADOR, PASADO) + franja stamp + publisher-only HL. Living in the
// caption zone — not over the artwork — is the fase-B move: no scrims, no
// backdrop-blur.
function ChipRow({ item, isFresh }: CardVariantProps) {
  const isDraftOnly = item._draftState === 'draft'
  const past = item.type === 'evento' && isExpired(item)
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <TypeChip item={item} />
      {item.editorial && (
        <span
          className="bg-sys-red-paper px-1.5 py-0.5 font-mono text-[10px] leading-none text-paper-raised"
          title="Selección editorial"
        >
          ★
        </span>
      )}
      {isFresh && (
        <span
          className="inline-flex items-center gap-1 border border-ink bg-paper-raised px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-widest text-ink"
          title="Recién publicado"
        >
          {/* Acid dot-badge: ≥8px + 1px ink outline — the whitelisted use. */}
          <span aria-hidden className="h-2 w-2 rounded-full border border-ink bg-acid" />
          NUEVO
        </span>
      )}
      {isDraftOnly && (
        <span
          className="border border-ink-faint bg-paper-raised px-1.5 py-0.5 font-mono text-[10px] tracking-widest text-ink-faint"
          title="Borrador local — solo visible en esta sesión"
        >
          BORRADOR
        </span>
      )}
      {past && (
        <span className="border border-ink-faint bg-paper-raised px-1.5 py-0.5 font-mono text-[10px] tracking-widest text-ink-faint">
          PASADO
        </span>
      )}
      <FranjaAttributionChip item={item} />
      <PublisherHlChip item={item} />
    </div>
  )
}

// ── Art plate ─────────────────────────────────────────────────────────────
//
// The artwork zone every card keeps (image-forward law — no text-only cards
// at any tier). Full-color image, no gradient scrims, no hover zoom. The
// SavedBadge rides its top-left corner (top-right of the card belongs to
// the poll chip). `children` lets LgCard seat its scrim slab + overlaid
// title inside the plate.
function ArtPlate({
  item,
  sizes,
  className,
  children,
}: {
  item: ContentItem
  sizes: string
  className?: string
  children?: ReactNode
}) {
  return (
    <div className={`relative overflow-hidden ${className ?? ''}`}>
      {item.imageUrl ? (
        <SmartImage
          src={item.imageUrl}
          alt={item.title}
          sizes={sizes}
          className="object-cover object-top"
        />
      ) : (
        // The plate still exists when an item genuinely has no image URL —
        // a low-alpha ink field, honest about the missing artwork.
        <div className="h-full w-full bg-ink/10" aria-hidden />
      )}

      {/* Saved indicator — only visible when bookmarked */}
      <div className="absolute left-2 top-2 z-10">
        <SavedBadge itemId={item.id} />
      </div>

      {children}
    </div>
  )
}

// ── Event date chip ───────────────────────────────────────────────────────
//
// The printed date block: mono month/day-name around a Syne day number, ink
// on paper-raised with an ink hairline. Sm/Md seat it over the art plate's
// bottom-left corner (gig-poster sticker); Lg seats it inline beside the
// overlaid title. Null for non-events / undated items.
function DateChip({ item, size }: { item: ContentItem; size: CardSize }) {
  if (item.type !== 'evento' || !item.date) return null
  const time = size !== 'sm' ? fmtTime(item.date) : ''
  const daySize =
    size === 'lg' ? 'text-4xl' : size === 'md' ? 'text-3xl' : 'text-2xl'
  return (
    <div className="flex shrink-0 flex-col items-center border border-ink bg-paper-raised px-2 py-1">
      <span className="font-mono text-[8px] font-bold tracking-widest text-ink">
        {fmtMonthShort(item.date)}
      </span>
      <span className={`font-syne ${daySize} font-black leading-none text-ink`}>
        {fmtDayNumber(item.date)}
      </span>
      <span className="font-mono text-[8px] font-bold tracking-widest text-ink">
        {fmtDayName(item.date)}
      </span>
      {time && (
        <span className="mt-0.5 font-mono text-[9px] text-ink-soft">{time}</span>
      )}
    </div>
  )
}

// ── Card meter ────────────────────────────────────────────────────────────
//
// VibeMeterLight heads the caption zone in every tier — the 11-slot
// calibrated plate on cream. The lit band is effectiveVibeBand(item),
// exactly what the dark VibeMeter showed: the crowd median once
// vibeCheckCount hits threshold, the author range until then — the same
// band filterByVibe admits (a meter that disagreed with the filter that
// admitted the card would be a false readout). When the card carries a
// poll, the meter pads right so the absolute corner chip never sits on it.
function CardMeter({ item, padForPoll = false }: { item: ContentItem; padForPoll?: boolean }) {
  return (
    <VibeMeterLight
      band={effectiveVibeBand(item)}
      size="sm"
      className={padForPoll && item.poll ? 'pr-24' : undefined}
    />
  )
}

// ── SM card — 1×1: side art plate + caption column ───────────────────────────
function SmCard({ item, isFresh }: CardVariantProps) {
  const genres = genreEntries(item.genres, 2)

  return (
    <article className="group relative flex h-full cursor-pointer overflow-hidden border border-ink bg-paper-raised">
      <ArtPlate
        item={item}
        sizes="(max-width: 640px) 25vw, 15vw"
        className="w-[38%] shrink-0 border-r border-ink"
      >
        <div className="absolute bottom-2 left-2 z-10">
          <DateChip item={item} size="sm" />
        </div>
      </ArtPlate>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2.5">
        <CardMeter item={item} padForPoll />
        <ChipRow item={item} isFresh={isFresh} />
        <h2 className="font-syne text-sm font-black leading-tight text-ink line-clamp-3 group-hover:underline group-hover:decoration-2 group-hover:underline-offset-2">
          {item.title}
        </h2>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {item.date && (
            <span className="font-mono text-[9px] tracking-wide text-ink-soft">
              {fmtDateShort(item.date ?? item.publishedAt)}
            </span>
          )}
          {item.venue && (
            <span className="font-mono text-[9px] text-ink-faint">{item.venue}</span>
          )}
          {item.author && (
            <span className="font-mono text-[9px] text-ink-faint">{item.author}</span>
          )}
          <CreatorChip item={item} dim />
        </div>

        {genres.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1">
            {genres.map(({ id, name }) => (
              <GenreChipButton
                key={id}
                genreId={id}
                ground="paper"
                className="px-1 py-0.5 font-mono text-[9px] uppercase tracking-wide"
              >
                {name}
              </GenreChipButton>
            ))}
          </div>
        )}
      </div>

      <PollCardCanvas item={item} />
    </article>
  )
}

// ── MD card — 2×1 (wide) or 1×2 (tall) ──────────────────────────────────────
//
// Orientation mirrors lib/curation.ts MD_GEOMETRY (read-only contract):
// visual types (mix/franja) get wide 2×1 cells → side art plate; text types
// get tall 1×2 cells → top art plate; evento md is a 1×1 square, where the
// side plate reads best too.
function MdCard({ item, isFresh }: CardVariantProps) {
  const genres = genreEntries(item.genres, 3)
  const time = item.date ? fmtTime(item.date) : ''
  const isMix = item.type === 'mix'
  const sideArt =
    item.type === 'mix' || item.type === 'franja' || item.type === 'evento'

  return (
    <article
      className={`group relative flex h-full cursor-pointer overflow-hidden border border-ink bg-paper-raised ${
        sideArt ? 'flex-row' : 'flex-col'
      }`}
    >
      <ArtPlate
        item={item}
        sizes={
          sideArt
            ? '(max-width: 640px) 40vw, 25vw'
            : '(max-width: 640px) 50vw, 33vw'
        }
        className={
          sideArt
            ? 'w-[42%] shrink-0 border-r border-ink'
            : 'h-[45%] w-full shrink-0 border-b border-ink'
        }
      >
        <div className="absolute bottom-2 left-2 z-10">
          <DateChip item={item} size="md" />
        </div>
      </ArtPlate>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 p-3">
        <CardMeter item={item} padForPoll={sideArt} />
        <ChipRow item={item} isFresh={isFresh} />

        {/* Artists row for events */}
        {item.artists && item.artists.length > 0 && (
          <div className="flex flex-wrap gap-x-2">
            {item.artists.slice(0, 3).map((a) => (
              <span key={a} className="font-mono text-[10px] tracking-wide text-ink-soft">
                {a}
              </span>
            ))}
          </div>
        )}

        <h2 className="font-syne text-lg font-black leading-tight text-ink line-clamp-2 group-hover:underline group-hover:decoration-2 group-hover:underline-offset-2">
          {item.title}
        </h2>

        {item.subtitle && (
          <p className="font-grotesk text-xs text-ink-soft line-clamp-1">{item.subtitle}</p>
        )}

        {/* Meta row */}
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1">
          {item.date && !isMix && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-ink-soft">
              <MapPin size={9} />
              {item.venue}
              {time && ` · ${time}`}
            </span>
          )}
          {isMix && item.duration && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-ink-soft">
              <Play size={9} />
              {item.duration}
            </span>
          )}
          {item.readTime && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-ink-faint">
              <Clock size={9} />
              {item.readTime} min
            </span>
          )}
          <CreatorChip item={item} dim />
          {genres.slice(0, 2).map(({ id, name }) => (
            <GenreChipButton
              key={id}
              genreId={id}
              ground="paper"
              className="px-1 py-0.5 font-mono text-[9px] uppercase tracking-wide"
            >
              {name}
            </GenreChipButton>
          ))}
          {item.price && (
            <span className="ml-auto flex items-center gap-1 font-mono text-[9px] text-ink-soft">
              <Ticket size={9} />
              {item.price}
            </span>
          )}
        </div>
      </div>

      <PollCardCanvas item={item} />
    </article>
  )
}

// ── LG card — 2×2 / 3×2 (big featured) ──────────────────────────────────────
//
// Full-bleed art with the title overlaid — legal ONLY because the ink scrim
// slab (PANEL_SCRIM_GRADIENT) restores a dark ground under the panel-text
// type; the consuming block pads its top by the ramp height (pt-7 = 28px)
// so no glyph ever rides the fade. Below, a bottom caption bar on paper
// (border-t border-ink) carries the meter, chip row + meta.
function LgCard({ item, isFresh }: CardVariantProps) {
  const genres = genreEntries(item.genres, 4)
  const tags = getTagNames(item.tags).slice(0, 4)

  return (
    <article className="group relative flex h-full cursor-pointer flex-col overflow-hidden border border-ink bg-paper-raised">
      <ArtPlate
        item={item}
        sizes="(max-width: 1024px) 100vw, 66vw"
        className="min-h-0 flex-1"
      >
        <div
          className="absolute inset-x-0 bottom-0 flex items-end gap-3 px-5 pb-4 pt-7"
          style={{ background: PANEL_SCRIM_GRADIENT }}
        >
          <div className="min-w-0 flex-1">
            {/* Artists */}
            {item.artists && item.artists.length > 0 && (
              <div className="mb-1.5 flex flex-wrap gap-x-3 gap-y-1">
                {item.artists.slice(0, 4).map((a) => (
                  <span key={a} className="font-mono text-xs tracking-wide text-panel-text/80">
                    {a}
                  </span>
                ))}
              </div>
            )}

            <h2 className="font-syne text-2xl font-black leading-tight text-panel-text md:text-3xl group-hover:underline group-hover:decoration-2 group-hover:underline-offset-2">
              {item.title}
            </h2>

            {item.subtitle && (
              <p className="mt-1 font-mono text-xs text-panel-text/80">{item.subtitle}</p>
            )}
          </div>

          <DateChip item={item} size="lg" />
        </div>
      </ArtPlate>

      {/* Bottom caption bar — on paper, out of the artwork */}
      <div className="flex shrink-0 flex-col gap-2 border-t border-ink p-4">
        <CardMeter item={item} />
        <ChipRow item={item} isFresh={isFresh} />

        {item.excerpt && (
          <p className="font-grotesk text-sm leading-relaxed text-ink-soft line-clamp-2">
            {item.excerpt}
          </p>
        )}

        {/* Genres + tags */}
        {(genres.length > 0 || tags.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {genres.map(({ id, name }) => (
              <GenreChipButton
                key={id}
                genreId={id}
                ground="paper"
                className="px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide"
              >
                {name}
              </GenreChipButton>
            ))}
            {tags.map((t) => (
              <span key={t} className="border border-ink-faint px-2 py-0.5 font-mono text-[9px] text-ink-faint">
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Footer meta */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {item.venue && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-ink-soft">
              <MapPin size={10} />
              {item.venue}
              {item.venueCity && ` · ${item.venueCity}`}
            </span>
          )}
          {item.price && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-ink-soft">
              <Ticket size={10} />
              {item.price}
            </span>
          )}
          {item.type === 'mix' && item.duration && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-ink-soft">
              <Play size={10} />
              {item.duration}
            </span>
          )}
          {item.author && (
            <span className="font-mono text-[10px] text-ink-faint">por {item.author}</span>
          )}
          <CreatorChip item={item} />
          {item.readTime && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-ink-faint">
              <Clock size={10} />
              {item.readTime} min
            </span>
          )}
          {item.ticketUrl && (
            <a
              href={item.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto border border-ink px-3 py-1.5 font-mono text-[10px] font-bold tracking-widest text-ink transition-colors hover:bg-ink hover:text-panel-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2"
              onClick={(e) => e.stopPropagation()}
            >
              TICKETS →
            </a>
          )}
        </div>
      </div>

      <PollCardCanvas item={item} />
    </article>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
function ContentCardImpl({ item, size = 'sm' }: ContentCardProps) {
  const { open } = useOverlay()
  // Root ref — feeds getBoundingClientRect for the overlay open-origin.
  const ref = useRef<HTMLDivElement | null>(null)

  // Thermal coupling — a hot card (high vibe temperature) reports its live
  // viewport position + heat to the shared heatField; VibeFluid (background)
  // warms the signal field around it. Cold cards + non-desktop are no-ops.
  useHeatReport(ref, item.id, vibeMid(item) / 10)

  // Compute initial fresh state from the item's age. Editor-composed items
  // (source !== 'scraper:ra') pulse for the first hour after publish.
  const initialAge = freshAgeMs(item)
  const initialFresh =
    initialAge !== null && initialAge >= 0 && initialAge < ONE_HOUR_MS
  const [isFresh, setIsFresh] = useState(initialFresh)

  // Per-card timer flips fresh → stale exactly at the 1-hour mark so
  // long-lived sessions don't keep pulsing past the boundary. No
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
  // it doesn't compete with upcoming items for the eye; the PASADO chip
  // itself renders inline in the caption's ChipRow.
  const past = item.type === 'evento' && isExpired(item)

  return (
    <div
      ref={ref}
      data-card-id={item.id}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Abrir ${item.title}`}
      className={`relative h-full focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2 ${
        isFresh ? 'print-fresh' : ''
      } ${past ? 'opacity-70 grayscale-[30%]' : ''}`}
    >
      <Inner item={item} isFresh={isFresh} />
    </div>
  )
}

// Memoized: the home/agenda grid maps ~140 cards and re-renders on every
// vibe-slider tick. Props are a stable `item` ref + a primitive `size`, so the
// default shallow compare skips cards whose tier/content didn't change while
// still re-rendering on a genuine re-tier (the `size` prop). Position changes
// live on MosaicItem (grid style + Framer layout), not here — so the ranking
// signal (size + position) is fully preserved.
export const ContentCard = memo(ContentCardImpl)
