'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Type,
  Heading2,
  Heading3,
  Quote,
  Image as ImageIcon,
  Minus,
  MessageSquare,
  List,
} from 'lucide-react'
import type { ArticleBlock, ContentItem, Footnote } from '@/lib/types'
import { useVibe } from '@/context/VibeContext'
import { LivePreview } from '@/components/dashboard/LivePreview'
import {
  Section,
  TextField,
  TextArea,
  Toggle,
  VibeField,
  GenreMultiSelect,
  ImageUrlField,
  SubmitFooter,
  slugify,
  useDraftWorkbench,
} from './shared/Fields'
import { PollFieldset } from './shared/PollFieldset'

const DRAFT_KEY = 'gradiente:dashboard:articulo-draft'

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

const BLOCK_CHOICES: {
  kind: BlockKind
  label: string
  blurb: string
}[] = [
  { kind: 'lede', label: 'LEDE', blurb: 'Párrafo introductorio con drop-cap.' },
  { kind: 'p', label: 'PÁRRAFO', blurb: 'Prosa normal.' },
  { kind: 'h2', label: 'H2', blurb: 'Encabezado de sección (entra al ÍNDICE).' },
  { kind: 'h3', label: 'H3', blurb: 'Subencabezado.' },
  { kind: 'quote', label: 'QUOTE', blurb: 'Cita destacada en color vibe.' },
  { kind: 'blockquote', label: 'BLOCKQUOTE', blurb: 'Cita atribuida discreta.' },
  { kind: 'image', label: 'IMAGEN', blurb: 'Imagen inline con caption opcional.' },
  { kind: 'divider', label: 'DIVISOR', blurb: 'Separador ornamental.' },
  { kind: 'qa', label: 'Q&A', blurb: 'Línea de entrevista (pregunta/respuesta).' },
  { kind: 'list', label: 'LISTA', blurb: 'Lista ordenada o de viñetas.' },
]

function emptyDraft(): ContentItem {
  return {
    id: 'draft-articulo',
    slug: '',
    type: 'articulo',
    title: '',
    subtitle: '',
    excerpt: '',
    vibeMin: 5, vibeMax: 5,
    genres: [],
    tags: [],
    imageUrl: '',
    heroCaption: '',
    publishedAt: new Date().toISOString(),
    author: '',
    readTime: undefined,
    articleBody: [],
    footnotes: [],
    editorial: true,
  }
}

