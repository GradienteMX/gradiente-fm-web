'use client'

/**
 * PIEZA — the card. A poster with a printed label.
 *
 *  · the artwork is always present and dominant (cards are posters)
 *  · the label is a paper strip: format code on its stock, the title set at
 *    the piece's own energy (Anybody wdth/wght), and — on hover — the ficha:
 *    a spec sheet that feeds up through the platen
 *  · the bottom edge is the band printed as swatches: hue = energy, never
 *    a number; HL shows only as size and position
 *  · hover re-prints the title out of blocks in its energy's ink; click
 *    unfolds the reading surface from this rect
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import type { ContentItem } from '@/lib/types'
import type { CardLayout } from '@/lib/curation'
import { bandLabel, bandSteps, effectiveBand, energyOn, energySlotHex, energyVariation } from '@/lib/vibe'
import { FORMAT_CODE, FORMAT_LABEL, FORMAT_ON, FORMAT_STOCK, FormatGlyph, Mark } from '@/components/kit/Glyph'
import { LIBREA_FORMATO } from '@/lib/librea'
import { patronCss } from '@/components/librea/patron'
import { useUI } from '@/lib/store/ui'
import { useMe } from '@/lib/store/session'
import { useDispatch, useNow, useWorld } from '@/lib/store/world'
import { eventProximity, fmt, PROXIMITY_LABEL, ago } from '@/lib/logic/time'
import { getGenreNames } from '@/lib/genres'
import { hlBracket } from '@/lib/dashboard/hl'
import { currentHp } from '@/lib/curation'
import { flare } from '@/components/stage/api'
import { revelar } from '@/components/trama/api'
import { useRevelarImagen } from '@/components/trama/hooks'
import { PollCanvas } from '@/components/encuesta/PollCanvas'
import { franjaAttributionPrefix } from '@/lib/franjaAttribution'
import { fitTitle } from '@/lib/typeset'
import { usePlayer, playableSource } from '@/lib/store/player'
import styles from './Pieza.module.css'

export interface PiezaProps {
  item: ContentItem
  layout: CardLayout
  /** Normalized life 0..~1.2 (score within its type). Kept for callers; not drawn. */
  life?: number
  priority?: boolean
  /** Print the artwork out of blocks once it loads, after this delay (ms). */
  imprimir?: number
}

const TITLE_MAX: Record<CardLayout['tier'], number> = { xl: 58, lg: 42, md: 28, sm: 20 }
const TITLE_MIN: Record<CardLayout['tier'], number> = { xl: 24, lg: 20, md: 15, sm: 13 }

const SIZES: Record<CardLayout['tier'], string> = {
  xl: '(max-width: 900px) 100vw, 60vw',
  lg: '(max-width: 900px) 100vw, 40vw',
  md: '(max-width: 900px) 50vw, 30vw',
  sm: '(max-width: 900px) 50vw, 20vw',
}

