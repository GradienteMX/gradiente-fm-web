'use client'

/**
 * CUERPO — the artículo's structured body: lede, paragraphs, §sections,
 * quotes, images, Q&A, lists, dividers. Writing flows like prose — Enter
 * opens a new paragraph at the caret, Backspace at the start joins it back,
 * pasting several paragraphs splits them — and every block can be inserted
 * anywhere, moved and removed. Structure edits are undoable like words.
 */

import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import type { ArticleBlock, Footnote } from '@/lib/types'
import { Mark } from '@/components/kit/Glyph'
import { TextField } from '@/components/kit/Field'
import { slugify } from '../model'
import { Texto } from './Texto'
import { ImagenMini } from './Imagen'
import { IconBtn, Switch } from './bits'
import b from './blocks.module.css'
import f from './fields.module.css'

type Kind = Exclude<ArticleBlock['kind'], 'track'>

const CHOICES: Array<{ kind: Kind; label: string; blurb: string }> = [
  { kind: 'p', label: 'Texto', blurb: 'Sigue escribiendo.' },
  { kind: 'h2', label: 'Sección', blurb: 'Un subtítulo que entra al índice.' },
  { kind: 'image', label: 'Imagen', blurb: 'Una foto con su crédito.' },
  { kind: 'quote', label: 'Cita destacada', blurb: 'Una voz o una idea, en grande.' },
  { kind: 'lede', label: 'Introducción', blurb: 'La frase que abre la pieza.' },
  { kind: 'h3', label: 'Subsección', blurb: 'Divide una sección extensa.' },
  { kind: 'blockquote', label: 'Cita con autor', blurb: 'Una cita atribuida, discreta.' },
  { kind: 'qa', label: 'Entrevista', blurb: 'Una pregunta o una respuesta.' },
  { kind: 'list', label: 'Lista', blurb: 'Ideas con números o viñetas.' },
  { kind: 'divider', label: 'Separador', blurb: 'Una pausa visual.' },
]

const LABEL: Record<ArticleBlock['kind'], string> = {
  lede: 'Introducción',
  p: 'Texto',
  h2: 'Sección',
  h3: 'Subsección',
  quote: 'Cita destacada',
  blockquote: 'Cita con autor',
  image: 'Imagen',
  divider: 'Separador',
  qa: 'Entrevista',
  list: 'Lista',
  track: 'Entrada',
}

function fresh(kind: Kind): ArticleBlock {
  switch (kind) {
    case 'quote':
      return { kind: 'quote', text: '', cite: '' }
    case 'blockquote':
      return { kind: 'blockquote', text: '', cite: '' }
    case 'image':
      return { kind: 'image', src: '', alt: '', caption: '' }
    case 'divider':
      return { kind: 'divider' }
    case 'qa':
      return { kind: 'qa', speaker: '', text: '', isQuestion: false }
    case 'list':
      return { kind: 'list', items: [''], ordered: false }
    case 'h2':
      return { kind: 'h2', text: '' }
    default:
      return { kind, text: '' }
  }
}

/** Menu of block kinds; closes on outside press and Esc. */
function KindMenu({ onPick, onClose, choices = CHOICES }: { onPick: (k: Kind) => void; onClose: () => void; choices?: typeof CHOICES }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (!ref.current?.parentElement?.contains(e.target as Node)) onClose()
    }
    window.addEventListener('pointerdown', down)
    requestAnimationFrame(() => ref.current?.querySelector<HTMLButtonElement>('button')?.focus())
    return () => window.removeEventListener('pointerdown', down)
  }, [onClose])
  return (
    <div
      ref={ref}
      className={b.menu}
      role="menu"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          onClose()
        }
      }}
    >
      {choices.map((c) => (
        <button key={c.kind} type="button" role="menuitem" className={b.menuItem} onClick={() => onPick(c.kind)}>
          <b>{c.label}</b>
          <span>{c.blurb}</span>
        </button>
      ))}
    </div>
  )
}

