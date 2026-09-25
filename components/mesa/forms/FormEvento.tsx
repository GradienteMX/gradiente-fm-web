'use client'

/** Evento — a place in time: fecha, lugar, cartel, line-up, entradas. */

import { useId, useState } from 'react'
import { differenceInMinutes, parseISO } from 'date-fns'
import { TextArea, TextField } from '@/components/kit/Field'
import { eventProximity, fmt, PROXIMITY_LABEL } from '@/lib/logic/time'
import { useNow } from '@/lib/store/world'
import type { FormApi } from '../context'
import { FIELD_ID, entityRef, isoToLocal, localToIso, slugify, usableUrl, validIso, type StepId } from '../model'
import { Seccion } from '../fields/bits'
import { Texto } from '../fields/Texto'
import { Enlaces } from '../fields/Enlaces'
import { Titulo } from './Titulo'
import { HINTS, need, sharedSection } from './shared'
import f from '../fields/fields.module.css'

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function FormEvento({ api, step }: { api: FormApi; step: StepId }) {
  const { item, patch, env } = api
  const now = useNow()
  const venuesId = useId()
  const [lineup, setLineup] = useState(() => (item.artists ?? []).join('\n'))

  const setArtists = (text: string) => {
    setLineup(text)
    patch({ artists: text.split('\n').map((a) => a.trim()).filter(Boolean) })
  }

  // Undo/redo can change the line-up under the textarea: follow it.
  const fromItem = (item.artists ?? []).join('\n')
  const [seenItem, setSeenItem] = useState(fromItem)
  if (seenItem !== fromItem) {
    setSeenItem(fromItem)
    if (lineup.split('\n').map((a) => a.trim()).filter(Boolean).join('\n') !== fromItem) setLineup(fromItem)
  }

  const artists = item.artists ?? []
  const linked = new Set((item.entities ?? []).filter((e) => e.kind === 'artist').map((e) => e.slug))
  const unlinked = artists.filter((a) => !linked.has(slugify(a)))

  return (
    <>
      {env.plan
        .filter((s) => s.step === step)
        .map((def) => {
          switch (def.key) {
            case 'titulo':
              return (
                <Seccion key={def.key} def={def} need={need(api, def.key)}>
                  <Titulo api={api} placeholder="Nombre del evento" sub="Un lema o la ocasión (opcional)" />
                </Seccion>
              )
            case 'fechas': {
              const start = validIso(item.date) ? parseISO(item.date!) : null
              const end = validIso(item.endDate) ? parseISO(item.endDate!) : null
              const mins = start && end ? differenceInMinutes(end, start) : null
              return (
                <Seccion key={def.key} def={def} need={need(api, def.key)} hint="Usa la hora local del lugar. El cierre es opcional.">
                  <div className={f.row2}>
                    <TextField
                      id={FIELD_ID.date}
                      label="Empieza"
                      type="datetime-local"
                      required
                      value={isoToLocal(item.date)}
                      onChange={(e) => patch({ date: localToIso(e.target.value) })}
                    />
                    <TextField
                      id={FIELD_ID.endDate}
                      label="Termina"
                      type="datetime-local"
                      value={isoToLocal(item.endDate)}
                      min={isoToLocal(item.date) || undefined}
                      onChange={(e) => patch({ endDate: localToIso(e.target.value) })}
                      error={mins !== null && mins <= 0 ? 'El cierre queda antes del inicio.' : undefined}
                    />
                  </div>
                  {start ? (
                    <p className={f.note}>
                      <b>{capitalize(fmt.full(item.date!))}</b>
                      {end && mins !== null && mins > 0 ? ` → ${fmt.time(item.endDate!)} · ${Math.floor(mins / 60)} h${mins % 60 ? ` ${mins % 60} min` : ''}` : ''}
                      {' · '}
                      {PROXIMITY_LABEL[eventProximity({ ...item, date: item.date, endDate: item.endDate }, now)]}
                    </p>
                  ) : (
                    <p className={f.note}>Sin fecha el evento no puede publicarse: es lo primero que busca quien lo encuentra.</p>
                  )}
                </Seccion>
              )
            }
            case 'lugar':
              return (
                <Seccion key={def.key} def={def} hint="Dónde. La dirección ayuda a llegar.">
                  <div className={f.row2}>
                    <TextField
                      label="Venue"
                      list={venuesId}
                      value={item.venue ?? ''}
                      placeholder="Club Japan"
                      onChange={(e) => {
                        const venue = e.target.value
                        const known = env.knowledge.venues.find((v) => v.name.toLowerCase() === venue.trim().toLowerCase())
                        patch({ venue, venueCity: !item.venueCity && known?.city ? known.city : item.venueCity })
                      }}
                    />
                    <TextField label="Ciudad y dirección" value={item.venueCity ?? ''} placeholder="CDMX · Monterrey 56, Roma Norte" onChange={(e) => patch({ venueCity: e.target.value })} />
                  </div>
                  <datalist id={venuesId}>
                    {env.knowledge.venues.map((v) => (
                      <option key={v.name} value={v.name} />
                    ))}
                  </datalist>
                </Seccion>
              )
            case 'artistas':
              return (
                <Seccion key={def.key} def={def} hint="Uno por línea. El primero encabeza el cartel en la lectura.">
                  <textarea
                    className={f.cell}
                    style={{ height: 'auto', minHeight: 132, padding: '12px 14px', fontFamily: 'var(--font-display)', fontVariationSettings: 'var(--m-var)', fontSize: 20, lineHeight: 1.25, resize: 'vertical', textTransform: 'uppercase' }}
                    value={lineup}
                    placeholder={'Artista principal\nSegundo nombre\nb2b, live, etc.'}
                    aria-label="Line-up, un artista por línea"
                    onChange={(e) => setArtists(e.target.value)}
                  />
                  <div className={f.inline} style={{ justifyContent: 'space-between' }}>
                    <span className={f.note}>
                      {artists.length ? `${artists.length} ${artists.length === 1 ? 'artista' : 'artistas'} en el cartel` : 'Sin line-up todavía.'}
                    </span>
                    {unlinked.length ? (
                      <button
                        type="button"
                        className={f.textBtn}
                        onClick={() => patch({ entities: [...(item.entities ?? []), ...unlinked.map((a) => entityRef('artist', a, env.knowledge.entities.find((e) => e.kind === 'artist' && e.slug === slugify(a))))] })}
                      >
                        Vincular {unlinked.length === artists.length ? 'el line-up' : `${unlinked.length} más`} como artistas
                      </button>
                    ) : artists.length ? (
                      <span className={f.note}>Line-up vinculado a sus fichas.</span>
                    ) : null}
                  </div>
                </Seccion>
              )
            case 'resumen':
              return (
                <Seccion key={def.key} def={def} hint={HINTS.resumen}>
                  <TextArea
                    label="Resumen para la tarjeta"
                    value={item.excerpt ?? ''}
                    onChange={(e) => patch({ excerpt: e.target.value })}
                    rows={2}
                    placeholder="Una línea que invite a la noche…"
                    counter={{ value: (item.excerpt ?? '').length, max: 280 }}
                  />
                  <div className={f.stack} style={{ gap: 7 }}>
                    <span className={f.label}>Más sobre la noche</span>
                    <Texto
                      size="small"
                      label="Más sobre la noche"
                      value={item.bodyPreview ?? ''}
                      onChange={(bodyPreview) => patch({ bodyPreview })}
                      paragraphs
                      placeholder="El sonido, la sala, lo que no cabe en el cartel (opcional)…"
                      helper="Se lee en la noche, bajo el line-up. Deja una línea en blanco entre párrafos."
                    />
                  </div>
                </Seccion>
              )
            case 'entradas':
              return (
                <Seccion key={def.key} def={def} hint="Las entradas son una salida explícita: se abren fuera de Gradiente.">
                  <div className={f.row2}>
                    <TextField label="Precio" value={item.price ?? ''} placeholder="$250 preventa · $350 puerta · libre" onChange={(e) => patch({ price: e.target.value })} />
                    <TextField
                      label="Enlace de boletos"
                      type="url"
                      value={item.ticketUrl ?? ''}
                      placeholder="https://…"
                      onChange={(e) => patch({ ticketUrl: e.target.value })}
                      error={item.ticketUrl && !usableUrl(item.ticketUrl) ? 'Incluye https:// para que funcione.' : undefined}
                    />
                  </div>
                  <Enlaces value={item.links ?? []} onChange={(links) => patch({ links })} presets={['Sitio', 'RSVP', 'Fuente']} label="Otros enlaces" />
                </Seccion>
              )
            default:
              return sharedSection(def, api)
          }
        })}
    </>
  )
}
