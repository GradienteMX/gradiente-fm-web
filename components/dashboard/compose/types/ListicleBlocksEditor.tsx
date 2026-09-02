'use client'

// ── ListicleBlocksEditor — pliego port of ListicleForm's BlocksEditor ───────
//
// Logic VERBATIM from components/dashboard/forms/ListicleForm.tsx (:256-949 —
// DELETED in fase F — this fork is the only copy): the 4-kind block editor (lede / p / divider /
// track), the collapse index-shifting on insert/remove/move, the InsertRow
// between-blocks picker, the freshBlock factory with inferNextRank
// (countdown-aware), justAddedIndex auto-focus. Only the chrome is rebuilt in
// the pliego register. TRACK block sources use the kit EmbedListL fork.
//
// Motion constitution: the dark InsertRow's opacity *transition* is dropped —
// hover/focus reveal is instant (no fades), same affordance.

import { useEffect, useRef, useState } from 'react'
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
import type { ArticleBlock, MixEmbed } from '@/lib/types'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'
import { FieldLabelL, TextAreaL, TextFieldL } from '@/components/dashboard/compose/kit/fields'
import { EmbedListL } from '@/components/dashboard/compose/kit/EmbedListL'

type BlockKind = 'lede' | 'p' | 'divider' | 'track'
const BLOCK_CHOICES: { kind: BlockKind; label: string; blurb: string }[] = [
  { kind: 'lede', label: 'LEDE', blurb: 'Párrafo introductorio con drop-cap.' },
  { kind: 'p', label: 'PÁRRAFO', blurb: 'Prosa normal entre ranks.' },
  { kind: 'divider', label: 'DIVISOR', blurb: 'Separador ornamental ⋯ ⋯.' },
  { kind: 'track', label: 'TRACK', blurb: 'Entrada con rank, cover, sources, commentary.' },
]

export function ListicleBlocksEditor({
  blocks,
  onChange,
}: {
  blocks: ArticleBlock[]
  onChange: (next: ArticleBlock[]) => void
}) {
  // Tracks the index of the most-recently-added block — used to auto-expand
  // + focus the first field. Reset to null after the block renders.
  const [justAddedIndex, setJustAddedIndex] = useState<number | null>(null)
  // Collapsed state per block, keyed by index. Defaults: tracks collapse when
  // they have at least artist+title filled; other kinds never collapse
  // (they're already compact).
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
      {/* Pristine empty state — neutral ink, never a red scold (judge r6
          fix 2): the rail's FALTA row already marks CUERPO pending, and the
          red register is unreachable pre-publish (PUBLICAR gates on it). */}
      {showEmptyState && (
        <div className="flex flex-col items-center gap-3 border-2 border-dashed border-ink bg-paper p-8 text-center">
          <span className="font-mono text-d13 font-bold tracking-widest text-ink">
            AÑADE EL CUERPO DE LA LISTA AQUÍ
          </span>
          <p className="max-w-md font-mono text-d11 leading-relaxed text-ink-soft">
            Tu lista va en bloques de TRACK (uno por entrada), más LEDEs y
            párrafos para contextualizar — no en el EXCERPT.
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
            <AddPrimary onClick={() => addBlock('track')} />
            <AddSecondary onPick={(k) => addBlock(k)} exclude={['track']} />
          </div>
        </div>
      )}

      {!showEmptyState && <InsertRowL onPick={(k) => insertAt(0, k)} />}

      {blocks.map((b, i) => (
        <div key={i} className="flex flex-col">
          <BlockCardL
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
          <InsertRowL onPick={(k) => insertAt(i + 1, k)} />
        </div>
      ))}

      {!showEmptyState && (
        <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-dashed border-ink pt-3">
          <AddPrimary onClick={() => addBlock('track')} />
          <span className="font-mono text-d11 tracking-widest text-ink-faint">
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
      className={`inline-flex min-h-11 items-center gap-2 border border-ink bg-ink px-4 font-mono text-d11 font-bold tracking-widest text-acid hover:bg-ink-soft md:min-h-9 ${FOCUS_RING}`}
    >
      <Plus size={12} strokeWidth={2.5} aria-hidden />
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
          className={`flex min-h-11 items-center gap-1 border border-dashed border-ink px-2.5 font-mono text-d11 tracking-widest text-ink hover:bg-ink hover:text-paper md:min-h-9 ${FOCUS_RING}`}
        >
          <Plus size={10} aria-hidden /> {choice.label}
        </button>
      ))}
    </div>
  )
}

