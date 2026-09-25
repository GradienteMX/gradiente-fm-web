'use client'

/**
 * COSECHA — cultivate, then harvest. Once per piece, forever: ~40 % of the
 * piece's current life passes into your presence, and the piece fades 1.7×
 * faster afterwards. The two lines in this sheet share one scale, so the
 * length that leaves the piece is exactly the length your presence gains —
 * the garden metaphor, drawn to scale. The hold is the commitment (and the
 * HoldButton's flare marks it in the field). The only place outside Central where
 * the private numbers sit next to the words, because it is yours.
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { chispa } from '@/components/trama/api'
import type { ContentItem, User } from '@/lib/types'
import { useDispatch, useItemById, useNowMs, useWorld } from '@/lib/store/world'
import { useUI } from '@/lib/store/ui'
import { currentPresence, ECHO_FACTOR, HARVEST_MULTIPLIER } from '@/lib/store/world-core'
import { currentHp } from '@/lib/curation'
import { hlBracket } from '@/lib/dashboard/hl'
import { bandGradient, energyHex, energyVariation } from '@/lib/vibe'
import { fitTitle } from '@/lib/typeset'
import { ago } from '@/lib/logic/time'
import { Sheet } from '@/components/kit/Sheet'
import { HoldButton } from '@/components/kit/HoldButton'
import { Button } from '@/components/kit/Button'
import { FormatGlyph, FORMAT_LABEL, Mark } from '@/components/kit/Glyph'
import { PresenceMeter } from './Trofeos'
import { bandCode, NUM1, pieceEnergy, presenceScale, useCosecha } from './logic'
import styles from './Cosecha.module.css'

const PCT = Math.round(ECHO_FACTOR * 100)

export function Cosecha({ me }: { me: User }) {
  const itemId = useCosecha((s) => s.itemId)
  const close = useCosecha((s) => s.close)
  const item = useItemById(itemId)
  const open = Boolean(itemId && item && item.createdById === me.id)
  return (
    <Sheet open={open} onClose={close} label={item ? `Cosechar «${item.title}»` : 'Cosechar'} width={640}>
      {open && item ? <CosechaBody key={item.id} me={me} item={item} onClose={close} /> : null}
    </Sheet>
  )
}

type Phase = 'idle' | 'flowing' | 'done'

function CosechaBody({ me, item, onClose }: { me: User; item: ContentItem; onClose: () => void }) {
  const dispatch = useDispatch()
  const notify = useUI((s) => s.notify)
  const nowMs = useNowMs()
  const presenceLive = useWorld((s) => currentPresence(s.world, me.id, new Date(nowMs).toISOString()))
  const [phase, setPhase] = useState<Phase>(item.harvestedAt ? 'done' : 'idle')
  // Frozen at the instant of the harvest so the drawing never jumps while the
  // world (which has already changed) re-renders underneath.
  const [snap, setSnap] = useState<{ hl: number; echo: number; p: number } | null>(null)

  const live = useMemo(() => {
    const hl = currentHp(item, new Date(nowMs))
    return { hl, echo: hl * ECHO_FACTOR, p: presenceLive }
  }, [item, nowMs, presenceLive])
  const S = snap ?? live
  const scale = presenceScale(S.p + S.echo, S.hl)
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / scale) * 100))}%`
  const e = pieceEnergy(item)
  const weak = S.hl < 5

  const flowRef = useRef<HTMLDivElement>(null)
  const remainRef = useRef<HTMLSpanElement>(null)
  const echoRef = useRef<HTMLSpanElement>(null)
  const seedRef = useRef<HTMLSpanElement>(null)
  const presFillRef = useRef<HTMLSpanElement>(null)
  const ghostRef = useRef<HTMLSpanElement>(null)
  const presNumRef = useRef<HTMLSpanElement>(null)
  const lifeNumRef = useRef<HTMLSpanElement>(null)
  const footRef = useRef<HTMLDivElement>(null)

  const harvest = () => {
    if (phase !== 'idle' || item.harvestedAt) return
    setSnap({ hl: live.hl, echo: live.echo, p: live.p })
    setPhase('flowing')
    dispatch({ t: 'harvest', userId: me.id, itemId: item.id, at: new Date().toISOString() })
    notify(`Cosechaste «${item.title}».`, { tone: 'energy', energy: e.mid })
  }

  // The transfer, as a FLIP: the harvested segment leaves the piece's line
  // and settles at the end of your presence — which grows by exactly it
  // (both lines share one scale). A state change, not a spectacle.
  useLayoutEffect(() => {
    if (phase !== 'flowing' || !snap) return
    const flow = flowRef.current
    const echo = echoRef.current
    const seed = seedRef.current
    const ghost = ghostRef.current
    const presFill = presFillRef.current
    const remain = remainRef.current
    if (!flow || !echo || !seed || !ghost || !presFill || !remain) {
      setPhase('done')
      return
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const after = snap.p + snap.echo
    const counter = { p: snap.p, hl: snap.hl }
    const writeNums = () => {
      if (presNumRef.current) presNumRef.current.textContent = NUM1.format(counter.p)
      if (lifeNumRef.current) lifeNumRef.current.textContent = NUM1.format(counter.hl)
    }

    const ctx = gsap.context(() => {
      if (footRef.current) gsap.to(footRef.current, { opacity: 0.35, duration: 0.16 })
      if (reduced) {
        gsap.set([echo, ghost], { opacity: 0 })
        gsap.set(presFill, { width: pct(after) })
        gsap.set(remain, { filter: 'saturate(0.55)' })
        counter.p = after
        counter.hl = snap.hl - snap.echo
        writeNums()
        gsap.delayedCall(0.16, () => setPhase('done'))
        return
      }
      // First: where the segment is. Last: where it lands. Invert, play.
      const fr = flow.getBoundingClientRect()
      const a = echo.getBoundingClientRect()
      const b = ghost.getBoundingClientRect()
      gsap.set(seed, { left: a.left - fr.left, top: a.top - fr.top, width: Math.max(3, a.width), height: a.height, x: 0, y: 0, opacity: 1 })
      gsap.set(echo, { opacity: 0 })

      const tl = gsap.timeline({ onComplete: () => setPhase('done') })
      tl.to(seed, { x: b.left - a.left, y: b.top + b.height / 2 - (a.top + a.height / 2), width: Math.max(3, b.width), duration: 0.9, ease: 'power2.inOut' })
        .to(remain, { filter: 'saturate(0.55)', duration: 0.9, ease: 'sine.inOut' }, 0)
        .to(counter, { hl: snap.hl - snap.echo, duration: 0.9, ease: 'power2.inOut', onUpdate: writeNums }, 0)
        // Landing: the shared engine's small printed ring where the commit arrived.
        .add(() => {
          const r = ghost.getBoundingClientRect()
          chispa(r.left + r.width / 2, r.top + r.height / 2, e.mid)
        })
        .set([seed, ghost], { opacity: 0 })
        .to(presFill, { width: pct(after), duration: 0.5, ease: 'expo.out' }, '<')
        .to(counter, { p: after, duration: 0.5, ease: 'expo.out', onUpdate: writeNums }, '<')
    }, flow)
    // Kill, don't revert: the end state is the truth now.
    return () => ctx.kill()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const done = phase === 'done'
  const afterP = S.p + S.echo

  return (
    <div className={styles.body} style={{ '--e': energyHex(e.mid), '--band': bandGradient(e.min, e.max) } as React.CSSProperties}>
      <header className={styles.head}>
        <p className={styles.kicker}>
          <Mark name="seed" size={14} />
          {done ? 'Cosechada' : 'Cultivar · cosechar'}
        </p>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">
          <Mark name="close" size={16} />
        </button>
      </header>

      <div className={styles.piece}>
        <span className={styles.poster}>
          {item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="120px" className={styles.posterImg} /> : <span className={styles.plate} style={{ background: bandGradient(e.min, e.max, '160deg') }} />}
          <span className={styles.posterLine} />
        </span>
        <div className={styles.pieceText}>
          <p className={styles.pieceMeta}>
            <FormatGlyph type={item.type} size={12} />
            {FORMAT_LABEL[item.type]} · publicada {ago(item.publishedAt, new Date(nowMs))} · {bandCode(e.min, e.max)}
          </p>
          <h2 className={styles.pieceTitle} style={{ fontVariationSettings: energyVariation(e.mid), fontSize: fitTitle(item.title, e.mid, 34, 18, 0.95) }}>
            {item.title}
          </h2>
        </div>
      </div>

      <div className={styles.flow} ref={flowRef}>
        <div className={styles.line}>
          <p className={styles.lineHead}>
            <span className="label">Vida de la pieza</span>
            <span className={styles.word}>{done && snap ? hlBracket(snap.hl - snap.echo) : hlBracket(S.hl)}</span>
            <span className={styles.num} ref={lifeNumRef}>
              {NUM1.format(S.hl)}
            </span>
          </p>
          <div className={styles.track}>
            <span className={styles.remain} ref={remainRef} style={{ width: pct(S.hl - S.echo) }} />
            <span className={styles.echo} ref={echoRef} style={{ left: pct(S.hl - S.echo), width: pct(S.echo) }} />
          </div>
          <p className={styles.echoNote} style={{ paddingLeft: `min(${pct(S.hl - S.echo)}, calc(100% - 180px))` }}>
            <span aria-hidden="true">↳</span> ~{PCT} % de su vida
          </p>
        </div>

        <div className={styles.line}>
          <p className={styles.lineHead}>
            <span className="label">Tu presencia</span>
            <span className={styles.word}>{done && snap ? hlBracket(afterP) : hlBracket(S.p)}</span>
            <span className={styles.num} ref={presNumRef}>
              {NUM1.format(S.p)}
            </span>
          </p>
          <PresenceMeter value={S.p} scale={scale} ghost={S.echo} fillRef={presFillRef} ghostRef={ghostRef} />
        </div>

        <span className={styles.seed} ref={seedRef} aria-hidden="true" />
      </div>

      {done ? (
        <div className={styles.after} role="status">
          {snap ? (
            <>
              <p className={styles.afterTitle}>Cosechada.</p>
              <p className={styles.afterText}>
                <b>+{NUM1.format(snap.echo)}</b> llegó a tu presencia, que ahora es <b>{hlBracket(afterP)}</b>. La pieza sigue en el campo con el resto de su vida; desde hoy se
                enfría {HARVEST_MULTIPLIER}× más rápido.
              </p>
            </>
          ) : (
            <p className={styles.afterText}>Ya cosechaste esta pieza. Una cosecha por pieza, para siempre.</p>
          )}
          <div className={styles.actions}>
            <Button variant="ink" onClick={onClose} data-autofocus="">
              Listo
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.terms}>
            <p className={styles.projection}>
              Recibirás ~{PCT} % de su vida en tu presencia <span className={styles.faint}>(+{NUM1.format(S.echo)})</span>.
            </p>
            {weak ? <p className={styles.weak}>Su vida es débil ahora: la cosecha sería mínima.</p> : null}
            <p className={styles.warning}>
              <span className={styles.warnMark} aria-hidden="true">
                !
              </span>
              <span>
                Una sola vez por pieza, y es permanente. Después, la pieza se apagará <b>{HARVEST_MULTIPLIER}× más rápido</b>.
              </span>
            </p>
            <p className={styles.circular}>Puedes dejarla circular.</p>
          </div>
          <div className={styles.actions} ref={footRef}>
            <Button variant="quiet" onClick={onClose} disabled={phase !== 'idle'}>
              Dejarla circular
            </Button>
            <HoldButton onConfirm={harvest} energy={e.mid} duration={1.4} holdingLabel="Sigue…" disabled={phase !== 'idle'}>
              Mantén para cosechar
            </HoldButton>
          </div>
        </>
      )}
    </div>
  )
}
