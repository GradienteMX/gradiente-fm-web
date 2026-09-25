'use client'

/**
 * A poll borrows the card's artwork area while it's open — the mosaic never
 * reflows: a paper sheet laid over the poster. Choices are ledger rows with
 * tick squares; results print as stepped ink bars and stay hidden until you
 * vote (or the poll closes): you reveal your reading, the room reveals its.
 * A vote lands with a TRAMA burst.
 */

import { useEffect, useMemo, useRef } from 'react'
import type { ContentItem } from '@/lib/types'
import { aggregate, isPollClosed, POLL_DEFAULT_PROMPT } from '@/lib/logic/polls'
import { useDispatch, useNow, useWorld } from '@/lib/store/world'
import { useMe } from '@/lib/store/session'
import { useUI } from '@/lib/store/ui'
import { effectiveBand, energyVariation } from '@/lib/vibe'
import { flare } from '@/components/stage/api'
import { asentar } from '@/components/trama/api'
import { Mark } from '@/components/kit/Glyph'
import styles from './PollCanvas.module.css'

/** Results print in blocks of 5 %. */
const BLOCKS = 20

export function PollCanvas({ item, onClose, variant = 'card' }: { item: ContentItem; onClose?: () => void; variant?: 'card' | 'section' }) {
  const poll = item.poll!
  const me = useMe()
  const now = useNow()
  const dispatch = useDispatch()
  const openAccess = useUI((s) => s.openAccess)
  const tally = useWorld((s) => s.world.pollTally[poll.id])
  const mine = useWorld((s) => (me ? s.world.pollVotes[poll.id]?.[me.id] : undefined))
  const closed = isPollClosed(poll, now)
  const results = useMemo(() => aggregate(item, tally), [item, tally])
  const reveal = Boolean(mine) || closed
  const band = effectiveBand(item)
  const mid = (band.min + band.max) / 2
  const sheet = useRef<HTMLDivElement>(null)

  // Laid over the card, the sheet sits under the gesture canvas: anything
  // still printing (the card's title re-print) finishes as it opens.
  useEffect(() => {
    if (variant === 'card') asentar(sheet.current)
  }, [variant])

  const vote = (choiceId: string, el: HTMLElement) => {
    if (!me) return openAccess('Vota en las encuestas')
    if (closed) return
    const next = poll.multiChoice
      ? mine?.includes(choiceId)
        ? mine.filter((c) => c !== choiceId)
        : [...(mine ?? []), choiceId]
      : mine?.[0] === choiceId
        ? []
        : [choiceId]
    dispatch({ t: 'vote', userId: me.id, pollId: poll.id, choiceIds: next, at: new Date().toISOString() })
    if (next.length) flare(el, mid)
  }

  return (
    <div ref={sheet} className={styles.poll} data-variant={variant} data-reveal={reveal || undefined} onClick={(e) => e.stopPropagation()} role="group" aria-label="Encuesta">
      <div className={styles.head}>
        <span className={styles.kicker}>
          <span className={styles.name}>Encuesta</span>
          {closed ? <span className={styles.state}>cerrada</span> : poll.multiChoice ? <span className={styles.state}>varias opciones</span> : null}
        </span>
        {onClose ? (
          <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar encuesta">
            <Mark name="close" size={12} />
          </button>
        ) : null}
      </div>
      <p className={styles.prompt} style={{ fontVariationSettings: energyVariation(mid) }}>
        {poll.prompt || POLL_DEFAULT_PROMPT[poll.kind]}
      </p>
      <ul className={styles.choices}>
        {results.choices.map((c) => {
          const picked = mine?.includes(c.id)
          const pct = Math.round(c.share * 100)
          return (
            <li key={c.id}>
              <button
                type="button"
                className={styles.choice}
                data-picked={picked || undefined}
                disabled={closed}
                onClick={(e) => vote(c.id, e.currentTarget)}
                aria-pressed={picked}
              >
                <span className={styles.tick} aria-hidden="true" />
                <span className={styles.choiceLabel}>
                  {c.label}
                  {c.sub ? <span className={styles.sub}> · {c.sub}</span> : null}
                </span>
                {reveal ? <span className={styles.pct}>{pct}%</span> : null}
                {reveal ? (
                  <span className={styles.bar} aria-hidden="true">
                    <span className={styles.fill} style={{ ['--s' as string]: Math.round(c.share * BLOCKS) / BLOCKS }} />
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
      <p className={styles.note}>
        {reveal ? (
          <>
            <span className={styles.total}>{results.total}</span> {results.total === 1 ? 'lectura' : 'lecturas'}
          </>
        ) : (
          'Anónima hasta que votes.'
        )}
      </p>
    </div>
  )
}
