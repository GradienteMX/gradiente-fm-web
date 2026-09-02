'use client'

import { useState } from 'react'
import { useAuth } from '@/components/auth/useAuth'
import { BetaTermsModal } from '@/components/welcome/BetaTermsModal'
import { normalizeUsername, usernameProblemEs } from '@/lib/identity'
import type { InviteCard, InviteRole } from '@/lib/invitations'

const ROLE_LABEL: Record<InviteRole, string> = {
  user: 'USUARIO',
  curator: 'CURADOR',
  guide: 'GUÍA',
  insider: 'INSIDER',
  admin: 'ADMIN',
}

// Inline registration for invited (coded) users — replaces the LoginOverlay
// signup modal on /welcome. The invite code is pre-bound (the user only
// supplies email / username / password) and submit calls the same
// useAuth().signup() the modal used, so the auth/trust path is unchanged.
//
// Chrome speaks «EL PLIEGO», same as the /welcome door and LoginOverlay: paper
// sheet on a 1px ink hairline, Syne d28 head + //REGISTRO marker (the DashPopup
// anatomy), mono d11/d13 labels, grotesk d15 fields, red #C42B20 for errors and
// acid reserved for the user's own action (the submit fill-block, the 8px
// ink-outlined dot on the invitation strip). The EVA terminal skin is retired.
//
// This component is intentionally self-contained and 3D-agnostic: it is the DOM
// form inside the invitación-3d REGISTRO card AND the no-WebGL fallback.
// Success needs no manual redirect — the /welcome auth effect (authResolved &&
// isAuthed → replace('/')) fires when signup() refreshes the session.

// The page-wide focus grammar — inlined so welcome stays free of dashboard
// imports (same rationale as LoginOverlay).
const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

