'use client'

/**
 * /mixes — sets, sessions and radio shows. One working extra: tune the
 * Consola to this temperature (every playable mix passing the Horizonte,
 * queued in the order the page shows them).
 */

import { useMemo } from 'react'
import { useItems, useNow } from '@/lib/store/world'
import { usePlayer, playableSource, type Track } from '@/lib/store/player'
import { useUI } from '@/lib/store/ui'
import { rankCategory } from '@/lib/logic/feed'
import { effectiveBand } from '@/lib/vibe'
import { Button } from '@/components/kit/Button'
import { Mark } from '@/components/kit/Glyph'
import { Seccion } from './Seccion'
import { LIBREA_SECCION } from '@/lib/librea'
import { useFiltroSeccion } from './useFiltroSeccion'
import { plural } from './texto'

export function Mixes() {
  const all = useItems()
  const items = useMemo(() => all.filter((i) => i.type === 'mix'), [all])
  const { filtered, range } = useFiltroSeccion(items)

  return (
    <Seccion
      librea={LIBREA_SECCION.mixes}
      glyphs={['mix']}
      index="02"
      kicker="Mixes — sets y sesiones"
      title="Mixes"
      dek="Sets, sesiones y programas de radio grabados en la escena — o traídos a ella. Con tracklist, contexto y la energía que la comunidad les lee."
      filtered={filtered}
      total={items.length}
      emptyNoun="mixes"
      actions={<Sintonizar mixes={filtered} energy={(range[0] + range[1]) / 2} />}
    />
  )
}

function Sintonizar({ mixes, energy }: { mixes: ReturnType<typeof useItems>; energy: number }) {
  const now = useNow()
  const play = usePlayer((s) => s.play)
  const notify = useUI((s) => s.notify)

  const minute = Math.floor(now.getTime() / 60_000)
  const queue = useMemo(() => {
    const ordered = rankCategory(mixes, new Date(minute * 60_000)).map((r) => r.item)
    const out: Track[] = []
    for (const m of ordered) {
      const source = playableSource(m)
      if (!source) continue
      const b = effectiveBand(m)
      out.push({ itemId: m.id, slug: m.slug, title: m.title, artist: m.author, imageUrl: m.imageUrl, energy: (b.min + b.max) / 2, source })
    }
    return out
  }, [mixes, minute])

  if (!queue.length) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span className="meta">
        {queue.length} {plural(queue.length, 'mix se puede', 'mixes se pueden')} escuchar aquí
      </span>
      <Button
        variant="ink"
        icon={<Mark name="play" size={13} />}
        onClick={() => {
          play(queue[0], queue)
          notify(`Sintonizando ${queue.length} ${plural(queue.length, 'mix', 'mixes')} en esta temperatura`, { tone: 'energy', energy })
        }}
      >
        Sintonizar esta temperatura
      </Button>
    </div>
  )
}
