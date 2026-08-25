'use client'

// ── SlugRow — the quiet mono slug strip under IDENTIDAD ─────────────────────
//
//   🔒 fascinoma-anuncia-line-up-2026        EDITAR SLUG ✎
//
// Read-mode by default (the slug auto-generates from TÍTULO in the form's
// own slug-effect — untouched). «EDITAR SLUG ✎» toggles an inline editable
// input; every keystroke is re-slugified through the SHARED slugify and
// handed to the form via `onEdit`, exactly mirroring the dark TextField
// wiring (`patch({ slug: slugify(v) })` + slugManuallyEdited flag — the
// form owns that flag; this row only reports edits). The 409 re-key path
// is untouched — it lives in lib/drafts.

import { useEffect, useRef, useState } from 'react'
import { Lock, LockOpen } from 'lucide-react'
import { slugify } from '@/components/dashboard/forms/shared/Fields'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'

export function SlugRow({
  slug,
  onEdit,
  placeholder = 'se-genera-del-titulo',
  id,
}: {
  slug: string
  /**
   * Called with the RE-SLUGIFIED manual input on every keystroke. The form
   * must set its `slugManuallyEdited` flag inside this callback (same
   * contract as the dark forms' SLUG TextField onChange).
   */
  onEdit: (slug: string) => void
  placeholder?: string
  /** Checklist scroll-anchor id. */
  id?: string
}) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const LockGlyph = editing ? LockOpen : Lock

  return (
    <div
      id={id}
      className="flex min-h-11 scroll-mt-24 items-center gap-2.5 border border-ink bg-paper px-3"
    >
      <LockGlyph size={12} aria-hidden className="shrink-0 text-ink-faint" />
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={slug}
          onChange={(e) => onEdit(slugify(e.target.value))}
          placeholder={placeholder}
          aria-label="Slug"
          className={`min-w-0 flex-1 self-stretch bg-transparent font-mono text-d13 text-ink placeholder:text-ink-faint ${FOCUS_RING}`}
        />
      ) : (
        <span
          className="min-w-0 flex-1 truncate font-mono text-d13 text-ink"
          title={slug || undefined}
        >
          {slug || <span className="text-ink-faint">{placeholder}</span>}
        </span>
      )}
      <button
        type="button"
        onClick={() => setEditing((e) => !e)}
        className={`relative shrink-0 whitespace-nowrap font-mono text-d11 font-bold uppercase tracking-widest text-ink underline-offset-4 before:absolute before:-inset-x-1 before:-inset-y-3 before:content-[''] hover:underline ${FOCUS_RING}`}
      >
        {editing ? 'LISTO ✓' : 'EDITAR SLUG ✎'}
      </button>
    </div>
  )
}
