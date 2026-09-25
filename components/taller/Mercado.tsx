'use client'

/**
 * MERCADO — a franja's storefront, from behind the counter. CATÁLOGO (the
 * pieces, their state changed in one gesture), OFERTAS (buyers' threads,
 * answered as the seller), AJUSTES (whether the store is visible, and in
 * what currency prices are written). Commerce never competes for HL: no
 * views, no popularity, nothing ranked here.
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ContentItem, MarketplaceListing, MarketplaceListingStatus, User } from '@/lib/types'
import type { ListingComment } from '@/lib/store/world-core'
import { newUuid, useDispatch, useWorld } from '@/lib/store/world'
import { perm } from '@/lib/store/session'
import { useUI } from '@/lib/store/ui'
import { ago } from '@/lib/logic/time'
import { flare } from '@/components/stage/api'
import { Mark } from '@/components/kit/Glyph'
import { Button } from '@/components/kit/Button'
import { Sheet } from '@/components/kit/Sheet'
import { TextField } from '@/components/kit/Field'
import { Revelado } from '@/components/trama/Revelado'
import { Accion, Latch, Nota, Panel, SubPanel, SubTabs, Vacio } from './kit'
import { CATEGORY_LABEL, CONDITION_LABEL, formatPrice, ListingForm, SHIPPING_LABEL, STATUS_LABEL, STATUSES } from './ListingForm'
import { plural, useTallerParams } from './logic'
import styles from './Mercado.module.css'

type Vista = 'catalogo' | 'ofertas' | 'ajustes'

/** Root ids of threads whose latest word is not the seller's. */
export function waitingThreads(comments: ListingComment[], franjaId: string): string[] {
  const latest = new Map<string, ListingComment>()
  for (const c of comments) {
    if (c.franjaId !== franjaId) continue
    const root = c.parentId ?? c.id
    const cur = latest.get(root)
    if (!cur || c.at > cur.at) latest.set(root, c)
  }
  return [...latest.entries()].filter(([, c]) => !c.isSeller).map(([root]) => root)
}

function Art({ src, sizes, className }: { src: string; sizes: string; className?: string }) {
  return <Image src={src} alt="" fill sizes={sizes} className={className} unoptimized={!src.startsWith('/')} />
}

export function MercadoSpace({ me, now, franja, flyers }: { me: User; now: Date; franja: ContentItem; flyers: string[] }) {
  const { params, set } = useTallerParams()
  const raw = params.get('vista')
  const vista: Vista = raw === 'ofertas' || raw === 'ajustes' ? raw : 'catalogo'
  const focus = params.get('pieza')
  const comments = useWorld((s) => s.world.listingComments)
  const mine = useMemo(() => {
    // Ids are unique by construction; a repeated id is a replayed row, shown once.
    const seen = new Set<string>()
    return comments.filter((c) => c.franjaId === franja.id && !seen.has(c.id) && Boolean(seen.add(c.id)))
  }, [comments, franja.id])
  const waiting = useMemo(() => waitingThreads(mine, franja.id), [mine, franja.id])
  const listings = useMemo(() => franja.marketplaceListings ?? [], [franja.marketplaceListings])
  const currency = franja.marketplaceCurrency?.trim() || 'MXN'
  const available = listings.filter((l) => l.status === 'available').length
  const can = perm.canManageFranja(me, franja.id)

  return (
    <div className={styles.mercado}>
      <header className={styles.head} data-rise="">
        <div className={styles.headText}>
          <Revelado as="h2" className={styles.title}>
            {`Mercado de ${franja.title}`}
          </Revelado>
          <p className={styles.sub}>
            {plural(listings.length, 'pieza', 'piezas')} en catálogo · {plural(available, 'disponible', 'disponibles')}
          </p>
        </div>
        <button type="button" className={styles.visible} data-on={franja.marketplaceEnabled || undefined} onClick={() => set({ vista: 'ajustes' })}>
          <span className={styles.visibleDot} aria-hidden="true" />
          {franja.marketplaceEnabled ? 'Tienda visible' : 'Tienda oculta'}
        </button>
      </header>

      <div data-rise="">
        <SubTabs<Vista>
          idBase="mercado"
          label="Secciones del mercado"
          value={vista}
          onChange={(v) => set({ vista: v === 'catalogo' ? null : v, pieza: null })}
          tabs={[
            { value: 'catalogo', label: <>Catálogo <span className={styles.n}>{listings.length}</span></> },
            {
              value: 'ofertas',
              label: (
                <>
                  Ofertas{' '}
                  {waiting.length ? (
                    <span className={styles.waiting} aria-label={`${waiting.length} sin responder`}>
                      {waiting.length}
                    </span>
                  ) : null}
                </>
              ),
            },
            { value: 'ajustes', label: 'Ajustes' },
          ]}
        />
        <SubPanel idBase="mercado" value={vista}>
          {vista === 'catalogo' ? (
            <Catalogo franja={franja} listings={listings} currency={currency} flyers={flyers} comments={mine} waiting={waiting} can={can} onOfertas={(id) => set({ vista: 'ofertas', pieza: id })} />
          ) : vista === 'ofertas' ? (
            <Ofertas me={me} now={now} franja={franja} listings={listings} comments={mine} waiting={waiting} currency={currency} focus={focus} can={can} />
          ) : (
            <Ajustes franja={franja} currency={currency} can={can} />
          )}
        </SubPanel>
      </div>
    </div>
  )
}