export function RegistroCard({ invite }: { invite: InviteCard }) {
  const { signup, openLogin } = useAuth()

  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justAuthed, setJustAuthed] = useState(false)
  const [showTerms, setShowTerms] = useState(false)

  // Step 1 — validate the fields locally, then gate on the T&C popup. The
  // account isn't created until the user accepts the terms (step 2).
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !username.trim() || !password) {
      setError('COMPLETA TODOS LOS CAMPOS')
      return
    }
    // Catch what the field can still produce (too short, dots-only, `..`)
    // here rather than after the T&C round trip.
    const usernameProblem = usernameProblemEs(normalizeUsername(username))
    if (usernameProblem) {
      setError(usernameProblem.toUpperCase())
      return
    }
    if (password.length < 6) {
      setError('LA CONTRASEÑA NECESITA AL MENOS 6 CARACTERES')
      return
    }
    if (password !== confirmPassword) {
      setError('LAS CONTRASEÑAS NO COINCIDEN')
      return
    }
    setShowTerms(true)
  }

  // Step 2 — runs only after the user accepts the Terms & Conditions.
  // Everything after `setSubmitting(true)` is guarded: the fields are disabled
  // while submitting, so any escaping exception would strand the invitee in a
  // dead form they can only leave by reloading the whole 3D unbox.
  const acceptTermsAndRegister = async () => {
    setShowTerms(false)
    setSubmitting(true)
    try {
      const result = await signup({
        email: email.trim(),
        password,
        username: normalizeUsername(username),
        inviteCode: invite.code,
      })
      if (result.ok) {
        setJustAuthed(true) // page redirects once the session refresh lands
        return // stay locked — we're on our way out
      }
      setError(result.error.toUpperCase())
    } catch {
      setError('NO SE PUDO COMPLETAR EL REGISTRO. INTENTA DE NUEVO.')
    }
    setSubmitting(false)
  }

  const locked = submitting || justAuthed

  return (
    <div className="w-full max-w-md overflow-hidden border border-ink bg-paper text-ink">
      {/* ── Head — Syne title + //REGISTRO marker (DashPopup anatomy) ────── */}
      <div className="flex items-baseline gap-3 border-b border-ink px-5 py-1.5">
        {/* Wraps rather than truncates: at 375px the head has ~200px of room
            and a clipped title reads as breakage. The marker yields first. */}
        <h2 className="min-w-0 font-syne text-d28 font-bold uppercase leading-8 text-ink">
          Nueva identidad
        </h2>
        <div className="flex-1" />
        <span className="hidden shrink-0 font-mono text-d11 uppercase tracking-widest text-ink-soft sm:inline">
          //REGISTRO
        </span>
      </div>

      <div className="flex flex-col gap-4 p-5">
        {/* Resolved invitation (from the code). The acid dot is the
            whitelisted dot-badge use: 8px, 1px ink outline, on paper. */}
        <div className="flex flex-col gap-1 border border-ink bg-paper-raised px-3 py-2 font-mono text-d11 tracking-widest">
          <span className="flex items-center gap-2 font-bold text-ink">
            <span aria-hidden className="h-2 w-2 shrink-0 border border-ink bg-acid" />
            INVITACIÓN VÁLIDA
          </span>
          <span className="text-ink-soft">
            {invite.name || '—'} · {ROLE_LABEL[invite.role]}
            {invite.folio ? ` · FOLIO ${invite.folio}` : ''}
            {invite.franja ? ` · ${invite.franja.title}` : ''}
          </span>
          <span className="truncate text-ink-faint">CÓDIGO · {invite.code}</span>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <Field label="EMAIL" type="email" value={email} onChange={setEmail} autoComplete="email" disabled={locked} />
          {/* Normalized on every keystroke so the invitee reads the username
              that will actually be created — a phone's auto-capital, an
              accent or a dot used to pass the field and get bounced by the
              server gate after the T&C step. */}
          <Field
            label="USERNAME"
            value={username}
            onChange={(v) => setUsername(normalizeUsername(v))}
            autoComplete="username"
            disabled={locked}
            hint="minúsculas, números, punto, _ y - · así se verá en tu perfil"
          />
          <Field label="PASSWORD" type="password" value={password} onChange={setPassword} autoComplete="new-password" disabled={locked} />
          <Field label="CONFIRMAR PASSWORD" type="password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" disabled={locked} />

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
            disabled={locked}
            className={`mt-1 flex min-h-11 items-center justify-between gap-3 border border-ink bg-acid px-4 font-mono text-d13 font-bold uppercase tracking-widest text-ink transition-colors enabled:hover:bg-ink enabled:hover:text-paper disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS_RING}`}
          >
            <span>{submitting ? 'CREANDO…' : justAuthed ? 'LISTO' : 'CREAR IDENTIDAD'}</span>
            <span aria-hidden>→</span>
          </button>
        </form>

        <p className="font-grotesk text-d13 leading-snug text-ink-soft">
          ¿Ya tienes cuenta?{' '}
          <button
            type="button"
            onClick={() => openLogin('login')}
            className={`text-ink underline underline-offset-4 hover:no-underline ${FOCUS_RING}`}
          >
            Inicia sesión.
          </button>
        </p>
      </div>

      <BetaTermsModal
        open={showTerms}
        onAccept={acceptTermsAndRegister}
        onClose={() => setShowTerms(false)}
      />
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  disabled,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: 'text' | 'password' | 'email'
  autoComplete?: string
  disabled?: boolean
  hint?: string
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="font-mono text-d11 uppercase tracking-widest text-ink-soft">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        // Phone keyboards capitalize and autocorrect by default; every field
        // here is an identifier, so none of them want that help.
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        disabled={disabled}
        className={`min-h-11 border border-ink bg-paper-raised px-3 py-2 font-grotesk text-d15 text-ink transition-colors focus:bg-white disabled:opacity-60 ${FOCUS_RING}`}
      />
      {hint && <span className="font-grotesk text-d13 leading-snug text-ink-faint">{hint}</span>}
    </label>
  )
}
