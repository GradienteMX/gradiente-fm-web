'use client'

/**
 * CENTRAL — the admin instrument. The one surface in Gradiente allowed to
 * show raw HL numbers (01-CONCEPTO, non-negotiable 1 and 6): nobody browses
 * it, it changes nothing about how the field is read, and what is measured
 * here does not leave it. It carries the audited levers the model needs
 * while it is being tuned — and says, next to each number, what the record
 * can and cannot know.
 *
 * Gate: `role === 'admin'` (perm.canAssignRoles). Everyone else gets an
 * honest page; logged-out visitors are offered La Puerta.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { User } from '@/lib/types'
import { useMe, useSessionReady, perm } from '@/lib/store/session'
import { useWorld } from '@/lib/store/world'
import { useUI } from '@/lib/store/ui'
import { setFieldIntensity } from '@/components/stage/api'
import { Button } from '@/components/kit/Button'
import { UserChip, ROLE_LABEL } from '@/components/kit/Persona'
import { legacySub, resolveTab, TAB_KEYS, TAB_LABEL, TABS, type Tab } from './tabs'
import { useQuery } from './query'
import { Resumen } from './Resumen'
import { Contenido } from './Contenido'
import { Eventos } from './Eventos'
import { Franjas } from './Franjas'
import { Usuarios } from './Usuarios'
import { Acceso } from './Acceso'
import { Moderacion } from './Moderacion'
import s from './Central.module.css'
import { Cabecera } from '@/components/librea/Cabecera'
import { LIBREA_SECCION } from '@/lib/librea'

export interface CentralProps {
  /** Files found in /public/flyers (event art the editor can pick). */
  flyers: string[]
  /** Files found in /public/franjas (logos the franja composer can pick). */
  logos: string[]
}

export function Central({ flyers, logos }: CentralProps) {
  const me = useMe()
  const worldReady = useWorld((st) => st.hydrated)
  const sessionReady = useSessionReady()

  // An instrument room: the field stays alive behind the console, but quieter.
  useEffect(() => {
    setFieldIntensity(0.5)
    return () => setFieldIntensity(1)
  }, [])

  if (!sessionReady || !worldReady) {
    return (
      <div className={s.central}>
        <Masthead />
        <p className={s.reading} role="status">
          Leyendo el registro…
        </p>
      </div>
    )
  }
  if (!me) return <Gate kind="anon" />
  if (!perm.canAssignRoles(me)) return <Gate kind="denied" me={me} />
  return <Console me={me} flyers={flyers} logos={logos} />
}

// ── masthead & gate ─────────────────────────────────────────────────────────

function Masthead({ me }: { me?: User }) {
  return (
    <Cabecera
      librea={LIBREA_SECCION.central}
      size="compact"
      lema="El único instrumento con números. Aquí se lee la vida del campo tal como la calcula el modelo — y lo que se mide aquí no sale de aquí."
    >
      {me ? (
        <span className={s.session}>
          <span className="label">Sesión</span>
          <UserChip user={me} size={22} />
        </span>
      ) : null}
    </Cabecera>
  )
}

function Gate({ kind, me }: { kind: 'anon' | 'denied'; me?: User }) {
  const openAccess = useUI((st) => st.openAccess)
  return (
    <div className={s.central}>
      <section className={s.gate} aria-labelledby="central-gate">
        <span className="label" style={{ color: 'var(--ink-3)' }}>
          Central
        </span>
        <h1 id="central-gate" className={s.gateTitle}>
          Central es el instrumento de administración. Solo admins.
        </h1>
        {kind === 'anon' ? (
          <p className={s.gateText}>No hay una sesión abierta en este navegador. Entra con una identidad de administración para usarlo.</p>
        ) : (
          <p className={s.gateText}>
            Entraste como <strong>@{me?.username}</strong> ({me ? ROLE_LABEL[me.role] : ''}). Los números de Central no se
            muestran a otros roles — la vida de cada pieza se lee en el campo, por su tamaño y su posición.
          </p>
        )}
        <div className={s.gateActions}>
          {kind === 'anon' ? (
            <Button variant="ink" onClick={() => openAccess('Central es el instrumento de administración', 'entrar')}>
              Entrar
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => openAccess('Central es el instrumento de administración', 'entrar')}>
              Cambiar identidad
            </Button>
          )}
          <Button variant="quiet" href="/">
            Volver al campo
          </Button>
        </div>
      </section>
    </div>
  )
}

// ── the console ─────────────────────────────────────────────────────────────

