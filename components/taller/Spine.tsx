'use client'

/**
 * ESPINA — who is sitting at this desk. Public identity on the left (name,
 * handle, badge, bio, firma, the ten trophies); on the right, the private
 * module only the owner ever sees: presence as a word, a hairline to the
 * next presence trophy, the number kept small; and the personal vibe — the
 * median band of your own readings.
 */

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import type { User } from '@/lib/types'
import { useDispatch, useNowMs, useWorld } from '@/lib/store/world'
import { useRank } from '@/lib/store/session'
import { useUI } from '@/lib/store/ui'
import { currentPresence } from '@/lib/store/world-core'
import { hlBracket } from '@/lib/dashboard/hl'
import { trophyByKey } from '@/lib/trophies'
import { bandLabel, energyVariation, VIBE_CHECK_THRESHOLD, VIBE_NAMES } from '@/lib/vibe'
import { Avatar, Badge, Flags } from '@/components/kit/Persona'
import { Button } from '@/components/kit/Button'
import { TextArea, TextField } from '@/components/kit/Field'
import { Mark } from '@/components/kit/Glyph'
import { Revelado } from '@/components/trama/Revelado'
import { PresenceMeter, TrophyStrip } from './Trofeos'
import { isImageRef, NUM1, personalVibra, presenceProgress, presenceScale } from './logic'
import styles from './Spine.module.css'

export function Spine({ me }: { me: User }) {
  const rank = useRank(me.id)
  const nowMs = useNowMs()
  const presence = useWorld((s) => currentPresence(s.world, me.id, new Date(nowMs).toISOString()))
  const earned = useWorld((s) => s.world.trophies[me.id])
  const readings = useWorld((s) => s.world.readings)
  const vibra = useMemo(() => personalVibra(readings, me.id), [readings, me.id])
  const [editing, setEditing] = useState(false)
  const nameEnergy = vibra.band ? (vibra.band[0] + vibra.band[1]) / 2 : null

  return (
    <header className={styles.spine}>
      <div className={styles.who} data-rise="">
        <div className={styles.avatar}>
          <Avatar user={me} size={88} rank={rank} />
        </div>
        <div className={styles.idText}>
          <h1 className={styles.h1}>
            <span className={styles.kicker}>Taller</span>
            {/* Set — and printed — at your own temperature once your readings say what it is. */}
            <Revelado
              as="span"
              className={styles.name}
              trigger="load"
              energy={nameEnergy ?? undefined}
              style={nameEnergy !== null ? { fontVariationSettings: energyVariation(nameEnergy) } : undefined}
            >
              {me.displayName || me.username}
            </Revelado>
          </h1>
          <p className={styles.line}>
            <span className={styles.handle}>@{me.username}</span>
            <Badge user={me} rank={rank} />
            <Flags user={me} />
            {me.location ? <span className={styles.zona}>{me.location}</span> : null}
          </p>
          {me.bio ? <p className={styles.bio}>{me.bio}</p> : null}
          {me.firma ? <p className={styles.firma}>{me.firma}</p> : null}
          <div className={styles.ctas}>
            <Button variant="ghost" size="sm" onClick={() => setEditing((e) => !e)} aria-expanded={editing} aria-controls="taller-perfil">
              {editing ? 'Cerrar edición' : 'Editar perfil'}
            </Button>
            <Button variant="quiet" size="sm" href={`/u/${me.username}`} iconRight={<Mark name="arrow" size={13} />}>
              Credencial pública
            </Button>
          </div>
        </div>
      </div>

      <div className={styles.trofeos} data-rise="">
        <TrophyStrip earned={earned} />
      </div>

      <aside className={styles.private} aria-labelledby="taller-privado" data-rise="">
        <p className={styles.privateHead} id="taller-privado">
          <Mark name="lock" size={12} />
          Solo tú ves esto
        </p>
        <Presencia value={presence} />
        <Vibra count={vibra.count} band={vibra.band} />
      </aside>

      {editing ? <PerfilForm me={me} onDone={() => setEditing(false)} /> : null}
    </header>
  )
}