// ── CATÁLOGO ────────────────────────────────────────────────────────────────

function Catalogo({
  franja,
  listings,
  currency,
  flyers,
  comments,
  waiting,
  can,
  onOfertas,
}: {
  franja: ContentItem
  listings: MarketplaceListing[]
  currency: string
  flyers: string[]
  comments: ListingComment[]
  waiting: string[]
  can: boolean
  onOfertas: (listingId: string) => void
}) {
  const { params, set } = useTallerParams()
  const dispatch = useDispatch()
  const ask = useUI((s) => s.ask)
  const notify = useUI((s) => s.notify)
  const rawEstado = params.get('estado') as MarketplaceListingStatus | null
  const estado = rawEstado && STATUSES.includes(rawEstado) ? rawEstado : null
  const [editor, setEditor] = useState<{ listing: MarketplaceListing | null } | null>(null)

  const waitingBy = useMemo(() => {
    const m = new Map<string, number>()
    const roots = new Set(waiting)
    for (const c of comments) if (c.parentId === null && roots.has(c.id)) m.set(c.listingId, (m.get(c.listingId) ?? 0) + 1)
    return m
  }, [comments, waiting])

  const sorted = useMemo(
    () =>
      [...listings]
        .filter((l) => !estado || l.status === estado)
        // A waiting buyer outranks recency; then newest first.
        .sort((a, b) => (waitingBy.get(b.id) ?? 0) - (waitingBy.get(a.id) ?? 0) || b.publishedAt.localeCompare(a.publishedAt)),
    [listings, estado, waitingBy],
  )

  const upsert = (listing: MarketplaceListing) => dispatch({ t: 'listing-upsert', franjaId: franja.id, listing, at: new Date().toISOString() })

  const setStatus = (l: MarketplaceListing, status: MarketplaceListingStatus, el: HTMLElement) => {
    if (l.status === status) return
    upsert({ ...l, status })
    if (status === 'sold') flare(el, 5)
    notify(`«${l.title}»: ${STATUS_LABEL[status].toLowerCase()}.`)
  }

  const remove = async (l: MarketplaceListing) => {
    const ok = await ask({
      title: 'Eliminar esta pieza',
      body: `«${l.title}» sale del catálogo junto con sus conversaciones. No se puede deshacer; si solo se vendió, márcala como vendida.`,
      confirmLabel: 'Eliminar',
      destructive: true,
    })
    if (!ok) return
    dispatch({ t: 'listing-delete', franjaId: franja.id, listingId: l.id, at: new Date().toISOString() })
    notify('Pieza eliminada del catálogo.')
  }

  const counts = STATUSES.map((s) => listings.filter((l) => l.status === s).length)

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <Latch<string>
          label="Filtrar por estado"
          size="sm"
          value={estado ?? 'todas'}
          onChange={(v) => set({ estado: v === 'todas' ? null : v })}
          options={[
            { value: 'todas', label: <>Todas <span className={styles.n}>{listings.length}</span></> },
            ...STATUSES.map((s, i) => ({ value: s, label: <>{STATUS_LABEL[s]}s <span className={styles.n}>{counts[i]}</span></> })),
          ]}
        />
      </div>

      <ul className={styles.catalogo}>
        {can ? (
          <li>
            <button type="button" className={styles.nueva} onClick={() => setEditor({ listing: null })}>
              <span className={styles.nuevaPlus} aria-hidden="true">
                <Mark name="plus" size={22} />
              </span>
              <span className={styles.nuevaText}>Nueva pieza</span>
              <span className={styles.nuevaHint}>Un disco, una máquina, una playera.</span>
            </button>
          </li>
        ) : null}
        {sorted.map((l) => {
          const w = waitingBy.get(l.id) ?? 0
          return (
            <li key={l.id}>
              <article className={styles.listing} data-status={l.status}>
                <div className={styles.listingArt}>
                  {l.images[0] ? <Art src={l.images[0]} sizes="(max-width: 640px) 50vw, 260px" className={styles.cover} /> : <span className={styles.catPlate}>{CATEGORY_LABEL[l.category]}</span>}
                  <span className={styles.stamp} data-status={l.status}>
                    <i aria-hidden="true" />
                    {STATUS_LABEL[l.status]}
                  </span>
                </div>
                <div className={styles.listingBody}>
                  <p className={styles.listingCat}>{[CATEGORY_LABEL[l.category], l.subcategory, CONDITION_LABEL[l.condition]].filter(Boolean).join(' · ')}</p>
                  <h3 className={styles.listingTitle}>{l.title}</h3>
                  <p className={styles.price}>{formatPrice(l.price, currency)}</p>
                  <p className={styles.listingMeta}>{[l.shippingMode ? SHIPPING_LABEL[l.shippingMode] : null, l.images.length > 1 ? `${l.images.length} imágenes` : null].filter(Boolean).join(' · ') || ' '}</p>
                  {can ? (
                    <label className={styles.statusPick}>
                      <span className="sr-only">Estado de «{l.title}»</span>
                      <select value={l.status} onChange={(e) => setStatus(l, e.target.value as MarketplaceListingStatus, e.currentTarget)} data-status={l.status}>
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {w ? (
                    <button type="button" className={styles.waitingLink} onClick={() => onOfertas(l.id)}>
                      <span className={styles.waitingDot} aria-hidden="true" />
                      {w === 1 ? '1 conversación espera' : `${w} conversaciones esperan`}
                    </button>
                  ) : null}
                  {can ? (
                    <div className={styles.listingActions}>
                      <Accion onClick={() => setEditor({ listing: l })}>Editar</Accion>
                      <Accion tone="danger" onClick={() => remove(l)}>
                        Eliminar
                      </Accion>
                    </div>
                  ) : null}
                </div>
              </article>
            </li>
          )
        })}
      </ul>
      {sorted.length === 0 ? (
        <Vacio action={estado ? <Button variant="ghost" size="sm" onClick={() => set({ estado: null })}>Ver todas</Button> : undefined}>
          {estado ? 'Ninguna pieza con este estado.' : 'Tu catálogo empieza con una pieza: un disco, una máquina, una playera.'}
        </Vacio>
      ) : null}

      <Sheet open={Boolean(editor)} onClose={() => setEditor(null)} label={editor?.listing ? 'Editar pieza del mercado' : 'Nueva pieza del mercado'} variant="right" width={660}>
        {editor ? (
          <ListingForm
            key={editor.listing?.id ?? 'nueva'}
            listing={editor.listing}
            currency={currency}
            flyers={flyers}
            onCancel={() => setEditor(null)}
            onSubmit={(listing) => {
              upsert(listing)
              notify(editor.listing ? 'Pieza guardada.' : 'Pieza en el catálogo.', { tone: 'energy', energy: 5 })
              setEditor(null)
            }}
          />
        ) : null}
      </Sheet>
    </div>
  )
}

// ── OFERTAS ─────────────────────────────────────────────────────────────────

function Ofertas({
  me,
  now,
  franja,
  listings,
  comments,
  waiting,
  currency,
  focus,
  can,
}: {
  me: User
  now: Date
  franja: ContentItem
  listings: MarketplaceListing[]
  comments: ListingComment[]
  waiting: string[]
  currency: string
  focus: string | null
  can: boolean
}) {
  const users = useWorld((s) => s.world.users)
  const waitingSet = useMemo(() => new Set(waiting), [waiting])
  const groups = useMemo(() => {
    const byListing = new Map<string, ListingComment[]>()
    for (const c of comments) {
      const arr = byListing.get(c.listingId) ?? []
      arr.push(c)
      byListing.set(c.listingId, arr)
    }
    return listings
      .filter((l) => byListing.has(l.id))
      .map((l) => {
        const cs = byListing.get(l.id)!.sort((a, b) => a.at.localeCompare(b.at))
        const roots = cs.filter((c) => c.parentId === null)
        const threads = roots.map((r) => ({ root: r, replies: cs.filter((c) => c.parentId === r.id), waiting: waitingSet.has(r.id) }))
        const last = cs[cs.length - 1]?.at ?? ''
        return { listing: l, threads, waiting: threads.filter((t) => t.waiting).length, last }
      })
      .sort((a, b) => b.waiting - a.waiting || b.last.localeCompare(a.last))
  }, [comments, listings, waitingSet])

  const focusRef = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (focus) focusRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [focus])

  if (!groups.length) {
    return (
      <div className={styles.stack}>
        <Vacio>Ningún comprador ha escrito todavía. Cuando alguien pregunte por una pieza, la conversación aparece aquí.</Vacio>
        <Nota>Gradiente no cobra ni procesa pagos: la compra se acuerda directo entre personas.</Nota>
      </div>
    )
  }

  return (
    <div className={styles.stack}>
      <ul className={styles.ofertas}>
        {groups.map((g) => (
          <li key={g.listing.id} ref={g.listing.id === focus ? focusRef : undefined} data-focus={g.listing.id === focus || undefined}>
            <Panel
              label={
                <span className={styles.ofertaHead}>
                  <span className={styles.ofertaThumb}>{g.listing.images[0] ? <Art src={g.listing.images[0]} sizes="40px" className={styles.cover} /> : null}</span>
                  <span className={styles.ofertaName}>{g.listing.title}</span>
                </span>
              }
              meta={`${formatPrice(g.listing.price, currency)} · ${STATUS_LABEL[g.listing.status]}`}
              actions={g.waiting ? <span className={styles.waiting}>{g.waiting === 1 ? '1 espera' : `${g.waiting} esperan`}</span> : <span className={styles.answered}>Al día</span>}
            >
              <ul className={styles.threads}>
                {g.threads.map((t) => (
                  <Hilo key={t.root.id} me={me} now={now} franja={franja} listing={g.listing} root={t.root} replies={t.replies} waiting={t.waiting} users={users} can={can} />
                ))}
              </ul>
            </Panel>
          </li>
        ))}
      </ul>
      <Nota>Respondes como la franja: tus mensajes llevan la marca de quien vende. La compra se acuerda directo entre personas.</Nota>
    </div>
  )
}

