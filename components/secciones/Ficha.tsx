'use client'

/**
 * FICHA — /e/[slug]. An artist, a venue, a label, a promoter: an identity
 * hub (a real page, like /f/ and /u/). Everything on it is derived from the
 * pieces that name it — line-ups, venues, a mix's author, a list's tracks,
 * headlines — so nothing here is invented.
 *
 *  · name in energy typography at the mean of its pieces
 *  · its spectrum: one tick per appearance, at that piece's energy
 *  · the next nights with or at it (they open over the field)
 *  · who it shares nights with, where it has sounded
 *  · the appearances as an organism (date-sorted, sized by life)
 */

import Link from 'next/link'
import { useMemo } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { ContentItem } from '@/lib/types'
import { useItems, useNow, useWorld } from '@/lib/store/world'
import { useUI } from '@/lib/store/ui'
import { rankCategory } from '@/lib/logic/feed'
import { eventProximity, fmt, itemDate, PROXIMITY_LABEL } from '@/lib/logic/time'
import { sigueViva } from '@/components/agenda/noches'
import { effectiveBand, energyHex, energyVariation, vibeName, VIBE_NAMES } from '@/lib/vibe'
import { Organismo } from '@/components/organismo/Organismo'
import { Mark } from '@/components/kit/Glyph'
import { EnergyTitle } from './EnergyTitle'
import {
  collectEntities,
  energiaMedia,
  franjaHermana,
  KIND_LABEL,
  mencionesDe,
  VIA_LABEL,
  type Aparicion,
  type Entidad,
  type EntityVia,
} from './entities'
import { plural } from './texto'
import { Frecuencia } from '@/components/casa/Frecuencia'
import styles from './Ficha.module.css'

const midOf = (i: ContentItem) => {
  const b = effectiveBand(i)
  return (b.min + b.max) / 2
}

