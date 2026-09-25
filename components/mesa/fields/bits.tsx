'use client'

/** Small pieces every field shares: the numbered section, switches, chips. */

import { forwardRef, type ReactNode } from 'react'
import { Mark } from '@/components/kit/Glyph'
import type { PlannedSection } from '../model'
import f from './fields.module.css'

export function Seccion({ def, need, hint, children }: { def: PlannedSection; need?: boolean; hint?: ReactNode; children: ReactNode }) {
  return (
    <section id={`mesa-s-${def.key}`} className={f.seccion} data-sec={def.key} aria-labelledby={`mesa-h-${def.key}`}>
      <header className={f.head}>
        <span className={f.num} aria-hidden="true">
          {def.num}
        </span>
        <h2 id={`mesa-h-${def.key}`} className={f.title}>
          {def.label}
        </h2>
        {def.optional ? (
          <span className={f.tagOpt}>opcional</span>
        ) : need ? (
          <span className={f.tagNeed}>
            necesario<span className="sr-only"> para publicar</span>
          </span>
        ) : null}
      </header>
      {hint ? <p className={f.hint}>{hint}</p> : null}
      <div className={f.body}>{children}</div>
    </section>
  )
}

export function Switch({ on, onChange, label, hint, id }: { on: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode; id?: string }) {
  return (
    <button id={id} type="button" role="switch" aria-checked={on} className={f.switch} onClick={() => onChange(!on)}>
      <span className={f.switchText}>
        <span className={f.switchLabel}>{label}</span>
        {hint ? <span className={f.switchHint}>{hint}</span> : null}
      </span>
      <span className={f.track} aria-hidden="true">
        <span className={f.knob} />
      </span>
    </button>
  )
}

export function Chip({ children, onRemove, kind }: { children: ReactNode; onRemove: () => void; kind?: string }) {
  const name = typeof children === 'string' ? children : 'elemento'
  return (
    <span className={f.chip}>
      {kind ? <small>{kind}</small> : null}
      {children}
      <button type="button" className={f.chipX} onClick={onRemove} aria-label={`Quitar ${name}`}>
        <Mark name="close" size={11} />
      </button>
    </span>
  )
}

export function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" className={f.iconBtn} onClick={onClick} disabled={disabled} aria-label={label} title={label}>
      {children}
    </button>
  )
}

export const Add = forwardRef<HTMLButtonElement, { children: ReactNode; onClick: () => void; id?: string }>(function Add({ children, onClick, id }, ref) {
  return (
    <button ref={ref} id={id} type="button" className={f.add} onClick={onClick}>
      <Mark name="plus" size={13} />
      {children}
    </button>
  )
})

export const Search = forwardRef<
  HTMLInputElement,
  { id?: string; value: string; onChange: (v: string) => void; placeholder: string; label: string; onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void; keyHint?: string }
>(function Search({ id, value, onChange, placeholder, label, onKeyDown, keyHint }, ref) {
  return (
    <div className={f.search}>
      <span className={f.searchIcon}>
        <Mark name="search" size={14} />
      </span>
      <input
        ref={ref}
        id={id}
        type="text"
        className={f.searchInput}
        value={value}
        placeholder={placeholder}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        autoComplete="off"
        spellCheck={false}
      />
      {keyHint && value ? <span className={f.searchKey}>{keyHint}</span> : null}
    </div>
  )
})

/** Wraps the part of `text` that matches `q` (accent-insensitive) in <mark>. */
export function Highlight({ text, q }: { text: string; q: string }) {
  const n = fold(q.trim())
  if (!n) return <>{text}</>
  const hay = fold(text)
  const i = hay.indexOf(n)
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + n.length)}</mark>
      {text.slice(i + n.length)}
    </>
  )
}

export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
