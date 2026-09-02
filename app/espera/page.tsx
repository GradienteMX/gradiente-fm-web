'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
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
// DE ESPERA") or straight from campaign links. Successful signups persist to
// localStorage so a returning visitor sees their queue position instead of an
// empty form.
//
// CHROME — «EL PLIEGO» (fase F). This page held the last copy of the EVA
// terminal-cockpit idiom; /welcome was re-chromed out of that exact idiom, so
// this is its translation: paper ground #EDEBE3, ink hairlines, Syne titles,
// grotesk body, mono labels, ONE acid fill-block (the submit), sys-red-paper
// for errors, one 2px-ink focus grammar, ≥44px targets. No bracket corners,
// no glow, no scanlines.
//
// HONESTY — every readout on this page is now true or declared:
//   · ESTADÍSTICAS DE INVITACIÓN is real (GET /api/waitlist).
//   · The queue position + alias in the success panel are real.
//   · The ASCII eye and the wave are procedural DRAWINGS, framed in dark
//     bezels and captioned as such — they measure nothing.
//   · Everything that used to fake it is gone: the node network, latency,
//     AES-256 banner, MHz + stability readouts, signal-intensity meter, the
//     "descifrando" theatre, the system log and the invented activity feed
//     ("nuevo registro desde Bogotá"). The manifesto line the decoder used to
//     type out survives as what it always was — a printed quote.
//
// The API surface is untouched: GET/POST /api/waitlist, the lib/waitlist
// constants, and the `gradiente:espera` localStorage contract.

const LS_KEY = 'gradiente:espera'

const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

const INPUT_CLS = `min-h-11 w-full border border-ink bg-paper px-3 py-2 font-mono text-d15 text-ink transition-colors placeholder:text-ink-faint focus:bg-white ${FOCUS_RING}`

interface StoredSignup {
  alias: string
  email: string
  position: number | null
}

