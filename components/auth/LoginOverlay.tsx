'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from './useAuth'
import { badgeFor, listUsers } from '@/lib/mockUsers'

export function LoginOverlay() {
  const { loginOpen, closeLogin, login, loginAs } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [justAuthed, setJustAuthed] = useState(false)
  const usernameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (loginOpen) {
      setUsername('')
      setPassword('')
      setError(null)
      setJustAuthed(false)
      const t = setTimeout(() => usernameRef.current?.focus(), 50)
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const ok = login(username.trim(), password)
    if (ok) {
      setError(null)
      setJustAuthed(true)
      setTimeout(() => closeLogin(), 700)
    } else {
      setError('CREDENCIALES INVÁLIDAS · ACCESO DENEGADO')
    }
  }

  const quickSwitch = (userId: string) => {
    if (loginAs(userId)) {
      setError(null)
      setJustAuthed(true)
      setTimeout(() => closeLogin(), 500)
    }
  }

  const users = listUsers()

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
              login·terminal
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
              IDENTIFÍCATE
            </h1>
            <p className="font-mono text-[11px] leading-relaxed text-secondary">
              Acceso a redacción, partners y lectores del subsistema.
            </p>
          </header>

          <form onSubmit={submit} className="flex flex-col gap-3">
            <Field
              label="USERNAME"
              value={username}
              onChange={setUsername}
              inputRef={usernameRef}
              autoComplete="username"
              disabled={justAuthed}
            />
            <Field
              label="PASSWORD"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              disabled={justAuthed}
            />

            {error && (
              <div
                className="border px-3 py-2 font-mono text-[10px] tracking-widest"
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
              disabled={justAuthed}
              className="mt-2 border px-4 py-2.5 font-mono text-[11px] tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                borderColor: '#F97316',
                color: '#F97316',
                backgroundColor: 'rgba(249,115,22,0.08)',
              }}
            >
              ▶ ENTRAR AL SUBSISTEMA
            </button>
          </form>

          {/* Quick-switch picker (prototype only) — log in as any mock user
              with one click. Lets us exercise role-aware UI without
              remembering per-user credentials. */}
          <div className="border-t border-dashed border-border pt-3">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <span className="sys-label">QUICK·SWITCH</span>
              <span className="font-mono text-[9px] tracking-widest text-muted">
                [PROTOTIPO]
              </span>
            </div>
            <ul className="grid grid-cols-1 gap-1">
              {users.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => quickSwitch(u.id)}
                    disabled={justAuthed}
                    className="group flex w-full items-center justify-between gap-3 border border-transparent px-2 py-1.5 text-left font-mono text-[11px] transition-colors hover:border-border hover:bg-white/[0.02] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="truncate text-primary">@{u.username}</span>
                    <span
                      className="shrink-0 border px-1.5 py-0.5 text-[9px] tracking-widest"
                      style={{ borderColor: '#242424', color: '#9CA3AF' }}
                    >
                      {badgeFor(u)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 font-mono text-[10px] leading-relaxed text-muted">
              Forma manual: usa cualquier <span className="text-secondary">@username</span> con
              password = username, o el atajo{' '}
              <span style={{ color: '#F97316' }}>admin / admin</span>.
            </p>
          </div>
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
  type?: 'text' | 'password'
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
