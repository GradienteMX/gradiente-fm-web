'use client'

/**
 * FRANJA — the dossier at /f/[slug]. One of the few real routes: franjas are
 * identity hubs, like /u/ and /e/. Everything on it is a catalog fact or a
 * piece the franja put its name on; pieces open over the page (Lectura), the
 * market opens as a stack over it (?franja=&pieza=), and nothing here counts
 * followers, members or visits.
 *
 *   cabecera   who it is, where it is on the dial, its ways out, Seguir
 *   ficha      catalog facts + the band its catalog occupies + última actividad
 *   destacada  the franja's chosen piece, or plainly "lo más reciente"
 *   próximos   the nights ahead (its own, and — for rooms — what happens there)
 *   archivo    everything it presents, as a living mosaic (rankCategory)
 *   sobre      what others wrote about it — visibly not its own
 *   mercado    its crate, if it sells
 *   stickers   its marks for your credencial (a demo shelf: never charges)
 *   comunidad  a named future, not a control
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import { Suspense, useMemo, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import type { ContentItem } from '@/lib/types'
import { useItemById, useNow, useWorld } from '@/lib/store/world'
import { useUI } from '@/lib/store/ui'
import { ago } from '@/lib/logic/time'
import { rankCategory } from '@/lib/logic/feed'
import { tagLabel } from '@/lib/genres'
import { bandGradient, effectiveBand, energyHex, energyVariation } from '@/lib/vibe'
import { fitTitle } from '@/lib/typeset'
import { KIND_LABEL } from '@/components/dial/Dial'
import { FormatGlyph, FORMAT_LABEL, Mark } from '@/components/kit/Glyph'
import { Button } from '@/components/kit/Button'
import { Pieza } from '@/components/pieza/Pieza'
import { Organismo } from '@/components/organismo/Organismo'
import { MercadoUrlHost, useMercadoNav } from '@/components/mercado/Pila'
import { Funda } from '@/components/mercado/Funda'
import { listingsOf, storeStats } from '@/components/mercado/datos'
import { Estante } from '@/components/stickers/Estante'
import { archiveCounts, ARCHIVE_TABS, hostOf, KIND_SLOT, lastSignal, type ArchiveKey, type Linked } from './catalog'
import { useFranjaBySlug, useFranjaCatalog, useFrequency } from './useFranja'
import { Escala, useSintonia } from './Sintonia'
import { Placa } from './Placa'
import { Banda, Ficha } from './Ficha'
import { metaLine, PeekRow, RELATION_LABEL } from './Peek'
import { Seguir } from './Seguir'
import styles from './FranjaPage.module.css'

export function FranjaPage({ slug }: { slug: string }) {
  return (
    <Suspense fallback={null}>
      <FranjaRoute slug={slug} />
    </Suspense>
  )
}

function FranjaRoute({ slug }: { slug: string }) {
  const franja = useFranjaBySlug(slug)
  const hydrated = useWorld((s) => s.hydrated)
  if (!franja) {
    if (!hydrated) return <div className={styles.page} aria-busy="true" />
    return (
      <div className={styles.page}>
        <div className={styles.missing}>
          <p className={styles.missingTitle}>Esta franja no está en el dial.</p>
          <p className={styles.missingBody}>
            No hay ninguna estación con la dirección <code>/f/{slug}</code>. Pudo cambiar de nombre o no existir todavía.
          </p>
          <div className={styles.missingActions}>
            <Button variant="ink" href="/">
              Volver al campo
            </Button>
            <Button variant="ghost" href="/mercado">
              Ir al mercado
            </Button>
          </div>
        </div>
      </div>
    )
  }
  return (
    <>
      <Dossier franja={franja} />
      <MercadoUrlHost />
    </>
  )
}

function Dossier({ franja }: { franja: ContentItem }) {
  const now = useNow()
  const cat = useFranjaCatalog(franja)
  const { freq } = useFrequency(franja.id)
  const head = useRef<HTMLElement>(null)
  const openLectura = useUI((s) => s.openLectura)
  const { openTienda, openPieza } = useMercadoNav()

  const kind = franja.franjaKind ?? 'colectivo'
  const b = effectiveBand(franja)
  const mid = (b.min + b.max) / 2
  useSintonia(head, freq, mid)
  const listings = listingsOf(franja)
  const stats = storeStats(listings)
  const chosen = useItemById(franja.featuredItemId)
  const featured = chosen && chosen.type !== 'franja' ? chosen : cat.presenta[0] ?? null
  const featuredIsChosen = Boolean(chosen && featured && chosen.id === featured.id)
  const recent = cat.presenta.filter((i) => i.id !== featured?.id).slice(0, 3)
  const links = (franja.links ?? []).filter((l) => l.url !== franja.franjaUrl)
  const sobre: Linked[] = [
    ...cat.sobre.map((item) => ({ item, relation: 'sobre' as const })),
    ...cat.past.filter((e) => e.relation === 'aqui'),
  ]
  const hasCatalog = cat.presenta.length > 0
  const slotLabel = KIND_SLOT[kind].mode === 'eventos' ? KIND_SLOT[kind].label : 'Próximos eventos'
  let k = 0
  const n = () => String(++k).padStart(2, '0')

  return (
    <div className={styles.page} style={{ ['--e' as string]: energyHex(mid), ['--band' as string]: bandGradient(b.min, b.max) }}>
      {/* ── cabecera ─────────────────────────────────────────────────── */}
      <header ref={head} className={styles.cabecera}>
        <div className={styles.plateCol}>
          <div className={styles.plate} data-sint-plate="">
            <Placa franja={franja} sizes="(max-width: 900px) 60vw, 260px" priority rounded="lg" imprimir />
          </div>
          <Escala freq={freq} compact />
        </div>

        <div className={styles.identity}>
          <p className={styles.kicker}>
            <span className={styles.kindChip}>
              <span className={styles.bandMark} aria-hidden="true" />
              {KIND_LABEL[kind]}
            </span>
            {franja.verified ? (
              <span className={styles.verified} title="Franja verificada por Gradiente">
                <Mark name="check" size={11} /> Verificada
              </span>
            ) : null}
            {franja.sponsored ? (
              <span className={styles.sponsored} title="Gradiente tiene un acuerdo comercial con esta franja. Su lugar en el dial no cambia por eso.">
                Acuerdo comercial
              </span>
            ) : null}
            <span className={styles.path}>/f/{franja.slug}</span>
          </p>
          <div className={styles.titleBox}>
            <h1 data-sint-name="" data-trama="pendiente" className={styles.title} style={{ fontVariationSettings: energyVariation(mid), fontSize: fitTitle(franja.title, mid, 132, 40, 0.98) }}>
              {franja.title}
            </h1>
          </div>
          {franja.subtitle ? <p className={styles.subtitle}>{franja.subtitle}</p> : null}
          <p className={styles.meta}>
            <span className={styles.signalDot} aria-hidden="true" />
            Señal {ago(lastSignal(franja), now)}
            {franja.marketplaceLocation ? <span> · Zona {franja.marketplaceLocation}</span> : null}
            {cat.facts.desde ? <span> · {cat.facts.desde.declared ? 'Desde' : 'En el archivo desde'} {cat.facts.desde.year}</span> : null}
          </p>
          {franja.tags.length ? (
            <p className={styles.tags}>
              {franja.tags.map((t) => (
                <span key={t}>#{tagLabel(t)}</span>
              ))}
            </p>
          ) : null}
          {franja.excerpt || franja.bodyPreview ? <p className={styles.bio}>{franja.bodyPreview ?? franja.excerpt}</p> : null}
          <div className={styles.actions}>
            <Seguir franja={franja} size="lg" />
            {franja.franjaUrl ? (
              <Button variant="ghost" size="lg" href={franja.franjaUrl} icon={<Mark name="external" size={14} />}>
                {hostOf(franja.franjaUrl)}
              </Button>
            ) : null}
            {links.map((l) => (
              <Button key={l.url} variant="quiet" size="lg" href={l.url} iconRight={<Mark name="external" size={12} />}>
                {l.label}
              </Button>
            ))}
          </div>
          <p className={styles.private}>Seguir es privado: solo da forma a tu Taller. Aquí no se cuentan seguidores.</p>
        </div>

        <aside className={styles.fichaCol} aria-label="Ficha">
          <p className="label">Ficha</p>
          <Ficha facts={cat.facts} layout="column" hrefFor={(k) => `?archivo=${k}#archivo`} onProductos={listings.length ? () => openTienda(franja.slug) : undefined} />
          <Banda spectrum={cat.spectrum} />
          {recent.length ? (
            <div className={styles.recent}>
              <p className="label">Última actividad</p>
              {recent.map((r) => (
                <button key={r.id} type="button" className={styles.recentRow} onClick={(e) => openFrom(e.currentTarget, r.slug, openLectura)}>
                  <span className={styles.recentKind}>
                    <FormatGlyph type={r.type} size={11} /> {FORMAT_LABEL[r.type]} · {ago(r.publishedAt, now)}
                  </span>
                  <span className={styles.recentTitle}>{r.title}</span>
                </button>
              ))}
            </div>
          ) : null}
        </aside>
      </header>
      <span className={styles.bandLine} aria-hidden="true" />

      {/* ── destacada ────────────────────────────────────────────────── */}
      {featured ? (
        <section className={styles.section} aria-label={featuredIsChosen ? 'Historia destacada' : 'Lo más reciente'}>
          <Destacada item={featured} chosen={featuredIsChosen} franja={franja} />
        </section>
      ) : null}

      {/* ── próximos ─────────────────────────────────────────────────── */}
      {cat.upcoming.length ? (
        <section id="proximos" className={styles.section} aria-label="Próximos">
          <SectionHead n={n()} title="Próximos" note={`${cat.upcoming.length} en agenda · ${slotLabel.toLowerCase()}`} />
          <Proximos linked={cat.upcoming} franja={franja} />
        </section>
      ) : hasCatalog ? (
        <section id="proximos" className={styles.section} aria-label="Próximos">
          <SectionHead n={n()} title="Próximos" />
          <p className={styles.honest}>Sin fechas anunciadas. Cuando {franja.title} anuncie algo, aparece aquí primero.</p>
        </section>
      ) : null}

      {/* ── archivo ──────────────────────────────────────────────────── */}
      <section id="archivo" className={styles.section} aria-label="Archivo">
        {hasCatalog ? (
          <Archivo presenta={cat.presenta} n={n()} />
        ) : (
          <>
            <SectionHead n={n()} title="Archivo" />
            <div className={styles.nothing}>
              <p className={styles.nothingTitle}>{franja.title} todavía no publica en Gradiente.</p>
              <p className={styles.nothingBody}>
                Cuando lo haga, cada evento, mix o texto llevará su nombre y vivirá aquí, en su archivo.
                {listings.length ? ' Mientras tanto, su tienda está abierta más abajo.' : ''}
              </p>
            </div>
          </>
        )}
      </section>

      {/* ── sobre ────────────────────────────────────────────────────── */}
      <section className={styles.section} aria-label="Sobre esta franja">
        <SectionHead n={n()} title="Sobre esta franja" note={sobre.length ? 'escrito o anunciado por otros · no es suyo' : undefined} />
        {sobre.length ? (
          <div className={styles.sobre}>
            {sobre.slice(0, 12).map((e) => (
              <PeekRow key={e.item.id} item={e.item} relation={e.relation} />
            ))}
          </div>
        ) : (
          <p className={styles.honest}>Nadie ha escrito sobre {franja.title} en Gradiente todavía.</p>
        )}
      </section>

      {/* ── mercado ──────────────────────────────────────────────────── */}
      {listings.length ? (
        <section id="mercado" className={styles.section} aria-label="Mercado">
          <SectionHead
            n={n()}
            title="Mercado"
            note={`${stats.total} ${stats.total === 1 ? 'pieza' : 'piezas'} · ${stats.available} ${stats.available === 1 ? 'disponible' : 'disponibles'}`}
            action={
              <Button variant="ghost" onClick={(e) => openTienda(franja.slug, rectOf(e.currentTarget))} iconRight={<Mark name="arrow" size={13} />}>
                Abrir la tienda
              </Button>
            }
          />
          <div className={styles.crate}>
            {listings.slice(0, 10).map((l, i) => (
              <Funda key={l.id} listing={l} franja={franja} showStore={false} onOpen={(x, o) => openPieza(franja.slug, x.id, o)} priority={i < 5} sizes="(max-width: 700px) 50vw, 220px" />
            ))}
          </div>
          <p className={styles.nopay}>Gradiente no procesa pagos · el trato es directo con {franja.title}.</p>
        </section>
      ) : null}

      {/* ── stickers ─────────────────────────────────────────────────── */}
      <section id="stickers" className={styles.section} aria-label="Stickers">
        <SectionHead n={n()} title="Stickers" note="su marca para tu credencial, en varios acabados · demo, sin cobro" />
        <Estante franja={franja} variant="dossier" />
      </section>

      {/* ── comunidad ────────────────────────────────────────────────── */}
      <section className={styles.section} aria-label="Comunidad">
        <SectionHead n={n()} title="Comunidad" />
        <div className={styles.comunidad}>
          <p className={styles.comunidadQ}>¿Eres parte de {franja.title}?</p>
          <p className={styles.comunidadLine}>Membresía de club · próximamente</p>
          <p className={styles.comunidadNote}>Cuando exista vivirá en tu credencial, nunca como un número en esta página. Hoy los equipos de franja publican y venden desde su Taller.</p>
        </div>
      </section>
    </div>
  )
}

