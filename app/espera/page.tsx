'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Mail, UserSquare2 } from 'lucide-react'
import {
  WAITLIST_ALIAS_MAX,
  WAITLIST_CITIES,
  WAITLIST_EMAIL_RE,
  WAITLIST_SOURCES,
  type WaitlistJoinResponse,
  type WaitlistStats,
} from '@/lib/waitlist'

// /espera — public waitlist for the viral campaign. Anonymous visitors who
// arrive without an invite code land here from /welcome ("UNIRME A LA LISTA
// DE ESPERA") or straight from campaign links. Same terminal-cockpit language
// as /welcome (same chrome, same tokens) with the reference mockup's layout:
// side panels of telemetry, an ASCII transmission eye in the center, and the
// MÓDULO DE ESPERA form. Successful signups persist to localStorage so a
// returning visitor sees their queue position instead of an empty form.
//
// Stats in ESTADÍSTICAS DE INVITACIÓN are REAL (GET /api/waitlist) — house
// rule: every readout true data. Everything else labeled as atmosphere
// follows the /welcome precedent (fake logs, node meters).

const LS_KEY = 'gradiente:espera'

interface StoredSignup {
  alias: string
  email: string
  position: number | null
}

export default function EsperaPage() {
  // ── Live UTC clock (same cue as /welcome) ─────────────────────────────
  const [clock, setClock] = useState('--:--:--')
  useEffect(() => {
    const tick = () => {
      const d = new Date()
      const pad = (n: number) => n.toString().padStart(2, '0')
      setClock(`${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`)
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

  // ── Real waitlist stats ───────────────────────────────────────────────
  const [stats, setStats] = useState<WaitlistStats | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch('/api/waitlist')
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (!cancelled && s) setStats(s as WaitlistStats)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // ── Form state ────────────────────────────────────────────────────────
  const [alias, setAlias] = useState('')
  const [email, setEmail] = useState('')
  const [city, setCity] = useState<string>(WAITLIST_CITIES[0])
  const [source, setSource] = useState<string>(WAITLIST_SOURCES[0])
  const [tel, setTel] = useState('') // honeypot — never visible
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{
    position: number | null
    already: boolean
    restored: boolean
  } | null>(null)

  const emailValid = WAITLIST_EMAIL_RE.test(email.trim().toLowerCase())

  // Returning visitor: restore the registered state from localStorage.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LS_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as StoredSignup
      if (saved?.email) {
        setAlias(saved.alias ?? '')
        setEmail(saved.email)
        setDone({ position: saved.position ?? null, already: false, restored: true })
      }
    } catch {
      /* corrupted storage — ignore, show the form */
    }
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setError(null)

    const a = alias.trim()
    const em = email.trim().toLowerCase()
    if (!a) {
      setError('Falta tu alias. Elige un identificador.')
      return
    }
    if (!WAITLIST_EMAIL_RE.test(em)) {
      setError('Ese correo no parece válido. Revísalo.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias: a, email: em, city, source, tel }),
      })
      const json = (await res.json()) as WaitlistJoinResponse
      if (!res.ok || !json.ok) {
        setError(json.error ?? 'No pudimos registrar tu señal. Intenta de nuevo.')
        return
      }
      setDone({ position: json.position, already: json.already, restored: false })
      try {
        window.localStorage.setItem(
          LS_KEY,
          JSON.stringify({ alias: a, email: em, position: json.position } satisfies StoredSignup),
        )
      } catch {
        /* storage full/blocked — nonessential */
      }
      // Refresh the panel counts with the new signal included.
      fetch('/api/waitlist')
        .then((r) => (r.ok ? r.json() : null))
        .then((s) => s && setStats(s as WaitlistStats))
        .catch(() => {})
    } catch {
      setError('Sin conexión con el nodo. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    try {
      window.localStorage.removeItem(LS_KEY)
    } catch {
      /* ignore */
    }
    setDone(null)
    setAlias('')
    setEmail('')
    setError(null)
  }

  const tasa =
    stats && stats.senales > 0
      ? `${((stats.accesos / stats.senales) * 100).toFixed(2)}%`
      : '—'

  return (
    <div
      className="welcome-cockpit fixed inset-0 z-50 flex flex-col overflow-auto bg-base text-primary"
      style={{
        backgroundImage:
          'repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 3px)',
      }}
    >
      {/* ── Top strip ──────────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-sys-orange/30 bg-base/80 px-4 py-2 font-mono text-[10px] tracking-widest backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sys-orange" />
          <span className="text-sys-orange">// SISTEMA_GRADIENTE v3.1.7</span>
        </div>
        <span className="hidden text-muted lg:inline">
          ENLACE ESTABLECIDO <span className="text-sys-orange/60">---</span>{' '}
          ENCRIPTACIÓN AES-256{' '}
          <span className="ml-2 text-sys-green">◆ SEÑAL: FUERTE</span>
        </span>
        <span className="tabular-nums text-muted">
          UTC {clock} <span className="ml-2 text-sys-orange">NODO: MX-0F</span>
        </span>
      </header>

      {/* ── Body — telemetry | eye + form | telemetry ─────────────── */}
      <div className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[clamp(200px,15vw,250px)_1fr_clamp(210px,16vw,264px)]">
        {/* ── LEFT COLUMN ─────────────────────────────────────────── */}
        <aside className="hidden flex-col gap-4 font-mono text-[10px] tracking-widest lg:flex">
          <Panel label={null}>
            <div className="font-syne text-2xl font-black tracking-tight text-primary">
              GRADIENTE
            </div>
            <div className="text-[9px] tracking-[0.3em] text-sys-orange/80">
              TRANSMISIÓN PRIVADA
            </div>
          </Panel>

          <Panel label="NODO ACTIVO">
            <div className="text-sys-orange">&gt; MX-0F</div>
            <div className="text-muted">
              &gt; ESTADO: <span className="text-sys-green">EN LÍNEA</span>
            </div>
            <div className="text-muted">&gt; ENCRIPTACIÓN: AES-256</div>
            <div className="text-muted">
              &gt; LATENCIA: <span className="text-sys-orange">23ms</span>
            </div>
          </Panel>

          <Panel label="RED DE NODOS">
            <NodeRow name="MX-0F" fill={9} active />
            <NodeRow name="NL-7B" fill={6} />
            <NodeRow name="CL-1C" fill={5} />
            <NodeRow name="ES-3E" fill={4} />
            <NodeRow name="US-2A" fill={3} />
            <NodeRow name="JP-9D" fill={3} />
          </Panel>

          <Panel label="ESTADÍSTICAS DE INVITACIÓN">
            <StatBig label="SEÑALES ENCONTRADAS" value={stats ? fmt(stats.senales) : '—'} />
            <StatBig label="EN LISTA DE ESPERA" value={stats ? fmt(stats.espera) : '—'} />
            <StatBig label="ACCESOS CONCEDIDOS" value={stats ? fmt(stats.accesos) : '—'} />
            <StatBig label="TASA DE ACEPTACIÓN" value={tasa} />
          </Panel>

          <Panel label="FRECUENCIA DE TRANSMISIÓN">
            <div className="tabular-nums text-sys-orange">&gt;&gt; 27.122 MHz ± 0.033</div>
            <WaveAscii cols={26} rows={3} className="text-[9px] leading-[1] text-sys-orange/70" />
            <div className="text-muted">
              ESTABILIDAD: <span className="text-sys-green">87.3%</span>
            </div>
          </Panel>
        </aside>

        {/* ── CENTER — eye + módulo de espera ─────────────────────── */}
        <main className="flex min-h-0 flex-col items-center justify-center gap-6 xl:flex-row xl:gap-10">
          <div className="hidden min-h-0 flex-1 flex-col items-center justify-center md:flex">
            <EyeAscii />
            <p className="mt-2 font-mono text-[10px] tracking-[0.3em] text-sys-orange/70">
              TRANSMISIÓN EN CURSO<span className="animate-pulse">...</span>
            </p>
          </div>

          {/* MÓDULO DE ESPERA */}
          <section className="relative w-full max-w-[560px] shrink-0 px-5 py-6 sm:px-7">
            <Brackets />
            <div className="mb-4 flex items-center gap-2 font-mono text-[10px] tracking-widest text-sys-orange/80">
              <span aria-hidden>◆</span> .// MÓDULO DE ESPERA
            </div>

            {done ? (
              <div className="flex flex-col gap-5">
                <div>
                  <h1 className="font-mono text-[26px] font-bold leading-tight tracking-[0.14em] text-sys-green sm:text-[30px]">
                    SEÑAL REGISTRADA
                  </h1>
                  <div className="mt-2 h-px w-full bg-sys-green/40" />
                </div>

                <div className="flex flex-col gap-1.5 font-mono text-[12px] tracking-widest text-secondary">
                  <span>
                    &gt; ALIAS:{' '}
                    <span className="text-primary">{alias.trim().toUpperCase() || '—'}</span>
                  </span>
                  <span>
                    &gt; POSICIÓN EN LA LISTA:{' '}
                    <span className="text-[17px] tabular-nums text-sys-orange">
                      {done.position != null ? `#${String(done.position).padStart(3, '0')}` : '#—'}
                    </span>
                  </span>
                  <span>
                    &gt; ESTADO: <span className="text-sys-amber">EN ESPERA</span>
                  </span>
                </div>

                {done.already && (
                  <p className="font-mono text-[11px] tracking-widest text-sys-amber">
                    ⚠ ESTE CORREO YA ESTABA EN LA LISTA — TU POSICIÓN NO CAMBIÓ.
                  </p>
                )}
                {done.restored && (
                  <p className="font-mono text-[11px] tracking-widest text-muted">
                    &gt; ESTA TERMINAL YA TRANSMITIÓ SU SEÑAL.
                  </p>
                )}

                <p className="font-grotesk text-[13px] leading-relaxed text-secondary">
                  Te avisaremos por correo cuando la puerta se abra. La señal
                  sabe dónde encontrarte.
                </p>

                <Link
                  href="/welcome"
                  className="block w-full border border-sys-orange/40 px-4 py-3 text-center font-mono text-[12px] tracking-[0.18em] text-sys-orange/80 transition-colors hover:border-sys-orange hover:bg-sys-orange/10 hover:text-sys-orange"
                >
                  &lt; REGRESAR AL ACCESO
                </Link>

                <button
                  type="button"
                  onClick={reset}
                  className="self-start font-mono text-[10px] tracking-widest text-muted underline-offset-4 transition-colors hover:text-secondary hover:underline"
                >
                  &gt; registrar otro correo
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="flex flex-col gap-4">
                <div>
                  <h1 className="font-mono text-[28px] font-bold leading-tight tracking-[0.14em] text-sys-orange sm:text-[34px]">
                    SEÑAL ENCONTRADA
                  </h1>
                  <p className="mt-3 font-mono text-[11px] leading-relaxed tracking-wider text-secondary">
                    Has encontrado una frecuencia que no es para todos. ⚡
                    <br />
                    Deja tus datos y te avisaremos cuando la puerta se abra.
                    <br />
                    <span className="text-muted">
                      Nada es casualidad. Estás en la lista correcta.
                    </span>
                  </p>
                </div>

                {/* Honeypot — visually removed, still in the DOM for bots. */}
                <div
                  aria-hidden="true"
                  className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden"
                >
                  <label>
                    Teléfono
                    <input
                      type="text"
                      name="tel"
                      tabIndex={-1}
                      autoComplete="off"
                      value={tel}
                      onChange={(e) => setTel(e.target.value)}
                    />
                  </label>
                </div>

                <Field label="01_ ALIAS / IDENTIFICADOR" htmlFor="espera-alias">
                  <div className="flex items-center gap-2">
                    <div className="relative min-w-0 flex-1">
                      <input
                        id="espera-alias"
                        value={alias}
                        onChange={(e) => setAlias(e.target.value)}
                        maxLength={WAITLIST_ALIAS_MAX}
                        placeholder="NOMADA_77"
                        autoComplete="nickname"
                        autoCapitalize="characters"
                        autoCorrect="off"
                        spellCheck={false}
                        className="w-full border bg-black px-3 py-2.5 pr-9 font-mono text-sm tracking-widest text-primary outline-none transition-colors focus:border-sys-orange"
                        style={{ borderColor: '#242424' }}
                      />
                      <UserSquare2
                        size={15}
                        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sys-orange/50"
                      />
                    </div>
                    <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums tracking-widest text-muted">
                      {alias.length}/{WAITLIST_ALIAS_MAX}
                    </span>
                  </div>
                </Field>

                <Field label="02_ CORREO ELECTRÓNICO" htmlFor="espera-email">
                  <div className="flex items-center gap-2">
                    <div className="relative min-w-0 flex-1">
                      <input
                        id="espera-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu@señal.net"
                        autoComplete="email"
                        inputMode="email"
                        className="w-full border bg-black px-3 py-2.5 pr-9 font-mono text-sm tracking-wider text-primary outline-none transition-colors focus:border-sys-orange"
                        style={{ borderColor: '#242424' }}
                      />
                      <Mail
                        size={15}
                        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sys-orange/50"
                      />
                    </div>
                    <span
                      className={`w-12 shrink-0 text-right font-mono text-[9px] tracking-widest ${
                        emailValid ? 'text-sys-green' : 'text-muted/60'
                      }`}
                    >
                      {emailValid ? 'FORMATO OK' : '· · ·'}
                    </span>
                  </div>
                </Field>

                <SelectField
                  label="03_ CIUDAD / ZONA"
                  id="espera-city"
                  value={city}
                  onChange={setCity}
                  options={WAITLIST_CITIES}
                />

                <SelectField
                  label="04_ ¿CÓMO NOS ENCONTRASTE?"
                  id="espera-source"
                  value={source}
                  onChange={setSource}
                  options={WAITLIST_SOURCES}
                />

                {error && (
                  <p
                    className="border px-3 py-2 font-mono text-[11px] tracking-widest"
                    style={{ borderColor: '#E63329', color: '#E63329' }}
                  >
                    ⚠ {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-1 w-full border border-sys-orange bg-sys-orange px-4 py-3.5 font-mono text-[13px] font-bold tracking-[0.16em] text-[#0D0D0D] transition-all hover:bg-[#FB923C] hover:shadow-[0_0_28px_rgba(249,115,22,0.35)] disabled:cursor-wait disabled:opacity-60"
                >
                  {submitting ? '>> TRANSMITIENDO SEÑAL...' : '>> UNIRME A LA LISTA DE ESPERA <<'}
                </button>

                <Link
                  href="/welcome"
                  className="block w-full border border-sys-orange/40 px-4 py-3 text-center font-mono text-[12px] tracking-[0.18em] text-sys-orange/80 transition-colors hover:border-sys-orange hover:bg-sys-orange/10 hover:text-sys-orange"
                >
                  &lt; REGRESAR AL ACCESO
                </Link>

                <p className="font-mono text-[9px] leading-relaxed tracking-widest text-muted">
                  &gt; SOLO USAREMOS TU CORREO PARA AVISARTE DEL ACCESO. NADA MÁS.
                </p>
              </form>
            )}
          </section>
        </main>

        {/* ── RIGHT COLUMN ────────────────────────────────────────── */}
        <aside className="hidden flex-col gap-4 font-mono text-[10px] tracking-widest lg:flex">
          <Panel label="INTENSIDAD DE SEÑAL">
            <SignalIntensity />
          </Panel>

          <Panel label="DESCIFRANDO MENSAJE...">
            <Decoder />
          </Panel>

          <Panel label="NOTA DEL OPERADOR">
            <p className="font-grotesk text-[11px] leading-snug tracking-normal text-secondary">
              Si estás viendo esto,
              <br />
              es porque la red te reconoció.
              <br />
              <br />
              No hacemos ruido.
              <br />
              Construimos lo que el
              <br />
              sistema no entiende.
              <br />
              <br />
              Gracias por mantener
              <br />
              la frecuencia.
            </p>
            <p className="mt-1 text-muted">
              — 0F<span className="ml-1 animate-pulse">_</span>
            </p>
          </Panel>
        </aside>
      </div>

      {/* ── Bottom strip ───────────────────────────────────────────── */}
      <footer className="pointer-events-none grid shrink-0 grid-cols-1 gap-4 border-t border-sys-orange/30 bg-base/80 px-4 py-3 font-mono text-[10px] tracking-widest backdrop-blur-sm md:grid-cols-4">
        <div>
          <div className="mb-1 text-sys-orange">// LOGS DEL SISTEMA</div>
          {LOG_LINES.map((l) => (
            <div key={l} className="text-muted">
              {l}
            </div>
          ))}
          <div className="mt-1 text-sys-green">
            &gt;&gt; SEÑAL RECIBIDA. BIENVENIDO.<span className="animate-pulse">_</span>
          </div>
        </div>

        <div className="relative px-3 py-2">
          <Brackets />
          <div className="mb-1 text-sys-orange/70">ÚLTIMA ACTIVIDAD</div>
          {ACTIVITY_LINES.map((l) => (
            <div key={l} className="truncate text-muted">
              {l}
            </div>
          ))}
        </div>

        <div className="hidden md:block" aria-hidden>
          <div className="mb-1 text-sys-orange/70">ANÁLISIS DE FRECUENCIA</div>
          <WaveAscii cols={90} rows={4} className="text-[9px] leading-[1] text-sys-orange/55" />
        </div>

        <div className="text-right">
          <div className="mb-1 text-sys-orange">CANAL DE SALIDA</div>
          <div className="text-sys-green">&gt;&gt; ENCRIPTADO</div>
        </div>
      </footer>
    </div>
  )
}

// ── Static atmosphere (follows the /welcome precedent) ──────────────────────

const LOG_LINES = [
  '[13:20:11] CONEXIÓN ENTRANTE: 187.94.xxx.xx',
  '[13:20:12] VERIFICANDO PAQUETES..._',
  '[13:20:14] RUTA ALTERNATIVA ESTABLECIDA',
  '[13:20:16] ACCESO A MATRIZ: CONCEDIDO',
  '[13:20:21] ENLACE SINCRONIZADO',
]

const ACTIVITY_LINES = [
  '> 13:21 › Señal encontrada en foro privado',
  '> 13:21 › Nuevo registro desde Bogotá, CO',
  '> 13:21 › Conexión desde Japón',
  '> 13:21 › Acceso concedido a archivo',
  '> 13:21 › Pico de actividad detectado',
]

// ── Field wrappers ──────────────────────────────────────────────────────────

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="font-mono text-[10px] tracking-widest text-sys-orange"
      >
        {label}
      </label>
      {children}
    </div>
  )
}

function SelectField({
  label,
  id,
  value,
  onChange,
  options,
}: {
  label: string
  id: string
  value: string
  onChange: (v: string) => void
  options: readonly string[]
}) {
  return (
    <Field label={label} htmlFor={id}>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none border bg-black px-3 py-2.5 pr-9 font-mono text-sm tracking-wider text-primary outline-none transition-colors focus:border-sys-orange"
          style={{ borderColor: '#242424' }}
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sys-orange/60"
        />
      </div>
    </Field>
  )
}

// ── Panel + Brackets (same floating-annotation language as /welcome) ────────

function Panel({ label, children }: { label: string | null; children: React.ReactNode }) {
  return (
    <div className="relative flex flex-col gap-1 px-3 py-2">
      <Brackets />
      {label && <div className="text-sys-orange/70">{label}</div>}
      {children}
    </div>
  )
}

function Brackets() {
  return (
    <>
      <span className="pointer-events-none absolute left-0 top-0 h-3 w-3 border-l border-t border-sys-orange/80" />
      <span className="pointer-events-none absolute right-0 top-0 h-3 w-3 border-r border-t border-sys-orange/80" />
      <span className="pointer-events-none absolute bottom-0 left-0 h-3 w-3 border-b border-l border-sys-orange/80" />
      <span className="pointer-events-none absolute bottom-0 right-0 h-3 w-3 border-b border-r border-sys-orange/80" />
    </>
  )
}

// ── Left-column widgets ─────────────────────────────────────────────────────

function NodeRow({ name, fill, active = false }: { name: string; fill: number; active?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={active ? 'text-sys-green' : 'text-muted'}>&gt; {name}</span>
      <span className="inline-flex items-end gap-[2px]">
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className={
              i < fill
                ? active
                  ? 'bg-sys-green'
                  : 'bg-sys-orange'
                : 'bg-sys-orange/20'
            }
            style={{ width: 3, height: 7 }}
          />
        ))}
      </span>
    </div>
  )
}

