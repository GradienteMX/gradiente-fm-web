'use client'

/**
 * SEGUIR — private by design. Following a franja only shapes your Taller;
 * nobody sees who follows whom and no count exists anywhere. Login-gated.
 * While you follow, the button carries a small private mark (cobalt: the
 * colour of "solo tú ves esto").
 */

import type { ContentItem } from '@/lib/types'
import { useMe } from '@/lib/store/session'
import { useDispatch, useWorld } from '@/lib/store/world'
import { useUI } from '@/lib/store/ui'
import { flare } from '@/components/stage/api'
import { effectiveBand } from '@/lib/vibe'
import { Button } from '@/components/kit/Button'
import { Mark } from '@/components/kit/Glyph'
import styles from './Seguir.module.css'

export function Seguir({ franja, size = 'md', full }: { franja: ContentItem; size?: 'sm' | 'md' | 'lg'; full?: boolean }) {
  const me = useMe()
  const following = useWorld((s) => (me ? (s.world.follows[me.id] ?? []).includes(franja.id) : false))
  const dispatch = useDispatch()
  const openAccess = useUI((s) => s.openAccess)
  const notify = useUI((s) => s.notify)

  const toggle = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    if (!me) return openAccess(`Sigue a ${franja.title} desde tu Taller`)
    const on = !following
    dispatch({ t: 'follow', userId: me.id, franjaId: franja.id, on, at: new Date().toISOString() })
    if (on) {
      const b = effectiveBand(franja)
      flare(e.currentTarget, (b.min + b.max) / 2)
      notify(`Sigues a ${franja.title}. Solo tú lo sabes: aparece en tu Taller.`)
    }
  }

  return (
    <span className={styles.seguir} data-full={full || undefined}>
      <Button
        variant={following ? 'ghost' : 'ink'}
        size={size}
        full={full}
        icon={<Mark name={following ? 'check' : 'plus'} size={14} />}
        onClick={toggle}
        aria-pressed={following}
        aria-describedby={following ? `privado-${franja.id}` : undefined}
        title="Privado: solo da forma a tu Taller. Nadie ve a quién sigues."
      >
        {following ? 'Siguiendo' : 'Seguir'}
      </Button>
      {following ? (
        <span id={`privado-${franja.id}`} className={styles.private}>
          <Mark name="lock" size={11} />
          solo tú lo ves
        </span>
      ) : null}
    </span>
  )
}
