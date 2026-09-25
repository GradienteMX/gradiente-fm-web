'use client'

/**
 * FRANJAS — the bands on the dial. Create, correct, and one power over the
 * market: the abuse kill switch. Storefronts are self-service for each team
 * (from the Taller); Central can only hide one — or restore it.
 *
 * Franjas live outside the mosaic and ignore the horizon, so nothing here
 * talks about HL. Every save of an existing franja re-stamps its last signal
 * (franjaLastUpdated), which moves it to the front of the dial — the form
 * says so before saving.
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import { useMemo, useState } from 'react'
import type { ContentItem, FranjaKind, User } from '@/lib/types'
import { useDispatch, useWorld } from '@/lib/store/world'
import { useUI } from '@/lib/store/ui'
import { Chip } from '@/components/kit/Bits'
import { Button } from '@/components/kit/Button'
import { HoldButton } from '@/components/kit/HoldButton'
import { Mark } from '@/components/kit/Glyph'
import { fmt } from '@/lib/logic/time'
import { FRANJA_KIND_LABEL, FRANJA_KINDS, int, matches, slugify } from './data'
import { useQuery } from './query'
import { ArtPicker } from './ArtPicker'
import { ConfirmPhrase, Empty, Field, Note, Pane, Step, Toggle, cx, inputClass, selectClass, tagClass, textareaClass } from './kit'
import s from './Franjas.module.css'

const FILTROS = ['todas', 'sin-logo', 'tienda'] as const
type Filtro = (typeof FILTROS)[number]

export function Franjas({ me, logos }: { me: User; logos: string[] }) {
  const { get, set } = useQuery()
  const rawFiltro = get('filtro')
  const filtro: Filtro = rawFiltro && (FILTROS as readonly string[]).includes(rawFiltro) ? (rawFiltro as Filtro) : 'todas'
  const q = get('q') ?? ''
  const sel = get('franja')

  const itemsMap = useWorld((st) => st.world.items)
  const users = useWorld((st) => st.world.users)
  const franjas = useMemo(
    () => Object.values(itemsMap).filter((i) => i.type === 'franja').sort((a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base' })),
    [itemsMap],
  )
  const team = useMemo(() => {
    const m = new Map<string, number>()
    for (const u of Object.values(users)) if (u.franjaId) m.set(u.franjaId, (m.get(u.franjaId) ?? 0) + 1)
    return m
  }, [users])
  const presented = useMemo(() => {
    const m = new Map<string, number>()
    for (const it of Object.values(itemsMap)) if (it.franjaId && it.type !== 'franja') m.set(it.franjaId, (m.get(it.franjaId) ?? 0) + 1)
    return m
  }, [itemsMap])

  const counts = {
    todas: franjas.length,
    'sin-logo': franjas.filter((f) => !f.imageUrl).length,
    tienda: franjas.filter((f) => f.marketplaceEnabled).length,
  }
  const list = franjas.filter(
    (f) =>
      (filtro === 'todas' || (filtro === 'sin-logo' ? !f.imageUrl : f.marketplaceEnabled)) &&
      (!q || matches(f.title, q) || matches(f.slug, q) || matches(FRANJA_KIND_LABEL[f.franjaKind ?? 'colectivo'], q)),
  )
  const selected = sel && sel !== 'nueva' ? itemsMap[sel] ?? null : null

  return (
    <div className={s.franjas}>
      <div className={s.cols}>
        <Pane
          n="01"
          title="El dial"
          note={`${int(franjas.length)} franjas · fuera del mosaico, sordas al horizonte`}
          flush
          actions={
            <Button size="sm" variant={sel === 'nueva' ? 'ink' : 'ghost'} icon={<Mark name="plus" size={13} />} onClick={() => set({ franja: 'nueva' })}>
              Nueva
            </Button>
          }
        >
          <div className={s.tools}>
            <div className={s.chips} role="group" aria-label="Filtro de franjas">
              {FILTROS.map((f) => (
                <Chip key={f} on={filtro === f} onClick={() => set({ filtro: f === 'todas' ? null : f })}>
                  {f === 'todas' ? 'Todas' : f === 'sin-logo' ? 'Sin logo' : 'Con tienda'}
                  <span className={s.n}>{counts[f]}</span>
                </Chip>
              ))}
            </div>
            <label className={s.search}>
              <span className="sr-only">Buscar franjas</span>
              <Mark name="search" size={14} />
              <input className={cx(inputClass, s.searchInput)} type="search" defaultValue={q} onChange={(e) => set({ q: e.target.value.trim() || null })} placeholder="Nombre, slug o tipo…" />
            </label>
          </div>
          {list.length ? (
            <ul className={s.list}>
              {list.map((f) => {
                const on = f.id === sel
                return (
                  <li key={f.id}>
                    <button type="button" className={s.item} data-on={on || undefined} aria-pressed={on} onClick={() => set({ franja: on ? null : f.id })}>
                      <Logo franja={f} size={40} />
                      <span className={s.itemText}>
                        <span className={s.itemTitle}>{f.title}</span>
                        <span className={s.itemSub}>
                          {FRANJA_KIND_LABEL[f.franjaKind ?? 'colectivo']} · /{f.slug}
                        </span>
                      </span>
                      <span className={s.itemFlags}>
                        {!f.imageUrl ? (
                          <span className={tagClass} data-warn>
                            Sin logo
                          </span>
                        ) : null}
                        {f.marketplaceEnabled ? <span className={tagClass}>Tienda</span> : null}
                        {team.get(f.id) ? <span className={tagClass} data-dashed>Equipo {team.get(f.id)}</span> : null}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <Empty>{filtro === 'sin-logo' ? 'Todas las franjas tienen logo.' : 'Ninguna franja coincide.'}</Empty>
          )}
        </Pane>

        <div className={s.side}>
          {sel === 'nueva' ? (
            <Composer key="nueva" me={me} logos={logos} franja={null} teamCount={0} presentedCount={0} onDone={(id) => set({ franja: id })} />
          ) : selected ? (
            <Composer
              key={selected.id}
              me={me}
              logos={logos}
              franja={selected}
              teamCount={team.get(selected.id) ?? 0}
              presentedCount={presented.get(selected.id) ?? 0}
              onDone={(id) => set({ franja: id })}
            />
          ) : (
            <div className={s.placeholder}>
              <p className={s.placeholderTitle}>Elige una franja del dial, o crea una nueva.</p>
              <p className={s.placeholderText}>
                Aquí se corrige su identidad, su logo y — solo como interruptor de abuso — la visibilidad de su tienda.
              </p>
              <Button variant="ghost" icon={<Mark name="plus" size={14} />} onClick={() => set({ franja: 'nueva' })}>
                Nueva franja
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function Logo({ franja, size }: { franja: ContentItem; size: number }) {
  if (franja.imageUrl)
    return (
      <span className={s.logo} style={{ width: size, height: size }}>
        <Image src={franja.imageUrl} alt="" fill sizes={`${size * 2}px`} />
      </span>
    )
  return (
    <span className={s.logo} data-empty style={{ width: size, height: size }} title="Sin logo">
      <span style={{ fontSize: size * 0.42 }}>{franja.title.slice(0, 1).toUpperCase()}</span>
    </span>
  )
}

// ── composer ────────────────────────────────────────────────────────────────

interface Form {
  title: string
  slug: string
  kind: FranjaKind
  url: string
  logo: string | null
  market: boolean
  location: string
  currency: string
  description: string
}

function formOf(f: ContentItem | null): Form {
  return {
    title: f?.title ?? '',
    slug: f?.slug ?? '',
    kind: f?.franjaKind ?? 'colectivo',
    url: f?.franjaUrl ?? '',
    logo: f?.imageUrl ?? null,
    market: f?.marketplaceEnabled ?? false,
    location: f?.marketplaceLocation ?? '',
    currency: f?.marketplaceCurrency ?? 'MXN',
    description: f?.marketplaceDescription ?? '',
  }
}

function Composer({
  me,
  logos,
  franja,
  teamCount,
  presentedCount,
  onDone,
}: {
  me: User
  logos: string[]
  franja: ContentItem | null
  teamCount: number
  presentedCount: number
  onDone: (id: string | null) => void
}) {
  const dispatch = useDispatch()
  const notify = useUI((st) => st.notify)
  const itemsMap = useWorld((st) => st.world.items)
  const users = useWorld((st) => st.world.users)
  const create = franja === null
  const initial = useMemo(() => formOf(franja), [franja])
  const [f, setF] = useState<Form>(initial)
  const [slugTouched, setSlugTouched] = useState(false)
  const [picker, setPicker] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const put = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }))

  const slug = create ? (slugTouched ? slugify(f.slug) : slugify(f.title)) : f.slug
  const id = create ? `pa-${slug}` : franja.id
  const slugTaken = create && Boolean(slug) && (Boolean(itemsMap[id]) || Object.values(itemsMap).some((i) => i.slug === slug))
  const errors = {
    title: f.title.trim().length < 2 ? 'El nombre es obligatorio.' : null,
    slug: create ? (!slug ? 'El slug sale del nombre; escribe uno.' : slugTaken ? `Ya existe una pieza o franja con /${slug}.` : null) : null,
    url: f.url && !/^https?:\/\//.test(f.url.trim()) ? 'Una URL empieza con http:// o https://' : null,
  }
  const invalid = Object.values(errors).some(Boolean)
  const dirty = create || (Object.keys(initial) as Array<keyof Form>).some((k) => initial[k] !== f[k])

  const subtitle = `${FRANJA_KIND_LABEL[f.kind]} · ${f.location.trim() || 'CDMX'}`

  const save = () => {
    if (invalid || !dirty) return
    const at = new Date().toISOString()
    if (create) {
      // Production's franja id shape (`pa-<slug>-<4>`, as /api/admin/franjas
      // mints it): the slug stays unique by the check above; the suffix keeps
      // the id from ever meeting an old row's. The route keeps this id.
      const rowId = `pa-${slug}-${Math.random().toString(36).slice(2, 6).padEnd(4, '0')}`
      const item: ContentItem = {
        id: rowId,
        slug,
        type: 'franja',
        title: f.title.trim(),
        subtitle,
        vibeMin: 5,
        vibeMax: 5,
        genres: [],
        tags: [],
        imageUrl: f.logo ?? undefined,
        publishedAt: at,
        franjaKind: f.kind,
        franjaUrl: f.url.trim() || undefined,
        franjaLastUpdated: at,
        marketplaceEnabled: f.market,
        marketplaceLocation: f.location.trim() || undefined,
        marketplaceCurrency: f.currency.trim() || 'MXN',
        marketplaceDescription: f.description.trim() || undefined,
      }
      dispatch({ t: 'publish', draftId: null, item, authorId: me.id, at })
      notify(`«${item.title}» entra al dial`, { tone: 'energy', energy: 5 })
      onDone(rowId)
      return
    }
    const patch: Partial<ContentItem> = {}
    if (f.title !== initial.title) patch.title = f.title.trim()
    if (f.kind !== initial.kind) patch.franjaKind = f.kind
    if (f.kind !== initial.kind || f.location !== initial.location) patch.subtitle = subtitle
    if (f.url !== initial.url) patch.franjaUrl = f.url.trim() || undefined
    if (f.logo !== initial.logo) patch.imageUrl = f.logo ?? undefined
    if (f.market !== initial.market) patch.marketplaceEnabled = f.market
    if (f.location !== initial.location) patch.marketplaceLocation = f.location.trim() || undefined
    if (f.currency !== initial.currency) patch.marketplaceCurrency = f.currency.trim() || 'MXN'
    if (f.description !== initial.description) patch.marketplaceDescription = f.description.trim() || undefined
    dispatch({ t: 'franja-patch', franjaId: franja.id, patch, at })
    notify(`«${f.title.trim()}» guardada`)
    onDone(franja.id)
  }

  const consequence = franja
    ? `Sale del dial y del mercado, con su tienda y sus anuncios. ${teamCount ? `${teamCount} ${teamCount === 1 ? 'persona pierde' : 'personas pierden'} el vínculo con el equipo. ` : ''}${presentedCount ? `${presentedCount} ${presentedCount === 1 ? 'pieza que presentó sigue' : 'piezas que presentó siguen'} publicadas, sin su sello. ` : ''}No se puede deshacer.`
    : ''

  const remove = () => {
    if (!franja) return
    const at = new Date().toISOString()
    for (const u of Object.values(users)) {
      if (u.franjaId === franja.id) dispatch({ t: 'user-admin', userId: u.id, patch: { franjaId: undefined, franjaAdmin: false }, at })
    }
    dispatch({ t: 'item-delete', itemId: franja.id, at })
    notify(`${franja.title} borrada del dial`, { tone: 'error' })
    onDone(null)
  }

  const fid = `fr-${franja?.id ?? 'nueva'}`
  const preview: ContentItem = { ...(franja ?? ({ id: 'preview', type: 'franja', title: f.title || '·' } as ContentItem)), title: f.title || '·', imageUrl: f.logo ?? undefined }
  const listings = franja?.marketplaceListings?.length ?? 0

  return (
    <Pane
      n="02"
      title={create ? 'Nueva franja' : 'Editar franja'}
      note={create ? 'entra al dial al crearla' : `última señal ${franja.franjaLastUpdated ? fmt.short(franja.franjaLastUpdated) : fmt.short(franja.publishedAt)}`}
      actions={
        <button type="button" className={s.close} onClick={() => onDone(null)} aria-label="Cerrar el editor">
          <Mark name="close" size={15} />
        </button>
      }
    >
      <form
        className={s.form}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <Step n="01" title="Identidad">
          <Field label="Nombre" htmlFor={`${fid}-t`} error={errors.title}>
            <input id={`${fid}-t`} className={inputClass} value={f.title} onChange={(e) => put('title', e.target.value)} placeholder="Club Japan" />
          </Field>
          <Field label="Slug" htmlFor={`${fid}-s`} error={errors.slug} hint={create ? `Su página: /f/${slug || '…'}` : 'No cambia: rompería los enlaces a su página.'}>
            <input
              id={`${fid}-s`}
              className={inputClass}
              value={create ? (slugTouched ? f.slug : slug) : f.slug}
              readOnly={!create}
              onChange={(e) => {
                setSlugTouched(true)
                put('slug', e.target.value)
              }}
            />
          </Field>
          <div className={s.two}>
            <Field label="Tipo" htmlFor={`${fid}-k`}>
              <select id={`${fid}-k`} className={selectClass} value={f.kind} onChange={(e) => put('kind', e.target.value as FranjaKind)}>
                {FRANJA_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {FRANJA_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="URL" htmlFor={`${fid}-u`} error={errors.url} hint="Opcional: sitio, Bandcamp, Instagram">
              <input id={`${fid}-u`} className={inputClass} type="url" value={f.url} onChange={(e) => put('url', e.target.value)} placeholder="https://" />
            </Field>
          </div>
        </Step>

        <Step n="02" title="Logo">
          <div className={s.logoRow}>
            <Logo franja={preview} size={88} />
            <div className={s.logoActions}>
              <Button size="sm" variant="ghost" onClick={() => setPicker(true)}>
                {f.logo ? 'Cambiar logo' : 'Elegir logo'}
              </Button>
              {f.logo ? (
                <Button size="sm" variant="quiet" onClick={() => put('logo', null)}>
                  Quitar
                </Button>
              ) : null}
              <span className={s.hint}>{f.logo ? f.logo.split('/').pop() : `${logos.length} logos disponibles en /franjas`}</span>
            </div>
          </div>
        </Step>

        <Step n="03" title="Mercado" hint="Cada equipo abre su tienda desde el Taller. Aquí solo se oculta por abuso, o se restaura.">
          <Toggle
            checked={f.market}
            onChange={(v) => put('market', v)}
            label={f.market ? 'Escaparate visible' : 'Escaparate oculto'}
            hint={listings ? `${listings} ${listings === 1 ? 'anuncio' : 'anuncios'} en su tienda.` : 'Todavía sin anuncios.'}
          />
          <div className={s.two}>
            <Field label="Ubicación" htmlFor={`${fid}-l`}>
              <input id={`${fid}-l`} className={inputClass} value={f.location} onChange={(e) => put('location', e.target.value)} placeholder="CDMX, MX" />
            </Field>
            <Field label="Moneda" htmlFor={`${fid}-m`}>
              <select id={`${fid}-m`} className={selectClass} value={f.currency} onChange={(e) => put('currency', e.target.value)}>
                {['MXN', 'USD', 'EUR'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Descripción de la tienda" htmlFor={`${fid}-d`}>
            <textarea id={`${fid}-d`} className={textareaClass} rows={3} value={f.description} onChange={(e) => put('description', e.target.value)} placeholder="Qué vende, cómo entrega, a quién se le escribe…" />
          </Field>
        </Step>

        <div className={s.actions}>
          <Button type="submit" variant="ink" disabled={invalid || !dirty}>
            {create ? 'Crear franja' : 'Guardar cambios'}
          </Button>
          {!create && dirty ? (
            <Button variant="quiet" onClick={() => setF(initial)}>
              Descartar
            </Button>
          ) : null}
          <span className={s.hint}>
            {create ? 'Nace con banda neutra (5): las franjas no se filtran por energía.' : 'Guardar la mueve al frente del dial: cuenta como su señal más reciente.'}
          </span>
        </div>

        <ArtPicker
          open={picker}
          onClose={() => setPicker(false)}
          title="Logos de franjas"
          images={logos}
          current={f.logo}
          shape="square"
          onPick={(url) => {
            put('logo', url)
            setPicker(false)
          }}
        />
      </form>
      {!create ? (
        <div className={s.danger}>
          <HoldButton tone="danger" size="md" energy={7} holdingLabel="Sigue…" disabled={deleting} onConfirm={() => setDeleting(true)}>
            Borrar franja
          </HoldButton>
          <span className={s.hint}>
            Mantén, y luego escribe «BORRAR {franja.title.toUpperCase()}». {teamCount ? `Equipo: ${teamCount}. ` : ''}
            {presentedCount ? `Piezas que presentó: ${presentedCount}.` : ''}
          </span>
          {deleting ? <ConfirmPhrase phrase={`BORRAR ${franja.title.toUpperCase()}`} consequence={consequence} onCancel={() => setDeleting(false)} onConfirm={remove} /> : null}
        </div>
      ) : null}
      <Note>Las franjas nunca entran al mosaico ni se ordenan por HL: el dial las ordena por su última señal.</Note>
    </Pane>
  )
}
