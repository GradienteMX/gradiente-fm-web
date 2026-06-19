// Type contract for the vendored experience.js (createExperience). The .js is a
// faithful port of the prototype's main.js choreography; this declares its
// public surface for the React island.
import type { GlassCardInvite } from './glasscard/glassCard'

export interface ExperienceUI {
  loader: HTMLElement
  loaderBar: HTMLElement
  hint: HTMLElement
  cta: HTMLElement
  ctaLink: HTMLAnchorElement | null
  replayBtn: HTMLElement
  nav: HTMLElement
  navPrev: HTMLElement
  navNext: HTMLElement
  navLabel: HTMLElement
  fallback: HTMLElement
  srMirror: HTMLElement
  /** Called by the experience when the REGISTRO carousel piece gains/loses the
   *  hero slot, so the React layer can show/hide the real signup form over it. */
  onRegistroActive?: (active: boolean) => void
}

export function createExperience(opts: {
  canvas: HTMLCanvasElement
  ui: ExperienceUI
  invite: GlassCardInvite
}): { dispose: () => void }
