'use client'

/**
 * TRAMA — the public gestures. Components never touch the engine directly.
 *
 *   revelar(el)             text resolves out of blocks, then the DOM is back
 *   revelarImagen(img)      an image prints from coarse blocks to crisp
 *   cruzar(frame, a, b)     one plate breaks into blocks, the next assembles
 *   imprimirHoja(el)        a sheet comes off the press from an origin
 *   barrido(el)             a thin band of ink blocks retunes a region
 *   chispa(x, y, e)         a small dithered ring — a commit landed
 *   asentar()               finish everything now (a modal is opening)
 *
 * While a gesture runs, the element is hidden through data attributes
 * (`data-trama`, `data-trama-img`) so nothing prints twice.
 */

import { energyRGB } from '@/lib/vibe'
import { getTrama, type Dir, type EffectSpec } from './engine'
import { rasterImage, rasterText } from './raster'

type RGB = [number, number, number]

export type Preset = 'imprimir' | 'disolver' | 'bitmap' | 'radiar' | 'teletipo'

export interface RevelarOpts {
  preset?: Preset
  /** Energy 0..10 — the "hot" colour silhouettes print in before cooling to ink. */
  energy?: number
  dir?: Dir
  delay?: number
  duration?: number
  /** Coarsest block in CSS px; default scales with the font size. */
  cell?: number
  levels?: number
}

function rgbFromCss(color: string): RGB | null {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(color)
  if (!m) return null
  return [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255]
}

function paperOf(el: Element): RGB {
  const v = getComputedStyle(el).getPropertyValue('--paper').trim()
  if (/^#[0-9a-f]{6}$/i.test(v)) {
    return [parseInt(v.slice(1, 3), 16) / 255, parseInt(v.slice(3, 5), 16) / 255, parseInt(v.slice(5, 7), 16) / 255]
  }
  return [237 / 255, 235 / 255, 227 / 255]
}

function hexRGB(hex: string): RGB {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]
}

const PRESET: Record<Preset, { levels: number; front: number; dir: Dir; duration: number; grey?: boolean; bits?: boolean }> = {
  imprimir: { levels: 3, front: 0.8, dir: 'right', duration: 900 },
  disolver: { levels: 3, front: 0.9, dir: 'random', duration: 1000, grey: true },
  bitmap: { levels: 3, front: 0.7, dir: 'right', duration: 850, bits: true },
  radiar: { levels: 3, front: 0.6, dir: 'center', duration: 950 },
  teletipo: { levels: 2, front: 0.14, dir: 'right', duration: 1100 },
}

export function tramaAvailable(): boolean {
  return getTrama().available
}

/** Text: silhouettes in the energy's ink → ink → type. */
export function revelar(el: HTMLElement | null, opts: RevelarOpts = {}): Promise<void> {
  if (!el) return Promise.resolve()
  const release = () => {
    el.setAttribute('data-trama', 'listo')
  }
  const engine = getTrama()
  engine.settle((e) => e.el === el)
  if (!engine.available) {
    release()
    return Promise.resolve()
  }
  const rect = el.getBoundingClientRect()
  const raster = rasterText(el, rect)
  if (!raster) {
    release()
    return Promise.resolve()
  }
  const preset = PRESET[opts.preset ?? 'imprimir']
  const size = parseFloat(getComputedStyle(el).fontSize) || 16
  const cell = opts.cell ?? Math.round(Math.min(26, Math.max(4, size * 0.4)))
  const ink = rgbFromCss(getComputedStyle(el).color) ?? undefined
  el.setAttribute('data-trama', 'activo')
  const spec: EffectSpec = {
    mode: 'text',
    el,
    texA: raster,
    duration: opts.duration ?? preset.duration,
    delay: opts.delay ?? 0,
    cell,
    levels: opts.levels ?? preset.levels,
    front: preset.front,
    dir: opts.dir ?? preset.dir,
    ink,
    tint: opts.energy !== undefined && !preset.grey && !preset.bits ? energyRGB(opts.energy) : ink,
    grey: preset.grey,
    bits: preset.bits,
    onDone: release,
    tag: 'text',
  }
  return engine.add(spec)
}

export interface ImagenOpts {
  delay?: number
  duration?: number
  dir?: Dir
  /** Viewport point the print radiates from (dir 'origin'). */
  origin?: { x: number; y: number }
  cell?: number
  levels?: number
  /** Short, finer pass — a hover confirming its target. */
  enfoque?: boolean
  /** Print out: crisp → grey blocks → nothing (an exit). */
  ceniza?: boolean
}

