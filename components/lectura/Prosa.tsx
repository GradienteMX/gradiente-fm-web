'use client'

/**
 * PROSA — how words are set for reading on the sheet. Newsreader at ~18px
 * on a narrow measure, inline **bold**, *italic*, [links](url) (ink
 * underline) and [^fn] footnote refs. `BodyBlocks` renders the structured
 * body of artículos and listas: lede with a drop cap, §-numbered heads set
 * in Anybody at the piece's energy, pull quotes on a red rule, Q&A, lists
 * with mono markers, figures in framed wells, footnotes in mono with
 * back-links, and track entries with big indices.
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import { Fragment, type CSSProperties, type ReactNode } from 'react'
import type { ArticleBlock, ContentItem, Footnote } from '@/lib/types'
import { usePlayer, playableSource, openSourceUrl, PLATFORM_LABEL, type Track } from '@/lib/store/player'
import { effectiveBand, energyVariation } from '@/lib/vibe'
import { Mark } from '@/components/kit/Glyph'
import styles from './Prosa.module.css'

type Track_ = Extract<ArticleBlock, { kind: 'track' }>

const two = (n: number) => String(n).padStart(2, '0')

export function renderInline(text: string, footnotes?: Footnote[]): ReactNode {
  const out: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[\^[^\]]+\]|\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const t = m[0]
    if (t.startsWith('**')) out.push(<strong key={k++}>{t.slice(2, -2)}</strong>)
    else if (t.startsWith('[^')) {
      const id = t.slice(2, -1)
      const n = (footnotes?.findIndex((f) => f.id === id) ?? -1) + 1
      out.push(
        <sup key={k++} className={styles.fnref} id={`fnref-${id}`}>
          <a href={`#fn-${id}`} aria-label={n ? `Nota ${n}` : 'Nota'}>
            [{n || '*'}]
          </a>
        </sup>,
      )
    } else if (t.startsWith('[')) {
      const mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(t)
      if (mm)
        out.push(
          <a key={k++} href={mm[2]} target="_blank" rel="noopener noreferrer" className={styles.a}>
            {mm[1]}
          </a>,
        )
    } else out.push(<em key={k++}>{t.slice(1, -1)}</em>)
    last = m.index + t.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/** Paragraphs from `bodyPreview` (double newlines), for the text types. */
export function Paragraphs({ text, footnotes, lede = true }: { text: string; footnotes?: Footnote[]; lede?: boolean }) {
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  return (
    <div className={styles.prosa}>
      {paras.map((p, i) => (
        <p key={i} className={i === 0 && lede ? styles.lede : undefined}>
          {renderInline(p, footnotes)}
        </p>
      ))}
      {footnotes?.length ? <Notas footnotes={footnotes} /> : null}
    </div>
  )
}

export function trackToPlayer(item: ContentItem, b: Track_, entry: number): Track | null {
  const src = playableSource({ embeds: b.embeds })
  if (!src) return null
  const band = effectiveBand(item)
  return {
    itemId: item.id,
    slug: item.slug,
    title: b.title,
    artist: b.artist,
    imageUrl: b.imageUrl ?? item.imageUrl,
    energy: (band.min + band.max) / 2,
    source: src,
    entry,
  }
}

export function BodyBlocks({ item, blocks, footnotes }: { item: ContentItem; blocks: ArticleBlock[]; footnotes?: Footnote[] }) {
  let section = 0
  let fig = 0
  const band = effectiveBand(item)
  const vars = { ['--e-var' as string]: energyVariation((band.min + band.max) / 2) } as CSSProperties
  const tracks = blocks
    .map((b, i) => (b.kind === 'track' ? trackToPlayer(item, b, i) : null))
    .filter((t): t is Track => t !== null)
  return (
    <div className={styles.prosa} style={vars}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'lede':
            return (
              <p key={i} className={styles.lede}>
                {renderInline(b.text, footnotes)}
              </p>
            )
          case 'p':
            return <p key={i}>{renderInline(b.text, footnotes)}</p>
          case 'h2':
            section++
            return (
              <h2 key={i} id={b.id ?? `s-${section}`} className={styles.h2} data-section={section}>
                <span className={styles.sec}>§{two(section)}</span>
                <span className={styles.h2Text}>{b.text}</span>
              </h2>
            )
          case 'h3':
            return (
              <h3 key={i} className={styles.h3}>
                {b.text}
              </h3>
            )
          case 'quote':
            return (
              <figure key={i} className={styles.pull}>
                <blockquote>{renderInline(b.text, footnotes)}</blockquote>
                {b.cite ? <figcaption>— {b.cite}</figcaption> : null}
              </figure>
            )
          case 'blockquote':
            return (
              <figure key={i} className={styles.block}>
                <blockquote>{renderInline(b.text, footnotes)}</blockquote>
                {b.cite ? <figcaption>— {b.cite}</figcaption> : null}
              </figure>
            )
          case 'image':
            fig++
            return (
              <figure key={i} className={styles.figure}>
                <div className={styles.figImg}>
                  <Image src={b.src} alt={b.alt ?? ''} fill sizes="(max-width: 900px) 100vw, 680px" className={styles.cover} />
                </div>
                <figcaption>
                  <span className={styles.figNum}>Fig. {two(fig)}</span>
                  {b.caption}
                </figcaption>
              </figure>
            )
          case 'divider':
            return <hr key={i} className={styles.divider} />
          case 'qa':
            return (
              <div key={i} className={styles.qa} data-q={b.isQuestion || undefined}>
                <span className={styles.speaker}>{b.speaker}</span>
                <p>{renderInline(b.text, footnotes)}</p>
              </div>
            )
          case 'list': {
            const L = b.ordered ? 'ol' : 'ul'
            return (
              <L key={i} className={styles.list} data-ordered={b.ordered || undefined}>
                {b.items.map((it, j) => (
                  <li key={j}>{renderInline(it, footnotes)}</li>
                ))}
              </L>
            )
          }
          case 'track':
            return <TrackBlock key={i} item={item} block={b} entry={i} queue={tracks} />
        }
      })}
      {footnotes?.length ? <Notas footnotes={footnotes} /> : null}
    </div>
  )
}

