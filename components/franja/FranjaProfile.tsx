'use client'

import { useMemo, useState } from 'react'
import { ArrowUpRight, ExternalLink, Mail, MapPin } from 'lucide-react'
import { formatDistanceToNowStrict, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { ContentItem } from '@/lib/types'
import { fmtDateFull } from '@/lib/utils'
import { categoryColorOnLight } from '@/lib/dashboard/palette'
import { useOverlay } from '@/components/overlay/useOverlay'
import { KIND_LABEL, TYPE_LABEL } from '@/components/overlay/FranjaOverlay'
import { MarketplaceListingCard } from '@/components/marketplace/MarketplaceListingCard'
import { MarketplaceListingDetail } from '@/components/marketplace/MarketplaceListingDetail'
import { SmartImage } from '@/components/SmartImage'

// ── FranjaProfile — the printed franja EXPEDIENTE (fase F, «EL PLIEGO») ─────
//
// The full /f/[slug] franja page. Sibling document to /u/[username]: the same
// printed register — red kicker, Syne section titles on ink hairlines, a
// right-hand ficha column, ink chips — but about a BAND ON THE DIAL rather
// than a person.
//
// Zones: identity head + résumé (catalog facts only — NO vanity metrics per
// [[Size and Position as Only Signals]]) + última actividad, PRÓXIMOS rail,
// ARCHIVO with type tabs, MERCADO (real listings), SEÑALES (a declared
// MOCKUP — see below), and a COMUNIDAD strip.
//
// `attributedItems` is fetched SERVER-SIDE (getItemsByFranja) so a direct
// visit works — the client itemsCache is only warm on grid pages. Opening a
// linked item uses useOverlay().open() so it stacks over the page (OverlayRouter
// lives in the layout).

// House focus ring on paper grounds (fase C/F).
const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

// The mono label register — the paper replacement for the old dark
// terminal label class (removed here in fase F).
const LABEL = 'font-mono text-d11 font-bold uppercase tracking-widest'

// SEÑALES — MOCKUP DATA, NOT A CATALOGUE. Gradiente-native digital cosmetics
// that would alter a user's presence (emoji / profile / shader / collectible).
// No product class exists yet — these ride the separate, unbuilt payments +
// order_items spine and MUST stay disjoint from EARNED trophies/frames/emoji.
// The fase-F ruling: this block survives ONLY behind an explicit PRÓXIMAMENTE
// declaration and with nothing in it that reads as buyable. Hence the dashed
// mockup frame, the ink PRÓXIMAMENTE band, the «PRECIO TENTATIVO» phrasing
// and zero interactive elements below. Cut the block outright before ever
// letting it look like a store.
const MOCK_SENALES = [
  {
    id: 'se-emoji',
    tag: 'EXCLUSIVO',
    name: 'Emojis exclusivos',
    sub: 'Pack de reacciones',
    price: 40,
  },
  {
    id: 'se-perfil',
    tag: 'PERFIL',
    name: 'Sticker de perfil',
    sub: 'Marco / firma',
    price: 25,
  },
  {
    id: 'se-shader',
    tag: 'SHADER',
    name: 'Shader pack',
    sub: 'Para visuales',
    price: 90,
  },
  {
    id: 'se-visual',
    tag: 'COLECCIONABLE',
    name: 'Pack visual',
    sub: 'Fondos exclusivos',
    price: 120,
  },
]

const ARCHIVE_TABS: {
  key: string
  label: string
  types: ContentItem['type'][]
}[] = [
  { key: 'todo', label: 'TODO', types: [] },
  { key: 'eventos', label: 'EVENTOS', types: ['evento'] },
  { key: 'lanzamientos', label: 'LANZAMIENTOS', types: ['mix', 'review'] },
  { key: 'articulos', label: 'ARTÍCULOS', types: ['articulo', 'listicle'] },
  {
    key: 'noticias',
    label: 'NOTICIAS',
    types: ['noticia', 'editorial', 'opinion'],
  },
]

export function FranjaProfile({
  franja,
  attributedItems,
}: {
  franja: ContentItem
  attributedItems: ContentItem[]
}) {
  const item = franja
  const kind = item.franjaKind ?? 'colectivo'
  const { open } = useOverlay()
  const [activeListingId, setActiveListingId] = useState<string | null>(null)

  // Attributed content (//PRESENTA self-FK), server-fetched + sorted newest
  // first. Drives PRÓXIMOS / ARCHIVO / catalog facts / actividad / featured.
  const allItems = useMemo(
    () =>
      [...attributedItems].sort(
        (a, b) =>
          new Date(b.date ?? b.publishedAt).getTime() -
          new Date(a.date ?? a.publishedAt).getTime(),
      ),
    [attributedItems],
  )

  const counts = useMemo(
    () => ({
      eventos: allItems.filter((i) => i.type === 'evento').length,
      lanzamientos: allItems.filter(
        (i) => i.type === 'mix' || i.type === 'review',
      ).length,
      articulos: allItems.filter(
        (i) => i.type === 'articulo' || i.type === 'listicle',
      ).length,
      total: allItems.length,
    }),
    [allItems],
  )

  const featured = useMemo(
    () =>
      item.featuredItemId
        ? (allItems.find((i) => i.id === item.featuredItemId) ?? null)
        : null,
    [item.featuredItemId, allItems],
  )

  const listings = useMemo(
    () =>
      item.marketplaceEnabled
        ? [...(item.marketplaceListings ?? [])].sort(
            (a, b) =>
              new Date(b.publishedAt).getTime() -
              new Date(a.publishedAt).getTime(),
          )
        : [],
    [item.marketplaceEnabled, item.marketplaceListings],
  )
  const activeListing = useMemo(() => {
    if (!activeListingId) return null
    const idx = listings.findIndex((l) => l.id === activeListingId)
    return idx < 0 ? null : { listing: listings[idx], index: idx + 1 }
  }, [activeListingId, listings])

  const proximos = useMemo(() => {
    const now = Date.now()
    return allItems
      .filter(
        (i) =>
          i.type === 'evento' &&
          new Date(i.endDate ?? i.date ?? i.publishedAt).getTime() >= now,
      )
      .sort(
        (a, b) =>
          new Date(a.date ?? a.publishedAt).getTime() -
          new Date(b.date ?? b.publishedAt).getTime(),
      )
  }, [allItems])

  const recent = allItems.slice(0, 3)

  return (
    <div className="flex flex-col gap-8">
      {/* ── CABECERA — the document head ───────────────────────────────── */}
      <header className="grid grid-cols-1 gap-6 border-b border-ink pb-6 md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)_300px] lg:gap-0">
        {/* Logo plate — 2px ink border, object-contain so logo franjas
            (Club Japan, labels) aren't cropped. */}
        <div className="relative aspect-square w-full max-w-[220px] shrink-0 overflow-hidden border-2 border-ink bg-paper-raised">
          {item.imageUrl ? (
            <SmartImage
              src={item.imageUrl}
              alt={item.title}
              sizes="(max-width: 768px) 100vw, 240px"
              className="object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-syne text-5xl font-extrabold text-ink">
              {item.title.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        {/* Identity block */}
        <div className="flex min-w-0 flex-col gap-3 lg:pl-6 lg:pr-8">
          <p className={`${LABEL} text-sys-red-paper`}>
            FRANJA · /F/{item.slug.toUpperCase()}
          </p>

          <h1 className="min-w-0 break-words font-syne text-display font-extrabold uppercase leading-none text-ink">
            {item.title}
          </h1>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {/* Kind chip — ink chip + category swatch, the expediente's
                IdentityChip anatomy. */}
            <span
              className={`inline-flex items-center gap-1.5 border border-ink px-2 py-0.5 ${LABEL} text-ink`}
            >
              <span
                aria-hidden
                className="h-2 w-2 border border-ink"
                style={{ backgroundColor: categoryColorOnLight('franja') }}
              />
              {KIND_LABEL[kind]}
            </span>
            {item.verified && (
              <span
                className={`inline-flex items-center gap-1.5 border border-ink bg-ink px-2 py-0.5 ${LABEL} text-paper`}
                title="Franja verificada"
              >
                ✓ VERIFICADA
              </span>
            )}
            {item.year && (
              <span className="font-mono text-d11 tracking-widest text-ink-faint">
                DESDE · {item.year}
              </span>
            )}
            {item.marketplaceLocation && (
              <span className="font-mono text-d11 tracking-widest text-ink-faint">
                ZONA · {item.marketplaceLocation.toUpperCase()}
              </span>
            )}
          </div>

          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((t) => (
                <span
                  key={t}
                  className="border border-ink-faint px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-ink-faint"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {item.excerpt && (
            <p className="max-w-[62ch] font-grotesk text-d15 leading-relaxed text-ink-soft">
              {item.excerpt}
            </p>
          )}

          {item.franjaUrl && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <a
                href={item.franjaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex min-h-11 items-center gap-1.5 border border-ink px-2.5 ${LABEL} text-ink transition-colors hover:bg-ink hover:text-paper ${FOCUS_RING}`}
              >
                <ExternalLink size={12} />
                {item.franjaUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
              <a
                href={item.franjaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex min-h-11 items-center gap-1.5 border border-ink px-2.5 ${LABEL} text-ink transition-colors hover:bg-ink hover:text-paper ${FOCUS_RING}`}
              >
                <Mail size={12} />
                CONTACTO
              </a>
            </div>
          )}
        </div>

        {/* ── Right column — the ficha ─────────────────────────────────── */}
        <aside
          aria-label="Ficha de la franja"
          className="flex flex-col gap-4 border-t border-ink pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"
        >
          <dl className="flex flex-col">
            <FichaRow label="EVENTOS" value={counts.eventos} />
            <FichaRow label="LANZAMIENTOS" value={counts.lanzamientos} />
            <FichaRow label="ARTÍCULOS" value={counts.articulos} />
            <FichaRow label="PUBLICACIONES" value={counts.total} />
            <FichaRow label="PRODUCTOS" value={listings.length} />
            {item.year ? <FichaRow label="DESDE" value={item.year} /> : null}
          </dl>

          {recent.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-ink pt-3">
              <h2 className={`${LABEL} text-ink-soft`}>ÚLTIMA ACTIVIDAD</h2>
              {recent.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => open(r.slug)}
                  aria-label={`Abrir ${r.title}`}
                  className={`group flex min-h-11 flex-col items-start justify-center gap-0.5 border-l-2 border-ink pl-2.5 text-left transition-colors hover:bg-paper-raised ${FOCUS_RING}`}
                >
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
                    NUEVO {TYPE_LABEL[r.type]}
                  </span>
                  <span className="line-clamp-1 font-grotesk text-d13 text-ink-soft transition-colors group-hover:text-ink">
                    {r.title}
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-ink-faint">
                    {ago(r.date ?? r.publishedAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </aside>
      </header>

      {/* ── BODY: main column + sidebar ────────────────────────────────── */}
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-8">
          {/* HISTORIA DESTACADA */}
          {featured && (
            <section aria-labelledby="destacada-head" className="flex flex-col gap-3">
              <SectionHeader id="destacada-head" title="Historia destacada" />
              <button
                type="button"
                onClick={() => open(featured.slug)}
                aria-label={`Abrir ${featured.title}`}
                className={`group block w-full overflow-hidden border border-ink bg-paper-raised text-left ${FOCUS_RING}`}
              >
                {/* Plate — the artwork stays clean; every piece of chrome
                    lives in the caption band below (fase B card law). */}
                <div className="relative aspect-[21/9] w-full overflow-hidden bg-ink/10">
                  {featured.imageUrl ? (
                    <SmartImage
                      src={featured.imageUrl}
                      alt=""
                      sizes="(max-width: 1024px) 100vw, 640px"
                      className="object-cover object-top transition-transform duration-700 ease-out group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-mono text-d11 uppercase tracking-widest text-ink-faint">
                      SIN IMAGEN
                    </div>
                  )}
                </div>
                <div className="flex items-end justify-between gap-4 border-t border-ink p-4">
                  <div className="flex min-w-0 flex-col gap-2">
                    <TypeChip type={featured.type} />
                    <h3 className="font-syne text-d28 font-extrabold leading-tight text-ink">
                      {featured.title}
                    </h3>
                  </div>
                  <span
                    className={`shrink-0 ${LABEL} text-ink-soft transition-colors group-hover:text-ink`}
                  >
                    VER →
                  </span>
                </div>
              </button>
            </section>
          )}

          {/* PRÓXIMOS — horizontal rail of upcoming events */}
          <section aria-labelledby="proximos-head" className="flex flex-col gap-3">
            <SectionHeader
              id="proximos-head"
              title="Próximos"
              note={
                proximos.length > 0
                  ? `${proximos.length} EN AGENDA`
                  : 'SIN FECHAS ANUNCIADAS'
              }
            />
            {proximos.length === 0 ? (
              <EmptyZone hint="Sin eventos próximos vinculados por ahora." />
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {proximos.map((ev) => (
                  <MiniCard
                    key={ev.id}
                    item={ev}
                    onOpen={() => open(ev.slug)}
                    className="w-[200px] shrink-0"
                  />
                ))}
              </div>
            )}
          </section>

          {/* ARCHIVO — type-tabbed grid */}
          <ArchivoSection items={allItems} onOpen={(slug) => open(slug)} />
        </div>

        {/* Sidebar — MERCADO + SEÑALES */}
        <aside className="flex shrink-0 flex-col gap-8 lg:w-[340px]">
          {listings.length > 0 && (
            <section
              id="mercado"
              aria-labelledby="mercado-head"
              className="flex scroll-mt-24 flex-col gap-3"
            >
              <SectionHeader
                id="mercado-head"
                title="Mercado"
                note={`${listings.length} LISTADOS`}
                action={item.franjaUrl ? 'VER TIENDA' : undefined}
                actionHref={item.franjaUrl}
              />
              <div className="grid grid-cols-2 gap-3">
                {listings.map((l, i) => (
                  <MarketplaceListingCard
                    key={l.id}
                    listing={l}
                    franja={item}
                    index={i + 1}
                    onClick={() => setActiveListingId(l.id)}
                  />
                ))}
              </div>
            </section>
          )}

          <SenalesSection />
        </aside>
      </div>

      {/* ── COMUNIDAD strip ────────────────────────────────────────────── */}
      <section aria-labelledby="comunidad-head" className="flex flex-col gap-4">
        <SectionHeader id="comunidad-head" title={`Comunidad · ${item.title}`} />
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <dl className="flex flex-wrap gap-x-10 gap-y-4">
            <StatCell label="EVENTOS REALIZADOS" value={counts.eventos} />
            <StatCell label="PUBLICACIONES" value={counts.total} />
            {item.marketplaceLocation && (
              <div className="flex flex-col gap-0.5">
                <dt className={`${LABEL} text-ink-faint`}>UBICACIÓN</dt>
                <dd className="inline-flex items-center gap-1.5 font-mono text-d15 font-bold text-ink">
                  <MapPin size={13} />
                  {item.marketplaceLocation}
                </dd>
              </div>
            )}
          </dl>

          {/* Declared future — club membership (guardados → club-perks
              roadmap). NOT a control: the flow doesn't exist, so this is a
              printed line stating what is coming, never a pressable chip. */}
          <div className="flex flex-col items-start gap-1 border-l-2 border-ink pl-3 md:items-start">
            <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
              ¿ERES PARTE DE {item.title.toUpperCase()}?
            </span>
            <span className={`${LABEL} text-ink`}>
              MEMBRESÍA DE CLUB · PRÓXIMAMENTE
            </span>
          </div>
        </div>
      </section>

      {/* Listing detail — z-[60] sub-overlay */}
      {activeListing && (
        <MarketplaceListingDetail
          listing={activeListing.listing}
          franja={item}
          index={activeListing.index}
          onClose={() => setActiveListingId(null)}
        />
      )}
    </div>
  )
}

// ── Archive section (type tabs + grid) ──────────────────────────────────────

function ArchivoSection({
  items,
  onOpen,
}: {
  items: ContentItem[]
  onOpen: (slug: string) => void
}) {
  const [tab, setTab] = useState('todo')
  const active = ARCHIVE_TABS.find((t) => t.key === tab) ?? ARCHIVE_TABS[0]
  const filtered = useMemo(
    () =>
      active.types.length === 0
        ? items
        : items.filter((i) => active.types.includes(i.type)),
    [items, active],
  )

  if (items.length === 0) {
    return (
      <section aria-labelledby="archivo-head" className="flex flex-col gap-3">
        <SectionHeader id="archivo-head" title="Archivo" />
        <EmptyZone hint="Sin contenido vinculado a este franja por ahora." />
      </section>
    )
  }

  return (
    <section aria-labelledby="archivo-head" className="flex flex-col gap-3">
      <SectionHeader
        id="archivo-head"
        title="Archivo"
        note={`${items.length} PIEZAS`}
      />
      {/* Type latches — the active tab is an ink-filled block; the rest are
          hairline chips that invert on hover. One grammar, no hue coding. */}
      <div
        role="group"
        aria-label="Filtrar archivo por tipo"
        className="flex flex-wrap gap-1.5 border-b border-ink pb-2"
      >
        {ARCHIVE_TABS.map((t) => {
          const isActive = t.key === active.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-pressed={isActive}
              className={`inline-flex min-h-11 items-center border border-ink px-2.5 ${LABEL} transition-colors ${
                isActive
                  ? 'bg-ink text-paper'
                  : 'text-ink hover:bg-ink hover:text-paper'
              } ${FOCUS_RING}`}
            >
              {t.label}
            </button>
          )
        })}
      </div>
      {filtered.length === 0 ? (
        <EmptyZone hint="Nada en esta categoría todavía." />
      ) : (
        <ul
          className="grid gap-3"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          }}
        >
          {filtered.map((i) => (
            <li key={i.id}>
              <MiniCard item={i} onOpen={() => onOpen(i.slug)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ── Señales (DECLARED MOCKUP) ───────────────────────────────────────────────
//
// Kept only under an unmissable PRÓXIMAMENTE declaration: an ink band above
// the block, a dashed MOCKUP frame around it, «PRECIO TENTATIVO» instead of
// a price tag, and zero interactive elements — nothing here can be clicked,
// focused, or bought. If that framing ever gets softened, delete the block.

function SenalesSection() {
  return (
    <section aria-labelledby="senales-head" className="flex flex-col gap-3">
      <SectionHeader id="senales-head" title="Señales" note="NO DISPONIBLE" />

      {/* The declaration — ink fill block, impossible to skim past. */}
      <p
        role="note"
        className={`bg-ink px-3 py-2 ${LABEL} text-paper`}
      >
        PRÓXIMAMENTE · BOCETO · NADA DE ESTO ESTÁ A LA VENTA
      </p>

      <p className="font-grotesk text-d13 leading-relaxed text-ink-soft">
        Cosméticos digitales que extenderán tu presencia en Gradiente. Todavía
        no existen: lo de abajo es un boceto de lo que se está diseñando.
      </p>

      <div className="border border-dashed border-ink-faint p-3">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-ink-faint">
          BOCETO · SIN PRECIOS DEFINITIVOS
        </p>
        <div className="grid grid-cols-2 gap-3">
          {MOCK_SENALES.map((s) => (
            <article
              key={s.id}
              className="flex select-none flex-col gap-1 border border-ink-faint bg-paper p-3"
            >
              <span className="self-start border border-ink-faint px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-ink-faint">
                {s.tag}
              </span>
              <h4 className="font-syne text-d13 font-extrabold leading-tight text-ink-soft">
                {s.name}
              </h4>
              <span className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">
                {s.sub}
              </span>
              <span className="mt-1 font-mono text-[10px] uppercase tracking-widest text-ink-faint">
                PRECIO TENTATIVO · ${s.price} MXN
              </span>
            </article>
          ))}
        </div>
      </div>

      <p className="font-grotesk text-d13 leading-relaxed text-ink-soft">
        Cuando existan, los ingresos apoyarán a la franja. Los cosméticos
        pagados nunca reemplazan logros ganados.
      </p>
    </section>
  )
}

// ── Shared bits ─────────────────────────────────────────────────────────────

// Section head, expediente anatomy — Syne title on an ink hairline with a
// mono note (and optionally a real link) on the right.
function SectionHeader({
  id,
  title,
  note,
  action,
  actionHref,
}: {
  id?: string
  title: string
  note?: string
  action?: string
  actionHref?: string
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ink pb-2">
      <h2 id={id} className="font-syne text-d28 font-extrabold text-ink">
        {title}
      </h2>
      <div className="flex items-baseline gap-3">
        {note && (
          <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
            {note}
          </span>
        )}
        {action && actionHref && (
          <a
            href={actionHref}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1 ${LABEL} text-ink transition-colors hover:bg-ink hover:text-paper ${FOCUS_RING}`}
          >
            {action} <ArrowUpRight size={11} />
          </a>
        )}
      </div>
    </div>
  )
}

// Type chip — 2-letter category swatch + label, the house anatomy (hue is
// never the sole signal).
function TypeChip({ type }: { type: ContentItem['type'] }) {
  return (
    <span
      className={`inline-flex w-fit shrink-0 items-center gap-1.5 border border-ink bg-paper-raised px-1.5 py-0.5 ${LABEL} text-ink`}
    >
      <span
        aria-hidden
        className="h-[9px] w-[9px] shrink-0"
        style={{ backgroundColor: categoryColorOnLight(type) }}
      />
      {TYPE_LABEL[type]}
    </span>
  )
}

// Ficha row — hairline-ruled label/value pair (the expediente's dl anatomy).
function FichaRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-ink py-2">
      <dt className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
        {label}
      </dt>
      <dd className="font-mono text-d13 font-bold tabular-nums text-ink">
        {value}
      </dd>
    </div>
  )
}

function StatCell({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className={`${LABEL} text-ink-faint`}>{label}</dt>
      <dd className="font-syne text-d28 font-extrabold tabular-nums text-ink">
        {value}
      </dd>
    </div>
  )
}

// Compact flyer-forward card for próximos + archivo. Click opens the item
// overlay over the page. Poster-first: art stays clean, chrome sits in the
// caption band below the ink hairline.
function MiniCard({
  item,
  onOpen,
  className = '',
}: {
  item: ContentItem
  onOpen: () => void
  className?: string
}) {
  const hasDate = !!item.date && !Number.isNaN(parseISO(item.date).getTime())
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Abrir ${item.title}`}
      className={`group block w-full overflow-hidden border border-ink bg-paper-raised text-left transition-colors hover:bg-paper ${FOCUS_RING} ${className}`}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-ink/10">
        {item.imageUrl ? (
          <SmartImage
            src={item.imageUrl}
            alt=""
            sizes="(max-width: 768px) 45vw, 240px"
            className="object-cover object-top transition-transform duration-700 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-mono text-[9px] uppercase tracking-widest text-ink-faint">
            SIN IMAGEN
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5 border-t border-ink p-2.5">
        <TypeChip type={item.type} />
        <h3 className="line-clamp-2 font-syne text-d13 font-extrabold leading-tight text-ink">
          {item.title}
        </h3>
        <p className="line-clamp-1 font-mono text-[9px] uppercase tracking-widest text-ink-faint">
          {item.venue ??
            (hasDate ? fmtDateFull(item.date!) : TYPE_LABEL[item.type])}
        </p>
      </div>
    </button>
  )
}

function ago(iso: string): string {
  try {
    return `HACE ${formatDistanceToNowStrict(parseISO(iso), {
      locale: es,
    }).toUpperCase()}`
  } catch {
    return ''
  }
}

// Empty zone — a ruled, dashed placeholder. No fake rows, no fake status:
// it names what's missing and stops.
function EmptyZone({ hint }: { hint: string }) {
  return (
    <div className="flex flex-col items-start gap-1.5 border border-dashed border-ink-faint bg-paper-raised p-4">
      <span className={`${LABEL} text-ink-faint`}>//SIN·VÍNCULOS·VISIBLES</span>
      <p className="font-grotesk text-d13 leading-relaxed text-ink-soft">
        {hint}
      </p>
    </div>
  )
}
