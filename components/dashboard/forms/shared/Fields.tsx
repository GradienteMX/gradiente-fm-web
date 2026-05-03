'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2, ExternalLink, ClipboardPaste } from 'lucide-react'
import type { ContentItem, EmbedPlatform, MixEmbed } from '@/lib/types'
import { GENRES } from '@/lib/genres'
import { vibeToColor, vibeToLabel } from '@/lib/utils'
import { compressAndUploadImage } from '@/lib/imageUpload'
import { useAuth } from '@/components/auth/useAuth'
import {
  PLATFORM_LABELS,
  PLATFORM_ORDER,
  detectPlatform,
} from '@/components/embed/platforms'

// ── Helpers ──────────────────────────────────────────────────────────────────

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)
}

// ── Section wrapper ──────────────────────────────────────────────────────────

export function Section({
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

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  mono,
  type = 'text',
  required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  mono?: boolean
  type?: 'text' | 'number' | 'url' | 'datetime-local'
  required?: boolean
}) {
  const empty = !value
  const showError = required && empty
  return (
    <label className="flex flex-col gap-1">
      <FieldLabel label={label} required={required} />
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-required={required || undefined}
        className={`border bg-black px-3 py-2 ${
          mono ? 'font-mono text-xs' : 'font-grotesk text-sm'
        } text-primary outline-none transition-colors focus:border-sys-orange`}
        style={{ borderColor: showError ? '#E6332940' : '#242424' }}
      />
    </label>
  )
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows,
  required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  required?: boolean
}) {
  const empty = !value
  const showError = required && empty
  return (
    <label className="flex flex-col gap-1">
      <FieldLabel label={label} required={required} />
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows ?? 4}
        aria-required={required || undefined}
        className="border bg-black px-3 py-2 font-grotesk text-sm leading-relaxed text-primary outline-none transition-colors focus:border-sys-orange"
        style={{ borderColor: showError ? '#E6332940' : '#242424' }}
      />
    </label>
  )
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="sys-label">{label}</span>
      {required && (
        <span
          className="font-mono text-[9px] tracking-widest"
          style={{ color: '#E63329' }}
          title="Campo requerido"
          aria-hidden
        >
          *
        </span>
      )}
    </span>
  )
}

