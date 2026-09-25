'use client'

/**
 * EVENTOS — the upcoming nights, in order, each editable in place. One
 * editor open at a time (a list of a hundred mounted forms is how the old
 * panel got slow). Saving is a `publish` update: the piece keeps its HL, its
 * publication date and its author — correcting a venue is not a new event.
 */

import { Fragment, useEffect, useMemo, useState } from 'react'
import type { ContentItem, User } from '@/lib/types'
import { isUpcoming, fmt, until } from '@/lib/logic/time'
import { effectiveBand } from '@/lib/vibe'
import { useItems, useDispatch, useWorld } from '@/lib/store/world'
import { useUI } from '@/lib/store/ui'
import { Segmented } from '@/components/kit/Field'
import { Button } from '@/components/kit/Button'
import { BandChip } from '@/components/kit/Bits'
import { Mark } from '@/components/kit/Glyph'
import { HOUR, int, matches } from './data'
import { useClock } from './clock'
import { useQuery } from './query'
import { ArtPicker } from './ArtPicker'
import { EnergyPair, Empty, Field, Note, Pane, Thumb, cx, inputClass, mutedClass, tableClass, tableWrapClass, tagClass } from './kit'
import s from './Eventos.module.css'

const FILTROS = ['proximos', '48h', 'sin-imagen'] as const
type Filtro = (typeof FILTROS)[number]

