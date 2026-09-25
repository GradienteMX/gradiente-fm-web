'use client'

/**
 * SESIÓN — a mix, read as an object you can play.
 *
 * The cover is the sleeve; the record rests inside it. When this mix is the
 * one loaded in the Consola the record slides out and turns at 33⅓ (with a
 * platter's mass: quick to start, coasting to a stop on pause), and a hairline
 * stylus marks where the needle is — outer groove at the start, the label at
 * the end. While a Sesión of the current mix is open, the floating capsule
 * docks into this page: the hero IS the deck.
 *
 * Play is synchronous in the click (and on P); O opens the chosen source.
 * Drivable sources (SoundCloud, YouTube, Spotify) are a choice of where to
 * listen; Bandcamp and Mixcloud are honest link-outs.
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import gsap from 'gsap'
import type { ContentItem, MixStatus } from '@/lib/types'
import { usePlayer, PLATFORM_LABEL } from '@/lib/store/player'
import { clock, mixTrack, parseBpmRange, parseClock, SOURCE_NOTE, sourcesOf, span, tempoOf, type SourceRow } from '@/lib/audio/sources'
import { Calibrador } from '../Calibrador'
import { Paragraphs } from '../Prosa'
import { PollCanvas } from '@/components/encuesta/PollCanvas'
import { Mark } from '@/components/kit/Glyph'
import { Kbd } from '@/components/kit/Bits'
import { Disco } from '@/components/consola/Disco'
import { Aguja, Reloj } from '@/components/consola/Aguja'
import { modoDe, useEstado } from '@/components/consola/estado'
import { usePosicion, useReducedMotion } from '@/components/consola/hooks'
import { Byline, Contexto, Dek, Kicker, Presenta, Siguientes, Taxonomia, Title, type ReaderProps } from './parts'
import styles from './Sesion.module.css'

export type { ReaderProps }

const STATUS_LABEL: Record<MixStatus, string> = {
  disponible: 'Disponible',
  exclusivo: 'Exclusivo',
  archivo: 'Archivo',
  proximamente: 'Próximamente',
}

/** Label diameter as a share of the record — the Tornamesa and its stylus agree on it. */
const LABEL = 0.38

