'use client'

// Structured article editor: direct writing, formatting and contextual insertion.
//
// Logic VERBATIM from components/dashboard/forms/ArticuloForm.tsx (:284-822 —
// DELETED in fase F — this fork is the only copy): insertAt / update / remove / move pure logic,
// the freshBlock factory for all 10 kinds, the 10 BlockBody kind-cases, the
// ListItemsEditor, and the FootnotesEditor (id + [^id] reference contract).
// Only the chrome is rebuilt in the pliego register; the IMAGEN block's
// upload field uses the kit ImageFieldL fork (same compressAndUploadImage
// flow the dark ImageUrlField carries).

import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, Heading2, Image as ImageIcon, Quote, Type } from 'lucide-react'
import type { ArticleBlock, Footnote } from '@/lib/types'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'
import {
  FieldLabelL,
  TextAreaL,
  TextFieldL,
  ToggleL,
} from '@/components/dashboard/compose/kit/fields'
import { FormattingTextarea } from '@/components/dashboard/compose/kit/FormattingTextarea'
import { ImageFieldL } from '@/components/dashboard/compose/kit/ImageFieldL'

type BlockKind =
  | 'lede'
  | 'p'
  | 'h2'
  | 'h3'
  | 'quote'
  | 'blockquote'
  | 'image'
  | 'divider'
  | 'qa'
  | 'list'

const BLOCK_CHOICES: { kind: BlockKind; label: string; blurb: string }[] = [
  { kind: 'p', label: 'Texto', blurb: 'Sigue escribiendo.' },
  { kind: 'h2', label: 'Sección', blurb: 'Organiza tu pieza con un subtítulo.' },
  { kind: 'image', label: 'Imagen', blurb: 'Añade una foto y su crédito.' },
  { kind: 'quote', label: 'Cita destacada', blurb: 'Haz visible una voz o una idea.' },
  { kind: 'lede', label: 'Introducción', blurb: 'Abre con una letra capitular.' },
  { kind: 'h3', label: 'Subsección', blurb: 'Divide una sección extensa.' },
  { kind: 'blockquote', label: 'Cita con autor', blurb: 'Incluye una cita y su atribución.' },
  { kind: 'qa', label: 'Entrevista', blurb: 'Añade una pregunta o respuesta.' },
  { kind: 'list', label: 'Lista', blurb: 'Ordena ideas con números o viñetas.' },
  { kind: 'divider', label: 'Separador', blurb: 'Marca una pausa visual.' },
]

