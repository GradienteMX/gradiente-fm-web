'use client'

/**
 * PALANCA DE HL — the audited calibration lever.
 *
 * An instrument for producing feed states organic traffic will not produce
 * for months; not a promotion thumb (editorial, destacado and portada are the
 * honest, declarative levers for that). Every adjustment lands in the ledger
 * as its own kind with its reason, applies the zero floor exactly as the
 * reducer does, and is reverted only by another audited adjustment.
 *
 * The projection answers "how much is enough" before anything is written:
 * the mosaic sizes a piece against its type's peak, so the lever re-ranks
 * the real home composition with the projected HL and shows where the piece
 * — and every sibling it displaces — would land. The maqueta moves to explain.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ContentItem, User } from '@/lib/types'
import type { RankedItem } from '@/lib/curation'
import { hlBracket } from '@/lib/dashboard/hl'
import { effectiveBand } from '@/lib/vibe'
import { FORMAT_LABEL } from '@/components/kit/Glyph'
import { HoldButton } from '@/components/kit/HoldButton'
import { useDispatch } from '@/lib/store/world'
import { useUI } from '@/lib/store/ui'
import { packDense, presetDeltas, rankGrid, num, signed, TIER_LABEL, WHERE_LABEL, type FeedWhere } from './data'
import { Note, cx, energyOnVar, energyVar, inputClass, textareaClass } from './kit'
import s from './Palanca.module.css'

const MAX_DELTA = 1000
const MIN_NOTE = 3
const MAX_NOTE = 280
const QUICK = [5, 25, -5, -25]

export interface Prefill {
  delta: number
  note: string
  nonce: number
}

export function Palanca({
  item,
  hl,
  grid,
  where,
  me,
  nowMs,
  prefill,
}: {
  item: ContentItem
  hl: number
  grid: ContentItem[]
  where: FeedWhere
  me: User
  nowMs: number
  prefill: Prefill | null
}) {
  const dispatch = useDispatch()
  const ask = useUI((st) => st.ask)
  const notify = useUI((st) => st.notify)
  const [mag, setMag] = useState('')
  const [sign, setSign] = useState<1 | -1>(1)
  const [note, setNote] = useState('')
  const [applied, setApplied] = useState<{ before: number; after: number; delta: number } | null>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const ids = useId()

  // Adopt a prefill once per nonce (REVERTIR loads, never commits).
  const lastNonce = useRef<number | null>(null)
  useEffect(() => {
    if (!prefill || prefill.nonce === lastNonce.current) return
    lastNonce.current = prefill.nonce
    setMag(String(Math.round(Math.abs(prefill.delta) * 100) / 100))
    setSign(prefill.delta < 0 ? -1 : 1)
    setNote(prefill.note.slice(0, MAX_NOTE))
    setApplied(null)
    noteRef.current?.focus()
    noteRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [prefill])

  const m = Number(mag.replace(',', '.'))
  const valid = mag.trim() !== '' && Number.isFinite(m) && m > 0
  const delta = valid ? Math.round(sign * m * 100) / 100 : 0
  const projected = Math.max(0, hl + delta)
  const trimmed = note.trim()

  const blocker = !valid
    ? 'Indica una cantidad mayor que cero.'
    : Math.abs(delta) > MAX_DELTA
      ? `El límite es ±${MAX_DELTA} HL por ajuste: un seguro contra dedazos, no una política.`
      : trimmed.length < MIN_NOTE
        ? `El motivo es obligatorio (mínimo ${MIN_NOTE} caracteres): queda en el historial de la pieza.`
        : trimmed.length > MAX_NOTE
          ? `El motivo excede ${MAX_NOTE} caracteres.`
          : null

  // ── projection (debounced so the maqueta moves once per intent) ─────────
  const [shown, setShown] = useState<number | null>(null)
  useEffect(() => {
    const t = window.setTimeout(() => setShown(valid && Math.abs(delta) <= MAX_DELTA ? projected : null), 180)
    return () => window.clearTimeout(t)
  }, [valid, delta, projected])

  const minute = Math.floor(nowMs / 60_000) * 60_000
  const inMosaic = where === 'mosaico'
  const rankedNow = useMemo(() => (inMosaic ? rankGrid(grid, new Date(minute)) : null), [inMosaic, grid, minute])
  const rankedAfter = useMemo(
    () => (inMosaic && shown !== null ? rankGrid(grid, new Date(minute), { id: item.id, hp: shown }) : null),
    [inMosaic, grid, minute, item.id, shown],
  )
  const presets = useMemo(() => (inMosaic ? presetDeltas(grid, new Date(minute), item, hl) : null), [inMosaic, grid, minute, item, hl])

  const spot = (r: RankedItem[] | null) => {
    if (!r) return null
    const i = r.findIndex((x) => x.item.id === item.id)
    return i < 0 ? null : { index: i, total: r.length, tier: r[i].tier, score: r[i].score }
  }
  const now = spot(rankedNow)
  const after = spot(rankedAfter)

  const changed = useMemo(() => {
    if (!rankedNow || !rankedAfter) return { ids: new Set<string>(), same: 0, all: 0 }
    const before = new Map(rankedNow.map((r) => [r.item.id, `${r.layout.colSpan}x${r.layout.rowSpan}`]))
    const ids = new Set<string>()
    let same = 0
    for (const r of rankedAfter) {
      if (r.item.id === item.id) continue
      if (before.get(r.item.id) !== `${r.layout.colSpan}x${r.layout.rowSpan}`) {
        ids.add(r.item.id)
        if (r.item.type === item.type) same++
      }
    }
    return { ids, same, all: ids.size }
  }, [rankedNow, rankedAfter, item.id, item.type])

  const commit = async () => {
    if (blocker) return
    const feedLine =
      now && after
        ? ` En el mosaico: ${TIER_LABEL[now.tier]} en la posición ${now.index + 1} → ${TIER_LABEL[after.tier]} en la ${after.index + 1}${changed.all ? `; ${changed.all} ${changed.all === 1 ? 'pieza más cambia' : 'piezas más cambian'} de tamaño` : ''}.`
        : where !== 'mosaico'
          ? ` Hoy no está en el mosaico (${WHERE_LABEL[where].toLowerCase()}).`
          : ''
    const peakLine =
      presets && projected > presets.peakOthers && hl <= presets.peakOthers
        ? ' Pasa a ser la cima de su tipo: las demás piezas del mismo tipo se miden contra ella y bajan de tamaño.'
        : ''
    const ok = await ask({
      title: `${delta > 0 ? 'Inyectar' : 'Restar'} ${num(Math.abs(delta), 2)} HL`,
      body: `«${item.title}»: ${num(hl, 2)} → ${num(projected, 2)} HL (${hlBracket(hl)} → ${hlBracket(projected)}).${feedLine}${peakLine} Motivo: «${trimmed}». Queda en el historial de la pieza como AJUSTE ADMIN, aparte de la interacción de lectores; revertirlo es otro ajuste, también registrado.`,
      confirmLabel: `Confirmar ${signed(delta, 2)} HL`,
      destructive: delta < 0,
    })
    if (ok !== true) return
    dispatch({ t: 'hp-adjust', adminId: me.id, itemId: item.id, delta, note: trimmed, at: new Date().toISOString() })
    setApplied({ before: hl, after: projected, delta })
    setMag('')
    setNote('')
    notify(`Ajuste registrado: ${signed(delta, 2)} HL en «${item.title}»`, { tone: 'energy', energy: (effectiveBand(item).min + effectiveBand(item).max) / 2 })
  }

  const band = effectiveBand(item)
  const mid = (band.min + band.max) / 2
  const fromTier = now ? TIER_LABEL[now.tier] : null

  return (
    <section className={s.lever} aria-labelledby={`${ids}-h`}>
      <header className={s.head}>
        <h3 id={`${ids}-h`} className={s.title}>
          Palanca de HL
        </h3>
        <span className={s.sub}>ajuste auditado · queda en el historial de la pieza</span>
      </header>

      <div className={s.controls}>
        <div className={s.dir} role="radiogroup" aria-label="Dirección del ajuste">
          <button type="button" role="radio" aria-checked={sign === 1} data-on={sign === 1 || undefined} onClick={() => setSign(1)}>
            Inyectar
          </button>
          <button type="button" role="radio" aria-checked={sign === -1} data-on={sign === -1 || undefined} data-neg onClick={() => setSign(-1)}>
            Restar
          </button>
        </div>
        <label className={s.amount}>
          <span className="sr-only">Cantidad de HL</span>
          <span className={s.amountSign} aria-hidden="true">
            {sign > 0 ? '+' : '−'}
          </span>
          <input
            className={cx(inputClass, s.amountInput)}
            inputMode="decimal"
            value={mag}
            onChange={(e) => {
              setMag(e.target.value.replace(/[^0-9.,]/g, ''))
              setApplied(null)
            }}
            placeholder="0.0"
            aria-describedby={`${ids}-block`}
          />
          <span className={s.amountUnit}>HL</span>
        </label>
        <div className={s.quick} role="group" aria-label="Ajustes rápidos">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              className={s.chip}
              onClick={() => {
                setMag(String(Math.abs(q)))
                setSign(q < 0 ? -1 : 1)
                setApplied(null)
              }}
            >
              {q > 0 ? '+' : '−'}
              {Math.abs(q)}
            </button>
          ))}
        </div>
      </div>

      {presets ? (
        <div className={s.presets} role="group" aria-label="Hasta un umbral de tamaño">
          <span className={s.presetsLabel}>Hasta</span>
          {(
            [
              ['md', presets.md, 'umbral MD (0.5 de la cima del tipo)'],
              ['lg', presets.lg, 'umbral LG (1.0 de la cima del tipo)'],
              ['cima del tipo', presets.cima, 'por encima de la pieza más viva de su tipo'],
            ] as const
          ).map(([label, d, title]) => (
            <button
              key={label}
              type="button"
              className={s.chip}
              disabled={d === null || d === 0}
              title={d === null ? `Inalcanzable para ${FORMAT_LABEL[item.type].toLowerCase()} (×${num(presets.mult, 1)})` : d === 0 ? 'Ya está ahí' : title}
              onClick={() => {
                if (!d) return
                setMag(String(d))
                setSign(1)
                setApplied(null)
              }}
            >
              → {label}
              <span className={s.chipNum}>{d === null ? 'n/a' : d === 0 ? 'ya' : `+${num(d, 2)}`}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className={s.noteField}>
        <label className={s.fieldLabel} htmlFor={`${ids}-note`}>
          Motivo <span className={s.req}>obligatorio · queda en el historial</span>
          <span className={s.counter} data-over={trimmed.length > MAX_NOTE || undefined}>
            {trimmed.length}/{MAX_NOTE}
          </span>
        </label>
        <textarea
          id={`${ids}-note`}
          ref={noteRef}
          className={textareaClass}
          rows={2}
          maxLength={MAX_NOTE + 40}
          value={note}
          onChange={(e) => {
            setNote(e.target.value)
            setApplied(null)
          }}
          placeholder="Probar la rejilla con un mix por encima del evento de esta noche…"
        />
      </div>

      {/* PROYECCIÓN */}
      <div className={s.projection} data-mosaic={(inMosaic && now) || undefined} aria-live="polite">
        <div className={s.projMain}>
          <div className={s.projRow}>
            <span className={s.projKey}>HL</span>
            <span className={s.projVal}>
              <b>{num(hl, 2)}</b> <span className={s.bracket}>{hlBracket(hl)}</span>
            </span>
            <span className={s.arrow} data-on={valid || undefined} aria-hidden="true">
              →
            </span>
            <span className={s.projVal} data-dim={!valid || undefined}>
              <b>{valid ? num(projected, 2) : '—'}</b> <span className={s.bracket}>{valid ? hlBracket(projected) : ''}</span>
            </span>
          </div>
          {inMosaic && now ? (
            <>
              <div className={s.projRow}>
                <span className={s.projKey}>Tamaño</span>
                <span className={s.projVal}>
                  <b>{fromTier}</b>
                </span>
                <span className={s.arrow} data-on={Boolean(after) || undefined} aria-hidden="true">
                  →
                </span>
                <span className={s.projVal} data-dim={!after || undefined} data-moved={(after && after.tier !== now.tier) || undefined}>
                  <b>{after ? TIER_LABEL[after.tier] : '—'}</b>
                </span>
              </div>
              <div className={s.projRow}>
                <span className={s.projKey}>Posición</span>
                <span className={s.projVal}>
                  <b>{now.index + 1}</b> de {now.total}
                </span>
                <span className={s.arrow} data-on={Boolean(after) || undefined} aria-hidden="true">
                  →
                </span>
                <span className={s.projVal} data-dim={!after || undefined} data-moved={(after && after.index !== now.index) || undefined}>
                  <b>{after ? after.index + 1 : '—'}</b>
                </span>
              </div>
              <div className={s.projRow}>
                <span className={s.projKey}>Score en su tipo</span>
                <span className={s.projVal}>
                  <b>{num(now.score, 2)}</b>
                </span>
                <span className={s.arrow} data-on={Boolean(after) || undefined} aria-hidden="true">
                  →
                </span>
                <span className={s.projVal} data-dim={!after || undefined}>
                  <b>{after ? num(after.score, 2) : '—'}</b>
                </span>
              </div>
              {presets ? (
                <p className={s.thresholds}>
                  Umbrales: md 0.5 · lg 1.0 de la cima de su tipo ({num(presets.peakOthers, 1)} HL) · ×{num(presets.mult, 1)} por ser{' '}
                  {FORMAT_LABEL[item.type].toLowerCase()}
                </p>
              ) : null}
              {after ? (
                <p className={s.sideEffect}>
                  {changed.all === 0
                    ? 'Ninguna otra pieza cambia de tamaño.'
                    : `${changed.all} ${changed.all === 1 ? 'pieza cambia' : 'piezas cambian'} de tamaño${changed.same ? `, ${changed.same} de su mismo tipo` : ''}: la cima de un tipo es el denominador de todas las demás.`}
                </p>
              ) : null}
            </>
          ) : (
            <p className={s.outside}>
              {WHERE_LABEL[where]}.{' '}
              {where === 'portada'
                ? 'La portada no se ordena por HL: el ajuste cambia la vida de la pieza, y su tamaño solo cuando deje la portada.'
                : where === 'pulso'
                  ? 'El pulso ordena por fecha, no por HL: el ajuste no mueve nada visible mientras el evento viva ahí.'
                  : 'Fuera del campo del inicio: el ajuste cambia su vida, pero hoy no mueve nada visible en el mosaico.'}
            </p>
          )}
        </div>
        {inMosaic && now ? (
          <Maqueta
            ranked={rankedAfter ?? rankedNow!}
            focus={item.id}
            type={item.type}
            changed={changed.ids}
            energy={energyVar(mid)}
            energyOn={energyOnVar(mid)}
            projected={Boolean(rankedAfter)}
            position={(after ?? now).index + 1}
          />
        ) : null}
      </div>

      <div className={s.commit}>
        <HoldButton onConfirm={commit} disabled={Boolean(blocker)} energy={mid} tone={delta < 0 ? 'danger' : 'ink'} size="md" holdingLabel="Sigue…">
          {valid ? `Mantén para ${delta < 0 ? 'restar' : 'inyectar'} ${num(Math.abs(delta), 2)} HL` : 'Mantén para aplicar'}
        </HoldButton>
        <span id={`${ids}-block`} className={s.blocker} data-ok={!blocker || undefined}>
          {blocker ?? 'Listo: mantén el botón; después confirma lo que va a pasar.'}
        </span>
      </div>

      {applied ? (
        <p className={s.applied} role="status">
          Registrado {signed(applied.delta, 2)} HL · {num(applied.before, 2)} → {num(applied.after, 2)}. El decaimiento sigue desde este instante.
        </p>
      ) : null}

      <Note>
        Instrumento de calibración: sirve para ver la rejilla en estados que el tráfico no produce en meses. No es una palanca de
        promoción — para eso están editorial, destacado y portada, que son declarativos y no fingen interacción. La posición debe la
        mitad a la frescura, que la palanca no toca; la proyección usa el horizonte completo (el fader filtra, nunca reordena).
      </Note>
    </section>
  )
}