// ── pieces ──────────────────────────────────────────────────────────────────

function rectOf(el: Element | null) {
  const r = el?.getBoundingClientRect()
  return r ? { x: r.left, y: r.top, width: r.width, height: r.height } : null
}

function openFrom(el: Element | null, slug: string, openLectura: (s: string, o?: ReturnType<typeof rectOf>) => void) {
  openLectura(slug, rectOf(el))
}

function SectionHead({ n, title, note, action }: { n: string; title: string; note?: string; action?: React.ReactNode }) {
  return (
    <header className={styles.sectionHead}>
      <span className={styles.sectionIdx}>{n} /</span>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {note ? <span className={styles.sectionNote}>{note}</span> : null}
      {action ? <span className={styles.sectionAction}>{action}</span> : null}
    </header>
  )
}

function Destacada({ item, chosen, franja }: { item: ContentItem; chosen: boolean; franja: ContentItem }) {
  const now = useNow()
  const openLectura = useUI((s) => s.openLectura)
  const art = useRef<HTMLSpanElement>(null)
  const b = effectiveBand(item)
  const mid = (b.min + b.max) / 2
  return (
    <button
      type="button"
      className={styles.hero}
      style={{ ['--e' as string]: energyHex(mid), ['--band' as string]: bandGradient(b.min, b.max) }}
      onClick={() => openFrom(art.current, item.slug, openLectura)}
    >
      <span ref={art} className={styles.heroArt}>
        {item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="(max-width: 900px) 100vw, 1500px" className={styles.heroImg} priority /> : <span className={styles.heroPlate} style={{ background: bandGradient(b.min, b.max, '120deg') }} />}
        <span className={styles.heroEnergy} aria-hidden="true" />
      </span>
      <span className={styles.heroCaption}>
        <span className={styles.heroKicker}>
          {chosen ? `Historia destacada · elegida por ${franja.title}` : 'Lo más reciente'}
          <span className={styles.heroFormat}>
            <FormatGlyph type={item.type} size={12} /> {FORMAT_LABEL[item.type]}
          </span>
        </span>
        <span className={styles.heroTitleBox}>
          <span className={styles.heroTitle} style={{ fontVariationSettings: energyVariation(mid), fontSize: fitTitle(item.title, mid, 72, 28, 0.9) }}>
            {item.title}
          </span>
        </span>
        <span className={styles.heroMeta}>
          {metaLine(item, now)}
          <span className={styles.heroGo}>
            Leer <Mark name="arrow" size={14} />
          </span>
        </span>
      </span>
    </button>
  )
}

