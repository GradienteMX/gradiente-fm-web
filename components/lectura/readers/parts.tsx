'use client'

/**
 * Parts every reader shares, set in «TRAMA»: the sheet's slug line (format
 * on its stock, the band as a code), the headline printed at the piece's
 * energy, the dek in Newsreader, mono meta lines, hairline ledgers, media in
 * ink-framed wells and indexical section heads (`01 / LINE-UP — …`).
 * Readers compose these; they don't restyle them.
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { ContentItem } from '@/lib/types'
import { useItems, useNow, useWorld } from '@/lib/store/world'
import { useUI } from '@/lib/store/ui'
import { useCampo } from '@/lib/store/campo'
import { getGenreById, getGenreNames, tagLabel } from '@/lib/genres'
import { effectiveBand, energyVariation, energySlotHex, bandLabel, bandSteps } from '@/lib/vibe'
import { fitTitle } from '@/lib/typeset'
import { fmt, ago } from '@/lib/logic/time'
import { FormatGlyph, FORMAT_CODE, FORMAT_LABEL, FORMAT_ON, FORMAT_STOCK, Mark } from '@/components/kit/Glyph'
import { UserChip } from '@/components/kit/Persona'
import { Revelado } from '@/components/trama/Revelado'
import { franjaAttributionPrefix } from '@/lib/franjaAttribution'
import styles from './parts.module.css'

export interface ReaderProps {
  item: ContentItem
}

export function mid(item: ContentItem) {
  const b = effectiveBand(item)
  return (b.min + b.max) / 2
}

export const two = (n: number) => String(Math.round(n)).padStart(2, '0')

/**
 * The sheet's own variables, so a reader prints the same inside the shell
 * and in the Mesa preview: energy slot, stepped band, format stock, and the
 * energy's type axes (drop caps and prose heads read `--e-var`).
 */
export function readerVars(item: ContentItem): CSSProperties {
  const b = effectiveBand(item)
  const m = (b.min + b.max) / 2
  return {
    ['--e' as string]: energySlotHex(m),
    ['--band' as string]: bandSteps(b.min, b.max),
    ['--stock' as string]: FORMAT_STOCK[item.type],
    ['--e-var' as string]: energyVariation(m),
  }
}

/** A band as a printed code: stepped swatch + `07–08 · HOT → FUEGO`. */
export function BandCode({ min, max, className }: { min: number; max: number; className?: string }) {
  const a = Math.round(min)
  const b = Math.round(max)
  return (
    <span className={[styles.bandCode, className ?? ''].join(' ')} title="Banda de energía">
      <span className={styles.bandSwatch} style={{ background: bandSteps(min, max) }} aria-hidden="true" />
      <span className={styles.bandNum}>{a === b ? two(a) : `${two(a)}–${two(b)}`}</span>
      <span>{bandLabel(min, max)}</span>
    </span>
  )
}

/**
 * Indexical head: `01 / LINE-UP — lo que dice`. Index in ink, slash in
 * ink-4, name in red-ink bold, the rest in lowercase prose. `n` is optional
 * (rail blocks go unnumbered, like the identity side of a station).
 */
export function Indice({
  n,
  name,
  sub,
  aside,
  as = 'h2',
  id,
}: {
  n?: string
  name: string
  sub?: ReactNode
  aside?: ReactNode
  as?: 'h2' | 'h3' | 'p'
  id?: string
}) {
  const H = as
  return (
    <header className={styles.indice}>
      <H className={styles.indiceLine} id={id}>
        {n ? (
          <>
            <span className={styles.idx}>{n}</span>
            <span className={styles.slash} aria-hidden="true">
              /
            </span>
          </>
        ) : null}
        <span className={styles.idxName}>{name}</span>
        {sub ? <span className={styles.idxSub}>— {sub}</span> : null}
      </H>
      {aside ? <span className={styles.idxAside}>{aside}</span> : null}
    </header>
  )
}

/** Numbers sections in reading order: `const n = counter(); n() → '01'`. */
export function counter() {
  let k = 0
  return () => two(++k)
}

