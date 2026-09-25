'use client'

/**
 * LA MESA — the drafting table for all eight formats.
 *
 *   · steps per format (as in production), sections numbered continuously
 *   · every change autosaves (900 ms) into the world's drafts; ⌘Z / ⇧⌘Z
 *     undo and redo 50 steps; Esc saves and goes back to the Taller
 *   · the right side is the Guía or the light table (the real Pieza, the
 *     real reader); the whole table takes the piece's own temperature
 *   · publishing is two commitments: hold the button, then confirm
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { format, parseISO } from 'date-fns'
import type { ContentItem, Draft, EntityRef, User } from '@/lib/types'
import { getSelectableTags, isClassifierTag } from '@/lib/genres'
import { franjaAttributionPrefix } from '@/lib/franjaAttribution'
import { FRANJA_PUBLISHABLE_TYPES } from '@/lib/permissions'
import { useDispatch, useItems, useNow, useWorld } from '@/lib/store/world'
import { useCampo } from '@/lib/store/campo'
import { useUI } from '@/lib/store/ui'
import { bandOverlaps, energyVariation } from '@/lib/vibe'
import { getStage } from '@/components/stage/engine'
import { flare, setFieldIntensity } from '@/components/stage/api'
import { FormatGlyph, FORMAT_LABEL, Mark } from '@/components/kit/Glyph'
import { Button } from '@/components/kit/Button'
import { Kbd } from '@/components/kit/Bits'
import { MesaContext, type FormApi, type Knowledge, type MesaEnv } from './context'
import { useAutosave, useHistory, type SaveStatus } from './hooks'
import {
  FIELD_ID,
  FORMATO_CODE,
  bandVar,
  canPin,
  eVar,
  composerPrior,
  energySet,
  finalize,
  isStaff,
  patchItem,
  planFor,
  previewOf,
  readMinutes,
  readiness,
  slugify,
  stepsFor,
  uniqueSlug,
  wordsOf,
  type Formato,
  type Need,
  type SectionKey,
  type StepId,
} from './model'
import { FormTexto } from './forms/FormTexto'
import { FormNoticia } from './forms/FormNoticia'
import { FormEvento } from './forms/FormEvento'
import { FormMix } from './forms/FormMix'
import { FormArticulo, FormLista } from './forms/FormLargo'
import { Guia } from './aside/Guia'
import { VistaPrevia } from './aside/Preview'
import { Confirmar, Revisar, type Levers } from './Revisar'
import a from './aside/aside.module.css'
import s from './Composer.module.css'

const READING_TYPES: Formato[] = ['review', 'editorial', 'opinion', 'articulo', 'noticia', 'listicle']

function Form({ api, step }: { api: FormApi; step: StepId }) {
  switch (api.env.type) {
    case 'evento':
      return <FormEvento api={api} step={step} />
    case 'mix':
      return <FormMix api={api} step={step} />
    case 'noticia':
      return <FormNoticia api={api} step={step} />
    case 'articulo':
      return <FormArticulo api={api} step={step} />
    case 'listicle':
      return <FormLista api={api} step={step} />
    default:
      return <FormTexto api={api} step={step} />
  }
}

function statusLabel(st: SaveStatus, isEdit: boolean): string {
  if (st.kind === 'pendiente') return 'Guardando…'
  if (st.kind === 'guardado') return `Guardado · ${format(parseISO(st.at), 'HH:mm')}`
  return isEdit ? 'Publicada · tus cambios se guardan al escribir' : 'Borrador nuevo · se guarda al escribir'
}

interface Props {
  me: User
  draft: Draft
  persisted: boolean
  existing: ContentItem | null
  flyers: string[]
  onFirstSave?: (draftId: string) => void
}

export function Composer({ me, draft: initial, persisted, existing, flyers, onFirstSave }: Props) {
  const type = initial.type as Formato
  const router = useRouter()
  const dispatch = useDispatch()
  const notify = useUI((st) => st.notify)
  const ask = useUI((st) => st.ask)
  const items = useItems()
  const threads = useWorld((st) => st.world.threads)
  const myFranja = useWorld((st) => (me.franjaId ? st.world.items[me.franjaId] ?? null : null))
  const itemFranja = useWorld((st) => (existing?.franjaId ? st.world.items[existing.franjaId] ?? null : null))
  const now = useNow()

  const [item, setItem] = useState<ContentItem>(initial.item)
  const [slugFollows, setSlugFollows] = useState(() => !existing && (!initial.item.slug || initial.item.slug === slugify(initial.item.title)))
  const follows = useRef(slugFollows)
  follows.current = slugFollows
  const steps = useMemo(() => stepsFor(type), [type])
  const plan = useMemo(() => planFor(type), [type])
  const [step, setStep] = useState<StepId>(steps[0].id)
  const [side, setSide] = useState<'guia' | 'vista'>('guia')
  const [cardMode, setCardMode] = useState<'tarjeta' | 'lectura'>('tarjeta')
  const [reviewMode, setReviewMode] = useState<'tarjeta' | 'lectura'>('lectura')
  const [confirming, setConfirming] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [activeSec, setActiveSec] = useState<SectionKey | null>(null)
  const [pendingJump, setPendingJump] = useState<{ section: SectionKey; field?: string } | null>(null)
  const history = useHistory(item, setItem)

  const base = useMemo(
    () => ({ id: initial.id, type: initial.type, authorId: initial.authorId, publishedId: initial.publishedId, createdAt: initial.createdAt }),
    [initial],
  )
  const save = useAutosave({ base, item, persisted, lastSavedAt: persisted ? initial.updatedAt : undefined, onFirstSave })

  const patch = useCallback((p: Partial<ContentItem>) => setItem((it) => patchItem(it, p, follows.current)), [])

  // ── what the table knows ──────────────────────────────────────────────────

  const knowledge = useMemo<Knowledge>(() => {
    const artists = new Set<string>()
    const venues = new Map<string, { name: string; city?: string }>()
    const entities = new Map<string, EntityRef>()
    const franjas: ContentItem[] = []
    const custom = new Set<string>()
    const shipped = new Set(getSelectableTags().map((t) => t.id))
    const addTag = (t: string) => {
      if (!shipped.has(t) && isClassifierTag(t)) custom.add(t)
    }
    for (const it of items) {
      if (it.type === 'franja') {
        franjas.push(it)
        continue
      }
      it.artists?.forEach((x) => x.trim() && artists.add(x.trim()))
      const v = it.venue?.trim()
      if (v && !venues.has(v.toLowerCase())) venues.set(v.toLowerCase(), { name: v, city: it.venueCity?.trim() || undefined })
      it.entities?.forEach((e) => entities.set(`${e.kind}:${e.slug}`, e))
      it.tags.forEach(addTag)
    }
    Object.values(threads).forEach((t) => t.tags.forEach(addTag))
    franjas.sort((x, y) => x.title.localeCompare(y.title, 'es'))
    return {
      artists: [...artists].sort((x, y) => x.localeCompare(y, 'es')),
      venues: [...venues.values()].sort((x, y) => x.name.localeCompare(y.name, 'es')),
      entities: [...entities.values()],
      franjas,
      customTags: [...custom].sort(),
    }
  }, [items, threads])

  const ownId = existing?.id ?? item.id
  const slugIndex = useMemo(() => new Map(items.map((it) => [it.slug, it.id])), [items])
  const slugTaken = useCallback((sl: string) => {
    const id = slugIndex.get(sl)
    return !!id && id !== ownId
  }, [slugIndex, ownId])

  const prior = useMemo(
    () => composerPrior({ genres: item.genres, venue: type === 'evento' ? item.venue : undefined, authorId: me.id, items, excludeId: ownId }),
    [item.genres, item.venue, type, me.id, items, ownId],
  )

  const needs = useMemo(() => readiness(type, item), [type, item])

  // ── the field takes the piece's temperature ───────────────────────────────

  const energyOk = energySet(item)
  const mid = energyOk ? (item.vibeMin + item.vibeMax) / 2 : null

  useEffect(() => {
    setFieldIntensity(0.62)
    return () => {
      setFieldIntensity(1)
      const r = useCampo.getState().range
      getStage().setBand(r[0], r[1])
    }
  }, [])

  useEffect(() => {
    if (energyOk) getStage().setBand(item.vibeMin, item.vibeMax)
  }, [energyOk, item.vibeMin, item.vibeMax])

  const onEnergyLive = useCallback((b: [number, number] | null) => {
    if (b) getStage().setBand(b[0], b[1])
  }, [])

  // ── navigation between steps ──────────────────────────────────────────────

  const goStep = useCallback(
    (next: StepId, opts?: { keepScroll?: boolean }) => {
      if (next === step) return
      setStep(next)
      if (next === 'revisar') setReviewed(true)
      if (next === 'portada' || next === 'cartel') setSide('vista')
      else if (next !== 'revisar') setSide('guia')
      if (!opts?.keepScroll) window.scrollTo({ top: 0, behavior: 'auto' })
    },
    [step],
  )

  const [reveal, setReveal] = useState<{ key: string; n: number } | null>(null)

  const jump = useCallback(
    (target: string) => {
      const need = needs.find((n) => n.key === target)
      const section = (need ? need.section : target) as SectionKey
      const def = plan.find((p) => p.key === section)
      if (!def) return
      setReveal({ key: section, n: Date.now() })
      if (def.step !== step) goStep(def.step, { keepScroll: true })
      setPendingJump({ section, field: need ? FIELD_ID[need.key] : undefined })
    },
    [needs, plan, step, goStep],
  )

  // Land on the field once it exists (a step change or a disclosure may
  // still be mounting): scroll it to the middle, focus it, mark the margin.
  useEffect(() => {
    if (!pendingJump) return
    let tries = 0
    let raf = 0
    const land = () => {
      const sec = document.getElementById(`mesa-s-${pendingJump.section}`)
      const field = pendingJump.field ? document.getElementById(pendingJump.field) : null
      const target = field ?? sec
      if (!target) {
        if (++tries < 12) raf = requestAnimationFrame(land)
        else setPendingJump(null)
        return
      }
      target.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
      const focusable = target.matches('input, textarea, select, button, [tabindex]')
        ? target
        : target.querySelector<HTMLElement>('input, textarea, select, button, [tabindex="0"]')
      focusable?.focus({ preventScroll: true })
      if (sec) {
        sec.removeAttribute('data-flash')
        void sec.offsetWidth
        sec.setAttribute('data-flash', '')
        window.setTimeout(() => sec.removeAttribute('data-flash'), 1500)
      }
      setPendingJump(null)
    }
    raf = requestAnimationFrame(land)
    return () => cancelAnimationFrame(raf)
  }, [pendingJump, step])

  // The active-step bar travels to the new step (a state change, nothing more).
  const formRef = useRef<HTMLDivElement>(null)
  const stepsRef = useRef<HTMLElement>(null)
  const lineRef = useRef<HTMLSpanElement>(null)
  const firstStep = useRef(true)
  useLayoutEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const btn = stepsRef.current?.querySelector<HTMLElement>('[aria-current="step"]')
    if (btn && lineRef.current) {
      const x = btn.offsetLeft
      const w = btn.offsetWidth
      if (firstStep.current || reduced) gsap.set(lineRef.current, { x, width: w })
      else gsap.to(lineRef.current, { x, width: w, duration: 0.3, ease: 'power3.out' })
    }
    firstStep.current = false
  }, [step])

  // Which section is under the eye (index rail).
  useEffect(() => {
    const secs = formRef.current?.querySelectorAll<HTMLElement>('[data-sec]')
    if (!secs?.length) return
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((x, y) => x.boundingClientRect.top - y.boundingClientRect.top)[0]
        if (vis) setActiveSec((vis.target as HTMLElement).dataset.sec as SectionKey)
      },
      { rootMargin: '-30% 0px -55% 0px' },
    )
    secs.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [step])

  // ── leaving, keys ─────────────────────────────────────────────────────────

  const close = useCallback(() => {
    save.flush()
    router.push('/taller')
  }, [save, router])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
      const mod = e.metaKey || e.ctrlKey
      const k = e.key.toLowerCase()
      if (mod && !e.altKey && k === 'z') {
        e.preventDefault()
        if (e.shiftKey) history.redo()
        else history.undo()
      } else if (mod && !e.altKey && k === 'y') {
        e.preventDefault()
        history.redo()
      } else if (mod && k === 's') {
        e.preventDefault()
        save.flush()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [history, save, close])

  // ── publish ───────────────────────────────────────────────────────────────

  const franjaPrefix = myFranja?.franjaKind ? franjaAttributionPrefix(myFranja.franjaKind) : 'PRESENTA'
  const levers: Levers = {}
  if (isStaff(me)) levers.editorial = { on: !!item.editorial, set: (v) => patch({ editorial: v }) }
  if (canPin(me)) levers.pinned = { on: !!item.pinned, set: (v) => patch({ pinned: v }) }
  if (existing?.franjaId && existing.franjaId !== me.franjaId && itemFranja) {
    levers.franja = { on: true, fixed: true, set: () => {}, name: itemFranja.title, prefix: itemFranja.franjaKind ? franjaAttributionPrefix(itemFranja.franjaKind) : 'PRESENTA' }
  } else if (myFranja && FRANJA_PUBLISHABLE_TYPES.includes(type)) {
    levers.franja = { on: item.franjaId === myFranja.id, set: (v) => patch({ franjaId: v ? myFranja.id : undefined }), name: myFranja.title, prefix: franjaPrefix }
  }
  const franjaShown = levers.franja?.on ? { name: levers.franja.name, prefix: levers.franja.prefix } : null

  const onHold = useCallback(() => {
    save.flush('pendiente')
    setConfirming(true)
  }, [save])

  const closeConfirm = useCallback(() => setConfirming(false), [])

  const publish = () => {
    const at = new Date().toISOString()
    const id = existing?.id ?? item.id
    const slug = existing ? existing.slug : uniqueSlug(item.slug || slugify(item.title), slugTaken)
    const words = wordsOf(item)
    const readTime = item.readTime ?? (READING_TYPES.includes(type) ? readMinutes(words) : undefined)
    const source: ContentItem['source'] = item.franjaId ? 'manual:franja' : existing?.source && !existing.source.startsWith('manual:') ? existing.source : 'manual:editor'
    const final = finalize(item, {
      id,
      slug,
      source,
      franjaId: item.franjaId,
      editorial: isStaff(me) ? !!item.editorial : !!existing?.editorial,
      pinned: canPin(me) ? !!item.pinned : !!existing?.pinned,
      readTime,
    })
    save.seal()
    dispatch({ t: 'publish', draftId: initial.id, item: final, authorId: me.id, at })

    // The home should show what was just born.
    const campo = useCampo.getState()
    campo.setType(null)
    campo.setGenres([])
    if (!bandOverlaps(final, campo.range)) campo.resetRange()

    const e = (final.vibeMin + final.vibeMax) / 2
    flare({ x: window.innerWidth / 2, y: window.innerHeight / 2 }, e)
    notify(existing ? 'Actualizada en el campo.' : 'Publicada. Ya vive en el campo.', { tone: 'energy', energy: e })
    setConfirming(false)
    router.push(`/?item=${encodeURIComponent(final.slug)}`)
  }

  const discard = async () => {
    const ok = await ask({
      title: existing ? 'Descartar estos cambios' : 'Descartar este borrador',
      body: existing ? 'La pieza publicada queda como estaba.' : 'El borrador se borra de tu taller. No se puede deshacer.',
      confirmLabel: 'Descartar',
      destructive: true,
    })
    if (!ok) return
    save.seal()
    dispatch({ t: 'draft-delete', id: initial.id, at: new Date().toISOString() })
    notify(existing ? 'Cambios descartados.' : 'Borrador descartado.')
    router.push('/taller')
  }

  // ── derived views ─────────────────────────────────────────────────────────

  const nowIso = useMemo(() => now.toISOString(), [now])
  const preview = useMemo(() => {
    const p = previewOf(item, { authorId: me.id, nowIso, existing })
    if (!existing) {
      // What the home will call it once published: a collision gets a suffix.
      p.slug = uniqueSlug(item.slug || slugify(item.title), slugTaken)
    }
    return p
  }, [item, me.id, nowIso, existing, slugTaken])
  const deferred = useDeferredValue(preview)

  const env: MesaEnv = useMemo(
    () => ({
      me,
      type,
      flyers,
      existing,
      knowledge,
      plan,
      needs,
      prior,
      slugTaken,
      slugFollows,
      setSlugFollows: (v: boolean) => {
        setSlugFollows(v)
        if (v) setItem((it) => ({ ...it, slug: slugify(it.title) }))
      },
      jump,
      onEnergyLive,
      reveal,
    }),
    [me, type, flyers, existing, knowledge, plan, needs, prior, slugTaken, slugFollows, jump, onEnergyLive, reveal],
  )
  const api: FormApi = { item, patch, env }

  const stepIndex = steps.findIndex((x) => x.id === step)
  const current = steps[stepIndex]
  const prev = steps[stepIndex - 1]
  const next = steps[stepIndex + 1]
  const stepMisses = (id: StepId) => needs.some((n) => n.level === 'hard' && !n.done && plan.find((p) => p.key === n.section)?.step === id)
  const stepSections = plan.filter((p) => p.step === step)
  const hardBySection = (k: SectionKey) => needs.some((n) => n.section === k && n.level === 'hard' && !n.done)

  const rootStyle = {
    ['--m-e' as string]: mid !== null ? eVar(mid) : 'var(--ink-2)',
    ['--field-color' as string]: mid !== null ? eVar(mid) : 'var(--ink-3)',
    ['--m-var' as string]: mid !== null ? energyVariation(mid) : '"wdth" 100, "wght" 440',
    ['--m-band' as string]: energyOk ? bandVar(item.vibeMin, item.vibeMax) : 'var(--hair-2)',
  }

  return (
    <MesaContext.Provider value={env}>
      <div className={s.mesa} style={rootStyle} data-step={step}>
        <header className={s.bar}>
          <div className={s.barInner}>
            <Link href="/taller" className={s.back} onClick={() => save.flush()} aria-label="Volver al taller (se guarda)">
              <Mark name="arrow" size={13} /> <span className={s.backLabel}>Taller</span>
            </Link>
            <span className={s.what}>
              <FormatGlyph type={type} size={13} />
              {FORMATO_CODE[type]} · {FORMAT_LABEL[type]}
              <small>{existing ? 'Editando publicada' : 'Borrador'}</small>
            </span>

            <nav ref={stepsRef} className={s.steps} aria-label="Pasos">
              {steps.map((st, i) => {
                const miss = reviewed && st.id !== 'revisar' && stepMisses(st.id)
                return (
                  <button
                    key={st.id}
                    type="button"
                    className={s.step}
                    aria-current={step === st.id ? 'step' : undefined}
                    aria-label={`Paso ${i + 1}: ${st.label}${miss ? ' · falta algo necesario' : ''}`}
                    onClick={() => goStep(st.id)}
                  >
                    <span className={s.stepNum}>{String(i + 1).padStart(2, '0')}</span>
                    <span className={s.stepLabel}>{st.label}</span>
                    {miss ? <span className={s.stepMiss} title="Falta algo necesario" /> : null}
                  </button>
                )
              })}
              <span ref={lineRef} className={s.stepLine} aria-hidden="true" />
            </nav>

            <div className={s.tools}>
              <span className={s.status} role="status" aria-live="polite" data-pending={save.status.kind === 'pendiente' || undefined}>
                {statusLabel(save.status, !!existing)}
              </span>
              <button type="button" className={s.icon} onClick={history.undo} disabled={!history.canUndo} aria-label="Deshacer (⌘Z)" title="Deshacer · ⌘Z">
                ↶
              </button>
              <button type="button" className={s.icon} onClick={history.redo} disabled={!history.canRedo} aria-label="Rehacer (⇧⌘Z)" title="Rehacer · ⇧⌘Z">
                ↷
              </button>
              <button type="button" className={s.close} onClick={close} aria-label="Guardar y salir (Esc)">
                <span className={s.closeLabel}>Guardar y salir</span> <Kbd>Esc</Kbd>
              </button>
            </div>
          </div>
        </header>

        <div className={s.frame} data-mesa-stage="">
          <div className={s.head}>
            <span className={s.headLabel}>
              {String(stepIndex + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')} — {current.label}
            </span>
            <h1 className={s.headTitle}>{current.description}</h1>
          </div>

          {step === 'revisar' ? (
            <Revisar
              type={type}
              preview={deferred}
              cold={!energyOk}
              needs={needs}
              isEdit={!!existing}
              levers={levers}
              mode={reviewMode}
              onMode={setReviewMode}
              onJump={(n: Need) => jump(n.key)}
              onHold={onHold}
              onDiscard={discard}
            />
          ) : (
            <div className={s.grid}>
              <nav className={s.index} aria-label="Secciones de este paso">
                <span className={s.indexLabel}>En este paso</span>
                {stepSections.map((sec) => (
                  <button key={sec.key} type="button" className={s.indexItem} data-on={activeSec === sec.key || undefined} onClick={() => jump(sec.key)}>
                    <span>{sec.num}</span>
                    <span>{sec.label}</span>
                    {hardBySection(sec.key) ? <span className={s.indexDot} title="Necesario para publicar" /> : <span />}
                  </button>
                ))}
              </nav>

              <div ref={formRef} className={s.form}>
                <Form api={api} step={step} />
                <div className={s.foot}>
                  {prev ? (
                    <Button variant="ghost" onClick={() => goStep(prev.id)}>
                      ← {prev.label}
                    </Button>
                  ) : (
                    <span className={s.footHint}>Todo se guarda solo. Puedes salir cuando quieras.</span>
                  )}
                  {next ? (
                    <Button variant="ink" size="lg" onClick={() => goStep(next.id)} iconRight={<Mark name="arrow" size={15} />}>
                      {next.id === 'revisar' ? 'Revisar' : next.label}
                    </Button>
                  ) : null}
                </div>
              </div>

              <aside className={s.side} aria-label="Guía y vista previa">
                <div className={a.toggle} role="group" aria-label="Apoyo">
                  <button type="button" aria-pressed={side === 'guia'} onClick={() => setSide('guia')}>
                    Guía
                  </button>
                  <button type="button" aria-pressed={side === 'vista'} onClick={() => setSide('vista')}>
                    Vista previa
                  </button>
                </div>
                {side === 'guia' ? (
                  <Guia
                    item={item}
                    type={type}
                    step={step}
                    onPreview={() => setSide('vista')}
                    onJump={(i) => document.querySelector(`[data-block="${i}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })}
                  />
                ) : (
                  <VistaPrevia item={deferred} cold={!energyOk} mode={cardMode} onMode={setCardMode} />
                )}
              </aside>
            </div>
          )}
        </div>

        <Confirmar open={confirming} item={preview} type={type} isEdit={!!existing} franja={franjaShown} onClose={closeConfirm} onPublish={publish} />
      </div>
    </MesaContext.Provider>
  )
}