export function Sesion({ item }: ReaderProps) {
  const sources = useMemo(() => sourcesOf(item), [item])
  const playable = useMemo(() => sources.filter((s) => s.playable), [sources])
  const links = useMemo(() => sources.filter((s) => !s.playable), [sources])
  const track = usePlayer((s) => s.track)
  const current = Boolean(track && track.itemId === item.id && track.entry === undefined)
  const playing = usePlayer((s) => s.playing) && current
  const capture = usePlayer((s) => s.capture)
  const [pick, setPick] = useState<string | null>(null)
  const selected: SourceRow | null =
    playable.find((s) => s.url === (pick ?? (current ? track!.source.url : ''))) ?? playable[0] ?? null
  const bpm = useMemo(() => tempoOf(item), [item])
  const length = span(parseClock(item.duration))

  // Bind a lazy platform (YouTube/Spotify) as soon as it's the chosen source,
  // so the first press autoplays inside the gesture.
  useEffect(() => {
    if (selected && (selected.platform === 'youtube' || selected.platform === 'spotify')) usePlayer.getState().prime(selected.platform, selected.url)
  }, [selected])

  const play = (source: SourceRow | null = selected) => {
    if (!source) return
    const s = usePlayer.getState()
    const loaded = s.track && s.track.itemId === item.id && s.track.entry === undefined && s.track.source.url === source.url
    if (loaded) return s.toggle()
    const t = mixTrack(item, { platform: source.platform, url: source.url })
    if (t) s.play(t)
  }
  const playRef = useRef(play)
  playRef.current = play

  const choose = (s: SourceRow) => {
    setPick(s.url)
    const P = usePlayer.getState()
    // Switching the source of the mix that's sounding switches it now.
    if (current && P.playing && P.track?.source.url !== s.url) play(s)
  }

  // P — play/pause (or load this mix); O — open the chosen source.
  const openUrl = selected?.url ?? links[0]?.url ?? null
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (document.querySelectorAll('[role="dialog"][aria-modal="true"]').length > 1) return
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        playRef.current()
      } else if ((e.key === 'o' || e.key === 'O') && openUrl) {
        e.preventDefault()
        window.open(openUrl, '_blank', 'noopener,noreferrer')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openUrl])

  const body = (item.bodyPreview ?? item.excerpt ?? '').replace(/\n(?!\n)/g, '\n\n')

  return (
    <article className={styles.sesion} data-current={current || undefined}>
      <section className={styles.hero}>
        <Tornamesa item={item} current={current} playing={playing} onPlay={() => play()} />
        <div className={styles.info}>
          <Kicker item={item}>
            {item.mixStatus ? (
              <span className={styles.estatus} data-status={item.mixStatus}>
                {STATUS_LABEL[item.mixStatus]}
              </span>
            ) : null}
          </Kicker>
          <Title item={item} max={76} min={30} />
          {item.subtitle ? <Dek>{item.subtitle}</Dek> : null}
          <Byline
            item={item}
            extra={[item.mixSeries, length].filter(Boolean).length ? <span className={styles.serie}>{[item.mixSeries, length].filter(Boolean).join(' · ')}</span> : null}
          />

          <Mando item={item} current={current} playing={playing} selected={selected} links={links} length={length} bpm={bpm} capture={capture} onPlay={() => play()} />

          <Fuentes playable={playable} links={links} selected={selected} current={current} loadedUrl={current ? track!.source.url : null} onChoose={choose} />

          <p className={styles.teclas} data-rise="">
            {selected ? (
              <>
                <Kbd>P</Kbd> {playing ? 'pausa' : 'reproduce'}
              </>
            ) : null}
            {openUrl ? (
              <>
                <Kbd>O</Kbd> abre la fuente
              </>
            ) : null}
          </p>
        </div>
      </section>

      <div className={styles.calibra}>
        <Calibrador item={item} />
      </div>

      <div className={styles.grid}>
        <div className={styles.main}>
          {body ? <Paragraphs text={body} /> : null}
          <Tracklist item={item} current={current} />
          {item.poll ? <PollCanvas item={item} variant="section" /> : null}
          <Taxonomia item={item} />
        </div>
        <aside className={styles.rail}>
          <Ficha item={item} length={length} />
          <Contexto item={item} />
          <Presenta item={item} />
        </aside>
      </div>

      <div className={styles.after}>
        <Siguientes item={item} label="Siguientes mixes" />
      </div>
    </article>
  )
}

// ── the object ──────────────────────────────────────────────────────────────

function Tornamesa({ item, current, playing, onPlay }: { item: ContentItem; current: boolean; playing: boolean; onPlay: () => void }) {
  const wrap = useRef<HTMLDivElement>(null)
  const stylus = useRef<HTMLSpanElement>(null)
  const first = useRef(true)
  const reduced = useReducedMotion()

  // Out of the sleeve while loaded; resting (a third out) otherwise.
  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const x = current ? 57 : 33
    if (first.current || reduced) {
      first.current = false
      gsap.set(el, { xPercent: x })
    } else gsap.to(el, { xPercent: x, duration: 1.25, ease: 'expo.out', overwrite: true })
  }, [current, reduced])

  const peek = (on: boolean) => {
    if (current || reduced || !wrap.current) return
    gsap.to(wrap.current, { xPercent: on ? 40 : 33, duration: on ? 0.7 : 0.9, ease: on ? 'expo.out' : 'power3.out', overwrite: true })
  }

  // The needle's radius: outer groove at 0, the label's edge at the end.
  usePosicion((t, d) => {
    const el = stylus.current
    if (!el) return
    const p = d > 0 ? Math.min(1, t / d) : 0
    const outer = 0.955
    const inner = LABEL + 0.05
    el.style.setProperty('--r', (outer - p * (outer - inner)).toFixed(4))
  })

  return (
    <div className={styles.tornamesa} data-rise="" onPointerEnter={() => peek(true)} onPointerLeave={() => peek(false)} onClick={onPlay} aria-hidden="true">
      <div ref={wrap} className={styles.discoWrap}>
        <Disco src={item.imageUrl} spinning={playing} label={LABEL} sizes="(max-width: 900px) 40vw, 240px" className={styles.disco} priority />
        {current ? <span ref={stylus} className={styles.stylus} /> : null}
      </div>
      <div className={styles.funda}>
        {item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="(max-width: 900px) 70vw, 460px" className={styles.cover} priority /> : null}
        <span className={styles.fundaLinea} />
      </div>
    </div>
  )
}