export function Kicker({ item, children }: { item: ContentItem; children?: ReactNode }) {
  const b = effectiveBand(item)
  return (
    <p className={styles.kicker}>
      <span className={styles.code} style={{ background: FORMAT_STOCK[item.type], color: FORMAT_ON[item.type] }}>
        <FormatGlyph type={item.type} size={11} />
        {FORMAT_CODE[item.type]}
      </span>
      <span className={styles.format}>{FORMAT_LABEL[item.type]}</span>
      {item.editorial ? <span className={styles.sel}>Selección editorial</span> : null}
      {children}
      <BandCode min={b.min} max={b.max} className={styles.kickerBand} />
    </p>
  )
}

/**
 * `fitTitle` with room to spare: its average glyph is a mixed-case one, so
 * the longest word's capitals (or a line set in capitals) take the share
 * down — a word must never break mid-letter on a phone.
 */
export function titleSize(text: string, energy: number, max: number, min: number, caps = false): string {
  const word = text.split(/[\s/—–-]+/).reduce((a, w) => (w.length > a.length ? w : a), '')
  const upper = caps ? 1 : word.length ? [...word].filter((c) => c !== c.toLowerCase()).length / word.length : 0
  return fitTitle(text, energy, max, min, 0.86 / (1 + 0.24 * upper))
}

/**
 * The headline, set at the piece's energy and printed just after the sheet
 * comes off the press. Replays per piece, not per keystroke (the Mesa
 * preview renders this while the title is being typed).
 */
export function Title({ item, max = 96, min = 34, as = 'h1' }: { item: ContentItem; max?: number; min?: number; as?: 'h1' | 'h2' }) {
  const m = mid(item)
  // A long headline sets smaller, so the sheet still shows words under it.
  const len = item.title.length
  const top = Math.max(min, Math.min(max, len > 72 ? 60 : len > 48 ? 70 : len > 28 ? 82 : max))
  return (
    <div className={styles.titleBox}>
      {/* The format's code, huge and outlined in its livery — the second plate behind the headline. */}
      <span className={styles.watermark} aria-hidden="true" style={{ ['--wm' as string]: FORMAT_STOCK[item.type] }}>
        {FORMAT_CODE[item.type]}
      </span>
      <Revelado
        as={as}
        trigger="load"
        energy={m}
        delay={420}
        replay={item.id}
        className={styles.title}
        style={{ fontVariationSettings: energyVariation(m), fontSize: titleSize(item.title, m, top, min) }}
      >
        {item.title}
      </Revelado>
    </div>
  )
}

export function Dek({ children }: { children: ReactNode }) {
  return <p className={styles.dek}>{children}</p>
}

export function Byline({ item, extra }: { item: ContentItem; extra?: ReactNode }) {
  const creator = useWorld((s) => (item.createdById ? s.world.users[item.createdById] ?? null : null))
  const now = useNow()
  return (
    <div className={styles.byline}>
      {item.author ? <span className={styles.author}>Por {item.author}</span> : null}
      {creator ? (
        <span className={styles.creator}>
          <UserChip user={creator} size={22} />
        </span>
      ) : null}
      <span className={styles.when}>
        <time dateTime={item.publishedAt}>{fmt.long(item.publishedAt)}</time> · {ago(item.publishedAt, now)}
      </span>
      {item.readTime ? <span className={styles.when}>{item.readTime} min de lectura</span> : null}
      {extra}
    </div>
  )
}

/** Genres re-tune the home when pressed; tags describe. A two-row ledger. */
export function Taxonomia({ item }: { item: ContentItem }) {
  const router = useRouter()
  const setGenres = useCampo((s) => s.setGenres)
  const close = useUI((s) => s.closeLectura)
  if (!item.genres.length && !item.tags.length) return null
  return (
    <dl className={styles.ledger}>
      {item.genres.length ? (
        <div className={styles.row}>
          <dt className={styles.key}>Géneros</dt>
          <dd className={styles.val}>
            {item.genres.map((g) => (
              <button
                key={g}
                type="button"
                className={styles.genre}
                title="Filtrar el campo por este género"
                onClick={() => {
                  setGenres([g])
                  close()
                  router.push('/')
                }}
              >
                {getGenreById(g)?.name ?? g}
              </button>
            ))}
          </dd>
        </div>
      ) : null}
      {item.tags.length ? (
        <div className={styles.row}>
          <dt className={styles.key}>Etiquetas</dt>
          <dd className={styles.val}>
            {item.tags.map((t) => (
              <span key={t} className={styles.tag}>
                #{tagLabel(t)}
              </span>
            ))}
          </dd>
        </div>
      ) : null}
    </dl>
  )
}