export function Toggle({
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

// Two-thumb vibe range picker. Items express a SPAN (vibeMin <= vibeMax) so
// authors can capture wide-band entities (a label, a venue) AND single-point
// ones (a peak-time event at 8-8). See `project_vibe_range_arc` memory.
//
// Three input affordances:
//   - Drag either thumb (mouse + touch + keyboard arrows when focused)
//   - Click a bar in the spectrum strip to collapse the range to that point
//   - Shift+click a bar to extend the nearer edge to it (quick range expand)
export function VibeField({
  valueMin,
  valueMax,
  onChange,
}: {
  valueMin: number
  valueMax: number
  onChange: (min: number, max: number) => void
}) {
  const isPoint = valueMin === valueMax
  const minColor = vibeToColor(valueMin)
  const maxColor = vibeToColor(valueMax)
  const minLabel = vibeToLabel(valueMin)
  const maxLabel = vibeToLabel(valueMax)

  // Background gradient between the two thumbs — fills the active band.
  // 11 stops at every integer keep the discrete bucket colors true; outside
  // [min, max] is muted so the active band reads as the highlight.
  const trackBg = (() => {
    const stops = Array.from({ length: 11 }, (_, i) => {
      const inBand = i >= valueMin && i <= valueMax
      const pct = (i / 10) * 100
      return `${inBand ? vibeToColor(i) : '#242424'} ${pct}%`
    })
    return `linear-gradient(to right, ${stops.join(', ')})`
  })()

  const handleMinDrag = (v: number) => {
    const next = Math.min(v, valueMax)
    onChange(next, valueMax)
  }
  const handleMaxDrag = (v: number) => {
    const next = Math.max(v, valueMin)
    onChange(valueMin, next)
  }

  const handleBarClick = (i: number, shift: boolean) => {
    if (!shift) {
      onChange(i, i)
      return
    }
    // Shift+click: extend nearer edge.
    const distToMin = Math.abs(i - valueMin)
    const distToMax = Math.abs(i - valueMax)
    if (distToMin <= distToMax) onChange(Math.min(i, valueMax), valueMax)
    else onChange(valueMin, Math.max(i, valueMin))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="sys-label">VIBE</span>
        {isPoint ? (
          <span
            className="font-mono text-[11px] tracking-widest"
            style={{ color: minColor }}
          >
            {valueMin} · {minLabel}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 font-mono text-[11px] tracking-widest">
            <span style={{ color: minColor }}>
              {valueMin} {minLabel}
            </span>
            <span className="text-muted">→</span>
            <span style={{ color: maxColor }}>
              {valueMax} {maxLabel}
            </span>
          </span>
        )}
      </div>

      {/* Two-thumb slider. The shared track is rendered behind the inputs;
          both ranges are absolutely overlaid so each thumb stays grabbable.
          Pointer-events on the track itself are off; only the thumbs catch
          input. Browser handles keyboard nav per range. */}
      <div className="relative h-6">
        <div
          className="pointer-events-none absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2"
          style={{ background: trackBg }}
        />
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={valueMin}
          onChange={(e) => handleMinDrag(Number(e.target.value))}
          aria-label="vibe mínimo"
          className="vibe-range-thumb absolute inset-0 h-full w-full appearance-none bg-transparent"
          style={{ accentColor: minColor }}
        />
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={valueMax}
          onChange={(e) => handleMaxDrag(Number(e.target.value))}
          aria-label="vibe máximo"
          className="vibe-range-thumb absolute inset-0 h-full w-full appearance-none bg-transparent"
          style={{ accentColor: maxColor }}
        />
      </div>

      <div className="flex items-end gap-[3px]">
        {Array.from({ length: 11 }).map((_, i) => {
          const inBand = i >= valueMin && i <= valueMax
          return (
            <button
              key={i}
              type="button"
              onClick={(e) => handleBarClick(i, e.shiftKey)}
              className="flex-1 transition-all hover:opacity-80"
              style={{
                height: `${6 + i * 1.5}px`,
                backgroundColor: inBand ? vibeToColor(i) : '#242424',
              }}
              aria-label={`vibe ${i}`}
              title="click: punto · shift+click: extender"
            />
          )
        })}
      </div>
    </div>
  )
}

export function GenreMultiSelect({
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

// ── String list editor (used for tags / artists / etc.) ─────────────────────

export function StringListField({
  label,
  placeholder,
  values,
  onChange,
  addLabel = 'AÑADIR',
  pasteHint = 'Pega una línea por entrada',
}: {
  label: string
  placeholder?: string
  values: string[]
  onChange: (v: string[]) => void
  addLabel?: string
  pasteHint?: string
}) {
  const [focusIndex, setFocusIndex] = useState<number | null>(null)
  const [pasting, setPasting] = useState(false)
  const [pasteBuffer, setPasteBuffer] = useState('')

  const add = () => {
    onChange([...values, ''])
    setFocusIndex(values.length)
  }
  const update = (i: number, v: string) =>
    onChange(values.map((x, idx) => (idx === i ? v : x)))
  const remove = (i: number) =>
    onChange(values.filter((_, idx) => idx !== i))

  // Handle paste on individual row — if user pastes multi-line, split across rows.
  const handleRowPaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    i: number,
  ) => {
    const text = e.clipboardData.getData('text')
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (lines.length <= 1) return // default paste behavior
    e.preventDefault()
    const next = [...values]
    next.splice(i, 1, ...lines)
    onChange(next)
  }

  const applyBulk = () => {
    const lines = pasteBuffer
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length === 0) return
    const trimmedExisting = values.filter((v) => v.trim() !== '')
    onChange([...trimmedExisting, ...lines])
    setPasteBuffer('')
    setPasting(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="sys-label">
          {label} ({values.length})
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
          <span className="font-mono text-[10px] text-muted">{pasteHint}</span>
          <textarea
            value={pasteBuffer}
            onChange={(e) => setPasteBuffer(e.target.value)}
            rows={4}
            className="border bg-black px-2 py-1 font-mono text-xs text-primary outline-none focus:border-sys-orange"
            style={{ borderColor: '#242424' }}
            placeholder={`${placeholder ?? ''}\n${placeholder ?? ''}\n${placeholder ?? ''}`}
          />
          <div className="flex items-center justify-end gap-2">
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
      )}

      {values.map((v, i) => (
        <AutoFocusRow
          key={i}
          value={v}
          shouldFocus={focusIndex === i}
          onFocused={() => setFocusIndex(null)}
          placeholder={placeholder}
          onChange={(next) => update(i, next)}
          onRemove={() => remove(i)}
          onPaste={(e) => handleRowPaste(e, i)}
          onSubmit={() => add()}
        />
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-2 border border-dashed border-border px-3 py-1.5 font-mono text-[10px] tracking-widest text-muted transition-colors hover:border-sys-orange hover:text-sys-orange"
      >
        <Plus size={12} /> {addLabel}
      </button>
    </div>
  )
}

// Row with managed focus — used inside StringListField.
function AutoFocusRow({
  value,
  shouldFocus,
  onFocused,
  placeholder,
  onChange,
  onRemove,
  onPaste,
  onSubmit,
}: {
  value: string
  shouldFocus: boolean
  onFocused: () => void
  placeholder?: string
  onChange: (v: string) => void
  onRemove: () => void
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void
  onSubmit: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (shouldFocus && ref.current) {
      ref.current.focus()
      onFocused()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldFocus])
  return (
    <div className="flex items-center gap-2">
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={onPaste}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onSubmit()
          }
        }}
        placeholder={placeholder}
        className="min-w-0 flex-1 border bg-black px-2 py-1 font-mono text-xs text-primary outline-none focus:border-sys-orange"
        style={{ borderColor: '#242424' }}
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Eliminar"
        className="border border-border p-1 text-muted transition-colors hover:border-sys-red hover:text-sys-red"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

// ── Embeds editor (shared between mix + listicle track blocks) ──────────────

export function EmbedList({
  embeds,
  onChange,
}: {
  embeds: MixEmbed[]
  onChange: (next: MixEmbed[]) => void
}) {
  const [focusIndex, setFocusIndex] = useState<number | null>(null)

  const add = (initialUrl = '') => {
    const platform =
      (initialUrl ? detectPlatform(initialUrl) : null) ?? 'soundcloud'
    onChange([...embeds, { platform, url: initialUrl }])
    setFocusIndex(embeds.length)
  }
  const update = (i: number, patch: Partial<MixEmbed>) =>
    onChange(embeds.map((e, idx) => (idx === i ? { ...e, ...patch } : e)))
  const remove = (i: number) => onChange(embeds.filter((_, idx) => idx !== i))

  // Smart paste: if the pasted text contains multiple URLs (whitespace or
  // newline separated), split them into rows with auto-detected platforms.
  const handlePaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    i: number,
  ) => {
    const text = e.clipboardData.getData('text').trim()
    if (!text) return
    const urls = text
      .split(/[\s\n]+/)
      .map((u) => u.trim())
      .filter((u) => /^https?:\/\//i.test(u))
    if (urls.length <= 1) return // default single-URL paste
    e.preventDefault()
    const next = embeds.slice()
    // First URL replaces the current row; rest append after.
    next[i] = {
      url: urls[0],
      platform: detectPlatform(urls[0]) ?? embeds[i]?.platform ?? 'soundcloud',
    }
    for (const extra of urls.slice(1)) {
      next.push({
        url: extra,
        platform: detectPlatform(extra) ?? 'soundcloud',
      })
    }
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-2">
      {embeds.length === 0 && (
        <p className="font-mono text-[10px] text-muted">
          Sin fuentes. Añade al menos una para habilitar ABRIR FUENTE.
        </p>
      )}
      {embeds.map((e, i) => (
        <EmbedRow
          key={i}
          embed={e}
          shouldFocus={focusIndex === i}
          onFocused={() => setFocusIndex(null)}
          onChange={(patch) => update(i, patch)}
          onRemove={() => remove(i)}
          onPaste={(ev) => handlePaste(ev, i)}
        />
      ))}
      <button
        type="button"
        onClick={() => add()}
        className="flex items-center gap-2 border border-dashed border-border px-3 py-2 font-mono text-[10px] tracking-widest text-muted transition-colors hover:border-sys-orange hover:text-sys-orange"
      >
        <Plus size={12} /> AÑADIR FUENTE
      </button>
      {embeds.length === 0 && (
        <p className="font-mono text-[9px] leading-relaxed text-muted">
          Tip: pega varias URLs separadas por salto de línea y se añaden en
          filas con plataforma auto-detectada.
        </p>
      )}
    </div>
  )
}

function EmbedRow({
  embed,
  shouldFocus,
  onFocused,
  onChange,
  onRemove,
  onPaste,
}: {
  embed: MixEmbed
  shouldFocus: boolean
  onFocused: () => void
  onChange: (patch: Partial<MixEmbed>) => void
  onRemove: () => void
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (shouldFocus && ref.current) {
      ref.current.focus()
      onFocused()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldFocus])

  const detected = embed.url ? detectPlatform(embed.url) : null
  const mismatch = detected && detected !== embed.platform

  return (
    <div className="grid grid-cols-[120px_1fr_auto] gap-2 border border-dashed border-border p-2">
      <select
        value={embed.platform}
        onChange={(ev) =>
          onChange({ platform: ev.target.value as EmbedPlatform })
        }
        className="border bg-black px-2 py-1 font-mono text-[10px] tracking-widest text-primary outline-none focus:border-sys-orange"
        style={{
          borderColor: mismatch ? '#E63329' : '#242424',
          color: mismatch ? '#E63329' : undefined,
        }}
      >
        {PLATFORM_ORDER.map((p) => (
          <option key={p} value={p}>
            {PLATFORM_LABELS[p]}
          </option>
        ))}
      </select>
      <input
        ref={ref}
        type="text"
        value={embed.url}
        onChange={(ev) => {
          const url = ev.target.value
          const det = detectPlatform(url)
          // Live-sync platform to detected value as the user types / pastes —
          // removes friction of manually picking from the dropdown.
          if (det && det !== embed.platform) {
            onChange({ url, platform: det })
          } else {
            onChange({ url })
          }
        }}
        onPaste={onPaste}
        placeholder="https://soundcloud.com/…"
        className="min-w-0 border bg-black px-2 py-1 font-mono text-xs text-primary outline-none focus:border-sys-orange"
        style={{ borderColor: mismatch ? '#E63329' : '#242424' }}
      />
      <div className="flex items-center gap-1">
        {embed.url && (
          <a
            href={embed.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Abrir fuente"
            className="border border-border p-1 text-muted transition-colors hover:text-primary"
          >
            <ExternalLink size={12} />
          </a>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Eliminar fuente"
          className="border border-border p-1 text-muted transition-colors hover:border-sys-red hover:text-sys-red"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

// ── Image URL field with preview + drag-drop / file-picker upload ──────────
//
// Stores the result as a string in `value`. Three input modes:
//   - Type / paste a URL or relative path (existing flow)
//   - Click ELEGIR ARCHIVO → native file picker → reads as data URL
//   - Drag an image onto the field area → reads as data URL
//
// Data URLs work as a string drop-in for `imageUrl` everywhere ContentItem
// is consumed. When the backend lands, the file picker / drop handler will
// upload and store the returned URL instead. The form contract (`value` is
// a string) doesn't change.

export function ImageUrlField({
  label = 'IMAGE URL (cover)',
  value,
  onChange,
  placeholder = '/flyers/rf-001.jpg',
  required,
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [readError, setReadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const { currentUser, openLogin } = useAuth()

  // Compress the picked file in a Web Worker (browser-image-compression)
  // and upload to the `uploads` Supabase Storage bucket. The returned
  // public URL becomes the form value — same string contract as the prior
  // data-URL flow, only it now points at a real CDN object instead of
  // bloating sessionStorage / drafts.item_payload jsonb.
  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setReadError('Solo imágenes (jpg, png, webp, gif).')
      return
    }
    if (!currentUser) {
      setReadError('Necesitas iniciar sesión para subir imágenes.')
      openLogin()
      return
    }
    setReadError(null)
    setUploading(true)
    const res = await compressAndUploadImage(file, currentUser.id)
    setUploading(false)
    if (res.ok) {
      onChange(res.url)
    } else {
      setReadError(res.error)
    }
  }

  const handlePicker = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
    // Reset so picking the same file again still fires onChange.
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void handleFile(file)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!dragOver) setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    // Only clear when leaving the wrapper itself, not its children.
    if (e.currentTarget === e.target) setDragOver(false)
  }

  // Legacy data URLs (drafts authored before storage migration) get a
  // truncated display so the field doesn't render a 30k-char base64 blob.
  // New uploads return public CDN URLs — short, plain text.
  const isDataUrl = value.startsWith('data:')
  const displayValue = isDataUrl
    ? `${value.slice(0, 32)}… [archivo cargado · ${Math.round(
        (value.length * 0.75) / 1024,
      )} KB]`
    : value

  return (
    <div
      className="flex flex-col gap-2"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <FieldLabel label={label} required={required} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <input
          type="text"
          value={displayValue}
          onChange={(e) => {
            // Allow editing only if not a data URL (otherwise typing would
            // corrupt the truncated display). To replace a data URL, use
            // ELEGIR ARCHIVO again or click LIMPIAR.
            if (isDataUrl) return
            onChange(e.target.value)
          }}
          placeholder={placeholder}
          readOnly={isDataUrl}
          aria-required={required || undefined}
          className="min-w-0 flex-1 border bg-black px-3 py-2 font-mono text-xs text-primary outline-none transition-colors focus:border-sys-orange disabled:opacity-60"
          style={{ borderColor: '#242424' }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center justify-center gap-1.5 border border-dashed border-border px-3 py-2 font-mono text-[10px] tracking-widest text-muted transition-colors hover:border-sys-orange hover:text-sys-orange disabled:cursor-default disabled:opacity-60"
        >
          {uploading ? '◌ SUBIENDO…' : '⎘ ELEGIR ARCHIVO'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handlePicker}
          className="hidden"
        />
      </div>

      {/* Drop zone + preview row — always visible; drag-over highlights */}
      <div
        className="flex items-center gap-3 border border-dashed p-2 transition-colors"
        style={{
          borderColor: dragOver ? '#F97316' : '#242424',
          backgroundColor: dragOver ? 'rgba(249,115,22,0.06)' : 'transparent',
        }}
      >
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt=""
              className="h-16 w-16 shrink-0 border border-border bg-elevated object-cover"
              onError={(e) => {
                ;(e.currentTarget as HTMLImageElement).style.display = 'none'
              }}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="font-mono text-[10px] text-muted">
                {dragOver
                  ? 'Suelta para reemplazar'
                  : isDataUrl
                    ? 'Cover cargado en sesión · será reemplazado al subir uno nuevo'
                    : 'Vista previa del cover'}
              </span>
              <button
                type="button"
                onClick={() => onChange('')}
                className="w-fit font-mono text-[10px] tracking-widest text-muted transition-colors hover:text-sys-red"
              >
                [×] LIMPIAR
              </button>
            </div>
          </>
        ) : (
          <span className="font-mono text-[10px] text-muted">
            {dragOver
              ? '→ Suelta el archivo para cargar'
              : 'Arrastra una imagen aquí, o pega URL arriba, o ELEGIR ARCHIVO'}
          </span>
        )}
      </div>

      {readError && (
        <span
          className="font-mono text-[10px] tracking-widest"
          style={{ color: '#E63329' }}
        >
          ⚠ {readError}
        </span>
      )}
    </div>
  )
}

// ── Submit footer ───────────────────────────────────────────────────────────

export type CommitFlash = 'draft' | 'published' | null

export function SubmitFooter({
  canSubmit,
  onSaveDraft,
  onPublish,
  onReset,
  flash,
  lastSavedAt,
  isPublished,
  errors = [],
}: {
  canSubmit: boolean
  onSaveDraft: () => void
  onPublish: () => void
  onReset: () => void
  flash: CommitFlash
  lastSavedAt: number | null
  isPublished?: boolean // already published — surfaces as visual hint
  /**
   * Display labels for required fields that are currently empty. When
   * present, the footer shows a `⚠ FALTA: …` chip explaining why save/publish
   * is disabled. Each form computes this from its own required-field rules.
   */
  errors?: string[]
}) {
  return (
    <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 border border-border bg-base/95 p-3 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-3">
        <SaveIndicator lastSavedAt={lastSavedAt} />
        {flash === 'draft' && (
          <span className="font-mono text-[10px] tracking-widest text-sys-orange">
            ◉ DRAFT GUARDADO
          </span>
        )}
        {flash === 'published' && (
          <span className="font-mono text-[10px] tracking-widest text-sys-green">
            ◉ PUBLICADO EN FEED
          </span>
        )}
        {isPublished && flash !== 'published' && (
          <span className="font-mono text-[10px] tracking-widest text-sys-green/70">
            ● ESTADO: PUBLICADO
          </span>
        )}
        {!canSubmit && errors.length > 0 && (
          <span
            className="inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] tracking-widest"
            style={{
              borderColor: '#E63329',
              color: '#E63329',
              backgroundColor: 'rgba(230,51,41,0.08)',
            }}
            title="Llena estos campos para habilitar guardar / publicar"
          >
            ⚠ FALTA: {errors.join(' · ')}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onReset}
          type="button"
          className="border border-border px-3 py-2 font-mono text-[10px] tracking-widest text-muted transition-colors hover:text-primary"
        >
          RESETEAR
        </button>
        <button
          onClick={onSaveDraft}
          disabled={!canSubmit}
          type="button"
          className="border px-3 py-2 font-mono text-[11px] tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            borderColor: '#888888',
            color: '#888888',
          }}
        >
          ▣ GUARDAR DRAFT
        </button>
        <button
          onClick={onPublish}
          disabled={!canSubmit}
          type="button"
          className="border px-4 py-2 font-mono text-[11px] tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            borderColor: '#F97316',
            color: '#F97316',
            backgroundColor: 'rgba(249,115,22,0.08)',
          }}
        >
          ▶ PUBLICAR
        </button>
      </div>
    </div>
  )
}

// Displays a relative-time autosave indicator. Updates every 5 seconds.
export function SaveIndicator({ lastSavedAt }: { lastSavedAt: number | null }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (lastSavedAt === null) return
    const id = setInterval(() => setTick((t) => t + 1), 5000)
    return () => clearInterval(id)
  }, [lastSavedAt])

  if (lastSavedAt === null) {
    return (
      <span className="font-mono text-[10px] tracking-widest text-muted">
        ◌ AUTOSAVE INACTIVO
      </span>
    )
  }

  const ageSec = Math.max(0, Math.floor((Date.now() - lastSavedAt) / 1000))
  const label =
    ageSec < 5
      ? 'AHORA'
      : ageSec < 60
        ? `HACE ${ageSec}s`
        : ageSec < 3600
          ? `HACE ${Math.floor(ageSec / 60)}m`
          : `HACE ${Math.floor(ageSec / 3600)}h`

  return (
    <span className="font-mono text-[10px] tracking-widest text-muted">
      ◉ AUTOSAVE · {label}
    </span>
  )
}

