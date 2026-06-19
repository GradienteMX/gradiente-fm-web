'use client'

// ── HP DEATH RITUAL — decay erosion + the dissolve (WAVE 2) ──────────────────
//
// Two parts, both driven purely by the real HP value (see useDecayState):
//
//  1. DECAY EROSION (always-on, the main deliverable). A CSS-only overlay that
//     sits over the card IMAGE/FRAME only (never text). Three honest layers,
//     all driven by one inline custom property `--mortality` (0..1):
//       a. dither/halftone — the at-rest flyer-halftone idiom, but COARSENING:
//          the dot pitch widens and dot ink darkens as the item dies, so the
//          print "breaks up" into ever-larger grain. Pure radial-gradient dots,
//          zero blur, zero GPU shader (matches the .flyer-halftone house rule).
//       b. edge fray — a mask-image (radial + corner-eating linears) that eats
//          the card's perimeter to transparent, so a dying card frays at the
//          edges into the page. Strength scales with mortality.
//       c. desaturation pull — a faint neutral (estática #948E85, slot 5 of the
//          thermal ramp — the hinge where signal dies into static) scrim in
//          `color` blend so chroma drains toward grey as the item dies.
//     It is a STATIC data readout — nothing animates — so it is identical under
//     prefers-reduced-motion and never approaches the 3Hz luminance limit.
//     Subtle at mortality 0.3, clearly "fading" near 1.0. Renders nothing when
//     not dying (useDecayState gates it).
//
//  2. THE DISSOLVE (the ritual moment, best-effort). When a dying card actually
//     leaves the feed it should dissolve to orange ash rather than vanish. The
//     grid (ContentGrid) unmounts exits INSTANTLY — no AnimatePresence, and
//     popLayout is a documented bug we must not reintroduce. So the card cannot
//     animate its own React subtree on the way out (React removes the DOM node
//     synchronously). Instead, on unmount of a DYING card, we CLONE the card's
//     rendered frame into a detached, fixed-position overlay node appended to
//     <body> and play a self-contained WAAPI dissolve-to-ash on the clone,
//     removing it when the animation ends. This is fully self-contained: it
//     never touches the grid's layout, never fights Framer's `layout="position"`
//     slide, and cleans itself up. Skipped entirely under reduced motion
//     (instant disappearance, which is what the grid already does).
//
//     NOTE / LIMITATION: the clone is a flat visual snapshot of the frame at
//     unmount, positioned over where the card was. It reads as the card
//     crumbling in place. It does NOT reflow with the grid (the surviving cards
//     slide under it via Framer) — acceptable for a ~600ms one-shot. If a
//     future grid-coordinated exit is wanted, the clean hook is an
//     AnimatePresence around MosaicItem with a custom exit that DOESN'T use
//     popLayout — see the TODO at the call site.

import { useEffect, useRef, type CSSProperties } from 'react'
import { VIBE_SLOT_COLORS } from '@/lib/utils'

// Estática hinge — slot 5, the near-neutral grey where signal dies into static.
const ESTATICA = VIBE_SLOT_COLORS[5] // '#948E85'
// Brand ember for the dissolve ash. Slot 8 FUEGO — the meter's overload zone.
const ASH_ORANGE = VIBE_SLOT_COLORS[8] // '#FC6C0F'

// Dissolve timing. One-shot, well under any flicker concern (single fade, not
// an oscillation).
const DISSOLVE_MS = 600

interface DecayStateProps {
  /** 0..1 mortality from useDecayState. Caller only mounts this when dying. */
  mortality: number
  reducedMotion: boolean
}

/**
 * The always-on erosion overlay. Renders two absolutely-positioned, pointer-
 * events-none layers that composite over the card image (mounted inside the
 * .group article, above the image, below the text content which lives in a
 * later sibling with its own stacking). Honest, static, CSS-only.
 */
