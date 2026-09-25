'use client'

/**
 * CALCO — a sticker shown in the DOM.
 *
 * The art is the printed object (lib/stickers/arte); its FINISH is layered
 * over it (lib/stickers/acabado + Calco.module.css): the copy's own foil
 * where the print leaves the stock bare — each holo family its own
 * structure, seeded by the copy, so two copies never catch the light alike
 * — bare metal, glitter, the lenticular's second picture behind its ridges,
 * the relief lit from the art itself (raised ink, emboss, deboss, spot
 * varnish, a resin dome). At rest it is a rich still print, lit from the
 * studio's key (top left). Under a fine pointer it tilts a little and the
 * finish answers: bands sweep, moiré slides, arms swing round the laser's
 * centre, shards and facets and sequins and flakes FLIP (in steps), stars
 * twinkle, the film shifts colour, the relief turns toward the light.
 * Editions carry their serial, «007/150». While the print arrives, the die
 * line holds its place. Reduced motion: the still, always.
 *
 * `seed`: the copy's (copySeed(copy.uid)); shelves leave it out and get the
 * design's sample.
 */

import { useMemo, useRef, type CSSProperties, type PointerEvent } from 'react'
import type { StickerDef } from '@/lib/stickers/types'
import { designOf, finishOf, foilLayout, isOneOfAKind, sampleSeed, type Finish, type FoilLayout } from '@/lib/stickers/finish'
import { glintCount, glints, REST, type Kit } from '@/lib/stickers/acabado'
import { useReducedMotion } from '@/lib/useMedia'
import { serialLabel } from './labels'
import { useAcabado, useMaterialTexture, useStickerArtURL } from './useArte'
import styles from './Calco.module.css'

export interface CalcoProps {
  def: StickerDef
  /** Nominal CSS width (sets the art's resolution; the sticker never grows past it). */
  width: number
  /** n of the edition, for limited runs. */
  serial?: number
  /** The copy's foil seed (copySeed(uid)); a shelf's sample when absent. */
  seed?: number
  /** 0..1 scraped (an applied sticker partly taken off). */
  wear?: number
  /** Lifted off the sheet (picked, being placed): the one hard offset. */
  lifted?: boolean
  /** No tilt, no light (dense lists). */
  still?: boolean
  className?: string
  /** Accessible name when the sticker stands alone; otherwise it is decorative. */
  label?: string
}

/** One layer over the print: its key (CSS), the tile of its sheet, its glint group, its mask. */
interface Capa {
  k: string
  i?: number
  g?: number
  m?: 'win' | 'die' | 'ink' | 'none'
}

const TILE = new Set(['t0', 't1', 'arms', 'hl', 'g0', 'g1', 'g2', 'g3', 'g4', 'g5'])
const REL = new Set(['rx', 'ry', 'rim'])

function familia(f: Finish): string {
  return f.material === 'holo' ? (f.holo ?? 'prisma') : f.material
}

