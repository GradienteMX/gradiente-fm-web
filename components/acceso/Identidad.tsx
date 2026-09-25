'use client'

/**
 * IDENTIDAD — how you come in: with an identity, or with a code. One panel,
 * two homes: inside La Puerta's dark console (variant 'puerta') and in the
 * Acceso sheet everywhere else (variant 'hoja').
 *
 * It speaks LIBREA. The head is a livery: a channel chip and a patterned
 * band that flood across and decode when the mode changes (Entrar wears the
 * credencial's ink, CRD 11; a code wears La Puerta's manila, PTA 10).
 *
 * Entering is production's login (POST /api/auth/login — a username or an
 * email, and the password); the session is a cookie the server reads, so
 * whoever hosts the panel decides how the page is read again (`onDone`).
 * There is one way to sign up: a code opens in La Puerta
 * (/welcome?codigo=), where the credencial arrives and the identity is
 * minted — never a second form here.
 */

import { useId, useRef, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { LIBREA_SECCION } from '@/lib/librea'
import { signIn } from '@/lib/auth/client'
import { peekInviteCard } from '@/lib/invitations'
import { TextField } from '@/components/kit/Field'
import { flare } from '@/components/stage/api'
import { CODE_MESSAGE, CODE_SHAPE, codeStatusOf, displayCode, type CodeStatus } from '@/components/puerta/codigo'
import { Cabeza } from './Cabeza'
import s from './Identidad.module.css'

export type IdentidadMode = 'entrar' | 'codigo'

const LIVERY = { entrar: LIBREA_SECCION.credencial, codigo: LIBREA_SECCION.puerta }
const TITLE: Record<IdentidadMode, string> = { entrar: 'Entrar', codigo: 'Tengo un código' }
const MODES: IdentidadMode[] = ['entrar', 'codigo']
/** The band under the head wants a pattern that holds at 10 px (the door's wheel doesn't). */
const BAND = { entrar: LIBREA_SECCION.credencial.patron, codigo: 'dial' } as const

export function Identidad({
  variant,
  initialMode = 'entrar',
  reason,
  onDone,
  onClose,
  onCodigo,
}: {
  variant: 'puerta' | 'hoja'
  initialMode?: IdentidadMode
  /** Why an identity is needed, when something asked for one. */
  reason?: string
  /** The session is open (the cookie is set): read the page again. */
  onDone: () => void
  /** The head's chip: back (at the door) or close (the sheet). */
  onClose?: () => void
  /** At the door the code has its own panel: the tab hands over to it. */
  onCodigo?: () => void
}) {
  const [mode, setModeState] = useState<IdentidadMode>(onCodigo ? 'entrar' : initialMode)
  const lv = LIVERY[mode]
  const titleId = useId()
  const panelId = useId()
  const tabs = useRef<Array<HTMLButtonElement | null>>([])

  const setMode = (m: IdentidadMode) => {
    if (m === 'codigo' && onCodigo) return onCodigo()
    setModeState(m)
  }

  return (
    <section className={s.panel} data-variant={variant} data-mode={mode} aria-labelledby={titleId}>
      <Cabeza
        librea={lv}
        title={TITLE[mode]}
        titleId={titleId}
        band={BAND[mode]}
        chip={onClose ? { label: variant === 'puerta' ? 'Volver' : 'Cerrar', onClick: onClose } : undefined}
      />

      <div className={s.body}>
        <div className={s.tabs} role="tablist" aria-label="Cómo entras">
          {MODES.map((m, i) => (
            <button
              key={m}
              ref={(el) => {
                tabs.current[i] = el
              }}
              type="button"
              role="tab"
              id={`${panelId}-${m}`}
              aria-selected={mode === m}
              aria-controls={panelId}
              tabIndex={mode === m ? 0 : -1}
              className={s.tab}
              style={{ '--tc': LIVERY[m].color, '--to': LIVERY[m].on } as CSSProperties}
              onClick={() => setMode(m)}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
                e.preventDefault()
                const next = MODES[(i + 1) % MODES.length]
                setMode(next)
                tabs.current[MODES.indexOf(next)]?.focus()
              }}
            >
              <span className={s.tabNum}>{String(i + 1).padStart(2, '0')}</span>
              {TITLE[m]}
            </button>
          ))}
        </div>

        {reason ? <p className={s.reason}>{reason}. Para eso necesitas una identidad.</p> : null}

        <div role="tabpanel" id={panelId} aria-labelledby={`${panelId}-${mode}`} key={mode} className={s.pane}>
          {mode === 'entrar' ? <Entrar onDone={onDone} /> : <Codigo onClose={onClose} />}
        </div>
      </div>
    </section>
  )
}

