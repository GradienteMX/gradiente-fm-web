'use client'

/**
 * SALA — the expanded deck: a listening sheet.
 *
 * A sheet laid over the page (below the nav, which stays usable): the record
 * at the center of its printed spectrogram, the deck and the queue beside it.
 * It doesn't depend on the field behind the DOM — the figure is drawn on the
 * sheet itself (Espectrograma). Esc, the close control, a click on the empty
 * sheet, a navigation or a reading opening all fold it back into the capsule.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Imagen as Image } from '@/components/kit/Imagen'
import gsap from 'gsap'
import { usePlayer, sameSlot, PLATFORM_LABEL, type Track } from '@/lib/store/player'
import { useUI } from '@/lib/store/ui'
import { useItems } from '@/lib/store/world'
import { energyVariation } from '@/lib/vibe'
import { fitTitle } from '@/lib/typeset'
import { clock, parseBpmRange, parseClock } from '@/lib/audio/sources'
import { captureSupported, requestCapture, stopCapture } from '@/lib/audio/captura'
import { FormatGlyph, Mark } from '@/components/kit/Glyph'
import { Disco } from './Disco'
import { Espectrograma } from './Espectrograma'
import { imprimirHoja } from '@/components/trama/api'
import { Aguja, Reloj } from './Aguja'
import { origen } from './Capsula'
import { energiaVar, modoDe, useEstado } from './estado'
import { useReducedMotion } from './hooks'
import styles from './Sala.module.css'

export function Sala({ bpm }: { bpm: number | null }) {
  const track = usePlayer((s) => s.track)
  const cue = usePlayer((s) => s.ambient[0] ?? null)
  const playing = usePlayer((s) => s.playing)
  const capture = usePlayer((s) => s.capture)
  const captureNote = usePlayer((s) => s.captureNote)
  const preview = usePlayer((s) => s.preview)
  const queue = usePlayer((s) => s.queue)
  const ambient = usePlayer((s) => s.ambient)
  const items = useItems()
  const openLectura = useUI((s) => s.openLectura)
  const estado = useEstado()
  const reduced = useReducedMotion()
  const shown: Track | null = track ?? cue
  const root = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const hub = useRef<HTMLButtonElement>(null)
  const playBtn = useRef<HTMLButtonElement>(null)
  const [closing, setClosing] = useState(false)

  const itemOf = useMemo(() => {
    const m = new Map(items.map((i) => [i.id, i]))
    return (id: string) => m.get(id) ?? null
  }, [items])
  const piece = shown ? itemOf(shown.itemId) : null
  const energy = shown?.energy ?? 5
  const bpmRange = piece && shown?.entry === undefined ? parseBpmRange(piece.bpmRange) : null
  const fromList = queue.length > 0 && queue !== ambient
  const listPiece = fromList ? itemOf(queue[0].itemId) : null

  const index = track ? queue.findIndex((q) => sameSlot(q, track)) : -1
  const hasNext = Boolean(track) && queue.length > 0 && index < queue.length - 1
  const canBack = usePlayer((s) => Boolean(s.track) && (s.time > 5 || (s.queue.findIndex((q) => sameSlot(q, s.track!)) > 0)))

  // Entrance: the sheet comes off the press from the capsule's disc (TRAMA),
  // and the record travels out of that disc to the center (FLIP). Reduced
  // motion / no WebGL: the sheet is simply there.
  useLayoutEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const returnTo = document.activeElement as HTMLElement | null
    const from = origen.disc
    void imprimirHoja(root.current, { origin: from ? { x: from.left + from.width / 2, y: from.top + from.height / 2 } : null, energy })
    const ctx = gsap.context(() => {
      const h = hub.current
      if (reduced || !h || !from) return
      const to = h.getBoundingClientRect()
      gsap.fromTo(
        h,
        {
          x: from.left + from.width / 2 - (to.left + to.width / 2),
          y: from.top + from.height / 2 - (to.top + to.height / 2),
          scale: from.width / Math.max(1, to.width),
        },
        { x: 0, y: 0, scale: 1, duration: 0.7, ease: 'expo.out', clearProps: 'transform' },
      )
    }, root)
    const t = window.setTimeout(() => playBtn.current?.focus({ preventScroll: true }), 60)
    return () => {
      window.clearTimeout(t)
      ctx.revert()
      if (returnTo?.isConnected && returnTo !== document.body) returnTo.focus?.({ preventScroll: true })
    }
    // The entrance plays once, at the energy the sheet opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The page underneath must not scroll while the sheet covers it.
  useEffect(() => {
    const el = root.current
    if (!el) return
    const block = (e: Event) => {
      const t = e.target as HTMLElement | null
      const sc = t?.closest<HTMLElement>('[data-scroll]')
      if (sc && sc.scrollHeight > sc.clientHeight + 1) return
      e.preventDefault()
    }
    el.addEventListener('wheel', block, { passive: false })
    el.addEventListener('touchmove', block, { passive: false })
    return () => {
      el.removeEventListener('wheel', block)
      el.removeEventListener('touchmove', block)
    }
  }, [])

  const close = (then?: () => void) => {
    if (closing) return
    setClosing(true)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const done = () => {
      usePlayer.getState().setExpanded(false)
      then?.()
    }
    if (reduced) return done()
    // Back into the press, toward the capsule it came from.
    const from = origen.disc
    void imprimirHoja(root.current, { reverse: true, origin: from ? { x: from.left + from.width / 2, y: from.top + from.height / 2 } : null, energy }).then(done)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const others = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].filter((d) => d !== root.current)
      if (others.length) return
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      // Keep Tab inside the room while focus is in it (the nav stays clickable).
      const el = root.current
      if (e.key !== 'Tab' || !el || !el.contains(document.activeElement)) return
      const f = [...el.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])')].filter(
        (n) => !n.hasAttribute('disabled') && n.offsetParent !== null,
      )
      if (!f.length) return
      const first = f[0]
      const last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const openPiece = (slug: string) => close(() => openLectura(slug))

  const onPlay = () => {
    const s = usePlayer.getState()
    if (s.track) s.toggle()
    else if (cue) s.play(cue, s.ambient)
  }

  const onEspectro = () => {
    const s = usePlayer.getState()
    if (s.capture === 'live') {
      stopCapture()
      s.setCapture('idle')
      s.setCaptureNote(null)
      return
    }
    s.setCapture('requesting')
    s.setCaptureNote(null)
    // Synchronous inside the click: getDisplayMedia is the first async call.
    void requestCapture().then((r) => {
      const n = usePlayer.getState()
      n.setCapture(r.state)
      n.setCaptureNote(r.note ?? null)
    })
  }

  const modo = playing ? modoDe(capture, bpm, reduced) : estado.word === 'CARGANDO' ? 'cargando' : 'en reposo'
  const supported = typeof navigator !== 'undefined' && captureSupported()
  const kicker = piece
    ? shown?.entry !== undefined
      ? `Lista · ${piece.title}`
      : [piece.mixSeries, piece.mixFormat].filter(Boolean).join(' · ') || 'Mix'
    : 'Mix'
  const rows = queue.length ? queue : ambient
  const pos = track ? rows.findIndex((q) => sameSlot(q, track)) : -1

  return (
    <div
      ref={root}
      className={styles.sala}
      role="dialog"
      aria-modal="true"
      aria-label="Consola"
      data-scroll=""
      style={{ ['--e' as string]: energiaVar(energy) }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        className={styles.escena}
        onClick={(e) => {
          if (e.target === e.currentTarget) close()
        }}
      >
        <div className={styles.anilloWrap}>
          <Espectrograma />
          <button ref={hub} type="button" className={styles.hub} onClick={onPlay} aria-label={playing ? 'Pausar' : 'Reproducir'} data-on={playing || undefined}>
            <Disco src={shown?.imageUrl} spinning={playing} label={0.5} sizes="(max-width: 900px) 40vw, 320px" priority />
            <span className={styles.hubMark} aria-hidden="true">
              <Mark name={playing ? 'pause' : 'play'} size={22} />
            </span>
          </button>
          <p className={styles.leyenda} aria-hidden="true">
            {!playing
              ? ' '
              : reduced
                ? 'Movimiento reducido: el espectrograma queda quieto'
                : capture === 'live'
                  ? 'Graves abajo · agudos arriba · cada línea es un instante, del más nuevo al más viejo'
                  : bpm
                    ? `Pulso derivado del BPM${bpmRange ? ` del mix (${Math.round(bpmRange.min)}–${Math.round(bpmRange.max)})` : ''}, no del audio`
                    : 'Sin BPM en el catálogo: sin pulso'}
          </p>
        </div>
      </div>

      <div ref={panel} className={styles.panel}>
        <header className={styles.phead}>
          <span className={styles.indice}>
            01 / Consola <span className={styles.guion}>—</span> {track ? estado.word : 'En cola'}
          </span>
          <button type="button" className={styles.cerrar} onClick={() => close()} aria-label="Contraer la consola (Esc)">
            <Mark name="close" size={13} />
            <kbd>Esc</kbd>
          </button>
        </header>

        {shown ? (
          <div className={styles.ahora}>
            <p className={styles.kicker}>
              <FormatGlyph type={shown.entry !== undefined ? 'listicle' : 'mix'} size={12} />
              <span>{track ? kicker : `En cola · ${kicker}`}</span>
            </p>
            <div className={styles.tituloBox}>
              <button
                type="button"
                className={styles.titulo}
                style={{ fontVariationSettings: energyVariation(energy), fontSize: fitTitle(shown.title, energy, 46, 22, 0.98) }}
                onClick={() => openPiece(shown.slug)}
                title={`Abrir «${shown.title}»`}
              >
                {shown.title}
              </button>
            </div>
            {shown.artist ? (
              <p className={styles.artista}>
                {shown.artist}
              </p>
            ) : null}
            <p className={styles.estado}>
              <span className={styles.status} data-tone={track ? estado.tone : 'quieto'} aria-live="polite">
                {track ? estado.word : 'EN COLA'}
              </span>
              <span className={styles.fuente}>
                {PLATFORM_LABEL[shown.source.platform]}
                {preview && track ? ' · solo 30 s sin Premium' : ''}
                {playing ? ` · ${modo}` : ''}
              </span>
            </p>
          </div>
        ) : (
          <p className={styles.nada}>Nada que sonar todavía: ningún mix del campo tiene una fuente reproducible.</p>
        )}

        <div className={styles.deck}>
          <Aguja variant="sala" />
          <div className={styles.tiempos}>
            <Reloj total={false} />
            <span>{track ? <DuracionTotal /> : piece?.duration ? clock(parseClock(piece.duration) ?? 0) : ''}</span>
          </div>
          <div className={styles.transporte}>
            <button
              type="button"
              className={styles.tbtn}
              onClick={() => {
                const s = usePlayer.getState()
                if (s.time > 5 && !s.loading) s.seek(0)
                else s.prev()
              }}
              disabled={!canBack}
              aria-label="Anterior"
            >
              <Mark name="prev" size={16} />
            </button>
            <button ref={playBtn} type="button" className={styles.play} onClick={onPlay} disabled={!shown} aria-label={playing ? 'Pausar' : 'Reproducir'} data-on={playing || undefined}>
              <Mark name={playing ? 'pause' : 'play'} size={18} />
            </button>
            <button type="button" className={styles.tbtn} onClick={() => usePlayer.getState().next()} disabled={!hasNext} aria-label="Siguiente">
              <Mark name="next" size={16} />
            </button>
            <span className={styles.flex} />
            {shown ? (
              <a className={styles.salida} href={shown.source.url} target="_blank" rel="noopener noreferrer">
                {PLATFORM_LABEL[shown.source.platform]} <Mark name="external" size={11} />
              </a>
            ) : null}
          </div>
        </div>

        <section className={styles.espectro} aria-label="Espectro">
          {capture === 'live' ? (
            <>
              <p className={styles.espLinea}>
                <span className={styles.vivo} aria-hidden="true" /> Escuchando la pestaña: el espectrograma y el campo siguen las frecuencias reales.
              </p>
              <button type="button" className={styles.espBtn} onClick={onEspectro}>
                Dejar de escuchar
              </button>
            </>
          ) : !supported || capture === 'unsupported' ? (
            <p className={styles.espNota}>
              Este navegador no deja escuchar la pestaña (sí Chrome y Edge de escritorio). {bpm ? 'El pulso sigue el BPM del mix.' : ''}
            </p>
          ) : (
            <>
              <button type="button" className={styles.espBtn} onClick={onEspectro} disabled={capture === 'requesting'}>
                <Onda />
                {capture === 'requesting' ? 'Esperando permiso…' : capture === 'denied' ? 'Intentar de nuevo' : 'Escuchar el espectro'}
              </button>
              <p className={styles.espNota}>
                {captureNote ?? 'Comparte el audio de esta pestaña y el espectrograma seguirá las frecuencias reales. Nada se graba ni sale de tu navegador.'}
              </p>
            </>
          )}
        </section>

        <section className={styles.cola} aria-label="Cola">
          <header className={styles.colaHead}>
            <span className={styles.indice}>02 / Cola</span>
            <span className={styles.colaDe}>{fromList && listPiece ? `de «${listPiece.title}»` : 'mixes del campo'}</span>
            <span className={styles.colaN}>
              {pos >= 0 ? `${String(pos + 1).padStart(2, '0')}/` : ''}
              {String(rows.length).padStart(2, '0')}
            </span>
          </header>
          <ol className={styles.lista} data-scroll="">
            {rows.map((t, i) => {
              const it = itemOf(t.itemId)
              const current = Boolean(track && sameSlot(t, track))
              const dur = t.entry === undefined ? clock(parseClock(it?.duration) ?? 0) : null
              return (
                <li key={`${t.itemId}:${t.entry ?? ''}`} className={styles.fila} data-current={current || undefined}>
                  <button
                    type="button"
                    className={styles.filaBtn}
                    aria-current={current || undefined}
                    onClick={() => {
                      const s = usePlayer.getState()
                      if (current) s.toggle()
                      else s.play(t, rows)
                    }}
                    aria-label={`${current ? (playing ? 'Pausar' : 'Reanudar') : 'Reproducir'} «${t.title}»${t.artist ? ` de ${t.artist}` : ''}`}
                  >
                    <span className={styles.filaN}>{current ? <Mark name={playing ? 'pause' : 'play'} size={10} /> : String(i + 1).padStart(2, '0')}</span>
                    <span className={styles.filaArte}>{t.imageUrl ? <Image src={t.imageUrl} alt="" fill sizes="44px" className={styles.cover} /> : null}</span>
                    <span className={styles.filaTexto}>
                      <span className={styles.filaTitulo} style={{ fontVariationSettings: energyVariation(t.energy) }}>
                        {t.title}
                      </span>
                      <span className={styles.filaArtista}>{t.artist}</span>
                    </span>
                    <span className={styles.filaDur}>{current ? estado.word : dur && dur !== '0:00' ? dur : ''}</span>
                  </button>
                  <button type="button" className={styles.filaAbrir} onClick={() => openPiece(t.slug)} aria-label={`Abrir «${t.title}»`} title="Abrir la pieza">
                    <Mark name="arrow" size={12} />
                  </button>
                </li>
              )
            })}
          </ol>
        </section>
      </div>
    </div>
  )
}

function DuracionTotal() {
  const d = usePlayer((s) => s.duration)
  return <>{d > 0 ? clock(d) : '–:––'}</>
}

/** A small wave mark for the spectrum action. */
function Onda() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M2.5 10h2M6.5 6.5v7M10 3.5v13M13.5 6.5v7M17.5 10h-2" />
    </svg>
  )
}
