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
  // Past events appear in the mosaic (filler + archive feel) but NOT in the
  // rail — the rail's job is "PRÓXIMOS · ORDEN CRONOLÓGICO", mixing past in
  // there muddies the message even with //PASADO badges.
  const isRailEvent = (i: ContentItem) =>
    i.type === 'evento' && !i.elevated && isUpcoming(i, now)
  // Past events bypass the editorial/elevated gate — they fill the mosaic
  // as historical context, not curation. Upcoming events still need a flag
  // to leave the rail and enter the mosaic.
  const isMosaicEvent = (i: ContentItem) =>
    i.type === 'evento' &&
    (i.editorial === true || i.elevated === true || !isUpcoming(i, now))
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
