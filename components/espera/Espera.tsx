'use client'

/**
 * ESPERA — /espera, the public waitlist. It feeds the same invitation
 * pipeline as everything else (there is no second way in): an alias, an
 * email, a city, how you found us. Every number here is read from the
 * server (GET /api/waitlist: signals, people waiting, accesses granted, and
 * the queue's states in order) and the one drawing is the queue itself.
 * Nobody's row ever reaches the page: joining (POST /api/waitlist) answers
 * with your place, nothing else.
 *
 * This browser remembers the signal it left (localStorage: what it typed and
 * the place the server gave), so a returning visitor sees their place
 * instead of an empty form. The place is a queue position (1-based order of
 * arrival): a fact, not a score.
 */

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useClientValue } from '@/lib/useMedia'
import { fmt } from '@/lib/logic/time'
import { WAITLIST_ALIAS_MAX, WAITLIST_CITIES, WAITLIST_EMAIL_RE, WAITLIST_SOURCES, type WaitlistStats } from '@/lib/waitlist'
import { Wordmark } from '@/components/shell/Wordmark'
import { TextField, Select } from '@/components/kit/Field'
import { Fila, STATUS_LABEL } from './Fila'
import { joinWaitlist, parseSenal, readFila, readSenalRaw, writeSenal, type Senal } from './senal'
import styles from './Espera.module.css'

function mask(email: string): string {
  const [user, domain] = email.split('@')
  if (!domain) return email
  return `${user.slice(0, 2)}${'•'.repeat(Math.max(2, Math.min(6, user.length - 2)))}@${domain}`
}

const fmtN = (n: number) => n.toLocaleString('es-MX')
const pad3 = (n: number) => String(n).padStart(3, '0')

