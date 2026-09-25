'use client'

import { useCampo } from '@/lib/store/campo'
import type { ContentType } from '@/lib/types'
import { FormatGlyph, FORMAT_LABEL, FORMAT_ON, FORMAT_STOCK } from '@/components/kit/Glyph'
import styles from './Formatos.module.css'

const ORDER: ContentType[] = ['evento', 'mix', 'review', 'editorial', 'articulo', 'listicle', 'noticia', 'opinion']

/** Format filter — shape, never color. Counts are catalog facts. */
export function Formatos({ compact }: { compact?: boolean }) {
  const type = useCampo((s) => s.type)
  const setType = useCampo((s) => s.setType)
  const counts = useCampo((s) => s.counts)
  const total = useCampo((s) => s.total)

  return (
    <div className={styles.row} role="radiogroup" aria-label="Formato" data-compact={compact || undefined}>
      <button
        type="button"
        role="radio"
        aria-checked={type === null}
        className={styles.item}
        data-on={type === null || undefined}
        onClick={() => setType(null)}
      >
        <span className={styles.all}>Todo</span>
        <span className={styles.count}>{total}</span>
      </button>
      {ORDER.map((t) => {
        const n = counts[t] ?? 0
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            className={styles.item}
            data-on={type === t || undefined}
            data-empty={n === 0 || undefined}
            onClick={() => setType(type === t ? null : t)}
            title={FORMAT_LABEL[t]}
            style={{ '--lc': FORMAT_STOCK[t], '--lo': FORMAT_ON[t] } as React.CSSProperties}
          >
            <span className={styles.swatch} aria-hidden="true" />
            <FormatGlyph type={t} size={14} />
            <span className={styles.name}>{FORMAT_LABEL[t]}</span>
            <span className={styles.count}>{n}</span>
          </button>
        )
      })}
    </div>
  )
}
