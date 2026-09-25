'use client'

/**
 * /taller/mesa — resolves what's on the table.
 *
 *   ?tipo=<formato>        a new piece of that format (&franja=1: as your franja)
 *   ?draft=<id>            resume one of your drafts
 *   ?editar=<itemId>       edit a published piece (through a draft that
 *                          remembers `publishedId`; resumes an open one)
 *   (nothing)              the format picker
 *
 * The session and the world (drafts included) arrive with the page, so the
 * table resolves on the first render; nobody is told «no encontrado» about a
 * draft that simply hasn't loaded.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import type { ContentItem, ContentType, Draft, User } from '@/lib/types'
import type { World } from '@/lib/store/world-core'
import { useWorld, useWorldStore } from '@/lib/store/world'
import { perm, useMe } from '@/lib/store/session'
import { useUI } from '@/lib/store/ui'
import { Button } from '@/components/kit/Button'
import { Mark } from '@/components/kit/Glyph'
import { useSessionReady } from './hooks'
import { emptyItem, franjaByDefault, isFormato } from './model'
import { Composer } from './Composer'
import { Picker, SinVoz } from './Picker'
import s from './Mesa.module.css'

type Resolution =
  | { kind: 'picker'; franja: boolean }
  | { kind: 'sin-voz'; type: ContentType }
  | { kind: 'no-encontrado'; what: 'borrador' | 'pieza' }
  | { kind: 'ajeno'; what: 'borrador' | 'pieza' }
  | { kind: 'mesa'; draft: Draft; persisted: boolean; existing: ContentItem | null }

/**
 * A new piece's id — its draft's key and, once published, its row's id
 * (items.id is text; the route keeps it and refuses to overwrite an existing
 * one). Production's composer format: `local-<type>-<ms>-<6 base36>`.
 */
function freshId(type: string, w: World): string {
  const mint = () => `local-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8).padEnd(6, '0')}`
  let id = mint()
  while (w.items[id] || w.drafts[id]) id = mint()
  return id
}

function resolve(p: URLSearchParams, me: User, w: World): Resolution {
  const draftId = p.get('draft')
  const editar = p.get('editar')
  const tipo = p.get('tipo')
  const franja = p.get('franja') === '1'
  const nowIso = new Date().toISOString()

  if (draftId) {
    const d = w.drafts[draftId]
    if (!d) return { kind: 'no-encontrado', what: 'borrador' }
    if (d.authorId !== me.id) return { kind: 'ajeno', what: 'borrador' }
    const existing = d.publishedId ? w.items[d.publishedId] ?? null : null
    if (!existing && !perm.canCreateContent(me, d.type)) return { kind: 'sin-voz', type: d.type }
    return { kind: 'mesa', draft: d, persisted: true, existing }
  }

  if (editar) {
    const it = w.items[editar]
    if (!it || it.type === 'franja') return { kind: 'no-encontrado', what: 'pieza' }
    if (it.createdById !== me.id && me.role !== 'admin') return { kind: 'ajeno', what: 'pieza' }
    const open = Object.values(w.drafts).find((d) => d.publishedId === it.id && d.authorId === me.id)
    if (open) return { kind: 'mesa', draft: open, persisted: true, existing: it }
    const item: ContentItem = { ...structuredClone(it), vibeCheckCount: undefined, vibeCheckMedianMin: undefined, vibeCheckMedianMax: undefined }
    // A draft's id is its item's id — the key production's drafts are stored under.
    return {
      kind: 'mesa',
      draft: { id: it.id, type: it.type, authorId: me.id, item, publishedId: it.id, state: 'borrador', createdAt: nowIso, updatedAt: nowIso },
      persisted: false,
      existing: it,
    }
  }

  if (tipo && isFormato(tipo)) {
    if (!perm.canCreateContent(me, tipo)) return { kind: 'sin-voz', type: tipo }
    const asFranja = franjaByDefault(me, tipo, franja) && perm.FRANJA_PUBLISHABLE_TYPES.includes(tipo)
    const item = emptyItem(tipo, freshId(tipo, w), { me, nowIso, franja: asFranja })
    return {
      kind: 'mesa',
      draft: { id: item.id, type: tipo, authorId: me.id, item, state: 'borrador', createdAt: nowIso, updatedAt: nowIso },
      persisted: false,
      existing: null,
    }
  }

  return { kind: 'picker', franja }
}

