'use client'

import { useEffect, useRef, useState } from 'react'
import { Code2, UserSquare2 } from 'lucide-react'
import { useAuth } from '@/components/auth/useAuth'

// /welcome — invite-only landing for anonymous visitors. Middleware
// redirects everyone here when they have no session, and bounces them
// off again once they're logged in. The look is deliberately a
// terminal cockpit: status strips, side panels of atmosphere, ASCII
// vinyl spinning in the center, and two CTAs that summon the
// existing LoginOverlay (login mode + signup mode).
export default function WelcomePage() {
  const { openLogin } = useAuth()

  // Live UTC clock — doubles as a "this is on, this is real" cue.
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
          ENCRIPTACIÓN AES-256
        </span>
        <span className="tabular-nums text-muted">UTC {clock}</span>
      </header>

      {/* ── Body — three columns on desktop, stacked on mobile ────── */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 md:grid-cols-[clamp(220px,18vw,280px)_1fr_clamp(220px,18vw,280px)]">
        {/* ── LEFT COLUMN ─────────────────────────────────────────── */}
        <aside className="hidden flex-col gap-4 font-mono text-[10px] tracking-widest md:flex">
          <div className="flex flex-col gap-1">
            <span className="text-sys-orange">
              &gt; ACCESO: <span className="text-sys-red">RESTRINGIDO</span>
            </span>
            <span className="text-sys-orange">
              &gt; NODO: MX-DF{' '}
              <span className="text-muted">// 19.4326°N -99.1332°W</span>
            </span>
            <span className="text-sys-orange">
              &gt; ESTADO: <span className="text-sys-green">EN LÍNEA</span>
            </span>
          </div>

          <Panel label="ACTIVIDAD RECIENTE">
            {RECENT_UPLOADS.map((u) => (
              <div key={u.file} className="truncate text-muted">
                &gt; UPLOAD: <span className="text-secondary">{u.date}</span> _{' '}
                <span className="text-sys-orange/80">{u.file}</span>
              </div>
            ))}
            <div className="mt-2 text-muted/60">... [ VER MÁS ]</div>
          </Panel>
        </aside>

        {/* ── CENTER COLUMN ───────────────────────────────────────── */}
        <main className="flex min-h-0 flex-col items-center justify-start gap-3">
          {/* Wordmark */}
          <h1
            data-text="GRADIENTE"
            className="welcome-glitch whitespace-nowrap font-syne font-black leading-none tracking-tighter text-primary"
            style={{ fontSize: 'clamp(3rem, 9vw, 6.5rem)' }}
          >
            GRADIENTE
          </h1>
          <p className="font-mono text-[11px] tracking-[0.4em] text-sys-orange">
            T R A N S M I S I Ó N · P R I V A D A
          </p>

          {/* Tagline */}
          <div className="mt-1 max-w-xl text-center font-grotesk text-[13px] leading-relaxed text-secondary">
            <p>&ldquo;Has encontrado una puerta fuera del mapa.</p>
            <p>Aquí se preserva lo que no suena en las ondas.</p>
            <p className="text-muted">
              Música electrónica. Archivos ocultos. Señales que no fueron para ti.&rdquo;
            </p>
          </div>
          <p className="font-mono text-[11px] tracking-widest text-sys-orange">
            ESCUCHA CON CUIDADO. NO TODO DEBE SER ENCONTRADO.
            <span className="ml-1 animate-pulse">_</span>
          </p>

          {/* Vinyl */}
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <VinylAscii />
          </div>

          {/* CTAs */}
          <div className="flex w-full max-w-3xl flex-col gap-4 sm:flex-row">
            <CtaButton
              icon={<UserSquare2 size={26} strokeWidth={1.5} />}
              label="INICIAR SESIÓN"
              sublabel="USUARIO REGISTRADO"
              onClick={() => openLogin('login')}
            />
            <CtaButton
              icon={<Code2 size={26} strokeWidth={1.5} />}
              label="INSERTAR CÓDIGO"
              sublabel="ACCESO POR INVITACIÓN"
              onClick={() => openLogin('signup')}
            />
          </div>

          <p className="mt-2 font-mono text-[10px] tracking-widest text-muted">
            <span className="text-sys-red">⚠ ADVERTENCIA</span>: Este sistema
            registra actividad. Toda acción deja rastro.
          </p>
        </main>

        {/* ── RIGHT COLUMN ────────────────────────────────────────── */}
        <aside className="hidden flex-col gap-4 font-mono text-[10px] tracking-widest md:flex">
          <div className="flex items-center justify-end gap-2 text-sys-orange">
            <span>SEÑAL: DÉBIL</span>
            <SignalBars />
          </div>

          <Panel label="ESTADÍSTICAS DEL ARCHIVO" align="right">
            <StatRow label="ARCHIVOS" value="1.248" />
            <StatRow label="ARTISTAS" value="397" />
            <StatRow label="SESIONES" value="852" />
            <StatRow label="PAÍSES" value="28" />
            <StatRow label="ÚLTIMA ACT." value="00:17:42" />
          </Panel>

          <Panel label="FRECUENCIA PORTADORA" align="right">
            <div className="text-sys-orange tabular-nums">
              &gt;&gt; 87.120 KHZ ±0.003
            </div>
          </Panel>

          <Panel label="SINCRONIZACIÓN" align="right">
            <div className="text-sys-green">&gt;&gt; ESTABLE</div>
          </Panel>
        </aside>
      </div>

      {/* ── Bottom strip ───────────────────────────────────────────── */}
      <footer className="grid shrink-0 grid-cols-1 gap-4 border-t border-sys-orange/30 bg-base/80 px-4 py-3 font-mono text-[10px] tracking-widest backdrop-blur-sm md:grid-cols-4">
        <div>
          <div className="mb-1 text-sys-orange">// LOGS DEL SISTEMA</div>
          {LOG_LINES.map((l) => (
            <div key={l} className="text-muted">
              {l}
            </div>
          ))}
          <div className="mt-1 text-sys-green">
            &gt;&gt; BIENVENIDO AL ARCHIVO.<span className="animate-pulse">_</span>
          </div>
        </div>

        <div className="relative px-3 py-2">
          <Brackets />
          <div className="mb-1 text-sys-orange/70">MENSAJE DEL OPERADOR</div>
          <p className="font-grotesk text-[11px] leading-snug text-secondary">
            El archivo no tiene dueños.<br />
            Solo custodios temporales.<br />
            Si algo aquí te encuentra,<br />
            ya eras parte de la señal.
          </p>
          <p className="mt-1 text-muted">— G.<span className="ml-1 animate-pulse">_</span></p>
        </div>

        <div className="hidden md:block" aria-hidden>
          <SpectrumAscii />
        </div>

        <div className="text-right">
          <div className="mb-1 text-sys-orange">CANAL DE SALIDA</div>
          <div className="text-sys-red">&gt;&gt; CERRADO</div>
        </div>
      </footer>

      {/* Glitch keyframes for the wordmark — scoped to this page. */}
      <style jsx>{`
        .welcome-glitch {
          position: relative;
        }
        .welcome-glitch::before,
        .welcome-glitch::after {
          content: attr(data-text);
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .welcome-glitch::before {
          color: #ff3b30;
          mix-blend-mode: screen;
          transform: translate(2px, 0);
          clip-path: polygon(0 0, 100% 0, 100% 45%, 0 45%);
          animation: welcome-glitch-1 3.6s steps(2) infinite;
          opacity: 0.55;
        }
        .welcome-glitch::after {
          color: #00d4ff;
          mix-blend-mode: screen;
          transform: translate(-2px, 0);
          clip-path: polygon(0 55%, 100% 55%, 100% 100%, 0 100%);
          animation: welcome-glitch-2 4.2s steps(2) infinite;
          opacity: 0.55;
        }
        @keyframes welcome-glitch-1 {
          0%, 92%, 100% { transform: translate(2px, 0); }
          93% { transform: translate(-3px, -1px); }
          94% { transform: translate(4px, 2px); }
          95% { transform: translate(-1px, 1px); }
        }
        @keyframes welcome-glitch-2 {
          0%, 88%, 100% { transform: translate(-2px, 0); }
          89% { transform: translate(3px, 1px); }
          90% { transform: translate(-4px, -2px); }
          91% { transform: translate(1px, -1px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .welcome-glitch::before,
          .welcome-glitch::after {
            animation: none;
          }
        }
      `}</style>
    </div>
  )
}

