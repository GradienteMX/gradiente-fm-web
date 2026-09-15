'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Sprout } from 'lucide-react'
import { useAuth } from '@/components/auth/useAuth'
import { canCreateContent } from '@/lib/permissions'
import { useDashboardData } from '@/components/dashboard/DashboardDataProvider'
import { HarvestConfirmModal } from '@/components/dashboard/HarvestConfirmModal'
import type { DashboardWidgetProps } from '@/components/dashboard/grid/WidgetGrid'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'
import { dashWidgetDomId, scrollToDashWidget } from '@/components/dashboard/shell/StatusStrip'
import { SmartImage } from '@/components/SmartImage'
import { useOpenItem, ITEM_ROW_SELECT, mapItemRowToContentItem } from '@/lib/dashboard/openItem'
import { getPublishedItemSync, setPublishedItemLocal } from '@/lib/publishedItemsCache'
import { createClient } from '@/lib/supabase/client'
import { currentHp } from '@/lib/curation'
import { PUBLICATION_LABELS, publicationLabel, selectPublications } from '@/lib/dashboard/publications'
import type { ContentItem } from '@/lib/types'
import { isComposeType, useComposeNav } from '@/components/dashboard/widgets/cultivar/CrearZone'
import { publicationTint, relTimeShort } from '@/components/dashboard/widgets/CrearWidget'

export function CultivarWidget({ size }: DashboardWidgetProps) {
  return <PublicationCollection size={size}/>
}

