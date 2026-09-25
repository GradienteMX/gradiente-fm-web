'use client'

/**
 * CAMPO — the home. One field: the horizon (energy), the portada (what the
 * editors planted this week), the pulse (the next nights), the organism
 * (everything alive, sized by its life), and the dial (the franjas, deaf to
 * the horizon, ordered by their last signal).
 */

import { useEffect, useMemo } from 'react'
import { useItems, useNow } from '@/lib/store/world'
import { useCampo, useIntegerRange } from '@/lib/store/campo'
import { applyFilter, composeHome, rankHome } from '@/lib/logic/feed'
import { presentGenres } from '@/lib/logic/genres'
import type { ContentType } from '@/lib/types'
import { Horizonte } from '@/components/horizonte/Horizonte'
import { Organismo } from '@/components/organismo/Organismo'
import { Estado } from './Estado'
import { Portada } from '@/components/portada/Portada'
import { Pulso } from '@/components/pulso/Pulso'
import { Dial } from '@/components/dial/Dial'
import { Cabecera } from '@/components/librea/Cabecera'
import { LIBREA_SECCION } from '@/lib/librea'
import styles from './Campo.module.css'

export function Campo() {
  const items = useItems()
  const now = useNow()
  const range = useIntegerRange()
  const type = useCampo((s) => s.type)
  const genres = useCampo((s) => s.genres)
  const setPresent = useCampo((s) => s.setPresent)
  const setCounts = useCampo((s) => s.setCounts)

  // Recompose at most once a minute of wall time (decay is slow).
  const minute = Math.floor(now.getTime() / 60_000)
  const comp = useMemo(() => composeHome(items, new Date(minute * 60_000)), [items, minute])

  const energyOnly = useMemo(
    () => applyFilter(comp.gridItems, { range, type: null, genres: [] }, { typeAndGenre: false }),
    [comp.gridItems, range],
  )
  const filtered = useMemo(
    () => applyFilter(comp.gridItems, { range, type, genres }, { typeAndGenre: true }),
    [comp.gridItems, range, type, genres],
  )
  const ranked = useMemo(() => rankHome(filtered, new Date(minute * 60_000)), [filtered, minute])

  useEffect(() => {
    const counts: Partial<Record<ContentType, number>> = {}
    for (const i of energyOnly) counts[i.type] = (counts[i.type] ?? 0) + 1
    setCounts(counts, energyOnly.length)
    const base = type ? energyOnly.filter((i) => i.type === type) : energyOnly
    setPresent(presentGenres(base))
  }, [energyOnly, type, setCounts, setPresent])

  // Nights announced in the next two weeks (the Pulso's window) — a catalog fact.
  const nights14 = useMemo(() => {
    const end = minute * 60_000 + 14 * 86_400_000
    return comp.railEvents.filter((e) => e.date && Date.parse(e.date) < end).length
  }, [comp.railEvents, minute])

  const portada = useMemo(() => (type ? comp.portada.filter((p) => p.type === type) : comp.portada), [comp.portada, type])

  return (
    <div className={styles.campo}>
      <Cabecera
        librea={LIBREA_SECCION.campo}
        size="banda"
        glyph="campo"
        lema="Todo lo que vive en la escena, del glacial al volcán. Navegas por energía, no por género."
        datos={[
          { k: 'piezas vivas', v: String(comp.gridItems.length).padStart(2, '0') },
          { k: 'noches · 14 días', v: String(nights14).padStart(2, '0') },
          { k: 'franjas', v: String(comp.franjas.length).padStart(2, '0') },
        ]}
      />
      <Horizonte />
      <div className={styles.frame}>
        <div className={styles.main}>
          {portada.length ? <Portada items={portada} /> : null}
          {!type || type === 'evento' ? <Pulso events={comp.railEvents} /> : null}
          <Estado shown={ranked.length} />
          <Organismo
            ranked={ranked}
            empty={
              <div className={styles.empty}>
                <p className={styles.emptyTitle}>Nada en esta temperatura.</p>
                <p className="label">Mueve el horizonte o suelta un filtro</p>
              </div>
            }
          />
        </div>
        <aside className={styles.side}>
          <Dial franjas={comp.franjas} market={comp.marketFranjas} />
        </aside>
      </div>
    </div>
  )
}