// ── transport ───────────────────────────────────────────────────────────────

function Mando({
  item,
  current,
  playing,
  selected,
  links,
  length,
  bpm,
  capture,
  onPlay,
}: {
  item: ContentItem
  current: boolean
  playing: boolean
  selected: SourceRow | null
  links: SourceRow[]
  length: string | null
  bpm: number | null
  capture: ReturnType<typeof usePlayer.getState>['capture']
  onPlay: () => void
}) {
  const estado = useEstado()
  const preview = usePlayer((s) => s.preview)
  const reduced = useReducedMotion()

  let word: string
  let tone: 'vivo' | 'quieto' | 'falla' = 'quieto'
  let detail: string
  if (!selected) {
    word = 'SIN FUENTE'
    detail = links.length ? `Solo se puede escuchar en ${links.map((l) => PLATFORM_LABEL[l.platform]).join(' o ')}.` : 'Este mix todavía no trae una fuente.'
  } else if (!current) {
    word = 'ESCUCHAR'
    const secs = parseClock(item.duration)
    detail = [secs ? clock(secs) : length, PLATFORM_LABEL[selected.platform]].filter(Boolean).join(' · ')
  } else {
    word = estado.word
    tone = estado.tone
    detail = [PLATFORM_LABEL[selected.platform], playing ? modoDe(capture, bpm, reduced) : null, preview && playing ? 'solo 30 s sin Premium' : null].filter(Boolean).join(' · ')
  }

  return (
    <div className={styles.mando} data-rise="">
      <div className={styles.mandoFila}>
        <button
          type="button"
          className={styles.play}
          onClick={onPlay}
          disabled={!selected}
          data-on={playing || undefined}
          aria-label={!selected ? 'Sin fuente reproducible' : playing ? `Pausar «${item.title}»` : `Reproducir «${item.title}»`}
        >
          <Mark name={playing ? 'pause' : 'play'} size={24} />
        </button>
        <div className={styles.mandoTexto}>
          <span className={styles.palabra} data-tone={tone} aria-live="polite">
            {word}
          </span>
          <span className={styles.detalle}>{detail}</span>
        </div>
        {current ? <Reloj className={styles.reloj} /> : null}
      </div>
      {current ? <Aguja variant="sesion" className={styles.aguja} label={`Posición en «${item.title}»`} /> : null}
    </div>
  )
}

// ── sources ─────────────────────────────────────────────────────────────────

function Fuentes({
  playable,
  links,
  selected,
  current,
  loadedUrl,
  onChoose,
}: {
  playable: SourceRow[]
  links: SourceRow[]
  selected: SourceRow | null
  current: boolean
  loadedUrl: string | null
  onChoose: (s: SourceRow) => void
}) {
  if (!playable.length && !links.length) return null
  const note = selected ? SOURCE_NOTE[selected.platform] : !playable.length && links[0] ? SOURCE_NOTE[links[0].platform] : undefined

  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!selected || playable.length < 2) return
    const i = playable.findIndex((s) => s.url === selected.url)
    let n = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % playable.length
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + playable.length) % playable.length
    if (n < 0) return
    e.preventDefault()
    onChoose(playable[n])
    const btns = e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')
    btns[n]?.focus()
  }

  return (
    <div className={styles.fuentes} data-rise="">
      {playable.length ? (
        <div className={styles.tabs} role="radiogroup" aria-label="Dónde escuchar" onKeyDown={onKey}>
          {playable.map((s) => {
            const on = s.url === selected?.url
            return (
              <button
                key={s.url}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                className={styles.tab}
                onClick={() => onChoose(s)}
              >
                {current && loadedUrl === s.url ? <span className={styles.tabVivo} aria-hidden="true" /> : null}
                {PLATFORM_LABEL[s.platform]}
              </button>
            )
          })}
        </div>
      ) : null}
      <div className={styles.salidas}>
        {selected ? (
          <a className={styles.salida} href={selected.url} target="_blank" rel="noopener noreferrer">
            Abrir en {PLATFORM_LABEL[selected.platform]} <Mark name="external" size={11} />
          </a>
        ) : null}
        {links.map((l) => (
          <a key={l.url} className={styles.salida} href={l.url} target="_blank" rel="noopener noreferrer">
            Abrir en {PLATFORM_LABEL[l.platform]} <Mark name="external" size={11} />
          </a>
        ))}
      </div>
      {note ? <p className={styles.nota}>{note}</p> : null}
    </div>
  )
}