/** The layers a finish stacks over the print, bottom to top. */
function capasDe(f: Finish, kit: Kit, hasTex: boolean): Capa[] {
  const out: Capa[] = []
  const foil = Boolean(kit.sheet && kit.win)
  const groups = (from: number, n: number) => Array.from({ length: n }, (_, g) => ({ k: `g${g}`, i: from + g, g }))
  if (kit.relief && f.relieve === 'domo' && !foil) out.push({ k: 'lens', m: 'none' })
  if (foil)
    switch (familia(f)) {
      case 'prisma':
        out.push({ k: 't0', i: 0 }, { k: 't1', i: 1 }, { k: 'sweep' }, { k: 'spec' })
        break
      case 'galaxia':
        out.push({ k: 't0', i: 0 }, { k: 't1', i: 1 }, ...groups(2, 4), { k: 'spec' })
        break
      case 'hielo':
        out.push({ k: 't0', i: 0 }, ...groups(1, 6), { k: 'spec' })
        break
      case 'diamante':
      case 'escamas':
        out.push({ k: 't0', i: 0 }, ...groups(1, 4), { k: 'spec' })
        break
      case 'laser':
        out.push({ k: 't0', i: 0 }, { k: 'arms', i: 1 }, { k: 'spec' })
        break
      case 'aceite':
        out.push({ k: 't0', i: 0 }, { k: 't1', i: 1, g: 0 }, { k: 'spec' })
        break
      case 'motivo':
        out.push({ k: 't0', i: 0 }, { k: 't1', i: 1, g: 0 }, { k: 'sweep' })
        break
      case 'brillo':
        out.push({ k: 't0', i: 0 }, ...groups(1, 4))
        break
      case 'metal':
        out.push({ k: 't0', i: 0 }, { k: 'env' }, { k: 'hl', i: 1 })
        break
    }
  if (f.material === 'lenticular' && kit.b) out.push({ k: 'fantasma', m: 'none' }, { k: 'b', m: 'none' }, { k: 'ridges', m: 'die' }, { k: 'sweep', m: 'die' })
  if (kit.relief) {
    out.push({ k: 'rx', i: 0, m: 'none' }, { k: 'ry', i: 1, m: 'none' })
    if (f.relieve === 'domo') out.push({ k: 'rim', i: 2, m: 'none' }, { k: 'dome', m: 'die' })
  }
  if (f.relieve === 'barniz' && kit.ink) out.push({ k: 'barniz', m: 'ink' })
  if (!foil && hasTex && (f.material === 'papel' || f.material === 'vinil' || f.material === 'transparente')) out.push({ k: 'sheen', m: 'die' })
  return out
}

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v))
const deg = (rad: number) => (rad * 180) / Math.PI

/** Where the metal's hairline glints run, along the brushing, for a light at (mx, my). */
function bandAt(L: FoilLayout, mx: number, my: number): string {
  return `${(50 + (mx * Math.cos(L.angle) + my * Math.sin(L.angle)) * 42).toFixed(1)}%`
}

