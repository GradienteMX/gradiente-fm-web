'use client'

/**
 * The formatting textarea. Negrita · Cursiva · Enlace (⌘B ⌘I ⌘K) write the
 * same inline markup the readers understand — `**`, `*`, `[texto](url)` — and
 * «así se leerá» renders it through the real `renderInline`, so what you see
 * under the field is exactly what the reader will set.
 */

import { forwardRef, useCallback, useId, useImperativeHandle, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { Footnote } from '@/lib/types'
import { renderInline } from '@/components/lectura/Prosa'
import { Mark } from '@/components/kit/Glyph'
import { countWords, emphasize, hasMarkup, linkify, type Edit, type Selection } from '../model'
import f from './fields.module.css'

export interface TextoHandle {
  focus: (at?: number) => void
  el: () => HTMLTextAreaElement | null
}

interface Props {
  id?: string
  value: string
  onChange: (v: string) => void
  label: string
  placeholder?: string
  size?: 'body' | 'block' | 'small' | 'lede'
  footnotes?: Footnote[]
  counter?: boolean
  /** Split the preview on blank lines (bodyPreview); blocks are one paragraph. */
  paragraphs?: boolean
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void
  onPasteText?: (text: string, e: React.ClipboardEvent<HTMLTextAreaElement>) => void
  helper?: string
  /** Block mode: borderless at rest, tools float over the focused paragraph. */
  float?: boolean
}

export const Texto = forwardRef<TextoHandle, Props>(function Texto(
  { id, value, onChange, label, placeholder, size = 'body', footnotes, counter, paragraphs, onKeyDown, onPasteText, helper, float },
  ref,
) {
  const area = useRef<HTMLTextAreaElement>(null)
  const sel = useRef<Selection>({ start: 0, end: 0 })
  const pending = useRef<Selection | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkLabel, setLinkLabel] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkError, setLinkError] = useState(false)
  const labelInput = useRef<HTMLInputElement>(null)
  const helpId = useId()

  useImperativeHandle(ref, () => ({
    focus: (at) => {
      const el = area.current
      if (!el) return
      el.focus()
      if (typeof at === 'number') el.setSelectionRange(at, at)
    },
    el: () => area.current,
  }))

  // Put the caret back where the edit left it.
  useLayoutEffect(() => {
    const p = pending.current
    if (!p || !area.current) return
    pending.current = null
    area.current.focus()
    area.current.setSelectionRange(p.start, p.end)
    sel.current = p
  }, [value])

  const track = () => {
    const el = area.current
    if (el) sel.current = { start: el.selectionStart, end: el.selectionEnd }
  }

  const apply = useCallback(
    (edit: Edit) => {
      pending.current = { start: edit.start, end: edit.end }
      if (edit.text === value) {
        area.current?.focus()
        area.current?.setSelectionRange(edit.start, edit.end)
        pending.current = null
        return
      }
      onChange(edit.text)
    },
    [onChange, value],
  )

  const openLink = () => {
    track()
    setLinkLabel(value.slice(sel.current.start, sel.current.end))
    setLinkUrl('')
    setLinkError(false)
    setLinkOpen(true)
    requestAnimationFrame(() => (sel.current.end > sel.current.start ? document.getElementById(`${helpId}-url`) : labelInput.current)?.focus())
  }

  const closeLink = () => {
    setLinkOpen(false)
    area.current?.focus()
    area.current?.setSelectionRange(sel.current.start, sel.current.end)
  }

  const submitLink = () => {
    const edit = linkify(value, sel.current, linkLabel, linkUrl)
    if (!edit) {
      setLinkError(true)
      return
    }
    setLinkOpen(false)
    apply(edit)
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && !e.altKey && ['b', 'i', 'k'].includes(e.key.toLowerCase())) {
      e.preventDefault()
      e.stopPropagation()
      track()
      const k = e.key.toLowerCase()
      if (k === 'k') openLink()
      else apply(emphasize(value, sel.current, k === 'b' ? '**' : '*'))
      return
    }
    onKeyDown?.(e)
  }

  const words = counter ? countWords(value) : 0
  const showReads = hasMarkup(value)
  const paras = paragraphs ? value.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) : [value]

  return (
    <div className={f.editor} data-float={float || undefined}>
      <div className={f.tools} role="toolbar" aria-label={`Formato de ${label.toLowerCase()}`}>
        <button type="button" className={f.tool} title="Negrita · ⌘B" aria-label="Negrita (⌘B)" onMouseDown={(e) => e.preventDefault()} onClick={() => (track(), apply(emphasize(value, sel.current, '**')))}>
          <b aria-hidden="true">B</b> <span className={f.toolLabel}>Negrita</span>
        </button>
        <button type="button" className={f.tool} title="Cursiva · ⌘I" aria-label="Cursiva (⌘I)" onMouseDown={(e) => e.preventDefault()} onClick={() => (track(), apply(emphasize(value, sel.current, '*')))}>
          <i aria-hidden="true">I</i> <span className={f.toolLabel}>Cursiva</span>
        </button>
        <button type="button" className={f.tool} title="Enlace · ⌘K" aria-label="Enlace (⌘K)" aria-expanded={linkOpen} onMouseDown={(e) => e.preventDefault()} onClick={() => (linkOpen ? closeLink() : openLink())}>
          <Mark name="share" size={14} /> <span className={f.toolLabel}>Enlace</span>
        </button>
        {counter ? (
          <span className={f.count}>
            {words.toLocaleString('es-MX')} {words === 1 ? 'palabra' : 'palabras'}
          </span>
        ) : null}
      </div>

      {linkOpen ? (
        <div
          className={f.linkPop}
          role="group"
          aria-label="Añadir enlace al texto"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              closeLink()
            }
            if (e.key === 'Enter') {
              e.preventDefault()
              e.stopPropagation()
              submitLink()
            }
          }}
        >
          <label className={f.stack}>
            <span className={f.label}>Texto del enlace</span>
            <input ref={labelInput} className={f.cell} value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="las palabras que se leen" />
          </label>
          <label className={f.stack}>
            <span className={f.label}>Dirección</span>
            <input id={`${helpId}-url`} className={f.cell} type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" />
          </label>
          <button type="button" className={f.add} onClick={submitLink}>
            Insertar
          </button>
          <button type="button" className={f.textBtn} onClick={closeLink}>
            Cancelar
          </button>
          {linkError ? <p className={f.linkErr}>Escribe el texto y una dirección que empiece por https:// o http://.</p> : null}
        </div>
      ) : null}

      <textarea
        ref={area}
        id={id}
        className={f.area}
        data-size={size}
        value={value}
        placeholder={placeholder}
        aria-label={label}
        aria-describedby={helpId}
        onChange={(e) => onChange(e.target.value)}
        onSelect={track}
        onKeyUp={track}
        onClick={track}
        onKeyDown={onKey}
        onPaste={onPasteText ? (e) => onPasteText(e.clipboardData.getData('text'), e) : undefined}
        rows={size === 'body' ? 10 : 2}
      />

      {showReads ? (
        <div className={f.reads} id={helpId}>
          <span className={f.readsLabel}>Así se leerá</span>
          {paras.map((p, i) => (
            <p key={i}>{renderInline(p, footnotes)}</p>
          ))}
        </div>
      ) : (
        <p className={f.helper} id={helpId}>
          {helper ?? 'Selecciona una frase para resaltarla o enlazarla.'}
        </p>
      )}
    </div>
  )
})