function PiezaImpl({ item, layout, priority, imprimir }: PiezaProps) {
  const openLectura = useUI((s) => s.openLectura)
  const openAccess = useUI((s) => s.openAccess)
  const me = useMe()
  const now = useNow()
  const dispatch = useDispatch()
  const saved = useWorld((s) => (me ? Boolean(s.world.saves[me.id]?.[item.id]) : false))
  const franja = useWorld((s) => (item.franjaId ? s.world.items[item.franjaId] ?? null : null))
  const artRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const hoverTimer = useRef(0)
  const lastPrint = useRef(0)
  const [pollOpen, setPollOpen] = useState(false)

  const band = effectiveBand(item)
  const mid = (band.min + band.max) / 2
  // Type follows the real cell, not the tier's name: a plain event can be
  // "md" in rank but live in a 1×1 cell.
  const area = layout.colSpan * layout.rowSpan
  const tier: CardLayout['tier'] = area >= 6 ? 'xl' : area >= 4 ? 'lg' : area >= 2 ? 'md' : 'sm'
  const isEvent = item.type === 'evento'
  const prox = isEvent ? eventProximity(item, now) : null
  const past = prox === 'pasado'
  const mine = Boolean(me && item.createdById === me.id)
  const fresh = item.source !== 'scraper:ra' && now.getTime() - new Date(item.publishedAt).getTime() < 3_600_000
  const printing = imprimir !== undefined

  useRevelarImagen(imgRef, { trigger: printing ? 'load' : 'manual', delay: imprimir })

  useEffect(() => () => window.clearTimeout(hoverTimer.current), [])

  const open = useCallback(() => {
    if (pollOpen) return
    const r = artRef.current?.getBoundingClientRect()
    if (me) dispatch({ t: 'touch', userId: me.id, itemId: item.id, kind: 'click', at: new Date().toISOString() })
    openLectura(item.slug, r ? { x: r.left, y: r.top, width: r.width, height: r.height } : null)
  }, [dispatch, item.id, item.slug, me, openLectura, pollOpen])

  const toggleSave = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!me) return openAccess('Guarda piezas en tu colección')
    dispatch({ t: 'save', userId: me.id, itemId: item.id, on: !saved, at: new Date().toISOString() })
    if (!saved) flare(e.currentTarget, mid)
  }

  const openComments = (e: React.MouseEvent) => {
    e.stopPropagation()
    const r = artRef.current?.getBoundingClientRect()
    openLectura(item.slug, r ? { x: r.left, y: r.top, width: r.width, height: r.height } : null, { comments: true })
  }

  // Hover intent, then the title re-prints in its energy's ink. Skimming the
  // cursor across the mosaic never strobes the cards it crosses.
  const enter = () => {
    window.clearTimeout(hoverTimer.current)
    if (pollOpen) return
    hoverTimer.current = window.setTimeout(() => {
      const t = performance.now()
      if (t - lastPrint.current < 2600) return
      lastPrint.current = t
      void revelar(titleRef.current, { energy: mid, duration: 560, levels: 2, dir: 'right' })
    }, 120)
  }
  const leave = () => window.clearTimeout(hoverTimer.current)

  const librea = LIBREA_FORMATO[item.type]
  const pat = patronCss(librea.patron, librea.on)
  const genres = getGenreNames(item.genres).slice(0, tier === 'sm' ? 2 : 3)
  const meta = metaLine(item, now)
  const kicker = kickerLine(item)

  return (
    <article
      className={`${styles.pieza}${fresh ? ' print-fresh' : ''}`}
      data-tier={tier}
      data-past={past || undefined}
      data-type={item.type}
      style={
        {
          '--e': energySlotHex(mid),
          '--e-on': energyOn(mid),
          '--band': bandSteps(band.min, band.max),
          '--stock': FORMAT_STOCK[item.type],
          '--stock-on': FORMAT_ON[item.type],
          '--pat': pat.backgroundImage,
          '--pat-size': pat.backgroundSize,
        } as React.CSSProperties
      }
      onPointerEnter={enter}
      onPointerLeave={leave}
      onFocus={enter}
    >
      <button type="button" className={styles.hit} onClick={open} aria-label={`${FORMAT_LABEL[item.type]}: ${item.title}`} />

      <div ref={artRef} className={styles.art}>
        {item.imageUrl ? (
          <Image
            ref={imgRef}
            src={item.imageUrl}
            alt=""
            fill
            sizes={SIZES[tier]}
            priority={priority}
            className={styles.img}
            data-trama-img={printing ? 'pendiente' : undefined}
            draggable={false}
          />
        ) : (
          <div className={`${styles.plate} hatch`}>
            <span className={styles.plateBand} />
          </div>
        )}
        {pollOpen && item.poll ? <PollCanvas item={item} onClose={() => setPollOpen(false)} /> : null}
      </div>

      <span className={styles.marks} aria-hidden="true" />

      <header className={styles.top}>
        {isEvent && item.date ? (
          <span className={styles.date} data-prox={prox ?? undefined}>
            <span className={styles.dayNum}>{fmt.dayNum(item.date)}</span>
            <span className={styles.month}>{fmt.month(item.date)}</span>
          </span>
        ) : (
          <span />
        )}
        <span className={styles.topRight}>
          {fresh ? <span className={styles.fresh}>Nueva</span> : null}
          {mine ? (
            <span className={styles.mineChip} title="Solo tú ves la vida de tus piezas">
              Tuya · HL {hlBracket(currentHp(item, now))}
            </span>
          ) : null}
          {item.poll && !past ? (
            <button
              type="button"
              className={styles.pollChip}
              onClick={(e) => {
                e.stopPropagation()
                setPollOpen((o) => !o)
              }}
              aria-expanded={pollOpen}
            >
              {pollOpen ? 'Cerrar' : item.poll.kind === 'attendance' ? '¿Vas?' : 'Votar'}
            </button>
          ) : null}
          {saved ? (
            <span className={styles.savedMark} title="En tu colección">
              <Mark name="saved" size={12} />
            </span>
          ) : null}
        </span>
      </header>

      <div className={styles.label}>
        <p className={styles.kicker}>
          <span className={styles.code}>
            <FormatGlyph type={item.type} size={10} />
            {FORMAT_CODE[item.type]}
          </span>
          {item.editorial ? (
            <span className={styles.editorial} title="Selección editorial">
              ED·SEL
            </span>
          ) : null}
          {isEvent && prox ? (
            <span className={styles.prox} data-prox={prox}>
              {PROXIMITY_LABEL[prox]}
            </span>
          ) : kicker ? (
            <span className={styles.kickerText}>{kicker}</span>
          ) : null}
        </p>
        <h3
          ref={titleRef}
          className={styles.title}
          style={{ fontVariationSettings: energyVariation(mid), fontSize: fitTitle(item.title, mid, TITLE_MAX[tier], TITLE_MIN[tier], 0.86) }}
        >
          {item.title}
        </h3>

        <div className={styles.ficha}>
          {franja ? (
            <p className={styles.franja}>
              {franjaAttributionPrefix(franja.franjaKind!)} · {franja.title}
            </p>
          ) : null}
          {meta ? <p className={styles.meta}>{meta}</p> : null}
          {item.excerpt && (tier === 'xl' || tier === 'lg') ? <p className={styles.excerpt}>{item.excerpt}</p> : null}
          <div className={styles.row}>
            <span className={styles.band}>
              <span className={styles.bandSwatch} />
              {bandLabel(band.min, band.max)}
            </span>
            {genres.map((g) => (
              <span key={g} className={styles.genre}>
                {g}
              </span>
            ))}
          </div>
          <div className={styles.actions}>
            {item.type === 'mix' ? <QuickPlay item={item} energy={mid} /> : null}
            <button type="button" className={styles.action} onClick={toggleSave} aria-pressed={saved}>
              <Mark name={saved ? 'saved' : 'save'} size={13} />
              {saved ? 'Guardado' : 'Guardar'}
            </button>
            {item.type !== 'franja' ? (
              <button type="button" className={styles.action} onClick={openComments}>
                <Mark name="comments" size={13} />
                Hilo
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className={styles.energy} aria-hidden="true" />
    </article>
  )
}

/** Mixes can go straight to the Consola — the click is the gesture. */
function QuickPlay({ item, energy }: { item: ContentItem; energy: number }) {
  const current = usePlayer((s) => s.track)
  const playing = usePlayer((s) => s.playing)
  const src = playableSource(item)
  if (!src) return null
  const isThis = current?.itemId === item.id
  return (
    <button
      type="button"
      className={styles.action}
      data-on={isThis || undefined}
      onClick={(e) => {
        e.stopPropagation()
        const p = usePlayer.getState()
        if (isThis) p.toggle()
        else p.play({ itemId: item.id, slug: item.slug, title: item.title, artist: item.author, imageUrl: item.imageUrl, energy, source: src })
      }}
    >
      <Mark name={isThis && playing ? 'pause' : 'play'} size={12} />
      {isThis ? (playing ? 'Sonando' : 'Reanudar') : 'Escuchar'}
    </button>
  )
}

/** The small line beside the format code: who or what, never a score. */
function kickerLine(item: ContentItem): string | null {
  switch (item.type) {
    case 'mix':
      return item.mixSeries ?? item.author ?? null
    case 'review':
    case 'opinion':
    case 'editorial':
    case 'articulo':
    case 'listicle':
      return item.author ?? null
    case 'noticia':
      return item.author ?? null
    default:
      return null
  }
}

function metaLine(item: ContentItem, now: Date): string {
  switch (item.type) {
    case 'evento': {
      const parts = [item.date ? `${fmt.weekday(item.date)} ${fmt.time(item.date)}` : null, item.venue].filter(Boolean)
      return parts.join(' · ')
    }
    case 'mix':
      return [item.mixSeries, item.duration ? durationLabel(item.duration) : null, item.author].filter(Boolean).join(' · ')
    default:
      return [item.author ? `Por ${item.author}` : null, item.readTime ? `${item.readTime} min` : null, ago(item.publishedAt, now)]
        .filter(Boolean)
        .join(' · ')
  }
}

export function durationLabel(d: string): string {
  const parts = d.split(':').map(Number)
  if (parts.length === 3) return `${parts[0]} h ${String(parts[1]).padStart(2, '0')} min`
  if (parts.length === 2) return `${parts[0]} min`
  return d
}

export const Pieza = memo(PiezaImpl)