function Console({ me, flyers, logos }: { me: User } & CentralProps) {
  const { get, set } = useQuery()
  const rawTab = get('tab')
  const tab = resolveTab(rawTab)
  const openReports = useWorld((st) => st.world.reports.reduce((n, r) => n + (r.status === 'abierto' ? 1 : 0), 0))
  const pendingWait = useWorld((st) => st.world.waitlist.reduce((n, r) => n + (r.status === 'espera' ? 1 : 0), 0))
  const lectura = useUI((st) => st.lectura)

  // Canonicalise legacy / unknown ?tab= values in place, so the address bar
  // never disagrees with the latched tab.
  useEffect(() => {
    if (rawTab === null || rawTab === tab) return
    const sub = legacySub(rawTab)
    set({ tab: tab === 'resumen' ? null : tab, ...(sub ? { sub } : {}) })
  }, [rawTab, tab, set])

  // `inspeccion=1` belongs to one inspection only; once the reading folds
  // home, strip it so a later genuine read from this tab still counts.
  const hadLectura = useRef(false)
  useEffect(() => {
    if (lectura) hadLectura.current = true
    else if (hadLectura.current) {
      hadLectura.current = false
      if (new URLSearchParams(window.location.search).has('inspeccion')) set({ inspeccion: null })
    }
  }, [lectura, set])

  const select = (next: Tab) => {
    if (next === tab) return
    const clear: Record<string, null> = {}
    for (const k of Object.values(TAB_KEYS).flat()) clear[k] = null
    set({ ...clear, tab: next === 'resumen' ? null : next }, 'push')
  }

  return (
    <div className={s.central}>
      <Masthead me={me} />
      <TabBar tab={tab} onSelect={select} counts={{ moderacion: openReports, acceso: pendingWait }} />
      <div role="tabpanel" id="central-panel" aria-labelledby={`central-tab-${tab}`} className={s.panel} key={tab}>
        {tab === 'resumen' ? <Resumen /> : null}
        {tab === 'contenido' ? <Contenido me={me} /> : null}
        {tab === 'eventos' ? <Eventos me={me} flyers={flyers} /> : null}
        {tab === 'franjas' ? <Franjas me={me} logos={logos} /> : null}
        {tab === 'usuarios' ? <Usuarios me={me} /> : null}
        {tab === 'acceso' ? <Acceso /> : null}
        {tab === 'moderacion' ? <Moderacion me={me} /> : null}
      </div>
    </div>
  )
}

function TabBar({ tab, onSelect, counts }: { tab: Tab; onSelect: (t: Tab) => void; counts: Partial<Record<Tab, number>> }) {
  const refs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({})
  const latch = useRef<HTMLSpanElement>(null)
  const [armed, setArmed] = useState(false)

  useLayoutEffect(() => {
    const place = () => {
      const el = refs.current[tab]
      const l = latch.current
      if (!el || !l) return
      l.style.width = `${el.offsetWidth}px`
      l.style.transform = `translateX(${el.offsetLeft}px)`
    }
    place()
    // Let the first placement land without a slide; slide only between tabs.
    const id = requestAnimationFrame(() => setArmed(true))
    window.addEventListener('resize', place)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('resize', place)
    }
  }, [tab])

  useEffect(() => {
    refs.current[tab]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [tab])

  return (
    <div className={s.tabsWrap}>
      <div className={s.tabs} role="tablist" aria-label="Espacios de Central">
        {TABS.map((t, i) => {
          const on = t === tab
          const n = counts[t]
          return (
            <button
              key={t}
              ref={(el) => {
                refs.current[t] = el
              }}
              id={`central-tab-${t}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls="central-panel"
              tabIndex={on ? 0 : -1}
              className={s.tab}
              data-on={on || undefined}
              onClick={() => onSelect(t)}
              onKeyDown={(e) => {
                let next = -1
                if (e.key === 'ArrowRight') next = (i + 1) % TABS.length
                else if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length
                else if (e.key === 'Home') next = 0
                else if (e.key === 'End') next = TABS.length - 1
                if (next < 0) return
                e.preventDefault()
                onSelect(TABS[next])
                refs.current[TABS[next]]?.focus()
              }}
            >
              {TAB_LABEL[t]}
              {n ? (
                <span className={s.tabCount} aria-label={t === 'moderacion' ? `${n} reportes abiertos` : `${n} en espera`}>
                  {n}
                </span>
              ) : null}
            </button>
          )
        })}
        <span ref={latch} className={s.latch} data-armed={armed || undefined} aria-hidden="true" />
      </div>
    </div>
  )
}
