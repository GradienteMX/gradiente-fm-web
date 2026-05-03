'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useVibe } from '@/context/VibeContext'
import { Plus, Trash2, ClipboardPaste } from 'lucide-react'
import type {
  ContentItem,
  MixStatus,
  MixTrack,
} from '@/lib/types'
import { GENRES } from '@/lib/genres'
import { LivePreview } from '@/components/dashboard/LivePreview'
import { EmbedList, useDraftWorkbench, VibeField } from './shared/Fields'
import { SubmitFooter } from './shared/Fields'
import { PollFieldset } from './shared/PollFieldset'

const DRAFT_KEY = 'gradiente:dashboard:mix-draft'

const MIX_STATUSES: MixStatus[] = ['disponible', 'exclusivo', 'archivo', 'proximamente']
const STATUS_LABEL: Record<MixStatus, string> = {
  disponible: 'Disponible',
  exclusivo: 'Exclusivo',
  archivo: 'Archivo',
  proximamente: 'Próximamente',
}

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)
}

function emptyDraft(): ContentItem {
  return {
    id: 'draft-mix',
    slug: '',
    type: 'mix',
    title: '',
    subtitle: '',
    excerpt: '',
    bodyPreview: '',
    vibeMin: 5, vibeMax: 5,
    genres: [],
    tags: [],
    imageUrl: '',
    publishedAt: new Date().toISOString(),
    author: '',
    duration: '',
    embeds: [],
    tracklist: [],
    mixSeries: '',
    recordedIn: '',
    mixFormat: '',
    bpmRange: '',
    musicalKey: '',
    mixStatus: 'disponible',
    editorial: false,
  }
}

