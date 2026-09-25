'use client'

/**
 * ESTANTE — a franja's stickers on its shelf.
 *
 * One card per DESIGN (its mark, its typographic sticker, its edition seal);
 * each design lists the finishes it's printed in — vinyl, a holo run, foil,
 * a dome, a lenticular, varnish or an emboss — as options with their price
 * and what's left of their run. The sticker on the card shows the chosen
 * finish (a sample copy: every copy's foil is laid out for it alone). The
 * shelf wears the franja's team colour (its kind's livery) and says plainly
 * what the closed beta does: «Canjear un vale» puts a copy of the chosen
 * finish in your binder for one of your beta vouchers (payments don't exist
 * yet; everything from the beta is wiped at release). Before that it read:
 * «Obtener» puts a copy of the chosen finish in your
 * binder and charges nothing — the price shown is what it will cost once
 * payments exist. Editions are real runs, counted («12 de 150»); how many
 * people hold a sticker is never shown.
 */

import Link from 'next/link'
import { useMemo, useState, type CSSProperties } from 'react'
import type { ContentItem } from '@/lib/types'
import type { StickerDef, StickerForm } from '@/lib/stickers/types'
import { designOf } from '@/lib/stickers/finish'
import { editionLeft, stickersOfFranja } from '@/lib/store/world-core'
import { nowIso, useDispatch, useWorld } from '@/lib/store/world'
import { STICKERS_BETA } from '@/lib/stickers/beta'
import { useMe } from '@/lib/store/session'
import { useUI } from '@/lib/store/ui'
import { tintaDeFranja } from '@/lib/stickers/arte'
import { patronStyle } from '@/components/librea/patron'
import { flare } from '@/components/stage/api'
import { Button } from '@/components/kit/Button'
import { Mark } from '@/components/kit/Glyph'
import { Calco } from './Calco'
import { Muestra } from './Muestra'
import { acabado, FORM_LABEL, nombreCorto, notaAcabado, precio } from './labels'
import { useCalcosDev } from './dev'
import styles from './Estante.module.css'

const ORDER: Record<StickerForm, number> = { logo: 0, tipo: 1, cinta: 1, circulo: 2, sello: 2, boleto: 3 }

/** «Quedan 149 de 150», «Agotada · 150 de 150», «Tiraje abierto». */
function tiraje(def: StickerDef, left: number | undefined): string {
  if (!def.edition) return 'Tiraje abierto'
  return left === 0 ? `Agotada · ${def.edition} de ${def.edition}` : `Quedan ${left} de ${def.edition}`
}

