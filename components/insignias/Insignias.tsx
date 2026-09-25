'use client'

/**
 * INSIGNIAS — the pins, pressed into the page (docs/06-LIBREA §5).
 *
 * Every trophy is a die-struck enamel pin, and the case is the page itself:
 * a place per trophy, in catalog order, with no box around them. Earned
 * pins sit pressed into the paper, held by it; a locked one is its die
 * pressed blind into the paper (no ink, no metal), with the condition
 * printed beside it. Hover tilts a pin under the light; click (or Enter /
 * Space) lifts it out and turns it over — the back is the clutch and the
 * engraving: the month it was earned and its story.
 *
 * The tray is ONE stage window (components/stage) drawn behind this DOM,
 * and it never paints paper — only the pins and the shading the pressing
 * adds — so the page's own paper shows through it untouched. Every pin has
 * a real button over it (its label, its state, its story as the
 * description), so focus, keyboard and screen readers work on the page,
 * not on the picture. Until the case is struck the page is plain; without
 * WebGL the pins are printed (SVG) and pressed in with SVG filter shading.
 *
 *   vitrina   the public case: each place carries its label, month and
 *             story (or condition), printed in ink — /u/[username]
 *   compacta  the desk's small case: pins only, one caption line under
 *             them for whichever pin you're on — the Taller
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { getStage } from '@/components/stage/engine'
import { trophyByKey, type TrophyKey } from '@/lib/trophies'
import { fmt } from '@/lib/logic/time'
import { PinCase, type CasePin, type SlotRect } from './caseGL'
import { PinPlate, PressFilters } from './PinPlate'
import { materialWords, slotCode } from './catalog'
import type { Family } from './shapes'
import styles from './Insignias.module.css'

export interface InsigniaItem {
  key: TrophyKey
  label: string
  /** The trophy's story (catalog description) — engraved on the back. */
  description: string
  /** ISO, or null while locked. */
  earnedAt: string | null
  /** What still has to happen, said honestly (locked slots show it). */
  condition: string
}

type Mode = 'pending' | 'gl' | 'flat'

function monthOf(iso: string | null): string | null {
  if (!iso) return null
  try {
    return fmt.monthYear(iso)
  } catch {
    return null
  }
}

function makeCase(renderer: ConstructorParameters<typeof PinCase>[0], opts: ConstructorParameters<typeof PinCase>[1]): PinCase | null {
  try {
    return new PinCase(renderer, opts)
  } catch {
    return null
  }
}

/** «VOZ VERSÁTIL» → «Voz versátil», for assistive text. */
function spoken(label: string): string {
  const l = label.toLocaleLowerCase('es-MX')
  return l.charAt(0).toLocaleUpperCase('es-MX') + l.slice(1)
}