// ── entrar ──────────────────────────────────────────────────────────────────

function Entrar({ onDone }: { onDone: () => void }) {
  const [handle, setHandle] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [inside, setInside] = useState(false)
  const goRef = useRef<HTMLButtonElement>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sending || inside) return
    const identifier = handle.trim().replace(/^@/, '')
    if (!identifier || !pass) return setError('Escribe tu usuario (o correo) y tu contraseña.')
    setError(null)
    setSending(true)
    const res = await signIn(identifier, pass)
    setSending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setInside(true)
    flare(goRef.current, 6)
    onDone()
  }

  return (
    <div className={s.entrar}>
      <form className={s.form} onSubmit={submit} noValidate>
        <div className={s.pair}>
          <TextField
            label="Usuario o correo"
            placeholder="@usuario"
            value={handle}
            onChange={(e) => {
              setHandle(e.target.value)
              setError(null)
            }}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            data-autofocus=""
          />
          <TextField
            label="Contraseña"
            type="password"
            value={pass}
            onChange={(e) => {
              setPass(e.target.value)
              setError(null)
            }}
            autoComplete="current-password"
            error={error}
          />
        </div>
        <button ref={goRef} type="submit" className={s.go} disabled={sending || inside} aria-busy={sending || undefined}>
          <span>{inside ? 'Dentro. Abriendo el campo…' : sending ? 'Entrando…' : 'Entrar'}</span>
          <span aria-hidden="true">→</span>
        </button>
      </form>
      <p className={s.note}>¿Sin identidad todavía? Gradiente se abre por invitación: con un código entras por La Puerta; sin él, la lista de espera.</p>
    </div>
  )
}

// ── código: one door ──────────────────────────────────────────────────────

function Codigo({ onClose }: { onClose?: () => void }) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<CodeStatus>('vacio')
  const seq = useRef(0)
  const pause = useRef<number | null>(null)

  const lookup = async (raw: string) => {
    const n = ++seq.current
    setStatus('verificando')
    const card = await peekInviteCard(raw)
    if (n === seq.current) setStatus(codeStatusOf(card.status, card.error))
  }

  const onChange = (raw: string) => {
    const next = displayCode(raw)
    setCode(next)
    seq.current++
    if (pause.current) window.clearTimeout(pause.current)
    if (!next) return setStatus('vacio')
    if (!CODE_SHAPE.test(next)) return setStatus('escribiendo')
    setStatus('verificando')
    pause.current = window.setTimeout(() => void lookup(next), 450)
  }

  const bad = status === 'usado' || status === 'expirado' || status === 'desconocido' || status === 'sin-red'

  const open = (e: React.FormEvent) => {
    e.preventDefault()
    if (status === 'valido') {
      onClose?.()
      router.push(`/welcome?codigo=${encodeURIComponent(code)}`)
      return
    }
    if (code && status !== 'verificando') {
      if (pause.current) window.clearTimeout(pause.current)
      void lookup(code)
    }
  }

  return (
    <form className={s.form} onSubmit={open} noValidate>
      <p className={s.copy}>El código de tu invitación, tal como llegó.</p>
      <TextField
        label="Código de invitación"
        placeholder="INV-XXXXXXXX"
        value={code}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        aria-invalid={bad || undefined}
        style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}
        data-autofocus=""
      />
      <p className={s.status} data-tone={bad ? 'cold' : status === 'valido' ? 'open' : undefined} aria-live="polite">
        {status === 'valido' ? 'Código válido. Se abre en La Puerta.' : CODE_MESSAGE[status]}
      </p>
      <button type="submit" className={s.acid} disabled={!code || status === 'verificando'}>
        <span>{status === 'valido' ? 'Abrir la puerta' : 'Verificar el código'}</span>
        <span aria-hidden="true">→</span>
      </button>
      <p className={s.note}>Hay una sola puerta: tu código se abre allí, llega tu credencial y eliges cómo te encuentran.</p>
    </form>
  )
}