// ── presence ────────────────────────────────────────────────────────────────

function Presencia({ value }: { value: number }) {
  const { next } = presenceProgress(value)
  const scale = presenceScale(value)
  const fillRef = useRef<HTMLSpanElement>(null)
  const numRef = useRef<HTMLSpanElement>(null)
  const prev = useRef(value)

  // A real change (a harvest, a save received) grows the line; the slow
  // 60-day decay ticking every 30 s does not animate.
  useLayoutEffect(() => {
    const from = prev.current
    prev.current = value
    const fill = fillRef.current
    if (!fill || Math.abs(from - value) < 0.05) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const tween = gsap.fromTo(
      fill,
      { width: `${Math.min(100, (from / scale) * 100)}%` },
      { width: `${Math.min(100, (value / scale) * 100)}%`, duration: reduced ? 0 : 0.5, ease: 'expo.out' },
    )
    const counter = { v: from }
    const count = gsap.to(counter, {
      v: value,
      duration: reduced ? 0 : 0.5,
      ease: 'expo.out',
      onUpdate: () => {
        if (numRef.current) numRef.current.textContent = NUM1.format(counter.v)
      },
    })
    return () => {
      tween.progress(1).kill()
      count.progress(1).kill()
    }
  }, [value, scale])

  const nextLabel = next ? trophyByKey(next.key)?.label ?? '' : ''
  return (
    <div className={[styles.block, styles.pres].join(' ')}>
      <p className={styles.blockHead}>
        <span className="label">Presencia</span>
      </p>
      <p className={styles.reading}>
        <span className={styles.word}>{hlBracket(value)}</span>
        <span className={styles.num} ref={numRef}>
          {NUM1.format(value)}
        </span>
      </p>
      <PresenceMeter value={value} scale={scale} fillRef={fillRef} />
      <p className={styles.caption}>
        {next ? (
          <>
            Siguiente: <b>{nextLabel}</b> <span className={styles.faint}>· faltan {NUM1.format(Math.max(0, next.target - value))}</span>
          </>
        ) : (
          'Los cuatro trofeos de presencia son tuyos.'
        )}
      </p>
    </div>
  )
}

// ── personal vibe ───────────────────────────────────────────────────────────

function Vibra({ count, band }: { count: number; band: [number, number] | null }) {
  const missing = Math.max(0, VIBE_CHECK_THRESHOLD - count)
  const mid = band ? (band[0] + band[1]) / 2 : 5
  return (
    <div className={[styles.block, styles.vib].join(' ')}>
      <p className={styles.blockHead}>
        <span className="label">Tu vibra personal</span>
      </p>
      <div
        className={styles.vibra}
        data-empty={band ? undefined : true}
        role="img"
        aria-label={band ? `Tu vibra: ${bandLabel(band[0], band[1])}` : `${missing === 1 ? 'Falta 1 lectura' : `Faltan ${missing} lecturas`} para tu vibra`}
      >
        {VIBE_NAMES.map((n, i) => {
          const lit = band !== null && i >= band[0] && i <= band[1]
          return <span key={n} data-lit={lit || undefined} style={{ ['--c' as string]: `var(--e${i})` }} />
        })}
      </div>
      {band ? (
        <p className={styles.caption}>
          <b className={styles.vibraWords} style={{ fontVariationSettings: energyVariation(mid) }}>
            {bandLabel(band[0], band[1])}
          </b>{' '}
          <span className={styles.faint}>· mediana de {count} lecturas tuyas</span>
        </p>
      ) : (
        <div className={styles.pending}>
          <span className={styles.dots} aria-hidden="true">
            {Array.from({ length: VIBE_CHECK_THRESHOLD }, (_, i) => (
              <span key={i} data-on={i < count || undefined} />
            ))}
          </span>
          <p className={styles.caption}>
            {missing === 1 ? 'Falta 1 lectura' : `Faltan ${missing} lecturas`} para tu vibra.{' '}
            <span className={styles.faint}>Calibra piezas en el campo.</span>
          </p>
        </div>
      )}
    </div>
  )
}

// ── profile form ────────────────────────────────────────────────────────────