export default function EsperaPage() {
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
    <div className="fixed inset-0 z-50 overflow-auto bg-paper text-ink">
      <div className="mx-auto flex min-h-full w-full max-w-[1180px] flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
        {/* ── Masthead ─────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink pb-3">
          <span className="font-syne text-d18 font-extrabold tracking-tight text-ink">
            GRADIENTE
          </span>
          <span className="border border-ink px-2 py-1 font-mono text-d11 uppercase tracking-widest text-ink-soft">
            ACCESO · SOLO INVITACIÓN
          </span>
        </header>

        <div className="grid flex-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,470px)]">
          {/* ── Left column — the drawing + the printed word ────────── */}
          <div className="order-2 flex flex-col gap-6 lg:order-1">
            {/* The eye is a 104-column canvas: below md it would have to be
                clipped, so it stays off small screens (same gate the cockpit
                version used) and the phone never pays for its rAF loop. */}
            <Bezel
              label="FIGURA"
              caption="Dibujo procedural. No mide nada: es una figura viva, no un indicador."
              className="hidden md:flex"
            >
              <EyeAscii />
            </Bezel>

            {/* The manifesto line the old decoder used to type out, printed
                as what it is: a quote. */}
            <figure className="border border-ink bg-paper-raised p-5">
              <blockquote className="font-syne text-d28 font-extrabold uppercase leading-8 text-ink">
                No buscamos a muchos. Solo a los que escuchan cuando nadie más
                lo hace.
              </blockquote>
            </figure>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Panel title="Nota del operador">
                <p className="font-grotesk text-d15 leading-relaxed text-ink-soft">
                  Si estás viendo esto, es porque la red te reconoció. No
                  hacemos ruido: construimos lo que el sistema no entiende.
                  Gracias por mantener la frecuencia.
                </p>
                <p className="mt-3 font-mono text-d11 uppercase tracking-widest text-ink-faint">
                  — 0F
                </p>
              </Panel>

              <Bezel
                label="ONDA"
                caption="Atmósfera, no telemetría: la onda se dibuja sola."
              >
                <WaveAscii
                  cols={44}
                  rows={5}
                  className="text-[10px] leading-[1] text-panel-text/70"
                />
              </Bezel>
            </div>
          </div>

          {/* ── Right column — the door + the real numbers ──────────── */}
          <div className="order-1 flex flex-col gap-6 lg:order-2">
            <section className="border border-ink bg-paper-raised">
              <div className="border-b border-ink px-5 py-3">
                <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
                  MÓDULO DE ESPERA
                </span>
                <h1 className="font-syne text-d28 font-extrabold uppercase leading-8 text-ink">
                  {done ? 'Señal registrada' : 'Señal encontrada'}
                </h1>
              </div>

              <div className="p-5">
                {done ? (
                  <div className="flex flex-col gap-4">
                    <dl className="flex flex-col divide-y divide-ink/15 border-y border-ink">
                      <DoneRow label="ALIAS">
                        {alias.trim().toUpperCase() || '—'}
                      </DoneRow>
                      <DoneRow label="POSICIÓN">
                        <span className="tabular-nums">
                          {done.position != null
                            ? `#${String(done.position).padStart(3, '0')}`
                            : '#—'}
                        </span>
                      </DoneRow>
                      <DoneRow label="ESTADO">EN ESPERA</DoneRow>
                    </dl>

                    {done.already && (
                      <p className="border border-ink px-3 py-2 font-mono text-d13 uppercase tracking-widest text-ink">
                        ESTE CORREO YA ESTABA EN LA LISTA — TU POSICIÓN NO CAMBIÓ.
                      </p>
                    )}
                    {done.restored && (
                      <p className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
                        ESTA TERMINAL YA TRANSMITIÓ SU SEÑAL.
                      </p>
                    )}

                    <p className="font-grotesk text-d15 leading-relaxed text-ink-soft">
                      Te avisaremos por correo cuando la puerta se abra. La
                      señal sabe dónde encontrarte.
                    </p>

                    <BackLink />

                    <button
                      type="button"
                      onClick={reset}
                      className={`self-start font-mono text-d11 uppercase tracking-widest text-ink-soft underline underline-offset-4 hover:no-underline ${FOCUS_RING}`}
                    >
                      REGISTRAR OTRO CORREO
                    </button>
                  </div>
                ) : (
                  <form onSubmit={submit} className="relative flex flex-col gap-4" noValidate>
                    <p className="font-grotesk text-d15 leading-relaxed text-ink-soft">
                      Has encontrado una frecuencia que no es para todos. Deja
                      tus datos y te avisaremos cuando la puerta se abra.
                    </p>

                    {/* Honeypot — visually removed, still in the DOM for bots.
                        The form's `relative` is load-bearing: it is the
                        containing block this is positioned against. */}
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

                    <Field
                      label="ALIAS / IDENTIFICADOR"
                      htmlFor="espera-alias"
                      aside={`${alias.length}/${WAITLIST_ALIAS_MAX}`}
                    >
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
                        className={INPUT_CLS}
                      />
                    </Field>

                    <Field
                      label="CORREO ELECTRÓNICO"
                      htmlFor="espera-email"
                      aside={emailValid ? 'FORMATO OK' : undefined}
                    >
                      <input
                        id="espera-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu@señal.net"
                        autoComplete="email"
                        inputMode="email"
                        className={INPUT_CLS}
                      />
                    </Field>

                    <SelectField
                      label="CIUDAD / ZONA"
                      id="espera-city"
                      value={city}
                      onChange={setCity}
                      options={WAITLIST_CITIES}
                    />

                    <SelectField
                      label="¿CÓMO NOS ENCONTRASTE?"
                      id="espera-source"
                      value={source}
                      onChange={setSource}
                      options={WAITLIST_SOURCES}
                    />

                    {error && (
                      <p className="border border-sys-red-paper px-3 py-2 font-mono text-d13 font-bold leading-relaxed tracking-widest text-sys-red-paper">
                        ⚠ {error}
                      </p>
                    )}

                    {/* The page's ONE acid moment: a fill-block with ink on
                        top — the same weight /welcome's waitlist bar carries. */}
                    <button
                      type="submit"
                      disabled={submitting}
                      className={`flex min-h-11 items-center justify-between gap-3 border border-ink bg-acid px-4 py-3 font-mono text-d13 font-bold uppercase tracking-widest text-ink transition-colors enabled:hover:bg-ink enabled:hover:text-paper disabled:cursor-wait disabled:opacity-45 ${FOCUS_RING}`}
                    >
                      <span>
                        {submitting ? 'TRANSMITIENDO SEÑAL…' : 'UNIRME A LA LISTA DE ESPERA'}
                      </span>
                      <span aria-hidden>→</span>
                    </button>

                    <BackLink />

                    <p className="font-mono text-d11 uppercase leading-relaxed tracking-widest text-ink-faint">
                      SOLO USAREMOS TU CORREO PARA AVISARTE DEL ACCESO. NADA MÁS.
                    </p>
                  </form>
                )}
              </div>
            </section>

            {/* Real numbers — GET /api/waitlist, nothing invented. */}
            <Panel title="Estadísticas de invitación" note="DATOS EN VIVO">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Stat label="SEÑALES ENCONTRADAS" value={stats ? fmt(stats.senales) : '—'} />
                <Stat label="EN LISTA DE ESPERA" value={stats ? fmt(stats.espera) : '—'} />
                <Stat label="ACCESOS CONCEDIDOS" value={stats ? fmt(stats.accesos) : '—'} />
                <Stat label="TASA DE ACEPTACIÓN" value={tasa} />
              </dl>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Chrome primitives ───────────────────────────────────────────────────────

/** Paper panel: hairline head with a Syne sub-title, body below. */
function Panel({
  title,
  note,
  children,
}: {
  title: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <section className="border border-ink bg-paper-raised">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-ink px-5 py-3">
        <h2 className="font-syne text-d18 font-extrabold uppercase text-ink">{title}</h2>
        {note && (
          <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
            {note}
          </span>
        )}
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

/**
 * Bezel — the dark instrument frame. Everything on this site that GLOWS or
 * moves lives inside one of these: an ink-bordered panel of #111 with the
 * paper ground stopping at its edge. The caption is not decoration — it is
 * the honesty label that lets a generative drawing sit on an editorial page
 * without pretending to be a readout.
 */
function Bezel({
  label,
  caption,
  className = '',
  children,
}: {
  label: string
  caption: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <figure className={`flex flex-col border border-ink bg-panel ${className}`}>
      <figcaption className="flex items-baseline justify-between gap-3 border-b border-ink/40 px-4 py-2">
        <span className="font-mono text-d11 font-bold uppercase tracking-widest text-panel-text">
          {label}
        </span>
        <span className="font-mono text-d11 uppercase tracking-widest text-panel-text/50">
          ATMÓSFERA
        </span>
      </figcaption>
      <div className="flex min-h-0 items-center justify-center overflow-hidden p-3">
        {children}
      </div>
      <p className="border-t border-ink/40 px-4 py-2 font-grotesk text-d13 leading-snug text-panel-text/60">
        {caption}
      </p>
    </figure>
  )
}

function BackLink() {
  return (
    <Link
      href="/welcome"
      className={`flex min-h-11 items-center justify-between gap-3 border border-ink px-4 font-mono text-d13 uppercase tracking-widest text-ink transition-colors hover:bg-ink hover:text-paper ${FOCUS_RING}`}
    >
      <span aria-hidden>←</span>
      <span className="flex-1">REGRESAR AL ACCESO</span>
    </Link>
  )
}

function DoneRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="font-mono text-d11 uppercase tracking-widest text-ink-faint">{label}</dt>
      <dd className="font-mono text-d15 font-bold uppercase tracking-widest text-ink">
        {children}
      </dd>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-d11 uppercase tracking-widest text-ink-faint">{label}</dt>
      <dd className="font-syne text-d28 font-extrabold tabular-nums leading-8 text-ink">
        {value}
      </dd>
    </div>
  )
}

function fmt(n: number) {
  return n.toLocaleString('es-MX')
}

// ── Field wrappers ──────────────────────────────────────────────────────────

function Field({
  label,
  htmlFor,
  aside,
  children,
}: {
  label: string
  htmlFor: string
  /** Right-hand micro-readout: the alias counter, the email format check. */
  aside?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor={htmlFor}
          className="font-mono text-d11 uppercase tracking-widest text-ink-soft"
        >
          {label}
        </label>
        {aside && (
          <span className="shrink-0 font-mono text-d11 tabular-nums uppercase tracking-widest text-ink-faint">
            {aside}
          </span>
        )}
      </div>
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
          className={`${INPUT_CLS} appearance-none pr-10`}
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <ChevronDown
          size={15}
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink"
        />
      </div>
    </Field>
  )
}

// ── ASCII waveform (the bezel instrument) ───────────────────────────────────
//
// A real generative element, not chrome: a block-glyph histogram driven by two
// summed sines. Kept from the cockpit version verbatim — only its seat
// changed (it now lives inside a dark Bezel, captioned as atmosphere).
// Static under reduced-motion; 24fps cap otherwise.
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
// The page's centerpiece drawing: an all-seeing eye in dotted ASCII, radiating
// spokes, iris rings, a beam descending to a pedestal. Procedural per-cell
// brightness → character palette. Subtle animation only (ray shimmer, iris
// drift, a blink every ~7s); static frame under reduced-motion. ~104×56 cells
// at 24fps. Like the wave, it survived the re-chrome as a real generative
// element — reseated in a dark bezel, drawn in paper ink on panel black with
// the orange glow filter removed.
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
    // pointer-events-none for the same reason the cockpit version had it: a
    // full-bleed <pre> could otherwise swallow clicks when the grid overflows
    // on short viewports.
    <pre
      ref={ref}
      aria-hidden
      className="pointer-events-none select-none font-mono leading-[1.02] text-panel-text"
      style={{ fontSize: 'clamp(5px, 0.62vw, 9px)' }}
    />
  )
}
