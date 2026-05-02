import { CalendarSidebar } from '@/components/CalendarSidebar'
import { CategoryRail } from '@/components/CategoryRail'
import { EventosRail } from '@/components/EventosRail'
import { HomeFeedWithDrafts } from '@/components/HomeFeedWithDrafts'
import { FeedHeader } from '@/components/FeedHeader'
import { HeroCard } from '@/components/HeroCard'
import { PartnersRail } from '@/components/PartnersRail'
import { MarketplaceRail } from '@/components/marketplace/MarketplaceRail'
import { MOCK_ITEMS } from '@/lib/mockData'
import { filterForHome, getEventDates, getPinnedHero } from '@/lib/utils'

export default function HomePage() {
  const now = new Date()
  const homeItems = filterForHome(MOCK_ITEMS, now)
  const eventDates = getEventDates(MOCK_ITEMS)
  const hero = getPinnedHero(MOCK_ITEMS)

  // Partners live in the right rail, never in the main mosaic
  const partners = MOCK_ITEMS.filter((i) => i.type === 'partner')

  // Scraped events not flagged `elevated` go to the EventosRail; everything
  // else (editorial, mixes, noticias, manually-authored events, AND scraped
  // events the editor elevated) competes in the main mosaic via HP. See
  // wiki/70-Roadmap/Scraper Pipeline.md for the phase strategy this models.
  const isRailEvent = (i: typeof MOCK_ITEMS[number]) =>
    i.source === 'scraper:ra' && !i.elevated
  const railEvents = homeItems.filter(isRailEvent)
  const gridItems = homeItems.filter(
    (i) =>
      i.type !== 'partner' &&
      (!hero || i.id !== hero.id) &&
      !isRailEvent(i),
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
            <MarketplaceRail />
          </div>
        </div>
      </div>
    </>
  )
}