type Fields = { displayName: string; location: string; bio: string; firma: string; avatarUrl: string }

const LIMIT = { displayName: 60, location: 80, bio: 600, firma: 140 } as const

function PerfilForm({ me, onDone }: { me: User; onDone: () => void }) {
  const dispatch = useDispatch()
  const notify = useUI((s) => s.notify)
  const ref = useRef<HTMLFormElement>(null)
  const [f, setF] = useState<Fields>({
    displayName: me.displayName ?? '',
    location: me.location ?? '',
    bio: me.bio ?? '',
    firma: me.firma ?? '',
    avatarUrl: me.avatarUrl ?? '',
  })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const t = gsap.fromTo(
      el,
      { height: 0, opacity: 0, overflow: 'hidden' },
      { height: 'auto', opacity: 1, duration: reduced ? 0.16 : 0.6, ease: 'expo.out', clearProps: 'height,opacity,overflow' },
    )
    return () => {
      t.kill()
    }
  }, [])

  const errors = {
    displayName: !f.displayName.trim() ? 'Tu nombre no puede quedar vacío.' : null,
    avatarUrl: !isImageRef(f.avatarUrl) ? 'Usa un enlace https:// o una ruta del sitio, como /flyers/…' : null,
  }
  const patch: Partial<Fields> = {}
  ;(Object.keys(f) as Array<keyof Fields>).forEach((k) => {
    const v = f[k].trim()
    if (v !== (me[k] ?? '').trim()) patch[k] = v
  })
  const dirty = Object.keys(patch).length > 0
  const invalid = Boolean(errors.displayName || errors.avatarUrl)
  const preview: User = { ...me, avatarUrl: errors.avatarUrl ? me.avatarUrl : f.avatarUrl.trim() || undefined, displayName: f.displayName || me.displayName }

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }))

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (invalid || !dirty) return
    dispatch({ t: 'profile', userId: me.id, patch, at: new Date().toISOString() })
    notify('Perfil guardado.')
    onDone()
  }

  return (
    <form ref={ref} id="taller-perfil" className={styles.form} onSubmit={save} aria-label="Editar perfil">
      <div className={styles.formGrid}>
        <TextField
          label="Nombre visible"
          value={f.displayName}
          onChange={set('displayName')}
          maxLength={LIMIT.displayName}
          counter={{ value: f.displayName.length, max: LIMIT.displayName }}
          error={errors.displayName}
          required
          data-autofocus=""
        />
        <TextField
          label="Zona"
          value={f.location}
          onChange={set('location')}
          maxLength={LIMIT.location}
          counter={{ value: f.location.length, max: LIMIT.location }}
          placeholder="Roma Norte, CDMX"
        />
        <TextArea
          className={styles.wide}
          label="Bio"
          value={f.bio}
          onChange={set('bio')}
          maxLength={LIMIT.bio}
          counter={{ value: f.bio.length, max: LIMIT.bio }}
          placeholder="Qué escuchas, qué cubres, desde dónde."
          rows={3}
        />
        <TextField
          className={styles.wide}
          label="Firma"
          value={f.firma}
          onChange={set('firma')}
          maxLength={LIMIT.firma}
          counter={{ value: f.firma.length, max: LIMIT.firma }}
          placeholder="Tu pie al final de lo que escribes."
          hint="Aparece bajo tus textos y comentarios."
        />
        <div className={[styles.wide, styles.avatarRow].join(' ')}>
          <Avatar user={preview} size={52} />
          <TextField
            className={styles.grow}
            label="Avatar (URL)"
            value={f.avatarUrl}
            onChange={set('avatarUrl')}
            placeholder="https://… o /flyers/…"
            error={errors.avatarUrl}
            hint="Déjalo vacío para usar tu inicial."
            inputMode="url"
          />
        </div>
      </div>
      <div className={styles.formActions}>
        <Button variant="quiet" onClick={onDone}>
          Cancelar
        </Button>
        <Button variant="ink" type="submit" disabled={invalid || !dirty}>
          Guardar perfil
        </Button>
      </div>
    </form>
  )
}
