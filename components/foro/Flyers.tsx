'use client'

/**
 * Flyers de la casa — a curated set from /public/flyers (every file verified
 * on disk) that anyone can pin to a thread or a reply when they don't have
 * their own image at hand.
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import styles from './Flyers.module.css'

const NAMES = [
  'darkside',
  'orbital-omen',
  'eclipse',
  'eternal-hell',
  'man-or-machine',
  'phorm',
  'pulse-1990',
  'jungle-mania',
  'hardcore-massive',
  'deathrow-techno',
  'kaos-sasha',
  'orbital-omen-2',
  'rip-acidhouse',
  'spiral-tribe',
  'techno-rave',
  'tresor-underground',
  'ultimatum',
  'universe-planet',
  'void',
  'back-in-the-jungle',
  'nn-bandera',
  'nn-colectivo-futuro-2019',
  'nn-foro-2019',
  'nn-ig-03',
  'nn-sonidos-flyer',
  'nn-tonal-oct25',
  'nn-nye-2026',
  'nn-club-coco-2021',
  'rf-002',
  'rf-006',
  'rf-008',
  'rf-012',
  'rf-014',
  'rf-017',
  'rf-020',
  'rf-022',
  'rf-029',
  'rf-030',
  'rf-034',
  'rf-041',
  'rf-043',
  'rf-045',
  'rf-059',
  'rf-062',
  'rf-064',
  'rf-068',
  'rf-069',
  'rf-073',
  'rf-075',
] as const

export const FLYERS: readonly string[] = NAMES.map((n) => `/flyers/${n}.jpg`)

/** A grid of the house flyers. Picking one adds it; picking it again removes it. */
export function FlyerPicker({
  onPick,
  picked = [],
  full = false,
  columns,
}: {
  onPick: (src: string) => void
  picked?: string[]
  /** No room left: only already-picked flyers stay clickable. */
  full?: boolean
  columns?: number
}) {
  return (
    <div className={styles.grid} role="group" aria-label="Flyers de la casa" style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}>
      {FLYERS.map((src, i) => {
        const on = picked.includes(src)
        return (
          <button
            key={src}
            type="button"
            className={styles.flyer}
            data-on={on || undefined}
            disabled={full && !on}
            onClick={() => onPick(src)}
            aria-pressed={on}
            aria-label={`Flyer ${i + 1}${on ? ' (elegido)' : ''}`}
          >
            <Image src={src} alt="" fill sizes="110px" className={styles.img} draggable={false} />
            {on ? <span className={styles.mark}>{picked.indexOf(src) + 1}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
