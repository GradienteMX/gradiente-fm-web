'use client'

/**
 * MODERACIÓN — the reports queue. Worked from the front: oldest first.
 * Two outcomes, both kept, both requiring a line of text — «resuelto» says
 * what was done, «descartado» says why nothing was. Nothing is ever deleted
 * automatically, and a report outlives what it points at: an object that no
 * longer resolves is shown as such, never dropped from the record.
 */

import { useMemo, useState, type MouseEvent } from 'react'
import type { ReportRow } from '@/lib/store/world-core'
import type { ContentItem, User } from '@/lib/types'
import { useDispatch, useWorld } from '@/lib/store/world'
import { useUI } from '@/lib/store/ui'
import { Button } from '@/components/kit/Button'
import { FormatGlyph, Mark } from '@/components/kit/Glyph'
import { UserChip } from '@/components/kit/Persona'
import { stamp } from './data'
import { centralHref, useQuery } from './query'
import { Empty, Note, Pane, SubTabs, Thumb, cx, mutedClass, tableClass, tableWrapClass, tagClass, textareaClass } from './kit'
import s from './Moderacion.module.css'

type Cola = ReportRow['status']
const COLAS: Cola[] = ['abierto', 'resuelto', 'descartado']
const COLA_LABEL: Record<Cola, string> = { abierto: 'Abiertos', resuelto: 'Resueltos', descartado: 'Descartados' }

const REASON: Record<ReportRow['reason'], string> = {
  spam: 'Spam',
  acoso: 'Acoso',
  odio: 'Odio',
  sexual: 'Sexual',
  violencia: 'Violencia',
  enganoso: 'Engañoso',
  copyright: 'Copyright',
  otro: 'Otro',
}

const TARGET: Record<ReportRow['targetType'], string> = {
  item: 'Pieza',
  comment: 'Comentario',
  foro_thread: 'Hilo del foro',
  foro_reply: 'Respuesta del foro',
  listing: 'Anuncio',
}

export function Moderacion({ me }: { me: User }) {
  const { get, set } = useQuery()
  const cola: Cola = (COLAS as string[]).includes(get('cola') ?? '') ? (get('cola') as Cola) : 'abierto'
  const reports = useWorld((st) => st.world.reports)
  const usersMap = useWorld((st) => st.world.users)
  const dispatch = useDispatch()
  const notify = useUI((st) => st.notify)
  const [form, setForm] = useState<{ id: string; status: 'resuelto' | 'descartado' } | null>(null)
  const [text, setText] = useState('')

  const counts = useMemo(() => {
    const c: Record<Cola, number> = { abierto: 0, resuelto: 0, descartado: 0 }
    for (const r of reports) c[r.status]++
    return c
  }, [reports])

  // When each report was closed (reports.resolved_at; a close made here stamps it at once).
  const closedAt = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of reports) if (r.resolvedAt) m.set(r.id, r.resolvedAt)
    return m
  }, [reports])

  const list = useMemo(() => {
    const l = reports.filter((r) => r.status === cola)
    return cola === 'abierto' ? l.sort((a, b) => Date.parse(a.at) - Date.parse(b.at)) : l.sort((a, b) => Date.parse(closedAt.get(b.id) ?? b.at) - Date.parse(closedAt.get(a.id) ?? a.at))
  }, [reports, cola, closedAt])

  const moderators = useMemo(() => Object.values(usersMap).filter((u) => u.isMod || u.role === 'admin'), [usersMap])

  const close = () => {
    if (!form) return
    const resolution = text.trim()
    if (resolution.length < 3) return
    dispatch({ t: 'report-resolve', id: form.id, status: form.status, resolution, at: new Date().toISOString() })
    notify(form.status === 'resuelto' ? 'Reporte resuelto: queda en el registro' : 'Reporte descartado: queda en el registro')
    setForm(null)
    setText('')
  }

  return (
    <div className={s.moderacion}>
      <div className={s.head}>
        <SubTabs
          label="Colas de reportes"
          value={cola}
          onChange={(v) => {
            setForm(null)
            set({ cola: v === 'abierto' ? null : v })
          }}
          options={COLAS.map((c) => ({ value: c, label: COLA_LABEL[c], count: counts[c] }))}
        />
        <p className={s.lede}>Nada se borra solo. Cerrar un reporte no retira nada: se actúa sobre el objeto y aquí se deja constancia.</p>
      </div>

      <Pane n="01" title="Reportes" note={cola === 'abierto' ? 'el más antiguo primero' : 'el más reciente primero'} flush>
        {list.length ? (
          <div className={tableWrapClass}>
            <table className={cx(tableClass, s.table)}>
              <caption className="sr-only">Reportes {COLA_LABEL[cola].toLowerCase()}</caption>
              <thead>
                <tr>
                  <th scope="col">Llegó</th>
                  <th scope="col">Objeto</th>
                  <th scope="col">Motivo</th>
                  <th scope="col">Reportó</th>
                  <th scope="col">{cola === 'abierto' ? <span className="sr-only">Acciones</span> : 'Cierre'}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const armed = form?.id === r.id ? form.status : null
                  const reporter = usersMap[r.reporterId]
                  return (
                    <ReportLine
                      key={r.id}
                      r={r}
                      reporter={reporter}
                      armed={armed}
                      closedAt={closedAt.get(r.id)}
                      onArm={(status) => {
                        setForm({ id: r.id, status })
                        setText('')
                      }}
                      text={text}
                      onText={setText}
                      onCancel={() => setForm(null)}
                      onConfirm={close}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>
            {cola === 'abierto'
              ? 'Ningún reporte abierto. Una cola vacía dice que nadie ha reportado nada — no mide la salud de la comunidad.'
              : `Ningún reporte ${cola}.`}
          </Empty>
        )}
      </Pane>

      <Pane n="02" title="Quién modera" note="MOD es una bandera; admin la trae implícita" flush>
        <ul className={s.mods}>
          {moderators.map((u) => (
            <li key={u.id} className={s.mod}>
              <UserChip user={u} size={26} />
              <span className={mutedClass}>{u.role === 'admin' ? (u.isMod ? 'admin · MOD' : 'admin (MOD implícito)') : 'MOD'}</span>
              {u.id === me.id ? <span className={s.you}>tú</span> : null}
              <Button size="sm" variant="quiet" href={centralHref({ tab: 'usuarios', u: u.id })} iconRight={<Mark name="arrow" size={12} />}>
                Editar
              </Button>
            </li>
          ))}
        </ul>
      </Pane>
      <Note>Quién puede moderar se decide en Usuarios (la bandera MOD o el rol admin). Esta pantalla no lo edita: un mismo permiso en dos lugares acabaría diciendo dos cosas.</Note>
    </div>
  )
}

