'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useAuth } from '@/components/auth/useAuth'
import { peekInviteCard, type InviteCard } from '@/lib/invitations'
import { normalizeInviteCode } from '@/lib/identity'
import { RegistroCard } from '@/components/welcome/RegistroCard'
import { PrismField } from '@/components/welcome/PrismField'
import {
  WAITLIST_ALIAS_MAX,
  WAITLIST_CITIES,
  // WAITLIST_SOURCES — lo usa el campo "¿cómo nos encontraste?", apagado abajo.
} from '@/lib/waitlist'

// The full invitación-3d experience is heavy (three.js + assets) — load it only
// when a valid code resolves, so the gate page stays light for everyone else.
const InviteExperience = dynamic(
  () => import('@/components/welcome/invite3d/InviteExperience').then((m) => m.InviteExperience),
  { ssr: false },
)

// Same Google Fonts the prototype loads (Fraunces / IBM Plex Mono / Rajdhani /
// Space Grotesk) — the holo card + overlay chrome need them.
const INVITE_FONTS =
  'https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500;600;700&family=Rajdhani:wght@500;600;700&family=Space+Grotesk:wght@300;400;500&display=swap'

// /welcome — invite-only landing for anonymous visitors. Middleware redirects
// everyone here when they have no session, and bounces them off again once
// they're logged in.
//
// The bones are the `landing-v2.html` "prisma 2008" prototype (paper ground,
// grotesco face on stage, the animated prism field behind everything); the
// CHROME speaks «EL PLIEGO» — the dashboard's editorial-brutalist language —
// so the door and the panel share one voice:
//   · tokens: paper #EDEBE3 / raised #F6F4EC / ink #111111 (+soft/faint),
//     acid #D8FF00 only as a fill-block with ink on top, red #C42B20
//   · type: Syne bold for titles, Space Grotesk 15/22 body, Space Mono
//     11/16 · 13/18 for labels and controls (the dashboard's d-scale, as raw
//     px — this branch predates the dashboard tailwind tokens)
//   · chrome: straight 1px ink borders + hairline-headed panels (the
//     DashPopup anatomy), NO bracket corners, no »« arrow dressing
//   · interaction: ink-fill hover inversion, 2px ink focus ring at 2px
//     offset, ≥44px targets
// What survived untouched is the door itself — iniciar sesión, insertar
// código, lista de espera — plus the whole invitación path underneath.
export default function WelcomePage() {
  const { openLogin, isAuthed, authResolved } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const codigo = searchParams.get('codigo') ?? ''

  // Belt-and-suspenders for the "logged in but URL stuck on /welcome"
  // case. Middleware handles fresh requests, but `useAuth.login` only
  // calls `router.refresh()` — which re-fetches RSC data without
  // updating the URL bar, so without this effect the user lands with
  // /welcome in the URL while the home payload is being served. The
  // moment auth resolves to a real user, push them to /.
  useEffect(() => {
    if (authResolved && isAuthed) {
      router.replace('/')
    }
  }, [authResolved, isAuthed, router])

  // Which panel the door is showing. 'gate' is the two cells + the waitlist
  // bar; the other two swap in below the face, which shrinks to make room.
  const [panel, setPanel] = useState<'gate' | 'codigo' | 'wait'>('gate')
  const [invite, setInvite] = useState<InviteCard | null>(null)
  const [inviteState, setInviteState] = useState<
    'idle' | 'loading' | 'ready' | 'used' | 'expired' | 'invalid'
  >('idle')
  const [codeInput, setCodeInput] = useState('')

  // WebGL gate: the 3D experience needs it. Without it, a valid code falls back
  // to the inline RegistroCard (still a working signup path).
  const [webglOk, setWebglOk] = useState(true)
  // If the live 3D invite loses its WebGL context mid-flow (low-end phones,
  // backgrounding, GPU pressure), fall back to the inline RegistroCard — a
  // working signup path — instead of leaving a dead canvas.
  const [inviteFailed, setInviteFailed] = useState(false)
  const handleInviteUnavailable = useCallback(() => setInviteFailed(true), [])
  useEffect(() => {
    try {
      const c = document.createElement('canvas')
      setWebglOk(!!(c.getContext('webgl2') || c.getContext('webgl')))
    } catch {
      setWebglOk(false)
    }
  }, [])

  useEffect(() => {
    if (!authResolved || isAuthed || !codigo) return
    let cancelled = false
    setInviteState('loading')
    peekInviteCard(codigo).then((res) => {
      if (cancelled) return
      setInvite(res)
      setInviteState(res.status === 'active' ? 'ready' : res.status)
    })
    return () => {
      cancelled = true
    }
  }, [authResolved, isAuthed, codigo])

  // Invited user with a valid code + WebGL → the full immersive unbox: envelope
  // → holo card → the 5 cards → REGISTRO form, filling the viewport. The form's
  // signup creates the account, then the redirect effect above sends them home.
  if (inviteState === 'ready' && invite && webglOk && !inviteFailed) {
    return (
      <>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={INVITE_FONTS} />
        <div className="fixed inset-0 z-[55] overflow-hidden bg-base">
          <InviteExperience invite={invite} onUnavailable={handleInviteUnavailable} />
        </div>
      </>
    )
  }

  // No-WebGL fallback for a valid code. The prism needs the same WebGL2 the 3D
  // unbox does, so there is no landing skin to dress this in — the card sits
  // on a plain ink scrim, the same paper-sheet-over-ink relationship
  // LoginOverlay uses. (RegistroCard stopped carrying its own dark chrome in
  // fase F; it is a paper sheet now.)
  if (inviteState === 'ready' && invite) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-ink p-4">
        <RegistroCard invite={invite} />
      </div>
    )
  }

  const formOpen = panel !== 'gate'

  return (
    <div className="wl-root fixed inset-0 z-50 overflow-auto">
      {/* Painted underneath the canvas in case WebGL never starts. */}
      <div className="wl-fallback" aria-hidden />
      <PrismField />
      {/* Readability scrim. Over a field this saturated, darkening dirties the
          color — lifting toward paper keeps it clean. It concentrates behind
          the content and leaves the edges of the composition intact: that's
          where the prism lives. */}
      <div className="wl-scrim" aria-hidden />

      <main className="wl-main">
        <section className={`wl-hero${formOpen ? ' wl-form-open' : ''}`}>
          {/* Brand line — the masthead anchor of the dashboard, in ink on
              paper. The only Syne display moment of the gate. */}
          <header className="wl-brand">
            <span className="wl-wordmark">GRADIENTE</span>
          </header>

          <div className="wl-stage">
            <img
              className="wl-face"
              src="/welcome/grotesco-face.png"
              width={794}
              height={782}
              alt="Gradiente · subsistema cultural"
            />
          </div>

          <div className="wl-foot">
            {/* Resolved-invitation status for non-active codes (verifying,
                spent, expired, unrecognized). An active code never reaches
                here — it early-returns above. */}
            {codigo && inviteState !== 'idle' && inviteState !== 'ready' && (
              <InvitePeekStrip state={inviteState} />
            )}

            {panel === 'gate' && (
              <>
                <div className="wl-gate">
                  <button
                    type="button"
                    className="wl-cell"
                    onClick={() => openLogin('login')}
                  >
                    <span>
                      <b>Iniciar sesión</b>
                    </span>
                  </button>

                  <button
                    type="button"
                    className="wl-cell"
                    onClick={() => setPanel('codigo')}
                  >
                    <span>
                      <b>Acceso por invitación</b>
                    </span>
                  </button>
                </div>

                {/* The acid moment — one fill-block with ink on top, the same
                    weight CREAR NUEVO carries on the dashboard. */}
                <button className="wl-bar" type="button" onClick={() => setPanel('wait')}>
                  <span>¿SIN CÓDIGO? — UNIRME A LA LISTA DE ESPERA</span>
                  <span aria-hidden="true">→</span>
                </button>
              </>
            )}

            {panel === 'codigo' && (
              <CodigoPanel
                value={codeInput}
                onChange={setCodeInput}
                onBack={() => setPanel('gate')}
                onSubmit={() => {
                  // Normalize before the round trip: this input auto-
                  // capitalizes on phones and codes are matched exactly, so
                  // a hand-typed code would otherwise never resolve.
                  const c = normalizeInviteCode(codeInput)
                  if (c) router.push(`/welcome?codigo=${encodeURIComponent(c)}`)
                }}
              />
            )}

            {panel === 'wait' && <WaitlistPanel onBack={() => setPanel('gate')} />}
          </div>
        </section>
      </main>

      <style jsx global>{`
        .wl-root {
          /* EL PLIEGO tokens (lib/dashboard/palette.ts values — this branch
             predates the dashboard tailwind tokens, so they live here as CSS
             custom properties; change in lockstep). */
          --wl-ink: #111111;
          --wl-ink-soft: #3d3a33;
          --wl-ink-faint: #5c5850;
          --wl-paper: #edebe3;
          --wl-raised: #f6f4ec;
          --wl-acid: #d8ff00;
          --wl-red: #c42b20;
          --wl-syne: var(--font-syne), sans-serif;
          --wl-mono: var(--font-space-mono), ui-monospace, SFMono-Regular, Menlo, monospace;
          background: var(--wl-paper);
          color: var(--wl-ink);
          /* d15 body register */
          font: 400 15px/1.47 var(--font-space-grotesk), ui-sans-serif, -apple-system, sans-serif;
          -webkit-font-smoothing: antialiased;
          overflow-x: hidden;
        }
        .wl-fallback {
          position: fixed;
          inset: 0;
          z-index: 0;
          background: linear-gradient(
            100deg,
            #edebe3 0%,
            #eef0f6 26%,
            #cfd6ea 33%,
            #ff4fa0 38%,
            #ffd24a 42%,
            #46d6ff 46%,
            #f0483f 62%,
            #d8322c 100%
          );
          filter: saturate(0.85);
        }
        .wl-scrim {
          position: fixed;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background:
            radial-gradient(
              40% 44% at 52% 40%,
              rgba(237, 235, 227, 0.74) 0%,
              rgba(237, 235, 227, 0.46) 48%,
              rgba(237, 235, 227, 0.16) 72%,
              transparent 88%
            ),
            linear-gradient(
              to bottom,
              rgba(237, 235, 227, 0.34) 0%,
              transparent 22%,
              transparent 70%,
              rgba(237, 235, 227, 0.44) 100%
            );
        }
        .wl-main {
          position: relative;
          z-index: 2;
        }

        /* By default the face takes the center of the free space and the door
           stays at the bottom. With a panel open everything collapses back to
           one centered column, because the form needs the height. */
        .wl-hero {
          min-height: 100svh;
          display: flex;
          flex-direction: column;
          text-align: center;
          padding: clamp(14px, 2vw, 24px) clamp(16px, 4vw, 48px) clamp(26px, 4.5vh, 54px);
        }
        .wl-stage {
          flex: 1 1 auto;
          display: grid;
          place-items: center;
          min-height: 0;
        }
        .wl-foot {
          flex: 0 0 auto;
          width: 100%;
        }
        .wl-hero.wl-form-open {
          justify-content: center;
        }
        .wl-hero.wl-form-open .wl-stage {
          flex: 0 0 auto;
        }

        /* ── brand line ───────────────────────────────────────── */
        .wl-brand {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 16px;
          text-align: left;
        }
        /* The mark rides a paper-glass chip so it stays legible wherever the
           prism's hue cycle happens to be dark. */
        .wl-wordmark {
          border: 1px solid var(--wl-ink);
          background: rgba(246, 244, 236, 0.78);
          backdrop-filter: blur(7px) saturate(1.1);
          -webkit-backdrop-filter: blur(7px) saturate(1.1);
        }
        .wl-wordmark {
          padding: 2px 10px;
          font: 800 18px/24px var(--wl-syne);
          letter-spacing: -0.01em;
          color: var(--wl-ink);
        }

        .wl-face {
          display: block;
          width: min(375px, 65vw);
          height: auto;
          margin: 0 auto;
          opacity: 0.92;
          transition: width 0.35s ease;
        }
        /* With a panel open the face gives up space instead of pushing it off. */
        .wl-hero.wl-form-open .wl-face {
          width: min(112px, 24vw);
          margin-bottom: clamp(12px, 1.6vw, 16px);
        }

        /* ── door ─────────────────────────────────────────────── */
        .wl-gate {
          width: min(760px, 94vw);
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: clamp(10px, 1.4vw, 16px);
        }
        @media (max-width: 620px) {
          .wl-gate {
            grid-template-columns: 1fr;
          }
        }

        /* One focus grammar, page-wide: 2px ink outline at 2px offset. */
        .wl-cell:focus-visible,
        .wl-bar:focus-visible,
        .wl-go:focus-visible,
        .wl-chip:focus-visible,
        .wl-f input:focus-visible,
        .wl-f select:focus-visible {
          outline: 2px solid var(--wl-ink);
          outline-offset: 2px;
        }

        /* Door cells — straight 1px ink boxes on a translucent paper-raised
           surface (the prism needs the glass); hover is the dashboard's
           ink-fill inversion, no bracket corners. */
        .wl-cell {
          display: flex;
          align-items: center;
          gap: 15px;
          min-height: 44px;
          padding: 16px 18px;
          border: 1px solid var(--wl-ink);
          background: rgba(246, 244, 236, 0.78);
          backdrop-filter: blur(7px) saturate(1.1);
          -webkit-backdrop-filter: blur(7px) saturate(1.1);
          color: var(--wl-ink);
          text-align: left;
          cursor: pointer;
          transition:
            background 0.15s ease,
            color 0.15s ease;
        }
        .wl-cell:hover {
          background: var(--wl-ink);
          color: var(--wl-paper);
        }
        .wl-cell b {
          display: block;
          font: 700 13px/18px var(--wl-mono);
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        /* The waitlist bar is the page's ONE acid use: a fill-block with ink
           on top (the CREAR NUEVO weight). Hover inverts to ink. */
        .wl-bar {
          width: min(760px, 94vw);
          margin: clamp(10px, 1.4vw, 16px) auto 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          min-height: 44px;
          padding: 13px 18px;
          border: 1px solid var(--wl-ink);
          background: var(--wl-acid);
          color: var(--wl-ink);
          cursor: pointer;
          font: 700 13px/18px var(--wl-mono);
          letter-spacing: 0.12em;
          text-transform: uppercase;
          text-align: left;
          transition:
            background 0.15s ease,
            color 0.15s ease;
        }
        .wl-bar:hover {
          background: var(--wl-ink);
          color: var(--wl-paper);
        }

        /* ── panels (waitlist / código) ───────────────────────── */
        /* The DashPopup anatomy: Syne title + one working control on a
           hairline-headed sheet. Solid enough surface for small labels. */
        .wl-panel {
          width: min(560px, 94vw);
          margin: 0 auto;
          text-align: left;
          border: 1px solid var(--wl-ink);
          background: rgba(246, 244, 236, 0.9);
          backdrop-filter: blur(8px) saturate(1.1);
          -webkit-backdrop-filter: blur(8px) saturate(1.1);
        }
        .wl-panel-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          padding: 7px 18px;
          border-bottom: 1px solid var(--wl-ink);
        }
        .wl-panel-head h2 {
          margin: 0;
          font: 700 22px/32px var(--wl-syne);
          text-transform: uppercase;
          letter-spacing: 0;
          color: var(--wl-ink);
        }
        .wl-chip {
          flex: 0 0 auto;
          padding: 3px 9px;
          border: 1px solid var(--wl-ink);
          background: transparent;
          color: var(--wl-ink);
          cursor: pointer;
          font: 400 13px/18px var(--wl-mono);
          letter-spacing: 0.12em;
          text-transform: uppercase;
          transition:
            background 0.15s ease,
            color 0.15s ease;
        }
        .wl-chip:hover {
          background: var(--wl-ink);
          color: var(--wl-paper);
        }
        .wl-panel-body {
          padding: clamp(16px, 2.2vw, 22px) clamp(16px, 2.4vw, 24px) clamp(14px, 1.8vw, 18px);
        }
        .wl-copy {
          margin: 0 0 14px;
          font: 400 13px/1.55 var(--font-space-grotesk), ui-sans-serif, sans-serif;
          color: var(--wl-ink-soft);
        }

        .wl-f {
          margin-bottom: 10px;
        }
        .wl-f label {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          font: 400 11px/16px var(--wl-mono);
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--wl-ink-soft);
          margin-bottom: 5px;
        }
        .wl-f input,
        .wl-f select {
          width: 100%;
          min-height: 44px;
          padding: 9px 12px;
          border: 1px solid var(--wl-ink);
          background: var(--wl-raised);
          color: var(--wl-ink);
          font: 400 15px/22px var(--font-space-grotesk), ui-sans-serif, sans-serif;
          border-radius: 0;
          transition: background 0.15s ease;
        }
        /* Codes are mono material. */
        .wl-f input#wl-codigo {
          font: 400 15px/22px var(--wl-mono);
          letter-spacing: 0.04em;
        }
        .wl-f input::placeholder {
          color: var(--wl-ink-faint);
          opacity: 0.7;
        }
        .wl-f input:focus,
        .wl-f select:focus {
          background: #ffffff;
        }
        .wl-f select {
          appearance: none;
          cursor: pointer;
          background-image: linear-gradient(45deg, transparent 50%, var(--wl-ink) 50%),
            linear-gradient(135deg, var(--wl-ink) 50%, transparent 50%);
          background-position: calc(100% - 17px) 55%, calc(100% - 12px) 55%;
          background-size: 5px 5px, 5px 5px;
          background-repeat: no-repeat;
        }

        /* Primary submit — acid fill-block, ink on top, arrow glyph. */
        .wl-go {
          width: 100%;
          margin-top: 6px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          min-height: 44px;
          padding: 12px 16px;
          border: 1px solid var(--wl-ink);
          background: var(--wl-acid);
          color: var(--wl-ink);
          font: 700 13px/18px var(--wl-mono);
          letter-spacing: 0.12em;
          text-transform: uppercase;
          text-align: left;
          cursor: pointer;
          transition:
            background 0.15s ease,
            color 0.15s ease;
        }
        .wl-go:hover {
          background: var(--wl-ink);
          color: var(--wl-paper);
        }
        .wl-go[disabled] {
          opacity: 0.45;
          cursor: default;
        }
        .wl-go[disabled]:hover {
          background: var(--wl-acid);
          color: var(--wl-ink);
        }

        .wl-error {
          margin: 6px 0 8px;
          font: 700 13px/18px var(--wl-mono);
          letter-spacing: 0.06em;
          color: var(--wl-red);
          text-align: left;
        }

        .wl-peek {
          width: min(560px, 94vw);
          margin: 0 auto clamp(10px, 1.4vw, 16px);
          padding: 11px 16px;
          border: 1px solid var(--wl-ink);
          background: rgba(246, 244, 236, 0.9);
          backdrop-filter: blur(8px) saturate(1.1);
          -webkit-backdrop-filter: blur(8px) saturate(1.1);
          font: 700 13px/18px var(--wl-mono);
          letter-spacing: 0.12em;
          text-transform: uppercase;
          text-align: center;
          color: var(--wl-ink);
        }
        .wl-peek.wl-peek-bad {
          border-color: var(--wl-red);
          color: var(--wl-red);
        }

        @media (prefers-reduced-motion: reduce) {
          .wl-face,
          .wl-cell,
          .wl-bar,
          .wl-chip,
          .wl-go {
            transition: none;
          }
        }
      `}</style>
    </div>
  )
}

