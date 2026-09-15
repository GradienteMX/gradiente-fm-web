'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/auth/useAuth'
import { ActividadWidget, type ActivityFilter } from '@/components/dashboard/widgets/ActividadWidget'
import { ReceptionSpace } from '@/components/dashboard/espacios/ReceptionSpace'
import { useDashboardData } from '@/components/dashboard/DashboardDataProvider'
import { SmartImage } from '@/components/SmartImage'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'
import { TROPHY_CATALOG } from '@/lib/trophies'
import { TrophyGlyph } from '@/components/trophies/TrophyGlyphs'
import { formatPrice } from '@/components/dashboard/espacios/listingForm'

const VIEWS = [['all', 'TODO'], ['comments', 'COMENTARIOS'], ['reactions', 'REACCIONES'], ['offers', 'OFERTAS'], ['sales', 'VENTAS'], ['hp', 'HP']] as const

export function ActivitySpace() {
  const search = useSearchParams()
  const { currentUser } = useAuth()
  const { franja, engagement, trophies, loaded, errors, afterMutation } = useDashboardData()
  const raw = search.get('activity')
  const view = VIEWS.find(([key]) => key === raw)?.[0] ?? 'all'
  const sold = franja?.listings.filter((listing) => listing.status === 'sold') ?? []
  const earned = TROPHY_CATALOG.filter((trophy) => trophies.has(trophy.key))
  const select = (value: string) => {
    const params = new URLSearchParams(window.location.search)
    params.set('activity', value)
    window.history.replaceState(null, '', `${window.location.pathname}?${params}`)
  }
  return <section className="flex flex-col gap-5 pb-10">
    <h2 className="font-syne text-[clamp(1.75rem,8vw,3rem)] font-extrabold md:text-5xl">ACTIVIDAD</h2>
    <nav aria-label="Filtrar actividad" className="grid grid-cols-3 border-b border-ink/30 pb-3 sm:grid-cols-6">
      {VIEWS.map(([key, label]) => <button key={key} type="button" onClick={() => select(key)} aria-pressed={view === key}
        className={`min-h-11 px-2 py-3 font-mono text-d11 sm:text-d13 ${view === key ? 'bg-ink text-paper' : 'text-ink hover:bg-ink/5'} ${FOCUS_RING}`}>{label}</button>)}
    </nav>
    {view === 'hp' ? <ReceptionSpace embedded /> : <div className="grid items-start gap-6 lg:grid-cols-4">
      <div className="min-w-0 lg:col-span-3">
        {view === 'sales' ? <section className="flex flex-col gap-4">
          <h3 className="font-syne text-d28 font-extrabold">OBJETOS VENDIDOS</h3>
          <p className="font-grotesk text-d13 text-ink-soft">Publicaciones que tu equipo marcó como vendidas.</p>
          {errors.franja ? <div><p role="status">No se pudo cargar el catálogo.</p><button type="button" onClick={() => void afterMutation('franja')} className={`min-h-11 font-mono text-d13 underline ${FOCUS_RING}`}>REINTENTAR</button></div>
            : !loaded.franja && currentUser?.franjaId ? <p role="status">Cargando catálogo…</p> : !sold.length ? <p className="py-8 font-grotesk text-d15 text-ink-soft">Todavía no hay objetos marcados como vendidos.</p>
            : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{sold.map((listing) =>
              <Link key={listing.id} href={`/dashboard?espacio=mercado&tab=ofertas&listing=${encodeURIComponent(listing.id)}`} className={`flex min-w-0 flex-col border border-ink/25 bg-paper-raised ${FOCUS_RING}`}>
                <div className="relative aspect-square bg-publication-news/30">{listing.images[0] && <SmartImage src={listing.images[0]} alt={listing.title} sizes="(max-width: 640px) 100vw, 400px" className="object-cover" />}</div>
                <div className="flex flex-1 flex-col gap-3 p-4"><h4 className="font-grotesk text-d18 font-bold">{listing.title}</h4>
                  <p className="font-mono text-d15">{formatPrice(listing.price, franja?.marketplaceCurrency ?? null)}</p>
                  <span className="mt-auto border-t border-ink/20 pt-3 font-mono text-d11">VENDIDO · VER ↗</span></div>
              </Link>)}</div>}
        </section> : <ActividadWidget size={{ w: 12, h: 4 }} compact={false} editing={false} full embedded activityFilter={view as ActivityFilter} />}
      </div>
      <aside className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1 lg:border-l lg:border-ink/25 lg:pl-6">
        <section aria-label="Tu presencia" className="border-b border-ink/25 pb-5">
          <h3 className="font-syne text-d28 font-extrabold">TU HP</h3>
          <p className="mt-4 font-grotesk text-6xl font-bold tabular-nums leading-none text-hp">{engagement ? engagement.hp.toFixed(1) : '—'}</p>
          <p className="mt-3 font-mono text-d11 tracking-widest text-ink-soft">HUMAN PRESENCE</p>
          <button type="button" onClick={() => select('hp')} className={`mt-4 min-h-11 font-mono text-d13 ${FOCUS_RING}`}>VER DETALLE ↗</button>
        </section>
        <section aria-label="Logros">
          <h3 className="font-syne text-d28 font-extrabold">LOGROS</h3>
          {earned.length ? earned.map((trophy) => <details key={trophy.key} className="border-b border-ink/20">
            <summary className={`flex min-h-20 cursor-pointer list-none items-center gap-4 py-3 [&::-webkit-details-marker]:hidden ${FOCUS_RING}`}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-ink"><TrophyGlyph trophyKey={trophy.key} /></span>
              <span className="font-grotesk text-d15">{trophy.label}</span>
            </summary>
            <p className="pb-4 font-grotesk text-d13 leading-relaxed text-ink-soft">{trophy.description}</p>
          </details>) : <p className="py-5 font-grotesk text-d13 text-ink-soft">{loaded.trophies ? 'Tus próximos logros aparecerán aquí.' : 'Cargando logros…'}</p>}
        </section>
      </aside>
    </div>}
  </section>
}
