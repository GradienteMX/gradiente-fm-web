'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from './useAuth'

type Mode = 'login' | 'signup'

export function LoginOverlay() {
  const { loginOpen, closeLogin, login, signup } = useAuth()
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
      setMode('login')
      setIdentifier('')
      setEmail('')
      setUsername('')
      setPassword('')
      setInviteCode('')
      setError(null)
      setJustAuthed(false)
      setSubmitting(false)
      const t = setTimeout(() => firstFieldRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [loginOpen])

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

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
        username: username.trim(),
        inviteCode: inviteCode.trim(),
      })
      if (result.ok) {
        setJustAuthed(true)
        setTimeout(() => closeLogin(), 700)
      } else {
        setError(result.error.toUpperCase())
      }
    }
    setSubmitting(false)
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
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" aria-hidden />

      <div
        onClick={(e) => e.stopPropagation()}
        className="eva-box eva-scanlines overlay-panel-in relative z-10 flex w-full max-w-md flex-col overflow-hidden bg-base"
        style={{ transformOrigin: 'center center' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-border bg-base/95 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span
              className="shrink-0 font-mono text-[10px] tracking-widest"
              style={{ color: '#F97316' }}
            >
              //AUTH
            </span>
            <span className="sys-label hidden truncate uppercase text-muted sm:inline">
              {mode === 'login' ? 'login·terminal' : 'signup·terminal'}
            </span>
          </div>
          <button
            onClick={closeLogin}
            aria-label="Cerrar"
            className="flex items-center gap-2 font-mono text-[10px] tracking-widest text-muted transition-colors hover:text-primary"
          >
            <span className="hidden sm:inline">[ESC]</span>
            <X size={14} className="sm:hidden" />
            <span>CERRAR</span>
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-border bg-base/95 font-mono text-[10px] tracking-widest">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 px-4 py-2 transition-colors ${
              mode === 'login' ? 'text-primary' : 'text-muted hover:text-secondary'
            }`}
            style={mode === 'login' ? { borderBottom: '2px solid #F97316' } : undefined}
          >
            ▶ INGRESAR
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className={`flex-1 px-4 py-2 transition-colors ${
              mode === 'signup' ? 'text-primary' : 'text-muted hover:text-secondary'
            }`}
            style={mode === 'signup' ? { borderBottom: '2px solid #F97316' } : undefined}
          >
            ▶ REGISTRARSE
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-5 p-6">
          <header className="flex flex-col gap-2">
            <span
              className="inline-flex w-fit items-center gap-2 border px-2 py-0.5 font-mono text-[10px] tracking-widest"
              style={{ borderColor: '#F97316', color: '#F97316' }}
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sys-green" />
              SISTEMA·ACCESO
            </span>
            <h1 className="font-syne text-2xl font-black leading-tight text-primary">
              {mode === 'login' ? 'IDENTIFÍCATE' : 'NUEVA IDENTIDAD'}
            </h1>
            <p className="font-mono text-[11px] leading-relaxed text-secondary">
              {mode === 'login'
                ? 'Acceso a redacción, partners y lectores del subsistema.'
                : 'Necesitas un código de invitación para crear una cuenta.'}
            </p>
          </header>

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
                  onChange={setUsername}
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
                  disabled={submitting || justAuthed}
                />
              </>
            )}

            {error && (
              <div
                className="border px-3 py-2 font-mono text-[10px] leading-relaxed tracking-widest"
                style={{
                  borderColor: '#E63329',
                  color: '#E63329',
                  backgroundColor: '#E6332910',
                }}
              >
                {error}
              </div>
            )}

            {justAuthed && (
              <div
                className="border px-3 py-2 font-mono text-[10px] tracking-widest"
                style={{
                  borderColor: '#4ADE80',
                  color: '#4ADE80',
                  backgroundColor: '#4ADE8015',
                }}
              >
                ACCESO CONCEDIDO · REDIRIGIENDO…
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || justAuthed}
              className="mt-2 border px-4 py-2.5 font-mono text-[11px] tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                borderColor: '#F97316',
                color: '#F97316',
                backgroundColor: 'rgba(249,115,22,0.08)',
              }}
            >
              {submitting
                ? '▶ PROCESANDO…'
                : mode === 'login'
                ? '▶ ENTRAR AL SUBSISTEMA'
                : '▶ CREAR IDENTIDAD'}
            </button>
          </form>

          <p className="font-mono text-[10px] leading-relaxed text-muted">
            {mode === 'login' ? (
              <>
                ¿No tienes cuenta?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className="text-secondary underline transition-colors hover:text-primary"
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
                  className="text-secondary underline transition-colors hover:text-primary"
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
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: 'text' | 'password' | 'email'
  inputRef?: React.RefObject<HTMLInputElement>
  autoComplete?: string
  disabled?: boolean
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="sys-label">{label}</span>
      <input
        ref={inputRef}
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