// Thin horizontal gap between blocks — reveals a kind picker on hover/focus.
// Reveal is INSTANT (no opacity transition — motion constitution).
function InsertRowL({ onPick }: { onPick: (kind: BlockKind) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="group relative flex items-center justify-center"
      style={{ height: 16 }}
      onMouseLeave={() => setOpen(false)}
    >
      {/* Baseline hairline — visible on hover */}
      <div
        className="absolute left-0 right-0 top-1/2 h-px bg-ink opacity-0 focus-within:opacity-30 group-hover:opacity-30"
        aria-hidden
      />
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`relative z-10 flex h-7 w-7 items-center justify-center border border-ink bg-paper-raised text-ink opacity-0 hover:bg-ink hover:text-paper focus:opacity-100 group-hover:opacity-100 ${FOCUS_RING}`}
          aria-label="Insertar bloque aquí"
          title="Insertar bloque aquí"
        >
          <Plus size={12} strokeWidth={2.5} aria-hidden />
        </button>
      )}
      {open && (
        <div className="relative z-10 flex items-center gap-1 border border-ink bg-paper-raised px-1 py-0.5">
          {BLOCK_CHOICES.map((c) => (
            <button
              key={c.kind}
              type="button"
              onClick={() => {
                onPick(c.kind)
                setOpen(false)
              }}
              className={`min-h-7 px-2 font-mono text-d11 tracking-widest text-ink-soft hover:bg-ink hover:text-paper ${FOCUS_RING}`}
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

// ── Fresh block factory (auto-rank aware) — verbatim ────────────────────────

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

function BlockCardL({
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
    <header className="flex items-center justify-between gap-2 border-b border-dashed border-ink pb-2">
      <div className="flex min-w-0 items-center gap-2 font-mono text-d11 tracking-widest">
        <KindGlyph kind={block.kind} />
        <span className="text-ink-faint">{String(index + 1).padStart(2, '0')}</span>
        <span className="font-bold text-ink">{labelForKind(block.kind)}</span>
        {block.kind === 'track' && typeof block.rank === 'number' && (
          <span className="bg-ink px-1 py-0.5 font-bold leading-none text-acid">
            #{String(block.rank).padStart(2, '0')}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        {supportsCollapse && (
          <IconBtnL
            onClick={onToggleCollapse}
            aria={collapsed ? 'Expandir' : 'Contraer'}
          >
            {collapsed ? <ChevronsUpDown size={13} /> : <ChevronsDownUp size={13} />}
          </IconBtnL>
        )}
        <IconBtnL onClick={onMoveUp} disabled={!canMoveUp} aria="Subir">
          <ChevronUp size={13} />
        </IconBtnL>
        <IconBtnL onClick={onMoveDown} disabled={!canMoveDown} aria="Bajar">
          <ChevronDown size={13} />
        </IconBtnL>
        <IconBtnL onClick={onRemove} aria="Eliminar" danger>
          <Trash2 size={13} />
        </IconBtnL>
      </div>
    </header>
  )

  // Track collapsed = single-row summary with cover thumb.
  if (effectivelyCollapsed && block.kind === 'track') {
    const embedCount = block.embeds?.length ?? 0
    return (
      <div className="flex flex-col gap-2 border border-ink bg-paper p-3">
        {header}
        <button
          type="button"
          onClick={onToggleCollapse}
          className={`flex min-h-11 items-center gap-3 text-left hover:bg-paper-raised ${FOCUS_RING}`}
        >
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center border border-ink bg-paper-raised"
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
              <Disc3 size={16} className="text-ink-faint" aria-hidden />
            )}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-mono text-d11 tracking-wide text-ink-soft">
              {block.artist || <span className="text-ink-faint">[sin artista]</span>}
            </span>
            <span className="truncate font-syne text-d15 font-extrabold text-ink">
              {block.title || <span className="text-ink-faint">[sin título]</span>}
            </span>
          </div>
          <span className="ml-auto whitespace-nowrap font-mono text-d11 tracking-widest text-ink-faint">
            {embedCount} {embedCount === 1 ? 'fuente' : 'fuentes'}
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 border border-ink bg-paper p-3">
      {header}
      <BlockBodyL block={block} onChange={onChange} autoFocus={isNew} />
    </div>
  )
}

// Small leading glyph per block kind — helps distinguish at a glance.
function KindGlyph({ kind }: { kind: ArticleBlock['kind'] }) {
  if (kind === 'track') return <Disc3 size={12} className="text-ink" aria-hidden />
  if (kind === 'divider') return <Minus size={12} className="text-ink" aria-hidden />
  // lede / p / other text kinds
  return <Type size={12} className="text-ink" aria-hidden />
}

function BlockBodyL({
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
      <AutoFocusTextAreaL
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
      <AutoFocusTextAreaL
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
      <div className="flex items-center gap-3 py-1" aria-hidden>
        <span className="font-mono text-d13 text-ink">⋯</span>
        <div className="h-px flex-1 bg-ink-faint" />
        <span className="font-mono text-d13 text-ink">⋯</span>
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
            className="relative h-[88px] w-[88px] shrink-0 overflow-hidden border border-ink bg-paper-raised"
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
              <div className="flex h-full w-full items-center justify-center text-ink-faint">
                <Disc3 size={22} />
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="grid gap-2 sm:grid-cols-[80px_1fr]">
              <TextFieldL
                label="RANK"
                value={block.rank?.toString() ?? ''}
                onChange={(v) => patch({ rank: v === '' ? undefined : Number(v) })}
                type="number"
                placeholder="—"
                mono
              />
              <AutoFocusTextFieldL
                label="ARTISTA"
                value={block.artist}
                onChange={(v) => patch({ artist: v })}
                placeholder="Nombre del artista"
                autoFocus={autoFocus}
              />
            </div>
            <TextFieldL
              label="TÍTULO"
              value={block.title}
              onChange={(v) => patch({ title: v })}
              placeholder="Título del track"
            />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_2fr]">
          <TextFieldL
            label="AÑO"
            value={block.year?.toString() ?? ''}
            onChange={(v) => patch({ year: v === '' ? undefined : v })}
            placeholder="2026"
            mono
          />
          <TextFieldL
            label="BPM"
            value={block.bpm?.toString() ?? ''}
            onChange={(v) => patch({ bpm: v === '' ? undefined : Number(v) })}
            type="number"
            placeholder="134"
            mono
          />
          <TextFieldL
            label="COVER URL"
            value={block.imageUrl ?? ''}
            onChange={(v) => patch({ imageUrl: v })}
            placeholder="/flyers/… o https://…"
            mono
          />
        </div>

        <TextAreaL
          label="COMENTARIO"
          value={block.commentary ?? ''}
          onChange={(v) => patch({ commentary: v })}
          rows={3}
          placeholder="La toma editorial del track — por qué importa…"
        />

        <div>
          <div className="mb-2">
            <FieldLabelL label="FUENTES (EMBEDS)" />
          </div>
          <EmbedListL
            embeds={block.embeds ?? []}
            onChange={(embeds: MixEmbed[]) => patch({ embeds })}
          />
        </div>
      </div>
    )
  }
  return (
    <p className="font-mono text-d11 text-ink-faint">
      Tipo de bloque no editable en el dashboard v1.
    </p>
  )
}

// ── Auto-focusing variants (pliego chrome) ──────────────────────────────────

function AutoFocusTextFieldL({
  label,
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoFocus?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])
  return (
    <label className="flex flex-col gap-1.5">
      <FieldLabelL label={label} />
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`min-h-11 border border-ink bg-paper-raised px-3 text-d15 text-ink placeholder:text-ink-faint ${FOCUS_RING}`}
      />
    </label>
  )
}

function AutoFocusTextAreaL({
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
    <label className="flex flex-col gap-1.5">
      <FieldLabelL label={label} />
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows ?? 4}
        className={`min-h-11 border border-ink bg-paper-raised px-3 py-2.5 text-d15 leading-relaxed text-ink placeholder:text-ink-faint ${FOCUS_RING}`}
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
      className={`flex h-9 w-9 items-center justify-center border border-ink text-ink disabled:cursor-not-allowed disabled:border-ink-faint disabled:text-ink-faint ${
        danger
          ? 'hover:border-sys-red-paper hover:bg-sys-red-paper hover:text-paper'
          : 'hover:bg-ink hover:text-paper'
      } ${FOCUS_RING}`}
    >
      {children}
    </button>
  )
}
