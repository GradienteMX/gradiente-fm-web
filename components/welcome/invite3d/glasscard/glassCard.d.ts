// Type contract for the vendored (verbatim) glassCard.js port from invitacion-3d.
// The .js is intentionally not type-checked; this declares its public surface.
import type { Object3D, WebGLRenderer, Scene } from 'three'

export interface GlassCardInvite {
  name?: string
  code?: string
  role?: string
  folio?: string
  issued?: string
  /** Partner attached to the invite code; renders as the first over-glass sticker. */
  partner?: { title?: string; logoUrl?: string | null } | null
}

/** A cosmetic chip placed over the glass (back-right zone). Today fed by the
 *  invite's partner; later by a user's owned cosmetics. */
export interface CardSticker {
  url: string
  kind?: string
  label?: string
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
  /** Explicit sticker list; defaults to the invite's partner when omitted. */
  stickers?: CardSticker[]
}): Promise<GlassCard>

export function setupGlassEnvironment(
  renderer: WebGLRenderer,
  scene: Scene,
  intensity?: number,
): void
