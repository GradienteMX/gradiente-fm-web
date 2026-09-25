'use client'

/**
 * LA LISTA — entries with artist, title, year, BPM, cover, sources and your
 * reason; an introduction and interludes between them. The order is read
 * from the ranks (countdown or ascending) and new entries continue it.
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import { useEffect, useRef, useState } from 'react'
import type { ArticleBlock, MixEmbed } from '@/lib/types'
import { Mark } from '@/components/kit/Glyph'
import { listOrder, nextRank, renumber, safeImage } from '../model'
import { Texto } from './Texto'
import { ImagenMini } from './Imagen'
import { Fuentes } from './Fuentes'
import { IconBtn } from './bits'
import b from './blocks.module.css'
import f from './fields.module.css'

type Track = Extract<ArticleBlock, { kind: 'track' }>
type Kind = 'track' | 'lede' | 'p' | 'divider'

const OTHER: Array<{ kind: Exclude<Kind, 'track'>; label: string }> = [
  { kind: 'lede', label: 'Introducción' },
  { kind: 'p', label: 'Texto' },
  { kind: 'divider', label: 'Separador' },
]

function fresh(kind: Kind, blocks: ArticleBlock[]): ArticleBlock {
  if (kind === 'track') return { kind: 'track', rank: nextRank(blocks), artist: '', title: '', embeds: [] }
  if (kind === 'divider') return { kind: 'divider' }
  return { kind, text: '' }
}

export function Lista({ value, onChange, id }: { value: ArticleBlock[]; onChange: (v: ArticleBlock[]) => void; id?: string }) {
  const root = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState<Record<number, boolean>>({})
  const [focusAt, setFocusAt] = useState<{ i: number } | null>(null)
  const [menu, setMenu] = useState<number | null>(null)
  const tracks = value.filter((x): x is Track => x.kind === 'track')
  const order = listOrder(value)

  // Each focus request is a fresh object, honoured once its row exists.
  const focused = useRef<object | null>(null)
  useEffect(() => {
    if (!focusAt || focused.current === focusAt) return
    const el = root.current?.querySelector<HTMLElement>(`[data-block="${focusAt.i}"] input, [data-block="${focusAt.i}"] textarea`)
    if (!el) return
    focused.current = focusAt
    el.focus()
  }, [focusAt, value])

  // The insert menu closes on an outside press or Esc.
  useEffect(() => {
    if (menu === null) return
    const down = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('[data-lmenu]')) setMenu(null)
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setMenu(null)
      }
    }
    window.addEventListener('pointerdown', down)
    window.addEventListener('keydown', key, true)
    return () => {
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('keydown', key, true)
    }
  }, [menu])

  const insert = (at: number, kind: Kind) => {
    onChange([...value.slice(0, at), fresh(kind, value), ...value.slice(at)])
    setOpen((o) => shift(o, at, 1, true))
    setFocusAt({ i: at })
    setMenu(null)
  }
  const update = (i: number, next: ArticleBlock) => onChange(value.map((x, k) => (k === i ? next : x)))
  const remove = (i: number) => {
    onChange(value.filter((_, k) => k !== i))
    setOpen((o) => shift(o, i, -1))
  }
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= value.length) return
    const next = value.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
    setOpen((o) => ({ ...o, [i]: o[j], [j]: o[i] }))
  }

  /** An entry is folded once it has artist and title — unless you opened it. */
  const expanded = (i: number, blk: ArticleBlock) => blk.kind !== 'track' || open[i] === true || !(blk.artist.trim() && blk.title.trim())

  return (
    <div ref={root} className={b.blocks} style={{ gap: 0 }}>
      {tracks.length ? (
        <div className={b.order} style={{ marginBottom: 14 }}>
          <span>
            <b>{tracks.length}</b> {tracks.length === 1 ? 'entrada' : 'entradas'} ·{' '}
            {order === 'desc' ? 'cuenta regresiva' : order === 'asc' ? 'ascendente' : 'sin rango (se leen en el orden de la lista)'}
          </span>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 12 }}>
            <button type="button" className={f.textBtn} onClick={() => onChange(renumber(value, 'desc'))}>
              Numerar {tracks.length} → 1
            </button>
            <button type="button" className={f.textBtn} onClick={() => onChange(renumber(value, 'asc'))}>
              Numerar 1 → {tracks.length}
            </button>
          </span>
        </div>
      ) : null}

      {value.length === 0 ? (
        <div className={b.emptyList}>
          <p>Construye tu selección: una entrada por disco o tema, y una razón para escucharlo.</p>
          <div className={f.inline}>
            <button id={id} type="button" className={f.add} onClick={() => insert(0, 'track')}>
              <Mark name="plus" size={13} /> Primera entrada
            </button>
            <button type="button" className={f.textBtn} onClick={() => insert(0, 'lede')}>
              o empieza con una introducción
            </button>
          </div>
        </div>
      ) : (
        value.map((blk, i) => (
          <div key={i}>
            <div className={b.block} data-block={i} id={i === 0 ? id : undefined}>
              {blk.kind === 'track' && !expanded(i, blk) ? (
                <Folded blk={blk} onOpen={() => setOpen((o) => ({ ...o, [i]: true }))} />
              ) : (
                <>
                  <div className={b.bar}>
                    <span className={b.kind}>
                      <span className={b.kindNum}>{String(i + 1).padStart(2, '0')}</span>
                      {blk.kind === 'track' ? 'Entrada' : blk.kind === 'lede' ? 'Introducción' : blk.kind === 'divider' ? 'Separador' : 'Texto'}
                    </span>
                    <div className={b.barTools}>
                      {blk.kind === 'track' && blk.artist.trim() && blk.title.trim() ? (
                        <IconBtn label="Plegar entrada" onClick={() => setOpen((o) => ({ ...o, [i]: false }))}>
                          <Mark name="minus" size={12} />
                        </IconBtn>
                      ) : null}
                      <IconBtn label={`Subir bloque ${i + 1}`} onClick={() => move(i, -1)} disabled={i === 0}>
                        <span aria-hidden="true">↑</span>
                      </IconBtn>
                      <IconBtn label={`Bajar bloque ${i + 1}`} onClick={() => move(i, 1)} disabled={i === value.length - 1}>
                        <span aria-hidden="true">↓</span>
                      </IconBtn>
                      <IconBtn label={`Quitar bloque ${i + 1}`} onClick={() => remove(i)}>
                        <Mark name="close" size={12} />
                      </IconBtn>
                    </div>
                  </div>
                  {blk.kind === 'track' ? (
                    <Entrada blk={blk} onChange={(next) => update(i, next)} />
                  ) : blk.kind === 'divider' ? (
                    <div className={b.divider} aria-hidden="true">
                      · · ·
                    </div>
                  ) : blk.kind === 'lede' || blk.kind === 'p' ? (
                    <Texto
                      float
                      size={blk.kind === 'lede' ? 'lede' : 'block'}
                      label={blk.kind === 'lede' ? 'Introducción' : `Texto ${i + 1}`}
                      value={blk.text}
                      placeholder={blk.kind === 'lede' ? 'Qué conecta a estas obras…' : 'Entre entradas…'}
                      onChange={(text) => update(i, { ...blk, text })}
                    />
                  ) : null}
                </>
              )}
            </div>
            <div className={b.insert} data-lmenu="">
              <button
                type="button"
                className={b.insertBtn}
                aria-label={`Insertar después del bloque ${i + 1}`}
                aria-expanded={menu === i + 1}
                onClick={() => setMenu((m) => (m === i + 1 ? null : i + 1))}
              >
                <Mark name="plus" size={11} />
              </button>
              {menu === i + 1 ? (
                <div className={b.menu} role="menu" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', width: 'min(440px, 92vw)' }}>
                  {[{ kind: 'track' as const, label: 'Entrada' }, ...OTHER].map((c) => (
                    <button key={c.kind} type="button" role="menuitem" className={b.menuItem} onClick={() => insert(i + 1, c.kind)}>
                      <b>{c.label}</b>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))
      )}

      {value.length ? (
        <div className={f.inline} style={{ marginTop: 10 }}>
          <button type="button" className={f.add} onClick={() => insert(value.length, 'track')}>
            <Mark name="plus" size={13} /> Entrada
          </button>
          {OTHER.map((c) => (
            <button key={c.kind} type="button" className={f.pick} onClick={() => insert(value.length, c.kind)}>
              + {c.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function shift(o: Record<number, boolean>, at: number, d: 1 | -1, openNew = false): Record<number, boolean> {
  const out: Record<number, boolean> = {}
  for (const [k, v] of Object.entries(o)) {
    const n = Number(k)
    if (d === -1 && n === at) continue
    out[n >= at ? n + d : n] = v
  }
  if (openNew) out[at] = true
  return out
}

function Folded({ blk, onOpen }: { blk: Track; onOpen: () => void }) {
  const src = safeImage(blk.imageUrl)
  const n = blk.embeds?.length ?? 0
  return (
    <button type="button" className={b.summary} onClick={onOpen} aria-label={`Abrir la entrada ${blk.artist} — ${blk.title}`}>
      <span className={b.summaryRank}>{blk.rank ?? '·'}</span>
      <span className={b.summaryArt}>{src ? <Image src={src} alt="" fill sizes="52px" /> : null}</span>
      <span className={b.summaryText}>
        <b>{blk.title}</b>
        <span>
          {blk.artist}
          {blk.year ? ` · ${blk.year}` : ''}
          {blk.bpm ? ` · ${blk.bpm} BPM` : ''}
        </span>
      </span>
      <span className={b.summaryMeta}>{n ? `${n} ${n === 1 ? 'fuente' : 'fuentes'}` : 'sin audio'}</span>
      <Mark name="expand" size={14} />
    </button>
  )
}

function Entrada({ blk, onChange }: { blk: Track; onChange: (b: Track) => void }) {
  const p = (x: Partial<Track>) => onChange({ ...blk, ...x })
  return (
    <div className={b.entry}>
      <div className={b.entryHead}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span className={b.rank} data-none={blk.rank === undefined || undefined}>
            {blk.rank ?? 'sin nº'}
          </span>
          <input
            className={b.rankInput}
            inputMode="numeric"
            value={blk.rank ?? ''}
            placeholder="Nº"
            aria-label="Número en la lista"
            onChange={(e) => {
              const n = parseInt(e.target.value.replace(/\D/g, ''), 10)
              p({ rank: Number.isFinite(n) ? n : undefined })
            }}
          />
        </div>
        <div className={f.stack} style={{ gap: 8 }}>
          <input className={f.cell} value={blk.artist} placeholder="Artista" aria-label="Artista" onChange={(e) => p({ artist: e.target.value })} />
          <input
            className={f.cell}
            style={{ fontFamily: 'var(--font-display)', fontVariationSettings: '"wdth" 96, "wght" 600', fontSize: 17 }}
            value={blk.title}
            placeholder="Título del tema o disco"
            aria-label="Título"
            onChange={(e) => p({ title: e.target.value })}
          />
          <div className={f.row2}>
            <input className={f.cell} value={blk.year ?? ''} placeholder="Año" aria-label="Año" inputMode="numeric" onChange={(e) => p({ year: e.target.value.trim() || undefined })} />
            <input
              className={f.cell}
              value={blk.bpm ?? ''}
              placeholder="BPM"
              aria-label="BPM"
              inputMode="numeric"
              onChange={(e) => {
                const n = parseInt(e.target.value.replace(/\D/g, ''), 10)
                p({ bpm: Number.isFinite(n) ? n : undefined })
              }}
            />
          </div>
        </div>
        <div />
      </div>
      <div className={f.stack} style={{ gap: 6 }}>
        <span className={f.label}>Portada de la entrada</span>
        <ImagenMini value={blk.imageUrl} onChange={(imageUrl) => p({ imageUrl })} label="Portada de la entrada" />
      </div>
      <div className={f.stack} style={{ gap: 6 }}>
        <span className={f.label}>Tu razón</span>
        <Texto size="small" label="Comentario de la entrada" value={blk.commentary ?? ''} placeholder="Por qué está aquí, qué se oye…" onChange={(commentary) => p({ commentary })} />
      </div>
      <div className={f.stack} style={{ gap: 6 }}>
        <span className={f.label}>Dónde escucharla</span>
        <Fuentes compact value={blk.embeds ?? []} onChange={(embeds: MixEmbed[]) => p({ embeds })} />
      </div>
    </div>
  )
}
