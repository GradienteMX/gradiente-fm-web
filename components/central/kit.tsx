'use client'

/**
 * CENTRAL — instrument primitives. Hairlines, tabular numerals, sparklines.
 * Ink carries everything; hue appears only where energy is meant (a piece's
 * band, its plate when it has no art, its cell in the maqueta).
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { ContentItem } from '@/lib/types'
import { effectiveBand, VIBE_NAMES, bandLabel } from '@/lib/vibe'
import { FormatGlyph } from '@/components/kit/Glyph'
import { useUI } from '@/lib/store/ui'
import s from './kit.module.css'

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/** One energy as its palette token (`var(--eN)`), so a palette change carries it. */
export function energyVar(e: number): string {
  return `var(--e${Math.max(0, Math.min(10, Math.round(e)))})`
}

/** Ink that reads on an energy ground: paper on the two coldest stops, ink above. */
export function energyOnVar(e: number): string {
  return Math.round(e) <= 1 ? 'var(--paper, var(--obs-0))' : 'var(--ink)'
}

/** A band as token stops: flat for one stop, a hard-edged run of stops for a span. */
export function bandVar(min: number, max: number, dir = '90deg'): string {
  const a = Math.max(0, Math.min(10, Math.round(min)))
  const b = Math.max(a, Math.min(10, Math.round(max)))
  if (a === b) return energyVar(a)
  const n = b - a + 1
  const stops: string[] = []
  for (let k = 0; k < n; k++) stops.push(`var(--e${a + k}) ${((k / n) * 100).toFixed(2)}% ${(((k + 1) / n) * 100).toFixed(2)}%`)
  return `linear-gradient(${dir}, ${stops.join(', ')})`
}

// ── Pane ────────────────────────────────────────────────────────────────────

export function Pane({
  n,
  title,
  note,
  actions,
  children,
  flush,
  className,
  id,
}: {
  /** Index printed before the title («01 / FLUJO DE VIDA»). */
  n?: string
  title: ReactNode
  note?: ReactNode
  actions?: ReactNode
  children: ReactNode
  flush?: boolean
  className?: string
  id?: string
}) {
  const hid = useId()
  return (
    <section className={cx(s.pane, className)} aria-labelledby={hid} id={id}>
      <header className={s.paneHead}>
        <h2 id={hid} className={s.paneTitle}>
          {n ? <span className={s.paneN}>{n} / </span> : null}
          {title}
        </h2>
        {note ? <span className={s.paneNote}>{note}</span> : null}
        {actions ? <div className={s.paneActions}>{actions}</div> : null}
      </header>
      <div className={flush ? s.paneFlush : s.paneBody}>{children}</div>
    </section>
  )
}

// ── Stats ───────────────────────────────────────────────────────────────────

export function StatStrip({ children, cols = 5 }: { children: ReactNode; cols?: number }) {
  return (
    <div className={s.stats} style={{ ['--cols' as string]: cols }}>
      {children}
    </div>
  )
}

export function Stat({ label, value, sub, dim, title }: { label: ReactNode; value: ReactNode; sub?: ReactNode; dim?: boolean; title?: string }) {
  return (
    <div className={s.stat} title={title}>
      <span className={s.statLabel}>{label}</span>
      <span className={cx(s.statValue, dim && s.statDim)}>{value}</span>
      {sub ? <span className={s.statSub}>{sub}</span> : null}
    </div>
  )
}

/** A margin note: what the numbers can and cannot say, in one breath. */
export function Note({ children, tone }: { children: ReactNode; tone?: 'plain' | 'warn' }) {
  return <p className={cx(s.note, tone === 'warn' && s.noteWarn)}>{children}</p>
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className={s.emptyLine}>{children}</p>
}

// ── Sparkline ───────────────────────────────────────────────────────────────