// ── one report ──────────────────────────────────────────────────────────────

function ReportLine({
  r,
  reporter,
  armed,
  closedAt,
  onArm,
  text,
  onText,
  onCancel,
  onConfirm,
}: {
  r: ReportRow
  reporter?: User
  armed: 'resuelto' | 'descartado' | null
  closedAt?: string
  onArm: (s: 'resuelto' | 'descartado') => void
  text: string
  onText: (v: string) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const t = useTarget(r)
  const { set } = useQuery()
  const open = r.status === 'abierto'
  const follow = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!t.inPlace || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
    e.preventDefault()
    set(t.inPlace, 'push')
  }
  return (
    <>
      <tr className={s.row} data-armed={armed || undefined}>
        <td className={cx(mutedClass, s.nowrap)}>{stamp(Date.parse(r.at))}</td>
        <th scope="row" className={s.target}>
          <span className={s.targetKind}>
            <span className={tagClass}>{TARGET[r.targetType]}</span>
            {t.missing ? (
              <span className={tagClass} data-dashed>
                Ya no está
              </span>
            ) : null}
          </span>
          {t.href ? (
            <a href={t.href} className={s.targetLink} onClick={follow}>
              {t.item ? <Thumb item={t.item} size={30} /> : t.glyph ? <FormatGlyph type="franja" size={14} /> : null}
              <span className={s.targetText}>
                <span className={s.targetTitle}>{t.title}</span>
                {t.excerpt ? <span className={s.excerpt}>«{t.excerpt}»</span> : null}
              </span>
              <Mark name="arrow" size={12} />
            </a>
          ) : (
            <span className={s.targetText}>
              <span className={s.targetTitle}>{t.title}</span>
              <span className={s.excerpt}>{r.targetId}</span>
            </span>
          )}
        </th>
        <td>
          <span className={s.reason}>{REASON[r.reason] ?? r.reason}</span>
          {r.note ? <span className={s.note}>«{r.note}»</span> : null}
        </td>
        <td>{reporter ? <UserChip user={reporter} size={22} /> : <span className={mutedClass}>{r.reporterId}</span>}</td>
        <td className={s.actionsCell}>
          {open ? (
            <span className={s.actions}>
              <Button size="sm" variant={armed === 'resuelto' ? 'ink' : 'ghost'} onClick={() => onArm('resuelto')} aria-expanded={armed === 'resuelto'}>
                Resolver
              </Button>
              <Button size="sm" variant={armed === 'descartado' ? 'ink' : 'ghost'} onClick={() => onArm('descartado')} aria-expanded={armed === 'descartado'}>
                Descartar
              </Button>
            </span>
          ) : (
            <span className={s.closure}>
              <span className={cx(tagClass)} data-strong={r.status === 'resuelto' || undefined}>
                {r.status === 'resuelto' ? 'Resuelto' : 'Descartado'}
              </span>
              {closedAt ? <span className={mutedClass}> {stamp(Date.parse(closedAt))}</span> : null}
              {r.resolution ? <span className={s.resolution}>{r.resolution}</span> : null}
            </span>
          )}
        </td>
      </tr>
      {armed ? (
        <tr className={s.formRow}>
          <td colSpan={5}>
            <form
              className={s.form}
              onSubmit={(e) => {
                e.preventDefault()
                onConfirm()
              }}
            >
              <label className={s.formLabel} htmlFor={`res-${r.id}`}>
                {armed === 'resuelto' ? 'Resolver — qué se hizo' : 'Descartar — por qué no procedía'}
                <span className={s.counter}>{text.trim().length}/1000</span>
              </label>
              <textarea
                id={`res-${r.id}`}
                className={textareaClass}
                rows={2}
                maxLength={1000}
                value={text}
                autoFocus
                onChange={(e) => onText(e.target.value)}
                placeholder={armed === 'resuelto' ? 'Retiré el comentario y dejé la razón en su lápida.' : 'Es una crítica dura, no acoso: se queda.'}
              />
              <div className={s.formActions}>
                <Button type="submit" variant="ink" size="sm" disabled={text.trim().length < 3}>
                  {armed === 'resuelto' ? 'Confirmar resuelto' : 'Confirmar descartado'}
                </Button>
                <Button variant="quiet" size="sm" onClick={onCancel}>
                  Cancelar
                </Button>
                <span className={s.hint}>Mínimo 3 caracteres. Queda en el registro permanente del reporte: es lo que leerá la próxima persona.</span>
              </div>
            </form>
          </td>
        </tr>
      ) : null}
    </>
  )
}