// ── Código panel ────────────────────────────────────────────────────────────
//
// Manual code entry → re-enters /welcome with ?codigo= so the same peek +
// invitación path runs.
function CodigoPanel({
  value,
  onChange,
  onSubmit,
  onBack,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  onBack: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    // Don't yank the soft keyboard up before the user orients; autofocus only
    // on precise (mouse) pointers.
    if (window.matchMedia('(pointer:fine)').matches) inputRef.current?.focus()
  }, [])

  return (
    <div className="wl-panel">
      <div className="wl-panel-head">
        <h2>Insertar código</h2>
        <button className="wl-chip" type="button" onClick={onBack}>
          VOLVER
        </button>
      </div>

      <div className="wl-panel-body">
        <p className="wl-copy">Escribe el código de tu invitación tal como llegó.</p>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit()
          }}
          noValidate
        >
          <div className="wl-f">
            <label htmlFor="wl-codigo">Código de invitación</label>
            <input
              id="wl-codigo"
              ref={inputRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="INV-XXXXXXXXXXXXXXXX"
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
            />
          </div>

          <button className="wl-go" type="submit">
            <span>ACTIVAR CÓDIGO</span>
            <span aria-hidden="true">→</span>
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Waitlist panel ──────────────────────────────────────────────────────────
//
// Envía al mismo /api/waitlist que usa /espera — misma tabla, misma posición en
// la cola, mismo honeypot. Este panel es la entrada inline desde la puerta; la
// página /espera sigue siendo la versión larga con estadísticas.
function WaitlistPanel({ onBack }: { onBack: () => void }) {
  const [alias, setAlias] = useState('')
  const [email, setEmail] = useState('')
  const [city, setCity] = useState<string>(WAITLIST_CITIES[0])
  // Honeypot. Los usuarios reales nunca lo ven; los bots lo autocompletan y el
  // route finge que todo salió bien sin insertar nada.
  const [tel, setTel] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const aliasRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    aliasRef.current?.focus()
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (state === 'sending') return
    setState('sending')
    setError('')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // `source` (¿cómo nos encontraste?) va apagado en esta vista — el route
        // lo degrada a null cuando no llega.
        body: JSON.stringify({ alias, email, city, tel }),
      })
      const data = await res.json()
      if (!res.ok || data.ok === false) {
        setError(data.error ?? 'No se pudo enviar. Inténtalo de nuevo.')
        setState('error')
        return
      }
      setState('done')
    } catch {
      setError('No se pudo enviar. Revisa tu conexión.')
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <div className="wl-panel">
        <div className="wl-panel-head">
          <h2>Lista de espera</h2>
          <button className="wl-chip" type="button" onClick={onBack}>
            VOLVER
          </button>
        </div>
        <div className="wl-panel-body">
          <p className="wl-copy">
            Señal recibida. Te avisaremos cuando la puerta se abra.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="wl-panel">
      <div className="wl-panel-head">
        <h2>Lista de espera</h2>
        <button className="wl-chip" type="button" onClick={onBack}>
          VOLVER
        </button>
      </div>

      <div className="wl-panel-body">
        <p className="wl-copy">
          Deja tus datos y te avisaremos cuando la puerta se abra. Solo usaremos tu
          correo para avisarte del acceso. Nada más.
        </p>

        <form onSubmit={submit} noValidate>
          <div className="wl-f">
            <label htmlFor="wl-alias">Nombre / Alias</label>
            <input
              id="wl-alias"
              ref={aliasRef}
              type="text"
              maxLength={WAITLIST_ALIAS_MAX}
              placeholder="NOMADA_77"
              autoComplete="nickname"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
            />
          </div>
          <div className="wl-f">
            <label htmlFor="wl-mail">Correo electrónico</label>
            <input
              id="wl-mail"
              type="email"
              placeholder="tu@señal.net"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="wl-f">
            <label htmlFor="wl-city">Ciudad / Zona</label>
            <select id="wl-city" value={city} onChange={(e) => setCity(e.target.value)}>
              {WAITLIST_CITIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* APAGADO — "¿Cómo nos encontraste?". El campo se queda aquí para
              reactivarlo sin volver a escribirlo (el catálogo vive en
              WAITLIST_SOURCES de lib/waitlist):
              <div className="wl-f">
                <label htmlFor="wl-src">¿Cómo nos encontraste?</label>
                <select id="wl-src" defaultValue={WAITLIST_SOURCES[0]}>
                  {WAITLIST_SOURCES.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </div>
          */}

          {/* Honeypot — fuera de pantalla, nunca visible ni tabulable. */}
          <input
            type="text"
            name="tel"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={tel}
            onChange={(e) => setTel(e.target.value)}
            style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
          />

          {state === 'error' && <p className="wl-error">⚠ {error}</p>}

          <button className="wl-go" type="submit" disabled={state === 'sending'}>
            <span>{state === 'sending' ? 'ENVIANDO…' : 'UNIRME A LA LISTA DE ESPERA'}</span>
            <span aria-hidden="true">→</span>
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Resolved-invitation strip ───────────────────────────────────────────────
//
// Status for /welcome?codigo= when the code is NOT registerable (verifying, or
// spent / expired / unrecognized). An active code renders the invitación
// experience instead, so 'ready' never reaches this strip.
function InvitePeekStrip({
  state,
}: {
  state: 'loading' | 'used' | 'expired' | 'invalid'
}) {
  if (state === 'loading') {
    return <p className="wl-peek">VERIFICANDO CÓDIGO…</p>
  }

  const msg =
    state === 'used'
      ? 'ESTE CÓDIGO YA FUE ACTIVADO'
      : state === 'expired'
        ? 'ESTE CÓDIGO EXPIRÓ'
        : 'CÓDIGO NO RECONOCIDO'
  return <p className="wl-peek wl-peek-bad">⚠ {msg}</p>
}
