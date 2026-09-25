'use client'

/**
 * The stickers on the CSS card (first paint, and the whole card without
 * WebGL): flat, in place, rotated, aged by colour and thinned by scraping —
 * and in their finish (lib/stickers/finish.ts): each copy's seeded foil,
 * metal or glitter (stickerFlat.ts) multiplied into the light areas of its
 * print, glints and gloss screened over it, the reliefs lit by SVG filters
 * from the top left, a lenticular whose second frame comes up as the card
 * leans (--px), clear film printing only its ink.
 *
 * They sit on the case, not the card: a layer the size of the case's
 * outline, just over each face (so a sticker can hang over the case's
 * margin). What hangs past the outline has gone round the edge to the other
 * face — flat, it's cut at the outline, and the strip over the rounded edge
 * shades away as it turns. (Without its host — the flat card's `.inner` —
 * the layer falls back to the card's face, clipped at the card.)
 */

import { useCallback, useEffect, useId, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { stickerArt } from '@/lib/stickers/arte'
import { copySeed } from '@/lib/stickers/finish'
import type { CardFace, Relieve, StickerDef, StickerMaterial } from '@/lib/stickers/types'
import type { StickerItem } from './stickerGL'
import { CARD_H, CARD_W, CASE_MARGIN, CASE_R, EDGE_PATH } from './geometry'
import { flatFinish } from './stickerFlat'
import styles from './Credencial.module.css'

const urls = new Map<string, Promise<string | null>>()

function artUrl(def: StickerDef, frame: 'a' | 'b' = 'a'): Promise<string | null> {
  const key = frame === 'b' ? `${def.id}#b` : def.id
  let p = urls.get(key)
  if (!p) {
    p = stickerArt(def, 256, frame)
      .then((c) => {
        try {
          return c.toDataURL('image/png')
        } catch {
          return null
        }
      })
      .catch(() => null)
    urls.set(key, p)
  }
  return p
}

const DAY = 86_400_000

interface Look {
  src: string
  /** Lenticular: the second frame. */
  b: string | null
  tile: string | null
  glint: string | null
  material: StickerMaterial
  relieve: Relieve
}

const FILL: CSSProperties = { position: 'absolute', inset: 0, backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat', pointerEvents: 'none' }

/** The reliefs (and clear film) as SVG lighting over the print: the key from the top left. */
function Filters({ id }: { id: string }) {
  const ink = '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -0.3 -0.59 -0.11 1 0'
  const emboss = (name: string, blur: number, scale: number) => (
    <filter id={`${id}-${name}`} x="-2%" y="-2%" width="104%" height="104%" colorInterpolationFilters="sRGB">
      <feColorMatrix in="SourceGraphic" type="matrix" values={ink} result="ink" />
      <feGaussianBlur in="ink" stdDeviation={blur} result="h" />
      <feDiffuseLighting in="h" surfaceScale={scale} diffuseConstant={1} result="lit">
        <feDistantLight azimuth={225} elevation={45} />
      </feDiffuseLighting>
      <feComposite in="lit" in2="SourceGraphic" operator="arithmetic" k1={1.414} k2={0} k3={0} k4={0} result="shaded" />
      <feComposite in="shaded" in2="SourceGraphic" operator="in" />
    </filter>
  )
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        {emboss('tinta', 0.6, 2)}
        {emboss('gofrado', 1.8, 4)}
        {emboss('hundido', 1.4, -4)}
        <filter id={`${id}-barniz`} x="-2%" y="-2%" width="104%" height="104%" colorInterpolationFilters="sRGB">
          <feColorMatrix in="SourceGraphic" type="matrix" values={ink} result="ink" />
          <feGaussianBlur in="ink" stdDeviation={0.8} result="h" />
          <feSpecularLighting in="h" surfaceScale={2} specularConstant={0.9} specularExponent={18} result="spec">
            <feDistantLight azimuth={225} elevation={55} />
          </feSpecularLighting>
          <feComposite in="spec" in2="ink" operator="in" result="gloss" />
          <feComposite in="gloss" in2="SourceGraphic" operator="arithmetic" k1={0} k2={0.5} k3={1} k4={0} result="lit" />
          <feComposite in="lit" in2="SourceGraphic" operator="in" />
        </filter>
        <filter id={`${id}-domo`} x="-2%" y="-2%" width="104%" height="104%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation={5} result="h" />
          <feSpecularLighting in="h" surfaceScale={6} specularConstant={1} specularExponent={28} result="spec">
            <feDistantLight azimuth={225} elevation={50} />
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceAlpha" operator="in" result="gloss" />
          <feComposite in="gloss" in2="SourceGraphic" operator="arithmetic" k1={0} k2={0.7} k3={1} k4={0} result="lit" />
          <feComposite in="lit" in2="SourceGraphic" operator="in" />
        </filter>
        <filter id={`${id}-clear`} colorInterpolationFilters="sRGB">
          <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -0.9 -1.7 -0.35 0 2.3" result="k" />
          <feComposite in="k" in2="SourceAlpha" operator="in" />
        </filter>
      </defs>
    </svg>
  )
}

export function StickersCSS({ items, face, nowMs }: { items: StickerItem[]; face: CardFace; nowMs: number }) {
  const [looks, setLooks] = useState<Record<string, Look>>({})
  const [host, setHost] = useState<HTMLElement | null>(null)
  const fid = `calcos-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const mine = items.filter((it) => it.placement.face === face)

  // The flat card's 3D container: the stickers ride the case there.
  const probe = useCallback((el: HTMLSpanElement | null) => {
    setHost((el?.closest(`.${styles.inner}`) as HTMLElement | null) ?? null)
  }, [])

  useEffect(() => {
    let live = true
    for (const it of items) {
      if (it.placement.face !== face) continue
      const { uid } = it.placement
      const def = it.def
      const flat = flatFinish(def, copySeed(uid))
      const lenti = flat.finish.material === 'lenticular'
      Promise.all([artUrl(def), lenti ? artUrl(def, 'b') : Promise.resolve(null)]).then(([src, b]) => {
        if (!live || !src) return
        const look: Look = { src, b, tile: flat.tile, glint: flat.glint, material: flat.finish.material, relieve: flat.finish.relieve }
        setLooks((s) => (s[uid]?.src === src && s[uid]?.material === look.material ? s : { ...s, [uid]: look }))
      })
    }
    return () => {
      live = false
    }
  }, [items, face])

  if (!mine.length) return null

  // Layout box: the case's outline (on the case) or the card (fallback), in card fractions.
  const onCase = Boolean(host)
  const mx = onCase ? CASE_MARGIN / CARD_W : 0
  const my = onCase ? CASE_MARGIN / CARD_H : 0
  const bw = 1 + 2 * mx
  const bh = 1 + 2 * my
  const fold = EDGE_PATH[0]?.inset ?? 0.02

  const stickers = mine.map(({ placement: p, def }) => {
    const look = looks[p.uid]
    if (!look) return null
    const age = Math.min(1, Math.max(0, (nowMs - Date.parse(p.at)) / DAY / 730))
    const sw = def.size * p.scale
    const fx = (p.x + mx) / bw
    const fy = (p.y + my) / bh
    const art = `url(${look.src})`
    const filter = [
      look.relieve !== 'liso' ? `url(#${fid}-${look.relieve})` : '',
      look.material === 'transparente' ? `url(#${fid}-clear)` : '',
      `saturate(${(1 - age * 0.45).toFixed(3)}) sepia(${(age * 0.28).toFixed(3)})`,
    ]
      .filter(Boolean)
      .join(' ')
    // The strip over the rounded edge, in the case's frame (counter-rotated):
    // it turns away from the eye, so it shades toward the outline.
    const swu = sw * CARD_W
    const shu = swu / Math.max(0.1, def.aspect)
    const shade: CSSProperties | null = onCase
      ? {
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: `${((bw * CARD_W) / swu) * 100}%`,
          height: `${((bh * CARD_H) / shu) * 100}%`,
          transformOrigin: '0 0',
          transform: `rotate(${-p.rot}rad) translate(${-fx * 100}%, ${-fy * 100}%)`,
          borderRadius: `calc(${CASE_R * 1000} * var(--u))`,
          boxShadow: `inset 0 0 calc(${(fold * 900).toFixed(1)} * var(--u)) calc(${(fold * 450).toFixed(1)} * var(--u)) rgb(0 0 0 / 0.4)`,
          pointerEvents: 'none',
        }
      : null
    return (
      <span
        key={p.uid}
        className={styles.calco}
        style={{
          left: `${fx * 100}%`,
          top: `${fy * 100}%`,
          width: `${(sw / bw) * 100}%`,
          aspectRatio: `${def.aspect}`,
          transform: `translate(-50%, -50%) rotate(${p.rot}rad)`,
          backgroundImage: art,
          maskImage: art,
          WebkitMaskImage: art,
          maskSize: '100% 100%',
          WebkitMaskSize: '100% 100%',
          isolation: 'isolate',
          filter,
          opacity: 1 - p.wear * 0.55,
        }}
      >
        {look.tile ? <span style={{ ...FILL, backgroundImage: `url(${look.tile})`, mixBlendMode: 'multiply' }} /> : null}
        {look.b ? (
          <>
            <span style={{ ...FILL, backgroundImage: `url(${look.b})`, opacity: 'clamp(0, calc((var(--px, 0) - 0.12) * 6), 1)' }} />
            <span style={{ ...FILL, background: 'repeating-linear-gradient(90deg, rgb(255 255 255 / 0.16) 0 1px, rgb(0 0 0 / 0.07) 1px 3px)' }} />
          </>
        ) : null}
        {look.glint ? <span style={{ ...FILL, backgroundImage: `url(${look.glint})`, mixBlendMode: 'screen' }} /> : null}
        {shade ? <span style={shade} /> : null}
      </span>
    )
  })

  const layer = onCase ? (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: `${-mx * 100}%`,
        right: `${-mx * 100}%`,
        top: `${-my * 100}%`,
        bottom: `${-my * 100}%`,
        borderRadius: `calc(${CASE_R * 1000} * var(--u))`,
        overflow: 'hidden',
        pointerEvents: 'none',
        transform: face === 'dorso' ? 'rotateY(180deg) translateZ(1px)' : 'translateZ(1px)',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
      }}
    >
      <Filters id={fid} />
      {stickers}
    </div>
  ) : (
    <div className={styles.calcos} aria-hidden="true">
      <Filters id={fid} />
      {stickers}
    </div>
  )

  return (
    <>
      <span ref={probe} hidden />
      {host ? createPortal(layer, host) : layer}
    </>
  )
}
