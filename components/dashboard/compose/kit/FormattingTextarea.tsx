'use client'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type TextareaHTMLAttributes } from 'react'
import { Bold, Italic, Link2, X } from 'lucide-react'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'
import { emphasizeSelection, linkSelection, type FormattedEdit, type TextSelection } from '@/lib/composeFormatting'
import { InlineTextPreview } from '@/components/content/InlineEmphasis'

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string; onChange: (value: string, selection?: TextSelection) => void
}
const control = `inline-flex min-h-11 items-center justify-center gap-2 px-3 text-d13 hover:bg-acid ${FOCUS_RING}`

export function FormattingTextarea({ value, onChange, onKeyDown, ...props }: Props) {
  const input = useRef<HTMLTextAreaElement>(null)
  const selection = useRef<TextSelection>({ start: 0, end: 0 })
  const pending = useRef<TextSelection | null>(null)
  const linkInput = useRef<HTMLInputElement>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState(false)
  const helpId = useId()
  const hasFormatting = /\*[^*]+\*|\[[^\]]+\]\(https?:/.test(value)
  useEffect(() => {
    if (!pending.current) return
    input.current?.focus()
    input.current?.setSelectionRange(pending.current.start, pending.current.end)
    selection.current = pending.current
    pending.current = null
  }, [value])
  useEffect(() => { if (props.autoFocus) input.current?.focus() }, [props.autoFocus])
  useEffect(() => { if (linkOpen) linkInput.current?.focus() }, [linkOpen])
  const apply = (edit: FormattedEdit) => {
    pending.current = edit
    onChange(edit.text, edit)
    if (edit.text === value) { input.current?.focus(); input.current?.setSelectionRange(edit.start, edit.end); pending.current = null }
  }
  const openLink = () => {
    setLabel(value.slice(selection.current.start, selection.current.end))
    setUrl(''); setError(false); setLinkOpen(true)
  }
  const closeLink = () => { setLinkOpen(false); input.current?.focus(); input.current?.setSelectionRange(selection.current.start, selection.current.end) }
  const submitLink = () => {
    const edit = linkSelection(value, selection.current, label, url)
    if (!edit) { setError(true); return }
    setLinkOpen(false); apply(edit)
  }
  const shortcut = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && ['b', 'i', 'k'].includes(e.key.toLowerCase())) {
      e.preventDefault(); e.stopPropagation()
      if (e.key.toLowerCase() === 'k') openLink()
      else apply(emphasizeSelection(value, selection.current, e.key.toLowerCase() === 'b' ? '**' : '*'))
      return
    }
    onKeyDown?.(e)
  }
  return <div className="min-w-0 border border-ink/25 bg-paper-raised focus-within:border-ink">
    <div role="group" aria-label="Formato del texto" className="flex flex-wrap items-center gap-x-1 border-b border-ink/20 bg-ink/[0.03] px-1">
      <button type="button" title="Negrita · Ctrl/⌘ B" onMouseDown={(e) => e.preventDefault()} onClick={() => apply(emphasizeSelection(value, selection.current, '**'))} className={control}><Bold size={15} aria-hidden />Negrita</button>
      <button type="button" title="Cursiva · Ctrl/⌘ I" onMouseDown={(e) => e.preventDefault()} onClick={() => apply(emphasizeSelection(value, selection.current, '*'))} className={control}><Italic size={15} aria-hidden />Cursiva</button>
      <button type="button" title="Enlace · Ctrl/⌘ K" aria-expanded={linkOpen} onMouseDown={(e) => e.preventDefault()} onClick={openLink} className={control}><Link2 size={15} aria-hidden />Enlace</button>
    </div>
    {linkOpen && <div role="group" aria-label="Añadir enlace al texto" className="grid gap-3 border-b border-ink/25 bg-paper p-3" onKeyDown={(e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeLink() }
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); submitLink() }
    }}>
      <div className="flex items-center justify-between"><p className="font-bold text-d15">Añadir enlace</p><button type="button" aria-label="Cancelar enlace" onClick={closeLink} className={control}><X size={16} /></button></div>
      <label className="grid gap-1 text-d13">Texto del enlace<input ref={linkInput} value={label} onChange={(e) => setLabel(e.target.value)} className={`min-h-11 border border-ink bg-paper-raised px-3 ${FOCUS_RING}`} /></label>
      <label className="grid gap-1 text-d13">Dirección web<input type="url" value={url} placeholder="https://…" onChange={(e) => setUrl(e.target.value)} className={`min-h-11 border border-ink bg-paper-raised px-3 ${FOCUS_RING}`} /></label>
      {error && <p role="alert" className="text-d13 text-sys-red-paper">Escribe un texto y una dirección que empiece por https:// o http://.</p>}
      <button type="button" onClick={submitLink} className={`${control} w-fit border border-ink bg-acid font-bold`}>Insertar enlace</button>
    </div>}
    <textarea {...props} ref={input} value={value} onChange={(e) => onChange(e.target.value)} onSelect={(e) => { selection.current = { start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd } }} onKeyDown={shortcut} aria-describedby={helpId} />
    {hasFormatting ? <div className="border-t border-ink/20 px-3 py-2"><p id={helpId} className="mb-1 font-mono text-d11 text-ink-soft">ASÍ SE LEERÁ</p><div className="whitespace-pre-wrap break-words text-d15 leading-relaxed"><InlineTextPreview text={value} /></div></div>
      : <p id={helpId} className="px-3 pb-2 text-d11 text-ink-soft">Selecciona una frase para resaltarla o añadir un enlace.</p>}
  </div>
}
