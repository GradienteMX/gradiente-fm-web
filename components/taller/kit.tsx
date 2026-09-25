'use client'

/**
 * The desk's own small instruments: hairline panels, latches and sub-tabs
 * with real keyboard behavior, proportion rows (shape, never weights), a
 * sparkline without axes, margin notes, and honest empty lines.
 */

import Link from 'next/link'
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { NUM0 } from './logic'
import styles from './kit.module.css'

// ── Panel ───────────────────────────────────────────────────────────────────

export function Panel({
  label,
  index,
  meta,
  actions,
  children,
  className,
  flush,
  area,
}: {
  label: ReactNode
  /** Indexical number printed before the label («03 / ACTIVIDAD»). */
  index?: string
  meta?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  /** Body touches the panel edges (lists that draw their own hairlines). */
  flush?: boolean
  /** Mobile interleave order (desktop keeps the two-column desk). */
  area?: string
}) {
  const hid = useId()
  return (
    <section className={[styles.panel, className ?? ''].join(' ')} aria-labelledby={hid} data-rise="" data-area={area} data-flush={flush || undefined}>
      <header className={styles.head}>
        <h2 id={hid} className={styles.label}>
          {index ? (
            <span className={styles.index} aria-hidden="true">
              {index} /{' '}
            </span>
          ) : null}
          {label}
        </h2>
        {meta !== undefined && meta !== null && meta !== false ? <span className={styles.meta}>{meta}</span> : null}
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  )
}

// ── roving focus (latches and tabs share it) ────────────────────────────────

function useRoving<T extends string>(values: readonly T[], onChange: (v: T) => void, vertical: boolean) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = values.length
    let j = -1
    if (e.key === 'ArrowRight' || (vertical && e.key === 'ArrowDown')) j = (i + 1) % n
    else if (e.key === 'ArrowLeft' || (vertical && e.key === 'ArrowUp')) j = (i - 1 + n) % n
    else if (e.key === 'Home') j = 0
    else if (e.key === 'End') j = n - 1
    if (j < 0) return
    e.preventDefault()
    refs.current[j]?.focus()
    onChange(values[j])
  }
  return { refs, onKeyDown }
}

