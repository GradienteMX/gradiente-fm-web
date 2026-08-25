'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, ClipboardPaste } from 'lucide-react'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'

// ── StringListFieldL — pliego fork of forms/shared/Fields.tsx StringListField
//
// The dark original stays byte-untouched. Row-based string list editor
// (tags / artists / etc.) with three input paths, all verbatim:
//   - Add row → auto-focused input; Enter adds the next row
//   - Multi-line paste on a row splits across rows
//   - PEGAR LISTA opens a bulk textarea; IMPORTAR appends one entry per line
// Only the chrome is pliego.

export function StringListFieldL({
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
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
          {label} ({values.length})
        </span>
        <button
          type="button"
          onClick={() => setPasting((p) => !p)}
          className={`flex min-h-11 items-center gap-1.5 px-1 font-mono text-d11 uppercase tracking-widest text-ink underline-offset-4 hover:underline md:min-h-0 ${FOCUS_RING}`}
        >
          <ClipboardPaste size={11} strokeWidth={2} />
          {pasting ? 'CERRAR PEGAR' : 'PEGAR LISTA'}
        </button>
      </div>

      {pasting && (
        <div className="flex flex-col gap-2 border border-dashed border-ink-faint bg-paper-raised p-2">
          <span className="font-mono text-d11 text-ink-faint">{pasteHint}</span>
          <textarea
            value={pasteBuffer}
            onChange={(e) => setPasteBuffer(e.target.value)}
            rows={4}
            className={`border border-ink bg-paper-raised px-2 py-1.5 font-mono text-d13 text-ink placeholder:text-ink-faint ${FOCUS_RING}`}
            placeholder={`${placeholder ?? ''}\n${placeholder ?? ''}\n${placeholder ?? ''}`}
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setPasteBuffer('')
                setPasting(false)
              }}
              className={`flex min-h-11 items-center border border-ink px-3 font-mono text-d11 uppercase tracking-widest text-ink hover:bg-ink hover:text-paper md:min-h-9 ${FOCUS_RING}`}
            >
              CANCELAR
            </button>
            <button
              type="button"
              onClick={applyBulk}
              disabled={!pasteBuffer.trim()}
              className={`flex min-h-11 items-center border border-ink bg-ink px-3 font-mono text-d11 uppercase tracking-widest text-paper hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-40 md:min-h-9 ${FOCUS_RING}`}
            >
              ▶ IMPORTAR
            </button>
          </div>
        </div>
      )}

      {values.map((v, i) => (
        <AutoFocusRowL
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
        className={`flex min-h-11 items-center gap-2 self-start border border-dashed border-ink px-3 font-mono text-d11 uppercase tracking-widest text-ink hover:bg-ink hover:text-paper md:min-h-9 ${FOCUS_RING}`}
      >
        <Plus size={12} strokeWidth={2} /> {addLabel}
      </button>
    </div>
  )
}

// Row with managed focus — used inside StringListFieldL.
function AutoFocusRowL({
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
    <div className="flex items-center gap-1.5">
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
        className={`min-h-11 min-w-0 flex-1 border border-ink bg-paper-raised px-2 font-mono text-d13 text-ink placeholder:text-ink-faint ${FOCUS_RING}`}
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Eliminar"
        className={`flex h-11 w-11 shrink-0 items-center justify-center border border-ink text-ink hover:border-sys-red-paper hover:bg-sys-red-paper hover:text-paper md:h-9 md:w-9 ${FOCUS_RING}`}
      >
        <Trash2 size={13} strokeWidth={2} />
      </button>
    </div>
  )
}