export function Eventos({ me, flyers }: { me: User; flyers: string[] }) {
  const { get, set } = useQuery()
  const rawFiltro = get('filtro')
  const filtro: Filtro = rawFiltro && (FILTROS as readonly string[]).includes(rawFiltro) ? (rawFiltro as Filtro) : 'proximos'
  const qUrl = get('q') ?? ''
  const open = get('ev')
  const [q, setQ] = useState(qUrl)
  const [seenUrl, setSeenUrl] = useState(qUrl)
  if (seenUrl !== qUrl) {
    setSeenUrl(qUrl)
    if (q.trim() !== qUrl) setQ(qUrl)
  }
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (q.trim() !== qUrl) set({ q: q.trim() || null })
    }, 220)
    return () => window.clearTimeout(t)
  }, [q, qUrl, set])

  const { now: nowMs, tick } = useClock()
  const items = useItems()
  const franjas = useWorld((st) => st.world.items)

  const upcoming = useMemo(() => {
    const at = new Date(tick)
    return items
      .filter((i) => i.type === 'evento' && isUpcoming(i, at))
      .sort((a, b) => Date.parse(a.date ?? a.publishedAt) - Date.parse(b.date ?? b.publishedAt))
  }, [items, tick])

  const soon = (i: ContentItem) => {
    const t = i.date ? Date.parse(i.date) : NaN
    return t > nowMs && t < nowMs + 48 * HOUR
  }
  const counts = {
    proximos: upcoming.length,
    '48h': upcoming.filter(soon).length,
    'sin-imagen': upcoming.filter((i) => !i.imageUrl).length,
  }

  const list = upcoming.filter((i) => {
    if (filtro === '48h' && !soon(i)) return false
    if (filtro === 'sin-imagen' && i.imageUrl) return false
    const f = qUrl
    return !f || matches(i.title, f) || matches(i.venue, f) || matches(i.venueCity, f) || matches(i.artists?.join(' '), f)
  })

  const LABEL: Record<Filtro, string> = {
    proximos: 'Próximos',
    '48h': 'Próximas 48 h',
    'sin-imagen': 'Sin imagen',
  }

  return (
    <div className={s.eventos}>
      <div className={s.toolbar}>
        <Segmented
          label="Filtro de eventos"
          value={filtro}
          onChange={(v) => set({ filtro: v === 'proximos' ? null : v, ev: null })}
          options={FILTROS.map((f) => ({
            value: f,
            label: `${LABEL[f]} · ${counts[f]}`,
          }))}
        />
        <label className={s.search}>
          <span className="sr-only">Buscar eventos</span>
          <Mark name="search" size={14} />
          <input
            className={cx(inputClass, s.searchInput)}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Título, venue, ciudad, artista…"
          />
        </label>
        <Button variant="ink" href="/taller/mesa?tipo=evento" icon={<Mark name="plus" size={14} />}>
          Nuevo evento
        </Button>
      </div>

      <Pane n="01" title="Próximas noches" note={`${int(list.length)} ${list.length === 1 ? 'evento' : 'eventos'} · en orden de puerta`} flush>
        {list.length === 0 ? (
          <Empty>
            {filtro === 'sin-imagen'
              ? 'Todos los eventos próximos tienen imagen.'
              : filtro === '48h'
                ? 'Ningún evento abre en las próximas 48 horas.'
                : qUrl
                  ? `Ningún evento próximo coincide con «${qUrl}».`
                  : 'No hay eventos próximos.'}
          </Empty>
        ) : (
          <div className={tableWrapClass}>
            <table className={cx(tableClass, s.table)}>
              <caption className="sr-only">Eventos próximos, en orden cronológico. Cada fila abre su editor.</caption>
              <thead>
                <tr>
                  <th scope="col">Noche</th>
                  <th scope="col">
                    <span className="sr-only">Arte</span>
                  </th>
                  <th scope="col">Evento</th>
                  <th scope="col">Energía</th>
                  <th scope="col">Precio</th>
                  <th scope="col">
                    <span className="sr-only">Editar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((ev) => {
                  const isOpen = open === ev.id
                  const b = effectiveBand(ev)
                  const franja = ev.franjaId ? franjas[ev.franjaId] : null
                  return (
                    <Fragment key={ev.id}>
                      <tr className={s.row} data-open={isOpen || undefined}>
                        <td className={s.when}>
                          {ev.date ? (
                            <>
                              <span className={s.day}>
                                {fmt.weekday(ev.date)} {fmt.dayNum(ev.date)} {fmt.month(ev.date)}
                              </span>
                              <span className={s.time}>
                                {fmt.time(ev.date)} · {until(ev.date, new Date(nowMs))}
                              </span>
                            </>
                          ) : (
                            <span className={mutedClass}>sin fecha</span>
                          )}
                        </td>
                        <td className={s.thumbCell}>
                          <Thumb item={ev} size={44} />
                        </td>
                        <th scope="row" className={s.titleCell}>
                          <span className={s.title}>{ev.title}</span>
                          <span className={s.sub}>
                            {[ev.venue, ev.venueCity].filter(Boolean).join(' · ') || 'sin venue'}
                            {franja ? <span className={tagClass}>{franja.title}</span> : null}
                            {ev.editorial ? <span className={tagClass}>Editorial</span> : null}
                            {ev.elevated ? <span className={tagClass}>Destacado</span> : null}
                            {!ev.imageUrl ? (
                              <span className={tagClass} data-warn>
                                Sin imagen
                              </span>
                            ) : null}
                            {ev.source === 'scraper:ra' ? (
                              <span className={tagClass} data-dashed>
                                RA
                              </span>
                            ) : null}
                          </span>
                        </th>
                        <td>
                          <BandChip min={b.min} max={b.max} />
                        </td>
                        <td className={cx(s.price, !ev.price && mutedClass)}>{ev.price || '—'}</td>
                        <td className={s.editCell}>
                          <Button
                            size="sm"
                            variant={isOpen ? 'ink' : 'ghost'}
                            aria-expanded={isOpen}
                            aria-controls={`ev-${ev.id}`}
                            onClick={() => set({ ev: isOpen ? null : ev.id })}
                          >
                            {isOpen ? 'Cerrar' : 'Editar'}
                          </Button>
                        </td>
                      </tr>
                      {isOpen ? (
                        <tr className={s.editRow}>
                          <td colSpan={6} id={`ev-${ev.id}`}>
                            <Editor id={ev.id} me={me} flyers={flyers} onDone={() => set({ ev: null })} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Pane>
      <Note>
        «Nuevo evento» abre la mesa del Taller, donde se compone y se publica. Aquí se corrige lo que ya existe: la pieza conserva su HL, su fecha de
        publicación y su autor.
      </Note>
    </div>
  )
}

// ── editor ──────────────────────────────────────────────────────────────────

function toLocal(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function fromLocal(v: string): string | undefined {
  if (!v) return undefined
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

interface Form {
  title: string
  imageUrl: string | null
  venue: string
  venueCity: string
  start: string
  end: string
  price: string
  ticketUrl: string
  vibeMin: number
  vibeMax: number
}

function formOf(ev: ContentItem): Form {
  return {
    title: ev.title,
    imageUrl: ev.imageUrl ?? null,
    venue: ev.venue ?? '',
    venueCity: ev.venueCity ?? '',
    start: toLocal(ev.date),
    end: toLocal(ev.endDate),
    price: ev.price ?? '',
    ticketUrl: ev.ticketUrl ?? '',
    vibeMin: ev.vibeMin,
    vibeMax: ev.vibeMax,
  }
}

function Editor({ id, me, flyers, onDone }: { id: string; me: User; flyers: string[]; onDone: () => void }) {
  // The raw world item — never the crowd-merged view, whose derived fields
  // must not be written back into the piece.
  const raw = useWorld((st) => st.world.items[id])
  const dispatch = useDispatch()
  const notify = useUI((st) => st.notify)
  const [f, setF] = useState<Form | null>(() => (raw ? formOf(raw) : null))
  const [picker, setPicker] = useState(false)
  if (!raw || !f) return <Empty>Este evento ya no existe.</Empty>

  const initial = formOf(raw)
  const dirty = (Object.keys(initial) as Array<keyof Form>).some((k) => initial[k] !== f[k])
  const put = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v })

  const startIso = fromLocal(f.start)
  const endIso = fromLocal(f.end)
  const errors = {
    title: f.title.trim() ? null : 'El título es obligatorio.',
    start: startIso ? null : 'La noche necesita una fecha de inicio.',
    end: f.end && !endIso ? 'Fecha inválida.' : endIso && startIso && Date.parse(endIso) < Date.parse(startIso) ? 'El fin no puede ir antes del inicio.' : null,
    // Only what the admin types is validated: seed rows carry placeholders
    // («#») that must not block correcting the rest of the event.
    ticketUrl:
      f.ticketUrl !== initial.ticketUrl && f.ticketUrl.trim() && !/^https?:\/\//.test(f.ticketUrl.trim())
        ? 'Un enlace de boletos empieza con http:// o https://'
        : null,
  }
  const ticketPlaceholder = f.ticketUrl === initial.ticketUrl && f.ticketUrl.trim() !== '' && !/^https?:\/\//.test(f.ticketUrl.trim())
  const invalid = Object.values(errors).some(Boolean)
  const preview: ContentItem = {
    ...raw,
    imageUrl: f.imageUrl ?? undefined,
    vibeMin: f.vibeMin,
    vibeMax: f.vibeMax,
  }

  const save = () => {
    if (invalid || !dirty) return
    const item: ContentItem = {
      ...raw,
      title: f.title.trim(),
      imageUrl: f.imageUrl ?? undefined,
      venue: f.venue.trim() || undefined,
      venueCity: f.venueCity.trim() || undefined,
      date: startIso,
      endDate: endIso,
      price: f.price.trim() || undefined,
      ticketUrl: f.ticketUrl.trim() || undefined,
      vibeMin: f.vibeMin,
      vibeMax: f.vibeMax,
    }
    dispatch({
      t: 'publish',
      draftId: null,
      item,
      authorId: me.id,
      at: new Date().toISOString(),
    })
    notify(`«${item.title}» actualizado`, {
      tone: 'energy',
      energy: (f.vibeMin + f.vibeMax) / 2,
    })
    onDone()
  }

  const fid = `evf-${id}`
  return (
    <form
      className={s.editor}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <div className={s.art}>
        <Thumb item={preview} size={132} height={165} />
        <div className={s.artActions}>
          <Button size="sm" variant="ghost" onClick={() => setPicker(true)}>
            {f.imageUrl ? 'Cambiar flyer' : 'Elegir flyer'}
          </Button>
          {f.imageUrl ? (
            <Button size="sm" variant="quiet" onClick={() => put('imageUrl', null)}>
              Quitar
            </Button>
          ) : null}
        </div>
        <span className={s.artNote}>{f.imageUrl ? f.imageUrl.split('/').pop() : 'Sin imagen: la pieza pinta su placa de energía.'}</span>
      </div>

      <div className={s.fields}>
        <Field label="Título" htmlFor={`${fid}-t`} wide error={errors.title}>
          <input id={`${fid}-t`} className={inputClass} value={f.title} onChange={(e) => put('title', e.target.value)} />
        </Field>
        <Field label="Venue" htmlFor={`${fid}-v`}>
          <input id={`${fid}-v`} className={inputClass} value={f.venue} onChange={(e) => put('venue', e.target.value)} placeholder="Club Japan" />
        </Field>
        <Field label="Ciudad" htmlFor={`${fid}-c`}>
          <input id={`${fid}-c`} className={inputClass} value={f.venueCity} onChange={(e) => put('venueCity', e.target.value)} placeholder="CDMX" />
        </Field>
        <Field label="Inicio" htmlFor={`${fid}-s`} error={errors.start}>
          <input id={`${fid}-s`} className={inputClass} type="datetime-local" value={f.start} onChange={(e) => put('start', e.target.value)} />
        </Field>
        <Field label="Fin" htmlFor={`${fid}-e`} error={errors.end} hint="Opcional">
          <input id={`${fid}-e`} className={inputClass} type="datetime-local" value={f.end} onChange={(e) => put('end', e.target.value)} />
        </Field>
        <Field label="Precio" htmlFor={`${fid}-p`} hint="Texto libre: «$250», «Gratis», «Preventa $180»">
          <input id={`${fid}-p`} className={inputClass} value={f.price} onChange={(e) => put('price', e.target.value)} />
        </Field>
        <Field
          label="Boletos"
          htmlFor={`${fid}-b`}
          error={errors.ticketUrl}
          hint={ticketPlaceholder ? `El enlace guardado («${f.ticketUrl}») no lleva a ningún lado: bórralo o pon uno real.` : undefined}
        >
          <input
            id={`${fid}-b`}
            className={inputClass}
            type="url"
            value={f.ticketUrl}
            onChange={(e) => put('ticketUrl', e.target.value)}
            placeholder="https://"
          />
        </Field>
        <div className={s.energy}>
          <EnergyPair idPrefix={fid} min={f.vibeMin} max={f.vibeMax} onChange={(a, b) => setF({ ...f, vibeMin: a, vibeMax: b })} />
          <span className={s.hint}>Banda del autor. Con 5 calibraciones o más, la comunidad manda en el feed.</span>
        </div>
      </div>

      <div className={s.actions}>
        <Button type="submit" variant="ink" disabled={!dirty || invalid}>
          Guardar cambios
        </Button>
        <Button variant="quiet" onClick={() => (dirty ? setF(initial) : onDone())}>
          {dirty ? 'Descartar cambios' : 'Cerrar'}
        </Button>
        <span className={s.hint}>{dirty ? 'Cambios sin guardar.' : 'Sin cambios.'} Guardar publica la actualización al instante.</span>
        <Button variant="quiet" size="sm" href={`/taller/mesa?editar=${encodeURIComponent(id)}`} iconRight={<Mark name="arrow" size={12} />}>
          Line-up, géneros y texto: en la mesa
        </Button>
      </div>

      <ArtPicker
        open={picker}
        onClose={() => setPicker(false)}
        title="Flyers"
        images={flyers}
        current={f.imageUrl}
        onPick={(url) => {
          put('imageUrl', url)
          setPicker(false)
        }}
      />
    </form>
  )
}
