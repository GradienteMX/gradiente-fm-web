import nextDynamic from 'next/dynamic'
import { CategoryRail } from '@/components/CategoryRail'
import { EventosRail } from '@/components/EventosRail'
import { HomeFeedWithDrafts } from '@/components/HomeFeedWithDrafts'
import { FeedHeader } from '@/components/FeedHeader'
import { HeroCard } from '@/components/HeroCard'
import { PartnersRail } from '@/components/PartnersRail'
import { MarketplaceRail } from '@/components/marketplace/MarketplaceRail'
import { getItems } from '@/lib/data/items'
import type { ContentItem } from '@/lib/types'
import { filterForHome, getPinnedHero, isUpcoming } from '@/lib/utils'
import { parseISO } from 'date-fns'

// SHOWPIECE — teletext signal-field background. Client-only (raw WebGL),
// loaded with ssr:false so it never touches LCP; the component self-gates to
// capable surfaces and mounts after idle. Fixed z-0 canvas behind all content.
const VibeFluid = nextDynamic(() => import('@/components/fluid/VibeFluid'), {
  ssr: false,
})

// Reads from Supabase via cookies()-aware server client → forces dynamic.
// Will become `revalidate = 300` once the SYSTEM UPDATE countdown lands
// (see Backend Plan § "Realtime architecture").
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const now = new Date()
  const allItems = await getItems()
  const homeItems = filterForHome(allItems, now)
  const hero = getPinnedHero(allItems)

  // Partners live in the right rail, never in the main mosaic. The
  // marketplace-enabled subset feeds MarketplaceRail directly so the
  // home page reflects admin approvals on the next request (no
  // sessionStorage detour).
  const partners = allItems.filter((i) => i.type === 'partner')
  const marketplacePartners = partners.filter((p) => p.marketplaceEnabled)

  // Placement model — eventos can live in the rail, the mosaic, or both:
  //   - Default (editorial=false, elevated=false): rail only. Listings.
  //   - editorial=true: rail AND mosaic. The editor wants this event in front
  //     of users on both surfaces; HP-spawn boost still applies.
  //   - elevated=true: mosaic only. Removes from the rail (rare — for events
  //     where marquee placement is wrong).
  //
  // Non-evento items always go to the mosaic; partners stay isolated.
  // Past events are NEVER in the mosaic — they belong only to the /agenda
  // events section. The rail's job is "PRÓXIMOS · ORDEN CRONOLÓGICO".
  const isRailEvent = (i: ContentItem) =>
    i.type === 'evento' && !i.elevated && isUpcoming(i, now)
  // Events INTERLEAVE with content by time-urgency (see curation prominence: an
  // event's presence peaks on its date and decays, on the same scale as content
  // HP — so tonight's party rises into the hot band and a far-off one settles
  // among older posts). Two flood guards keep the mosaic from becoming an event
  // listing — the full upcoming firehose lives in the chronological rail:
  //   - EVENTS_PER_DAY  — spread: at most a few of any single day's events.
  //   - MAX_MOSAIC_EVENTS — total ceiling: the nearest-date N scraped events
  //     surface; the rest stay rail-only. This is an ABSOLUTE cap, not a ratio,
  //     so as community uploads grow the grid, the event share shrinks on its
  //     own (8 of 39 ≈ 17% today → 8 of 300 ≈ 3% later) with no re-tuning. A
  //     ratio would do the opposite — more scraper noise the busier the site.
  // Curator picks (editorial/elevated) bypass BOTH caps — that's deliberate
  // intent, and there are few of them. Past events never enter (archive lives
  // in /agenda) and keep their HL so they can still be cultivated.
  const EVENTS_PER_DAY = 3
  const MAX_MOSAIC_EVENTS = 8
  const eventChrono = (a: ContentItem, b: ContentItem) =>
    parseISO(a.date ?? a.publishedAt).getTime() -
    parseISO(b.date ?? b.publishedAt).getTime()
  const upcomingEvents = homeItems
    .filter((i) => i.type === 'evento' && isUpcoming(i, now))
    .sort(eventChrono)
  const perDayCount = new Map<string, number>()
  const mosaicEventIds = new Set<string>()
  let cappedEventCount = 0 // non-curated events counted against the global cap
  for (const ev of upcomingEvents) {
    // Curator intent always surfaces, bypassing both caps.
    if (ev.editorial || ev.elevated) {
      mosaicEventIds.add(ev.id)
      continue
    }
    if (cappedEventCount >= MAX_MOSAIC_EVENTS) continue
    const dayKey = (ev.date ?? ev.publishedAt).slice(0, 10) // YYYY-MM-DD
    const seen = perDayCount.get(dayKey) ?? 0
    if (seen < EVENTS_PER_DAY) {
      mosaicEventIds.add(ev.id)
      perDayCount.set(dayKey, seen + 1)
      cappedEventCount++
    }
  }
  const isMosaicEvent = (i: ContentItem) => mosaicEventIds.has(i.id)
  const railEvents = homeItems.filter(isRailEvent)
  const gridItems = homeItems.filter(
    (i) =>
      i.type !== 'partner' &&
      (!hero || i.id !== hero.id) &&
      // Non-eventos pass through; eventos require editorial or elevated.
      (i.type !== 'evento' || isMosaicEvent(i)),
  )

  return (
    <>
      {/* SHOWPIECE — signal-field background. The fluid is fixed at z-0
          (visible above the page background); the feed wrapper is lifted to
          z-10 so it always paints ABOVE the field by explicit z-order — not
          source-order luck, and without burying the fluid behind an opaque
          ancestor background (which z-[-1] did). */}
      <VibeFluid />

      <div className="relative z-10 flex gap-6">
        {/* Left category rail — desktop only, sticky */}
        <CategoryRail items={gridItems} />

        <div className="min-w-0 flex-1">
          {/* Pinned hero — editorial / review / noticia in portada */}
          {hero && <HeroCard item={hero} />}

          {/* Scraped-event firehose — auto-scrolling rail under the hero,
              above the main mosaic. Empty when no scraped events present. */}
          <EventosRail items={railEvents} />

          {/* Main feed header */}
          <div className="mb-4 flex items-start justify-between">
            <FeedHeader totalCount={gridItems.length} />
          </div>

          {/* Prominence-driven mosaic — wrapper merges any session drafts */}
          <HomeFeedWithDrafts items={gridItems} mode="home" />
        </div>

        {/* Independent right column — partners rail at top, marketplace
            entry directly below. PartnersRail keeps its own md:block + w
            wrapper; MarketplaceRail sits in its own w-[260px] block so the
            two visually align without changing PartnersRail's existing
            shape. */}
        <div className="hidden flex-col gap-4 md:flex">
          <PartnersRail items={partners} />
          <div className="w-[260px]">
            <MarketplaceRail partners={marketplacePartners} />
          </div>
        </div>
      </div>
    </>
  )
}
