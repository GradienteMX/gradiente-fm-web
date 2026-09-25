'use client'

/**
 * TROFEOS — progression that is story-shaped, never a score. On the desk
 * the ten trophies are enamel pins in a small case (components/insignias):
 * earned ones adhering to the page in soft wells, the rest pressed blind into the paper, and one
 * caption line for whichever pin you're on — its story, or what it takes.
 * The small glyphs below stay for the activity feed and the meter's ticks.
 *
 * The presence meter lives here too: the private scalar drawn as a hairline
 * with the four presence trophies as its only ticks.
 */

import { useMemo, type Ref } from 'react'
import { TROPHY_CATALOG, type TrophyKey } from '@/lib/trophies'
import { Insignias } from '@/components/insignias/Insignias'
import { PRESENCE_STEPS } from './logic'
import styles from './Trofeos.module.css'

// ── glyphs ──────────────────────────────────────────────────────────────────

function Svg({ size, children, title }: { size: number; children: React.ReactNode; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  )
}

const dot = (cx: number, cy: number, r = 1.35) => <circle key={`${cx}:${cy}`} cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />

export function TrophyGlyph({ k, size = 16, title }: { k: TrophyKey | string; size?: number; title?: string }) {
  switch (k) {
    case 'versatile_voice': // five formats around one voice
      return (
        <Svg size={size} title={title}>
          <circle cx="10" cy="10" r="2.1" fill="currentColor" stroke="none" />
          {[0, 1, 2, 3, 4].map((i) => {
            const a = ((-90 + i * 72) * Math.PI) / 180
            return dot(10 + Math.cos(a) * 6.6, 10 + Math.sin(a) * 6.6, 1.25)
          })}
        </Svg>
      )
    case 'published_voice': // five pieces, stacked
      return (
        <Svg size={size} title={title}>
          <path d="M4.5 4.2h11M4.5 7.1h11M4.5 10h11M4.5 12.9h11M4.5 15.8h6.5" />
        </Svg>
      )
    case 'signal_caster': // [!]
      return (
        <Svg size={size} title={title}>
          <path d="M5 3.5H3.5v13H5M15 3.5h1.5v13H15M10 5.5v6.2" />
          {dot(10, 14.6, 1.2)}
        </Svg>
      )
    case 'question_caster': // [?]
      return (
        <Svg size={size} title={title}>
          <path d="M5 3.5H3.5v13H5M15 3.5h1.5v13H15M7.9 7.4a2.2 2.2 0 1 1 3 2c-.6.3-.9.8-.9 1.4v.9" />
          {dot(10, 14.6, 1.2)}
        </Svg>
      )
    case 'thread_anchor': // a thread held by an anchor
      return (
        <Svg size={size} title={title}>
          <circle cx="10" cy="4.4" r="1.6" />
          <path d="M10 6v10.6M6.6 9.2h6.8M4.3 11.8a5.7 5.7 0 0 0 11.4 0" />
        </Svg>
      )
    case 'crowd_compass': // a needle that found north
      return (
        <Svg size={size} title={title}>
          <circle cx="10" cy="10" r="7" />
          <path d="M10 4.8 11.7 10 10 15.2 8.3 10z" fill="currentColor" stroke="none" />
        </Svg>
      )
    case 'presence_logged':
      return <Svg size={size} title={title}>{dot(10, 10, 2)}</Svg>
    case 'presence_deep':
      return <Svg size={size} title={title}>{[dot(6.6, 10, 1.8), dot(13.4, 10, 1.8)]}</Svg>
    case 'presence_persistent':
      return <Svg size={size} title={title}>{[dot(4.6, 10, 1.7), dot(10, 10, 1.7), dot(15.4, 10, 1.7)]}</Svg>
    case 'presence_insider_track': // on the radar
      return (
        <Svg size={size} title={title}>
          <circle cx="10" cy="10" r="7" />
          <circle cx="10" cy="10" r="3.6" />
          <circle cx="10" cy="10" r="1.3" fill="currentColor" stroke="none" />
        </Svg>
      )
    default:
      return <Svg size={size} title={title}>{dot(10, 10, 2)}</Svg>
  }
}

// ── conditions (said as what still has to happen) ───────────────────────────

const CONDITION: Record<TrophyKey, string> = {
  versatile_voice: 'Publica en cinco formatos distintos.',
  published_voice: 'Suma cinco publicaciones.',
  signal_caster: 'Que tus comentarios reciban diez [!].',
  question_caster: 'Que tus comentarios reciban diez [?].',
  thread_anchor: 'Abre un hilo en el foro que cruce veinte respuestas.',
  crowd_compass: 'Calibra veinticinco piezas.',
  presence_logged: 'Que tu presencia llegue a 10.',
  presence_deep: 'Que tu presencia llegue a 25.',
  presence_persistent: 'Que tu presencia llegue a 50.',
  presence_insider_track: 'Que tu presencia llegue a 100.',
}

// ── the case ────────────────────────────────────────────────────────────────

export function TrophyStrip({ earned }: { earned: Partial<Record<TrophyKey, string>> | undefined }) {
  const n = TROPHY_CATALOG.filter((t) => earned?.[t.key]).length
  const items = useMemo(
    () =>
      TROPHY_CATALOG.map((t) => ({
        key: t.key,
        label: t.label,
        description: t.description,
        earnedAt: earned?.[t.key] ?? null,
        condition: CONDITION[t.key],
      })),
    [earned],
  )
  return (
    <div className={styles.strip}>
      <p className={styles.stripHead}>
        <span className="label">Trofeos</span>
        <span className={styles.count}>
          {n} de {TROPHY_CATALOG.length}
        </span>
      </p>
      <Insignias variant="compacta" items={items} />
    </div>
  )
}

// ── presence meter (private) ────────────────────────────────────────────────

const STEP_LABEL: Record<string, string> = Object.fromEntries(TROPHY_CATALOG.map((t) => [t.key, t.label]))

export function PresenceMeter({
  value,
  scale,
  ghost,
  fillRef,
  railRef,
  ghostRef,
}: {
  value: number
  /** Units per full width — shared with the harvest flow so lengths are comparable. */
  scale: number
  /** A projected addition, drawn as an outline after the fill. */
  ghost?: number
  fillRef?: Ref<HTMLSpanElement>
  railRef?: Ref<HTMLDivElement>
  ghostRef?: Ref<HTMLSpanElement>
}) {
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / scale) * 100))}%`
  return (
    <div className={styles.meter}>
      <div className={styles.rail} ref={railRef}>
        <span className={styles.fill} ref={fillRef} style={{ width: pct(value) }} />
        {ghost !== undefined ? <span ref={ghostRef} className={styles.ghost} style={{ left: pct(value), width: pct(ghost) }} /> : null}
        {PRESENCE_STEPS.map((s) => (
          <span key={s.key} className={styles.notch} data-on={value >= s.target || undefined} style={{ left: pct(s.target) }} />
        ))}
      </div>
      <div className={styles.ticks} aria-hidden="true">
        {PRESENCE_STEPS.map((s) => (
          <span key={s.key} className={styles.tick} data-on={value >= s.target || undefined} style={{ left: pct(s.target) }} title={`${STEP_LABEL[s.key]} · ${s.target}`}>
            <TrophyGlyph k={s.key} size={11} />
          </span>
        ))}
      </div>
    </div>
  )
}
