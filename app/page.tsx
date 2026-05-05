import { CalendarSidebar } from '@/components/CalendarSidebar'
import { CategoryRail } from '@/components/CategoryRail'
import { EventosRail } from '@/components/EventosRail'
import { HomeFeedWithDrafts } from '@/components/HomeFeedWithDrafts'
import { FeedHeader } from '@/components/FeedHeader'
import { HeroCard } from '@/components/HeroCard'
import { PartnersRail } from '@/components/PartnersRail'
import { MarketplaceRail } from '@/components/marketplace/MarketplaceRail'
import { getItems } from '@/lib/data/items'
import type { ContentItem } from '@/lib/types'
import { filterForHome, getEventDates, getPinnedHero } from '@/lib/utils'

// Reads from Supabase via cookies()-aware server client → forces dynamic.
// Will become `revalidate = 300` once the SYSTEM UPDATE countdown lands
// (see Backend Plan § "Realtime architecture").
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const now = new Date()
  const allItems = await getItems()
  const homeItems = filterForHome(allItems, now)
  const eventDates = getEventDates(allItems)
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
  const isRailEvent = (i: ContentItem) =>
    i.type === 'evento' && !i.elevated
  const isMosaicEvent = (i: ContentItem) =>
    i.type === 'evento' && (i.editorial === true || i.elevated === true)
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
      <CalendarSidebar eventDates={eventDates} />

      <div className="flex gap-6">
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
            <span className="sys-label hidden text-sys-green md:block">▶ FEED ACTIVO</span>
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