// ── Panel wrapper ───────────────────────────────────────────────────────────
//
// Floating annotation, not a card. No background fill, no full border —
// just the four orange corner ticks pinning the content to the surface.
// This keeps the cockpit feel of the reference, where data is overlaid on
// the dark void rather than packaged into UI cards.
function Panel({
  label,
  align = 'left',
  children,
}: {
  label: string
  align?: 'left' | 'right'
  children: React.ReactNode
}) {
  return (
    <div
      className={`relative flex flex-col gap-1 px-3 py-2 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      <Brackets />
      <div className="text-sys-orange/70">{label}</div>
      {children}
    </div>
  )
}

// Larger, more visible corner ticks — the only frame the panels need.
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

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-muted">
      &gt; {label}: <span className="text-sys-orange tabular-nums">{value}</span>
    </div>
  )
}

// ── Signal-strength bars ────────────────────────────────────────────────────
function SignalBars() {
  return (
    <span className="inline-flex items-end gap-[2px] align-middle">
      {[3, 5, 4, 7, 9].map((h, i) => (
        <span
          key={i}
          className={i < 2 ? 'bg-sys-orange' : 'bg-sys-orange/30'}
          style={{ width: 2, height: h }}
        />
      ))}
    </span>
  )
}

// ── CTA button ──────────────────────────────────────────────────────────────
function CtaButton({
  icon,
  label,
  sublabel,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  sublabel: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-1 items-center gap-4 border border-sys-orange/50 bg-sys-orange/5 px-6 py-5 text-left font-mono transition-all hover:border-sys-orange hover:bg-sys-orange/15"
    >
      <Brackets />
      <span className="flex h-12 w-12 shrink-0 items-center justify-center border border-sys-orange/40 text-sys-orange/80 transition-colors group-hover:text-sys-orange">
        {icon}
      </span>
      <span className="flex flex-col gap-1 leading-tight">
        <span className="text-[14px] tracking-widest text-sys-orange">
          {label}
        </span>
        <span className="text-[10px] tracking-widest text-muted">
          {sublabel}
        </span>
      </span>
    </button>
  )
}

// ── ASCII vinyl renderer ────────────────────────────────────────────────────
//
// Concentric grooves drawn into a <pre>, viewed at a tilt so it reads as
// a record on a turntable rather than a flat target. Per cell:
//   1. Squash y for perspective (TILT) so circles render as the elongated
//      ellipses your eye expects from a record viewed from above-front.
//   2. Snap distance to the nearest groove ring; cells close to a ring
//      light up, cells between rings stay dim — this is what gives the
//      striated "grooves" look instead of a flat fill.
//   3. Top-down reflection — brightness biased toward the top of the disc
//      and a slow-moving sparkle wedge that rotates with the spin.
//   4. A small rotating tick on the label so you can see it spinning.
function VinylAscii() {
  const ref = useRef<HTMLPreElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Bigger grid + more aggressive tilt = a record viewed at a 35° angle
    // instead of from straight overhead. The squashed Y axis also frees
    // vertical space for more visible groove rings.
    const COLS = 150
    const ROWS = 64
    const cx = (COLS - 1) / 2
    const cy = (ROWS - 1) / 2
    const CHAR_ASPECT = 0.5
    const TILT_Y = 0.42 // strong perspective squash
    const RADIUS_DISC = 33
    const RADIUS_LABEL = 3.4
    const RADIUS_LABEL_INNER = 1.4
    const RADIUS_HOLE = 0.5

    // Tight groove pitch — about 30 visible grooves between label and rim.
    const GROOVE_PITCH = 0.5
    // Edge band width controls how "thick" each groove line reads.
    const EDGE_BAND = 0.16

    const PALETTE = [' ', '·', ':', '+', '*', '#', '@']

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let raf = 0
    let last = 0
    const FRAME_MS = 1000 / 30

    // Specular hotspot — fixed relative to the viewer (light from
    // upper-right of the page). Computed in the squashed-disc space so
    // it sits visually "on" the disc, not floating in screen space.
    const specularAngle = -Math.PI * 0.35 // upper-right
    const specularRadius = RADIUS_DISC * 0.65 // distance from center

    const renderAt = (t: number) => {
      const spin = t * 0.45 // rad/sec
      // Tiny breathing on the specular so it doesn't read as static decal.
      const specWobble = Math.sin(t * 0.6) * 0.05
      const sx = Math.cos(specularAngle + specWobble) * specularRadius
      const sy = Math.sin(specularAngle + specWobble) * specularRadius

      const lines: string[] = []
      for (let y = 0; y < ROWS; y++) {
        let line = ''
        for (let x = 0; x < COLS; x++) {
          const dx = (x - cx) * CHAR_ASPECT
          const dy = (y - cy) / TILT_Y
          const r = Math.sqrt(dx * dx + dy * dy)

          if (r > RADIUS_DISC + 0.6) {
            line += ' '
            continue
          }
          if (r < RADIUS_HOLE) {
            line += ' '
            continue
          }

          const angle = Math.atan2(dy, dx)

          // Label disc — solid bright with a rotating tick.
          if (r < RADIUS_LABEL) {
            const tickDelta =
              ((angle - spin + Math.PI * 3) % (Math.PI * 2)) - Math.PI
            const tickHit = Math.abs(tickDelta) < 0.22 && r > RADIUS_LABEL_INNER
            line += tickHit ? '@' : '#'
            continue
          }

          // ── Groove banding ───────────────────────────────────────
          const ringR = Math.round(r / GROOVE_PITCH) * GROOVE_PITCH
          const ringDist = Math.abs(r - ringR)
          const onGroove = ringDist < EDGE_BAND

          // ── Top-down ambient term (fades from top to bottom) ─────
          // Hardened from cos² → cos⁴ so the upper-half reads markedly
          // brighter than the lower half (depth cue).
          const lightAngle = -Math.PI / 2
          const dLight =
            ((angle - lightAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI
          const ambient = Math.cos(dLight) ** 4

          // ── Specular hotspot (Gaussian falloff in disc space) ────
          const ddx = dx - sx
          const ddy = dy - sy
          const specDistSq = ddx * ddx + ddy * ddy
          const specular = Math.exp(-specDistSq / 22)

          // ── Slow rim sparkle, tied to spin so it clearly rotates ─
          const sparkleDelta =
            ((angle - spin * 2.2 + Math.PI * 3) % (Math.PI * 2)) - Math.PI
          const onRim = r > RADIUS_DISC * 0.85
          const sparkle = onRim
            ? Math.max(0, Math.cos(sparkleDelta) - 0.85) * 4
            : 0

          // ── Outer-edge falloff (the rim itself reads dim) ────────
          const rimFalloff =
            r > RADIUS_DISC - 0.6 ? 0.45 : 1 - (r / RADIUS_DISC) * 0.15

          let v: number
          if (onGroove) {
            v =
              (0.42 + ambient * 0.6 + specular * 0.8 + sparkle * 0.5) *
              rimFalloff
          } else {
            // Between grooves — only specular leaks through. Empty most
            // of the time, which is what makes the grooves *read* as
            // grooves instead of a flat disc.
            v = specular * 0.45 * rimFalloff + ambient * 0.05
          }
          if (v < 0) v = 0
          if (v > 1) v = 1

          const idx = Math.min(
            PALETTE.length - 1,
            Math.floor(v * PALETTE.length),
          )
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
    <pre
      ref={ref}
      aria-hidden
      className="select-none font-mono leading-[0.95] text-sys-orange/90"
      style={{
        fontSize: 'clamp(6px, 0.85vw, 10px)',
        filter: 'drop-shadow(0 0 14px rgba(249,115,22,0.28))',
      }}
    />
  )
}

// ── Mock atmosphere data ────────────────────────────────────────────────────
const RECENT_UPLOADS = [
  { date: '2026.05.05', file: 'KLSTR_DF.WAV' },
  { date: '2026.05.03', file: 'OBSCURA.AIF' },
  { date: '2026.05.01', file: 'SIGNAL_07.FLAC' },
  { date: '2026.04.28', file: 'RUIDO_SYS.MP3' },
  { date: '2026.04.25', file: 'CINTA_11.WAV' },
]

const LOG_LINES = [
  '[18:59:02] CONEXIÓN ENTRANTE: 187.214.**.**',
  '[18:59:03] VERIFICANDO ORIGEN...',
  '[18:59:05] RUTA ALTERNATIVA ESTABLECIDA',
  '[18:59:07] ACCESO TEMPORAL CONCEDIDO',
]

// ── Animated spectrum — bottom-strip atmosphere ───────────────────────────
//
// Block-glyph histogram of fake "signal" levels. Each column gets its own
// slow wobble (sum of two sines at different frequencies) so the bars
// breathe over time. Static pattern under reduced-motion. Same rAF cap
// as the vinyl renderer.
function SpectrumAscii() {
  const ref = useRef<HTMLPreElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const COLS = 90
    const ROWS = 4
    const BLOCKS = ' ▁▂▃▄▅▆▇█'

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let raf = 0
    let last = 0
    const FRAME_MS = 1000 / 24

    const renderAt = (t: number) => {
      const lines: string[] = []
      for (let r = 0; r < ROWS; r++) {
        let line = ''
        for (let c = 0; c < COLS; c++) {
          // Per-column wobble — each column has a stable seed phase.
          const seed = c * 0.41 + r * 1.3
          const h =
            (Math.sin(seed + t * 1.4) + 1) * 0.5 * 0.6 +
            (Math.sin(seed * 1.7 + t * 0.6) + 1) * 0.5 * 0.4
          // Row decay so the top rows are sparser than the bottom — reads
          // as "signal noise floor + occasional peaks."
          const rowBias = 1 - r / ROWS
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
  }, [])

  return (
    <pre
      ref={ref}
      aria-hidden
      className="select-none font-mono text-[9px] leading-[1] text-sys-orange/55"
    />
  )
}