/** An image prints out of its own coarse blocks. */
export function revelarImagen(img: HTMLImageElement | null, opts: ImagenOpts = {}): Promise<void> {
  if (!img) return Promise.resolve()
  const release = () => {
    if (!opts.ceniza) img.setAttribute('data-trama-img', 'listo')
  }
  const engine = getTrama()
  engine.settle((e) => e.el === img)
  if (!engine.available) {
    release()
    return Promise.resolve()
  }
  const rect = img.getBoundingClientRect()
  const raster = rasterImage(img, rect)
  if (!raster) {
    release()
    return Promise.resolve()
  }
  const quick = Boolean(opts.enfoque)
  const short = Math.min(rect.width, rect.height)
  const cell = opts.cell ?? Math.round(Math.max(8, Math.min(quick ? 14 : 32, short / (quick ? 16 : 9))))
  img.setAttribute('data-trama-img', 'activo')
  return engine.add({
    mode: 'image',
    el: img,
    texA: raster,
    duration: opts.duration ?? (quick ? 340 : opts.ceniza ? 520 : 760),
    delay: opts.delay ?? 0,
    cell,
    levels: opts.levels ?? (quick ? 2 : 3),
    front: quick ? 1 : 0.75,
    dir: opts.dir ?? (opts.origin ? 'origin' : quick ? 'random' : 'down'),
    origin: opts.origin,
    paper: paperOf(img),
    grey: opts.ceniza,
    reverse: opts.ceniza,
    onDone: release,
    tag: 'image',
  })
}

export interface CruzarOpts {
  duration?: number
  dir?: Dir
  cell?: number
  levels?: number
}

/**
 * Cross two plates inside `frame` (the element whose rect they fill). `from`
 * is captured now; `to` must already be loaded. Hide the DOM plates for the
 * duration yourself (the frame gets `data-trama-img="activo"`).
 */
export function cruzar(frame: HTMLElement | null, from: HTMLImageElement | null, to: HTMLImageElement | null, opts: CruzarOpts = {}): Promise<void> {
  if (!frame || !from || !to) return Promise.resolve()
  const engine = getTrama()
  const release = () => frame.setAttribute('data-trama-img', 'listo')
  engine.settle((e) => e.el === frame)
  if (!engine.available) {
    release()
    return Promise.resolve()
  }
  const rect = frame.getBoundingClientRect()
  const a = rasterImage(from, rect)
  const b = rasterImage(to, rect)
  if (!a || !b) {
    release()
    return Promise.resolve()
  }
  frame.setAttribute('data-trama-img', 'activo')
  return engine.add({
    mode: 'cross',
    el: frame,
    texA: a,
    texB: b,
    duration: opts.duration ?? 900,
    cell: opts.cell ?? Math.round(Math.max(12, Math.min(32, Math.min(rect.width, rect.height) / 16))),
    levels: opts.levels ?? 3,
    front: 0.55,
    dir: opts.dir ?? 'left',
    onDone: release,
    tag: 'cross',
  })
}

export interface HojaOpts {
  origin?: { x: number; y: number } | null
  energy?: number
  duration?: number
  reverse?: boolean
}

/** A sheet (panel) comes off the press, clearing outward from `origin`. */
export function imprimirHoja(el: HTMLElement | null, opts: HojaOpts = {}): Promise<void> {
  if (!el) return Promise.resolve()
  const engine = getTrama()
  if (!engine.available) return Promise.resolve()
  const bg = rgbFromCss(getComputedStyle(el).backgroundColor)
  return engine.add({
    mode: 'mask',
    el,
    duration: opts.duration ?? (opts.reverse ? 300 : 520),
    cell: 28,
    levels: 3,
    front: 0.55,
    dir: opts.origin ? 'origin' : 'center',
    origin: opts.origin ?? undefined,
    paper: bg ?? paperOf(el),
    tint: opts.energy !== undefined ? energyRGB(opts.energy) : undefined,
    reverse: opts.reverse,
    tag: 'sheet',
  })
}

/**
 * A band of ink blocks passes over a region — the grid retuning. Only the
 * part of `el` that is on screen is swept (a tall grid would hide the pass).
 */
export function barrido(el: HTMLElement | null, opts: { energy?: number; dir?: 'down' | 'up' } = {}) {
  if (!el) return
  const engine = getTrama()
  if (!engine.available) return
  const b = el.getBoundingClientRect()
  const top = Math.max(0, b.top)
  const bottom = Math.min(window.innerHeight, b.bottom)
  if (bottom - top < 40 || b.width < 40) return
  engine.add({
    mode: 'sweep',
    rect: { x: b.left, y: top, width: b.width, height: bottom - top },
    duration: 560,
    cell: 12,
    levels: 1,
    front: 1,
    dir: opts.dir === 'up' ? 'up' : 'down',
    tint: opts.energy !== undefined ? energyRGB(opts.energy) : undefined,
    tag: 'sweep',
  })
}

/** A small dithered ring where something was committed. */
export function chispa(x: number, y: number, energy: number, radius = 44) {
  const engine = getTrama()
  if (!engine.available) return
  const size = radius * 2
  engine.add({
    mode: 'burst',
    rect: { x: x - radius, y: y - radius, width: size, height: size },
    duration: 480,
    cell: 4,
    levels: 1,
    front: 1,
    dir: 'center',
    tint: energyRGB(energy),
    tag: 'burst',
  })
}

/** Finish every gesture now — or only those outside `root` (a modal opening over them). */
export function asentar(root?: Element | null) {
  const engine = getTrama()
  if (!root) return engine.settle()
  engine.settle((e) => !(e.el && root.contains(e.el)))
}

export { hexRGB }