// ── Maqueta — the mosaic in miniature, moving to explain ─────────────────────
//
// Packed exactly like the Organismo (3-column dense flow, anchored cells keep
// their column), drawn at the mosaic's own proportions (row ≈ 0.82 × column),
// and windowed around the piece. When the projection changes, cells glide to
// their new places and the window follows the piece.

const GAP = 3
const VISIBLE_ROWS = 6

function Maqueta({
  ranked,
  focus,
  type,
  changed,
  energy,
  projected,
  position,
  energyOn,
}: {
  energyOn: string
  ranked: RankedItem[]
  focus: string
  type: ContentItem['type']
  changed: Set<string>
  energy: string
  projected: boolean
  position: number
}) {
  const box = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(170)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const placed = useMemo(() => packDense(ranked, 3), [ranked])
  const typeOf = useMemo(() => new Map(ranked.map((r) => [r.item.id, r.item.type])), [ranked])
  const f = placed.find((p) => p.id === focus)
  const rows = placed.reduce((m, p) => Math.max(m, p.row + p.rs), 0)
  const colW = (w - GAP * 2) / 3
  const cellH = Math.round(colW * 0.82)
  const unit = cellH + GAP
  const top = f ? Math.max(0, Math.min(Math.max(0, rows - VISIBLE_ROWS), f.row - 2)) : 0

  return (
    <figure className={s.maqueta}>
      <div ref={box} className={s.mBox} style={{ height: VISIBLE_ROWS * unit - GAP }} aria-hidden="true">
        <div className={s.mInner} style={{ transform: `translateY(${-top * unit}px)` }}>
          {placed.map((p) => {
            const isFocus = p.id === focus
            return (
              <span
                key={p.id}
                className={s.mCell}
                data-focus={isFocus || undefined}
                data-type={(!isFocus && typeOf.get(p.id) === type) || undefined}
                data-changed={(projected && changed.has(p.id)) || undefined}
                style={{
                  width: p.cs * colW + (p.cs - 1) * GAP,
                  height: p.rs * cellH + (p.rs - 1) * GAP,
                  transform: `translate(${p.col * (colW + GAP)}px, ${p.row * unit}px)`,
                  background: isFocus ? energy : undefined,
                }}
              >
                {isFocus ? (
                  <b className={s.mPos} style={{ color: energyOn }}>
                    {position}
                  </b>
                ) : null}
              </span>
            )
          })}
        </div>
      </div>
      <figcaption className={s.mCaption}>
        <span className={s.mNote}>{projected ? 'Con el ajuste' : 'Ahora'}</span>
        <span>
          <i style={{ background: energy }} /> esta pieza
        </span>
        <span>
          <i className={s.kType} /> su tipo
        </span>
        <span>
          <i className={s.kChanged} /> cambia de tamaño
        </span>
      </figcaption>
    </figure>
  )
}