export function ArticuloForm() {
  const [draft, setDraft] = useState<ContentItem>(emptyDraft)
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const router = useRouter()
  const search = useSearchParams()
  const editItemId = search?.get('edit') ?? null
  const { setCategoryFilter } = useVibe()

  const workbench = useDraftWorkbench({
    draftKey: DRAFT_KEY,
    emptyFn: emptyDraft,
    draft,
    setDraft,
    editItemId,
  })

  const onPublish = () => {
    const id = workbench.requestPublish()
    setCategoryFilter(null)
    router.push(`/?pending=${id}`)
  }

  useEffect(() => {
    if (!slugManuallyEdited && draft.title) {
      const next = slugify(draft.title)
      setDraft((d) => (d.slug === next ? d : { ...d, slug: next }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.title, slugManuallyEdited])

  const patch = (p: Partial<ContentItem>) => setDraft((d) => ({ ...d, ...p }))
  const blocks = draft.articleBody ?? []
  const setBlocks = (next: ArticleBlock[]) => patch({ articleBody: next })
  const footnotes = draft.footnotes ?? []
  const setFootnotes = (next: Footnote[]) => patch({ footnotes: next })

  const onReset = () => {
    workbench.reset()
    setSlugManuallyEdited(false)
  }

  const errors: string[] = []
  if (!draft.title) errors.push('TÍTULO')
  if (!draft.slug) errors.push('SLUG')
  const canSubmit = errors.length === 0

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col gap-5">
        <Section label="01" title="IDENTIDAD">
          <TextField
            label="TÍTULO"
            value={draft.title}
            onChange={(v) => patch({ title: v })}
            placeholder="40 festivales latinoamericanos bajo presión"
            required
          />
          <TextField
            label="SUBTÍTULO / DEK"
            value={draft.subtitle ?? ''}
            onChange={(v) => patch({ subtitle: v })}
            placeholder="Una conversación con la red de promotores"
          />
          <TextField
            label="SLUG"
            value={draft.slug}
            onChange={(v) => {
              setSlugManuallyEdited(true)
              patch({ slug: slugify(v) })
            }}
            placeholder="festivales-latam-presion-europea"
            mono
            required
          />
          <TextField
            label="FIRMA"
            value={draft.author ?? ''}
            onChange={(v) => patch({ author: v })}
            placeholder="Nombre del periodista"
          />
          <TextField
            label="LECTURA (min)"
            value={draft.readTime?.toString() ?? ''}
            onChange={(v) =>
              patch({ readTime: v === '' ? undefined : Number(v) })
            }
            type="number"
            placeholder="12"
            mono
          />
          <Toggle
            label="EDITORIAL (HP inicial elevado)"
            value={!!draft.editorial}
            onChange={(v) => patch({ editorial: v })}
          />
        </Section>

        <Section label="02" title="LEAD">
          <TextArea
            label="EXCERPT"
            value={draft.excerpt ?? ''}
            onChange={(v) => patch({ excerpt: v })}
            rows={3}
            placeholder="El lead del artículo — una o dos oraciones que enganchan…"
          />
        </Section>

        <Section label="03" title="VIBE + GÉNEROS">
          <VibeField valueMin={draft.vibeMin} valueMax={draft.vibeMax} onChange={(min, max) => patch({ vibeMin: min, vibeMax: max })} />
          <GenreMultiSelect
            value={draft.genres}
            onChange={(genres) => patch({ genres })}
          />
        </Section>

        <Section label="04" title="MEDIA">
          <ImageUrlField
            label="HERO URL"
            value={draft.imageUrl ?? ''}
            onChange={(v) => patch({ imageUrl: v })}
            placeholder="/flyers/ar-001.jpg"
          />
          <TextField
            label="CAPTION HERO"
            value={draft.heroCaption ?? ''}
            onChange={(v) => patch({ heroCaption: v })}
            placeholder="Sala principal de FASCiNOMA · 2025 · Foto: Archivo Gradiente"
          />
        </Section>

        <Section label="05" title="CUERPO">
          <ArticleBlocksEditor blocks={blocks} onChange={setBlocks} />
        </Section>

        <Section label="06" title="FOOTNOTES">
          <FootnotesEditor
            footnotes={footnotes}
            onChange={setFootnotes}
          />
        </Section>

        <Section label="07" title="ENCUESTA (opcional)">
          <PollFieldset
            type={draft.type}
            poll={draft.poll}
            onChange={(poll) => patch({ poll: poll ?? undefined })}
          />
        </Section>

        <SubmitFooter
          canSubmit={canSubmit}
          errors={errors}
          onSaveDraft={workbench.saveDraft}
          onPublish={onPublish}
          onReset={onReset}
          flash={workbench.flash}
          lastSavedAt={workbench.lastSavedAt}
          isPublished={workbench.isPublished}
        />
      </div>

      <div className="lg:sticky lg:top-4 lg:self-start">
        <LivePreview draft={draft} />
      </div>
    </div>
  )
}

// ── Article blocks editor ───────────────────────────────────────────────────

function ArticleBlocksEditor({
  blocks,
  onChange,
}: {
  blocks: ArticleBlock[]
  onChange: (next: ArticleBlock[]) => void
}) {
  const insertAt = (at: number, kind: BlockKind) => {
    const fresh = freshBlock(kind)
    const next = [...blocks.slice(0, at), fresh, ...blocks.slice(at)]
    onChange(next)
  }
  const addBlock = (kind: BlockKind) => insertAt(blocks.length, kind)
  const update = (i: number, next: ArticleBlock) =>
    onChange(blocks.map((b, idx) => (idx === i ? next : b)))
  const remove = (i: number) =>
    onChange(blocks.filter((_, idx) => idx !== i))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= blocks.length) return
    const next = blocks.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  if (blocks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 border border-dashed border-border p-6 text-center">
        <span className="sys-label text-muted">CUERPO VACÍO</span>
        <p className="font-mono text-[10px] leading-relaxed text-secondary">
          Empieza con un <span style={{ color: '#F97316' }}>LEDE</span> o un
          PÁRRAFO. Después construyes secciones con H2/H3, citas, listas, etc.
        </p>
        <AddBlockChips onPick={addBlock} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {blocks.map((b, i) => (
        <BlockCard
          key={i}
          index={i}
          block={b}
          canMoveUp={i > 0}
          canMoveDown={i < blocks.length - 1}
          onChange={(next) => update(i, next)}
          onRemove={() => remove(i)}
          onMoveUp={() => move(i, -1)}
          onMoveDown={() => move(i, 1)}
        />
      ))}

      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-dashed border-border pt-3">
        <span className="sys-label text-muted">AÑADIR BLOQUE</span>
        <AddBlockChips onPick={addBlock} />
      </div>
    </div>
  )
}

function AddBlockChips({ onPick }: { onPick: (kind: BlockKind) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {BLOCK_CHOICES.map((c) => (
        <button
          key={c.kind}
          type="button"
          onClick={() => onPick(c.kind)}
          title={c.blurb}
          className="flex items-center gap-1 border border-dashed border-border px-2 py-1 font-mono text-[10px] tracking-widest text-muted transition-colors hover:border-sys-orange hover:text-sys-orange"
        >
          <Plus size={10} /> {c.label}
        </button>
      ))}
    </div>
  )
}

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

// ── Block card ──────────────────────────────────────────────────────────────

function BlockCard({
  index,
  block,
  canMoveUp,
  canMoveDown,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  index: number
  block: ArticleBlock
  canMoveUp: boolean
  canMoveDown: boolean
  onChange: (next: ArticleBlock) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  return (
    <div className="flex flex-col gap-2 border border-border bg-black/30 p-3">
      <header className="flex items-center justify-between gap-2 border-b border-dashed border-border pb-2">
        <div className="flex items-center gap-2 font-mono text-[10px] tracking-widest">
          <KindGlyph kind={block.kind} />
          <span className="text-muted">{String(index + 1).padStart(2, '0')}</span>
          <span className="text-primary">{labelForKind(block.kind)}</span>
        </div>
        <div className="flex items-center gap-1">
          <IconBtn onClick={onMoveUp} disabled={!canMoveUp} aria="Subir">
            <ChevronUp size={12} />
          </IconBtn>
          <IconBtn onClick={onMoveDown} disabled={!canMoveDown} aria="Bajar">
            <ChevronDown size={12} />
          </IconBtn>
          <IconBtn onClick={onRemove} aria="Eliminar" danger>
            <Trash2 size={12} />
          </IconBtn>
        </div>
      </header>
      <BlockBody block={block} onChange={onChange} />
    </div>
  )
}

function KindGlyph({ kind }: { kind: ArticleBlock['kind'] }) {
  const color = '#F97316'
  if (kind === 'h2') return <Heading2 size={12} style={{ color }} aria-hidden />
  if (kind === 'h3') return <Heading3 size={12} style={{ color }} aria-hidden />
  if (kind === 'quote' || kind === 'blockquote')
    return <Quote size={12} style={{ color }} aria-hidden />
  if (kind === 'image') return <ImageIcon size={12} style={{ color }} aria-hidden />
  if (kind === 'divider') return <Minus size={12} style={{ color }} aria-hidden />
  if (kind === 'qa') return <MessageSquare size={12} style={{ color }} aria-hidden />
  if (kind === 'list') return <List size={12} style={{ color }} aria-hidden />
  return <Type size={12} style={{ color }} aria-hidden />
}

function labelForKind(kind: ArticleBlock['kind']): string {
  switch (kind) {
    case 'lede':
      return 'LEDE'
    case 'p':
      return 'PÁRRAFO'
    case 'h2':
      return 'H2'
    case 'h3':
      return 'H3'
    case 'quote':
      return 'QUOTE'
    case 'blockquote':
      return 'BLOCKQUOTE'
    case 'image':
      return 'IMAGEN'
    case 'divider':
      return 'DIVISOR'
    case 'qa':
      return 'Q&A'
    case 'list':
      return 'LISTA'
    case 'track':
      return 'TRACK'
  }
}

function BlockBody({
  block,
  onChange,
}: {
  block: ArticleBlock
  onChange: (next: ArticleBlock) => void
}) {
  if (block.kind === 'lede') {
    return (
      <TextArea
        label="TEXTO DEL LEDE"
        value={block.text}
        onChange={(text) => onChange({ ...block, text })}
        rows={3}
        placeholder="La frase que abre la pieza con drop-cap…"
      />
    )
  }
  if (block.kind === 'p') {
    return (
      <TextArea
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
        <TextField
          label="TEXTO H2"
          value={block.text}
          onChange={(text) => onChange({ ...block, text })}
          placeholder="Sección"
        />
        <TextField
          label="ID (opcional, para anclas en el TOC)"
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
      <TextField
        label="TEXTO H3"
        value={block.text}
        onChange={(text) => onChange({ ...block, text })}
        placeholder="Subsección"
      />
    )
  }
  if (block.kind === 'quote') {
    return (
      <div className="flex flex-col gap-2">
        <TextArea
          label="CITA"
          value={block.text}
          onChange={(text) => onChange({ ...block, text })}
          rows={2}
          placeholder="La frase destacada que va en color vibe…"
        />
        <TextField
          label="FUENTE (opcional)"
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
        <TextArea
          label="BLOCKQUOTE"
          value={block.text}
          onChange={(text) => onChange({ ...block, text })}
          rows={3}
          placeholder="Cita atribuida con tratamiento más discreto…"
        />
        <TextField
          label="FUENTE (opcional)"
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
        <ImageUrlField
          label="IMAGE URL"
          value={block.src}
          onChange={(src) => onChange({ ...block, src })}
          placeholder="/flyers/ar-002.jpg"
        />
        <TextField
          label="ALT (accesibilidad)"
          value={block.alt ?? ''}
          onChange={(alt) => onChange({ ...block, alt })}
          placeholder="Descripción breve para lectores de pantalla"
        />
        <TextField
          label="CAPTION (opcional)"
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
        <span className="font-mono text-xs" style={{ color: '#F97316' }}>⋯</span>
        <div className="h-px flex-1 bg-border" />
        <span className="font-mono text-xs" style={{ color: '#F97316' }}>⋯</span>
      </div>
    )
  }
  if (block.kind === 'qa') {
    return (
      <div className="flex flex-col gap-2">
        <TextField
          label="HABLANTE"
          value={block.speaker}
          onChange={(speaker) => onChange({ ...block, speaker })}
          placeholder="GRADIENTE / PROMOTOR / etc."
        />
        <TextArea
          label="TEXTO"
          value={block.text}
          onChange={(text) => onChange({ ...block, text })}
          rows={3}
          placeholder="La línea de la entrevista…"
        />
        <Toggle
          label="ES PREGUNTA (visualmente diferenciada)"
          value={!!block.isQuestion}
          onChange={(isQuestion) => onChange({ ...block, isQuestion })}
        />
      </div>
    )
  }
  if (block.kind === 'list') {
    return (
      <div className="flex flex-col gap-2">
        <Toggle
          label="ORDENADA (numeración)"
          value={!!block.ordered}
          onChange={(ordered) => onChange({ ...block, ordered })}
        />
        <ListItemsEditor
          items={block.items}
          onChange={(items) => onChange({ ...block, items })}
        />
      </div>
    )
  }
  return (
    <p className="font-mono text-[10px] text-muted">
      Tipo de bloque no editable en este formulario.
    </p>
  )
}

function ListItemsEditor({
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
          <span className="w-5 font-mono text-[10px] text-muted">
            {String(i + 1).padStart(2, '0')}
          </span>
          <input
            type="text"
            value={it}
            onChange={(e) => update(i, e.target.value)}
            placeholder="Punto de la lista…"
            className="min-w-0 flex-1 border bg-black px-2 py-1 font-mono text-xs text-primary outline-none focus:border-sys-orange"
            style={{ borderColor: '#242424' }}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            aria-label="Eliminar punto"
            className="border border-border p-1 text-muted transition-colors hover:border-sys-red hover:text-sys-red"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-2 border border-dashed border-border px-3 py-1.5 font-mono text-[10px] tracking-widest text-muted transition-colors hover:border-sys-orange hover:text-sys-orange"
      >
        <Plus size={12} /> AÑADIR PUNTO
      </button>
    </div>
  )
}

// ── Footnotes editor ────────────────────────────────────────────────────────

function FootnotesEditor({
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
  const add = () =>
    onChange([
      ...footnotes,
      { id: `n${footnotes.length + 1}`, text: '' },
    ])

  return (
    <div className="flex flex-col gap-3">
      <p className="font-mono text-[10px] leading-relaxed text-muted">
        Cada footnote tiene un <span style={{ color: '#F97316' }}>id</span>{' '}
        (ej. <code>n1</code>). Referénciala desde un bloque de texto con{' '}
        <code style={{ color: '#F97316' }}>[^n1]</code>. Las referencias se
        renderizan como superíndice numerado y enlazan al texto de la nota.
      </p>

      {footnotes.length === 0 && (
        <p className="font-mono text-[10px] text-muted">
          Sin notas al pie. Opcional — añade solo si las usas en el cuerpo.
        </p>
      )}

      {footnotes.map((fn, i) => (
        <div
          key={i}
          className="grid grid-cols-[80px_1fr_auto] gap-2 border border-dashed border-border p-2"
        >
          <input
            type="text"
            value={fn.id}
            onChange={(e) => update(i, { id: e.target.value })}
            placeholder="n1"
            className="border bg-black px-2 py-1 font-mono text-xs text-primary outline-none focus:border-sys-orange"
            style={{ borderColor: '#242424' }}
          />
          <input
            type="text"
            value={fn.text}
            onChange={(e) => update(i, { text: e.target.value })}
            placeholder="Texto de la nota al pie…"
            className="min-w-0 border bg-black px-2 py-1 font-grotesk text-sm text-primary outline-none focus:border-sys-orange"
            style={{ borderColor: '#242424' }}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            aria-label="Eliminar nota"
            className="border border-border p-1 text-muted transition-colors hover:border-sys-red hover:text-sys-red"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="flex w-fit items-center gap-2 border border-dashed border-border px-3 py-1.5 font-mono text-[10px] tracking-widest text-muted transition-colors hover:border-sys-orange hover:text-sys-orange"
      >
        <Plus size={12} /> AÑADIR FOOTNOTE
      </button>
    </div>
  )
}

// ── Icon button ─────────────────────────────────────────────────────────────

function IconBtn({
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
      className="border border-border p-1 text-muted transition-colors disabled:cursor-not-allowed disabled:opacity-30"
      onMouseEnter={(e) => {
        if (disabled) return
        e.currentTarget.style.color = danger ? '#E63329' : '#F0F0F0'
        e.currentTarget.style.borderColor = danger ? '#E63329' : '#F0F0F0'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = ''
        e.currentTarget.style.borderColor = ''
      }}
    >
      {children}
    </button>
  )
}