function Proximos({ linked, franja }: { linked: Linked[]; franja: ContentItem }) {
  const now = useNow()
  const mixed = linked.some((e) => e.relation !== 'presenta')
  const life = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rankCategory(linked.map((e) => e.item), now)) m.set(r.item.id, Math.min(1.2, r.score))
    return m
  }, [linked, now])
  return (
    <div className={styles.rail} data-lenis-prevent="">
      {linked.map((e, i) => (
        <div key={e.item.id} className={styles.railCell}>
          <div className={styles.railCard}>
            <Pieza item={e.item} layout={{ tier: 'md', colSpan: 1, rowSpan: 1, intensity: 1 }} life={life.get(e.item.id) ?? 0.5} priority={i < 4} />
          </div>
          {mixed ? (
            <span className={styles.railRel} data-relation={e.relation}>
              <span className={styles.railMark} aria-hidden="true" />
              {e.relation === 'presenta' ? `Presenta ${franja.title}` : RELATION_LABEL[e.relation]}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function Archivo({ presenta, n }: { presenta: ContentItem[]; n: string }) {
  const now = useNow()
  const params = useSearchParams()
  const pathname = usePathname() ?? '/'
  const counts = useMemo(() => archiveCounts(presenta), [presenta])
  const fromUrl = params.get('archivo') as ArchiveKey | null
  const initial: ArchiveKey = fromUrl && ARCHIVE_TABS.some((t) => t.key === fromUrl) && counts[fromUrl] ? fromUrl : 'todo'
  const [tab, setTab] = useState<ArchiveKey>(initial)
  // The address bar can change the tab too (back/forward, a shared link).
  const [seenUrl, setSeenUrl] = useState(fromUrl)
  if (seenUrl !== fromUrl) {
    setSeenUrl(fromUrl)
    if (fromUrl && fromUrl !== tab && ARCHIVE_TABS.some((t) => t.key === fromUrl) && counts[fromUrl]) setTab(fromUrl)
  }
  const active = ARCHIVE_TABS.find((t) => t.key === tab) ?? ARCHIVE_TABS[0]
  const minute = Math.floor(now.getTime() / 60_000)
  const ranked = useMemo(() => {
    const types = active.types as readonly string[]
    const list = types.length ? presenta.filter((i) => types.includes(i.type)) : presenta
    // Same sizes (life) and order (newest first) as every section page; only the
    // lg column anchors go — after a chronological sort they strand cards and
    // leave the archive's tail ragged. Dense flow packs it instead.
    return rankCategory(list, new Date(minute * 60_000)).map((r) => (r.layout.colStart ? { ...r, layout: { ...r.layout, colStart: undefined } } : r))
  }, [presenta, active, minute])

  const choose = (k: ArchiveKey) => {
    setTab(k)
    const q = new URLSearchParams(window.location.search)
    if (k === 'todo') q.delete('archivo')
    else q.set('archivo', k)
    const s = q.toString()
    window.history.replaceState(null, '', `${s ? `${pathname}?${s}` : pathname}#archivo`)
  }

  return (
    <>
      <SectionHead n={n} title="Archivo" note={`${presenta.length} ${presenta.length === 1 ? 'pieza' : 'piezas'} con su nombre · el tamaño es su vida; las más recientes primero`} />
      <div className={styles.tabs} role="tablist" aria-label="Filtrar el archivo">
        {ARCHIVE_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={styles.tab}
            data-on={tab === t.key || undefined}
            disabled={!counts[t.key]}
            onClick={() => choose(t.key)}
          >
            {t.label}
            <i>{counts[t.key]}</i>
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={active.label}>
        <Organismo ranked={ranked} empty={<p className={styles.honest}>Nada en esta categoría todavía.</p>} />
      </div>
    </>
  )
}