export function Ficha({ slug }: { slug: string }) {
  const items = useItems()
  const now = useNow()
  const hydrated = useWorld((s) => s.hydrated)
  const minute = Math.floor(now.getTime() / 60_000)
  const at = useMemo(() => new Date(minute * 60_000), [minute])

  const index = useMemo(() => collectEntities(items), [items])
  const ent = index.get(slug) ?? null
  const menciones = useMemo(() => (ent ? mencionesDe(ent, items) : []), [ent, items])
  const all: Aparicion[] = useMemo(() => (ent ? [...ent.apariciones, ...menciones] : []), [ent, menciones])
  const pieces = useMemo(() => all.map((a) => a.item), [all])
  const ranked = useMemo(() => rankCategory(pieces, at), [pieces, at])

  if (!ent) {
    if (!hydrated) return <div style={{ minHeight: '70vh' }} />
    return <Frecuencia motivo="ficha" />
  }

  const energy = energiaMedia(ent.apariciones.length ? ent.apariciones.map((a) => a.item) : pieces)
  const upcoming = pieces
    .filter((p) => p.type === 'evento' && sigueViva(p, at))
    .sort((a, b) => itemDate(a).getTime() - itemDate(b).getTime())
  const first = pieces.reduce<Date | null>((m, p) => {
    const d = itemDate(p)
    return !m || d < m ? d : m
  }, null)
  const franja = franjaHermana(ent.slug, items)

  const viaCounts = new Map<EntityVia, number>()
  for (const a of all) viaCounts.set(a.via, (viaCounts.get(a.via) ?? 0) + 1)
  const viaLine = [...viaCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([v, n]) => `${n} ${n === 1 ? VIA_LABEL[v].one : VIA_LABEL[v].many}`)
    .join(' · ')

  return (
    <div className={styles.ficha} style={{ ['--e' as string]: energyHex(energy) }}>
      <div className={styles.frame}>
        <header className={styles.head}>
          <p className={styles.kicker}>
            <span className={styles.kind}>Ficha / {KIND_LABEL[ent.kind]}</span>
            {ent.place ? <span className={styles.place}>{ent.place}</span> : null}
            <span className={styles.rule} aria-hidden="true" />
            <span className={styles.derived}>Ficha derivada de lo que dicen sus piezas</span>
          </p>

          <EnergyTitle text={ent.name} energy={energy} max={188} />

          <Espectro pieces={pieces} energy={energy} />

          <div className={styles.facts}>
            <p>
              <b className="num">{pieces.length}</b> {plural(pieces.length, 'aparición', 'apariciones')}
              {viaLine ? <span className={styles.dim}> — {viaLine}</span> : null}
            </p>
            {first ? (
              <p>
                En el archivo desde <b>{format(first, 'MMMM yyyy', { locale: es })}</b>
              </p>
            ) : null}
            {upcoming.length ? (
              <p>
                Próxima noche: <b>{fmt.full(upcoming[0].date!)}</b>
              </p>
            ) : null}
          </div>

          {franja ? (
            <Link href={`/f/${franja.slug}`} className={styles.franja}>
              <span className={styles.franjaBand} aria-hidden="true" />
              <span>
                <span className={styles.franjaKicker}>También sintoniza como franja</span>
                <span className={styles.franjaName}>{franja.title} · ver su dossier</span>
              </span>
              <Mark name="arrow" size={15} />
            </Link>
          ) : null}
        </header>

        {upcoming.length ? <Proximas events={upcoming} now={at} ent={ent} /> : null}

        <Constelacion ent={ent} index={index} />

        <section className={styles.apariciones} aria-labelledby="apariciones-h">
          <div className={styles.secHead}>
            <h2 id="apariciones-h" className={styles.secTitle}>
              Apariciones
            </h2>
            <p className={styles.secSub}>Todo lo que la nombra, de lo más nuevo a lo más viejo. El tamaño es la vida de cada pieza.</p>
          </div>
          {/* A handful of pieces reads as a mosaic, not as a sparse wall. */}
          <div style={{ maxWidth: pieces.length <= 4 ? 860 : pieces.length <= 9 ? 1180 : undefined }}>
            <Organismo ranked={ranked} />
          </div>
        </section>
      </div>
    </div>
  )
}

// ── its spectrum ────────────────────────────────────────────────────────────

function Espectro({ pieces, energy }: { pieces: ContentItem[]; energy: number }) {
  const bins = new Map<number, ContentItem[]>()
  for (const p of pieces) {
    const k = Math.round(midOf(p) * 4) / 4
    bins.set(k, [...(bins.get(k) ?? []), p])
  }
  const max = Math.max(1, ...[...bins.values()].map((b) => b.length))
  return (
    <figure className={styles.espectro} aria-label={`Espectro de apariciones: media ${vibeName(energy)}`}>
      <div className={styles.axis}>
        <span className={styles.rail} aria-hidden="true" />
        {[...bins.entries()].map(([e, list]) => (
          <span
            key={e}
            className={styles.tick}
            style={{ left: `${e * 10}%`, height: `${12 + (list.length / max) * 34}px`, ['--t' as string]: energyHex(e) }}
            title={`${VIBE_NAMES[Math.round(e)]} · ${list.map((p) => p.title).join(' / ')}`}
          />
        ))}
        <span className={styles.mean} style={{ left: `${energy * 10}%` }} aria-hidden="true" />
      </div>
      <figcaption className={styles.axisLabels}>
        <span style={{ visibility: energy < 1.6 ? 'hidden' : undefined }}>Glacial</span>
        <span className={styles.meanLabel} style={{ left: `${energy * 10}%`, fontVariationSettings: energyVariation(energy) }}>
          {vibeName(energy)}
        </span>
        <span style={{ visibility: energy > 8.4 ? 'hidden' : undefined }}>Volcán</span>
      </figcaption>
    </figure>
  )
}

// ── next nights ──────────────────────────────────────────────────────────────