function StatBig({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-1.5">
      <div className="text-[9px] text-muted">{label}</div>
      <div className="text-lg font-bold tabular-nums leading-tight text-sys-orange">{value}</div>
    </div>
  )
}

function fmt(n: number) {
  return n.toLocaleString('es-MX')
}

// ── Right-column widgets ────────────────────────────────────────────────────

// Ascending bar meter + big percentage. The percentage breathes ±1 every few
// seconds so the panel reads live; static under reduced-motion.
function SignalIntensity() {
  const [pct, setPct] = useState(87)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => {
      setPct(86 + Math.floor(Math.random() * 3)) // 86–88
    }, 2600)
    return () => window.clearInterval(id)
  }, [])

  const BARS = 12
  const lit = Math.round((pct / 100) * BARS)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-[3px]" aria-hidden>
        {Array.from({ length: BARS }, (_, i) => (
          <span
            key={i}
            className={i < lit ? 'bg-sys-orange' : 'bg-sys-orange/20'}
            style={{ width: 6, height: 6 + i * 2 }}
          />
        ))}
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-bold tabular-nums text-sys-orange">{pct}%</span>
        <span className="text-sys-green">ESTABLE</span>
      </div>
    </div>
  )
}

// Typewriter reveal of the decoded transmission. One pass on mount, full text
// immediately under reduced-motion.
const DECODE_LINES: { text: string; tone: 'dim' | 'quote' | 'sys' }[] = [
  { text: '"Iniciando protocolo de', tone: 'dim' },
  { text: 'descifrado..."', tone: 'dim' },
  { text: '> verificando integridad...', tone: 'sys' },
  { text: '> frecuencias conocidas...', tone: 'sys' },
  { text: 'mensaje recuperado:', tone: 'dim' },
  { text: '', tone: 'dim' },
  { text: '"NO BUSCAMOS A MUCHOS.', tone: 'quote' },
  { text: 'SOLO A LOS QUE ESCUCHAN', tone: 'quote' },
  { text: 'CUANDO NADIE MÁS LO HACE."', tone: 'quote' },
  { text: '', tone: 'dim' },
  { text: '> Fin de transmisión.', tone: 'sys' },
]

