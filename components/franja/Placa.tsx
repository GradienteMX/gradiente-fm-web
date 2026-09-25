'use client'

/**
 * PLACA — a franja's logo plate. Artwork when there is one; when there isn't,
 * the name set in its own energy on a dark plate (never a fake logo).
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import type { ContentItem } from '@/lib/types'
import { effectiveBand, energyVariation } from '@/lib/vibe'
import styles from './Placa.module.css'

export function Placa({
  franja,
  sizes = '320px',
  priority,
  className,
  rounded = 'md',
  imprimir = false,
}: {
  franja: ContentItem
  sizes?: string
  priority?: boolean
  className?: string
  rounded?: 'sm' | 'md' | 'lg'
  /** Wait hidden for a TRAMA print (the Sintonía lock-on reveals it). */
  imprimir?: boolean
}) {
  const b = effectiveBand(franja)
  const mid = (b.min + b.max) / 2
  return (
    <span className={[styles.placa, className ?? ''].join(' ')} data-rounded={rounded}>
      {franja.imageUrl ? (
        <Image src={franja.imageUrl} alt="" fill sizes={sizes} priority={priority} className={styles.img} draggable={false} data-trama-img={imprimir ? 'pendiente' : undefined} />
      ) : (
        <span className={styles.initials} style={{ fontVariationSettings: energyVariation(mid) }} aria-hidden="true" data-trama={imprimir ? 'pendiente' : undefined}>
          {initials(franja.title)}
        </span>
      )}
    </span>
  )
}

function initials(title: string): string {
  const words = title.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean)
  if (!words.length) return title.slice(0, 2).toUpperCase()
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}