function Proximas({ events, now, ent }: { events: ContentItem[]; now: Date; ent: Entidad }) {
  const openLectura = useUI((s) => s.openLectura)
  return (
    <section className={styles.proximas} aria-labelledby="proximas-h">
      <div className={styles.secHead}>
        <h2 id="proximas-h" className={styles.secTitle}>
          Próximas noches
        </h2>
        <p className={styles.secSub}>{ent.kind === 'venue' ? 'Lo que viene en este lugar.' : 'Dónde y cuándo suena otra vez.'}</p>
      </div>
      <ol className={styles.nochesList}>
        {events.map((ev) => {
          const m = midOf(ev)
          const prox = eventProximity(ev, now)
          return (
            <li key={ev.id}>
              <button
                type="button"
                className={styles.nocheRow}
                data-prox={prox}
                style={{ ['--ne' as string]: energyHex(m) }}
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect()
                  openLectura(ev.slug, { x: r.left, y: r.top, width: r.width, height: r.height })
                }}
              >
                <span className={styles.nDay} style={{ fontVariationSettings: energyVariation(m) }}>
                  {fmt.dayNum(ev.date!)}
                </span>
                <span className={styles.nWhen}>
                  <span>
                    {fmt.month(ev.date!)} · {fmt.weekday(ev.date!)}
                  </span>
                  <span className={styles.nProx}>{PROXIMITY_LABEL[prox]}</span>
                </span>
                <span className={styles.nTitle}>{ev.title}</span>
                <span className={styles.nVenue}>
                  {ev.venue ?? ''}
                  {ev.date ? ` · ${fmt.time(ev.date)}` : ''}
                </span>
                <span className={styles.nGo} aria-hidden="true">
                  <Mark name="arrow" size={14} />
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

// ── who and where ───────────────────────────────────────────────────────────

function Constelacion({ ent, index }: { ent: Entidad; index: Map<string, Entidad> }) {
  const groups = useMemo(() => {
    const nights = ent.apariciones.filter((a) => a.item.type === 'evento' && (a.via === 'lineup' || a.via === 'sede')).map((a) => a.item.id)
    if (!nights.length) return []
    const ids = new Set(nights)
    const artists = new Map<string, number>()
    const venues = new Map<string, number>()
    for (const other of index.values()) {
      if (other.slug === ent.slug) continue
      let n = 0
      for (const a of other.apariciones) if (ids.has(a.item.id) && (a.via === 'lineup' || a.via === 'sede')) n++
      if (!n) continue
      if (other.kind === 'venue') venues.set(other.slug, n)
      else artists.set(other.slug, n)
    }
    const top = (m: Map<string, number>, limit: number) =>
      [...m.entries()]
        .sort((a, b) => b[1] - a[1] || index.get(a[0])!.name.localeCompare(index.get(b[0])!.name, 'es'))
        .slice(0, limit)
        .map(([slug, n]) => ({ slug, name: index.get(slug)!.name, n }))
    const out: Array<{ title: string; people: Array<{ slug: string; name: string; n: number }> }> = []
    if (ent.kind === 'venue') {
      if (artists.size) out.push({ title: 'Han sonado aquí', people: top(artists, 28) })
    } else {
      if (artists.size) out.push({ title: 'Comparte noche con', people: top(artists, 24) })
      if (venues.size) out.push({ title: 'Ha sonado en', people: top(venues, 12) })
    }
    return out
  }, [ent, index])

  if (!groups.length) return null
  return (
    <section className={styles.constelacion} aria-label="Constelación">
      {groups.map((g) => (
        <div key={g.title} className={styles.group}>
          <p className="label">{g.title}</p>
          <ul className={styles.names}>
            {g.people.map((p) => (
              <li key={p.slug}>
                <Link href={`/e/${p.slug}`} className={styles.name}>
                  {p.name}
                  {p.n > 1 ? <span className={styles.times}>×{p.n}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
