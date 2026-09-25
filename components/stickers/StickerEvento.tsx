'use client'

/**
 * STICKER EVENTO — a night's sticker, for its reading.
 *
 * «Tengo boleto → reclamar el talón»: in this demo it's an honour system —
 * nobody checks your ticket yet, and the block says so. Real ticket
 * verification comes later. One ticket, one stub: once it's in your binder
 * the block says «Ya está en tu carpeta» and points to the Taller.
 *
 * Only for upcoming nights, tonight, and nights up to 7 days after they end;
 * outside that window (and not yours) it renders nothing.
 */

import Link from 'next/link'
import type { ContentItem } from '@/lib/types'
import { hasSticker } from '@/lib/store/world-core'
import { nowIso, useDispatch, useNowMs, useWorld } from '@/lib/store/world'
import { useMe } from '@/lib/store/session'
import { useUI } from '@/lib/store/ui'
import { flare } from '@/components/stage/api'
import { Button } from '@/components/kit/Button'
import { Mark } from '@/components/kit/Glyph'
import { Calco } from './Calco'
import { fechaCorta, formaMaterial } from './labels'
import styles from './StickerEvento.module.css'

const DAY = 86_400_000
/** How long after a night its stub can still be claimed. */
export const CLAIM_WINDOW_DAYS = 7

export function StickerEvento({ item }: { item: ContentItem }) {
  const me = useMe()
  const nowMs = useNowMs()
  const def = useWorld((s) => s.world.stickers[`st-ev-${item.id}`] ?? null)
  const have = useWorld((s) => (me && def ? hasSticker(s.world, me.id, def.id) : false))
  const dispatch = useDispatch()
  const openAccess = useUI((s) => s.openAccess)
  const notify = useUI((s) => s.notify)
  if (!def || item.type !== 'evento') return null

  const end = Date.parse(item.endDate ?? item.date ?? '')
  const until = Number.isFinite(end) ? end + CLAIM_WINDOW_DAYS * DAY : -Infinity
  const open = nowMs <= until
  const past = Number.isFinite(end) && nowMs > end
  if (!open && !have) return null
  const noun = def.form === 'boleto' ? 'talón' : 'círculo'

  const reclamar = (el: Element) => {
    if (!me) {
      openAccess(`Entra para reclamar el ${noun} de esta noche`)
      return
    }
    dispatch({ t: 'sticker-get', userId: me.id, stickerId: def.id, uid: crypto.randomUUID(), via: 'boleto', at: nowIso() })
    flare(el, def.energy)
    notify(`El ${noun} de ${item.title} está en tu carpeta.`, { tone: 'energy', energy: def.energy })
  }

  return (
    <section className={styles.evento} aria-label={`El ${noun} de esta noche`}>
      <div className={styles.art} data-form={def.form}>
        <Calco def={def} width={def.form === 'boleto' ? 260 : 170} label={`Sticker: ${def.name}`} />
      </div>
      <div className={styles.body}>
        <p className={styles.kicker}>
          <span className={styles.code}>EV · CALCOS</span>
          <span>{formaMaterial(def)}</span>
        </p>
        <h3 className={styles.title}>{def.form === 'boleto' ? 'El talón de esta noche' : 'El círculo de esta noche'}</h3>
        {have ? (
          <>
            <p className={styles.have}>
              <Mark name="check" size={13} /> Ya está en tu carpeta.
            </p>
            <Link href="/taller?espacio=credencial" className={styles.link}>
              Pegarlo en tu credencial <Mark name="arrow" size={12} />
            </Link>
          </>
        ) : (
          <>
            <p className={styles.line}>Si tienes boleto para esta noche, su {noun} es tuyo: un boleto, un {noun}. Se pega en tu credencial.</p>
            <div>
              <Button variant="ink" size="md" className={styles.claim} onClick={(e) => reclamar(e.currentTarget)}>
                Tengo boleto → reclamar el {noun}
              </Button>
            </div>
            <p className={styles.honor}>
              <b>Beta · sistema de honor</b>
              Nadie revisa tu boleto todavía; la verificación real llega después. Lo que reclames en la beta se borra al lanzar.
            </p>
            {past ? <p className={styles.until}>Se puede reclamar hasta el {fechaCorta(new Date(until).toISOString())}.</p> : null}
          </>
        )}
      </div>
    </section>
  )
}