export function MixForm() {
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
    // Clear any active category filter so the editor sees their pending card
    // even if they had the home grid narrowed to a different type.
    setCategoryFilter(null)
    router.push(`/?pending=${id}`)
  }

  // Auto-generate slug from title unless user manually edited it.
  useEffect(() => {
    if (!slugManuallyEdited && draft.title) {
      const next = slugify(draft.title)
      setDraft((d) => (d.slug === next ? d : { ...d, slug: next }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.title, slugManuallyEdited])

  const patch = (p: Partial<ContentItem>) => setDraft((d) => ({ ...d, ...p }))

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
      {/* ── FORM ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-5">
        <Section label="01" title="IDENTIDAD">
          <TextField
            label="TÍTULO"
            value={draft.title}
            onChange={(v) => patch({ title: v })}
            placeholder="ESPECTRO MIX 010"
            required
          />
          <TextField
            label="SUBTÍTULO"
            value={draft.subtitle ?? ''}
            onChange={(v) => patch({ subtitle: v })}
            placeholder="Retrospective Perception"
          />
          <TextField
            label="SLUG"
            value={draft.slug}
            onChange={(v) => {
              setSlugManuallyEdited(true)
              patch({ slug: slugify(v) })
            }}
            placeholder="espectro-mix-010-retrospective-perception"
            mono
            required
          />
          <TextField
            label="ARTISTA / AUTOR"
            value={draft.author ?? ''}
            onChange={(v) => patch({ author: v })}
            placeholder="Siete Catorce"
          />
          <Toggle
            label="EDITORIAL (boostea HP inicial)"
            value={!!draft.editorial}
            onChange={(v) => patch({ editorial: v })}
          />
        </Section>

        <Section label="02" title="COPY">
          <TextArea
            label="EXCERPT (una línea)"
            value={draft.excerpt ?? ''}
            onChange={(v) => patch({ excerpt: v })}
            rows={2}
            placeholder="Una sesión en vivo que explora las fronteras del hard techno…"
          />
          <TextArea
            label="BODY (párrafos separados por línea en blanco)"
            value={draft.bodyPreview ?? ''}
            onChange={(v) => patch({ bodyPreview: v })}
            rows={6}
            placeholder="Espectro Mix 010 es una sesión continua grabada en vivo…"
          />
        </Section>

        <Section label="03" title="VIBE + GÉNEROS">
          <VibeField
            valueMin={draft.vibeMin}
            valueMax={draft.vibeMax}
            onChange={(min, max) => patch({ vibeMin: min, vibeMax: max })}
          />
          <GenreMultiSelect
            value={draft.genres}
            onChange={(genres) => patch({ genres })}
          />
        </Section>

        <Section label="04" title="MEDIA">
          <TextField
            label="IMAGE URL (cover)"
            value={draft.imageUrl ?? ''}
            onChange={(v) => patch({ imageUrl: v })}
            placeholder="/flyers/rf-020.jpg"
            mono
          />
          {draft.imageUrl && (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={draft.imageUrl}
                alt=""
                className="h-16 w-16 border border-border bg-elevated object-cover"
                onError={(e) => {
                  ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                }}
              />
              <span className="font-mono text-[10px] text-muted">
                Vista previa del cover
              </span>
            </div>
          )}
        </Section>

        <Section label="05" title="EMBEDS / FUENTES">
          <EmbedList
            embeds={draft.embeds ?? []}
            onChange={(embeds) => patch({ embeds })}
          />
        </Section>

        <Section label="06" title="CONTEXTO">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label="SERIE"
              value={draft.mixSeries ?? ''}
              onChange={(v) => patch({ mixSeries: v })}
              placeholder="Espectro Mix"
            />
            <TextField
              label="GRABADO EN"
              value={draft.recordedIn ?? ''}
              onChange={(v) => patch({ recordedIn: v })}
              placeholder="CDMX"
            />
            <TextField
              label="FORMATO"
              value={draft.mixFormat ?? ''}
              onChange={(v) => patch({ mixFormat: v })}
              placeholder="DJ Set"
            />
            <TextField
              label="DURACIÓN"
              value={draft.duration ?? ''}
              onChange={(v) => patch({ duration: v })}
              placeholder="1:04:12"
              mono
            />
            <TextField
              label="BPM (rango)"
              value={draft.bpmRange ?? ''}
              onChange={(v) => patch({ bpmRange: v })}
              placeholder="132-140"
              mono
            />
            <TextField
              label="KEY"
              value={draft.musicalKey ?? ''}
              onChange={(v) => patch({ musicalKey: v })}
              placeholder="D#m"
              mono
            />
          </div>
          <StatusField
            value={draft.mixStatus ?? 'disponible'}
            onChange={(v) => patch({ mixStatus: v })}
          />
        </Section>

        <Section label="07" title="TRACKLIST">
          <TrackListEditor
            tracks={draft.tracklist ?? []}
            onChange={(tracklist) => patch({ tracklist })}
          />
        </Section>

        <Section label="08" title="ENCUESTA (opcional)">
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

      {/* ── LIVE PREVIEW ──────────────────────────────────── */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <LivePreview draft={draft} />
      </div>
    </div>
  )
}

// ── Section wrapper ──────────────────────────────────────────────────────────
function Section({
  label,
  title,
  children,
}: {
  label: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3 border border-border bg-surface p-4">
      <header className="flex items-center justify-between border-b border-dashed border-border pb-2">
        <div className="flex items-center gap-2.5 font-mono text-[11px] tracking-widest">
          <span style={{ color: '#F97316' }}>{label}</span>
          <span className="text-primary">{title}</span>
        </div>
        <span
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-sys-green"
          aria-hidden
        />
      </header>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

// ── Fields ───────────────────────────────────────────────────────────────────
function TextField({
  label,
  value,
  onChange,
  placeholder,
  mono,
  // Accepted for parity with the shared Fields.tsx TextField API. The
  // local component doesn't visualize required state today; the prop is
  // here so call sites can express intent without a build error.
  required: _required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  mono?: boolean
  required?: boolean
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="sys-label">{label}</span>
      <input
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

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="sys-label">{label}</span>
      <textarea
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

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-1">
      <button
        type="button"
        onClick={() => onChange(!value)}
        className="relative h-5 w-9 border transition-colors"
        style={{
          borderColor: value ? '#F97316' : '#242424',
          backgroundColor: value ? 'rgba(249,115,22,0.2)' : '#000',
        }}
        aria-pressed={value}
      >
        <span
          className="absolute top-[2px] h-3 w-3 transition-all"
          style={{
            left: value ? 20 : 2,
            backgroundColor: value ? '#F97316' : '#555',
          }}
        />
      </button>
      <span className="font-mono text-[11px] tracking-widest text-secondary">
        {label}
      </span>
    </label>
  )
}

function GenreMultiSelect({
  value,
  onChange,
}: {
  value: string[]
  onChange: (v: string[]) => void
}) {
  const [filter, setFilter] = useState('')
  const selected = new Set(value)
  const filtered = useMemo(
    () =>
      GENRES.filter(
        (g) =>
          !filter ||
          g.name.toLowerCase().includes(filter.toLowerCase()) ||
          g.id.includes(filter.toLowerCase()),
      ),
    [filter],
  )

  const toggle = (id: string) => {
    if (selected.has(id)) {
      onChange(value.filter((v) => v !== id))
    } else {
      onChange([...value, id])
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="sys-label">GÉNEROS ({value.length})</span>
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filtrar géneros…"
        className="border bg-black px-3 py-1.5 font-mono text-xs text-primary outline-none focus:border-sys-orange"
        style={{ borderColor: '#242424' }}
      />
      <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto border border-dashed border-border p-2">
        {filtered.map((g) => {
          const isOn = selected.has(g.id)
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => toggle(g.id)}
              className="border px-2 py-0.5 font-mono text-[10px] tracking-wide transition-colors"
              style={{
                borderColor: isOn ? '#F97316' : '#242424',
                color: isOn ? '#F97316' : '#888',
                backgroundColor: isOn ? 'rgba(249,115,22,0.12)' : 'transparent',
              }}
            >
              {g.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StatusField({
  value,
  onChange,
}: {
  value: MixStatus
  onChange: (v: MixStatus) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="sys-label">ESTATUS</span>
      <div className="flex flex-wrap gap-1.5">
        {MIX_STATUSES.map((s) => {
          const isOn = s === value
          return (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              className="border px-2.5 py-1 font-mono text-[10px] tracking-widest transition-colors"
              style={{
                borderColor: isOn ? '#F97316' : '#242424',
                color: isOn ? '#F97316' : '#888',
                backgroundColor: isOn ? 'rgba(249,115,22,0.12)' : 'transparent',
              }}
            >
              {STATUS_LABEL[s]}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// EmbedList (shared — see components/dashboard/forms/shared/Fields.tsx)
// is imported and used directly. This local copy was removed 2026-04-24
// so the polished version (live platform detection, auto-focus, smart
// multi-URL paste) works in MixForm too.

// ── Tracklist editor ─────────────────────────────────────────────────────────
// Parse a single line like:
//   "01. Perc Trax - Forward Pressure (134)"
//   "Perc Trax — Forward Pressure [134 BPM]"
//   "Perc Trax - Forward Pressure 134"
//   "Perc Trax - Forward Pressure"
// Returns null for blank/comment lines.
function parseTracklistLine(raw: string): MixTrack | null {
  let s = raw.trim()
  if (!s || s.startsWith('#')) return null
  // Strip leading numbering: "01.", "1)", "001 -", "#01 "
  s = s.replace(/^#?\d+[\.\)\-\s]+/, '').trim()
  if (!s) return null

  // BPM extraction — try strict patterns first, then looser trailing number.
  let bpm: number | undefined
  let body = s
  const paren = body.match(/\s*[\(\[](\d{2,3})[\)\]]\s*$/)
  const bpmSuffix = body.match(/\s+(\d{2,3})\s*BPM\s*$/i)
  const trailing = body.match(/\s+(\d{2,3})\s*$/)
  const pick = paren ?? bpmSuffix ?? trailing
  if (pick) {
    const n = parseInt(pick[1], 10)
    // Narrower acceptance for unmarked trailing numbers to reduce false
    // positives like "Summer 85" being read as 85 BPM.
    const minBpm = pick === trailing ? 100 : 50
    const maxBpm = pick === trailing ? 200 : 250
    if (n >= minBpm && n <= maxBpm) {
      bpm = n
      body = body.slice(0, pick.index).trim()
    }
  }

  // Split on dash (regular, em-dash, en-dash) — prefer the FIRST occurrence
  // so titles with dashes in them remain intact as title.
  const dashMatch = body.match(/^(.+?)\s*[—–\-]\s*(.+)$/)
  if (dashMatch) {
    return { artist: dashMatch[1].trim(), title: dashMatch[2].trim(), bpm }
  }
  return { artist: '', title: body, bpm }
}

function TrackListEditor({
  tracks,
  onChange,
}: {
  tracks: MixTrack[]
  onChange: (next: MixTrack[]) => void
}) {
  const [focusIndex, setFocusIndex] = useState<number | null>(null)
  const [pasting, setPasting] = useState(false)
  const [pasteBuffer, setPasteBuffer] = useState('')

  const add = () => {
    onChange([...tracks, { artist: '', title: '' }])
    setFocusIndex(tracks.length)
  }
  const update = (i: number, patch: Partial<MixTrack>) =>
    onChange(tracks.map((t, idx) => (idx === i ? { ...t, ...patch } : t)))
  const remove = (i: number) => onChange(tracks.filter((_, idx) => idx !== i))

  const applyBulk = () => {
    const parsed = pasteBuffer
      .split(/\r?\n/)
      .map(parseTracklistLine)
      .filter((t): t is MixTrack => !!t)
    if (parsed.length === 0) return
    // Drop any empty trailing row then append.
    const trimmedExisting = tracks.filter(
      (t) => t.artist.trim() !== '' || t.title.trim() !== '',
    )
    onChange([...trimmedExisting, ...parsed])
    setPasteBuffer('')
    setPasting(false)
    // Focus last new row so the user can tweak immediately.
    setFocusIndex(trimmedExisting.length + parsed.length - 1)
  }

  // Detect paste on row inputs — if multi-line and looks like a tracklist,
  // defer to bulk parser instead of dumping everything into one cell.
  const handleRowPaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    i: number,
  ) => {
    const text = e.clipboardData.getData('text')
    const lines = text.split(/\r?\n/).filter((l) => l.trim())
    if (lines.length <= 1) return
    e.preventDefault()
    const parsed = lines
      .map(parseTracklistLine)
      .filter((t): t is MixTrack => !!t)
    if (parsed.length === 0) return
    const next = tracks.slice()
    // First parsed track replaces current row; the rest get inserted after.
    next[i] = parsed[0]
    next.splice(i + 1, 0, ...parsed.slice(1))
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Header row w/ paste toggle */}
      <div className="flex items-center justify-between">
        <span className="sys-label">
          TRACKS ({tracks.length})
        </span>
        <button
          type="button"
          onClick={() => setPasting((p) => !p)}
          className="flex items-center gap-1 font-mono text-[10px] tracking-widest text-muted transition-colors hover:text-sys-orange"
        >
          <ClipboardPaste size={10} />
          {pasting ? 'CERRAR PEGAR' : 'PEGAR LISTA'}
        </button>
      </div>

      {pasting && (
        <div className="flex flex-col gap-2 border border-dashed border-border bg-black/30 p-2">
          <span className="font-mono text-[10px] leading-relaxed text-muted">
            Una pista por línea. Reconoce formatos:
            {' '}
            <span className="text-secondary">
              {'"01. Artist - Title (134)"'}
            </span>
            {' · '}
            <span className="text-secondary">
              {'"Artist — Title 134 BPM"'}
            </span>
            {' · '}
            <span className="text-secondary">
              {'"Artist - Title"'}
            </span>
          </span>
          <textarea
            value={pasteBuffer}
            onChange={(e) => setPasteBuffer(e.target.value)}
            rows={6}
            placeholder={`01. Perc Trax - Forward Pressure (134)\n02. Ansome - Systematic Behavior (135)\n03. Phase Fatale - Descent (138)`}
            className="border bg-black px-2 py-1 font-mono text-xs text-primary outline-none focus:border-sys-orange"
            style={{ borderColor: '#242424' }}
          />
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] text-muted">
              {(() => {
                const preview = pasteBuffer
                  .split(/\r?\n/)
                  .map(parseTracklistLine)
                  .filter(Boolean).length
                return preview > 0 ? `${preview} pistas detectadas` : 'sin pistas'
              })()}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setPasteBuffer('')
                  setPasting(false)
                }}
                className="border border-border px-2 py-1 font-mono text-[10px] tracking-widest text-muted transition-colors hover:text-primary"
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={applyBulk}
                disabled={!pasteBuffer.trim()}
                className="border px-2 py-1 font-mono text-[10px] tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  borderColor: '#F97316',
                  color: '#F97316',
                  backgroundColor: 'rgba(249,115,22,0.08)',
                }}
              >
                ▶ IMPORTAR
              </button>
            </div>
          </div>
        </div>
      )}

      {tracks.length === 0 && !pasting && (
        <p className="font-mono text-[10px] text-muted">
          Sin tracklist. Opcional — algunos mixes no la publican.
        </p>
      )}
      {tracks.length > 0 && (
        <div className="grid grid-cols-[28px_1fr_1.4fr_64px_auto] gap-2 border-b border-border pb-1 font-mono text-[9px] tracking-widest text-muted">
          <span>#</span>
          <span>ARTISTA</span>
          <span>TEMA</span>
          <span className="text-right">BPM</span>
          <span />
        </div>
      )}
      {tracks.map((t, i) => (
        <TrackRow
          key={i}
          index={i}
          track={t}
          isLast={i === tracks.length - 1}
          shouldFocus={focusIndex === i}
          onFocused={() => setFocusIndex(null)}
          onChange={(patch) => update(i, patch)}
          onRemove={() => remove(i)}
          onPaste={(e) => handleRowPaste(e, i)}
          onSubmitLast={() => add()}
        />
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-2 border border-dashed border-border px-3 py-2 font-mono text-[10px] tracking-widest text-muted transition-colors hover:border-sys-orange hover:text-sys-orange"
      >
        <Plus size={12} /> AÑADIR TRACK
      </button>
    </div>
  )
}

function TrackRow({
  index,
  track,
  isLast,
  shouldFocus,
  onFocused,
  onChange,
  onRemove,
  onPaste,
  onSubmitLast,
}: {
  index: number
  track: MixTrack
  isLast: boolean
  shouldFocus: boolean
  onFocused: () => void
  onChange: (patch: Partial<MixTrack>) => void
  onRemove: () => void
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void
  onSubmitLast: () => void
}) {
  const artistRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (shouldFocus && artistRef.current) {
      artistRef.current.focus()
      onFocused()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldFocus])

  // Enter in the BPM field of the last row creates a new row and focuses it.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (isLast) onSubmitLast()
    }
  }

  return (
    <div className="grid grid-cols-[28px_1fr_1.4fr_64px_auto] items-center gap-2">
      <span className="font-mono text-[11px] text-muted">
        {String(index + 1).padStart(2, '0')}
      </span>
      <input
        ref={artistRef}
        type="text"
        value={track.artist}
        onChange={(e) => onChange({ artist: e.target.value })}
        onPaste={onPaste}
        onKeyDown={handleKeyDown}
        placeholder="Perc Trax"
        className="min-w-0 border bg-black px-2 py-1 font-mono text-xs text-primary outline-none focus:border-sys-orange"
        style={{ borderColor: '#242424' }}
      />
      <input
        type="text"
        value={track.title}
        onChange={(e) => onChange({ title: e.target.value })}
        onKeyDown={handleKeyDown}
        placeholder="A1 / Forward Pressure"
        className="min-w-0 border bg-black px-2 py-1 font-mono text-xs text-primary outline-none focus:border-sys-orange"
        style={{ borderColor: '#242424' }}
      />
      <input
        type="number"
        value={track.bpm ?? ''}
        onChange={(e) =>
          onChange({
            bpm: e.target.value === '' ? undefined : Number(e.target.value),
          })
        }
        onKeyDown={handleKeyDown}
        placeholder="134"
        className="min-w-0 border bg-black px-2 py-1 text-right font-mono text-xs text-primary outline-none focus:border-sys-orange"
        style={{ borderColor: '#242424' }}
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Eliminar track"
        className="border border-border p-1 text-muted transition-colors hover:border-sys-red hover:text-sys-red"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}