function Hilo({
  me,
  now,
  franja,
  listing,
  root,
  replies,
  waiting,
  users,
  can,
}: {
  me: User
  now: Date
  franja: ContentItem
  listing: MarketplaceListing
  root: ListingComment
  replies: ListingComment[]
  waiting: boolean
  users: Record<string, User>
  can: boolean
}) {
  const dispatch = useDispatch()
  const [body, setBody] = useState('')
  const buyer = users[root.authorId]
  const send = (e: React.FormEvent) => {
    e.preventDefault()
    const text = body.trim()
    if (!text) return
    const at = new Date().toISOString()
    dispatch({
      t: 'listing-comment',
      comment: { id: newUuid(), listingId: listing.id, franjaId: franja.id, authorId: me.id, body: text, parentId: root.id, isSeller: true, at },
      at,
    })
    setBody('')
  }
  const line = (c: ListingComment) => {
    const u = users[c.authorId]
    return (
      <li key={c.id} className={styles.msg} data-seller={c.isSeller || undefined}>
        <p className={styles.msgHead}>
          <b>@{u?.username ?? 'alguien'}</b>
          {c.isSeller ? <span className={styles.sellerTag}>{franja.title}</span> : null}
          <span className={styles.msgWhen}>{ago(c.at, now)}</span>
        </p>
        <p className={styles.msgBody}>{c.body}</p>
      </li>
    )
  }
  return (
    <li className={styles.thread} data-waiting={waiting || undefined}>
      <ol className={styles.msgs}>
        {line(root)}
        {replies.map(line)}
      </ol>
      {can ? (
        <form className={styles.reply} onSubmit={send}>
          <TextField
            label={waiting ? `Responder a @${buyer?.username ?? 'quien pregunta'}` : 'Seguir la conversación'}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={1500}
            placeholder="Escribe como vendedor…"
          />
          <Button variant="ink" size="md" type="submit" disabled={!body.trim()}>
            Responder
          </Button>
        </form>
      ) : null}
    </li>
  )
}

