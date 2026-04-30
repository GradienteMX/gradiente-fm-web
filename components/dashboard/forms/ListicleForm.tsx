'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useVibe } from '@/context/VibeContext'
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Disc3,
  Type,
  Minus,
} from 'lucide-react'
import type { ArticleBlock, ContentItem, MixEmbed } from '@/lib/types'
import { LivePreview } from '@/components/dashboard/LivePreview'
import {
  Section,
  TextField,
  TextArea,
  Toggle,
  VibeField,
  GenreMultiSelect,
  ImageUrlField,
  EmbedList,
  SubmitFooter,
  slugify,
  useDraftWorkbench,
} from './shared/Fields'
import { PollFieldset } from './shared/PollFieldset'

const DRAFT_KEY = 'gradiente:dashboard:listicle-draft'

type BlockKind = 'lede' | 'p' | 'divider' | 'track'
const BLOCK_CHOICES: { kind: BlockKind; label: string; blurb: string }[] = [
  { kind: 'lede', label: 'LEDE', blurb: 'Párrafo introductorio con drop-cap.' },
  { kind: 'p', label: 'PÁRRAFO', blurb: 'Prosa normal entre ranks.' },
  { kind: 'divider', label: 'DIVISOR', blurb: 'Separador ornamental ⋯ ⋯.' },
  { kind: 'track', label: 'TRACK', blurb: 'Entrada con rank, cover, sources, commentary.' },
]

function emptyDraft(): ContentItem {
  return {
    id: 'draft-listicle',
    slug: '',
    type: 'listicle',
    title: '',
    subtitle: '',
    excerpt: '',
    vibe: 7,
    genres: [],
    tags: [],
    imageUrl: '',
    heroCaption: '',
    publishedAt: new Date().toISOString(),
    author: '',
    articleBody: [],
    editorial: true,
  }
}

