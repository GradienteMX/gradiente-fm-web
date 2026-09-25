'use client'

/**
 * CABEZA — the livery head every identity sheet wears (Acceso, the door's
 * panels, the registration): the channel chip, the title set wide, one chip
 * (volver / cerrar), and the livery's pattern printed in a band beneath.
 * When the title changes the new livery floods across in registration steps
 * and the words decode.
 */

import type { CSSProperties } from 'react'
import type { Librea, Patron } from '@/lib/librea'
import { patronCss } from '@/components/librea/patron'
import { Descifrar } from '@/components/librea/Descifrar'
import s from './Cabeza.module.css'

export function Cabeza({
  librea,
  title,
  titleId,
  band,
  chip,
}: {
  librea: Librea
  title: string
  titleId?: string
  /** The band's pattern (defaults to the livery's; some don't hold at 10 px). */
  band?: Patron
  chip?: { label: string; onClick: () => void; disabled?: boolean }
}) {
  const b = patronCss(band ?? librea.patron, librea.on, 0.8)
  return (
    <div className={s.cabeza} style={{ '--lc': librea.color, '--lo': librea.on } as CSSProperties}>
      <header className={s.head}>
        {/* keyed: every new title floods the head with its livery */}
        <span key={title} className={s.flood} aria-hidden="true" />
        <span className={s.canal}>
          <span className={s.canalNum}>{librea.canal}</span>
          <Descifrar text={librea.code} />
        </span>
        <h2 id={titleId} className={s.title}>
          <Descifrar text={title} />
        </h2>
        {chip ? (
          <button type="button" className={s.chip} onClick={chip.onClick} disabled={chip.disabled}>
            {chip.label}
          </button>
        ) : null}
      </header>
      <div key={`b-${title}`} className={s.band} style={{ backgroundImage: b.backgroundImage, backgroundSize: b.backgroundSize }} aria-hidden="true" />
    </div>
  )
}