// ── AJUSTES ─────────────────────────────────────────────────────────────────

function Ajustes({ franja, currency, can }: { franja: ContentItem; currency: string; can: boolean }) {
  const dispatch = useDispatch()
  const notify = useUI((s) => s.notify)
  const [moneda, setMoneda] = useState(franja.marketplaceCurrency ?? '')
  const on = Boolean(franja.marketplaceEnabled)
  const cleanMoneda = moneda.trim().toUpperCase()
  const monedaError = cleanMoneda && !/^[A-Z]{3,5}$/.test(cleanMoneda) ? 'Usa un código de 3 a 5 letras (MXN, USD, EUR).' : null

  const toggle = (el: HTMLElement) => {
    if (!can) return
    dispatch({ t: 'franja-patch', franjaId: franja.id, patch: { marketplaceEnabled: !on }, at: new Date().toISOString() })
    if (!on) flare(el, 5)
    notify(!on ? 'Tu tienda es visible en Mercado.' : 'Tu tienda quedó oculta. Nada se borró.')
  }
  const saveMoneda = (e: React.FormEvent) => {
    e.preventDefault()
    if (!can || monedaError || cleanMoneda === (franja.marketplaceCurrency ?? '')) return
    dispatch({ t: 'franja-patch', franjaId: franja.id, patch: { marketplaceCurrency: cleanMoneda }, at: new Date().toISOString() })
    notify(`Precios en ${cleanMoneda || 'MXN'}.`)
  }

  return (
    <div className={styles.ajustes}>
      <Panel label="Visibilidad">
        <div className={styles.switchRow}>
          <button type="button" role="switch" aria-checked={on} className={styles.switch} onClick={(e) => toggle(e.currentTarget)} disabled={!can}>
            <span className={styles.switchTrack} data-on={on || undefined}>
              <span className={styles.switchKnob} />
            </span>
            <span className={styles.switchLabel}>{on ? 'Tienda visible' : 'Tienda oculta'}</span>
          </button>
        </div>
        <p className={styles.ajusteText}>{on ? 'Tu catálogo aparece en Mercado y bajo el Dial del campo.' : 'Solo tu equipo ve el catálogo.'}</p>
        <p className={styles.ajusteNote}>Ocultar la tienda no borra piezas ni conversaciones.</p>
      </Panel>
      <Panel label="Moneda">
        <form className={styles.monedaForm} onSubmit={saveMoneda}>
          <TextField label="Moneda del catálogo" value={moneda} onChange={(e) => setMoneda(e.target.value)} maxLength={5} placeholder="MXN" error={monedaError} hint={`Hoy: ${currency}. Acompaña cada precio; no convertimos nada.`} disabled={!can} />
          <Button variant="ink" type="submit" disabled={!can || Boolean(monedaError) || cleanMoneda === (franja.marketplaceCurrency ?? '')}>
            Guardar
          </Button>
        </form>
      </Panel>
      <Nota>Gradiente no cobra comisión ni procesa pagos. Cada venta se acuerda directo entre personas, por la vía de contacto de cada pieza.</Nota>
    </div>
  )
}
