'use client'

import { forwardRef, useId, type ReactNode } from 'react'
import styles from './Field.module.css'

interface Wrap {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  counter?: { value: number; max: number }
  className?: string
  required?: boolean
}

function Frame({ id, label, hint, error, counter, className, required, children }: Wrap & { id: string; children: ReactNode }) {
  return (
    <div className={[styles.field, className ?? ''].join(' ')} data-error={error ? true : undefined}>
      {label ? (
        <label htmlFor={id} className={styles.label}>
          {label}
          {required ? <span className={styles.req} aria-hidden="true"> *</span> : null}
          {counter ? (
            <span className={styles.counter} data-over={counter.value > counter.max || undefined}>
              {counter.value}/{counter.max}
            </span>
          ) : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className={styles.hint}>{hint}</p>
      ) : null}
    </div>
  )
}

export const TextField = forwardRef<HTMLInputElement, Wrap & React.InputHTMLAttributes<HTMLInputElement>>(function TextField(
  { label, hint, error, counter, className, required, ...input },
  ref,
) {
  const auto = useId()
  const id = input.id ?? auto
  return (
    <Frame id={id} label={label} hint={hint} error={error} counter={counter} className={className} required={required}>
      <input ref={ref} id={id} className={styles.input} aria-invalid={error ? true : undefined} required={required} {...input} />
    </Frame>
  )
})

export const TextArea = forwardRef<HTMLTextAreaElement, Wrap & React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea(
  { label, hint, error, counter, className, required, ...ta },
  ref,
) {
  const auto = useId()
  const id = ta.id ?? auto
  return (
    <Frame id={id} label={label} hint={hint} error={error} counter={counter} className={className} required={required}>
      <textarea ref={ref} id={id} className={[styles.input, styles.area].join(' ')} aria-invalid={error ? true : undefined} required={required} {...ta} />
    </Frame>
  )
})

export const Select = forwardRef<HTMLSelectElement, Wrap & React.SelectHTMLAttributes<HTMLSelectElement> & { options: Array<{ value: string; label: string }> }>(
  function Select({ label, hint, error, className, required, options, ...sel }, ref) {
    const auto = useId()
    const id = sel.id ?? auto
    return (
      <Frame id={id} label={label} hint={hint} error={error} className={className} required={required}>
        <select ref={ref} id={id} className={[styles.input, styles.select].join(' ')} required={required} {...sel}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Frame>
    )
  },
)

/** A strip of joined boxes (single choice); the chosen one prints inverted. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: ReactNode }>
  label: string
}) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} data-on={value === o.value || undefined} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
