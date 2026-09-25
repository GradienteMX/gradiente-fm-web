'use client'

/**
 * Development only: every finish on one sheet, as the DOM draws it — real
 * <Calco>s (`window.__calcos.muestrario()`), live under the pointer. Each
 * holo family twice (two copies: two seeds), the metals, glitter, the
 * lenticular's two frames, every relief. Nothing here ships to a page.
 */

import type { ReactNode } from 'react'
import type { StickerDef } from '@/lib/stickers/types'
import { copySeed, designOf, HOLO_KINDS, METALS } from '@/lib/stickers/finish'
import { Calco } from './Calco'
import { lineaCopia } from './labels'

export interface MuestrarioBase {
  logo: StickerDef
  tipo: StickerDef
  circulo?: StickerDef
  boleto?: StickerDef
}

const v = (b: StickerDef, patch: Partial<StickerDef>, tag: string): StickerDef => ({ ...b, ...patch, id: `${b.id}~${tag}`, design: designOf(b) })

export function Muestrario({ base, width = 150 }: { base: MuestrarioBase; width?: number }) {
  const { logo, tipo } = base
  const holo = HOLO_KINDS.map((k) => v(logo, { material: 'holo', holo: k, edition: 150, relieve: undefined, metal: undefined }, `holo-${k}`))
  const metals = METALS.map((m) => v(logo, { material: 'metal', metal: m, edition: 50, relieve: undefined }, `metal-${m}`))
  const otros = [
    v(logo, { material: 'brillo', edition: 150, relieve: undefined }, 'brillo'),
    v(logo, { material: 'lenticular', edition: 100, relieve: undefined }, 'lenticular'),
    v(logo, { material: 'vinil', relieve: 'domo' }, 'domo'),
    v(logo, { material: 'metal', metal: 'oro', relieve: 'gofrado' }, 'oro-gofrado'),
  ]
  const relieves = (['liso', 'tinta', 'gofrado', 'hundido', 'barniz'] as const).map((r) => v(tipo, { material: 'papel', relieve: r }, `rel-${r}`))
  const noches = [
    base.circulo && v(base.circulo, { material: 'holo', holo: 'laser' }, 'laser'),
    base.boleto && v(base.boleto, { material: 'metal', metal: 'oro' }, 'oro'),
  ].filter(Boolean) as StickerDef[]

  const cell = (def: StickerDef, seed: number, note: string) => (
    <figure
      key={`${def.id}:${seed}`}
      style={{ margin: 0, width: def.aspect > 1.8 ? width * 2 : width, font: '10px/1.3 var(--font-mono)', color: 'var(--ink-3)' }}
      data-muestra={def.id}
    >
      <div style={{ display: 'grid', placeItems: 'center', padding: 10, background: 'var(--paper-3)', border: '1px solid var(--hair-2)' }}>
        <Calco def={def} width={def.aspect > 1.8 ? width * 2 - 20 : width - 20} seed={seed} serial={def.edition ? 7 : undefined} />
      </div>
      <figcaption style={{ marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {lineaCopia(def, def.edition ? 7 : undefined)}
        <br />
        {note}
      </figcaption>
    </figure>
  )
  const row = (title: string, cells: ReactNode[]) => (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ margin: 0, font: '700 11px var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{title}</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>{cells}</div>
    </section>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {row(
        'Holo — cada familia, dos copias',
        holo.flatMap((d) => [cell(d, copySeed(`${d.id}:a`), 'copia A'), cell(d, copySeed(`${d.id}:b`), 'copia B')]),
      )}
      {row(
        'Metal · brillo · lenticular · domo',
        [...metals, ...otros].map((d) => cell(d, copySeed(`${d.id}:a`), d.material)),
      )}
      {row(
        'Relieve (papel)',
        relieves.map((d) => cell(d, 0, d.relieve ?? 'liso')),
      )}
      {noches.length
        ? row(
            'Noches',
            noches.map((d) => cell(d, copySeed(`${d.id}:a`), d.form)),
          )
        : null}
    </div>
  )
}
