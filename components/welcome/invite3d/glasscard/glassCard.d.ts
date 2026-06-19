// Type contract for the vendored (verbatim) glassCard.js port from invitacion-3d.
// The .js is intentionally not type-checked; this declares its public surface.
import type { Object3D, WebGLRenderer, Scene } from 'three'

export interface GlassCardInvite {
  name?: string
  code?: string
  role?: string
  folio?: string
  issued?: string
}

export interface GlassCard {
  root: Object3D
  tilt: Object3D
  flip: Object3D
  meshes: Object3D[]
  state: { interactive: boolean; flipped: boolean; flipping: boolean; reduced: boolean }
  update(dt: number, elapsed: number, active?: boolean): void
  setPointer(x: number, y: number): void
  setInteractive(on: boolean): void
  setReduced(on: boolean): void
  flipCard(): void
}

export function buildGlassCard(opts?: {
  invite?: GlassCardInvite
  reduced?: boolean
}): Promise<GlassCard>

export function setupGlassEnvironment(
  renderer: WebGLRenderer,
  scene: Scene,
  intensity?: number,
): void
