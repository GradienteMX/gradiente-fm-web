'use client'

import { useState } from 'react'
import { useAuth } from '@/components/auth/useAuth'
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
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justAuthed, setJustAuthed] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const result = await signup({
      email: email.trim(),
      password,
      username: username.trim(),
      inviteCode: invite.code,
    })
    if (result.ok) {
      setJustAuthed(true) // page redirects once the session refresh lands
    } else {
      setError(result.error.toUpperCase())
      setSubmitting(false)
    }
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
              {invite.partner ? ` · ${invite.partner.title}` : ''}
            </span>
            <span className="truncate text-muted">CÓDIGO · {invite.code}</span>
          </div>
        </header>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <Field label="EMAIL" type="email" value={email} onChange={setEmail} autoComplete="email" disabled={locked} />
          <Field label="USERNAME" value={username} onChange={setUsername} autoComplete="username" disabled={locked} />
          <Field label="PASSWORD" type="password" value={password} onChange={setPassword} autoComplete="new-password" disabled={locked} />

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
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: 'text' | 'password' | 'email'
  autoComplete?: string
  disabled?: boolean
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="sys-label">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        disabled={disabled}
        className="border bg-black px-3 py-2 font-mono text-sm text-primary outline-none transition-colors focus:border-sys-orange disabled:opacity-60"
        style={{ borderColor: '#242424' }}
      />
    </label>
  )
}