export function ArticuloBlocksEditor({ blocks, onChange }: {
  blocks: ArticleBlock[]; onChange: (next: ArticleBlock[]) => void
}) {
  const [focusAt, setFocusAt] = useState<{ index: number; offset: number; end?: number } | null>(null)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (focusAt === null) return
    const field = root.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-block-index="${focusAt.index}"] textarea, [data-block-index="${focusAt.index}"] input`)
    field?.focus()
    if (field && (field instanceof HTMLTextAreaElement || field.type === 'text')) field.setSelectionRange(focusAt.offset, focusAt.end ?? focusAt.offset)
    setFocusAt(null)
  }, [focusAt, blocks])
  const insertAt = (i: number, kind: BlockKind) => {
    onChange([...blocks.slice(0, i), freshBlock(kind), ...blocks.slice(i)])
    setFocusAt({ index: i, offset: 0 })
  }
  const update = (i: number, value: ArticleBlock) => onChange(blocks.map((b, index) => index === i ? value : b))
  const move = (i: number, direction: number) => {
    const next = blocks.slice()
    const target = i + direction
    if (target < 0 || target >= next.length) return
    ;[next[i], next[target]] = [next[target], next[i]]
    onChange(next); setFocusAt({ index: target, offset: 0 })
  }
  const split = (i: number, start: number, end: number) => {
    const b = blocks[i]
    if (!('text' in b)) return
    onChange([...blocks.slice(0, i), { ...b, text: b.text.slice(0, start) }, { kind: 'p', text: b.text.slice(end) }, ...blocks.slice(i + 1)])
    setFocusAt({ index: i + 1, offset: 0 })
  }
  return <div ref={root} className="min-w-0">
    <div className="mb-3 flex flex-wrap items-center gap-1 border border-ink bg-ink text-paper p-1" role="group" aria-label="Añadir a la pieza">
      {[{ kind: 'p' as const, label: 'Texto', Icon: Type }, { kind: 'h2' as const, label: 'Sección', Icon: Heading2 }, { kind: 'image' as const, label: 'Imagen', Icon: ImageIcon }, { kind: 'quote' as const, label: 'Cita', Icon: Quote }].map(({ kind, label, Icon }) => <button key={kind} type="button" onClick={() => insertAt(blocks.length, kind)} className={`inline-flex min-h-11 items-center gap-2 px-3 text-d13 hover:bg-acid hover:text-ink ${FOCUS_RING}`}><Icon size={16} aria-hidden />{label}<Plus size={12} aria-hidden /></button>)}
    </div>
    {blocks.length === 0 ? <>
      <FormattingTextarea value="" aria-label="Texto de la pieza" placeholder="Empieza a escribir aquí o pega tu texto…" rows={5}
        onChange={(text, selected) => { onChange([{ kind: 'p', text }]); setFocusAt({ index: 0, offset: selected?.start ?? text.length, end: selected?.end }) }}
        className={`min-h-[160px] w-full resize-y border-0 bg-transparent px-3 py-3 text-d18 leading-relaxed placeholder:text-ink-faint ${FOCUS_RING}`} />
      <InsertMenu onPick={(kind) => insertAt(0, kind)} />
    </> : <>
      {blocks.map((block, i) => <div id={`compose-block-${i}`} data-block-index={i} key={i} className="scroll-mt-40">
        <div className="group relative my-2">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="font-mono text-d11 text-ink-soft">{BLOCK_CHOICES.find((choice) => choice.kind === block.kind)?.label ?? 'Contenido'}</span>
            <div className="flex gap-1">
              <IconBtnL onClick={() => move(i, -1)} disabled={i === 0} aria={`Subir contenido ${i + 1}`}><ChevronUp size={14} /></IconBtnL>
              <IconBtnL onClick={() => move(i, 1)} disabled={i === blocks.length - 1} aria={`Bajar contenido ${i + 1}`}><ChevronDown size={14} /></IconBtnL>
              <IconBtnL onClick={() => { onChange(blocks.filter((_, index) => index !== i)); setFocusAt({ index: Math.max(0, i - 1), offset: 0 }) }} aria={`Eliminar contenido ${i + 1}`}><Trash2 size={14} /></IconBtnL>
            </div>
          </div>
          {block.kind === 'p' || block.kind === 'lede' || block.kind === 'h2' || block.kind === 'h3' ?
            <FormattingTextarea aria-label={`${BLOCK_CHOICES.find((c) => c.kind === block.kind)?.label} ${i + 1}`} value={block.text} rows={block.kind === 'p' || block.kind === 'lede' ? 2 : 1}
              placeholder={block.kind === 'h2' || block.kind === 'h3' ? 'Nombre de la sección' : 'Sigue escribiendo…'}
              onChange={(text) => update(i, { ...block, text })}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); split(i, e.currentTarget.selectionStart, e.currentTarget.selectionEnd) } }}
              className={`w-full resize-y border-0 bg-transparent px-3 py-2 leading-relaxed [field-sizing:content] ${block.kind === 'h2' || block.kind === 'h3' ? 'font-syne text-2xl font-bold' : 'min-h-16 text-d18'} placeholder:text-ink-faint ${FOCUS_RING}`} />
            : <BlockBodyL block={block} onChange={(value) => update(i, value)} />}
        </div>
        <InsertMenu onPick={(kind) => insertAt(i + 1, kind)} />
      </div>)}
    </>}
    <p className="mt-5 text-d13 text-ink-soft">Enter crea otro párrafo. Mayús + Enter añade una línea. Puedes deshacer también los cambios de estructura.</p>
  </div>
}

function InsertMenu({ onPick }: { onPick: (kind: BlockKind) => void }) {
  const menu = useRef<HTMLDetailsElement>(null)
  return <details ref={menu} className="my-2" onKeyDown={(e) => { if (e.key === 'Escape' && menu.current?.open) { e.preventDefault(); e.stopPropagation(); menu.current.open = false; menu.current.querySelector('summary')?.focus() } }}>
    <summary className={`w-fit min-h-11 cursor-pointer list-none py-3 text-d13 text-ink-soft hover:text-ink ${FOCUS_RING}`}>+ Añadir contenido</summary>
    <div className="max-w-lg border border-ink bg-paper-raised p-2">
      {BLOCK_CHOICES.slice(0, 4).map((choice) => <button type="button" key={choice.kind} onClick={() => { onPick(choice.kind); if (menu.current) menu.current.open = false }} className={`flex min-h-14 w-full flex-col justify-center border-b border-ink/15 px-3 py-2 text-left hover:bg-acid ${FOCUS_RING}`}><span className="text-d15 font-bold">{choice.label}</span><span className="text-d13 text-ink-soft">{choice.blurb}</span></button>)}
      <details><summary className={`min-h-11 cursor-pointer p-3 text-d13 ${FOCUS_RING}`}>Más opciones</summary>
        {BLOCK_CHOICES.slice(4).map((choice) => <button type="button" key={choice.kind} onClick={() => { onPick(choice.kind); if (menu.current) menu.current.open = false }} className={`flex min-h-14 w-full flex-col justify-center px-3 py-2 text-left hover:bg-acid ${FOCUS_RING}`}><span className="text-d15 font-bold">{choice.label}</span><span className="text-d13 text-ink-soft">{choice.blurb}</span></button>)}
      </details>
    </div>
  </details>
}

// Verbatim from ArticuloForm.tsx:376-399.
function freshBlock(kind: BlockKind): ArticleBlock {
  switch (kind) {
    case 'lede':
      return { kind: 'lede', text: '' }
    case 'p':
      return { kind: 'p', text: '' }
    case 'h2':
      return { kind: 'h2', text: '' }
    case 'h3':
      return { kind: 'h3', text: '' }
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
  }
}

// The 10 kind-cases — field wiring verbatim, pliego fields.
function BlockBodyL({
  block,
  onChange,
}: {
  block: ArticleBlock
  onChange: (next: ArticleBlock) => void
}) {
  if (block.kind === 'lede') {
    return (
      <TextAreaL
        label="Introducción"
        value={block.text}
        onChange={(text) => onChange({ ...block, text })}
        rows={3}
        placeholder="La frase que abre la pieza con drop-cap…"
      />
    )
  }
  if (block.kind === 'p') {
    return (
      <TextAreaL
        label="PÁRRAFO"
        value={block.text}
        onChange={(text) => onChange({ ...block, text })}
        rows={4}
        placeholder="Texto de prosa…  (usa **negrita** o [enlace](url) o [^id] para nota al pie)"
      />
    )
  }
  if (block.kind === 'h2') {
    return (
      <div className="flex flex-col gap-2">
        <TextFieldL
          label="Nombre de la sección"
          value={block.text}
          onChange={(text) => onChange({ ...block, text })}
          placeholder="Sección"
        />
        <TextFieldL
          label="Enlace de sección (opcional)"
          value={block.id ?? ''}
          onChange={(id) => onChange({ ...block, id })}
          placeholder="seccion-uno"
          mono
        />
      </div>
    )
  }
  if (block.kind === 'h3') {
    return (
      <TextFieldL
        label="Nombre de la subsección"
        value={block.text}
        onChange={(text) => onChange({ ...block, text })}
        placeholder="Subsección"
      />
    )
  }
  if (block.kind === 'quote') {
    return (
      <div className="flex flex-col gap-2">
        <TextAreaL
          label="CITA"
          value={block.text}
          onChange={(text) => onChange({ ...block, text })}
          rows={2}
          placeholder="La frase destacada que va en color vibe…"
        />
        <TextFieldL
          label="FUENTE (OPCIONAL)"
          value={block.cite ?? ''}
          onChange={(cite) => onChange({ ...block, cite })}
          placeholder="Nombre o referencia"
        />
      </div>
    )
  }
  if (block.kind === 'blockquote') {
    return (
      <div className="flex flex-col gap-2">
        <TextAreaL
          label="BLOCKQUOTE"
          value={block.text}
          onChange={(text) => onChange({ ...block, text })}
          rows={3}
          placeholder="Cita atribuida con tratamiento más discreto…"
        />
        <TextFieldL
          label="FUENTE (OPCIONAL)"
          value={block.cite ?? ''}
          onChange={(cite) => onChange({ ...block, cite })}
          placeholder="Nombre o referencia"
        />
      </div>
    )
  }
  if (block.kind === 'image') {
    return (
      <div className="flex flex-col gap-2">
        <ImageFieldL
          label="IMAGEN"
          value={block.src}
          onChange={(src) => onChange({ ...block, src })}
        />
        <TextFieldL
          label="ALT (ACCESIBILIDAD)"
          value={block.alt ?? ''}
          onChange={(alt) => onChange({ ...block, alt })}
          placeholder="Descripción breve para lectores de pantalla"
        />
        <TextFieldL
          label="CAPTION (OPCIONAL)"
          value={block.caption ?? ''}
          onChange={(caption) => onChange({ ...block, caption })}
          placeholder="Crédito o contexto"
        />
      </div>
    )
  }
  if (block.kind === 'divider') {
    return (
      <div className="flex items-center gap-3 py-1" aria-hidden>
        <span className="font-mono text-d13 text-ink">⋯</span>
        <div className="h-px flex-1 bg-ink-faint" />
        <span className="font-mono text-d13 text-ink">⋯</span>
      </div>
    )
  }
  if (block.kind === 'qa') {
    return (
      <div className="flex flex-col gap-2">
        <TextFieldL
          label="HABLANTE"
          value={block.speaker}
          onChange={(speaker) => onChange({ ...block, speaker })}
          placeholder="GRADIENTE / PROMOTOR / etc."
        />
        <TextAreaL
          label="TEXTO"
          value={block.text}
          onChange={(text) => onChange({ ...block, text })}
          rows={3}
          placeholder="La línea de la entrevista…"
        />
        <ToggleL
          label="ES PREGUNTA (VISUALMENTE DIFERENCIADA)"
          value={!!block.isQuestion}
          onChange={(isQuestion) => onChange({ ...block, isQuestion })}
        />
      </div>
    )
  }
  if (block.kind === 'list') {
    return (
      <div className="flex flex-col gap-2">
        <ToggleL
          label="ORDENADA (NUMERACIÓN)"
          value={!!block.ordered}
          onChange={(ordered) => onChange({ ...block, ordered })}
        />
        <ListItemsEditorL
          items={block.items}
          onChange={(items) => onChange({ ...block, items })}
        />
      </div>
    )
  }
  return (
    <p className="font-mono text-d11 text-ink-faint">
      Tipo de bloque no editable en este formulario.
    </p>
  )
}

function ListItemsEditorL({
  items,
  onChange,
}: {
  items: string[]
  onChange: (next: string[]) => void
}) {
  const update = (i: number, v: string) =>
    onChange(items.map((x, idx) => (idx === i ? v : x)))
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))
  const add = () => onChange([...items, ''])

  return (
    <div className="flex flex-col gap-2">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-6 font-mono text-d11 tabular-nums text-ink-faint">
            {String(i + 1).padStart(2, '0')}
          </span>
          <input
            type="text"
            value={it}
            onChange={(e) => update(i, e.target.value)}
            placeholder="Punto de la lista…"
            aria-label={`Punto ${i + 1} de la lista`}
            className={`min-h-11 min-w-0 flex-1 border border-ink bg-paper-raised px-2 font-mono text-d13 text-ink placeholder:text-ink-faint ${FOCUS_RING}`}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            aria-label="Eliminar punto"
            className={`flex h-11 w-11 items-center justify-center border border-ink text-ink hover:border-sys-red-paper hover:bg-sys-red-paper hover:text-paper md:h-9 md:w-9 ${FOCUS_RING}`}
          >
            <Trash2 size={13} aria-hidden />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className={`flex min-h-11 items-center gap-2 self-start border border-dashed border-ink px-3 font-mono text-d11 uppercase tracking-widest text-ink hover:bg-ink hover:text-paper md:min-h-9 ${FOCUS_RING}`}
      >
        <Plus size={12} aria-hidden /> AÑADIR PUNTO
      </button>
    </div>
  )
}

// ── Footnotes editor — logic verbatim from ArticuloForm.tsx:712-785 ─────────

export function ArticuloFootnotesEditor({
  footnotes,
  onChange,
}: {
  footnotes: Footnote[]
  onChange: (next: Footnote[]) => void
}) {
  const update = (i: number, patch: Partial<Footnote>) =>
    onChange(footnotes.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))
  const remove = (i: number) =>
    onChange(footnotes.filter((_, idx) => idx !== i))
  const add = () => {
    let number = footnotes.length + 1
    while (footnotes.some((note) => note.id === `n${number}`)) number += 1
    onChange([...footnotes, { id: `n${number}`, text: '' }])
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-mono text-d11 leading-relaxed text-ink-soft">
        Las notas amplían una idea sin interrumpir la lectura. Copia la referencia
        de una nota, por ejemplo <code className="bg-ink px-1 text-acid">[^n1]</code>,
        y pégala donde quieras citarla en el texto.
      </p>

      {footnotes.length === 0 && (
        <p className="font-mono text-d11 text-ink-faint">
          Sin notas al pie. Opcional — añade solo si las usas en el cuerpo.
        </p>
      )}

      {footnotes.map((fn, i) => (
        <div
          key={i}
          className="grid grid-cols-[80px_1fr_auto] gap-2 border border-dashed border-ink p-2"
        >
          <input
            type="text"
            value={fn.id}
            onChange={(e) => update(i, { id: e.target.value })}
            placeholder="n1"
            aria-label={`Id de la nota ${i + 1}`}
            className={`min-h-11 border border-ink bg-paper-raised px-2 font-mono text-d13 text-ink placeholder:text-ink-faint ${FOCUS_RING}`}
          />
          <input
            type="text"
            value={fn.text}
            onChange={(e) => update(i, { text: e.target.value })}
            placeholder="Texto de la nota al pie…"
            aria-label={`Texto de la nota ${i + 1}`}
            className={`min-h-11 min-w-0 border border-ink bg-paper-raised px-2 text-d15 text-ink placeholder:text-ink-faint ${FOCUS_RING}`}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            aria-label="Eliminar nota"
            className={`flex h-11 w-11 items-center justify-center border border-ink text-ink hover:border-sys-red-paper hover:bg-sys-red-paper hover:text-paper md:h-9 md:w-9 ${FOCUS_RING}`}
          >
            <Trash2 size={13} aria-hidden />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className={`flex min-h-11 w-fit items-center gap-2 border border-dashed border-ink px-3 font-mono text-d11 uppercase tracking-widest text-ink hover:bg-ink hover:text-paper md:min-h-9 ${FOCUS_RING}`}
      >
        <Plus size={12} aria-hidden /> Añadir nota al pie
      </button>
    </div>
  )
}

function IconBtnL({
  children,
  onClick,
  disabled,
  aria,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  aria: string
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={aria}
      className={`flex h-11 w-11 items-center justify-center border border-ink text-ink disabled:cursor-not-allowed disabled:border-ink-faint disabled:text-ink-faint ${
        danger
          ? 'hover:border-sys-red-paper hover:bg-sys-red-paper hover:text-paper'
          : 'hover:bg-ink hover:text-paper'
      } ${FOCUS_RING}`}
    >
      {children}
    </button>
  )
}
