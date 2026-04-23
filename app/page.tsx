import { CalendarSidebar } from '@/components/CalendarSidebar'
import { CategoryRail } from '@/components/CategoryRail'
import { ContentGrid } from '@/components/ContentGrid'
import { HeroCard } from '@/components/HeroCard'
import { PartnersRail } from '@/components/PartnersRail'
import { MOCK_ITEMS } from '@/lib/mockData'
import { filterForHome, getEventDates, getPinnedHero } from '@/lib/utils'

export default function HomePage() {
  const now = new Date()
  const homeItems = filterForHome(MOCK_ITEMS, now)
  const eventDates = getEventDates(MOCK_ITEMS)
  const hero = getPinnedHero(MOCK_ITEMS)

  // Partners live in the rail, never in the main mosaic
  const partners = MOCK_ITEMS.filter((i) => i.type === 'partner')

  // Don't show the hero item again or partners inside the main grid
  const gridItems = homeItems.filter(
    (i) => i.type !== 'partner' && (!hero || i.id !== hero.id),
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

          {/* Main feed header */}
          <div className="mb-4 flex items-start justify-between">
            <div>
              <div className="nge-divider mb-1">
                <span className="font-mono text-xs tracking-widest text-primary">TODO LO QUE VIENE</span>
              </div>
              <p className="sys-label">
                {gridItems.length} ENTRADAS · PROMINENCIA ORGÁNICA · SEÑAL + FRESCURA
              </p>
            </div>
            <span className="sys-label hidden text-sys-green md:block">▶ FEED ACTIVO</span>
          </div>

          {/* Prominence-driven mosaic */}
          <ContentGrid items={gridItems} mode="home" />
        </div>

        {/* Independent partners rail — chronological, no ranking, no vibe filter */}
        <PartnersRail items={partners} />
      </div>
    </>
  )
}
