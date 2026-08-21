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
// The skin is the `landing-v2.html` "prisma 2008" prototype from
// _Gradiente Ops/prototypes/fractal-hero: paper ground, the grotesco face on
// stage, and the animated prism field behind everything (see PrismField). The
// terminal-cockpit version it replaces is gone; what survived the reskin is the
// door itself — iniciar sesión, insertar código, lista de espera — plus the
// whole invitación path underneath it, untouched.
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
  // unbox does, so there's no point dressing this in the landing skin — the
  // RegistroCard keeps its own chrome on the dark ground.
  if (inviteState === 'ready' && invite) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-base p-4">
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
          color — lifting toward white keeps it clean. It concentrates behind
          the content and leaves the edges of the composition intact: that's
          where the prism lives. */}
      <div className="wl-scrim" aria-hidden />

      <main className="wl-main">
        <section className={`wl-hero${formOpen ? ' wl-form-open' : ''}`}>
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
                    className="wl-cell wl-brk"
                    onClick={() => openLogin('login')}
                  >
                    <span className="wl-ic" aria-hidden="true">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </span>
                    <span>
                      <b>Iniciar sesión</b>
                      <i>Usuario registrado</i>
                    </span>
                  </button>

                  <button
                    type="button"
                    className="wl-cell wl-brk"
                    onClick={() => setPanel('codigo')}
                  >
                    <span className="wl-ic" aria-hidden="true">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m9 8-4 4 4 4" />
                        <path d="m15 8 4 4-4 4" />
                      </svg>
                    </span>
                    <span>
                      <b>Insertar código</b>
                      <i>Acceso por invitación</i>
                    </span>
                  </button>
                </div>

                <button
                  className="wl-bar wl-brk"
                  type="button"
                  onClick={() => setPanel('wait')}
                >
                  ¿Sin código? &gt;&gt; Unirme a la lista de espera &lt;&lt;
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
          --wl-ink: #14141b;
          --wl-paper: #f6f3ee;
          --wl-mono: var(--font-space-mono), ui-monospace, SFMono-Regular, Menlo, monospace;
          background: var(--wl-paper);
          color: var(--wl-ink);
          font: 400 16px/1.5 var(--font-space-grotesk), ui-sans-serif, -apple-system, sans-serif;
          -webkit-font-smoothing: antialiased;
          overflow-x: hidden;
        }
        .wl-fallback {
          position: fixed;
          inset: 0;
          z-index: 0;
          background: linear-gradient(
            100deg,
            #f4f1e6 0%,
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
              rgba(249, 247, 243, 0.72) 0%,
              rgba(249, 247, 243, 0.44) 48%,
              rgba(249, 247, 243, 0.16) 72%,
              transparent 88%
            ),
            linear-gradient(
              to bottom,
              rgba(249, 247, 243, 0.3) 0%,
              transparent 22%,
              transparent 70%,
              rgba(249, 247, 243, 0.42) 100%
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
          padding: clamp(16px, 2.4vw, 28px) clamp(16px, 4vw, 48px) clamp(26px, 4.5vh, 54px);
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

        /* Bracket corners. They're the current site's signature and survive the
           change of skin without needing color. */
        .wl-brk {
          position: relative;
        }
        .wl-brk::before,
        .wl-brk::after {
          content: '';
          position: absolute;
          width: 13px;
          height: 13px;
          border: 1.5px solid var(--wl-ink);
          opacity: 0.5;
          pointer-events: none;
        }
        .wl-brk::before {
          top: -1px;
          left: -1px;
          border-right: 0;
          border-bottom: 0;
        }
        .wl-brk::after {
          bottom: -1px;
          right: -1px;
          border-left: 0;
          border-top: 0;
        }

        .wl-cell {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 17px 19px;
          border: 1px solid rgba(22, 22, 28, 0.26);
          /* Over the prism a 13% fill isn't enough: the cell needs its own
             surface or the text is lost in the glow. */
          background: rgba(250, 248, 244, 0.74);
          backdrop-filter: blur(7px) saturate(1.15);
          -webkit-backdrop-filter: blur(7px) saturate(1.15);
          color: inherit;
          text-align: left;
          cursor: pointer;
          transition:
            background 0.2s ease,
            border-color 0.2s ease;
        }
        .wl-cell:hover {
          background: rgba(252, 251, 248, 0.9);
          border-color: rgba(22, 22, 28, 0.5);
        }
        .wl-cell .wl-ic {
          flex: 0 0 auto;
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(22, 22, 28, 0.3);
        }
        .wl-cell .wl-ic svg {
          width: 19px;
          height: 19px;
        }
        .wl-cell b {
          display: block;
          font: 500 14px/1.2 var(--wl-mono);
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .wl-cell i {
          display: block;
          margin-top: 4px;
          font: 400 10px/1.2 var(--wl-mono);
          letter-spacing: 0.14em;
          text-transform: uppercase;
          opacity: 0.52;
          font-style: normal;
        }

        .wl-bar {
          width: min(760px, 94vw);
          margin: clamp(10px, 1.4vw, 16px) auto 0;
          display: block;
          padding: 15px 18px;
          border: 1px solid rgba(22, 22, 28, 0.26);
          background: rgba(250, 248, 244, 0.74);
          backdrop-filter: blur(7px) saturate(1.15);
          -webkit-backdrop-filter: blur(7px) saturate(1.15);
          color: inherit;
          cursor: pointer;
          font: 500 12px/1.3 var(--wl-mono);
          letter-spacing: 0.11em;
          text-transform: uppercase;
          transition:
            background 0.2s ease,
            border-color 0.2s ease;
        }
        .wl-bar:hover {
          background: rgba(252, 251, 248, 0.9);
          border-color: rgba(22, 22, 28, 0.5);
        }

        /* ── panels (waitlist / código) ───────────────────────── */
        /* Same as the cells: over the prism the block needs its own surface.
           Labels and small type don't survive without it. */
        .wl-panel {
          width: min(560px, 94vw);
          margin: 0 auto;
          text-align: left;
          padding: clamp(18px, 2.4vw, 26px) clamp(18px, 2.6vw, 28px) clamp(16px, 2vw, 20px);
          border: 1px solid rgba(22, 22, 28, 0.24);
          background: rgba(250, 248, 244, 0.8);
          backdrop-filter: blur(8px) saturate(1.15);
          -webkit-backdrop-filter: blur(8px) saturate(1.15);
        }
        .wl-panel .wl-head {
          text-align: center;
          margin-bottom: clamp(12px, 1.6vw, 16px);
        }
        /* Único texto del panel — ya no hay encabezado encima, así que no es un
           subtítulo: sube un punto de tamaño y de opacidad. */
        .wl-panel .wl-head p {
          margin: 0;
          font: 400 12.5px/1.55 var(--wl-mono);
          opacity: 0.72;
          text-align: center;
        }

        .wl-f {
          margin-bottom: 9px;
        }
        .wl-f label {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          font: 400 10px/1 var(--wl-mono);
          letter-spacing: 0.14em;
          text-transform: uppercase;
          opacity: 0.55;
          margin-bottom: 6px;
        }
        .wl-f input,
        .wl-f select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid rgba(22, 22, 28, 0.26);
          background: rgba(252, 250, 247, 0.8);
          color: var(--wl-ink);
          font: 400 13.5px/1.2 var(--wl-mono);
          letter-spacing: 0.02em;
          border-radius: 0;
          transition:
            border-color 0.18s ease,
            background 0.18s ease;
        }
        .wl-f input::placeholder {
          color: rgba(22, 22, 28, 0.32);
        }
        .wl-f input:focus,
        .wl-f select:focus {
          outline: none;
          border-color: rgba(22, 22, 28, 0.7);
          background: rgba(255, 255, 255, 0.94);
        }
        .wl-f select {
          appearance: none;
          cursor: pointer;
          background-image: linear-gradient(45deg, transparent 50%, rgba(22, 22, 28, 0.5) 50%),
            linear-gradient(135deg, rgba(22, 22, 28, 0.5) 50%, transparent 50%);
          background-position: calc(100% - 17px) 55%, calc(100% - 12px) 55%;
          background-size: 5px 5px, 5px 5px;
          background-repeat: no-repeat;
        }

        .wl-go {
          width: 100%;
          margin-top: 3px;
          padding: 13px 18px;
          border: 1px solid var(--wl-ink);
          background: transparent;
          color: var(--wl-ink);
          font: 500 12px/1.3 var(--wl-mono);
          letter-spacing: 0.12em;
          text-transform: uppercase;
          cursor: pointer;
          transition:
            background 0.2s ease,
            color 0.2s ease;
        }
        .wl-go:hover {
          background: var(--wl-ink);
          color: #f3f1ec;
        }

        .wl-back {
          display: block;
          width: 100%;
          margin-top: 10px;
          padding: 0;
          border: 0;
          background: none;
          color: inherit;
          cursor: pointer;
          font: 400 10.5px/1 var(--wl-mono);
          letter-spacing: 0.13em;
          text-transform: uppercase;
          opacity: 0.5;
          text-align: center;
        }
        .wl-back:hover {
          opacity: 0.85;
        }
        .wl-go[disabled] {
          opacity: 0.5;
          cursor: default;
        }
        .wl-error {
          margin: 4px 0 8px;
          font: 400 10.5px/1.4 var(--wl-mono);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #b32a22;
          text-align: center;
        }

        .wl-peek {
          width: min(560px, 94vw);
          margin: 0 auto clamp(10px, 1.4vw, 16px);
          padding: 11px 16px;
          border: 1px solid rgba(22, 22, 28, 0.26);
          background: rgba(250, 248, 244, 0.8);
          backdrop-filter: blur(8px) saturate(1.15);
          -webkit-backdrop-filter: blur(8px) saturate(1.15);
          font: 500 11px/1.4 var(--wl-mono);
          letter-spacing: 0.13em;
          text-transform: uppercase;
          text-align: center;
        }
        .wl-peek.wl-peek-bad {
          border-color: rgba(200, 42, 34, 0.55);
          color: #b32a22;
        }

        @media (prefers-reduced-motion: reduce) {
          .wl-face,
          .wl-cell,
          .wl-bar,
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
    <div className="wl-panel wl-brk">
      <div className="wl-head">
        <h2>Insertar código</h2>
        <p>Escribe el código de tu invitación tal como llegó.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
        noValidate
      >
        <div className="wl-f">
          <label htmlFor="wl-codigo">01_ Código de invitación</label>
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
          &gt;&gt; Activar código &lt;&lt;
        </button>
        <button className="wl-back" type="button" onClick={onBack}>
          &lt; Regresar al acceso
        </button>
      </form>
    </div>
  )
}

// ── Waitlist panel ──────────────────────────────────────────────────────────
//
// Envía al mismo /api/waitlist que usa /espera — misma tabla, misma posición en
// la cola, mismo honeypot. Este panel es la entrada inline desde la puerta; la
// página /espera sigue siendo la versión larga con estadísticas.
//
// Sin encabezado, sin contador y sin numeración en las etiquetas: una sola
// línea de copy arriba y los campos. El texto de relleno se fue a propósito.
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
      <div className="wl-panel wl-brk">
        <div className="wl-head">
          <p>Señal recibida. Te avisaremos cuando la puerta se abra.</p>
        </div>
        <button className="wl-back" type="button" onClick={onBack}>
          &lt; Regresar al acceso
        </button>
      </div>
    )
  }

  return (
    <div className="wl-panel wl-brk">
      <div className="wl-head">
        <p>
          Deja tus datos y te avisaremos cuando la puerta se abra. Solo usaremos tu correo
          para avisarte del acceso. Nada más.
        </p>
      </div>

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

        {state === 'error' && <p className="wl-error">{error}</p>}

        <button className="wl-go" type="submit" disabled={state === 'sending'}>
          {state === 'sending' ? '>> Enviando <<' : '>> Unirme a la lista de espera <<'}
        </button>
        <button className="wl-back" type="button" onClick={onBack}>
          &lt; Regresar al acceso
        </button>
      </form>
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
    return <p className="wl-peek">Verificando código…</p>
  }

  const msg =
    state === 'used'
      ? 'Este código ya fue activado'
      : state === 'expired'
        ? 'Este código expiró'
        : 'Código no reconocido'
  return <p className="wl-peek wl-peek-bad">⚠ {msg}</p>
}
