'use client'

/**
 * MUESTRA — a chip of a finish's stock, like a swatch on a printer's card:
 * the foil family itself (painted from the design's sample seed), the
 * metal, the glitter; paper, vinyl, clear film and the lenticular's ridges
 * are drawn in CSS. Decorative: the finish is always named beside it.
 */

import type { StickerDef } from '@/lib/stickers/types'
import { designOf, finishOf, isOneOfAKind, sampleSeed } from '@/lib/stickers/finish'
import { useMuestra } from './useArte'
import styles from './Muestra.module.css'

export function Muestra({ def }: { def: StickerDef }) {
  const f = finishOf(def)
  const foil = isOneOfAKind(f)
  const url = useMuestra(def, sampleSeed(designOf(def)))
  return (
    <span className={styles.muestra} data-material={f.material} data-relieve={f.relieve !== 'liso' ? f.relieve : undefined} aria-hidden="true">
      {foil && url ? (
        // a same-origin blob painted on the client
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className={styles.img} draggable={false} />
      ) : null}
    </span>
  )
}