// ── what a report points at ─────────────────────────────────────────────────

interface Target {
  title: string
  excerpt?: string
  href: string | null
  /** Query patch to open it over Central (Lectura) instead of navigating. */
  inPlace?: Record<string, string | null>
  item?: ContentItem
  glyph?: boolean
  missing: boolean
}

const clip = (t: string, n = 110) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t)

function useTarget(r: ReportRow): Target {
  const items = useWorld((st) => st.world.items)
  const comments = useWorld((st) => st.world.comments)
  const threads = useWorld((st) => st.world.threads)
  const replies = useWorld((st) => st.world.replies)
  const { params } = useQuery()
  const here = (patch: Record<string, string | null>) => {
    const sp = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(patch)) if (v === null) sp.delete(k)
    else sp.set(k, v)
    return `/central?${sp.toString()}`
  }
  switch (r.targetType) {
    case 'item': {
      const it = items[r.targetId]
      if (!it) return { title: 'Pieza eliminada o no encontrada', href: null, missing: true }
      if (it.type === 'franja') return { title: it.title, href: `/f/${it.slug}`, item: it, missing: false }
      const patch = { item: it.slug, inspeccion: '1', hilo: null, comentario: null }
      return { title: it.title, href: here(patch), inPlace: patch, item: it, missing: false }
    }
    case 'comment': {
      const c = comments[r.targetId]
      if (!c) return { title: 'Comentario no encontrado', href: null, missing: true }
      const it = items[c.contentItemId]
      const excerpt = c.deletion ? `retirado: ${c.deletion.reason}` : clip(c.body)
      if (!it) return { title: 'Comentario en una pieza eliminada', excerpt, href: null, missing: true }
      const patch = { item: it.slug, hilo: '1', comentario: c.id, inspeccion: '1' }
      return { title: `en «${it.title}»`, excerpt, href: here(patch), inPlace: patch, item: it, missing: false }
    }
    case 'foro_thread': {
      const t = threads[r.targetId]
      if (!t) return { title: 'Hilo no encontrado', href: null, missing: true }
      return { title: t.subject, excerpt: t.deletion ? `retirado: ${t.deletion.reason}` : clip(t.body), href: `/foro?hilo=${encodeURIComponent(t.id)}`, missing: false }
    }
    case 'foro_reply': {
      const rp = replies[r.targetId]
      if (!rp) return { title: 'Respuesta no encontrada', href: null, missing: true }
      const t = threads[rp.threadId]
      return {
        title: t ? `en «${t.subject}»` : 'en un hilo que ya no está',
        excerpt: rp.deletion ? `retirada: ${rp.deletion.reason}` : clip(rp.body),
        href: t ? `/foro?hilo=${encodeURIComponent(t.id)}` : null,
        missing: !t,
      }
    }
    case 'listing': {
      for (const f of Object.values(items)) {
        const l = f.marketplaceListings?.find((x) => x.id === r.targetId)
        if (l) return { title: l.title, excerpt: `en la tienda de ${f.title}`, href: `/mercado?franja=${encodeURIComponent(f.slug)}&pieza=${encodeURIComponent(l.id)}`, glyph: true, missing: false }
      }
      return { title: 'Anuncio no encontrado', href: null, missing: true }
    }
  }
}