export function Spark({
  points,
  floor,
  from,
  to,
  width = 116,
  height = 30,
  label,
  big,
}: {
  points: Array<[number, number]>
  /** Lower-bound segment before knowledge starts (dashed, never joined). */
  floor?: Array<[number, number]>
  from: number
  to: number
  width?: number
  height?: number
  label: string
  big?: boolean
}) {
  const pad = big ? 4 : 2.5
  if (points.length < 2) {
    return (
      <svg className={s.spark} width={width} height={height} role="img" aria-label={`${label}: sin trayectoria conocida en la ventana`}>
        <line x1={0} x2={width} y1={height - pad} y2={height - pad} className={s.sparkBase} strokeDasharray="2 3" />
      </svg>
    )
  }
  let max = 0
  for (const [, v] of points) if (v > max) max = v
  if (floor) for (const [, v] of floor) if (v > max) max = v
  if (max <= 0) max = 1
  const span = Math.max(1, to - from)
  const X = (t: number) => ((t - from) / span) * (width - pad * 2) + pad
  const Y = (v: number) => height - pad - (v / max) * (height - pad * 2)
  const path = (pts: Array<[number, number]>) => pts.map(([t, v], i) => `${i ? 'L' : 'M'}${X(t).toFixed(2)} ${Y(v).toFixed(2)}`).join('')
  const d = path(points)
  const x0 = X(points[0][0])
  const x1 = X(points[points.length - 1][0])
  const area = `${d}L${x1.toFixed(2)} ${height - pad}L${x0.toFixed(2)} ${height - pad}Z`
  const last = points[points.length - 1]
  const startsLate = points[0][0] - from > span * 0.02
  return (
    <svg className={cx(s.spark, big && s.sparkBig)} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} className={s.sparkBase} />
      {floor && floor.length > 1 ? <path d={path(floor)} className={s.sparkFloor} /> : null}
      {startsLate ? <line x1={x0} x2={x0} y1={pad} y2={height - pad} className={s.sparkKnown} /> : null}
      <path d={area} className={s.sparkArea} />
      <path d={d} className={s.sparkLine} />
      <circle cx={X(last[0])} cy={Y(last[1])} r={big ? 2.8 : 2} className={s.sparkDot} />
    </svg>
  )
}

// ── Thumb (art, or the piece's energy plate) ────────────────────────────────

export function Thumb({ item, size = 40, height, src }: { item: ContentItem; size?: number; height?: number; src?: string | null }) {
  const url = src === undefined ? item.imageUrl : src ?? undefined
  const band = effectiveBand(item)
  const h = height ?? size
  if (!url) {
    return (
      <span className={s.plate} style={{ width: size, height: h, background: energyVar((band.min + band.max) / 2), color: energyOnVar((band.min + band.max) / 2) }} title="Sin arte: placa de energía">
        <FormatGlyph type={item.type} size={Math.round(Math.min(size, h) * 0.42)} />
      </span>
    )
  }
  return (
    <span className={s.thumb} style={{ width: size, height: h }}>
      <Image src={url} alt="" fill sizes={`${Math.max(48, Math.max(size, h) * 2)}px`} />
    </span>
  )
}

/** The piece's energy band as a thin stripe — hue used only because it means energy. */
export function BandLine({ item, width = 44 }: { item: ContentItem; width?: number }) {
  const b = effectiveBand(item)
  return <span className={s.bandLine} style={{ width, background: bandVar(b.min, b.max) }} title={`${bandLabel(b.min, b.max)} · ${b.source === 'comunidad' ? 'banda de la comunidad' : 'banda del autor'}`} />
}

// ── Controls ────────────────────────────────────────────────────────────────

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: ReactNode
  hint?: ReactNode
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className={s.toggleRow}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={hint ? id : undefined}
        disabled={disabled}
        className={s.toggle}
        data-on={checked || undefined}
        onClick={() => onChange(!checked)}
      >
        <span className={s.track} aria-hidden="true">
          <span className={s.knob} />
        </span>
        <span className={s.toggleLabel}>{label}</span>
      </button>
      {hint ? (
        <span id={id} className={s.toggleHint}>
          {hint}
        </span>
      ) : null}
    </div>
  )
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function CopyButton({ text, label = 'Copiar', done = 'Copiado', className }: { text: string; label?: string; done?: string; className?: string }) {
  const [ok, setOk] = useState(false)
  const notify = useUI((st) => st.notify)
  const t = useRef<number | null>(null)
  useEffect(() => () => void (t.current && window.clearTimeout(t.current)), [])
  return (
    <button
      type="button"
      className={cx(s.copy, className)}
      onClick={async () => {
        const good = await copyText(text)
        if (!good) {
          notify(`No se pudo copiar. Cópialo a mano: ${text}`, { tone: 'error' })
          return
        }
        setOk(true)
        if (t.current) window.clearTimeout(t.current)
        t.current = window.setTimeout(() => setOk(false), 1600)
      }}
      aria-label={`${label}: ${text}`}
    >
      {ok ? done : label}
    </button>
  )
}

/**
 * Type-to-confirm, in place. The last step of an irreversible act (after the
 * hold): the phrase is shown as it must be typed; case and accents are not a
 * test of attention, the typing is. Lives inline rather than in a dialog so
 * the confirmation stays next to the thing it destroys.
 */