// ── tracklist ───────────────────────────────────────────────────────────────

function Tracklist({ item, current }: { item: ContentItem; current: boolean }) {
  const list = item.tracklist ?? []
  const bpms = list.map((t) => t.bpm).filter((b): b is number => typeof b === 'number')
  const range = parseBpmRange(item.bpmRange)
  const lo = Math.min(...bpms, range?.min ?? Infinity)
  const hi = Math.max(...bpms, range?.max ?? -Infinity)
  const pos = (b: number) => (hi > lo ? ((b - lo) / (hi - lo)) * 100 : 50)

  return (
    <section className={styles.tracklist} aria-label="Tracklist">
      <header className={styles.secHead}>
        <p className="label">Tracklist</p>
        {list.length ? (
          <span className={styles.secMeta}>
            {list.length} {list.length === 1 ? 'tema' : 'temas'} · en el orden del set
          </span>
        ) : null}
      </header>
      {list.length ? (
        <>
          <table className={styles.tabla}>
            <thead>
              <tr>
                <th scope="col" className={styles.cNum}>
                  #
                </th>
                <th scope="col">Artista</th>
                <th scope="col">Tema</th>
                <th scope="col" className={styles.cBpm}>
                  BPM
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((t, i) => (
                <tr key={i}>
                  <td className={styles.cNum}>{String(i + 1).padStart(2, '0')}</td>
                  <td className={styles.cArtista}>{t.artist}</td>
                  <td className={styles.cTema}>{t.title}</td>
                  <td className={styles.cBpm}>
                    {t.bpm ? (
                      <span className={styles.bpm}>
                        {bpms.length > 1 ? (
                          <span className={styles.bpmRiel} aria-hidden="true">
                            <span className={styles.bpmPunto} style={{ left: `${pos(t.bpm)}%` }} />
                          </span>
                        ) : null}
                        <span className={styles.bpmN}>{t.bpm}</span>
                      </span>
                    ) : (
                      <span className={styles.nd} aria-label="sin dato">
                        —
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {current ? <p className={styles.sinMarcas}>El set no trae marcas de tiempo: no sabemos qué tema suena ahora.</p> : null}
        </>
      ) : (
        <p className={styles.nd}>Tracklist no publicado.</p>
      )}
    </section>
  )
}

// ── context ─────────────────────────────────────────────────────────────────

function Ficha({ item, length }: { item: ContentItem; length: string | null }) {
  const rows: Array<[string, string]> = []
  if (item.mixSeries) rows.push(['Serie', item.mixSeries])
  if (item.recordedIn) rows.push(['Grabado en', item.recordedIn])
  if (item.mixFormat) rows.push(['Formato', item.mixFormat])
  const bpm = parseBpmRange(item.bpmRange)
  if (bpm) rows.push(['BPM', bpm.min === bpm.max ? String(Math.round(bpm.min)) : `${Math.round(bpm.min)}–${Math.round(bpm.max)}`])
  if (item.musicalKey) rows.push(['Tonalidad', item.musicalKey])
  if (length) rows.push(['Duración', length])
  if (item.mixStatus) rows.push(['Estatus', STATUS_LABEL[item.mixStatus]])
  return (
    <section className={styles.ficha} aria-label="Contexto">
      <p className="label">Contexto</p>
      {rows.length ? (
        <dl className={styles.dl}>
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className={styles.nd}>Sin datos de contexto.</p>
      )}
    </section>
  )
}
