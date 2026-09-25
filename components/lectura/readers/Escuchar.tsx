'use client'

import type { ContentItem } from '@/lib/types'
import { usePlayer, playableSource, PLATFORM_LABEL, PLAYABLE, type Track } from '@/lib/store/player'
import { effectiveBand } from '@/lib/vibe'
import { Mark } from '@/components/kit/Glyph'
import { Indice } from './parts'
import styles from './readers.module.css'

/**
 * Sources for a piece, as a ledger: play in the Consola when we can, link
 * out when we can't. The one sounding is pressed (ink ground).
 */
export function Escuchar({ item }: { item: ContentItem }) {
  const current = usePlayer((s) => s.track)
  const playing = usePlayer((s) => s.playing)
  const play = usePlayer((s) => s.play)
  const toggle = usePlayer((s) => s.toggle)
  const embeds = item.embeds ?? (item.mixUrl ? [{ platform: 'soundcloud' as const, url: item.mixUrl }] : [])
  if (!embeds.length) return null
  const b = effectiveBand(item)
  return (
    <section className={styles.escuchar} aria-label="Escuchar">
      <Indice as="p" name="Escuchar" aside={`${embeds.length} ${embeds.length === 1 ? 'fuente' : 'fuentes'}`} />
      <ul className={styles.sources}>
        {embeds.map((e) => {
          const canPlay = PLAYABLE.includes(e.platform) && playableSource({ embeds: [e] })
          const isThis = current?.itemId === item.id && current.source.url === e.url
          const track: Track = {
            itemId: item.id,
            slug: item.slug,
            title: item.title,
            artist: item.author,
            imageUrl: item.imageUrl,
            energy: (b.min + b.max) / 2,
            source: e,
          }
          return (
            <li key={e.url} className={styles.source} data-on={isThis || undefined}>
              <span className={styles.platform}>{PLATFORM_LABEL[e.platform]}</span>
              {canPlay ? (
                <button type="button" className={styles.playBtn} data-on={(isThis && playing) || undefined} onClick={() => (isThis ? toggle() : play(track))}>
                  <Mark name={isThis && playing ? 'pause' : 'play'} size={12} />
                  {isThis ? (playing ? 'Sonando' : 'Reanudar') : 'Reproducir'}
                </button>
              ) : null}
              <a href={e.url} target="_blank" rel="noopener noreferrer" className={styles.out}>
                Abrir <Mark name="external" size={11} />
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
