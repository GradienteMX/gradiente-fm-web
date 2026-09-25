'use client'

/**
 * A display title set in energy typography.
 *
 *  · `energy` omitted → the title follows the field: its width and weight
 *    track the Horizonte's centre live (glacial = wide and light, volcán =
 *    compressed and black). The size is fixed at the widest setting so the
 *    word breathes like a bellows instead of reflowing the page.
 *  · `energy` given → the title sits at that temperature (an entity's own).
 *
 * Entrance: the shared TRAMA press prints it out of blocks in its energy's
 * ink, then it is plain DOM again. Without WebGL or with reduced motion it is
 * simply there.
 */

import { createElement, useRef } from 'react'
import { useCampo } from '@/lib/store/campo'
import { energyVariation } from '@/lib/vibe'
import { fitTitle } from '@/lib/typeset'
import { useRevelar } from '@/components/trama/hooks'
import styles from './EnergyTitle.module.css'

interface Props {
  text: string
  energy?: number
  as?: 'h1' | 'h2' | 'p'
  /** Largest size in px (the widest energy still fits the container). */
  max?: number
  min?: number
  share?: number
  className?: string
  id?: string
}

export function EnergyTitle({ text, energy, as = 'h1', max = 176, min = 42, share = 0.9, className, id }: Props) {
  const fieldMid = useCampo((s) => (s.range[0] + s.range[1]) / 2)
  const e = energy ?? fieldMid
  const ref = useRef<HTMLElement>(null)
  useRevelar(ref, { trigger: 'load', energy: e, replay: text })

  return (
    <div className={[styles.box, className ?? ''].join(' ')}>
      {createElement(
        as,
        {
          ref,
          id,
          className: styles.title,
          'data-trama': 'pendiente',
          style: { fontVariationSettings: energyVariation(e), fontSize: fitTitle(text, 0, max, min, share) },
        },
        text,
      )}
    </div>
  )
}