export function Bloques({ value, onChange, footnotes, id }: { value: ArticleBlock[]; onChange: (v: ArticleBlock[]) => void; footnotes?: Footnote[]; id?: string }) {
  const root = useRef<HTMLDivElement>(null)
  const [focusAt, setFocusAt] = useState<{ i: number; caret?: number } | null>(null)
  const [menu, setMenu] = useState<number | 'mas' | null>(null)

  // Each focus request is a fresh object, honoured once — as soon as the
  // value that renders its block has landed.
  const focused = useRef<object | null>(null)
  useEffect(() => {
    if (!focusAt || focused.current === focusAt) return
    const el = root.current?.querySelector<HTMLTextAreaElement | HTMLInputElement>(`[data-block="${focusAt.i}"] textarea, [data-block="${focusAt.i}"] input`)
    if (!el) return
    focused.current = focusAt
    el.focus({ preventScroll: true })
    el.closest('[data-block]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    if (typeof focusAt.caret === 'number') el.setSelectionRange(focusAt.caret, focusAt.caret)
  }, [focusAt, value])

  const insert = (at: number, kind: Kind) => {
    onChange([...value.slice(0, at), fresh(kind), ...value.slice(at)])
    setFocusAt({ i: at })
    setMenu(null)
  }
  const update = (i: number, next: ArticleBlock) => onChange(value.map((x, k) => (k === i ? next : x)))
  const remove = (i: number) => {
    onChange(value.filter((_, k) => k !== i))
    if (i > 0) setFocusAt({ i: i - 1 })
  }
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= value.length) return
    const next = value.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
    setFocusAt({ i: j })
  }

  /** Enter: the paragraph splits at the caret. */
  const split = (i: number, start: number, end: number) => {
    const blk = value[i]
    if (blk.kind !== 'p' && blk.kind !== 'lede') return
    onChange([...value.slice(0, i), { ...blk, text: blk.text.slice(0, start) }, { kind: 'p', text: blk.text.slice(end) }, ...value.slice(i + 1)])
    setFocusAt({ i: i + 1, caret: 0 })
  }

  /** Backspace at the start: join with the paragraph above (or drop an empty one). */
  const join = (i: number) => {
    const cur = value[i]
    const prev = value[i - 1]
    if (cur.kind !== 'p' || !prev) return false
    if (prev.kind === 'p' || prev.kind === 'lede') {
      const caret = prev.text.length
      onChange([...value.slice(0, i - 1), { ...prev, text: prev.text + cur.text }, ...value.slice(i + 1)])
      setFocusAt({ i: i - 1, caret })
      return true
    }
    if (!cur.text) {
      remove(i)
      return true
    }
    return false
  }

  const keys = (i: number) => (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      split(i, el.selectionStart, el.selectionEnd)
    } else if (e.key === 'Backspace' && el.selectionStart === 0 && el.selectionEnd === 0 && i > 0) {
      if (join(i)) e.preventDefault()
    }
  }

  /** Several paragraphs pasted at once become several blocks. */
  const paste = (i: number) => (text: string, e: ClipboardEvent<HTMLTextAreaElement>) => {
    const paras = text.replace(/\r\n/g, '\n').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    const blk = value[i]
    if (paras.length < 2 || (blk.kind !== 'p' && blk.kind !== 'lede')) return
    e.preventDefault()
    const el = e.currentTarget
    const before = blk.text.slice(0, el.selectionStart)
    const after = blk.text.slice(el.selectionEnd)
    const last = paras[paras.length - 1]
    const mid: ArticleBlock[] = paras.slice(1, -1).map((t) => ({ kind: 'p', text: t }))
    onChange([...value.slice(0, i), { ...blk, text: before + paras[0] }, ...mid, { kind: 'p', text: last + after }, ...value.slice(i + 1)])
    setFocusAt({ i: i + paras.length - 1, caret: last.length })
  }

  let section = 0

  return (
    <div ref={root} className={b.blocks}>
      <div className={b.adders} role="group" aria-label="Añadir al final de la pieza">
        <span>Añadir</span>
        {CHOICES.slice(0, 4).map((c) => (
          <button key={c.kind} type="button" className={b.adder} onClick={() => insert(value.length, c.kind)}>
            <Mark name="plus" size={12} /> {c.label}
          </button>
        ))}
        <span style={{ position: 'relative', padding: 0 }}>
          <button type="button" className={b.adder} aria-expanded={menu === 'mas'} aria-haspopup="menu" onClick={() => setMenu((m) => (m === 'mas' ? null : 'mas'))}>
            Más…
          </button>
          {menu === 'mas' ? <KindMenu onPick={(k) => insert(value.length, k)} onClose={() => setMenu(null)} choices={CHOICES.slice(4)} /> : null}
        </span>
      </div>

      {value.length === 0 ? (
        <div data-block="0">
          <Texto
            id={id}
            size="body"
            label="Cuerpo del artículo"
            value=""
            placeholder="Empieza a escribir aquí, o pega tu texto: cada párrafo se vuelve un bloque."
            helper="Enter abre otro párrafo. Luego podrás insertar secciones, citas e imágenes entre ellos."
            onChange={(text) => {
              const paras = text.split(/\n\s*\n/)
              onChange(paras.length > 1 ? paras.map((t) => ({ kind: 'p' as const, text: t.trim() })) : [{ kind: 'p', text }])
              setFocusAt({ i: Math.max(0, paras.length - 1), caret: (paras[paras.length - 1] ?? '').trim().length })
            }}
          />
        </div>
      ) : (
        value.map((blk, i) => {
          if (blk.kind === 'h2') section++
          return (
            <div key={i}>
              <div className={b.block} data-block={i} id={i === 0 ? id : undefined}>
                <div className={b.bar}>
                  <span className={b.kind}>
                    <span className={b.kindNum}>{String(i + 1).padStart(2, '0')}</span>
                    {blk.kind === 'h2' ? <span className={b.sec}>§{String(section).padStart(2, '0')}</span> : null}
                    {LABEL[blk.kind]}
                  </span>
                  <div className={b.barTools}>
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
                <Editor
                  blk={blk}
                  i={i}
                  footnotes={footnotes}
                  onChange={(next) => update(i, next)}
                  onKeyDown={keys(i)}
                  onPaste={paste(i)}
                  onEnterHeading={() => insert(i + 1, 'p')}
                />
              </div>
              <div className={b.insert}>
                <button
                  type="button"
                  className={b.insertBtn}
                  aria-label={`Insertar un bloque después del ${i + 1}`}
                  aria-expanded={menu === i + 1}
                  aria-haspopup="menu"
                  onClick={() => setMenu((m) => (m === i + 1 ? null : i + 1))}
                >
                  <Mark name="plus" size={11} />
                </button>
                {menu === i + 1 ? <KindMenu onPick={(k) => insert(i + 1, k)} onClose={() => setMenu(null)} /> : null}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

function Editor({
  blk,
  i,
  footnotes,
  onChange,
  onKeyDown,
  onPaste,
  onEnterHeading,
}: {
  blk: ArticleBlock
  i: number
  footnotes?: Footnote[]
  onChange: (b: ArticleBlock) => void
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void
  onPaste: (text: string, e: ClipboardEvent<HTMLTextAreaElement>) => void
  onEnterHeading: () => void
}) {
  switch (blk.kind) {
    case 'p':
      return (
        <Texto
          float
          size="block"
          label={`Párrafo ${i + 1}`}
          value={blk.text}
          footnotes={footnotes}
          placeholder="Sigue escribiendo…"
          helper="Enter: otro párrafo · Mayús + Enter: salto de línea · [^n1] llama a una nota"
          onChange={(text) => onChange({ ...blk, text })}
          onKeyDown={onKeyDown}
          onPasteText={onPaste}
        />
      )
    case 'lede':
      return (
        <Texto
          float
          size="lede"
          label="Introducción"
          value={blk.text}
          footnotes={footnotes}
          placeholder="La frase que abre la pieza…"
          helper="La introducción se lee más grande, con capitular."
          onChange={(text) => onChange({ ...blk, text })}
          onKeyDown={onKeyDown}
          onPasteText={onPaste}
        />
      )
    case 'h2':
    case 'h3':
      return (
        <div className={f.stack} style={{ gap: 8 }}>
          <input
            className={b.heading}
            data-level={blk.kind === 'h3' ? '3' : '2'}
            value={blk.text}
            placeholder={blk.kind === 'h2' ? 'Nombre de la sección' : 'Nombre de la subsección'}
            aria-label={blk.kind === 'h2' ? `Sección ${i + 1}` : `Subsección ${i + 1}`}
            onChange={(e) => onChange({ ...blk, text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onEnterHeading()
              }
            }}
          />
          {blk.kind === 'h2' ? (
            <p className={f.note}>
              Entra al índice de la lectura
              {blk.text ? (
                <>
                  {' · ancla '}
                  <span className={f.mono}>#{blk.id || slugify(blk.text) || 's'}</span>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      )
    case 'quote':
    case 'blockquote':
      return (
        <div className={b.quoteWrap} data-pull={blk.kind === 'quote' || undefined}>
          <Texto
            size="small"
            label={blk.kind === 'quote' ? 'Cita destacada' : 'Cita con autor'}
            value={blk.text}
            footnotes={footnotes}
            placeholder={blk.kind === 'quote' ? 'La frase que merece ir en grande…' : 'La cita, tal como se dijo…'}
            onChange={(text) => onChange({ ...blk, text })}
          />
          <input className={f.cell} value={blk.cite ?? ''} placeholder="Quién lo dijo (opcional)" aria-label="Autoría de la cita" onChange={(e) => onChange({ ...blk, cite: e.target.value })} />
        </div>
      )
    case 'image':
      return (
        <div className={f.stack} style={{ gap: 12 }}>
          <ImagenMini value={blk.src} onChange={(src) => onChange({ ...blk, src: src ?? '' })} label="Imagen del bloque" />
          <div className={f.row2}>
            <TextField label="Pie" value={blk.caption ?? ''} placeholder="Crédito o contexto" onChange={(e) => onChange({ ...blk, caption: e.target.value })} />
            <TextField label="Descripción (accesibilidad)" value={blk.alt ?? ''} placeholder="Qué se ve, para lectores de pantalla" onChange={(e) => onChange({ ...blk, alt: e.target.value })} />
          </div>
        </div>
      )
    case 'divider':
      return (
        <div className={b.divider} aria-hidden="true">
          · · ·
        </div>
      )
    case 'qa':
      return (
        <div className={f.stack} style={{ gap: 10 }}>
          <div className={f.rowLine} style={{ gridTemplateColumns: 'minmax(0, 220px) minmax(0, 1fr)' }}>
            <input className={f.cell} value={blk.speaker} placeholder="Quién habla" aria-label="Quién habla" onChange={(e) => onChange({ ...blk, speaker: e.target.value })} />
            <Switch on={!!blk.isQuestion} onChange={(v) => onChange({ ...blk, isQuestion: v })} label="Es una pregunta" />
          </div>
          <Texto size="small" label="Intervención" value={blk.text} footnotes={footnotes} placeholder="Lo que se dijo…" onChange={(text) => onChange({ ...blk, text })} />
        </div>
      )
    case 'list':
      return (
        <div className={f.stack} style={{ gap: 10 }}>
          <Switch on={!!blk.ordered} onChange={(v) => onChange({ ...blk, ordered: v })} label="Numerada" hint={blk.ordered ? '1, 2, 3…' : 'Con viñetas'} />
          <div className={f.rows}>
            {blk.items.map((it, k) => (
              <div key={k} className={f.rowLine} style={{ gridTemplateColumns: '22px minmax(0, 1fr) auto' }}>
                <span className={f.idx}>{blk.ordered ? k + 1 : '·'}</span>
                <input
                  className={f.cell}
                  value={it}
                  placeholder="Un punto de la lista"
                  aria-label={`Punto ${k + 1}`}
                  onChange={(e) => onChange({ ...blk, items: blk.items.map((x, j) => (j === k ? e.target.value : x)) })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && k === blk.items.length - 1 && it.trim()) {
                      e.preventDefault()
                      onChange({ ...blk, items: [...blk.items, ''] })
                      requestAnimationFrame(() => {
                        const inputs = (e.target as HTMLElement).closest('[data-block]')?.querySelectorAll<HTMLInputElement>('input')
                        inputs?.[inputs.length - 1]?.focus()
                      })
                    }
                  }}
                />
                <IconBtn label={`Quitar punto ${k + 1}`} onClick={() => onChange({ ...blk, items: blk.items.filter((_, j) => j !== k) })} disabled={blk.items.length === 1}>
                  <Mark name="close" size={12} />
                </IconBtn>
              </div>
            ))}
          </div>
          <button type="button" className={f.add} onClick={() => onChange({ ...blk, items: [...blk.items, ''] })}>
            <Mark name="plus" size={13} /> Punto
          </button>
        </div>
      )
    case 'track':
      return <p className={f.note}>Las entradas de lista se editan en una Lista.</p>
  }
}
