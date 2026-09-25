/**
 * ESTUCHE — what every credencial window shares on the one GL context:
 *
 *   · the studio: a bright, paper-toned photo studio painted on an
 *     equirectangular canvas (a big key softbox up-left, a strip light on
 *     the right, a rim above, dark flags at the sides and a dim room behind
 *     the viewer) prefiltered through PMREM, like the original's
 *     `softWarmEnvTexture` — the acrylic, the foils and the vinyl reflect it.
 *     It stays in display space (NoColorSpace in → display values out).
 *   · three single-channel masks from the original card (public/tarjeta,
 *     768 px, 64 grey levels — they tile below a pixel at card size, ~1 MB
 *     for the three): case-roughness (the case's scratches, the stickers'
 *     scuffs), case-brushed (the guía's brushed grain), holo-pattern (the
 *     lector's diffraction, holo stickers). Uploaded as R8.
 *
 * Reference-counted: the last card to unmount releases them after a grace
 * period (navigating between profiles doesn't rebuild the studio).
 */

import * as THREE from 'three'

export interface Estuche {
  /** PMREM (cube-UV) studio. */
  env: THREE.Texture
  /** Defines a ShaderMaterial needs to `#include <cube_uv_reflection_fragment>`. */
  envDefines: Record<string, string | number>
  rough: { value: THREE.Texture }
  brushed: { value: THREE.Texture }
  holo: { value: THREE.Texture }
  /** Called whenever a mask finishes loading (the scene redraws once). */
  onChange: Set<() => void>
}

const TEX = '/tarjeta/'

let shared: Estuche | null = null
let owner: THREE.WebGLRenderer | null = null
let envTarget: THREE.WebGLRenderTarget | null = null
let refs = 0
let releaseTimer: ReturnType<typeof setTimeout> | null = null
const loaded: THREE.Texture[] = []
let grey: THREE.DataTexture | null = null

function greyTexture(): THREE.DataTexture {
  if (grey) return grey
  grey = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1, THREE.RGBAFormat)
  grey.colorSpace = THREE.NoColorSpace
  grey.needsUpdate = true
  return grey
}

/** The studio, as an equirect canvas (u: atan2(z, x), v: up = top). */
function paintStudio(): HTMLCanvasElement {
  const W = 1024
  const H = 512
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const x = c.getContext('2d')!
  // Paper cyclorama: bright ceiling, warm horizon, a deeper floor.
  const g = x.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#f6f3ec')
  g.addColorStop(0.36, '#e9e5da')
  g.addColorStop(0.5, '#d9d4c6')
  g.addColorStop(0.62, '#c6c0b1')
  g.addColorStop(1, '#a9a395')
  x.fillStyle = g
  x.fillRect(0, 0, W, H)

  const soft = (cx: number, cy: number, rx: number, ry: number, color: string, alpha: number) => {
    x.save()
    x.translate(cx, cy)
    x.scale(rx, ry)
    const rg = x.createRadialGradient(0, 0, 0, 0, 0, 1)
    rg.addColorStop(0, color)
    rg.addColorStop(1, 'rgba(0,0,0,0)')
    x.globalAlpha = alpha
    x.fillStyle = rg
    x.beginPath()
    x.arc(0, 0, 1, 0, Math.PI * 2)
    x.fill()
    x.restore()
  }
  const box = (cx: number, cy: number, w: number, h: number, color: string, blur: number) => {
    x.save()
    x.filter = `blur(${blur}px)`
    x.fillStyle = color
    x.fillRect(cx - w / 2, cy - h / 2, w, h)
    x.restore()
  }

  // The room behind the viewer (+Z, u = .75): dim, so a card facing you
  // reflects almost nothing and reads clean at rest.
  soft(768, 262, 190, 150, 'rgba(58,55,49,1)', 0.78)
  // Dark flags at the sides: the bevels alternate light / dark as you tilt.
  box(985, 250, 90, 230, '#2a2723', 10)
  box(40, 250, 90, 230, '#2a2723', 10)
  box(560, 330, 70, 120, '#4a463f', 14)
  // Key softbox up-left, a strip light on the right, a rim above.
  box(868, 160, 124, 78, '#fffefa', 6)
  soft(868, 160, 130, 90, 'rgba(255,252,244,1)', 0.35)
  box(655, 230, 22, 170, '#fdfbf6', 3)
  box(768, 92, 300, 16, '#faf7ef', 4)
  // A warm bounce card low on the left.
  soft(900, 360, 120, 50, 'rgba(236,214,170,1)', 0.45)
  return c
}

function build(renderer: THREE.WebGLRenderer): Estuche {
  const studio = new THREE.CanvasTexture(paintStudio())
  studio.mapping = THREE.EquirectangularReflectionMapping
  studio.colorSpace = THREE.NoColorSpace
  studio.needsUpdate = true
  const pmrem = new THREE.PMREMGenerator(renderer)
  envTarget = pmrem.fromEquirectangular(studio)
  pmrem.dispose()
  studio.dispose()
  const env = envTarget.texture
  const imageHeight = (env.image as { height: number }).height
  const maxMip = Math.log2(imageHeight) - 2
  const envDefines = {
    ENVMAP_TYPE_CUBE_UV: '',
    CUBEUV_TEXEL_WIDTH: 1 / (3 * Math.max(Math.pow(2, maxMip), 7 * 16)),
    CUBEUV_TEXEL_HEIGHT: 1 / imageHeight,
    CUBEUV_MAX_MIP: `${maxMip.toFixed(1)}`,
  }

  const onChange = new Set<() => void>()
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy())
  const est: Estuche = {
    env,
    envDefines,
    rough: { value: greyTexture() },
    brushed: { value: greyTexture() },
    holo: { value: greyTexture() },
    onChange,
  }
  const loader = new THREE.TextureLoader()
  const load = (file: string, target: { value: THREE.Texture }) => {
    loader.load(
      TEX + file,
      (t) => {
        if (shared !== est) {
          t.dispose()
          return
        }
        t.colorSpace = THREE.NoColorSpace
        // Grey masks: one channel is all we read (a quarter of the memory).
        t.format = THREE.RedFormat
        t.wrapS = t.wrapT = THREE.RepeatWrapping
        t.anisotropy = aniso
        t.needsUpdate = true
        loaded.push(t)
        target.value = t
        onChange.forEach((fn) => fn())
      },
      undefined,
      () => {
        /* keep the grey stand-in */
      },
    )
  }
  load('case-roughness.png', est.rough)
  load('case-brushed.png', est.brushed)
  load('holo-pattern.png', est.holo)
  return est
}

function destroy() {
  envTarget?.dispose()
  envTarget = null
  loaded.splice(0).forEach((t) => t.dispose())
  shared = null
  owner = null
}

export function acquireEstuche(renderer: THREE.WebGLRenderer): Estuche {
  if (releaseTimer) {
    clearTimeout(releaseTimer)
    releaseTimer = null
  }
  if (shared && owner !== renderer) destroy()
  if (!shared) {
    shared = build(renderer)
    owner = renderer
  }
  refs++
  return shared
}

export function releaseEstuche() {
  refs = Math.max(0, refs - 1)
  if (refs > 0 || releaseTimer) return
  releaseTimer = setTimeout(() => {
    releaseTimer = null
    if (refs === 0) destroy()
  }, 20_000)
}
