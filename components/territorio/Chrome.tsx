'use client'

/**
 * Territorio chrome — the map's furniture, in the TRAMA grammar: the bar and
 * the dock are wells (the map's chrome is one of the few dark surfaces),
 * everything else is a paper sheet with a 1 px rule. Every control works
 * today: the wordmark goes home, the status says which view you are in, the
 * franjas picker focuses a franja (or links to the dossier when it has no
 * land yet), the capas switch formats and eras off, the horizon ghosts by
 * energy, the dock zooms and frames, help explains the encodings.
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import type { ContentItem, ContentType } from '@/lib/types'
import { FormatGlyph, FORMAT_PLURAL, Mark } from '@/components/kit/Glyph'
import { Wordmark } from '@/components/shell/Wordmark'
import { KIND_LABEL } from '@/components/dial/Dial'
import { HorizonteFino } from './HorizonteFino'
import { CODE, PLATE } from './codes'
import styles from './Chrome.module.css'

// ── top bar ──────────────────────────────────────────────────────────────────

export function Barra({
  status,
  detail,
  minimal,
  franjasOpen = false,
  onFranjas,
  capasOpen = false,
  onCapas,
  helpOpen = false,
  onHelp,
  focusActive = false,
  picker,
  help,
}: {
  status: string
  detail: string
  /** The WebGL fallback: brand and status only. */
  minimal?: boolean
  franjasOpen?: boolean
  onFranjas?: () => void
  capasOpen?: boolean
  onCapas?: () => void
  helpOpen?: boolean
  onHelp?: () => void
  focusActive?: boolean
  picker?: ReactNode
  help?: ReactNode
}) {
  const brand = (
    <div className={styles.brandBlock}>
      <Link href="/" className={styles.brand} aria-label="Gradiente — volver al campo">
        <Wordmark size="md" />
      </Link>
      <span className={styles.rule} aria-hidden="true" />
      <div className={styles.title}>
        <span className="label">Mapa / Territorio</span>
        <span className={styles.status} role="status" aria-live="polite">
          {status}
          {detail ? <span className={styles.detail}> — {detail}</span> : null}
        </span>
      </div>
    </div>
  )
  if (minimal) {
    return (
      <header className={styles.bar} data-ui="">
        {brand}
      </header>
    )
  }
  return (
    <header className={styles.bar} data-ui="">
      {brand}

      <div className={styles.horizon}>
        <HorizonteFino />
      </div>

      <div className={styles.actions}>
        <div className={styles.anchor}>
          <button
            type="button"
            className={styles.box}
            aria-pressed={franjasOpen || focusActive}
            aria-expanded={franjasOpen}
            aria-controls="territorio-franjas"
            onClick={onFranjas}
          >
            <FormatGlyph type="franja" size={14} />
            <span>Franjas</span>
          </button>
          {picker}
        </div>
        <button
          type="button"
          className={`${styles.box} ${styles.capasBtn}`}
          aria-pressed={capasOpen}
          aria-expanded={capasOpen}
          aria-controls="territorio-capas"
          onClick={onCapas}
        >
          <Mark name="menu" size={14} />
          <span>Capas</span>
        </button>
        <div className={styles.anchor}>
          <button
            type="button"
            className={`${styles.box} ${styles.square}`}
            aria-pressed={helpOpen}
            aria-expanded={helpOpen}
            aria-controls="territorio-ayuda"
            aria-label="Cómo leer el territorio"
            onClick={onHelp}
          >
            ?
          </button>
          {help}
        </div>
      </div>
    </header>
  )
}

// ── franjas picker ───────────────────────────────────────────────────────────

export interface FranjaOption {
  franja: ContentItem
  pieces: number
}

export function FranjaPicker({
  landed,
  dormant,
  current,
  onPick,
  onClose,
}: {
  landed: FranjaOption[]
  dormant: ContentItem[]
  current: string | null
  onPick: (slug: string) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    input.current?.focus()
  }, [])
  const match = (t: string) => t.toLocaleLowerCase('es').includes(q.toLocaleLowerCase('es').trim())
  const found = landed.filter((o) => match(o.franja.title))
  const quiet = dormant.filter((f) => match(f.title))
  return (
    <section
      id="territorio-franjas"
      className={styles.pop}
      aria-label="Elegir franja"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onClose()
        }
      }}
    >
      <label className={styles.search}>
        <Mark name="search" size={14} />
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar franja…" aria-label="Buscar franja" />
      </label>
      <div className={styles.scroll}>
        <p className={`label ${styles.group}`}>01 / Con terreno — reúne lo que firma</p>
        {found.map(({ franja, pieces }) => (
          <button
            key={franja.id}
            type="button"
            className={styles.franja}
            aria-pressed={current === franja.slug}
            onClick={() => onPick(franja.slug)}
          >
            <span className={styles.logo}>
              {franja.imageUrl ? <Image src={franja.imageUrl} alt="" fill sizes="32px" className={styles.logoImg} /> : null}
            </span>
            <span className={styles.franjaText}>
              <span className={styles.franjaName}>{franja.title}</span>
              <span className={styles.franjaKind}>{franja.franjaKind ? KIND_LABEL[franja.franjaKind] : 'Franja'}</span>
            </span>
            <span className={styles.count} aria-label={`${pieces} piezas en el territorio`}>
              {String(pieces).padStart(2, '0')}
            </span>
          </button>
        ))}
        {found.length === 0 ? <p className={styles.empty}>Ninguna franja con terreno coincide.</p> : null}
        {quiet.length ? (
          <details className={styles.dormant}>
            <summary className="label">
              02 / Sin terreno todavía <span className={styles.count}>{quiet.length}</span>
            </summary>
            <p className={styles.note}>Aún no firman piezas con arte; su dossier sí existe.</p>
            {quiet.map((f) => (
              <Link key={f.id} href={`/f/${f.slug}`} className={styles.dormantLink}>
                <span>{f.title}</span>
                <Mark name="arrow" size={12} />
              </Link>
            ))}
          </details>
        ) : null}
      </div>
    </section>
  )
}

