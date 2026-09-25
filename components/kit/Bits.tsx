'use client'

/** Small shared pieces: band chip, section head, honest empty states. */

import type { ReactNode } from 'react'
import { bandLabel, bandSteps } from '@/lib/vibe'
import styles from './Bits.module.css'

/** A band as the ramp prints it: stepped swatches, then its names in mono. */
export function BandChip({ min, max, size = 'sm' }: { min: number; max: number; size?: 'sm' | 'md' }) {
  return (
    <span className={styles.band} data-size={size}>
      <span className={styles.swatch} style={{ background: bandSteps(min, max) }} aria-hidden="true" />
      {bandLabel(min, max)}
    </span>
  )
}

/** `02 / Trofeos — 04 de 10` → index, name, and the rest in prose. */
function indexical(label: string): { n: string; name: string; rest: string | null } | null {
  const m = /^\s*(\d{1,3})\s*\/\s*(.+?)(?:\s+[—–-]\s+(.+))?\s*$/.exec(label)
  return m ? { n: m[1], name: m[2], rest: m[3] ?? null } : null
}

export function SectionHead({ label, title, children, sub }: { label?: string; title?: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  const idx = label ? indexical(label) : null
  return (
    <header className={styles.head}>
      <div className={styles.headText}>
        {label ? (
          <p className={styles.index}>
            {idx ? (
              <>
                <span className={styles.n}>{idx.n}</span>
                <span className={styles.slash}>/</span>
                <span className={styles.name}>{idx.name}</span>
                {idx.rest ? <span className={styles.rest}>— {idx.rest}</span> : null}
              </>
            ) : (
              label
            )}
          </p>
        ) : null}
        {title ? <h2 className={styles.title}>{title}</h2> : null}
        {sub ? <p className={styles.sub}>{sub}</p> : null}
      </div>
      {children ? <div className={styles.headActions}>{children}</div> : null}
    </header>
  )
}

/** Nothing here, printed: a hatch plate with a paper label pasted on it. */
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyLabel}>
        <p className={styles.emptyTitle}>{title}</p>
        {children ? <div className={styles.emptyBody}>{children}</div> : null}
      </div>
    </div>
  )
}

export function Chip({ children, onClick, on, title }: { children: ReactNode; onClick?: () => void; on?: boolean; title?: string }) {
  if (!onClick)
    return (
      <span className={styles.chip} title={title}>
        {children}
      </span>
    )
  return (
    <button type="button" className={styles.chip} data-on={on || undefined} onClick={onClick} aria-pressed={on} title={title}>
      {children}
    </button>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className={styles.kbd}>{children}</kbd>
}
