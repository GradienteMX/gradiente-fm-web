'use client'

// ── LoginOverlay — the auth door, in «EL PLIEGO» chrome ─────────────────────
//
// The EVA login-terminal skin is retired: the modal now speaks the dashboard
// language (paper sheet, ink hairlines, Syne title + CERRAR chip — the
// DashPopup anatomy — mono d11/d13 registers, acid reserved for the submit
// fill-block, red #C42B20 for errors, one 2px-ink focus grammar). It fronts
// the prisma-2008 landing, so the sheet is opaque paper over an ink scrim.
//
// The logic is untouched from the terminal version: mode state machine,
// guarded submit (every field disabled while submitting), Esc close, body
// scroll lock, focus timing, ?codigo= pre-fill.

import { useEffect, useRef, useState } from 'react'
import { useAuth } from './useAuth'
import { normalizeInviteCode, normalizeUsername } from '@/lib/identity'

type Mode = 'login' | 'signup'

// The page-wide focus grammar (§10(14)) — inlined so auth stays free of
// dashboard imports.
const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

export function LoginOverlay() {
  const { loginOpen, closeLogin, login, signup, loginInitialMode, loginInitialCode } = useAuth()
  const [mode, setMode] = useState<Mode>('login')

  // Login mode: identifier (username or email) + password.
  // Signup mode: email + username + password + invite code.
  const [identifier, setIdentifier] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justAuthed, setJustAuthed] = useState(false)

  const firstFieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (loginOpen) {
      setMode(loginInitialMode)
      setIdentifier('')
      setEmail('')
      setUsername('')
      setPassword('')
      setInviteCode(loginInitialCode)   // pre-fill from ?codigo= if present
      setError(null)
      setJustAuthed(false)
      setSubmitting(false)
      const t = setTimeout(() => firstFieldRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [loginOpen, loginInitialMode, loginInitialCode])

  useEffect(() => {
    if (!loginOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLogin()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [loginOpen, closeLogin])

  useEffect(() => {
    if (!loginOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [loginOpen])

  if (!loginOpen) return null

  // Guarded end to end: every field is disabled while `submitting`, so an
  // exception escaping here would leave a dead form the user can only exit by
  // reloading. Same failure the invite RegistroCard had.
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      if (mode === 'login') {
        const ok = await login(identifier.trim(), password)
        if (ok) {
          setJustAuthed(true)
          setTimeout(() => closeLogin(), 700)
        } else {
          setError('CREDENCIALES INVÁLIDAS · ACCESO DENEGADO')
        }
      } else {
        const result = await signup({
          email: email.trim(),
          password,
          username: normalizeUsername(username),
          inviteCode: normalizeInviteCode(inviteCode),
        })
        if (result.ok) {
          setJustAuthed(true)
          setTimeout(() => closeLogin(), 700)
        } else {
          setError(result.error.toUpperCase())
        }
      }
    } catch {
      setError('NO SE PUDO COMPLETAR LA OPERACIÓN. INTENTA DE NUEVO.')
    } finally {
      setSubmitting(false)
    }
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    setError(null)
  }

  return (
    <div
      className="overlay-backdrop-in fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={closeLogin}
    >
      {/* Ink scrim — the DashPopup ground. */}
      <div className="absolute inset-0 bg-ink/60" aria-hidden />

      <div
        onClick={(e) => e.stopPropagation()}
        className="overlay-panel-in relative z-10 flex w-full max-w-md flex-col overflow-hidden border border-ink bg-paper text-ink"
        style={{ transformOrigin: 'center center' }}
      >
        {/* ── Head — Syne title + CERRAR chip (DashPopup anatomy) ─────────── */}
        <div className="flex items-baseline gap-3 border-b border-ink px-5 py-1.5">
          <h1 className="min-w-0 truncate font-syne text-d28 font-bold uppercase leading-8">
            {mode === 'login' ? 'Identifícate' : 'Nueva identidad'}
          </h1>
          <div className="flex-1" />
          <button
            onClick={closeLogin}
            aria-label="Cerrar"
            className={`shrink-0 border border-ink px-2 py-0.5 font-mono text-d13 tracking-widest text-ink hover:bg-ink hover:text-paper ${FOCUS_RING}`}
          >
            CERRAR
          </button>
        </div>

        {/* ── Mode tabs — latch fill-inversion chips ──────────────────────── */}
        <div className="flex border-b border-ink font-mono text-d13 tracking-widest">
          <button
            type="button"
            onClick={() => switchMode('login')}
            aria-pressed={mode === 'login'}
            data-cue="latch"
            className={`min-h-11 flex-1 px-4 uppercase transition-colors ${
              mode === 'login'
                ? 'bg-ink font-bold text-paper'
                : 'text-ink-soft hover:bg-paper-raised hover:text-ink'
            } ${FOCUS_RING}`}
          >
            Ingresar
          </button>
          <span aria-hidden className="w-px bg-ink" />
          <button
            type="button"
            onClick={() => switchMode('signup')}
            aria-pressed={mode === 'signup'}
            data-cue="latch"
            className={`min-h-11 flex-1 px-4 uppercase transition-colors ${
              mode === 'signup'
                ? 'bg-ink font-bold text-paper'
                : 'text-ink-soft hover:bg-paper-raised hover:text-ink'
            } ${FOCUS_RING}`}
          >
            Registrarse
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 p-5">
          <p className="font-grotesk text-d13 leading-snug text-ink-soft">
            {mode === 'login'
              ? 'Acceso a redacción, partners y lectores del subsistema.'
              : 'Necesitas un código de invitación para crear una cuenta.'}
          </p>

          <form onSubmit={submit} className="flex flex-col gap-3">
            {mode === 'login' ? (
              <>
                <Field
                  label="USUARIO O EMAIL"
                  value={identifier}
                  onChange={setIdentifier}
                  inputRef={firstFieldRef}
                  autoComplete="username"
                  disabled={submitting || justAuthed}
                />
                <Field
                  label="PASSWORD"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  autoComplete="current-password"
                  disabled={submitting || justAuthed}
                />
              </>
            ) : (
              <>
                <Field
                  label="EMAIL"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  inputRef={firstFieldRef}
                  autoComplete="email"
                  disabled={submitting || justAuthed}
                />
                <Field
                  label="USERNAME"
                  value={username}
                  onChange={(v) => setUsername(normalizeUsername(v))}
                  autoComplete="username"
                  disabled={submitting || justAuthed}
                />
                <Field
                  label="PASSWORD"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  autoComplete="new-password"
                  disabled={submitting || justAuthed}
                />
                <Field
                  label="CÓDIGO DE INVITACIÓN"
                  value={inviteCode}
                  onChange={setInviteCode}
                  autoComplete="off"
                  mono
                  disabled={submitting || justAuthed}
                />
              </>
            )}

            {/* Consequence copy — full red register, never a soft tint. */}
            {error && (
              <div className="border border-sys-red-paper px-3 py-2 font-mono text-d13 font-bold leading-relaxed tracking-widest text-sys-red-paper">
                ⚠ {error}
              </div>
            )}

            {/* Positive stamp — the acid block with ink on top. */}
            {justAuthed && (
              <div className="border border-ink bg-acid px-3 py-2 font-mono text-d13 font-bold tracking-widest text-ink">
                ACCESO CONCEDIDO · REDIRIGIENDO…
              </div>
            )}

            {/* Primary submit — acid fill-block, arrow glyph, 44px. */}
            <button
              type="submit"
              disabled={submitting || justAuthed}
              className={`mt-1 flex min-h-11 items-center justify-between gap-3 border border-ink bg-acid px-4 font-mono text-d13 font-bold uppercase tracking-widest text-ink transition-colors enabled:hover:bg-ink enabled:hover:text-paper disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS_RING}`}
            >
              <span>
                {submitting
                  ? 'PROCESANDO…'
                  : mode === 'login'
                  ? 'ENTRAR AL SUBSISTEMA'
                  : 'CREAR IDENTIDAD'}
              </span>
              <span aria-hidden>→</span>
            </button>
          </form>

          <p className="font-grotesk text-d13 leading-snug text-ink-soft">
            {mode === 'login' ? (
              <>
                ¿No tienes cuenta?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className={`text-ink underline underline-offset-4 hover:no-underline ${FOCUS_RING}`}
                >
                  Regístrate con un código de invitación.
                </button>
              </>
            ) : (
              <>
                ¿Ya tienes cuenta?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className={`text-ink underline underline-offset-4 hover:no-underline ${FOCUS_RING}`}
                >
                  Inicia sesión.
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  inputRef,
  autoComplete,
  mono,
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: 'text' | 'password' | 'email'
  inputRef?: React.RefObject<HTMLInputElement>
  autoComplete?: string
  // Codes are mono material; identity fields read in the grotesk body.
  mono?: boolean
  disabled?: boolean
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="font-mono text-d11 tracking-widest text-ink-soft">{label}</span>
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        // Identifiers, all of them — no auto-capital, no autocorrect.
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        disabled={disabled}
        className={`min-h-11 border border-ink bg-paper-raised px-3 py-2 text-d15 text-ink transition-colors focus:bg-white disabled:opacity-60 ${
          mono ? 'font-mono tracking-wide' : 'font-grotesk'
        } ${FOCUS_RING}`}
      />
    </label>
  )
}