export function ConfirmPhrase({
  phrase,
  consequence,
  confirmLabel = 'Borrar para siempre',
  onConfirm,
  onCancel,
}: {
  phrase: string
  consequence: ReactNode
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const [v, setV] = useState('')
  const id = useId()
  const norm = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase().replace(/\s+/g, ' ')
  const ok = norm(v) === norm(phrase)
  return (
    <div className={s.confirmWrap}>
    <form
      className={s.confirm}
      role="group"
      aria-labelledby={`${id}-l`}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (ok) onConfirm()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onCancel()
        }
      }}
    >
      <p className={s.confirmText}>{consequence}</p>
      <label id={`${id}-l`} htmlFor={id} className={s.fieldLabel}>
        Escribe «{phrase}» para confirmar
      </label>
      <input id={id} className={s.input} value={v} onChange={(e) => setV(e.target.value)} autoFocus autoComplete="off" spellCheck={false} />
      <div className={s.confirmActions}>
        <button type="submit" className={s.confirmGo} disabled={!ok}>
          {confirmLabel}
        </button>
        <button type="button" className={s.confirmCancel} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
    </div>
  )
}

/** Two-click arming for small destructive acts: first click arms, second commits. */
export function useArm(ms = 3000) {
  const [armed, setArmed] = useState<string | null>(null)
  const timer = useRef<number | null>(null)
  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), [])
  const arm = useCallback(
    (id: string): boolean => {
      if (armed === id) {
        setArmed(null)
        if (timer.current) window.clearTimeout(timer.current)
        return true
      }
      setArmed(id)
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setArmed(null), ms)
      return false
    },
    [armed, ms],
  )
  return { armed, arm }
}

/** Energy band as two named stops — precise, keyboardable, previewed. */
export function EnergyPair({ min, max, onChange, idPrefix }: { min: number; max: number; onChange: (min: number, max: number) => void; idPrefix: string }) {
  const opts = VIBE_NAMES.map((n, i) => ({ value: String(i), label: `${i} · ${n}` }))
  return (
    <div className={s.energyPair}>
      <label className={s.fieldLabel} htmlFor={`${idPrefix}-min`}>
        Energía
      </label>
      <div className={s.energyRow}>
        <select
          id={`${idPrefix}-min`}
          className={s.select}
          value={String(min)}
          aria-label="Energía mínima"
          onChange={(e) => {
            const v = Number(e.target.value)
            onChange(v, Math.max(v, max))
          }}
        >
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className={s.energyArrow} aria-hidden="true">
          →
        </span>
        <select
          className={s.select}
          value={String(max)}
          aria-label="Energía máxima"
          onChange={(e) => {
            const v = Number(e.target.value)
            onChange(Math.min(min, v), v)
          }}
        >
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <span className={s.energyPreview} style={{ background: bandVar(min, max) }} aria-hidden="true" />
    </div>
  )
}

/** Plain labelled input in the console register (denser than the kit field). */
export function Field({
  label,
  hint,
  children,
  htmlFor,
  wide,
  error,
}: {
  label: ReactNode
  hint?: ReactNode
  children: ReactNode
  htmlFor?: string
  wide?: boolean
  error?: ReactNode
}) {
  return (
    <div className={cx(s.field, wide && s.fieldWide)}>
      <label className={s.fieldLabel} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <span className={s.fieldError} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className={s.fieldHint}>{hint}</span>
      ) : null}
    </div>
  )
}

export const inputClass = s.input
export const selectClass = s.select
export const textareaClass = cx(s.input, s.textarea)

/** Numbered step head (01 · DESTINATARIO) for multi-part forms. */
export function Step({ n, title, children, hint }: { n: string; title: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <fieldset className={s.step}>
      <legend className={s.stepHead}>
        <span className={s.stepN}>{n}</span>
        <span className={s.stepTitle}>{title}</span>
      </legend>
      {hint ? <p className={s.stepHint}>{hint}</p> : null}
      <div className={s.stepBody}>{children}</div>
    </fieldset>
  )
}

/** Sub-tabs inside a space (INVITACIONES · ESPERA, ABIERTOS · RESUELTOS…). */
export function SubTabs<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: string; count?: number }>
  label: string
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  return (
    <div className={s.subtabs} role="tablist" aria-label={label}>
      {options.map((o, i) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            className={s.subtab}
            data-on={on || undefined}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
              if (!dir) return
              e.preventDefault()
              const n = (i + dir + options.length) % options.length
              onChange(options[n].value)
              refs.current[n]?.focus()
            }}
          >
            {o.label}
            {o.count !== undefined ? <span className={s.subtabCount}>{o.count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

export const tableClass = s.table
export const numClass = s.num
export const tableWrapClass = s.tableWrap
export const tagClass = s.tag
export const mutedClass = s.muted
export { s as kitStyles }