function Decoder() {
  const total = DECODE_LINES.reduce((n, l) => n + l.text.length + 1, 0)
  const [n, setN] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setN(total)
      return
    }
    const id = window.setInterval(() => {
      setN((v) => {
        if (v >= total) {
          window.clearInterval(id)
          return v
        }
        return v + 2
      })
    }, 50)
    return () => window.clearInterval(id)
  }, [total])

  let budget = n
  return (
    <div className="flex min-h-[150px] flex-col gap-0.5">
      {DECODE_LINES.map((l, i) => {
        const take = Math.max(0, Math.min(l.text.length, budget))
        budget -= l.text.length + 1
        const shown = l.text.slice(0, take)
        const activeCursor = take > 0 && take < l.text.length
        if (take <= 0 && l.text !== '') return null
        return (
          <div
            key={i}
            className={
              l.tone === 'quote'
                ? 'text-[10.5px] leading-snug text-primary'
                : l.tone === 'sys'
                  ? 'text-muted'
                  : 'text-secondary'
            }
          >
            {shown}
            {activeCursor && <span className="animate-pulse text-sys-orange">█</span>}
          </div>
        )
      })}
    </div>
  )
}

// ── ASCII waveform (shared by the frequency panels) ─────────────────────────
//
// Same block-glyph histogram idea as /welcome's SpectrumAscii, parameterized
// so one component serves both the mini left-column meter and the wide footer
// band. Static under reduced-motion; 24fps cap otherwise.
function WaveAscii({
  cols,
  rows,
  className,
}: {
  cols: number
  rows: number
  className?: string
}) {
  const ref = useRef<HTMLPreElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const BLOCKS = ' ▁▂▃▄▅▆▇█'
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let raf = 0
    let last = 0
    const FRAME_MS = 1000 / 24

    const renderAt = (t: number) => {
      const lines: string[] = []
      for (let r = 0; r < rows; r++) {
        let line = ''
        for (let c = 0; c < cols; c++) {
          const seed = c * 0.41 + r * 1.3
          const h =
            (Math.sin(seed + t * 1.4) + 1) * 0.5 * 0.6 +
            (Math.sin(seed * 1.7 + t * 0.6) + 1) * 0.5 * 0.4
          const rowBias = 1 - r / rows
          const v = Math.min(1, h * rowBias * 1.15)
          line += BLOCKS[Math.min(BLOCKS.length - 1, Math.floor(v * BLOCKS.length))]
        }
        lines.push(line)
      }
      el.textContent = lines.join('\n')
    }

    if (reduced) {
      renderAt(0)
      return
    }
    const tick = (now: number) => {
      if (now - last >= FRAME_MS) {
        last = now
        renderAt(now / 1000)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [cols, rows])

  return <pre ref={ref} aria-hidden className={`select-none font-mono ${className ?? ''}`} />
}

// ── ASCII transmission eye ──────────────────────────────────────────────────
//
// The mockup's centerpiece: an all-seeing eye drawn as dotted ASCII, radiating
// spokes, iris rings, a beam descending to a pedestal. Procedural per-cell
// brightness → character palette, same pattern as /welcome's VinylAscii.
// Subtle animation only (ray shimmer, iris drift, a blink every ~7s); static
// frame under reduced-motion. ~104×56 cells at 24fps — same budget class as
// the vinyl.
function EyeAscii() {
  const ref = useRef<HTMLPreElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const COLS = 104
    const ROWS = 56
    const cx = (COLS - 1) / 2
    const cy = (ROWS - 1) / 2
    const CHAR_ASPECT = 0.55 // columns are narrower than rows

    const R_MAX = 26 // ray field extent
    const R_RAY_IN = 12.8 // rays start outside the eye
    const R_EYE = 10.6 // almond half-width
    const R_IRIS = 4.4
    const R_PUPIL = 1.9
    const EYE_CY = -2.4 // eye sits slightly above center; beam fills below

    const PALETTE = [' ', '·', ':', '+', '*', '#', '@']

    // Deterministic per-cell hash — dotted/particle texture for the rays.
    const hash = (x: number, y: number) => {
      const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
      return h - Math.floor(h)
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let raf = 0
    let last = 0
    const FRAME_MS = 1000 / 24

    const renderAt = (t: number) => {
      // Blink: fast lid close/open every ~7.3s. `open` is the lid aperture.
      let open = 1
      if (!reduced) {
        const tb = t % 7.3
        if (tb < 0.34) open = Math.max(0.07, Math.abs(Math.cos((Math.PI * tb) / 0.34)))
      }

      const lines: string[] = []
      for (let y = 0; y < ROWS; y++) {
        let line = ''
        for (let x = 0; x < COLS; x++) {
          const dx = (x - cx) * CHAR_ASPECT
          const dy = y - cy
          const ey = dy - EYE_CY // eye-local vertical
          const r = Math.sqrt(dx * dx + ey * ey)
          const a = Math.atan2(ey, dx)

          let v = 0

          // ── Radiating mandala (outside the eye) ─────────────────
          if (r > R_RAY_IN && r < R_MAX) {
            const wob = reduced ? 0 : Math.sin(t * 0.3 + a * 2) * 0.12
            const spokes24 = Math.pow(Math.max(0, Math.cos(24 * a + wob)), 16)
            const spokes8 = Math.pow(Math.max(0, Math.cos(8 * a + 0.26)), 60) * 1.15
            const ring =
              Math.pow(Math.max(0, Math.sin(r * 0.85 - (reduced ? 0 : t * 0.35))), 6) * 0.35
            // Fade in from the eye edge, out toward the rim.
            const fade =
              Math.min(1, (r - R_RAY_IN) / 1.6) * Math.min(1, (R_MAX - r) / 5)
            let ray = (spokes24 * 0.8 + spokes8 + ring * (spokes24 * 0.5 + 0.4)) * fade
            // Particle texture: dim by hash, drop the darkest fifth entirely.
            const hz = hash(x, y)
            ray *= hz < 0.18 ? 0 : 0.55 + 0.45 * hz
            v = Math.max(v, ray)
          }

          // ── Almond (lid) + interior ─────────────────────────────
          const re = Math.sqrt(dx * dx + Math.pow((ey / open) * 1.85, 2))
          if (open <= 0.15) {
            // Mid-blink: a single closed-lid line.
            if (Math.abs(ey) < 0.45 && Math.abs(dx) < R_EYE) v = Math.max(v, 0.8)
          } else {
            if (Math.abs(re - R_EYE) < 0.85) v = Math.max(v, 0.92) // lid outline
            if (Math.abs(re - R_EYE * 1.3) < 0.5) v = Math.max(v, 0.34) // outer lid echo

            if (re < R_EYE - 0.85) {
              const ri = Math.sqrt(dx * dx + ey * ey)
              if (ri < R_PUPIL) {
                // Dark pupil with a bright specular point.
                const glow = Math.exp(
                  -((dx + 0.35) * (dx + 0.35) + (ey + 0.35) * (ey + 0.35)) / 0.42,
                )
                v = Math.max(v, 0.14 + glow)
              } else if (ri < R_IRIS) {
                // Iris: breathing rings + faint spokes.
                const rings =
                  0.32 +
                  0.4 *
                    Math.pow(
                      0.5 + 0.5 * Math.sin(ri * 3.1 - (reduced ? 0 : t * 0.5)),
                      2,
                    )
                const irisSpokes =
                  Math.pow(Math.max(0, Math.cos(18 * a + (reduced ? 0 : t * 0.2))), 8) * 0.28
                v = Math.max(v, rings + irisSpokes)
              } else {
                // Sclera: sparse static dust.
                v = Math.max(v, hash(x, y) > 0.82 ? 0.16 : 0.05)
              }
            }
          }

          // ── Beam + pedestal below the eye ───────────────────────
          if (ey > R_EYE * 0.8 && ey < 24.5) {
            const w = 1.1 + (ey - R_EYE * 0.8) * 0.06
            if (Math.abs(dx) < w) {
              const dashes = (y + (reduced ? 0 : Math.floor(t * 2))) % 2 === 0 ? 1 : 0.45
              const fadeDown = 1 - (ey - R_EYE * 0.8) / 18
              v = Math.max(v, 0.62 * dashes * Math.max(0.25, fadeDown))
            }
            // Pedestal: triangle outline near the bottom.
            if (ey > 20) {
              const half = (ey - 20) * 1.9
              if (Math.abs(Math.abs(dx) - half) < 0.55 && half > 0.4) v = Math.max(v, 0.7)
              if (Math.abs(ey - 24) < 0.4 && Math.abs(dx) < half) v = Math.max(v, 0.35)
            }
          }

          // ── Crown: antenna dashes + crescent above ──────────────
          if (ey < -R_EYE * 1.15) {
            if (Math.abs(dx) < 0.55 && ey > -18.5 && y % 2 === 0) v = Math.max(v, 0.6)
            const rc = Math.sqrt(dx * dx + (ey + 19.6) * (ey + 19.6))
            if (Math.abs(rc - 2.1) < 0.55 && ey + 19.6 < 0.6) v = Math.max(v, 0.75)
          }

          if (v > 1) v = 1
          const idx = Math.min(PALETTE.length - 1, Math.floor(v * PALETTE.length))
          line += PALETTE[idx]
        }
        lines.push(line)
      }
      el.textContent = lines.join('\n')
    }

    if (reduced) {
      renderAt(0)
      return
    }
    const tick = (now: number) => {
      if (now - last >= FRAME_MS) {
        last = now
        renderAt(now / 1000)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    // pointer-events-none for the same reason as /welcome's vinyl: the filter
    // creates a stacking context that could otherwise swallow clicks when the
    // grid overflows on short viewports.
    <pre
      ref={ref}
      aria-hidden
      className="pointer-events-none select-none font-mono leading-[1.02] text-sys-orange/90"
      style={{
        fontSize: 'clamp(5px, 0.62vw, 9px)',
        filter: 'drop-shadow(0 0 14px rgba(249,115,22,0.28))',
      }}
    />
  )
}