export function ListicleForm() {
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
            placeholder="5 tracks que definieron el hard techno en CDMX"
            required
          />
          <TextField
            label="SUBTÍTULO / DEK"
            value={draft.subtitle ?? ''}
            onChange={(v) => patch({ subtitle: v })}
            placeholder="Lo que sonó y movió los cuerpos en el 2026"
          />
          <TextField
            label="SLUG"
            value={draft.slug}
            onChange={(v) => {
              setSlugManuallyEdited(true)
              patch({ slug: slugify(v) })
            }}
            placeholder="cinco-tracks-hard-techno-cdmx-2026"
            mono
            required
          />
          <TextField
            label="FIRMA"
            value={draft.author ?? ''}
            onChange={(v) => patch({ author: v })}
            placeholder="Redacción Gradiente"
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
            placeholder="Un recuento editorial de las piezas que marcaron el año…"
          />
        </Section>

        <Section label="03" title="VIBE + GÉNEROS">
          <VibeField value={draft.vibe} onChange={(v) => patch({ vibe: v })} />
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
            placeholder="/flyers/li-001.jpg"
          />
          <TextField
            label="CAPTION HERO"
            value={draft.heroCaption ?? ''}
            onChange={(v) => patch({ heroCaption: v })}
            placeholder="Club Japan · Roma Norte · sesión de 04:00"
          />
        </Section>

        <Section label="05" title="CUERPO">
          <BlocksEditor blocks={blocks} onChange={setBlocks} />
        </Section>

        <Section label="06" title="ENCUESTA (opcional)">
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

// ── Blocks editor ───────────────────────────────────────────────────────────

function BlocksEditor({
  blocks,
  onChange,
}: {
  blocks: ArticleBlock[]
  onChange: (next: ArticleBlock[]) => void
}) {
  // Tracks the index of the most-recently-added block — used to auto-expand
  // + focus the first field. Reset to null after the block renders.
  const [justAddedIndex, setJustAddedIndex] = useState<number | null>(null)
  // Collapsed state per block, keyed by stable block id. Defaults: tracks
  // collapse when they have at least artist+title filled; other kinds never
  // collapse (they're already compact).
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({})

  const insertAt = (at: number, kind: BlockKind) => {
    const fresh = freshBlock(kind, blocks)
    const next = [...blocks.slice(0, at), fresh, ...blocks.slice(at)]
    onChange(next)
    setJustAddedIndex(at)
    // Shift any collapsed indices >= at up by 1.
    setCollapsed((prev) => {
      const shifted: Record<number, boolean> = {}
      for (const [k, v] of Object.entries(prev)) {
        const idx = Number(k)
        shifted[idx >= at ? idx + 1 : idx] = v
      }
      return shifted
    })
  }
  const addBlock = (kind: BlockKind) => insertAt(blocks.length, kind)

  const update = (i: number, next: ArticleBlock) =>
    onChange(blocks.map((b, idx) => (idx === i ? next : b)))
  const remove = (i: number) => {
    onChange(blocks.filter((_, idx) => idx !== i))
    setCollapsed((prev) => {
      const next: Record<number, boolean> = {}
      for (const [k, v] of Object.entries(prev)) {
        const idx = Number(k)
        if (idx === i) continue
        next[idx > i ? idx - 1 : idx] = v
      }
      return next
    })
  }
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= blocks.length) return
    const next = blocks.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
    setCollapsed((prev) => {
      const out = { ...prev }
      const a = out[i], b = out[j]
      out[i] = b ?? false
      out[j] = a ?? false
      return out
    })
  }

  const toggleCollapse = (i: number) =>
    setCollapsed((prev) => ({ ...prev, [i]: !prev[i] }))

  // Clear justAddedIndex after the render where the new block auto-focused.
  useEffect(() => {
    if (justAddedIndex !== null) {
      const t = setTimeout(() => setJustAddedIndex(null), 200)
      return () => clearTimeout(t)
    }
  }, [justAddedIndex])

  const showEmptyState = blocks.length === 0

  return (
    <div className="flex flex-col gap-2">
      {showEmptyState && (
        <div className="flex flex-col items-center gap-2 border border-dashed border-border p-6 text-center">
          <span className="sys-label text-muted">CUERPO VACÍO</span>
          <p className="font-mono text-[10px] leading-relaxed text-secondary">
            Empieza con un <span style={{ color: '#F97316' }}>LEDE</span>, o
            salta directo a los tracks.
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <AddPrimary onClick={() => addBlock('track')} />
            <AddSecondary
              onPick={(k) => addBlock(k)}
              exclude={['track']}
            />
          </div>
        </div>
      )}

      {!showEmptyState && <InsertRow onPick={(k) => insertAt(0, k)} />}

      {blocks.map((b, i) => (
        <div key={i} className="flex flex-col">
          <BlockCard
            index={i}
            block={b}
            isNew={i === justAddedIndex}
            collapsed={!!collapsed[i]}
            canMoveUp={i > 0}
            canMoveDown={i < blocks.length - 1}
            onChange={(next) => update(i, next)}
            onRemove={() => remove(i)}
            onMoveUp={() => move(i, -1)}
            onMoveDown={() => move(i, 1)}
            onToggleCollapse={() => toggleCollapse(i)}
          />
          <InsertRow onPick={(k) => insertAt(i + 1, k)} />
        </div>
      ))}

      {!showEmptyState && (
        <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-dashed border-border pt-3">
          <AddPrimary onClick={() => addBlock('track')} />
          <span className="font-mono text-[9px] tracking-widest text-muted">
            · o ·
          </span>
          <AddSecondary onPick={(k) => addBlock(k)} exclude={['track']} />
        </div>
      )}
    </div>
  )
}

// ── Add affordances ─────────────────────────────────────────────────────────

function AddPrimary({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 border px-4 py-2 font-mono text-[11px] tracking-widest transition-colors"
      style={{
        borderColor: '#F97316',
        color: '#F97316',
        backgroundColor: 'rgba(249,115,22,0.08)',
      }}
    >
      <Plus size={12} strokeWidth={2.5} />
      AÑADIR TRACK
    </button>
  )
}

