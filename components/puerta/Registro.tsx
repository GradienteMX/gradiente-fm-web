'use client'

/**
 * REGISTRO — minting an identity from an invitation. The code is already
 * bound; the invitee chooses how to be found (usuario, normalized on every
 * keystroke so they see the handle that will exist), a password, and signs
 * the beta terms — each clause with its «En claro» line. The identity is
 * created by the server (/api/auth/signup); whether a username is taken is
 * only known there, so its answer is shown as it comes.
 */

import { useEffect, useId, useRef, useState } from 'react'
import type { Role } from '@/lib/types'
import { normalizeUsername, usernameProblemEs } from '@/lib/identity'
import { TextField } from '@/components/kit/Field'
import { ROLE_LABEL, ROLE_MEANING } from '@/components/kit/Persona'
import { BETA_TERMS } from './terminos'
import { LIBREA_SECCION } from '@/lib/librea'
import { Cabeza } from '@/components/acceso/Cabeza'
import styles from './Registro.module.css'

export interface RegistroValues {
  email: string
  username: string
  password: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function Registro({
  invite,
  team,
  onHandle,
  onSubmit,
  onEnter,
  done,
  sending = false,
  error = null,
  focusDelay = null,
}: {
  invite: { role: Role }
  team: string | null
  onHandle: (h: string) => void
  onSubmit: (v: RegistroValues) => void
  onEnter: () => void
  /** The identity once minted (the form turns into its receipt). */
  done: { username: string } | null
  /** The server is creating it. */
  sending?: boolean
  /** What the server answered when it couldn't (already in Spanish). */
  error?: string | null
  /** Focus the first field after this many ms (fine pointers only); null = never. */
  focusDelay?: number | null
}) {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [pass, setPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [tried, setTried] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)
  const termsId = useId()

  useEffect(() => {
    if (focusDelay == null) return
    if (!window.matchMedia('(pointer: fine)').matches) return
    const t = window.setTimeout(() => emailRef.current?.focus({ preventScroll: true }), focusDelay)
    return () => window.clearTimeout(t)
  }, [focusDelay])

  const uProblem = username ? usernameProblemEs(username) : null
  const errors = {
    email: !EMAIL_RE.test(email.trim()) ? (email ? 'Ese correo no parece válido.' : 'Falta tu correo.') : null,
    username: !username ? 'Elige un usuario.' : uProblem,
    pass: pass.length < 8 ? 'La contraseña necesita al menos 8 caracteres.' : null,
    confirm: confirm !== pass ? 'Las contraseñas no coinciden.' : !confirm ? 'Confírmala.' : null,
    terms: !accepted ? 'Para entrar hay que aceptar los términos de la beta.' : null,
  }
  const ok = Object.values(errors).every((e) => e === null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (!ok || done || sending) return
    onSubmit({ email: email.trim().toLowerCase(), username, password: pass })
  }

  if (done) {
    return (
      <div className={styles.panel} role="status">
        <div className={styles.cabeza}>
          <Cabeza librea={LIBREA_SECCION.credencial} title="Identidad creada" />
        </div>
        <h3 className={styles.title}>Ya estás en la señal, @{done.username}.</h3>
        <p className={styles.lead}>
          Tu credencial ya es pública en <b>gradiente.org/u/{done.username}</b>. Lo que publiques, calibres y conversemos la irá llenando de insignias.
        </p>
        <p className={styles.going}>Entrando al campo…</p>
      </div>
    )
  }

  return (
    <form className={styles.panel} onSubmit={submit} noValidate>
      <div className={styles.cabeza}>
        <Cabeza librea={LIBREA_SECCION.credencial} title="Tu identidad" />
      </div>
      <header className={styles.head}>
        <p className={styles.index}>Registro — invitación válida</p>
        <p className={styles.lead}>
          Esta invitación te da el rol <b>{ROLE_LABEL[invite.role]}</b>: {ROLE_MEANING[invite.role].toLowerCase()}
          {team ? (
            <>
              {' '}
              Entras al equipo de <b>{team}</b>.
            </>
          ) : null}
        </p>
      </header>

      <div className={styles.fields}>
        <TextField
          ref={emailRef}
          label="Correo"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode="email"
          error={tried ? errors.email : null}
        />
        <TextField
          label="Usuario"
          value={username}
          onChange={(e) => {
            const v = normalizeUsername(e.target.value)
            setUsername(v)
            onHandle(v)
          }}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="nombre.apellido"
          error={username ? errors.username : tried ? errors.username : null}
          hint={username && !errors.username ? `Así te encontrarán: gradiente.org/u/${username}` : 'Minúsculas, números, punto, guion y guion bajo — de 3 a 30.'}
        />
        <div className={styles.pair}>
          <TextField
            label="Contraseña"
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoComplete="new-password"
            error={tried ? errors.pass : null}
            hint="Al menos 8 caracteres."
          />
          <TextField
            label="Confirmar"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            error={tried ? errors.confirm : null}
          />
        </div>
      </div>

      <fieldset className={styles.terms} aria-describedby={`${termsId}-sub`}>
        <legend className={styles.termsHead}>
          <span>Términos de la beta</span>
          <span className={styles.termsDate}>versión del {BETA_TERMS.lastUpdated}</span>
        </legend>
        <p id={`${termsId}-sub`} className={styles.termsSub}>
          Diez cláusulas. Cada una trae su versión <em>en claro</em>; ábrela para leer el texto completo.
        </p>
        <ol className={styles.clauses} data-lenis-prevent="">
          <li className={styles.preamble}>{BETA_TERMS.preamble}</li>
          {BETA_TERMS.sections.map((c) => (
            <li key={c.n}>
              <details className={styles.clause}>
                <summary>
                  <span className={styles.cn}>{c.n}</span>
                  <span className={styles.ct}>
                    <b>{c.title}</b>
                    <span>
                      <em>En claro:</em> {c.enClaro}
                    </span>
                  </span>
                </summary>
                <div className={styles.cbody}>
                  {c.body.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </details>
            </li>
          ))}
          <li className={styles.closing}>{BETA_TERMS.closing}</li>
        </ol>
        <label className={styles.accept} data-error={tried && !accepted ? '' : undefined}>
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
          <span>
            Leí los términos de la beta y los acepto. <em>En claro:</em> tu contenido es tuyo, tu HL es privado y puedes irte cuando quieras.
          </span>
        </label>
        {tried && errors.terms ? (
          <p className={styles.err} role="alert">
            {errors.terms}
          </p>
        ) : null}
      </fieldset>

      <div className={styles.actions}>
        {error ? (
          <p className={styles.err} role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className={styles.create} aria-disabled={!ok || sending || undefined} aria-busy={sending || undefined}>
          <span>{sending ? 'Creando tu identidad…' : 'Crear mi identidad'}</span>
          <span aria-hidden="true">→</span>
        </button>
        <p className={styles.alt}>
          ¿Ya tienes identidad?{' '}
          <button type="button" className={styles.altLink} onClick={onEnter}>
            Entra con ella.
          </button>
        </p>
      </div>
    </form>
  )
}
