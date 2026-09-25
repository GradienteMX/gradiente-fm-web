'use client'

/**
 * Development only: exposes the generator and the catalog on
 * `window.__calcos` so a headless check can print every design on one sheet
 * (`__calcos.hoja()`), every FINISH as the DOM draws it
 * (`__calcos.muestrario()`), and light them all from one spot at once
 * (`__calcos.luz(mx, my)`; `luz(null)` puts the light back). Nothing here
 * runs in production.
 */

import { createElement, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { useWorldStore } from '@/lib/store/world'
import { materialTexture, stickerArt, stickerArtURL } from '@/lib/stickers/arte'
import { acabado } from '@/lib/stickers/acabado'
import type { StickerDef } from '@/lib/stickers/types'
import { Muestrario } from './Muestrario'

interface CalcosDev {
  stickerArt: typeof stickerArt
  stickerArtURL: typeof stickerArtURL
  materialTexture: typeof materialTexture
  acabado: typeof acabado
  defs: () => StickerDef[]
  /** Paint a contact sheet of stickers over the page; resolves when printed. */
  hoja: (opts?: { ids?: string[]; defs?: StickerDef[]; filter?: string; limit?: number; width?: number; ground?: string; frame?: 'a' | 'b' }) => Promise<number>
  /** Every finish as live <Calco>s over the page (a franja's designs as the base). */
  muestrario: (opts?: { franja?: string; width?: number; ground?: string }) => number
  /** Point at every live sticker on the page from (mx, my) — or put the light back (null). */
  luz: (mx: number | null, my?: number) => number
  cerrar: () => void
}

let root: Root | null = null

function cerrar() {
  root?.unmount()
  root = null
  document.getElementById('calcos-hoja')?.remove()
  document.getElementById('calcos-muestrario')?.remove()
}

export function useCalcosDev() {
  const store = useWorldStore()
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    const defs = () => Object.values(store.getState().world.stickers)
    const dev: CalcosDev = {
      stickerArt,
      stickerArtURL,
      materialTexture,
      acabado,
      defs,
      hoja: async (opts = {}) => {
        cerrar()
        let list = defs()
        if (opts.ids) list = opts.ids.map((id) => store.getState().world.stickers[id]).filter(Boolean)
        if (opts.defs) list = opts.defs
        if (opts.filter) {
          const f = opts.filter
          list = list.filter((d) => d.form === f || d.material === f || d.source === f || d.holo === f || d.metal === f || d.relieve === f || d.id.includes(f))
        }
        list = list.slice(0, opts.limit ?? 40)
        const w = opts.width ?? 200
        const sheet = document.createElement('div')
        sheet.id = 'calcos-hoja'
        sheet.style.cssText = `position:fixed;inset:0;z-index:9999;overflow:auto;padding:16px;display:flex;flex-wrap:wrap;gap:18px;align-content:flex-start;background:${opts.ground ?? 'var(--paper)'}`
        const cells = await Promise.all(
          list.map(async (d) => {
            const c = await stickerArt(d, w * 2, opts.frame ?? 'a')
            const cell = document.createElement('figure')
            cell.style.cssText = `margin:0;width:${w}px;font:10px/1.2 var(--font-mono);color:var(--ink-3)`
            const img = document.createElement('img')
            img.src = c.toDataURL('image/png')
            img.style.cssText = `display:block;width:${w}px;height:auto`
            const cap = document.createElement('figcaption')
            cap.textContent = `${d.id} · ${d.form} · ${d.material}`
            cap.style.marginTop = '4px'
            cell.append(img, cap)
            return cell
          }),
        )
        sheet.append(...cells)
        document.body.appendChild(sheet)
        return cells.length
      },
      muestrario: (opts = {}) => {
        cerrar()
        const all = defs()
        const slug = opts.franja ?? 'club-japan'
        const logo = all.find((d) => d.id === `st-${slug}-logo`) ?? all.find((d) => d.form === 'logo')
        // a block of type (not a tape) shows the reliefs best
        const tipo =
          all.find((d) => d.id === `st-${slug}-tipo` && d.form === 'tipo') ??
          all.find((d) => d.source === 'franja' && d.form === 'tipo' && d.id.endsWith('-tipo'))
        if (!logo || !tipo) return 0
        const circulo = all.find((d) => d.source === 'evento' && d.form === 'circulo')
        const boleto = all.find((d) => d.source === 'evento' && d.form === 'boleto')
        const host = document.createElement('div')
        host.id = 'calcos-muestrario'
        host.style.cssText = `position:fixed;inset:0;z-index:9999;overflow:auto;padding:16px;background:${opts.ground ?? 'var(--paper)'}`
        document.body.appendChild(host)
        root = createRoot(host)
        root.render(createElement(Muestrario, { base: { logo, tipo, circulo, boleto }, width: opts.width }))
        return 1
      },
      luz: (mx, my = 0) => {
        const els = [...document.querySelectorAll<HTMLElement>('[data-live][data-material]')]
        for (const el of els) {
          const r = el.getBoundingClientRect()
          if (mx === null) {
            el.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, pointerType: 'mouse', relatedTarget: document.body }))
            el.dispatchEvent(new PointerEvent('pointerleave', { bubbles: false, pointerType: 'mouse' }))
            continue
          }
          const x = r.left + ((mx + 1) / 2) * r.width
          const y = r.top + ((my + 1) / 2) * r.height
          el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: x, clientY: y }))
        }
        return els.length
      },
      cerrar,
    }
    ;(window as unknown as { __calcos?: CalcosDev }).__calcos = dev
  }, [store])
}
