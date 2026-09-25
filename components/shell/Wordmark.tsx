'use client'

import { useCampo } from '@/lib/store/campo'
import { energyFont } from '@/lib/vibe'
import styles from './Wordmark.module.css'

const LETTERS = 'GRADIENTE'.split('')

/**
 * The wordmark is a typographic gradient: each letter is set at an energy
 * across the band you're tuned to. Full range → glacial G to volcán E.
 * Narrow the Horizonte to 7–9 and the whole word runs hot.
 */
export function Wordmark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const range = useCampo((s) => s.range)
  return (
    <span className={`${styles.mark} ${styles[size]}`} aria-label="Gradiente">
      {LETTERS.map((ch, i) => {
        const e = range[0] + ((range[1] - range[0]) * i) / (LETTERS.length - 1)
        const { wdth, wght } = energyFont(e)
        return (
          <span
            key={i}
            aria-hidden="true"
            className={styles.letter}
            style={{ fontVariationSettings: `"wdth" ${wdth}, "wght" ${wght}` }}
          >
            {ch}
          </span>
        )
      })}
    </span>
  )
}