export function Espera() {
  // What this browser remembers, until this visit signs up or forgets.
  const storedRaw = useClientValue(readSenalRaw, null)
  const [chosen, setChosen] = useState<Senal | null | undefined>(undefined)
  const mine = chosen === undefined ? parseSenal(storedRaw) : chosen
  const [already, setAlready] = useState(false)
  const [celebrate, setCelebrate] = useState(0)
  const [bot, setBot] = useState(false)

  const [stats, setStats] = useState<WaitlistStats | null>(null)
  const [statsState, setStatsState] = useState<'leyendo' | 'listo' | 'sin-red'>('leyendo')

  const [alias, setAlias] = useState('')
  const [email, setEmail] = useState('')
  const [city, setCity] = useState<string>(WAITLIST_CITIES[0])
  const [source, setSource] = useState<string>(WAITLIST_SOURCES[0])
  const [tel, setTel] = useState('')
  const [tried, setTried] = useState(false)
  const [sending, setSending] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  // The queue as the server counts it.
  useEffect(() => {
    let alive = true
    readFila().then((s) => {
      if (!alive) return
      setStats(s)
      setStatsState(s ? 'listo' : 'sin-red')
    })
    return () => {
      alive = false
    }
  }, [])

  const a = alias.trim()
  const em = email.trim().toLowerCase()
  const errors = {
    alias: !a ? 'Elige un alias: así te reconoceremos al escribirte.' : a.length > WAITLIST_ALIAS_MAX ? `Máximo ${WAITLIST_ALIAS_MAX} caracteres.` : null,
    email: !WAITLIST_EMAIL_RE.test(em) ? (em ? 'Ese correo no parece válido. Revísalo.' : 'Falta tu correo.') : null,
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (errors.alias || errors.email || sending) return
    setSending(true)
    setServerError(null)
    const res = await joinWaitlist({ alias: a, email: em, city, source, tel })
    setSending(false)
    if (!res.ok) {
      setServerError(res.error)
      return
    }
    // The honeypot's answer: calm, and no place.
    if (res.position === null) {
      setBot(true)
      return
    }
    const s: Senal = { email: em, alias: a, city, position: res.position, total: res.total, at: new Date().toISOString() }
    writeSenal(s)
    setChosen(s)
    setAlready(res.already)
    const fresh = await readFila()
    if (fresh) {
      setStats(fresh)
      setStatsState('listo')
    }
    if (!res.already) setCelebrate((n) => n + 1)
  }

  const reset = () => {
    writeSenal(null)
    setChosen(null)
    setAlready(false)
    setBot(false)
    setAlias('')
    setEmail('')
    setTried(false)
    setServerError(null)
  }

  const fila = stats?.fila ?? []
  const total = stats?.senales ?? mine?.total ?? null
  const myIndex = mine && mine.position <= fila.length ? mine.position - 1 : -1

  return (
    <div className={styles.espera}>
      <header className={styles.top}>
        <Link href="/" className={styles.brand} aria-label="Gradiente — el campo">
          <Wordmark size="md" />
        </Link>
        <nav className={styles.topNav} aria-label="Accesos">
          <Link href="/welcome" className={styles.topLink}>
            <span aria-hidden="true">←</span> Tengo un código
          </Link>
          <Link href="/" className={styles.topLink}>
            Recorrer el campo
          </Link>
        </nav>
      </header>

      <main className={styles.main}>
        <section className={styles.intro}>
          <p className={styles.index}>00 / Acceso por invitación — la espera</p>
          <h1 className={styles.title}>La espera</h1>
          <p className={styles.lede}>
            Gradiente se abre en olas, por invitación. Deja una señal: cuando llegue tu turno te escribimos con un código para La Puerta. Tu correo sirve para
            eso y para nada más.
          </p>
        </section>

        <div className={styles.grid}>
          <section className={styles.panel} aria-labelledby="espera-form-h">
            {mine ? (
              <div className={styles.done} role="status">
                <p className={styles.index} id="espera-form-h">
                  01 / Señal registrada
                </p>
                <h2 className={styles.doneTitle}>Estás en la fila.</h2>
                <div className={styles.place}>
                  <span className={styles.placeLabel}>Tu lugar</span>
                  <b className={styles.placeNum}>#{pad3(mine.position)}</b>
                  <span className={styles.placeOf}>
                    {total !== null ? `de ${fmtN(total)} ${total === 1 ? 'señal' : 'señales'}, ` : ''}en orden de llegada
                  </span>
                </div>
                <dl className={styles.rows}>
                  <div>
                    <dt>Alias</dt>
                    <dd>{mine.alias}</dd>
                  </div>
                  <div>
                    <dt>Correo</dt>
                    <dd>{mask(mine.email)}</dd>
                  </div>
                  <div>
                    <dt>Ciudad</dt>
                    <dd>{mine.city}</dd>
                  </div>
                  <div>
                    <dt>Señal</dt>
                    <dd>desde el {fmt.short(mine.at)}</dd>
                  </div>
                </dl>
                {already ? <p className={styles.note}>Ese correo ya estaba en la fila: tu lugar no cambió.</p> : null}
                <p className={styles.doneText}>Te escribiremos cuando la puerta se abra para ti, con un código para La Puerta. Si llega, ábrelo allí.</p>
                <div className={styles.doneActions}>
                  <Link href="/welcome" className={styles.go}>
                    Ir a La Puerta <span aria-hidden="true">→</span>
                  </Link>
                  <button type="button" className={styles.again} onClick={reset}>
                    Registrar otro correo
                  </button>
                </div>
              </div>
            ) : bot ? (
              <div className={styles.done} role="status">
                <p className={styles.index} id="espera-form-h">
                  01 / Señal recibida
                </p>
                <h2 className={styles.doneTitle}>Gracias.</h2>
                <p className={styles.doneText}>Te escribiremos si hay lugar.</p>
                <div className={styles.doneActions}>
                  <button type="button" className={styles.again} onClick={reset}>
                    Registrar otro correo
                  </button>
                </div>
              </div>
            ) : (
              <form className={styles.form} onSubmit={submit} noValidate>
                <p className={styles.index} id="espera-form-h">
                  01 / Tu señal
                </p>
                <TextField
                  label="Alias"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value.slice(0, WAITLIST_ALIAS_MAX))}
                  maxLength={WAITLIST_ALIAS_MAX}
                  counter={{ value: alias.length, max: WAITLIST_ALIAS_MAX }}
                  placeholder="cómo te conocen"
                  autoComplete="nickname"
                  autoCorrect="off"
                  spellCheck={false}
                  error={tried ? errors.alias : null}
                />
                <TextField
                  label="Correo"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.mx"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="email"
                  error={tried ? errors.email : null}
                  hint={!tried && em && !errors.email ? 'Formato correcto.' : undefined}
                />
                <div className={styles.pair}>
                  <Select
                    label="Ciudad / zona"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    options={WAITLIST_CITIES.map((c) => ({
                      value: c,
                      label: c,
                    }))}
                  />
                  <Select
                    label="¿Cómo nos encontraste?"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    options={WAITLIST_SOURCES.map((c) => ({
                      value: c,
                      label: c,
                    }))}
                  />
                </div>
                {/* Honeypot: out of sight and out of the tab order; people never fill it. */}
                <div className={styles.honey} aria-hidden="true">
                  <label>
                    Teléfono
                    <input type="text" name="tel" tabIndex={-1} autoComplete="off" value={tel} onChange={(e) => setTel(e.target.value)} />
                  </label>
                </div>
                {serverError ? (
                  <p className={styles.note} role="alert">
                    {serverError}
                  </p>
                ) : null}
                <button type="submit" className={styles.submit} disabled={sending} aria-busy={sending || undefined}>
                  <span>{sending ? 'Enviando…' : 'Entrar a la fila'}</span>
                  <span aria-hidden="true">→</span>
                </button>
                <p className={styles.fine}>Solo usaremos tu correo para avisarte del acceso. Nada más.</p>
              </form>
            )}
          </section>

          <section className={styles.panel} aria-labelledby="fila-h">
            <div className={styles.filaHead}>
              <p className={styles.index} id="fila-h">
                02 / La fila, ahora — {stats ? `${pad3(stats.senales)} señales` : statsState === 'sin-red' ? 'sin lectura' : 'leyendo…'}
              </p>
              <p className={styles.filaNote}>
                {statsState === 'sin-red'
                  ? 'No pudimos leer la fila en este momento. Tu señal, si la dejas, sí llega.'
                  : 'Cada punto es una persona real, en orden de llegada. Los encendidos ya recibieron invitación.'}
              </p>
            </div>
            <div className={styles.filaStage}>
              <Fila rows={fila} mine={myIndex} celebrate={celebrate} />
            </div>
            <dl className={styles.stats}>
              <div>
                <dt>Señales</dt>
                <dd>{stats ? fmtN(stats.senales) : '—'}</dd>
              </div>
              <div>
                <dt>En espera</dt>
                <dd>{stats ? fmtN(stats.espera) : '—'}</dd>
              </div>
              <div>
                <dt>Accesos concedidos</dt>
                <dd>{stats ? fmtN(stats.accesos) : '—'}</dd>
              </div>
            </dl>
            <p className={styles.legend}>
              <span className={styles.legendDot} data-kind="espera" /> {STATUS_LABEL.espera}
              <span className={styles.legendDot} data-kind="lit" /> con invitación
              {myIndex >= 0 ? (
                <>
                  <span className={styles.legendDot} data-kind="mine" /> tu lugar
                </>
              ) : null}
            </p>
          </section>
        </div>

        <blockquote className={styles.quote}>
          <p>«No buscamos a muchos. Solo a los que escuchan cuando nadie más lo hace.»</p>
        </blockquote>
      </main>
    </div>
  )
}