export function DecayErosion({ mortality }: { mortality: number }) {
  // Coarsening halftone: pitch grows 4px → 10px and ink opacity rises with
  // mortality. Larger pitch = the print visibly breaking into bigger dots as
  // it dies. Deterministic structure (no RNG).
  const pitch = 4 + mortality * 6 // px
  const dotInk = (0.25 + mortality * 0.55).toFixed(3) // 0.25 → 0.8

  // Edge fray: the mask keeps the centre opaque and eats the perimeter. At
  // mortality 0 the inset is ~100% (no eating); near 1 it pulls in to ~58%,
  // so the frame dissolves into the page at the edges. We expose the inset as
  // a percentage of the half-extent.
  const frayInner = (100 - mortality * 42).toFixed(1) // 100% → 58%
  const frayOuter = (100 - mortality * 12).toFixed(1) // 100% → 88%

  // Desaturation pull: estática scrim opacity. Subtle even at full mortality —
  // it drains chroma, doesn't paint the card grey.
  const desatOpacity = (mortality * 0.45).toFixed(3)

  // Halftone layer. mask-image frays its OWN edges so the grain itself thins
  // toward the perimeter (the dots don't just stop at a hard line).
  const halftoneStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    mixBlendMode: 'multiply',
    backgroundImage: `radial-gradient(circle, rgba(13,13,13,${dotInk}) 0 1px, transparent ${(pitch * 0.42).toFixed(2)}px), radial-gradient(circle, rgba(13,13,13,${dotInk}) 0 1px, transparent ${(pitch * 0.42).toFixed(2)}px)`,
    backgroundSize: `${pitch.toFixed(2)}px ${pitch.toFixed(2)}px, ${pitch.toFixed(2)}px ${pitch.toFixed(2)}px`,
    backgroundPosition: `0 0, ${(pitch / 2).toFixed(2)}px ${(pitch / 2).toFixed(2)}px`,
    opacity: (0.35 + mortality * 0.4).toFixed(3),
  }

  // Edge-fray layer: a transparent box whose box-shadow / radial mask eats the
  // image at the edges. Implemented as a mask on the desaturation scrim so the
  // grey pull AND the frame share the same fraying silhouette.
  const frayMask = `radial-gradient(ellipse ${frayOuter}% ${frayOuter}% at 50% 50%, #000 ${frayInner}%, transparent 100%)`

  const desatStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    mixBlendMode: 'color',
    backgroundColor: ESTATICA,
    opacity: desatOpacity,
  }

  // Edge-eater: paints the page background (#0D0D0D) creeping in from the
  // perimeter via an inverse radial mask — the card visibly frays to the
  // surface behind it. Uses currentColor-free explicit #0D0D0D (the app bg).
  const frayStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    backgroundColor: '#0D0D0D',
    // Inverse mask: opaque (visible bg) at the edges, transparent in the
    // centre. = 1 - centre mask.
    WebkitMaskImage: `radial-gradient(ellipse ${frayOuter}% ${frayOuter}% at 50% 50%, transparent ${frayInner}%, #000 100%)`,
    maskImage: `radial-gradient(ellipse ${frayOuter}% ${frayOuter}% at 50% 50%, transparent ${frayInner}%, #000 100%)`,
    opacity: (mortality * 0.85).toFixed(3),
  }

  // The fray mask on the image itself can't be applied from here (we don't own
  // the img), so the edge effect is the inverse-bg layer above. The frayMask
  // var is consumed by the halftone thinning toward edges:
  halftoneStyle.WebkitMaskImage = frayMask
  halftoneStyle.maskImage = frayMask

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[1]"
      data-decay-erosion
    >
      <div style={desatStyle} />
      <div style={halftoneStyle} />
      <div style={frayStyle} />
    </div>
  )
}

/**
 * The dissolve. Mounted (always, cheaply) by a dying card; it does nothing on
 * mount and only fires its WAAPI ash-dissolve on UNMOUNT, by cloning the
 * card frame into a detached body-level overlay. `frameRef` points at the
 * card's outer frame element to snapshot.
 */
