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

// Inline terminal-styled registration for invited (coded) users — replaces the
// LoginOverlay signup modal on /welcome. The invite code is pre-bound (the user
// only supplies email / username / password) and submit calls the same
// useAuth().signup() the modal used, so the auth/trust path is unchanged.
//
// This component is intentionally self-contained and 3D-agnostic: it becomes the
// DOM form inside the invitación-3d REGISTRO card (and the no-WebGL fallback)
// once the experience is ported. Success needs no manual redirect — the /welcome
// auth effect (authResolved && isAuthed → replace('/')) fires when signup()
// refreshes the session.
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
    <div
      className="eva-box eva-scanlines w-full max-w-md overflow-hidden bg-base"
      style={{ borderColor: '#242424' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 border-b px-4 py-2.5"
        style={{ borderColor: '#242424' }}
      >
        <span className="font-mono text-[10px] tracking-widest" style={{ color: '#F97316' }}>
          //REGISTRO
        </span>
        <span className="sys-label uppercase text-muted">identidad·nueva</span>
      </div>

      <div className="flex flex-col gap-4 p-5">
        <header className="flex flex-col gap-2">
          <h2 className="font-syne text-2xl font-black leading-tight text-primary">
            NUEVA IDENTIDAD
          </h2>

          {/* Resolved invitation (from the code) */}
          <div
            className="flex flex-col gap-0.5 border px-3 py-2 font-mono text-[10px] tracking-widest"
            style={{ borderColor: '#4ADE8055', backgroundColor: '#4ADE8008' }}
          >
            <span style={{ color: '#4ADE80' }}>✓ INVITACIÓN VÁLIDA</span>
            <span className="text-secondary">
              {invite.name || '—'} · {ROLE_LABEL[invite.role]}
              {invite.folio ? ` · FOLIO ${invite.folio}` : ''}
              {invite.franja ? ` · ${invite.franja.title}` : ''}
            </span>
            <span className="truncate text-muted">CÓDIGO · {invite.code}</span>
          </div>
        </header>

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

          {error && (
            <div
              className="border px-3 py-2 font-mono text-[10px] leading-relaxed tracking-widest"
              style={{ borderColor: '#E63329', color: '#E63329', backgroundColor: '#E6332910' }}
            >
              {error}
            </div>
          )}

          {justAuthed && (
            <div
              className="border px-3 py-2 font-mono text-[10px] tracking-widest"
              style={{ borderColor: '#4ADE80', color: '#4ADE80', backgroundColor: '#4ADE8015' }}
            >
              ACCESO CONCEDIDO · REDIRIGIENDO…
            </div>
          )}

          <button
            type="submit"
            disabled={locked}
            className="mt-1 border px-4 py-2.5 font-mono text-[11px] tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            style={{ borderColor: '#F97316', color: '#F97316', backgroundColor: 'rgba(249,115,22,0.08)' }}
          >
            {submitting ? '▶ CREANDO…' : justAuthed ? '▶ LISTO' : '▶ CREAR IDENTIDAD'}
          </button>
        </form>

        <p className="font-mono text-[10px] leading-relaxed text-muted">
          ¿Ya tienes cuenta?{' '}
          <button
            type="button"
            onClick={() => openLogin('login')}
            className="text-secondary underline transition-colors hover:text-primary"
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
    <label className="flex flex-col gap-1">
      <span className="sys-label">{label}</span>
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
        className="border bg-black px-3 py-2 font-mono text-sm text-primary outline-none transition-colors focus:border-sys-orange disabled:opacity-60"
        style={{ borderColor: '#242424' }}
      />
      {hint && <span className="font-mono text-[9.5px] tracking-widest text-muted">{hint}</span>}
    </label>
  )
}