/** Footnotes in mono, each with its way back to where it was called. */
function Notas({ footnotes }: { footnotes: Footnote[] }) {
  return (
    <section className={styles.notes} aria-label="Notas">
      <p className={styles.notesHead}>
        <span className={styles.notesName}>Notas</span>
        <span>{two(footnotes.length)}</span>
      </p>
      <ol>
        {footnotes.map((f, n) => (
          <li key={f.id} id={`fn-${f.id}`}>
            <span className={styles.fnNum}>{two(n + 1)}</span>
            <span className={styles.fnText}>{renderInline(f.text)}</span>
            <a href={`#fnref-${f.id}`} className={styles.back} aria-label={`Volver a la llamada ${n + 1}`} title="Volver al texto">
              <Mark name="arrow" size={11} className={styles.backArrow} />
            </a>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** A track entry: a big index, the cover, the title at the piece's energy, mono meta. */
function TrackBlock({ item, block, entry, queue }: { item: ContentItem; block: Track_; entry: number; queue: Track[] }) {
  const current = usePlayer((s) => s.track)
  const playing = usePlayer((s) => s.playing)
  const play = usePlayer((s) => s.play)
  const toggle = usePlayer((s) => s.toggle)
  const track = trackToPlayer(item, block, entry)
  const isThis = current?.itemId === item.id && current.entry === entry
  const external = openSourceUrl({ embeds: block.embeds })
  const band = effectiveBand(item)
  const meta = [block.artist, block.year ? String(block.year) : null, block.bpm ? `${block.bpm} BPM` : null].filter(Boolean).join(' · ')

  return (
    <article className={styles.track} id={`entrada-${entry}`} data-active={isThis || undefined} data-ranked={block.rank !== undefined || undefined}>
      {block.rank !== undefined ? (
        <span className={styles.rank} aria-label={`Número ${block.rank}`}>
          {two(block.rank)}
        </span>
      ) : null}
      <div className={styles.trackArt}>{block.imageUrl ? <Image src={block.imageUrl} alt="" fill sizes="120px" className={styles.cover} /> : <span className={`${styles.trackBlank} hatch`} />}</div>
      <div className={styles.trackText}>
        <p className={styles.trackTitle} style={{ fontVariationSettings: energyVariation((band.min + band.max) / 2) }}>
          {block.title}
        </p>
        <p className={styles.trackMeta}>{meta}</p>
        {block.commentary ? <p className={styles.commentary}>{renderInline(block.commentary)}</p> : null}
        <div className={styles.trackActions}>
          {track ? (
            <button type="button" className={styles.play} data-on={(isThis && playing) || undefined} onClick={() => (isThis ? toggle() : play(track, queue))}>
              <Mark name={isThis && playing ? 'pause' : 'play'} size={12} />
              {isThis ? (playing ? 'Sonando' : 'Reanudar') : 'Escuchar'}
            </button>
          ) : null}
          {block.embeds?.map((e) => (
            <a key={e.url} href={e.url} target="_blank" rel="noopener noreferrer" className={styles.src}>
              {PLATFORM_LABEL[e.platform]} <Mark name="external" size={10} />
            </a>
          ))}
          {!track && !block.embeds?.length && external ? (
            <a href={external} target="_blank" rel="noopener noreferrer" className={styles.src}>
              Abrir fuente <Mark name="external" size={10} />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export { Fragment }
