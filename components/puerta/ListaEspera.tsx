'use client'

/**
 * LISTA DE ESPERA — the door's inline way onto the waitlist: alias, email,
 * city. The same row /espera writes (POST /api/waitlist), and the same
 * remembered signal, so /espera shows this browser its place; /espera stays
 * the long version with the queue. A honeypot gets a calm answer and no row
 * (the route decides that, not this form).
 */

import Link from 'next/link'
import { useRef, useState } from 'react'
import { WAITLIST_ALIAS_MAX, WAITLIST_CITIES, WAITLIST_EMAIL_RE } from '@/lib/waitlist'
import { LIBREA_SECCION } from '@/lib/librea'
import { Cabeza } from '@/components/acceso/Cabeza'
import { joinWaitlist, writeSenal } from '@/components/espera/senal'
import styles from './Puerta.module.css'

export function ListaEspera({ onBack }: { onBack: () => void }) {
  const [alias, setAlias] = useState('')
  const [email, setEmail] = useState('')
  const [city, setCity] = useState<string>(WAITLIST_CITIES[0])
  const [tel, setTel] = useState('')
  const [tried, setTried] = useState(false)
  const [sending, setSending] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [done, setDone] = useState<'nuevo' | 'ya' | null>(null)
  const aliasRef = useRef<HTMLInputElement>(null)

  const a = alias.trim()
  const em = email.trim().toLowerCase()
  const error = !a
    ? 'Elige un alias: así te reconoceremos al escribirte.'
    : a.length > WAITLIST_ALIAS_MAX
      ? `El alias va hasta ${WAITLIST_ALIAS_MAX} caracteres.`
      : !WAITLIST_EMAIL_RE.test(em)
        ? em
          ? 'Ese correo no parece válido. Revísalo.'
          : 'Falta tu correo.'
        : null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (error) {
      aliasRef.current?.form?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus()
      return
    }
    if (sending) return
    setSending(true)
    setServerError(null)
    // `source` (¿cómo nos encontraste?) stays off at the door, as in
    // production's inline panel; the route stores null for it.
    const res = await joinWaitlist({ alias: a, email: em, city, tel })
    setSending(false)
    if (!res.ok) {
      setServerError(res.error)
      return
    }
    if (res.position !== null) writeSenal({ email: em, alias: a, city, position: res.position, total: res.total, at: new Date().toISOString() })
    setDone(res.already ? 'ya' : 'nuevo')
  }

  return (
    <section className={styles.sheet} aria-labelledby="puerta-espera">
      <Cabeza librea={LIBREA_SECCION.puerta} band="dial" title="Lista de espera" titleId="puerta-espera" chip={{ label: 'Volver', onClick: onBack }} />
      <div className={styles.sheetBody}>
        {done ? (
          <>
            <p className={styles.copy} role="status">
              {done === 'ya'
                ? 'Ese correo ya estaba en la fila: conserva su lugar.'
                : 'Señal recibida. Te escribiremos cuando la puerta se abra, con un código.'}
            </p>
            <Link href="/espera" className={styles.go}>
              <span>Ver tu lugar en la fila</span>
              <span aria-hidden="true">→</span>
            </Link>
          </>
        ) : (
          <>
            <p className={styles.copy}>Deja tus datos y te avisaremos cuando la puerta se abra. Tu correo solo sirve para eso.</p>
            <form onSubmit={submit} noValidate>
              <div className={styles.f}>
                <label htmlFor="puerta-alias">Nombre / alias</label>
                <input
                  id="puerta-alias"
                  ref={aliasRef}
                  type="text"
                  maxLength={WAITLIST_ALIAS_MAX}
                  placeholder="NOMADA_77"
                  autoComplete="nickname"
                  value={alias}
                  aria-invalid={(tried && (!a || a.length > WAITLIST_ALIAS_MAX)) || undefined}
                  onChange={(e) => setAlias(e.target.value)}
                  autoFocus
                />
              </div>
              <div className={styles.f}>
                <label htmlFor="puerta-correo">Correo</label>
                <input
                  id="puerta-correo"
                  type="email"
                  placeholder="tu@señal.net"
                  autoComplete="email"
                  value={email}
                  aria-invalid={(tried && Boolean(a) && !WAITLIST_EMAIL_RE.test(em)) || undefined}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className={styles.f}>
                <label htmlFor="puerta-ciudad">Ciudad / zona</label>
                <select id="puerta-ciudad" value={city} onChange={(e) => setCity(e.target.value)}>
                  {WAITLIST_CITIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              {/* Honeypot — off screen, never visible or tabbable. */}
              <input
                type="text"
                name="tel"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={tel}
                onChange={(e) => setTel(e.target.value)}
                className={styles.honey}
              />
              {tried && error ? (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              ) : serverError ? (
                <p className={styles.error} role="alert">
                  {serverError}
                </p>
              ) : null}
              <button type="submit" className={styles.go} disabled={sending} aria-busy={sending || undefined}>
                <span>{sending ? 'Enviando…' : 'Unirme a la lista de espera'}</span>
                <span aria-hidden="true">→</span>
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  )
}
