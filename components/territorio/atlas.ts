/**
 * TERRITORIO — texture atlases.
 *
 * Art arrives through Next's optimizer (`/_next/image?url=…&w=128|256`),
 * which makes remote flyers same-origin (the canvas is never tainted) and
 * shares the browser cache with every card in the app. Each image is
 * center-cropped into a square slot (a slab's bbox is ~square; the shader
 * does the final cover-fit) and copied straight into its slot with
 * texSubImage2D — no full-atlas re-upload, mipmaps rebuilt in batches.
 *
 * Two tiers: a low atlas every piece gets (the land), a high atlas for the
 * pieces that are large on screen right now. Slots are LRU by last sight;
 * the queue is re-prioritised by distance to the camera on every pick.
 */

import * as THREE from 'three'
import { isOptimizable } from '@/lib/imageHosts'

export interface AtlasRect {
  u0: number
  v0: number
  u1: number
  v1: number
}

interface Slot {
  src: string | null
  /** Last time on screen; Infinity while reserved by an in-flight load. */
  seen: number
}

type Priority = () => number

/** Same-origin source for any artwork URL (or null when there is none). */
export function artSource(url: string | null, width: number): string | null {
  if (!url) return null
  if (url.startsWith('data:') || url.startsWith('blob:')) return url
  // The optimizer refuses SVG; local vectors are same-origin anyway.
  if (url.startsWith('/') && /\.svg($|\?)/i.test(url)) return url
  // Hosts outside next.config's allow-list (art people pasted from anywhere)
  // are refused by the optimizer, and fetched raw they'd taint the canvas:
  // the piece keeps its energy plate instead of a request that can only fail.
  if (/^https?:\/\//.test(url) && !isOptimizable(url)) return null
  if (url.startsWith('/') || /^https?:\/\//.test(url)) {
    // q=75: the one quality Next allows by default (and next/image's own).
    return `/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=75`
  }
  return null
}

async function decode(src: string, signal: AbortSignal): Promise<ImageBitmap | HTMLImageElement> {
  if (/\.svg($|\?)/i.test(src) && !src.startsWith('/_next/')) {
    const img = new Image()
    img.decoding = 'async'
    img.src = src
    await img.decode()
    return img
  }
  const res = await fetch(src, { signal, credentials: 'same-origin' })
  if (!res.ok) throw new Error(`art ${res.status}`)
  const blob = await res.blob()
  return createImageBitmap(blob, { premultiplyAlpha: 'none' })
}

export class Atlas {
  readonly texture: THREE.DataTexture
  readonly width: number
  readonly height: number
  readonly slot: number
  private cols: number
  private slots: Slot[]
  private bySrc = new Map<string, number>()
  private pending = new Map<string, Priority>()
  private failed = new Set<string>()
  private inflight = 0
  private aborts = new Set<AbortController>()
  private dirtyMips = false
  private lastMip = 0
  private disposed = false
  private renderer: THREE.WebGLRenderer | null = null
  onLoaded: (src: string) => void = () => {}
  onEvicted: (src: string) => void = () => {}

  constructor(
    width: number,
    height: number,
    slot: number,
    private concurrency: number,
  ) {
    this.width = width
    this.height = height
    this.slot = slot
    this.cols = Math.floor(width / slot)
    this.slots = Array.from({ length: this.cols * Math.floor(height / slot) }, () => ({ src: null, seen: 0 }))
    const data = new Uint8Array(width * height * 4)
    // Obsidian raised, so an unfilled slot never flashes white.
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 17
      data[i + 1] = 16
      data[i + 2] = 22
      data[i + 3] = 255
    }
    const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat)
    tex.colorSpace = THREE.NoColorSpace
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.generateMipmaps = true
    tex.wrapS = THREE.ClampToEdgeWrapping
    tex.wrapT = THREE.ClampToEdgeWrapping
    tex.anisotropy = 4
    tex.needsUpdate = true
    this.texture = tex
  }

  /** Allocate GPU storage (with a full mip chain) once a renderer exists. */
  attach(renderer: THREE.WebGLRenderer) {
    if (this.renderer) return
    this.renderer = renderer
    renderer.initTexture(this.texture)
    // From here on mips are rebuilt in batches, not per copy; the CPU copy
    // of the blank atlas is no longer needed.
    this.texture.generateMipmaps = false
    ;(this.texture.image as { data: Uint8Array | null }).data = null
  }

  get capacity(): number {
    return this.slots.length
  }

  rectOf(src: string): AtlasRect | null {
    const i = this.bySrc.get(src)
    return i === undefined ? null : this.rectForSlot(i)
  }

  private rectForSlot(i: number): AtlasRect {
    const x = (i % this.cols) * this.slot
    const y = Math.floor(i / this.cols) * this.slot
    const inset = 1.5
    return {
      u0: (x + inset) / this.width,
      v0: (y + inset) / this.height,
      u1: (x + this.slot - inset) / this.width,
      v1: (y + this.slot - inset) / this.height,
    }
  }

  has(src: string): boolean {
    return this.bySrc.has(src)
  }

  isFailed(src: string): boolean {
    return this.failed.has(src)
  }

  isPending(src: string): boolean {
    return this.pending.has(src)
  }

  /** Mark a source as on screen (LRU). */
  touch(src: string, now: number) {
    const i = this.bySrc.get(src)
    if (i !== undefined) this.slots[i].seen = now
  }

  request(src: string, priority: Priority) {
    if (this.bySrc.has(src) || this.failed.has(src)) return
    this.pending.set(src, priority)
  }

  cancel(src: string) {
    this.pending.delete(src)
  }

  /** Called every frame: start loads, rebuild mips when a batch landed. */
  pump(now: number) {
    if (!this.renderer || this.disposed) return
    while (this.inflight < this.concurrency && this.pending.size) {
      let best: string | null = null
      let bestP = Infinity
      for (const [src, pr] of this.pending) {
        const v = pr()
        if (v < bestP) {
          bestP = v
          best = src
        }
      }
      if (best === null) break
      const slot = this.allocate(now)
      if (slot < 0) break // everything resident is on screen — wait
      this.pending.delete(best)
      this.slots[slot] = { src: best, seen: Infinity }
      void this.load(best, slot)
    }
    if (this.dirtyMips && (this.inflight === 0 || now - this.lastMip > 450)) {
      this.buildMips()
      this.lastMip = now
    }
  }

  private allocate(now: number): number {
    let oldest = -1
    let oldestSeen = Infinity
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i]
      if (s.src === null) return i
      // Never evict what was on screen in the last second (or in flight).
      if (s.seen < now - 1000 && s.seen < oldestSeen) {
        oldestSeen = s.seen
        oldest = i
      }
    }
    if (oldest < 0) return -1
    const evicted = this.slots[oldest].src!
    this.bySrc.delete(evicted)
    this.slots[oldest] = { src: null, seen: 0 }
    this.onEvicted(evicted)
    return oldest
  }

  private async load(src: string, slot: number) {
    this.inflight++
    const ctl = new AbortController()
    this.aborts.add(ctl)
    let bmp: ImageBitmap | HTMLImageElement | null = null
    let cropped: ImageBitmap | null = null
    let ok = false
    try {
      bmp = await decode(src, ctl.signal)
      if (this.disposed) return
      const iw = bmp instanceof HTMLImageElement ? bmp.naturalWidth || bmp.width : bmp.width
      const ih = bmp instanceof HTMLImageElement ? bmp.naturalHeight || bmp.height : bmp.height
      if (!iw || !ih) throw new Error('empty art')
      const side = Math.min(iw, ih)
      const sx = Math.round((iw - side) / 2)
      // Portrait flyers keep a little more of the top (titles live there).
      const sy = Math.round(ih > iw ? (ih - side) * 0.38 : (ih - side) / 2)
      cropped = await createImageBitmap(bmp, sx, sy, side, side, {
        resizeWidth: this.slot,
        resizeHeight: this.slot,
        resizeQuality: 'high',
        premultiplyAlpha: 'none',
      })
      if (this.disposed || !this.renderer) return
      const x = (slot % this.cols) * this.slot
      const y = Math.floor(slot / this.cols) * this.slot
      const tmp = new THREE.Texture(cropped as unknown as HTMLImageElement)
      tmp.flipY = false
      this.renderer.copyTextureToTexture(tmp, this.texture, null, new THREE.Vector2(x, y))
      tmp.dispose()
      this.slots[slot] = { src, seen: performance.now() }
      this.bySrc.set(src, slot)
      this.dirtyMips = true
      ok = true
      this.onLoaded(src)
    } catch {
      if (!ctl.signal.aborted) this.failed.add(src)
    } finally {
      if (!ok && !this.disposed) this.slots[slot] = { src: null, seen: 0 }
      this.aborts.delete(ctl)
      if (bmp && !(bmp instanceof HTMLImageElement)) bmp.close()
      cropped?.close()
      this.inflight--
    }
  }

  private buildMips() {
    const r = this.renderer
    if (!r) return
    this.dirtyMips = false
    const gl = r.getContext() as WebGL2RenderingContext
    const props = r.properties.get(this.texture) as { __webglTexture?: WebGLTexture }
    if (!props.__webglTexture) return
    r.state.bindTexture(gl.TEXTURE_2D, props.__webglTexture)
    gl.generateMipmap(gl.TEXTURE_2D)
    r.state.unbindTexture()
  }

  dispose() {
    this.disposed = true
    this.aborts.forEach((a) => a.abort())
    this.aborts.clear()
    this.pending.clear()
    this.texture.dispose()
  }
}