/** Single choice among a few (window, collection, status). A radiogroup. */
export function Latch<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
}: {
  value: T
  options: ReadonlyArray<{ value: T; label: ReactNode; hint?: string }>
  onChange: (v: T) => void
  label: string
  size?: 'sm' | 'md'
}) {
  const { refs, onKeyDown } = useRoving(
    options.map((o) => o.value),
    onChange,
    true,
  )
  return (
    <div className={styles.latch} data-size={size} role="radiogroup" aria-label={label}>
      {options.map((o, i) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            data-on={on || undefined}
            title={o.hint}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Views inside a space (PRESENCIA · OBRA, CATÁLOGO · OFERTAS · AJUSTES). */
export function SubTabs<T extends string>({
  value,
  tabs,
  onChange,
  label,
  idBase,
}: {
  value: T
  tabs: ReadonlyArray<{ value: T; label: ReactNode }>
  onChange: (v: T) => void
  label: string
  /** Tabs get `${idBase}-tab-${value}`, the panel `${idBase}-panel`. */
  idBase: string
}) {
  const { refs, onKeyDown } = useRoving(
    tabs.map((t) => t.value),
    onChange,
    false,
  )
  return (
    <div className={styles.subtabs} role="tablist" aria-label={label}>
      {tabs.map((t, i) => {
        const on = t.value === value
        return (
          <button
            key={t.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            id={`${idBase}-tab-${t.value}`}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={`${idBase}-panel`}
            tabIndex={on ? 0 : -1}
            data-on={on || undefined}
            onClick={() => onChange(t.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

export function SubPanel({ idBase, value, children }: { idBase: string; value: string; children: ReactNode }) {
  return (
    <div id={`${idBase}-panel`} role="tabpanel" aria-labelledby={`${idBase}-tab-${value}`} className={styles.subpanel}>
      {children}
    </div>
  )
}

// ── proportions ─────────────────────────────────────────────────────────────

/**
 * One row of shape: what, how many times, and what share of the whole it
 * was. Never a weight, never a multiplier. A count we cannot know prints
 * «—», never 0.
 */
export function ShareRow({ label, count, share, index = 0, note }: { label: ReactNode; count: number | null; share: number; index?: number; note?: string }) {
  const pct = Math.max(0, Math.min(100, share))
  const empty = !count && pct === 0
  const pctText = pct === 0 ? '—' : pct < 1 ? '<1 %' : `${Math.round(pct)} %`
  return (
    <li className={styles.share} data-empty={empty || undefined} style={{ ['--i' as string]: index }}>
      <span className={styles.shareLabel}>
        {label}
        {note ? <span className={styles.shareNote}>{note}</span> : null}
        <span className="sr-only">
          {count === null ? ': cuenta no disponible' : `: ${NUM0.format(count)} ${count === 1 ? 'vez' : 'veces'}`}
          {pct > 0 ? `, ${pctText} del total` : ''}
        </span>
      </span>
      <span className={styles.shareCount} aria-hidden="true">
        {count === null ? '—' : NUM0.format(count)}
      </span>
      <span className={styles.shareBar} aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </span>
      <span className={styles.sharePct} aria-hidden="true">
        {pctText}
      </span>
    </li>
  )
}

/** A table of proportions. `what` names the first column. */
export function Shares({ what, label, children }: { what: string; label: string; children: ReactNode }) {
  return (
    <ul className={styles.shares} aria-label={label}>
      <li className={styles.shareHead} aria-hidden="true">
        <span>{what}</span>
        <span>veces</span>
        <span />
        <span>parte</span>
      </li>
      {children}
    </ul>
  )
}

// ── sparkline (shape only — no axis, no numbers) ────────────────────────────

export function Sparkline({ values, label, height = 72 }: { values: number[]; label: string; height?: number }) {
  const n = values.length
  if (!n) return null
  const W = 600
  const H = height
  const max = Math.max(...values)
  const x = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W)
  const y = (v: number) => (max > 0 ? H - 3 - (v / max) * (H - 12) : H - 3)
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const area = `${line} L${x(n - 1).toFixed(1)} ${H} L${x(0).toFixed(1)} ${H} Z`
  return (
    <div className={styles.spark}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label} style={{ height: H }}>
        <path d={area} className={styles.sparkArea} />
        <path d={line} className={styles.sparkLine} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className={styles.days} aria-hidden="true" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
        {values.map((v, i) => (
          <span key={i} data-on={v > 0 || undefined} />
        ))}
      </div>
    </div>
  )
}

// ── notes & emptiness ───────────────────────────────────────────────────────

/** A margin note: a real limit, said plainly. */
export function Nota({ children }: { children: ReactNode }) {
  return <p className={styles.nota}>{children}</p>
}

/** The printed «nothing here»: a hatched field and one true sentence. */
export function Vacio({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className={[styles.vacio, 'hatch'].join(' ')}>
      <p>{children}</p>
      {action ? <div className={styles.vacioAction}>{action}</div> : null}
    </div>
  )
}

/** Quiet inline text-button (Ver, Editar, Quitar…). */
export function Accion({
  children,
  onClick,
  icon,
  tone,
  disabled,
  label,
}: {
  children: ReactNode
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  icon?: ReactNode
  tone?: 'danger' | 'strong'
  disabled?: boolean
  label?: string
}) {
  return (
    <button type="button" className={styles.accion} data-tone={tone} onClick={onClick} disabled={disabled} aria-label={label}>
      {icon ? <span className={styles.accionIcon}>{icon}</span> : null}
      {children}
    </button>
  )
}

/** The same quiet action, as an internal link (Editar, Continuar). */
export function AccionLink({ href, children, icon, tone, label }: { href: string; children: ReactNode; icon?: ReactNode; tone?: 'danger' | 'strong'; label?: string }) {
  return (
    <Link href={href} className={styles.accion} data-tone={tone} aria-label={label}>
      {icon ? <span className={styles.accionIcon}>{icon}</span> : null}
      {children}
    </Link>
  )
}

export const kitStyles = styles