// ── help ─────────────────────────────────────────────────────────────────────

export function Ayuda({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  return (
    <section
      ref={ref}
      id="territorio-ayuda"
      tabIndex={-1}
      className={`${styles.pop} ${styles.help}`}
      aria-label="Cómo leer el territorio"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onClose()
        }
      }}
    >
      <header className={styles.helpHead}>
        <h2 className={styles.helpTitle}>El archivo como tierra</h2>
        <button type="button" className={styles.close} aria-label="Cerrar ayuda" onClick={onClose}>
          <Mark name="close" size={14} />
        </button>
      </header>
      <ul className={styles.legend}>
        <li>
          <span className={styles.legendMark} data-k="area" aria-hidden="true" />
          <span>
            <b>Área</b> es vida: una pieza viva ocupa más celdas (1, 3 o 7).
          </span>
        </li>
        <li>
          <span className={styles.legendMark} data-k="rim" aria-hidden="true" />
          <span>
            <b>El borde</b> es su energía; la tinta densa, lo viva que está.
          </span>
        </li>
        <li>
          <span className={styles.legendMark} data-k="near" aria-hidden="true" />
          <span>
            <b>La vecindad</b> es afinidad: sello, artistas, lugar, géneros, fecha.
          </span>
        </li>
        <li>
          <span className={`${styles.legendMark} hatch`} data-k="archive" aria-hidden="true" />
          <span>
            <b>Trama</b> es archivo: lo que ya se asentó se imprime en medio tono.
          </span>
        </li>
      </ul>
      <p className={styles.helpNote}>Es el mismo mapa para todos. Lo vivo queda al centro; la orilla es memoria.</p>
      <dl className={styles.keys}>
        <div>
          <dt>Mover</dt>
          <dd>Arrastra, o desplaza con la rueda / dos dedos.</dd>
        </div>
        <div>
          <dt>Acercar</dt>
          <dd>Ctrl / ⌘ + rueda, pellizca, doble clic en el papel, o − / +.</dd>
        </div>
        <div>
          <dt>Teclado</dt>
          <dd>Flechas recorren vecinas (Alt: las otras diagonales); Enter abre; Esc sale.</dd>
        </div>
        <div>
          <dt>Franjas</dt>
          <dd>Enfocar una franja reúne lo que firma alrededor de su logo; lo demás se aparta.</dd>
        </div>
        <div>
          <dt>Capas</dt>
          <dd>Apaga un formato y el terreno se reacomoda. Afinidad separa continentes.</dd>
        </div>
      </dl>
    </section>
  )
}

// ── zoom dock ────────────────────────────────────────────────────────────────

export function Dock({
  readout,
  onZoom,
  onFit,
  fitLabel,
}: {
  readout: RefObject<HTMLOutputElement | null>
  onZoom: (f: number) => void
  onFit: () => void
  fitLabel: string
}) {
  return (
    <div className={styles.dock} data-ui="">
      <div className={styles.zoom} role="group" aria-label="Zoom">
        <button type="button" className={styles.zoomBtn} aria-label="Alejar" onClick={() => onZoom(1 / 1.4)}>
          <Mark name="minus" size={14} />
        </button>
        <output ref={readout} className={styles.readout} aria-label="Nivel de zoom">
          —
        </output>
        <button type="button" className={styles.zoomBtn} aria-label="Acercar" onClick={() => onZoom(1.4)}>
          <Mark name="plus" size={14} />
        </button>
      </div>
      <button type="button" className={styles.fit} onClick={onFit} title={fitLabel}>
        <FitMark />
        <span>Encuadrar</span>
      </button>
    </div>
  )
}

function FitMark() {
  return (
    <svg width={14} height={14} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="square" aria-hidden="true">
      <path d="M3.5 7V3.5H7M13 3.5h3.5V7M16.5 13v3.5H13M7 16.5H3.5V13" />
      <path d="M10 7.5v5M7.5 10h5" />
    </svg>
  )
}