const SUBJECT: Record<NonNullable<ContentItem['subjectKind']>, string> = { record: 'Disco', book: 'Libro', event: 'Evento', exhibition: 'Exposición' }
const ENTITY_KINDS = ['artist', 'label', 'venue', 'promoter'] as const
const ENTITY_LABEL: Record<(typeof ENTITY_KINDS)[number], string> = { artist: 'Artistas', label: 'Sellos', venue: 'Venues', promoter: 'Promotoras' }

/** True when `Contexto` has a row to print (readers decide whether to head it). */
export function hasContexto(item: ContentItem): boolean {
  return Boolean(
    item.subjectKind ||
      item.format ||
      item.country ||
      item.year ||
      item.entities?.some((e) => (ENTITY_KINDS as readonly string[]).includes(e.kind)) ||
      item.franjaRefs?.length ||
      item.links?.length,
  )
}

export function Contexto({ item, children }: { item: ContentItem; children?: ReactNode }) {
  const franjas = useWorld((s) => s.world.items)
  const openLectura = useUI((s) => s.openLectura)
  const rows: Array<[string, ReactNode]> = []
  if (item.subjectKind) rows.push(['Sobre', SUBJECT[item.subjectKind]])
  if (item.format) rows.push(['Formato', item.format.toUpperCase()])
  if (item.country) rows.push(['País', item.country])
  if (item.year) rows.push(['Año', String(item.year)])
  const entities = item.entities ?? []
  const refs = item.franjaRefs ?? []
  const byKind = (k: string) => entities.filter((e) => e.kind === k)
  return (
    <dl className={styles.ledger}>
      {rows.map(([k, v]) => (
        <div key={k} className={styles.row}>
          <dt className={styles.key}>{k}</dt>
          <dd className={styles.val}>{v}</dd>
        </div>
      ))}
      {ENTITY_KINDS.map((k) =>
        byKind(k).length ? (
          <div key={k} className={styles.row}>
            <dt className={styles.key}>{ENTITY_LABEL[k]}</dt>
            <dd className={styles.val}>
              {byKind(k).map((e) => (
                <Link key={e.id} href={`/e/${e.slug}`} className={styles.entity}>
                  {e.name}
                </Link>
              ))}
            </dd>
          </div>
        ) : null,
      )}
      {refs.length ? (
        <div className={styles.row}>
          <dt className={styles.key}>Franjas</dt>
          <dd className={styles.val}>
            {refs.map((r) => {
              const f = franjas[r.id]
              return (
                <button key={r.id} type="button" className={styles.entity} onClick={() => f && openLectura(f.slug)}>
                  {r.title}
                </button>
              )
            })}
          </dd>
        </div>
      ) : null}
      {item.links?.length ? (
        <div className={styles.row}>
          <dt className={styles.key}>Enlaces</dt>
          <dd className={styles.val} data-stack="">
            {item.links.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className={styles.entity}>
                {l.label} <Mark name="external" size={10} />
              </a>
            ))}
          </dd>
        </div>
      ) : null}
      {children}
    </dl>
  )
}

const FAMILY: Record<string, string[]> = {
  evento: ['evento'],
  mix: ['mix'],
  listicle: ['listicle', 'articulo'],
  articulo: ['articulo', 'editorial', 'review'],
  default: ['editorial', 'review', 'opinion', 'articulo', 'noticia'],
}