function AddSecondary({
  onPick,
  exclude = [],
}: {
  onPick: (kind: BlockKind) => void
  exclude?: BlockKind[]
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {BLOCK_CHOICES.filter((c) => !exclude.includes(c.kind)).map((choice) => (
        <button
          key={choice.kind}
          type="button"
          onClick={() => onPick(choice.kind)}
          title={choice.blurb}
          className="flex items-center gap-1 border border-dashed border-border px-2 py-1 font-mono text-[10px] tracking-widest text-muted transition-colors hover:border-sys-orange hover:text-sys-orange"
        >
          <Plus size={10} /> {choice.label}
        </button>
      ))}
    </div>
  )
}

// Thin horizontal gap between blocks — reveals a kind picker on hover/focus.
function InsertRow({ onPick }: { onPick: (kind: BlockKind) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="group relative flex items-center justify-center"
      style={{ height: 14 }}
      onMouseLeave={() => setOpen(false)}
    >
      {/* Baseline hairline — visible on hover */}
      <div
        className="absolute left-0 right-0 top-1/2 h-px opacity-0 transition-opacity group-hover:opacity-40 focus-within:opacity-40"
        style={{ backgroundColor: '#F97316' }}
        aria-hidden
      />
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative z-10 flex h-5 w-5 items-center justify-center border bg-base opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
          style={{ borderColor: '#F97316', color: '#F97316' }}
          aria-label="Insertar bloque aquí"
          title="Insertar bloque aquí"
        >
          <Plus size={11} strokeWidth={2.5} />
        </button>
      )}
      {open && (
        <div className="relative z-10 flex items-center gap-1 border bg-base px-1 py-0.5 opacity-100"
          style={{ borderColor: '#F97316' }}
        >
          {BLOCK_CHOICES.map((c) => (
            <button
              key={c.kind}
              type="button"
              onClick={() => {
                onPick(c.kind)
                setOpen(false)
              }}
              className="px-2 py-0.5 font-mono text-[9px] tracking-widest text-muted transition-colors hover:text-sys-orange"
              title={c.blurb}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Fresh block factory (auto-rank aware) ──────────────────────────────────

function freshBlock(kind: BlockKind, existing: ArticleBlock[]): ArticleBlock {
  switch (kind) {
    case 'lede':
      return { kind: 'lede', text: '' }
    case 'p':
      return { kind: 'p', text: '' }
    case 'divider':
      return { kind: 'divider' }
    case 'track':
      return {
        kind: 'track',
        rank: inferNextRank(existing),
        artist: '',
        title: '',
        year: undefined,
        bpm: undefined,
        imageUrl: '',
        commentary: '',
        embeds: [],
      }
  }
}

// Looks at existing track blocks' ranks to predict the next sensible value.
// - 0 ranked tracks: undefined (let editor fill)
// - 1 ranked track: mirror (if it's high, decrement — "countdown" is the
//   canonical listicle format; if it's 1, ascend from there).
// - 2+ ranked tracks: detect direction from first two, continue.
function inferNextRank(existing: ArticleBlock[]): number | undefined {
  const ranks = existing
    .filter((b): b is Extract<ArticleBlock, { kind: 'track' }> => b.kind === 'track')
    .map((b) => b.rank)
    .filter((r): r is number => typeof r === 'number')

  if (ranks.length === 0) return undefined
  if (ranks.length === 1) {
    const r = ranks[0]
    return r > 1 ? r - 1 : r + 1
  }
  const descending = ranks[0] > ranks[ranks.length - 1]
  if (descending) {
    const min = Math.min(...ranks)
    return min > 1 ? min - 1 : undefined
  }
  return Math.max(...ranks) + 1
}

// ── Block card ──────────────────────────────────────────────────────────────

function BlockCard({
  index,
  block,
  isNew,
  collapsed,
  canMoveUp,
  canMoveDown,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  onToggleCollapse,
}: {
  index: number
  block: ArticleBlock
  isNew: boolean
  collapsed: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onChange: (next: ArticleBlock) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onToggleCollapse: () => void
}) {
  // Compact collapsed view only applies to tracks for now.
  const supportsCollapse = block.kind === 'track'
  const effectivelyCollapsed = supportsCollapse && collapsed && !isNew

  const header = (
    <header className="flex items-center justify-between gap-2 border-b border-dashed border-border pb-2">
      <div className="flex items-center gap-2 font-mono text-[10px] tracking-widest">
        <KindGlyph kind={block.kind} />
        <span className="text-muted">
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className="text-primary">{labelForKind(block.kind)}</span>
        {block.kind === 'track' && typeof block.rank === 'number' && (
          <span style={{ color: '#F97316' }}>
            · #{String(block.rank).padStart(2, '0')}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        {supportsCollapse && (
          <IconBtn
            onClick={onToggleCollapse}
            aria={collapsed ? 'Expandir' : 'Contraer'}
          >
            {collapsed ? <ChevronsUpDown size={12} /> : <ChevronsDownUp size={12} />}
          </IconBtn>
        )}
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
  )

  // Track collapsed = single-row summary with cover thumb.
  if (effectivelyCollapsed && block.kind === 'track') {
    const embedCount = block.embeds?.length ?? 0
    return (
      <div className="flex flex-col gap-2 border border-border bg-black/30 p-3">
        {header}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center gap-3 text-left transition-colors hover:bg-elevated/40"
        >
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center border border-border bg-elevated"
            aria-hidden
          >
            {block.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={block.imageUrl}
                alt=""
                className="h-full w-full object-cover"
                onError={(e) => {
                  ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                }}
              />
            ) : (
              <Disc3 size={16} className="text-muted" />
            )}
          </div>
          <div className="min-w-0 flex flex-col">
            <span
              className="truncate font-mono text-[11px]"
              style={{ color: '#F97316' }}
            >
              {block.artist || <span className="text-muted">[sin artista]</span>}
            </span>
            <span className="truncate font-syne text-sm font-black text-primary">
              {block.title || <span className="text-muted">[sin título]</span>}
            </span>
          </div>
          <span className="ml-auto whitespace-nowrap font-mono text-[10px] tracking-widest text-muted">
            {embedCount} {embedCount === 1 ? 'fuente' : 'fuentes'}
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 border border-border bg-black/30 p-3">
      {header}
      <BlockBody block={block} onChange={onChange} autoFocus={isNew} />
    </div>
  )
}

// Small leading glyph per block kind — helps distinguish at a glance.
function KindGlyph({ kind }: { kind: ArticleBlock['kind'] }) {
  const color = '#F97316'
  if (kind === 'track')
    return <Disc3 size={12} style={{ color }} aria-hidden />
  if (kind === 'divider')
    return <Minus size={12} style={{ color }} aria-hidden />
  // lede / p / h2 / h3 / other text kinds
  return <Type size={12} style={{ color }} aria-hidden />
}

function BlockBody({
  block,
  onChange,
  autoFocus,
}: {
  block: ArticleBlock
  onChange: (next: ArticleBlock) => void
  autoFocus?: boolean
}) {
  if (block.kind === 'lede') {
    return (
      <AutoFocusTextArea
        label="TEXTO DEL LEDE"
        value={block.text}
        onChange={(text) => onChange({ ...block, text })}
        rows={3}
        placeholder="La frase que abre el recuento…"
        autoFocus={autoFocus}
      />
    )
  }
  if (block.kind === 'p') {
    return (
      <AutoFocusTextArea
        label="PÁRRAFO"
        value={block.text}
        onChange={(text) => onChange({ ...block, text })}
        rows={4}
        placeholder="Texto de prosa entre ranks…"
        autoFocus={autoFocus}
      />
    )
  }
  if (block.kind === 'divider') {
    return (
      <div
        className="flex items-center gap-3 py-1"
        aria-hidden
      >
        <span className="font-mono text-xs" style={{ color: '#F97316' }}>⋯</span>
        <div className="h-px flex-1 bg-border" />
        <span className="font-mono text-xs" style={{ color: '#F97316' }}>⋯</span>
      </div>
    )
  }
  if (block.kind === 'track') {
    const patch = (p: Partial<typeof block>) => onChange({ ...block, ...p })
    return (
      <div className="flex flex-col gap-3">
        {/* Cover + artist/title row — cover visible inline */}
        <div className="flex gap-3">
          <div
            className="relative h-[88px] w-[88px] shrink-0 overflow-hidden border border-border bg-elevated"
            aria-hidden
          >
            {block.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={block.imageUrl}
                alt=""
                className="h-full w-full object-cover"
                onError={(e) => {
                  ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted">
                <Disc3 size={22} />
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="grid gap-2 sm:grid-cols-[80px_1fr]">
              <TextField
                label="RANK"
                value={block.rank?.toString() ?? ''}
                onChange={(v) =>
                  patch({ rank: v === '' ? undefined : Number(v) })
                }
                type="number"
                placeholder="—"
                mono
              />
              <AutoFocusTextField
                label="ARTISTA"
                value={block.artist}
                onChange={(v) => patch({ artist: v })}
                placeholder="Perc Trax"
                autoFocus={autoFocus}
              />
            </div>
            <TextField
              label="TÍTULO"
              value={block.title}
              onChange={(v) => patch({ title: v })}
              placeholder="Forward Pressure"
            />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_2fr]">
          <TextField
            label="AÑO"
            value={block.year?.toString() ?? ''}
            onChange={(v) => patch({ year: v === '' ? undefined : v })}
            placeholder="2026"
            mono
          />
          <TextField
            label="BPM"
            value={block.bpm?.toString() ?? ''}
            onChange={(v) => patch({ bpm: v === '' ? undefined : Number(v) })}
            type="number"
            placeholder="134"
            mono
          />
          <TextField
            label="COVER URL"
            value={block.imageUrl ?? ''}
            onChange={(v) => patch({ imageUrl: v })}
            placeholder="/flyers/tr-001.jpg"
            mono
          />
        </div>

        <TextArea
          label="COMENTARIO"
          value={block.commentary ?? ''}
          onChange={(v) => patch({ commentary: v })}
          rows={3}
          placeholder="La toma editorial del track — por qué importa…"
        />

        <div>
          <span className="sys-label mb-2 block">EMBEDS</span>
          <EmbedList
            embeds={block.embeds ?? []}
            onChange={(embeds: MixEmbed[]) => patch({ embeds })}
          />
        </div>
      </div>
    )
  }
  return (
    <p className="font-mono text-[10px] text-muted">
      Tipo de bloque no editable en el dashboard v1.
    </p>
  )
}

// ── Auto-focusing variants ──────────────────────────────────────────────────

function AutoFocusTextField({
  label,
  value,
  onChange,
  placeholder,
  mono,
  autoFocus,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  mono?: boolean
  autoFocus?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])
  return (
    <label className="flex flex-col gap-1">
      <span className="sys-label">{label}</span>
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`border bg-black px-3 py-2 ${
          mono ? 'font-mono text-xs' : 'font-grotesk text-sm'
        } text-primary outline-none transition-colors focus:border-sys-orange`}
        style={{ borderColor: '#242424' }}
      />
    </label>
  )
}

function AutoFocusTextArea({
  label,
  value,
  onChange,
  placeholder,
  rows,
  autoFocus,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  autoFocus?: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])
  return (
    <label className="flex flex-col gap-1">
      <span className="sys-label">{label}</span>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows ?? 4}
        className="border bg-black px-3 py-2 font-grotesk text-sm leading-relaxed text-primary outline-none transition-colors focus:border-sys-orange"
        style={{ borderColor: '#242424' }}
      />
    </label>
  )
}

function labelForKind(kind: ArticleBlock['kind']): string {
  switch (kind) {
    case 'lede': return 'LEDE'
    case 'p': return 'PÁRRAFO'
    case 'h2': return 'H2'
    case 'h3': return 'H3'
    case 'quote': return 'QUOTE'
    case 'blockquote': return 'BLOCKQUOTE'
    case 'image': return 'IMAGEN'
    case 'divider': return 'DIVISOR'
    case 'qa': return 'Q&A'
    case 'list': return 'LISTA'
    case 'track': return 'TRACK'
  }
}

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
      style={{
        color: disabled ? undefined : 'inherit',
      }}
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