// ── capas ────────────────────────────────────────────────────────────────────

function MercadoGlyph({ size = 14 }: { size?: number }) {
  // A stall: one hex, one price point.
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="miter" aria-hidden="true">
      <path d="M6 3.8h8l4 6.2-4 6.2H6L2 10z" />
      <circle cx="10" cy="10" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function Capas({
  counts,
  mercado,
  era,
  hidden,
  onToggle,
  onShowAll,
  afinidad,
  continents,
  focusActive,
  onAfinidad,
  open,
  onClose,
}: {
  counts: { type: ContentType; n: number }[]
  mercado: number
  era: { ahora: number; archivo: number }
  hidden: ReadonlySet<string>
  onToggle: (key: string) => void
  onShowAll: () => void
  afinidad: boolean
  continents: number | null
  focusActive: boolean
  onAfinidad: () => void
  open: boolean
  onClose: () => void
}) {
  const row = (key: string, glyph: ReactNode, code: string, label: string, n: number, plate: string | null) => {
    const on = !hidden.has(key)
    return (
      <button
        key={key}
        type="button"
        className={styles.layer}
        aria-pressed={on}
        onClick={() => onToggle(key)}
        title={on ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
      >
        <span className={styles.swatch} style={plate ? { background: on ? plate : undefined } : undefined} data-hatch={on ? undefined : ''} aria-hidden="true" />
        <span className={styles.layerGlyph}>{glyph}</span>
        <span className={styles.code}>{code}</span>
        <span className={styles.layerName}>{label}</span>
        <span className={styles.count}>{n}</span>
      </button>
    )
  }
  return (
    <aside id="territorio-capas" className={styles.capas} data-open={open || undefined} data-ui="" aria-label="Capas del territorio">
      <header className={styles.capasHead}>
        <span className="label">Capas</span>
        {hidden.size ? (
          <button type="button" className={styles.mini} onClick={onShowAll}>
            Todo
          </button>
        ) : null}
        <button type="button" className={`${styles.close} ${styles.capasClose}`} aria-label="Cerrar capas" onClick={onClose}>
          <Mark name="close" size={14} />
        </button>
      </header>
      <div className={styles.layers} role="group" aria-label="Formatos">
        {counts.map(({ type, n }) => row(type, <FormatGlyph type={type} size={13} />, CODE[type], FORMAT_PLURAL[type], n, PLATE[type]))}
        {mercado > 0 ? row('mercado', <MercadoGlyph size={13} />, CODE.mercado, 'Mercado', mercado, PLATE.mercado) : null}
      </div>
      <div className={styles.layers} role="group" aria-label="Era">
        <span className={`label ${styles.groupLabel}`}>Era</span>
        {row('era:ahora', <EraMark era="ahora" />, 'AH', 'Ahora', era.ahora, 'var(--ink)')}
        {era.archivo > 0 ? row('era:archivo', <EraMark era="archivo" />, 'AR', 'Archivo', era.archivo, 'var(--ink-3)') : null}
      </div>
      <button type="button" className={styles.afinidad} aria-pressed={afinidad} onClick={onAfinidad}>
        <span className={styles.check} aria-hidden="true" />
        <span className={styles.afinidadText}>
          <span className={styles.afinidadName}>Afinidad</span>
          <span className={styles.afinidadNote}>
            {afinidad && focusActive
              ? 'Al salir del enfoque'
              : afinidad && continents
                ? `${continents} continentes`
                : 'Separa continentes por datos compartidos'}
          </span>
        </span>
      </button>
    </aside>
  )
}

function EraMark({ era }: { era: 'ahora' | 'archivo' }) {
  return (
    <svg width={13} height={13} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      {era === 'ahora' ? (
        <>
          <circle cx="10" cy="10" r="6.5" />
          <circle cx="10" cy="10" r="2.4" fill="currentColor" stroke="none" />
        </>
      ) : (
        <>
          <circle cx="10" cy="10" r="6.5" strokeDasharray="2 2.6" />
          <path d="M6.5 13.5h7" />
        </>
      )}
    </svg>
  )
}

// ── status helpers ───────────────────────────────────────────────────────────

export function useStatus(args: { focusTitle: string | null; afinidad: boolean; continents: number | null; pieces: number; hiddenCount: number }) {
  return useMemo(() => {
    if (args.focusTitle) return { status: `Enfoque · ${args.focusTitle}`, detail: '' }
    if (args.afinidad && args.continents) return { status: 'Afinidad', detail: `${args.continents} continentes` }
    const shown = args.pieces - args.hiddenCount
    return { status: 'Vista global', detail: args.hiddenCount ? `${shown} de ${args.pieces} piezas` : `${args.pieces} piezas` }
  }, [args.focusTitle, args.afinidad, args.continents, args.pieces, args.hiddenCount])
}