/** Three more at a nearby energy — neighbors, not recommendations. */
export function Siguientes({ item, label = 'Siguientes lecturas', sub = 'vecinas por energía, no recomendaciones', n }: { item: ContentItem; label?: string; sub?: string; n?: string }) {
  const items = useItems()
  const openLectura = useUI((s) => s.openLectura)
  const fam = FAMILY[item.type] ?? FAMILY.default
  const m = mid(item)
  const related = useMemo(
    () =>
      items
        .filter((i) => i.id !== item.id && fam.includes(i.type) && i.imageUrl)
        .map((i) => ({ i, d: Math.abs(mid(i) - m) + (i.genres.some((g) => item.genres.includes(g)) ? -0.8 : 0) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 3)
        .map((x) => x.i),
    [items, item, fam, m],
  )
  if (!related.length) return null
  return (
    <section className={styles.siguientes} aria-label={label}>
      <Indice n={n} name={label} sub={sub} />
      <div className={styles.sigGrid}>
        {related.map((r) => {
          const b = effectiveBand(r)
          const rm = (b.min + b.max) / 2
          return (
            <button key={r.id} type="button" className={styles.sig} onClick={() => openLectura(r.slug)} style={{ ['--band' as string]: bandSteps(b.min, b.max) }}>
              <span className={styles.sigArt}>
                {r.imageUrl ? <Image src={r.imageUrl} alt="" fill sizes="(max-width: 760px) 96px, 320px" className={styles.cover} /> : null}
                <span className={styles.sigEnergy} aria-hidden="true" />
                <span className={styles.marks} aria-hidden="true" />
              </span>
              <span className={styles.sigText}>
                <span className={styles.sigFormat}>
                  <span className={styles.code} style={{ background: FORMAT_STOCK[r.type], color: FORMAT_ON[r.type] }}>
                    <FormatGlyph type={r.type} size={10} />
                    {FORMAT_CODE[r.type]}
                  </span>
                  {FORMAT_LABEL[r.type]}
                </span>
                <span className={styles.sigTitle} style={{ fontVariationSettings: energyVariation(rm) }}>
                  {r.title}
                </span>
                <BandCode min={b.min} max={b.max} />
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

/**
 * How far you've read: an ink rule that fills along the sheet's foot, right
 * on top of the band, with a small mono counter.
 */
export function Progreso() {
  const ref = useRef<HTMLDivElement>(null)
  const [p, setP] = useState(0)
  useEffect(() => {
    const scroller = ref.current?.closest('[data-lenis-prevent]') as HTMLElement | null
    if (!scroller) return
    const on = () => setP(scroller.scrollTop / Math.max(1, scroller.scrollHeight - scroller.clientHeight))
    on()
    scroller.addEventListener('scroll', on, { passive: true })
    return () => scroller.removeEventListener('scroll', on)
  }, [])
  return (
    <div ref={ref} className={styles.progreso} aria-hidden="true">
      <span className={styles.progresoFill} style={{ transform: `scaleX(${p})` }} />
      <em>{String(Math.round(p * 100)).padStart(2, '0')}%</em>
    </div>
  )
}

export function Presenta({ item }: { item: ContentItem }) {
  const franja = useWorld((s) => (item.franjaId ? s.world.items[item.franjaId] ?? null : null))
  const openLectura = useUI((s) => s.openLectura)
  if (!franja) return null
  return (
    <button type="button" className={styles.presenta} onClick={() => openLectura(franja.slug)}>
      <span className={styles.presentaLogo}>{franja.imageUrl ? <Image src={franja.imageUrl} alt="" fill sizes="44px" className={styles.cover} /> : null}</span>
      <span className={styles.presentaText}>
        <span className={styles.presentaKind}>{franjaAttributionPrefix(franja.franjaKind!)}</span>
        <span className={styles.presentaName}>{franja.title}</span>
      </span>
      <Mark name="arrow" size={13} className={styles.presentaArrow} />
    </button>
  )
}

/**
 * Hero media: the image in an ink-framed well, the band printed along its
 * foot, a mono caption under it. The cover plate is FIG. 00.
 */
export function Art({ item, ratio = '4 / 5', sizes = '(max-width: 900px) 100vw, 40vw', caption, fig = '00' }: { item: ContentItem; ratio?: string; sizes?: string; caption?: string; fig?: string }) {
  return (
    <figure className={styles.artFig}>
      <div className={styles.art} style={{ aspectRatio: ratio }}>
        {item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes={sizes} className={styles.cover} priority /> : <span className={`${styles.blank} hatch`} />}
        <span className={styles.artEnergy} aria-hidden="true" />
      </div>
      {caption ? (
        <figcaption className={styles.caption}>
          <span className={styles.fig}>Fig. {fig}</span>
          {caption}
        </figcaption>
      ) : null}
    </figure>
  )
}

export { getGenreNames, bandLabel, Link }