export function Mesa({ flyers }: { flyers: string[] }) {
  const params = useSearchParams()
  const sessionReady = useSessionReady()
  const hydrated = useWorld((st) => st.hydrated)
  const me = useMe()
  const store = useWorldStore()
  const openAccess = useUI((st) => st.openAccess)
  const search = params.toString()
  const current = useRef<{ key: string; r: Resolution } | null>(null)
  const asked = useRef(false)
  const ready = sessionReady && hydrated

  // Resolve once per address, always from the live world. The one exception
  // is our own address change after a first save: same draft, same table.
  const resolution = useMemo<Resolution | 'fuera' | null>(() => {
    if (!ready) return null
    if (!me) return 'fuera'
    const key = `${me.id}|${search}`
    if (current.current?.key === key) return current.current.r
    const p = new URLSearchParams(search)
    const cur = current.current?.r
    if (cur?.kind === 'mesa' && p.get('draft') === cur.draft.id) {
      current.current = { key, r: cur }
      return cur
    }
    const r = resolve(p, me, store.getState().world)
    current.current = { key, r }
    return r
  }, [ready, me, search, store])

  useEffect(() => {
    if (resolution === 'fuera' && !asked.current) {
      asked.current = true
      openAccess('Escribe en la mesa')
    }
  }, [resolution, openAccess])

  // A new draft's first save gives it an address: a reload resumes it.
  const onFirstSave = useCallback(
    (draftId: string) => {
      if (!resolution || resolution === 'fuera' || resolution.kind !== 'mesa' || resolution.existing) return
      window.history.replaceState(null, '', `/taller/mesa?draft=${draftId}`)
    },
    [resolution],
  )

  if (!resolution) {
    return (
      <div className={s.quiet} aria-busy="true">
        <div className={s.quietBox}>
          <span className={s.breath}>La mesa · preparando</span>
        </div>
      </div>
    )
  }

  if (resolution === 'fuera') {
    return (
      <Quiet title="La mesa está lista." body="Para escribir en el campo necesitas una identidad. Nada de lo que publiques aquí sale sin tu firma.">
        <Button variant="ink" size="lg" onClick={() => openAccess('Escribe en la mesa')}>
          Entrar
        </Button>
      </Quiet>
    )
  }

  switch (resolution.kind) {
    case 'picker':
      return <Picker me={me!} franja={resolution.franja} />
    case 'sin-voz':
      return (
        <div className={s.page}>
          <SinVoz me={me!} type={resolution.type} />
        </div>
      )
    case 'no-encontrado':
      return (
        <Quiet
          title={resolution.what === 'borrador' ? 'Ese borrador no está aquí.' : 'Esa pieza ya no está aquí.'}
          body={resolution.what === 'borrador' ? 'Pudo publicarse o descartarse. Tus otros borradores siguen en el taller.' : 'Pudo haberse borrado. El resto del campo sigue vivo.'}
        >
          <Button variant="ink" href="/taller/mesa" icon={<Mark name="plus" size={14} />}>
            Empezar otra pieza
          </Button>
          <Button variant="ghost" href="/taller">
            Volver al taller
          </Button>
        </Quiet>
      )
    case 'ajeno':
      return (
        <Quiet
          title={resolution.what === 'borrador' ? 'Ese borrador es de otra persona.' : 'Solo quien la publicó puede editarla.'}
          body="Las palabras de alguien más no se tocan. Si ves un error, coméntalo en su hilo o repórtalo."
        >
          <Button variant="ghost" href="/taller">
            Volver al taller
          </Button>
        </Quiet>
      )
    case 'mesa':
      return (
        <Composer
          key={resolution.draft.id}
          me={me!}
          draft={resolution.draft}
          persisted={resolution.persisted}
          existing={resolution.existing}
          flyers={flyers}
          onFirstSave={onFirstSave}
        />
      )
  }
}

function Quiet({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className={s.quiet}>
      <div className={s.quietBox}>
        <h1 className={s.quietTitle}>{title}</h1>
        <p className={s.quietBody}>{body}</p>
        {children ? <div className={s.actions}>{children}</div> : null}
      </div>
    </div>
  )
}
