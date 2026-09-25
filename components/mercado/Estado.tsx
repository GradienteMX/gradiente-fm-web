'use client'

/**
 * ESTADO — a listing's status as a word and a shape, never a color: a full
 * dot is available, a ring is held, a struck dot is gone. (Hue is energy.)
 */

import type { MarketplaceListingStatus } from '@/lib/types'
import { STATUS_LABEL, STATUS_MEANING } from './datos'
import styles from './Estado.module.css'

export function Estado({ status, size = 'sm' }: { status: MarketplaceListingStatus; size?: 'sm' | 'md' }) {
  return (
    <span className={styles.estado} data-status={status} data-size={size} title={STATUS_MEANING[status]}>
      <span className={styles.dot} aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  )
}
