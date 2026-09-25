'use client'

import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useUI } from '@/lib/store/ui'
import { energySlotHex } from '@/lib/vibe'
import styles from './Avisos.module.css'

const noop = () => () => {}

/**
 * One-line notices. Honest, brief, never celebratory noise. Click to
 * dismiss. The stack is portaled to <body>: the shell is its own stacking
 * context, and a notice raised from a reading or a sheet (both portaled
 * above the shell) must still print on top of them.
 */
export function Avisos() {
  const notices = useUI((s) => s.notices)
  const dismiss = useUI((s) => s.dismiss)
  const client = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  )
  if (!client) return null
  return createPortal(
    <div className={styles.stack} role="status" aria-live="polite">
      {notices.map((n) => (
        <button
          key={n.id}
          type="button"
          className={styles.notice}
          data-tone={n.tone}
          style={n.energy !== undefined ? { ['--ne' as string]: energySlotHex(n.energy) } : undefined}
          onClick={() => dismiss(n.id)}
        >
          {n.tone === 'energy' ? <span className={styles.dot} aria-hidden="true" /> : null}
          {n.tone === 'error' ? <span className={styles.mark} aria-hidden="true" /> : null}
          {n.text}
        </button>
      ))}
    </div>,
    document.body,
  )
}
