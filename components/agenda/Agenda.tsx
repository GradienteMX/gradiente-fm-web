'use client'

/**
 * AGENDA — the nights of the scene, one by one.
 *
 *  · Horizonte on top: energy (and genre particles) quiet what's out of
 *    your temperature without moving it — the calendar keeps its shape.
 *  · Densidad: the next thirty nights as one strip (how full, how hot).
 *  · Buscar: title / venue / city / artists, accent-insensitive. An active
 *    query spans the archive too, so an old night can be found.
 *  · Río: night-by-night rows; tonight is marked in its energy, whatever is
 *    sounding right now is flagged live.
 *  · Archivo on demand: past nights as an organism (rankAgenda), grayed.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'
import type { ContentItem } from '@/lib/types'
import { useItems, useNow } from '@/lib/store/world'
import { useCampo } from '@/lib/store/campo'
import { computePeakByType, score } from '@/lib/curation'
import { rankAgendaItems } from '@/lib/logic/feed'
import { presentGenres } from '@/lib/logic/genres'
import { bandOverlaps } from '@/lib/vibe'
import { Horizonte } from '@/components/horizonte/Horizonte'
import { Organismo } from '@/components/organismo/Organismo'
import { Mark } from '@/components/kit/Glyph'
import { Cabecera } from '@/components/librea/Cabecera'
import { LIBREA_SECCION } from '@/lib/librea'
import { EstadoSeccion } from '@/components/secciones/EstadoSeccion'
import { useFiltroSeccion } from '@/components/secciones/useFiltroSeccion'
import { eventHaystack, fold, plural } from '@/components/secciones/texto'
import { density, groupNights, riverRows, sigueViva } from './noches'
import { Densidad } from './Densidad'
import { Rio } from './Rio'
import styles from './Agenda.module.css'

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollToPlugin)

function scrollOffset(): number {
  const nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 60
  return nav + 76
}

function travelTo(el: Element | null) {
  if (!el) return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  gsap.to(window, {
    scrollTo: { y: el, offsetY: scrollOffset(), autoKill: true },
    duration: reduced ? 0 : 0.7,
    ease: 'power3.inOut',
  })
}

export function Agenda() {
  const all = useItems()
  const now = useNow()
  const minute = Math.floor(now.getTime() / 60_000)
  const at = useMemo(() => new Date(minute * 60_000), [minute])
  const setPresent = useCampo((s) => s.setPresent)

  const [query, setQuery] = useState('')
  const [archive, setArchive] = useState(false)
  const archiveRef = useRef<HTMLElement>(null)
  const wantArchiveScroll = useRef(false)

  const events = useMemo(() => all.filter((i) => i.type === 'evento'), [all])
  const upcoming = useMemo(() => events.filter((e) => sigueViva(e, at)), [events, at])
  const past = useMemo(() => events.filter((e) => !sigueViva(e, at)), [events, at])

  const q = fold(query.trim())
  const matches = useCallback((e: ContentItem) => !q || eventHaystack(e).includes(q), [q])
  const upcomingQ = useMemo(() => upcoming.filter(matches), [upcoming, matches])

  // The instrument: energy ∩ genres. Particles float over this night list.
  const { range, genres, passes } = useFiltroSeccion(upcomingQ, { publishPresent: false })
  useEffect(() => {
    setPresent(presentGenres(upcomingQ.filter((e) => bandOverlaps(e, range))))
  }, [upcomingQ, range, setPresent])
  const narrowed = range[0] > 0 || range[1] < 10 || genres.length > 0

  const allNights = useMemo(() => groupNights(upcoming, at), [upcoming, at])
  const shownNights = useMemo(() => groupNights(upcomingQ, at), [upcomingQ, at])
  const rows = useMemo(() => riverRows(shownNights, at), [shownNights, at])
  const dias = useMemo(() => density(allNights, (e) => matches(e) && passes(e), at), [allNights, matches, passes, at])
  const reachable = useMemo(() => new Set(shownNights.keys()), [shownNights])
  const lit = useMemo(() => upcomingQ.filter(passes).length, [upcomingQ, passes])

  const peaks = useMemo(() => computePeakByType(events, at), [events, at])
  const lifeOf = useCallback((e: ContentItem) => Math.min(1.2, score(e, peaks, at)), [peaks, at])

  // Archive: on demand, or wherever a search reaches.
  const pastShown = useMemo(() => {
    if (!archive && !q) return []
    return past.filter((e) => matches(e) && passes(e))
  }, [archive, q, past, matches, passes])
  const pastRanked = useMemo(() => rankAgendaItems(pastShown, at), [pastShown, at])

  const pick = useCallback((key: string) => travelTo(document.getElementById(`noche-${key}`)), [])

  const toggleArchive = () => {
    setArchive((a) => {
      if (!a) wantArchiveScroll.current = true
      return !a
    })
  }
  useEffect(() => {
    if (archive && wantArchiveScroll.current) {
      wantArchiveScroll.current = false
      requestAnimationFrame(() => travelTo(archiveRef.current))
    }
  }, [archive])

  // Deep link: /agenda#noche-2026-10-03 travels to that night.
  useEffect(() => {
    const h = window.location.hash
    if (!h.startsWith('#noche-')) return
    const t = window.setTimeout(() => travelTo(document.getElementById(h.slice(1))), 450)
    return () => window.clearTimeout(t)
  }, [])

  // Real counts for the masthead: nights announced, this week, tonight.
  const counts = useMemo(() => {
    const day = new Date(at)
    day.setHours(0, 0, 0, 0)
    const d0 = day.getTime()
    const at7 = d0 + 7 * 86_400_000
    let week = 0
    let tonight = 0
    for (const e of upcoming) {
      const t = e.date ? Date.parse(e.date) : NaN
      if (!Number.isFinite(t)) continue
      if (t < at7) week++
      if (t < d0 + 86_400_000 + 6 * 3_600_000) tonight++
    }
    return { week, tonight }
  }, [upcoming, at])

  const archiveLabel = archive ? 'Ocultar archivo' : `Ver archivo · ${past.length} ${plural(past.length, 'evento pasado', 'eventos pasados')}`

  return (
    <div className={styles.agenda}>
      <Cabecera
        librea={LIBREA_SECCION.agenda}
        lema="Las noches de la escena, una por una. Lo que queda fuera de tu temperatura no se mueve de su lugar: solo se queda en silencio, para que el calendario conserve su forma."
        datos={[
          { k: plural(upcoming.length, 'anunciada', 'anunciadas'), v: String(upcoming.length).padStart(2, '0') },
          { k: 'esta semana', v: String(counts.week).padStart(2, '0') },
          { k: 'hoy · CDMX', v: String(counts.tonight).padStart(2, '0') },
        ]}
      />
      <Horizonte showFormats={false} />
      <div className={styles.frame}>

        <Densidad dias={dias} now={at} reachable={reachable} narrowed={narrowed} searching={Boolean(q)} onPick={pick} />

        <div className={styles.controls}>
          <label className={styles.search}>
            <span className="sr-only">Buscar en la agenda</span>
            <Mark name="search" size={16} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar evento, artista, venue o ciudad…"
              onKeyDown={(e) => {
                if (e.key === 'Escape' && query) {
                  e.preventDefault()
                  setQuery('')
                }
              }}
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
            />
            {query ? (
              <button type="button" className={styles.clear} onClick={() => setQuery('')} aria-label="Limpiar búsqueda">
                <Mark name="close" size={14} />
              </button>
            ) : null}
          </label>
          {past.length ? (
            <button type="button" className={styles.archiveBtn} onClick={toggleArchive} aria-expanded={archive} aria-controls="archivo" data-on={archive || undefined}>
              <span className={styles.archiveDot} aria-hidden="true" />
              {archiveLabel}
            </button>
          ) : null}
        </div>

        <EstadoSeccion
          shown={lit}
          total={upcomingQ.length}
          noun={['evento', 'eventos']}
          order="Noche por noche, de hoy en adelante"
          phrase={q ? `${lit === 1 ? 'coincide' : 'coinciden'} con «${query.trim()}»${narrowed ? ' en esta temperatura' : ''}` : undefined}
        />

        <h2 className="sr-only">Próximas noches</h2>
        {rows.length ? (
          <>
            {lit === 0 ? (
              <p className={styles.silence}>Nada en esta temperatura. Todo sigue en su noche, en silencio — mueve el horizonte.</p>
            ) : null}
            <Rio rows={rows} now={now} passes={passes} narrowed={narrowed} searching={Boolean(q)} lifeOf={lifeOf} />
          </>
        ) : (
          <div className={styles.none}>
            <p className={styles.noneTitle}>{q ? `Ninguna noche próxima coincide con «${query.trim()}».` : 'Todavía no hay noches anunciadas.'}</p>
            <p className={styles.noneBody}>
              {q ? (pastShown.length ? 'El archivo sí la recuerda: está más abajo.' : 'Prueba con otro nombre, un venue o una ciudad.') : 'Cuando alguien publique un evento, aparecerá aquí en su noche.'}
            </p>
          </div>
        )}

        {!archive && !q && past.length ? (
          <div className={styles.end}>
            <p>Hasta aquí lo anunciado. El archivo guarda {past.length} {plural(past.length, 'evento que ya pasó', 'eventos que ya pasaron')}.</p>
            <button type="button" className={styles.archiveBtn} onClick={toggleArchive} aria-expanded={false} aria-controls="archivo">
              <span className={styles.archiveDot} aria-hidden="true" />
              {archiveLabel}
            </button>
          </div>
        ) : null}

        {archive || (q && pastShown.length) ? (
          <section ref={archiveRef} id="archivo" className={styles.archivo} aria-labelledby="archivo-h">
            <header className={styles.archivoHead}>
              <h2 id="archivo-h" className={styles.archivoTitle}>
                Archivo
              </h2>
              <p className={styles.archivoSub}>
                {q && !archive
                  ? `${pastShown.length} ${plural(pastShown.length, 'evento pasado coincide', 'eventos pasados coinciden')} con tu búsqueda.`
                  : `${pastShown.length} ${plural(pastShown.length, 'evento que ya pasó', 'eventos que ya pasaron')}${narrowed ? ' en esta temperatura' : ''}${q ? ` con «${query.trim()}»` : ''} — en gris, pero aquí.`}
              </p>
              {archive ? (
                <button type="button" className={styles.archiveBtn} onClick={toggleArchive} aria-expanded aria-controls="archivo" data-on="">
                  <span className={styles.archiveDot} aria-hidden="true" />
                  Ocultar archivo
                </button>
              ) : null}
            </header>
            <Organismo
              ranked={pastRanked}
              empty={
                <div className={styles.none}>
                  <p className={styles.noneTitle}>Nada del archivo en esta temperatura.</p>
                  <p className={styles.noneBody}>Mueve el horizonte o suelta un filtro.</p>
                </div>
              }
            />
          </section>
        ) : null}
      </div>
    </div>
  )
}
