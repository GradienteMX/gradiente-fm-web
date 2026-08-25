'use client'

// ── MixTracklistEditor — pliego port of MixForm's TrackListEditor ───────────
//
// Logic VERBATIM from components/dashboard/forms/MixForm.tsx (:579-877 —
// untouched, /admin depends): parseTracklistLine, row splice/update/remove,
// bulk-paste panel with live «N pistas detectadas» count, smart multi-line
// row paste, Enter-on-last-row appends. Only the chrome is rebuilt in the
// pliego register (cream ground, ink borders, d-scale mono).

import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, ClipboardPaste } from 'lucide-react'
import type { MixTrack } from '@/lib/types'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'
import { FieldLabelL } from '@/components/dashboard/compose/kit/fields'

// Parse a single line like:
//   "01. Perc Trax - Forward Pressure (134)"
//   "Perc Trax — Forward Pressure [134 BPM]"
//   "Perc Trax - Forward Pressure 134"
//   "Perc Trax - Forward Pressure"
// Returns null for blank/comment lines.
// (Copied verbatim from MixForm.tsx:579 — pure function.)
export function parseTracklistLine(raw: string): MixTrack | null {
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

const CELL_INPUT = `min-h-11 min-w-0 border border-ink bg-paper-raised px-2 font-mono text-d13 text-ink placeholder:text-ink-faint ${FOCUS_RING}`

export function MixTracklistEditor({
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

  const detectedCount = pasteBuffer
    .split(/\r?\n/)
    .map(parseTracklistLine)
    .filter(Boolean).length

  return (
    <div className="flex flex-col gap-2">
      {/* Header row w/ paste toggle */}
      <div className="flex items-center justify-between gap-3">
        <FieldLabelL label={`TRACKS (${tracks.length})`} />
        <button
          type="button"
          onClick={() => setPasting((p) => !p)}
          className={`flex min-h-11 items-center gap-1.5 whitespace-nowrap font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft underline-offset-4 hover:underline md:min-h-9 ${FOCUS_RING}`}
        >
          <ClipboardPaste size={12} aria-hidden />
          {pasting ? 'CERRAR PEGAR' : 'PEGAR LISTA'}
        </button>
      </div>

      {pasting && (
        <div className="flex flex-col gap-2 border border-dashed border-ink bg-paper p-3">
          <span className="font-mono text-d11 leading-relaxed text-ink-faint">
            Una pista por línea. Reconoce formatos:{' '}
            <span className="text-ink-soft">{'"01. Artist - Title (134)"'}</span>
            {' · '}
            <span className="text-ink-soft">{'"Artist — Title 134 BPM"'}</span>
            {' · '}
            <span className="text-ink-soft">{'"Artist - Title"'}</span>
          </span>
          <textarea
            value={pasteBuffer}
            onChange={(e) => setPasteBuffer(e.target.value)}
            rows={6}
            placeholder={`01. Artista - Título (134)\n02. Artista - Título (135)\n03. Artista - Título (138)`}
            aria-label="Tracklist para importar"
            className={`min-h-11 border border-ink bg-paper-raised px-2 py-1.5 font-mono text-d13 text-ink placeholder:text-ink-faint ${FOCUS_RING}`}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className="font-mono text-d11 tabular-nums text-ink-faint"
              aria-live="polite"
            >
              {detectedCount > 0 ? `${detectedCount} pistas detectadas` : 'sin pistas'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setPasteBuffer('')
                  setPasting(false)
                }}
                className={`min-h-11 border border-ink px-3 font-mono text-d11 tracking-widest text-ink hover:bg-ink hover:text-paper md:min-h-9 ${FOCUS_RING}`}
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={applyBulk}
                disabled={!pasteBuffer.trim()}
                className={`min-h-11 border border-ink bg-acid px-3 font-mono text-d11 font-bold tracking-widest text-ink hover:bg-ink hover:text-acid disabled:cursor-not-allowed disabled:border-ink-faint disabled:bg-paper-raised disabled:text-ink-faint md:min-h-9 ${FOCUS_RING}`}
              >
                ▶ IMPORTAR
              </button>
            </div>
          </div>
        </div>
      )}

      {tracks.length === 0 && !pasting && (
        <p className="font-mono text-d11 text-ink-faint">
          Sin tracklist. Opcional — algunos mixes no la publican.
        </p>
      )}
      {tracks.length > 0 && (
        <div className="grid grid-cols-[28px_1fr_1.4fr_64px_auto] gap-2 border-b border-ink pb-1 font-mono text-d11 tracking-widest text-ink-faint">
          <span>#</span>
          <span>ARTISTA</span>
          <span>TEMA</span>
          <span className="text-right">BPM</span>
          <span />
        </div>
      )}
      {tracks.map((t, i) => (
        <TrackRowL
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
        className={`flex min-h-11 items-center gap-2 self-start border border-dashed border-ink px-3 font-mono text-d11 uppercase tracking-widest text-ink hover:bg-ink hover:text-paper md:min-h-9 ${FOCUS_RING}`}
      >
        <Plus size={12} aria-hidden /> AÑADIR TRACK
      </button>
    </div>
  )
}

function TrackRowL({
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

  // Enter in any field of the last row creates a new row and focuses it.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (isLast) onSubmitLast()
    }
  }

  return (
    <div className="grid grid-cols-[28px_1fr_1.4fr_64px_auto] items-center gap-2">
      <span className="font-mono text-d11 tabular-nums text-ink-faint">
        {String(index + 1).padStart(2, '0')}
      </span>
      <input
        ref={artistRef}
        type="text"
        value={track.artist}
        onChange={(e) => onChange({ artist: e.target.value })}
        onPaste={onPaste}
        onKeyDown={handleKeyDown}
        placeholder="Nombre del artista"
        aria-label={`Artista de la pista ${index + 1}`}
        className={CELL_INPUT}
      />
      <input
        type="text"
        value={track.title}
        onChange={(e) => onChange({ title: e.target.value })}
        onKeyDown={handleKeyDown}
        placeholder="Título del track"
        aria-label={`Tema de la pista ${index + 1}`}
        className={CELL_INPUT}
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
        aria-label={`BPM de la pista ${index + 1}`}
        className={`${CELL_INPUT} text-right`}
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Eliminar track"
        className={`flex h-11 w-11 items-center justify-center border border-ink text-ink hover:border-sys-red-paper hover:bg-sys-red-paper hover:text-paper md:h-9 md:w-9 ${FOCUS_RING}`}
      >
        <Trash2 size={13} aria-hidden />
      </button>
    </div>
  )
}