export function useDissolveOnUnmount(
  frameRef: React.RefObject<HTMLElement>,
  active: boolean,
  reducedMotion: boolean,
) {
  // Latest values, read at unmount time (the cleanup closure captures mount-
  // time values otherwise).
  const activeRef = useRef(active)
  const reducedRef = useRef(reducedMotion)
  activeRef.current = active
  reducedRef.current = reducedMotion

  useEffect(() => {
    const el = frameRef.current
    // Cleanup runs on unmount. We snapshot geometry+visual NOW into a detached
    // clone because React will remove `el` synchronously after this returns.
    return () => {
      if (!activeRef.current || reducedRef.current) return
      if (!el || typeof document === 'undefined') return
      // Respect a late reduced-motion change.
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      // Geometry: getBoundingClientRect is correct HERE — the card lives in the
      // grid (no overlay panel transform), so the documented in-overlay gBCR
      // trap does not apply. Cards are never dissolved from inside an overlay.
      const rect = el.getBoundingClientRect()
      if (rect.width < 2 || rect.height < 2) return // detached/hidden — skip

      // Only dissolve cards the user can actually SEE leave. Off-screen exits
      // are scroll/teardown churn, not the ritual moment — and dissolving them
      // would spray body-level clones on route navigation (every card unmounts
      // at once). The ritual is for an on-screen dying card dropping from view.
      const vw = window.innerWidth
      const vh = window.innerHeight
      const onScreen =
        rect.bottom > 0 && rect.top < vh && rect.right > 0 && rect.left < vw
      if (!onScreen) return

      const clone = el.cloneNode(true) as HTMLElement
      // Strip anything interactive/animated from the clone so it's an inert
      // visual snapshot.
      clone.style.position = 'fixed'
      clone.style.left = `${rect.left}px`
      clone.style.top = `${rect.top}px`
      clone.style.width = `${rect.width}px`
      clone.style.height = `${rect.height}px`
      clone.style.margin = '0'
      clone.style.pointerEvents = 'none'
      clone.style.zIndex = '40'
      clone.style.contain = 'paint'
      clone.setAttribute('aria-hidden', 'true')
      clone.removeAttribute('tabindex')
      clone.removeAttribute('role')

      // An ash wash laid over the clone: brand-ember fill that blooms as the
      // frame disintegrates. mix-blend 'screen' so it lifts toward orange ash
      // rather than flat-painting.
      const ash = document.createElement('div')
      ash.style.position = 'absolute'
      ash.style.inset = '0'
      ash.style.background = `radial-gradient(ellipse at 50% 55%, ${ASH_ORANGE} 0%, ${ASH_ORANGE}00 70%)`
      ash.style.mixBlendMode = 'screen'
      ash.style.opacity = '0'
      ash.style.pointerEvents = 'none'
      clone.appendChild(ash)

      document.body.appendChild(clone)

      // Dissolve-to-ash: the frame contracts slightly and fades while the ash
      // bloom rises then falls — reads as the card crumbling upward into
      // embers. A single fade (no oscillation): photosensitivity-safe.
      const cleanup = () => {
        clone.remove()
      }

      const frameAnim = clone.animate(
        [
          { opacity: 1, transform: 'scale(1)', filter: 'brightness(1) saturate(1)' },
          { opacity: 0.85, transform: 'scale(0.992) translateY(-2px)', filter: 'brightness(1.15) saturate(0.6)', offset: 0.45 },
          { opacity: 0, transform: 'scale(0.97) translateY(-10px)', filter: 'brightness(1.4) saturate(0.2)' },
        ],
        { duration: DISSOLVE_MS, easing: 'cubic-bezier(0.4, 0, 0.7, 1)', fill: 'forwards' },
      )
      ash.animate(
        [
          { opacity: 0 },
          { opacity: 0.7, offset: 0.4 },
          { opacity: 0 },
        ],
        { duration: DISSOLVE_MS, easing: 'ease-out', fill: 'forwards' },
      )

      frameAnim.onfinish = cleanup
      frameAnim.oncancel = cleanup
      // Safety net in case the animation never finishes (tab hidden, etc.).
      window.setTimeout(cleanup, DISSOLVE_MS + 250)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