export function Calco({ def, width, serial, seed, wear = 0, lifted, still, className, label }: CalcoProps) {
  const ref = useRef<HTMLSpanElement>(null)
  // the laser's arms swing the short way round: the pointer's angle, unwrapped
  const arm = useRef(deg(Math.atan2(REST[1], REST[0])))
  const s = seed ?? sampleSeed(designOf(def))
  const url = useStickerArtURL(def, width)
  const kit = useAcabado(def, s, width)
  const tex = useMaterialTexture(def.material)
  const reduced = useReducedMotion()
  const live = !still && !reduced

  const f = useMemo(() => finishOf(def), [def])
  const L = useMemo(() => foilLayout(s), [s])
  const rest = useMemo(() => glints(f, L, REST[0], REST[1], s), [f, L, s])
  const n = glintCount(f)
  const capas = useMemo(() => (kit ? capasDe(f, kit, Boolean(tex)) : []), [f, kit, tex])

  const onMove = (e: PointerEvent<HTMLSpanElement>) => {
    if (!live || e.pointerType === 'touch') return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const mx = clamp1(((e.clientX - r.left) / r.width) * 2 - 1)
    const my = clamp1(((e.clientY - r.top) / r.height) * 2 - 1)
    const st = el.style
    st.setProperty('--hot', '1')
    st.setProperty('--rx', `${(mx * 7).toFixed(2)}deg`)
    st.setProperty('--ry', `${(-my * 6).toFixed(2)}deg`)
    st.setProperty('--mx', mx.toFixed(3))
    st.setProperty('--my', my.toFixed(3))
    // glitter answers in steps: flakes flip, they don't slide
    st.setProperty('--gx', String(Math.round(mx * 5)))
    st.setProperty('--gy', String(Math.round(my * 5)))
    // the light, for the relief: the pointer, a touch above and to the left
    st.setProperty('--lx', clamp1(mx * 1.1 - 0.2).toFixed(3))
    st.setProperty('--ly', clamp1(my * 1.1 - 0.25).toFixed(3))
    if (f.material === 'lenticular') {
      const t = Math.max(0, Math.min(1, (mx + 0.32) / 0.64))
      st.setProperty('--lf', (t * t * (3 - 2 * t)).toFixed(3))
    }
    if (f.holo === 'laser' && f.material === 'holo') {
      const a = deg(Math.atan2(my, mx))
      const d = ((((a - arm.current) % 360) + 540) % 360) - 180
      arm.current += d
      st.setProperty('--arm', `${arm.current.toFixed(1)}deg`)
    }
    if (f.material === 'metal') st.setProperty('--hb', bandAt(L, mx, my))
    if (n) glints(f, L, mx, my, s).forEach((v, i) => st.setProperty(`--o${i}`, v.toFixed(3)))
    el.dataset.hot = ''
  }
  const onLeave = () => {
    const el = ref.current
    if (!el) return
    const st = el.style
    for (const k of ['--hot', '--rx', '--ry', '--mx', '--my', '--gx', '--gy', '--lx', '--ly', '--lf', '--arm', '--hb']) st.removeProperty(k)
    for (let i = 0; i < n; i++) st.removeProperty(`--o${i}`)
    arm.current = deg(Math.atan2(REST[1], REST[0]))
    delete el.dataset.hot
  }

  const u = (v: string | null | undefined) => (v ? `url("${v}")` : 'none')
  const style = {
    maxWidth: width,
    '--ar': String(def.aspect),
    '--art': u(url),
    '--tex': u(tex),
    '--wear': String(Math.max(0, Math.min(1, wear))),
    '--win': u(kit?.win),
    '--tinta': u(kit?.ink),
    '--sheet': u(kit?.sheet),
    '--T': String(kit?.tiles || 1),
    '--relief': u(kit?.relief),
    '--RT': String(kit?.reliefTiles || 2),
    '--b': u(kit?.b),
    '--fa': `${(deg(L.angle) + 90).toFixed(1)}deg`,
    '--cx': `${(L.cx * 100).toFixed(1)}%`,
    '--cy': `${(L.cy * 100).toFixed(1)}%`,
    '--hbr': bandAt(L, REST[0], REST[1]),
  } as CSSProperties

  return (
    <span
      ref={ref}
      className={[styles.calco, className ?? ''].join(' ')}
      style={style}
      data-material={def.material}
      data-holo={f.material === 'holo' ? f.holo : undefined}
      data-metal={f.metal ?? undefined}
      data-relieve={f.relieve !== 'liso' ? f.relieve : undefined}
      data-unica={isOneOfAKind(f) || undefined}
      data-form={def.form}
      data-ready={url ? '' : undefined}
      data-live={live || undefined}
      data-worn={wear > 0 || undefined}
      data-lifted={lifted || undefined}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span className={styles.body}>
        <span className={styles.print}>
          {url ? (
            // a same-origin blob painted on the client: nothing for next/image to optimise
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.art} src={url} alt="" draggable={false} decoding="async" />
          ) : (
            <span className={styles.cut} data-round={def.form === 'circulo' || def.form === 'sello' || undefined} />
          )}
          {url
            ? capas.map((c) => (
                <span
                  key={c.k}
                  className={[styles.l, TILE.has(c.k) ? styles.tile : '', REL.has(c.k) ? styles.rel : ''].join(' ')}
                  data-l={c.k}
                  data-m={c.m}
                  data-g={c.g !== undefined && c.k.startsWith('g') ? '' : undefined}
                  style={
                    {
                      '--i': c.i ?? 0,
                      ...(c.g !== undefined ? { opacity: `var(--o${c.g}, ${(rest[c.g] ?? 0).toFixed(3)})` } : null),
                    } as CSSProperties
                  }
                />
              ))
            : null}
        </span>
      </span>
      {serial && def.edition ? <span className={styles.serial}>{serialLabel(serial, def.edition)}</span> : null}
    </span>
  )
}
