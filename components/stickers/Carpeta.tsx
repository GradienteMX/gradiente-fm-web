'use client'

/**
 * CARPETA — your binder: the copies you hold that aren't on the case yet,
 * newest first, each with its finish and number («Holo · Galaxia ·
 * 007/150»), the day it came to you and how (a franja's store, a ticket, the
 * house). Every copy shows its OWN foil (seeded by its uid): two copies of
 * one holo sit side by side and don't match. Filter by where they came from.
 * Picking one (when the host lets you) lifts it off the page — in the Taller
 * that starts placing it on the credencial.
 */

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { StickerCopy, StickerDef, StickerSource } from '@/lib/stickers/types'
import { copySeed } from '@/lib/stickers/finish'
import { binderOf } from '@/lib/store/world-core'
import { useWorld } from '@/lib/store/world'
import { Mark } from '@/components/kit/Glyph'
import { Calco } from './Calco'
import { fechaCorta, FORM_LABEL, lineaCopia, SOURCE_LABEL } from './labels'
import { useCalcosDev } from './dev'
import styles from './Carpeta.module.css'

type Filtro = 'todo' | StickerSource
const FILTROS: Filtro[] = ['todo', 'franja', 'evento', 'casa']

/** How a copy got to you, in words. */
export function comoLlego(copy: StickerCopy, def: StickerDef): string {
  if (copy.via === 'compra') return def.source === 'franja' ? `De la tienda de ${def.art.title}` : 'De una tienda'
  if (copy.via === 'boleto') return 'Con tu boleto'
  return 'Regalo de la casa'
}

export function Carpeta({
  userId,
  selected = null,
  onPick,
  label = 'Tu carpeta',
}: {
  userId: string
  /** The copy lifted right now (placing). */
  selected?: string | null
  /** Makes each copy a button. */
  onPick?: (copy: StickerCopy) => void
  label?: string
}) {
  useCalcosDev()
  const world = useWorld((s) => s.world)
  const copies = useMemo(() => binderOf(world, userId), [world, userId])
  const [filtro, setFiltro] = useState<Filtro>('todo')
  const counts = useMemo(() => {
    const c: Record<Filtro, number> = { todo: 0, franja: 0, evento: 0, casa: 0 }
    for (const copy of copies) {
      const def = world.stickers[copy.stickerId]
      if (!def) continue
      c.todo++
      c[def.source]++
    }
    return c
  }, [copies, world.stickers])
  const shown = copies.filter((c) => {
    const def = world.stickers[c.stickerId]
    return def && (filtro === 'todo' || def.source === filtro)
  })

  if (!copies.length)
    return (
      <div className={[styles.vacia, 'hatch'].join(' ')}>
        <p className={styles.vaciaTitle}>Tu carpeta está vacía.</p>
        <p className={styles.vaciaBody}>Los calcos salen de la tienda de cada franja, del boleto de una noche y de la casa, que regala dos al llegar.</p>
        <p className={styles.vaciaLinks}>
          <Link href="/mercado" className={styles.link}>
            Mercado <Mark name="arrow" size={11} />
          </Link>
          <Link href="/agenda" className={styles.link}>
            Agenda <Mark name="arrow" size={11} />
          </Link>
        </p>
      </div>
    )

  return (
    <div className={styles.carpeta}>
      <div className={styles.filtros} role="radiogroup" aria-label={`${label}: filtrar por origen`}>
        {FILTROS.filter((f) => f === 'todo' || counts[f] > 0).map((f) => (
          <button key={f} type="button" role="radio" aria-checked={filtro === f} data-on={filtro === f || undefined} onClick={() => setFiltro(f)}>
            {f === 'todo' ? 'Todo' : SOURCE_LABEL[f]} <i>{String(counts[f]).padStart(2, '0')}</i>
          </button>
        ))}
      </div>
      {shown.length ? (
        <ul className={[styles.hoja, 'hatch'].join(' ')} aria-label={label}>
          {shown.map((copy) => {
            const def = world.stickers[copy.stickerId]
            if (!def) return null
            const on = selected === copy.uid
            const wide = def.aspect > 1.8
            const body = (
              <>
                <span className={styles.bolsa} data-wide={wide || undefined}>
                  <Calco def={def} width={wide ? 190 : 116} serial={copy.serial} seed={copySeed(copy.uid)} lifted={on} />
                </span>
                <span className={styles.texto}>
                  <span className={styles.nombre}>{def.name}</span>
                  <span className={styles.meta}>
                    {FORM_LABEL[def.form]} · {lineaCopia(def, copy.serial)}
                  </span>
                  <span className={styles.via}>
                    {comoLlego(copy, def)} · {fechaCorta(copy.at)}
                  </span>
                </span>
              </>
            )
            return (
              <li key={copy.uid} className={styles.item} data-wide={wide || undefined}>
                {onPick ? (
                  <button
                    type="button"
                    className={styles.celda}
                    aria-pressed={on}
                    data-on={on || undefined}
                    onClick={() => onPick(copy)}
                    aria-label={`${def.name}, ${lineaCopia(def, copy.serial)}. ${comoLlego(copy, def)}, ${fechaCorta(copy.at)}.${on ? ' Colocándolo en la credencial.' : ' Pegarlo en la credencial.'}`}
                  >
                    {body}
                  </button>
                ) : (
                  <div className={styles.celda}>{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className={styles.nada}>Nada de {filtro === 'todo' ? 'eso' : SOURCE_LABEL[filtro].toLowerCase()} en tu carpeta.</p>
      )}
    </div>
  )
}