export function Estante({ franja, variant = 'tienda' }: { franja: ContentItem; variant?: 'tienda' | 'dossier' }) {
  useCalcosDev()
  const me = useMe()
  const world = useWorld((s) => s.world)
  const dispatch = useDispatch()
  const openAccess = useUI((s) => s.openAccess)
  const notify = useUI((s) => s.notify)
  const [picked, setPicked] = useState<Record<string, string>>({})
  // one card per design, its finishes cheapest first
  const designs = useMemo(() => {
    const by = new Map<string, StickerDef[]>()
    for (const d of stickersOfFranja(world, franja.id)) {
      const k = designOf(d)
      const list = by.get(k)
      if (list) list.push(d)
      else by.set(k, [d])
    }
    return [...by.entries()]
      .map(([k, list]) => ({ k, list: list.sort((a, b) => (a.price ?? 0) - (b.price ?? 0) || a.id.localeCompare(b.id)) }))
      .sort((a, b) => ORDER[a.list[0].form] - ORDER[b.list[0].form])
  }, [world, franja.id])
  const mine = useMemo(() => {
    const m = new Map<string, number>()
    if (!me) return m
    for (const c of Object.values(world.binder)) if (c.userId === me.id) m.set(c.stickerId, (m.get(c.stickerId) ?? 0) + 1)
    return m
  }, [world.binder, me])
  if (!designs.length) return null
  const t = tintaDeFranja(franja.franjaKind)
  const vales = world.stickerVouchers

  const obtener = (def: StickerDef, el: Element) => {
    if (!me) {
      openAccess('Entra para guardar stickers en tu carpeta')
      return
    }
    if (editionLeft(world, def.id) === 0) return
    if (STICKERS_BETA && vales <= 0) return
    dispatch({ t: 'sticker-get', userId: me.id, stickerId: def.id, uid: crypto.randomUUID(), via: STICKERS_BETA ? 'beta' : 'compra', at: nowIso() })
    flare(el, def.energy)
    notify(
      STICKERS_BETA
        ? `«${nombreCorto(def)}» de ${franja.title} ya está en tu carpeta. ${vales - 1 === 1 ? 'Te queda 1 vale.' : `Te quedan ${vales - 1} vales.`}`
        : `«${nombreCorto(def)}» de ${franja.title} ya está en tu carpeta.`,
      { tone: 'energy', energy: def.energy },
    )
  }

  return (
    <section
      className={styles.estante}
      data-variant={variant}
      style={{ '--st-c': t.color, '--st-on': t.on } as CSSProperties}
      aria-label={`Stickers de ${franja.title}`}
    >
      <header className={styles.head}>
        <span className={styles.code}>FR · CALCOS</span>
        <h3 className={styles.title}>Stickers de {franja.title}</h3>
        <span className={styles.band} style={patronStyle('dial', t.on)} aria-hidden="true" />
      </header>
      <p className={styles.demo}>
        <b>Beta · vales</b>
        {me
          ? `Tienes ${vales === 1 ? '1 vale' : `${vales} vales`} para canjear en cualquier tienda: cada uno pone una copia del acabado que elijas en tu carpeta. El precio es el que tendrá cuando existan los pagos. Todo lo de la beta se borra al lanzar.`
          : 'Durante la beta cada miembro tiene vales para canjear aquí. El precio es el que tendrá cuando existan los pagos.'}
      </p>
      <ul className={[styles.shelf, 'hatch'].join(' ')}>
        {designs.map(({ k, list }) => {
          const base = list[0]
          const def = list.find((d) => d.id === picked[k]) ?? base
          const left = editionLeft(world, def.id)
          const sold = left === 0
          const have = list.reduce((n, d) => n + (mine.get(d.id) ?? 0), 0)
          const wide = def.aspect > 1.8
          return (
            <li key={k} className={styles.item} data-wide={wide || undefined}>
              <div className={styles.stage}>
                <Calco def={def} width={wide ? 260 : variant === 'dossier' ? 190 : 150} label={`Sticker: ${def.name}`} />
              </div>
              <div className={styles.info}>
                <p className={styles.kind}>
                  {FORM_LABEL[base.form]} · {list.length === 1 ? '1 acabado' : `${list.length} acabados`}
                </p>
                <h4 className={styles.name}>{nombreCorto(base)}</h4>
                <div className={styles.acabados} role="radiogroup" aria-label={`Acabados de «${nombreCorto(base)}»`}>
                  {list.map((d) => {
                    const on = d.id === def.id
                    const l = editionLeft(world, d.id)
                    const n = mine.get(d.id) ?? 0
                    return (
                      <button
                        key={d.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        data-on={on || undefined}
                        className={styles.acabado}
                        onClick={() => setPicked((p) => ({ ...p, [k]: d.id }))}
                      >
                        <Muestra def={d} />
                        <span className={styles.acTexto}>
                          <span className={styles.acNombre}>{acabado(d)}</span>
                          <span className={styles.acTiraje}>
                            {tiraje(d, l)}
                            {n ? ` · tienes ${n}` : ''}
                          </span>
                        </span>
                        <span className={styles.acPrecio}>{precio(d) ?? '—'}</span>
                      </button>
                    )
                  })}
                </div>
                <p className={styles.note}>{notaAcabado(def)}</p>
                <Button variant="ink" size="md" full className={styles.get} disabled={sold || (STICKERS_BETA && Boolean(me) && vales <= 0)} onClick={(e) => obtener(def, e.currentTarget)}>
                  {sold ? 'Agotada' : !STICKERS_BETA ? 'Obtener' : me && vales <= 0 ? 'Sin vales — los pagos llegan después' : 'Canjear un vale'}
                </Button>
                {have ? (
                  <p className={styles.mine}>
                    {have === 1 ? 'Tienes uno en tu carpeta.' : `Tienes ${have} en tu carpeta.`}{' '}
                    <Link href="/taller?espacio=credencial" className={styles.link}>
                      Pegarlo <Mark name="arrow" size={11} />
                    </Link>
                  </p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
      <p className={styles.foot}>
        Cada copia de un foil trae su propio patrón: no hay dos iguales. Se pegan en tu credencial desde el Taller; una vez pegado no se mueve, solo se quita
        raspando.
      </p>
    </section>
  )
}