// Re-exported so forms have a single import surface.
export { upsertItem as commitItem, newItemId } from '@/lib/drafts'

// ── useDraftWorkbench ───────────────────────────────────────────────────────
//
// Owns autosave + commit + reset logic shared across every dashboard form.
// Each form keeps its own draft state + form-specific concerns (slug
// auto-generation, etc.); this hook handles:
//
//   - Hydrating draft + committedId + isPublished from sessionStorage on mount
//   - Persisting on every change (and stamping `lastSavedAt`)
//   - `saveDraft()` and `publish()` that upsert into the shared drafts store
//     under a stable id (generated lazily on first commit)
//   - `reset()` that wipes both the in-progress draft and any committed item
//   - A transient `flash` state for the SubmitFooter confirmation chip

import type { DraftState } from '@/lib/drafts'
import {
  upsertItem as _commitItem,
  newItemId as _newItemId,
  removeItem,
  getItemById,
} from '@/lib/drafts'

interface DraftWorkbenchPersisted<T extends ContentItem> {
  draft: T
  committedId: string | null
  isPublished: boolean
}

export function useDraftWorkbench<T extends ContentItem>({
  draftKey,
  emptyFn,
  draft,
  setDraft,
  editItemId = null,
}: {
  draftKey: string
  emptyFn: () => T
  draft: T
  setDraft: (t: T) => void
  /**
   * If set, on mount the form hydrates from this stored item instead of the
   * per-form local-draft key. Wires the edit-published-or-draft flow — the
   * form pre-populates with the item's data and binds `committedId` to its
   * id, so subsequent saves/publishes UPDATE the same row.
   */
  editItemId?: string | null
}) {
  const [committedId, setCommittedId] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [flash, setFlash] = useState<CommitFlash>(null)
  const [isPublished, setIsPublished] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Hydrate on mount — prefer the editItemId from the URL over local draft.
  useEffect(() => {
    if (editItemId) {
      const existing = getItemById(editItemId)
      if (existing) {
        // Strip the frontend-only flags before slotting into form state.
        const { _draftState, _pendingConfirm, ...clean } = existing
        // Double-cast through `unknown` because TS can't prove the runtime
        // narrowing matches the form's specific T (e.g. MixDraft) — at this
        // point we know the existing item's `type` matches the form.
        setDraft({ ...emptyFn(), ...(clean as unknown as T) })
        setCommittedId(existing.id)
        setIsPublished(existing._draftState === 'published')
        setLastSavedAt(Date.now())
        setHydrated(true)
        return
      }
      // editItemId given but item not found — fall through to local draft
      // (rare; happens if storage was cleared between navigations).
    }
    try {
      const raw = sessionStorage.getItem(draftKey)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<DraftWorkbenchPersisted<T>>
        if (parsed.draft) setDraft({ ...emptyFn(), ...parsed.draft })
        if (parsed.committedId) setCommittedId(parsed.committedId)
        if (parsed.isPublished) setIsPublished(parsed.isPublished)
        if (parsed.draft) setLastSavedAt(Date.now())
      }
    } catch {}
    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Autosave on every change (post-hydration only — avoids overwriting
  // freshly-loaded state with the empty-default snapshot).
  useEffect(() => {
    if (!hydrated) return
    try {
      const payload: DraftWorkbenchPersisted<T> = {
        draft,
        committedId,
        isPublished,
      }
      sessionStorage.setItem(draftKey, JSON.stringify(payload))
      setLastSavedAt(Date.now())
    } catch {}
  }, [draft, committedId, isPublished, hydrated, draftKey])

  const commit = (state: DraftState): string => {
    const id = committedId ?? _newItemId(draft.type)
    const item = { ...draft, id, publishedAt: new Date().toISOString() }
    _commitItem(item, state)
    setCommittedId(id)
    setIsPublished(state === 'published')
    setFlash(state)
    setTimeout(() => setFlash(null), 2500)
    return id
  }

  const saveDraft = () => commit('draft')
  // Reserves the item as a draft and returns its id so the caller can route
  // the editor to the publish-confirmation flow (see [[Publish Confirmation Flow]]).
  // The state transition to 'published' happens only after the editor confirms
  // via [[PublishConfirmOverlay]] — never directly from the form.
  const requestPublish = (): string => {
    const id = commit('draft')
    // Suppress the "DRAFT GUARDADO" flash since the editor pressed PUBLICAR,
    // not SAVE — they shouldn't see a "saved" confirmation chip.
    setFlash(null)
    return id
  }

  const reset = () => {
    // If we already committed an item, drop it from the shared store.
    if (committedId) removeItem(committedId)
    setDraft(emptyFn())
    setCommittedId(null)
    setIsPublished(false)
    setLastSavedAt(null)
    setFlash(null)
    try {
      sessionStorage.removeItem(draftKey)
    } catch {}
  }

  return {
    committedId,
    lastSavedAt,
    flash,
    isPublished,
    saveDraft,
    requestPublish,
    reset,
  }
}