export function Insignias({ items, variant = 'vitrina', className }: { items: InsigniaItem[]; variant?: 'vitrina' | 'compacta'; className?: string }) {
  const uid = useId()
  // For SVG references (url(#…)): letters, digits and dashes only.
  const press = `ins${uid.replace(/[^a-zA-Z0-9-]/g, '')}`
  const trayRef = useRef<HTMLDivElement>(null)
  const boxes = useRef<(HTMLSpanElement | null)[]>([])
  const [pc, setPc] = useState<PinCase | null>(null)
  const [mode, setMode] = useState<Mode>('pending')
  const [cell, setCell] = useState(0)
  const [back, setBack] = useState<ReadonlySet<TrophyKey>>(() => new Set())
  const [active, setActive] = useState<number | null>(null)

  const rows = useMemo(
    () =>
      items.map((it) => {
        const meta = trophyByKey(it.key)
        return {
          ...it,
          family: (meta?.family ?? 'presence') as Family,
          color: meta?.color ?? '#9CA3AF',
          month: monthOf(it.earnedAt),
          earned: Boolean(it.earnedAt),
        }
      }),
    [items],
  )
  const earnedCount = rows.filter((r) => r.earned).length

  // ── the window ──────────────────────────────────────────────────────────
  useEffect(() => {
    const el = trayRef.current
    const stage = getStage()
    const life = { dead: false }
    const caseGL =
      el && stage.renderer
        ? makeCase(stage.renderer, {
            reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
            // The paper the pins are pressed into: the page's own.
            paper: getComputedStyle(el).getPropertyValue('--paper').trim(),
            onShown: () => !life.dead && setMode('gl'),
            onFail: () => !life.dead && setMode('flat'),
          })
        : null
    if (!el || !caseGL) {
      setMode('flat')
      return
    }
    const off = stage.addWindow({ el, order: 10, render: (ctx) => caseGL.render(ctx), idle: () => caseGL.isIdle() })
    setPc(caseGL)
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __insignias?: PinCase }).__insignias = caseGL
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onMq = () => caseGL.setReduced(mq.matches)
    mq.addEventListener('change', onMq)
    return () => {
      life.dead = true
      mq.removeEventListener('change', onMq)
      off()
      caseGL.dispose()
      setPc(null)
      setMode('pending')
    }
  }, [])

  // ── layout: the DOM decides where the pins are; GL follows ──────────────
  useEffect(() => {
    const tray = trayRef.current
    if (!tray || mode === 'flat') return
    const measure = () => {
      const t = tray.getBoundingClientRect()
      if (t.width < 1 || t.height < 1) return
      const cx = t.left + t.width / 2
      const cy = t.top + t.height / 2
      const slots: SlotRect[] = boxes.current.map((b) => {
        if (!b) return { x: 0, y: 0, size: 0 }
        const r = b.getBoundingClientRect()
        return { x: r.left + r.width / 2 - cx, y: cy - (r.top + r.height / 2), size: r.width }
      })
      pc?.setLayout(t.width, t.height, slots)
      // Strike resolution follows the pins' size on this screen, in steps.
      const size = Math.max(...slots.map((s) => s.size), 1)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const want = Math.round(Math.min(448, Math.max(256, size * dpr * 1.1)) / 64) * 64
      setCell((prev) => (prev === 0 || want > prev ? want : prev))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(tray)
    boxes.current.forEach((b) => b && ro.observe(b))
    void document.fonts?.ready.then(measure)
    return () => ro.disconnect()
  }, [pc, mode, rows.length])

  // ── what the case holds (earned states, months, stories) ────────────────
  const signature = rows.map((r) => `${r.key}:${r.earnedAt ?? ''}`).join('|')
  useEffect(() => {
    if (!pc || !cell) return
    const pins: CasePin[] = rows.map((r) => ({
      key: r.key,
      family: r.family,
      color: r.color,
      earned: r.earned,
      month: r.month,
      story: r.description,
    }))
    void pc.setPins(pins, cell)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pc, cell, signature])

  // The case restrikes (every pin face-up) when what was earned changes:
  // the proxies follow it back to the front.
  const [backFor, setBackFor] = useState(signature)
  if (backFor !== signature) {
    setBackFor(signature)
    setBack(new Set())
  }

  const turn = (i: number) => {
    const r = rows[i]
    if (!r?.earned) return
    const next = new Set(back)
    const toBack = !next.has(r.key)
    if (toBack) next.add(r.key)
    else next.delete(r.key)
    setBack(next)
    pc?.flip(i, toBack)
  }

  // Hover tilts under a mouse or pen; a finger on a phone is scrolling or
  // tapping (the tap turns the pin over), so touch never tilts.
  const onMove = (i: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'touch') return
    const b = e.currentTarget.getBoundingClientRect()
    const nx = ((e.clientX - b.left) / b.width) * 2 - 1
    const ny = 1 - ((e.clientY - b.top) / b.height) * 2
    pc?.setPointer(i, nx, ny, true)
    if (variant === 'compacta') setActive(i)
  }
  const onLeave = (i: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
    pc?.setPointer(i, 0, 0, false)
    // A pin that holds focus (tapped, clicked, tabbed to) keeps the caption.
    if (variant === 'compacta' && document.activeElement !== e.currentTarget) setActive((a) => (a === i ? null : a))
  }

  const compact = variant === 'compacta'
  const shown = active !== null ? rows[active] : null

  return (
    <div className={[styles.root, className ?? ''].join(' ')} data-variant={variant} data-mode={mode}>
      {mode === 'flat' ? <PressFilters id={press} /> : null}
      <div ref={trayRef} className={styles.tray}>
        <ul className={styles.grid} aria-label={`Estuche de insignias: ${earnedCount} de ${rows.length} ganadas`}>
          {rows.map((r, i) => {
            const isBack = back.has(r.key)
            const desc = `${uid}-d${i}`
            return (
              <li
                key={r.key}
                className={styles.slot}
                data-state={r.earned ? 'earned' : 'locked'}
                data-back={isBack || undefined}
                data-active={active === i || undefined}
              >
                <button
                  type="button"
                  className={styles.pin}
                  aria-label={
                    r.earned
                      ? `${spoken(r.label)}. Pin de ${materialWords(trophyByKey(r.key) ?? { key: r.key, family: r.family })}.`
                      : `${spoken(r.label)}, pendiente.`
                  }
                  aria-pressed={r.earned ? isBack : undefined}
                  aria-disabled={r.earned ? undefined : true}
                  aria-describedby={compact ? desc : `${desc}-w ${desc}-s`}
                  onPointerMove={onMove(i)}
                  onPointerLeave={onLeave(i)}
                  onPointerCancel={onLeave(i)}
                  onFocus={(e) => {
                    // Keyboard focus presents the pin; a click's focus doesn't
                    // (the pointer already tilts it, and it mustn't stay tilted).
                    if (e.currentTarget.matches(':focus-visible')) pc?.setFocus(i, true)
                    if (compact) setActive(i)
                  }}
                  onBlur={() => {
                    pc?.setFocus(i, false)
                    if (compact) setActive((a) => (a === i ? null : a))
                  }}
                  onClick={() => turn(i)}
                >
                  <span
                    className={styles.box}
                    ref={(el) => {
                      boxes.current[i] = el
                    }}
                  >
                    {mode === 'flat' ? (
                      <PinPlate trophy={r.key} family={r.family} color={r.color} earned={r.earned} back={isBack} month={r.month} press={press} />
                    ) : null}
                  </span>
                </button>
                {compact ? (
                  <span id={desc} className="sr-only">
                    {r.earned ? `${isBack ? 'Al reverso. ' : ''}Desde ${r.month}. ${r.description} Voltéala para ver el reverso.` : `Pendiente. ${r.condition}`}
                  </span>
                ) : (
                  <div className={styles.cartela}>
                    <span className={styles.code}>{slotCode(i)}</span>
                    <b className={styles.name}>{r.label}</b>
                    <span id={`${desc}-w`} className={styles.when}>
                      {r.earned ? (isBack ? `Al reverso · ${r.month}` : `Desde ${r.month}`) : 'Pendiente'}
                    </span>
                    <p id={`${desc}-s`} className={styles.story}>
                      {r.earned ? r.description : r.condition}
                    </p>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
      {compact ? (
        <p className={styles.caption} aria-hidden="true" data-empty={shown ? undefined : ''}>
          {shown ? (
            <>
              <span className={styles.capHead}>
                <span className={styles.capCode}>{slotCode(active!)}</span>
                <b className={styles.capName}>{shown.label}</b>
                <span className={styles.capWhen}>
                  {shown.earned ? (back.has(shown.key) ? `Al reverso · ${shown.month}` : `Desde ${shown.month}`) : 'Pendiente'}
                </span>
              </span>
              <span className={styles.capText}>{shown.earned ? shown.description : shown.condition}</span>
            </>
          ) : (
            <span className={styles.capText}>
              {earnedCount
                ? 'Señala una insignia para leerla aquí; tócala para voltearla.'
                : 'Aún sin insignias: se ganan publicando, conversando y calibrando.'}
            </span>
          )}
        </p>
      ) : null}
    </div>
  )
}
