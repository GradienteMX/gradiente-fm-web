'use client'

import { useEffect, useRef, useState } from 'react'
import { createExperience, type ExperienceUI } from './experience.js'
import { RegistroCard } from '@/components/welcome/RegistroCard'
import type { InviteCard } from '@/lib/invitations'

// Full invitación-3d experience as a React island — the envelope unbox +
// document pages + holo card + carousel, a faithful port of the prototype's
// main.js choreography. Takes the resolved InviteCard (from peekInviteCard): the
// holo card reads name/code/role/folio/issued; the REGISTRO form gets the full
// invite (incl. the real code for signup). Container-relative so it can embed.
export function InviteExperience({
  invite,
  onUnavailable,
}: {
  invite: InviteCard
  // Called if the WebGL context is lost after mount, so the page can fall back
  // to the inline RegistroCard instead of a frozen/blank canvas.
  onUnavailable?: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const loaderRef = useRef<HTMLDivElement>(null)
  const loaderBarRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef<HTMLDivElement>(null)
  const ctaRef = useRef<HTMLDivElement>(null)
  const ctaLinkRef = useRef<HTMLAnchorElement>(null)
  const replayRef = useRef<HTMLButtonElement>(null)
  const navRef = useRef<HTMLDivElement>(null)
  const navPrevRef = useRef<HTMLButtonElement>(null)
  const navNextRef = useRef<HTMLButtonElement>(null)
  const navLabelRef = useRef<HTMLSpanElement>(null)
  const fallbackRef = useRef<HTMLDivElement>(null)
  const srRef = useRef<HTMLDivElement>(null)

  // The experience flips this when the REGISTRO carousel piece is the hero, so
  // we overlay the real signup form (RegistroCard) centered over the 3D panel.
  const [registroActive, setRegistroActive] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const ui: Partial<ExperienceUI> = {
      loader: loaderRef.current ?? undefined,
      loaderBar: loaderBarRef.current ?? undefined,
      hint: hintRef.current ?? undefined,
      cta: ctaRef.current ?? undefined,
      ctaLink: ctaLinkRef.current,
      replayBtn: replayRef.current ?? undefined,
      nav: navRef.current ?? undefined,
      navPrev: navPrevRef.current ?? undefined,
      navNext: navNextRef.current ?? undefined,
      navLabel: navLabelRef.current ?? undefined,
      fallback: fallbackRef.current ?? undefined,
      srMirror: srRef.current ?? undefined,
      onRegistroActive: setRegistroActive,
    }
    const required: (keyof ExperienceUI)[] = [
      'loader', 'loaderBar', 'hint', 'cta', 'replayBtn',
      'nav', 'navPrev', 'navNext', 'navLabel', 'fallback', 'srMirror',
    ]
    if (!canvas || required.some((k) => !ui[k])) return

    // Initial inert state (revealed at the card phase by createExperience).
    ui.cta!.setAttribute('inert', '')
    ui.nav!.setAttribute('inert', '')

    const exp = createExperience({ canvas, ui: ui as ExperienceUI, invite })
    const onContextLost = (e: Event) => {
      e.preventDefault()
      onUnavailable?.()
    }
    canvas.addEventListener('webglcontextlost', onContextLost)
    return () => {
      canvas.removeEventListener('webglcontextlost', onContextLost)
      exp.dispose()
    }
  }, [invite, onUnavailable])

  return (
    <div className="x-exp">
      <canvas
        ref={canvasRef}
        className="x-stage"
        tabIndex={0}
        role="button"
        aria-label="Abrir el sobre de la invitación"
      />
      <div className="x-grain" aria-hidden="true" />

      <div ref={srRef} className="x-sronly" aria-live="polite" />

      <div className="x-ui x-brand">
        <strong>Gradiente</strong>
        invitación · beta cerrada
      </div>
      <div className="x-ui x-folio">
        mmxxvi · méxico
        <br />
        personas, no plataformas
      </div>

      <div ref={hintRef} className="x-ui x-hint hidden" aria-live="polite">
        toca el sobre para abrir
      </div>

      <div ref={ctaRef} className="x-ui x-cta">
        <a ref={ctaLinkRef} className="x-cta-link primary" href="#">
          Completar registro →
        </a>
        <button ref={replayRef} className="x-replay" type="button">
          Repetir
        </button>
      </div>

      <div ref={navRef} className="x-ui x-nav">
        <button ref={navPrevRef} className="x-navbtn" type="button" aria-label="Pieza anterior" title="Pieza anterior">
          ‹
        </button>
        <span ref={navLabelRef} className="x-navlabel" aria-live="polite">
          Tarjeta de acceso
        </span>
        <button ref={navNextRef} className="x-navbtn" type="button" aria-label="Siguiente pieza" title="Siguiente pieza">
          ›
        </button>
      </div>

      <div ref={loaderRef} className="x-ui x-loader">
        <div className="x-word">Gradiente</div>
        <div ref={loaderBarRef} className="x-loaderbar" />
      </div>

      <div ref={fallbackRef} className="x-ui x-fallback">
        No pudimos abrir el sobre aquí.
        <br />
        La puerta sigue abierta:{' '}
        <a href="https://gradiente.org" style={{ color: 'var(--x-phosphor)' }}>
          gradiente.org
        </a>
      </div>

      {/* Real signup form, centered over the REGISTRO panel when it's the hero. */}
      {registroActive && (
        <div className="x-registro-overlay">
          <div className="x-registro-scroll">
            <RegistroCard invite={invite} />
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .x-exp {
          --x-paper: #e8a623;
          --x-plate: #fbf7ee;
          --x-ink: #1c1813;
          --x-phosphor: #ffb000;
          --x-phosphor-soft: #ffcf6a;
          --x-muted: rgba(251, 247, 238, 0.55);
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
          color: var(--x-plate);
          font-family: 'Space Grotesk', system-ui, sans-serif;
          background: transparent;
          -webkit-font-smoothing: antialiased;
        }
        .x-stage {
          position: absolute;
          inset: 0;
          display: block;
          width: 100%;
          height: 100%;
          touch-action: none;
        }
        .x-stage.openable {
          cursor: pointer;
        }
        .x-stage:focus-visible {
          outline: 2px solid var(--x-phosphor);
          outline-offset: -2px;
        }
        .x-sronly {
          position: absolute;
          width: 1px;
          height: 1px;
          margin: -1px;
          padding: 0;
          overflow: hidden;
          clip: rect(0 0 0 0);
          white-space: nowrap;
          border: 0;
        }
        .x-grain {
          position: absolute;
          inset: -50%;
          width: 200%;
          height: 200%;
          pointer-events: none;
          opacity: 0.05;
          z-index: 30;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          animation: x-grain 0.9s steps(4) infinite;
        }
        @keyframes x-grain {
          0% { transform: translate(0, 0); }
          25% { transform: translate(-2%, 1%); }
          50% { transform: translate(1%, -2%); }
          75% { transform: translate(-1%, 2%); }
          100% { transform: translate(2%, -1%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .x-grain { animation: none; }
        }
        .x-ui { position: absolute; z-index: 40; }
        .x-brand {
          top: 22px;
          left: 24px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 12px;
          letter-spacing: 0.34em;
          text-transform: uppercase;
          color: var(--x-muted);
          line-height: 1.9;
          user-select: none;
        }
        .x-brand strong {
          display: block;
          color: var(--x-plate);
          font-weight: 600;
          font-size: 14px;
        }
        .x-folio {
          top: 22px;
          right: 24px;
          text-align: right;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--x-muted);
          line-height: 1.9;
          user-select: none;
        }
        .x-hint {
          bottom: 36px;
          left: 50%;
          transform: translateX(-50%);
          font-family: 'IBM Plex Mono', monospace;
          font-size: 12px;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: var(--x-phosphor-soft);
          text-shadow: 0 0 18px rgba(255, 140, 0, 0.45);
          max-width: min(92%, 640px);
          width: max-content;
          text-align: center;
          transition: opacity 0.6s ease;
          user-select: none;
        }
        .x-hint.hidden { opacity: 0; }
        .x-hint.raised { bottom: 96px; font-size: 11px; color: var(--x-muted); text-shadow: none; }
        .x-cta {
          bottom: 28px;
          left: 50%;
          transform: translateX(-50%) translateY(12px);
          display: flex;
          gap: 14px;
          align-items: center;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.8s ease, transform 0.8s ease;
        }
        .x-cta.visible {
          opacity: 1;
          pointer-events: auto;
          transform: translateX(-50%) translateY(0);
        }
        .x-cta-link, .x-replay {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 12px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          text-decoration: none;
          padding: 13px 22px;
          border: 1px solid rgba(251, 247, 238, 0.5);
          color: var(--x-plate);
          background: rgba(13, 7, 1, 0.55);
          backdrop-filter: blur(6px);
          cursor: pointer;
          transition: border-color 0.3s, color 0.3s, box-shadow 0.3s;
        }
        .x-cta-link.primary {
          border-color: var(--x-phosphor);
          color: var(--x-phosphor);
          text-shadow: 0 0 14px rgba(255, 176, 0, 0.4);
        }
        .x-cta-link:hover, .x-replay:hover {
          border-color: var(--x-phosphor-soft);
          color: var(--x-phosphor-soft);
          box-shadow: 0 0 24px rgba(255, 140, 0, 0.18);
        }
        .x-nav {
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 14px;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.7s ease;
        }
        .x-nav.visible { opacity: 1; }
        .x-navbtn {
          pointer-events: auto;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: 1px solid rgba(251, 247, 238, 0.4);
          background: rgba(13, 7, 1, 0.5);
          backdrop-filter: blur(6px);
          color: var(--x-plate);
          font-family: 'IBM Plex Mono', monospace;
          font-size: 26px;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding-bottom: 4px;
          transition: border-color 0.3s, color 0.3s, box-shadow 0.3s, transform 0.2s;
        }
        .x-navbtn:hover {
          border-color: var(--x-phosphor-soft);
          color: var(--x-phosphor-soft);
          box-shadow: 0 0 24px rgba(255, 140, 0, 0.18);
        }
        .x-navbtn:active { transform: scale(0.93); }
        .x-navlabel {
          position: absolute;
          bottom: 132px;
          left: 50%;
          transform: translateX(-50%);
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: var(--x-muted);
          white-space: nowrap;
          pointer-events: none;
        }
        .x-loader {
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 18px;
          background: transparent;
          z-index: 50;
          transition: opacity 0.7s ease;
        }
        .x-loader.done { opacity: 0; pointer-events: none; }
        .x-word {
          font-family: 'IBM Plex Mono', monospace;
          letter-spacing: 0.34em;
          text-transform: uppercase;
          font-size: 13px;
          color: var(--x-phosphor-soft);
          text-shadow: 0 0 18px rgba(255, 140, 0, 0.4);
        }
        .x-loaderbar {
          width: 180px;
          height: 2px;
          background: linear-gradient(90deg, #00ffff 0%, #0066ff 18%, #6600ff 34%, #ff00ff 50%, #ff0066 62%, #ff5500 76%, #ff2200 90%, #ff0000 100%);
          transform-origin: left;
          transform: scaleX(0);
          transition: transform 0.4s ease;
        }
        .x-fallback {
          display: none;
          inset: 0;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 32px;
          font-family: 'IBM Plex Mono', monospace;
          letter-spacing: 0.12em;
          font-size: 13px;
          line-height: 2;
          color: var(--x-plate);
          z-index: 60;
        }
        .x-registro-overlay {
          position: absolute;
          inset: 0;
          z-index: 45;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          pointer-events: none;
          animation: x-registro-in 0.12s ease-out both;
        }
        /* The form scrolls WITHIN the overlay so the soft keyboard / landscape
           can't strand the top fields or the CREAR IDENTIDAD button on phones:
           cap the wrapper at the visible height and let it scroll internally
           instead of vertically centering taller-than-screen content with no
           way to reach the clipped ends. */
        .x-registro-scroll {
          width: 100%;
          max-width: 28rem;
          max-height: 100%;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          pointer-events: auto;
        }
        .x-registro-overlay > * { pointer-events: auto; }
        @keyframes x-registro-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      ` }} />
    </div>
  )
}