// The panel preview and Publicar gallery share navigation and harvest handling.
export function PublicationCollection({ size = { w: 12, h: 5 }, full = false }: { size?: DashboardWidgetProps['size']; full?: boolean }) {
  const { published, drafts, afterMutation, lastTickAt, loaded, errors } = useDashboardData()
  const { currentUser } = useAuth()
  const openItem = useOpenItem()
  const composeNav = useComposeNav()
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const tab = search.get('collection') === 'drafts' ? 'drafts' : 'published'
  const rawSort = search.get('collectionSort')
  const sort = rawSort === 'title' || rawSort === 'type' ? rawSort : 'date'
  const rawFilter = search.get('collectionType') ?? 'all'
  const filter = Object.hasOwn(PUBLICATION_LABELS, rawFilter) ? rawFilter : 'all'
  const rawPage = Number(search.get('collectionPage') ?? 0)
  const page = Number.isFinite(rawPage) ? Math.max(0, Math.floor(rawPage)) : 0
  const updateCollection = (values: Record<string, string>) => {
    // Commit client-only filters immediately. Reading the current URL avoids
    // dropping an earlier choice when two controls change before a render.
    const params = new URLSearchParams(window.location.search)
    Object.entries(values).forEach(([key, value]) => params.set(key, value))
    window.history.replaceState(null, '', `${pathname}?${params}`)
  }
  const [notice, setNotice] = useState<string | null>(null)
  const dense = !full && size.h <= 3
  const perPage = size.h < 3 ? 1 : size.w >= 8 ? 3 : 2
  const rows = useMemo(() => {
    void lastTickAt
    const selected = tab === 'drafts'
      ? drafts.filter((item) => item._draftState === 'draft' && isComposeType(item.type)).map((item) => ({ item: item as ContentItem, date: item._updatedAt }))
      : published.filter((item) => isComposeType(item.type)).map((item) => ({ item: getPublishedItemSync(item.id) ?? item, date: item.publishedAt }))
    return selectPublications(selected, sort, filter)
  }, [drafts, published, tab, sort, filter, lastTickAt])
  const pages = full ? 1 : Math.max(1, Math.ceil(rows.length / perPage))
  const currentPage = Math.min(page, pages - 1)
  const visible = full ? rows : rows.slice(currentPage * perPage, (currentPage + 1) * perPage)

  const [harvestTarget, setHarvestTarget] = useState<ContentItem | null>(null)
  const harvestTargetRef = useRef<ContentItem | null>(null)
  const harvestedRef = useRef(false)
  const openHarvest = (item: ContentItem) => {
    harvestedRef.current = false
    harvestTargetRef.current = item
    setHarvestTarget(item)
  }
  // Reinsert synchronously after the modal invalidates the cache, so a
  // successful harvest never briefly removes the publication from its card.
  const onHarvested = useCallback((echo: number) => {
    const item = harvestTargetRef.current
    if (!item) return
    const nowIso = new Date().toISOString()
    setPublishedItemLocal({ ...item, harvestedAt: nowIso, harvestedAmount: echo,
      hp: Math.max(0, currentHp(item) - echo), hpDecayMultiplier: 1.7, hpLastUpdatedAt: nowIso })
    harvestedRef.current = true
  }, [])
  const onModalClose = useCallback(() => {
    const item = harvestTargetRef.current
    harvestTargetRef.current = null
    setHarvestTarget(null)
    if (harvestedRef.current) {
      harvestedRef.current = false
      void afterMutation()
    } else if (item) void reconcileHarvestState(item.id)
  }, [afterMutation])
  const view = async (item: ContentItem) => {
    setNotice(null)
    if (!await openItem(item.slug)) setNotice('No se pudo abrir esta publicación. Inténtalo de nuevo.')
  }
  const edit = (item: ContentItem) => { if (isComposeType(item.type) && canCreateContent(currentUser, item.type)) composeNav(item.type, item.id) }
  const busy = tab === 'drafts' ? !loaded.drafts : !loaded.published
  const failed = tab === 'drafts' ? errors.drafts : errors.published

  return (
    <section id={dashWidgetDomId('cultivar')} aria-label="Publicaciones" className={`flex min-h-0 scroll-mt-14 flex-col ${full ? 'gap-4 border-t border-ink/25 pt-5' : 'h-full gap-2'}`}>
      <header className="flex items-center justify-between gap-3">
        <h2 className={`font-syne font-extrabold text-ink ${full ? 'text-d18 md:text-d28' : 'text-d15 md:text-d18'}`}>PUBLICACIONES</h2>
        {!full && <button type="button" onClick={() => {
          const params = new URLSearchParams(search.toString())
          params.set('espacio', 'publicar')
          params.delete('collectionPage')
          router.push(`${pathname}?${params}`, { scroll: false })
        }} className={`min-h-9 shrink-0 font-mono text-d11 hover:underline ${FOCUS_RING}`}>VER TODAS →</button>}
      </header>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 border-b border-ink/25">
        <div className="mb-2 flex border border-ink/30" aria-label="Mostrar publicaciones">
          {(['published', 'drafts'] as const).map((value) => <button key={value} type="button" aria-pressed={tab === value}
            onClick={() => updateCollection({ collection: value, collectionPage: '0' })}
            className={`min-h-11 px-4 font-mono text-d11 ${tab === value ? 'bg-ink font-bold text-paper' : 'text-ink-soft hover:bg-paper-raised'} ${FOCUS_RING}`}>
            {value === 'published' ? 'Publicadas' : 'Borradores'}
          </button>)}
        </div>
        <div className="mb-2 flex max-w-full flex-wrap gap-2">
        <select aria-label="Ordenar publicaciones" value={sort} onChange={(event) => updateCollection({ collectionSort: event.target.value, collectionPage: '0' })} className={`min-h-11 max-w-full border border-ink/30 bg-transparent px-2 font-mono text-d11 text-ink ${FOCUS_RING}`}>
          <option value="date">{tab === 'drafts' ? 'Última edición' : 'Fecha de publicación'}</option>
          <option value="title">Título A–Z</option>
          <option value="type">Tipo de publicación</option>
        </select>
        {full && <select aria-label="Filtrar por tipo de publicación" value={filter} onChange={(event) => updateCollection({ collectionType: event.target.value, collectionPage: '0' })} className={`min-h-11 max-w-full border border-ink/30 bg-transparent px-2 font-mono text-d11 text-ink ${FOCUS_RING}`}>
          <option value="all">Todos los tipos</option>
          {Object.entries(PUBLICATION_LABELS).map(([type, label]) => <option key={type} value={type}>{label}</option>)}
        </select>}
        {!full && filter !== 'all' && <button type="button" onClick={() => updateCollection({ collectionType: 'all', collectionPage: '0' })} className={`min-h-11 font-mono text-d11 underline ${FOCUS_RING}`}>QUITAR FILTRO</button>}
        </div>
      </div>
      {notice && <p role="status" className="font-mono text-d11 text-ink">{notice}</p>}
      {visible.length ? (
        <div className={full ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4' : 'flex min-h-0 flex-1 snap-x snap-mandatory gap-4 overflow-x-auto pb-1'}>
          {visible.map(({ item, date }) => <article key={item.id} className={`flex flex-col overflow-hidden border border-ink/25 bg-paper-raised ${full ? 'min-w-0' : 'min-w-[78%] flex-1 snap-start sm:min-w-0'} ${dense ? 'md:flex-row' : ''}`}>
            <button type="button" onClick={() => tab === 'drafts' ? edit(item) : void view(item)} aria-label={`${tab === 'drafts' ? 'Continuar' : 'Ver'} ${item.title || 'Sin título'}`}
              disabled={tab === 'drafts' && !canCreateContent(currentUser, item.type)}
              className={`relative w-full shrink-0 overflow-hidden bg-ink/5 ${full ? 'aspect-square' : `h-56 min-h-32 md:h-auto md:min-h-0 md:flex-1 ${dense ? 'md:w-1/3' : ''}`} ${FOCUS_RING}`}>
              {item.imageUrl ? <SmartImage src={item.imageUrl} alt="" sizes="(min-width: 1280px) 440px, 360px" className="object-cover transition-transform duration-300 hover:scale-105 motion-reduce:transform-none" />
                : <span className={`flex h-full min-h-32 items-center justify-center font-syne text-2xl font-extrabold text-ink/60 ${publicationTint(item.type)}`}>{publicationLabel(item.type)}</span>}
            </button>
            <div className={`flex shrink-0 flex-col px-3 pt-3 ${full ? 'flex-1' : ''} ${dense ? 'md:w-2/3 md:overflow-y-auto' : ''}`}>
              <span className="flex items-center gap-2 font-mono text-d11 uppercase tracking-widest text-ink-soft"><span aria-hidden className={`h-3 w-3 shrink-0 ${publicationTint(item.type)}`}/>{publicationLabel(item.type)}</span>
              <button type="button" disabled={tab === 'drafts' && !canCreateContent(currentUser, item.type)} onClick={() => tab === 'drafts' ? edit(item) : void view(item)} className={`mt-1 line-clamp-2 min-h-12 text-left font-syne text-d18 font-bold leading-tight text-ink enabled:hover:underline ${FOCUS_RING}`}>{item.title || 'Sin título'}</button>
              <span className="font-mono text-d11 text-ink-soft">{tab === 'drafts' ? relTimeShort(date) : new Date(date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <div className="mt-2 flex min-h-11 flex-wrap items-center gap-x-3 border-t border-ink/20 font-mono text-d11 text-ink">
                {tab === 'published' && <button type="button" onClick={() => void view(item)} className={`min-h-11 hover:underline ${FOCUS_RING}`}>VER</button>}
                {canCreateContent(currentUser, item.type) && <button type="button" onClick={() => edit(item)} className={`min-h-11 hover:underline ${FOCUS_RING}`}>{tab === 'drafts' ? 'CONTINUAR' : 'EDITAR'}</button>}
                {tab === 'published' && (item.harvestedAt ? <span className="ml-auto text-ink-soft">COSECHADO</span> : <button type="button" onClick={() => openHarvest(item)} className={`group ml-auto flex min-h-11 items-center gap-1 font-bold text-cultivate hover:underline ${FOCUS_RING}`}>CULTIVAR<Sprout aria-hidden size={16} className="transition-transform group-hover:-rotate-12 motion-reduce:transform-none"/></button>)}
              </div>
            </div>
          </article>)}
        </div>
      ) : <div className="flex min-h-28 flex-1 flex-col items-start justify-center gap-3 border border-dashed border-ink/30 bg-paper-raised p-5">
        <p role="status" className="font-grotesk text-d15 text-ink-soft">{busy ? 'Cargando publicaciones…' : failed ? 'No se pudieron cargar las publicaciones.' : filter !== 'all' ? 'No hay publicaciones de este tipo.' : tab === 'drafts' ? 'Todavía no tienes borradores.' : 'Tu próxima publicación empieza aquí.'}</p>
        {!busy && <button type="button" onClick={() => failed ? void afterMutation() : filter !== 'all' ? updateCollection({ collectionType: 'all', collectionPage: '0' }) : scrollToDashWidget('crear')} className={`min-h-11 font-mono text-d13 font-bold underline ${FOCUS_RING}`}>{failed ? 'REINTENTAR' : filter !== 'all' ? 'VER TODOS LOS TIPOS' : 'CREAR PUBLICACIÓN'}</button>}
      </div>}
      {pages > 1 && <nav aria-label="Páginas de publicaciones" className="flex shrink-0 items-center justify-end gap-3 font-mono text-d11">
        <button type="button" disabled={currentPage === 0} onClick={() => updateCollection({ collectionPage: String(currentPage - 1) })} className={`min-h-9 px-2 disabled:opacity-40 ${FOCUS_RING}`}>← ANTERIORES</button>
        <span>{currentPage + 1}/{pages}</span>
        <button type="button" disabled={currentPage === pages - 1} onClick={() => updateCollection({ collectionPage: String(currentPage + 1) })} className={`min-h-9 px-2 disabled:opacity-40 ${FOCUS_RING}`}>SIGUIENTES →</button>
      </nav>}
      {harvestTarget && <HarvestConfirmModal item={harvestTarget} open onClose={onModalClose} onHarvested={onHarvested}/>}
    </section>
  )
}

export async function reconcileHarvestState(itemId: string): Promise<void> {
  try {
    const { data, error } = await createClient().from('items').select(ITEM_ROW_SELECT).eq('id', itemId).maybeSingle()
    if (!error && data) setPublishedItemLocal(mapItemRowToContentItem(data))
  } catch { /* The next provider refresh reconciles failed reads. */ }
}
