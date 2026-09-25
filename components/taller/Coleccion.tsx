'use client'

/**
 * Your collection, four ways: GUARDADOS (everything you kept, newest kept
 * first), TU AGENDA (the kept nights still ahead, in calendar order), TUS
 * SESIONES (the kept mixes, one press from the console), FRANJAS QUE SIGUES.
 * Nothing here is ranked: time is the only order.
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ContentItem, User } from '@/lib/types'
import { useDispatch, useItems, useWorld } from '@/lib/store/world'
import { useUI } from '@/lib/store/ui'
import { openSourceUrl, PLATFORM_LABEL, playableSource, usePlayer, type Track } from '@/lib/store/player'
import { bandGradient, energyHex, energyVariation } from '@/lib/vibe'
import { fitTitle } from '@/lib/typeset'
import { ago, fmt, isUpcoming } from '@/lib/logic/time'
import { FormatGlyph, FORMAT_LABEL, Mark } from '@/components/kit/Glyph'
import { Button } from '@/components/kit/Button'
import { durationLabel } from '@/components/pieza/Pieza'
import { Accion, Panel, Vacio } from './kit'
import { FRANJA_KIND_LABEL, pieceEnergy, urgencyWord, type SavedEntry } from './logic'
import styles from './Panel.module.css'

const UNDO_MS = 6000
const GUARDADOS_FIRST = 8

function rectOf(el: Element) {
  const r = el.getBoundingClientRect()
  return { x: r.left, y: r.top, width: r.width, height: r.height }
}

// ── GUARDADOS ───────────────────────────────────────────────────────────────

export function Guardados({ me, saved, now, index }: { me: User; saved: SavedEntry[]; now: Date; index?: string }) {
  const dispatch = useDispatch()
  const openLectura = useUI((s) => s.openLectura)
  const [pending, setPending] = useState<string[]>([])
  const [all, setAll] = useState(false)
  const timers = useRef(new Map<string, number>())

  // Leaving the desk mid-undo still honors the «Quitar»: pending removals flush.
  useEffect(() => {
    const map = timers.current
    return () => {
      for (const [id, t] of map) {
        window.clearTimeout(t)
        dispatch({ t: 'save', userId: me.id, itemId: id, on: false, at: new Date().toISOString() })
      }
      map.clear()
    }
  }, [dispatch, me.id])

  // The unsave is written only when the window closes: «Restaurar» is then
  // a true undo, not a second save (which would feed the piece HL again).
  const remove = (id: string) => {
    setPending((p) => [...p, id])
    const t = window.setTimeout(() => {
      timers.current.delete(id)
      dispatch({ t: 'save', userId: me.id, itemId: id, on: false, at: new Date().toISOString() })
      setPending((p) => p.filter((x) => x !== id))
    }, UNDO_MS)
    timers.current.set(id, t)
  }
  const restore = (id: string) => {
    const t = timers.current.get(id)
    if (t) window.clearTimeout(t)
    timers.current.delete(id)
    setPending((p) => p.filter((x) => x !== id))
  }

  const list = useMemo(() => saved.filter((s) => s.item.type !== 'mix'), [saved])
  const visible = all ? list : list.slice(0, GUARDADOS_FIRST)

  return (
    <Panel
      label="Guardados"
      index={index}
      area="guardados"
      meta={list.length ? `${list.length} en tu colección` : undefined}
      actions={list.length > GUARDADOS_FIRST ? <Accion onClick={() => setAll((a) => !a)}>{all ? 'Menos' : `Ver los ${list.length}`}</Accion> : null}
    >
      {list.length === 0 ? (
        <Vacio>Lo que guardes en el campo queda aquí, en el orden en que lo guardaste. Los mixes viven en Tus sesiones.</Vacio>
      ) : (
        <ul className={styles.saved}>
          {visible.map(({ item, savedAt }) =>
            pending.includes(item.id) ? (
              <li key={item.id} className={styles.undo}>
                <p className={styles.undoText}>
                  Quitada de tu colección: <em>«{item.title}»</em>
                </p>
                <Button variant="ghost" size="sm" onClick={() => restore(item.id)}>
                  Restaurar
                </Button>
                <span className={styles.undoTimer} style={{ animationDuration: `${UNDO_MS}ms` }} aria-hidden="true" />
              </li>
            ) : (
              <li key={item.id} className={styles.savedItem}>
                <SavedTile item={item} onOpen={(el) => openLectura(item.slug, rectOf(el))} />
                <div className={styles.savedFoot}>
                  <span className={styles.savedWhen}>{ago(savedAt, now)}</span>
                  <Accion onClick={() => remove(item.id)} label={`Quitar «${item.title}» de tu colección`}>
                    Quitar
                  </Accion>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </Panel>
  )
}

function SavedTile({ item, onOpen }: { item: ContentItem; onOpen: (el: HTMLElement) => void }) {
  const e = pieceEnergy(item)
  return (
    <button
      type="button"
      className={styles.tile}
      onClick={(ev) => onOpen(ev.currentTarget)}
      aria-label={`${FORMAT_LABEL[item.type]}: ${item.title}`}
      style={{ '--e': energyHex(e.mid), '--band': bandGradient(e.min, e.max) } as React.CSSProperties}
    >
      {item.imageUrl ? (
        <Image src={item.imageUrl} alt="" fill sizes="(max-width: 640px) 45vw, 180px" className={styles.tileImg} />
      ) : (
        <span className={styles.tilePlate} style={{ background: bandGradient(e.min, e.max, '160deg') }} />
      )}
      <span className={styles.tileScrim} />
      <span className={styles.tileFmt}>
        <FormatGlyph type={item.type} size={10} />
      </span>
      <span className={styles.tileTitle} style={{ fontVariationSettings: energyVariation(e.mid), fontSize: fitTitle(item.title, e.mid, 17, 11.5, 0.9) }}>
        {item.title}
      </span>
      <span className={styles.tileLine} aria-hidden="true" />
    </button>
  )
}

// ── TU AGENDA ───────────────────────────────────────────────────────────────

export function Agenda({ saved, now, index }: { saved: SavedEntry[]; now: Date; index?: string }) {
  const openLectura = useUI((s) => s.openLectura)
  const events = useMemo(
    () =>
      saved
        .filter((s) => s.item.type === 'evento' && s.item.date && isUpcoming(s.item, now))
        .map((s) => s.item)
        .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')),
    [saved, now],
  )
  return (
    <Panel label="Tu agenda" index={index} area="agenda" flush meta={events.length ? `Próximas · ${events.length}` : 'Próximas'}>
      {events.length === 0 ? (
        <Vacio action={<Button variant="quiet" size="sm" href="/agenda" iconRight={<Mark name="arrow" size={13} />}>Ver la agenda</Button>}>
          No tienes noches guardadas por delante. Guarda un evento y aparecerá aquí, en orden de calendario.
        </Vacio>
      ) : (
        <ul className={styles.agenda}>
          {events.map((ev) => {
            const e = pieceEnergy(ev)
            const word = urgencyWord(ev, now)
            return (
              <li key={ev.id}>
                <button type="button" className={styles.agendaRow} onClick={(x) => openLectura(ev.slug, rectOf(x.currentTarget))} style={{ '--e': energyHex(e.mid) } as React.CSSProperties}>
                  <span className={styles.agendaDate}>
                    <span className={styles.agendaDay} style={{ fontVariationSettings: energyVariation(e.mid) }}>
                      {fmt.dayNum(ev.date!)}
                    </span>
                    <span className={styles.agendaMonth}>{fmt.month(ev.date!)}</span>
                  </span>
                  <span className={styles.agendaText}>
                    <span className={styles.agendaTitle}>{ev.title}</span>
                    <span className={styles.agendaMeta}>{[fmt.time(ev.date!), ev.venue].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className={styles.urgency} data-word={word === 'EN VIVO' ? 'live' : word === 'HOY' ? 'hoy' : undefined}>
                    {word}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

// ── TUS SESIONES ────────────────────────────────────────────────────────────

function toTrack(item: ContentItem): Track | null {
  const source = playableSource(item)
  if (!source) return null
  const e = pieceEnergy(item)
  return { itemId: item.id, slug: item.slug, title: item.title, artist: item.author, imageUrl: item.imageUrl, energy: e.mid, source }
}

export function Sesiones({ saved, index }: { saved: SavedEntry[]; index?: string }) {
  const openLectura = useUI((s) => s.openLectura)
  const current = usePlayer((s) => s.track?.itemId ?? null)
  const playing = usePlayer((s) => s.playing)
  const mixes = useMemo(() => saved.filter((s) => s.item.type === 'mix').map((s) => s.item), [saved])
  const queue = useMemo(() => mixes.map(toTrack).filter((t): t is Track => t !== null), [mixes])

  return (
    <Panel label="Tus sesiones" index={index} area="sesiones" flush meta={mixes.length ? `${mixes.length} ${mixes.length === 1 ? 'mix guardado' : 'mixes guardados'}` : undefined}>
      {mixes.length === 0 ? (
        <Vacio>Guarda un mix y quedará aquí, listo para sonar en la consola.</Vacio>
      ) : (
        <ul className={styles.sesiones}>
          {mixes.map((m) => {
            const e = pieceEnergy(m)
            const track = queue.find((t) => t.itemId === m.id) ?? null
            const isThis = current === m.id
            const out = track ? null : openSourceUrl(m)
            const outPlatform = m.embeds?.[0]?.platform
            return (
              <li key={m.id} className={styles.sesion} data-playing={(isThis && playing) || undefined} style={{ '--e': energyHex(e.mid), '--band': bandGradient(e.min, e.max) } as React.CSSProperties}>
                <button type="button" className={styles.sesionOpen} onClick={(x) => openLectura(m.slug, rectOf(x.currentTarget))} aria-label={`Abrir «${m.title}»`}>
                  <span className={styles.cover}>
                    {m.imageUrl ? <Image src={m.imageUrl} alt="" fill sizes="52px" className={styles.coverImg} /> : <span className={styles.tilePlate} style={{ background: bandGradient(e.min, e.max, '160deg') }} />}
                  </span>
                  <span className={styles.sesionText}>
                    <span className={styles.sesionTitle} style={{ fontVariationSettings: energyVariation(e.mid) }}>
                      {m.title}
                    </span>
                    <span className={styles.sesionMeta}>{[m.mixSeries, m.duration ? durationLabel(m.duration) : null].filter(Boolean).join(' · ') || FORMAT_LABEL.mix}</span>
                  </span>
                </button>
                {track ? (
                  <button
                    type="button"
                    className={styles.play}
                    aria-label={isThis && playing ? `Pausar «${m.title}»` : `Reproducir «${m.title}»`}
                    aria-pressed={isThis && playing}
                    onClick={() => {
                      const p = usePlayer.getState()
                      if (isThis) p.toggle()
                      else p.play(track, queue)
                    }}
                  >
                    <Mark name={isThis && playing ? 'pause' : 'play'} size={14} />
                  </button>
                ) : out ? (
                  <a className={styles.outLink} href={out} target="_blank" rel="noopener noreferrer">
                    {outPlatform ? PLATFORM_LABEL[outPlatform] : 'Abrir'} <Mark name="external" size={11} />
                  </a>
                ) : (
                  <span className={styles.noSource}>Sin fuente para escuchar</span>
                )}
                <span className={styles.sesionLine} aria-hidden="true" />
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

// ── FRANJAS QUE SIGUES ──────────────────────────────────────────────────────

export function Franjas({ me, now, index }: { me: User; now: Date; index?: string }) {
  const follows = useWorld((s) => s.world.follows[me.id])
  const items = useItems()
  const dispatch = useDispatch()
  const openLectura = useUI((s) => s.openLectura)
  const franjas = useMemo(() => {
    if (!follows?.length) return []
    const byId = new Map(items.map((i) => [i.id, i]))
    return follows
      .map((id) => byId.get(id))
      .filter((f): f is ContentItem => Boolean(f))
      .sort((a, b) => (b.franjaLastUpdated ?? b.publishedAt).localeCompare(a.franjaLastUpdated ?? a.publishedAt))
  }, [follows, items])

  return (
    <Panel label="Franjas que sigues" index={index} area="franjas" flush meta={franjas.length ? `${franjas.length} · por última señal` : undefined}>
      {franjas.length === 0 ? (
        <Vacio action={<Button variant="quiet" size="sm" href="/" iconRight={<Mark name="arrow" size={13} />}>Ir al campo</Button>}>
          No sigues ninguna franja. Sintoniza una en el Dial del campo y sus señales llegarán aquí.
        </Vacio>
      ) : (
        <ul className={styles.franjas}>
          {franjas.map((f) => (
            <li key={f.id} className={styles.franja}>
              <button type="button" className={styles.franjaOpen} onClick={(x) => openLectura(f.slug, rectOf(x.currentTarget))} aria-label={`Sintonizar ${f.title}`}>
                <span className={styles.logo}>
                  {f.imageUrl ? <Image src={f.imageUrl} alt="" fill sizes="40px" className={styles.coverImg} /> : <span className={styles.logoInitial}>{f.title.slice(0, 1)}</span>}
                </span>
                <span className={styles.franjaText}>
                  <span className={styles.franjaName}>{f.title}</span>
                  <span className={styles.franjaMeta}>
                    {[f.franjaKind ? FRANJA_KIND_LABEL[f.franjaKind] : null, `señal ${ago(f.franjaLastUpdated ?? f.publishedAt, now)}`].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </button>
              <span className={styles.franjaActions}>
                <Link href={`/f/${f.slug}`} className={styles.miniLink}>
                  Dossier
                </Link>
                <Accion onClick={() => dispatch({ t: 'follow', userId: me.id, franjaId: f.id, on: false, at: new Date().toISOString() })} label={`Dejar de seguir ${f.title}`}>
                  Dejar
                </Accion>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
