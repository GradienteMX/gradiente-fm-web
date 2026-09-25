'use client'

/**
 * ACCESO — la puerta. Gradiente is invite-only: one code book, and a public
 * waitlist that feeds it. «Generar código» on a waitlist row mints a real
 * invitation in the same book and hands back the same /welcome?codigo= link
 * the generator does — there is no second way in.
 */

import { useMemo, useState } from 'react'
import type { Role } from '@/lib/types'
import type { InviteRow, WaitlistRow } from '@/lib/store/world-core'
import { useDispatch, useWorld } from '@/lib/store/world'
import { useUI } from '@/lib/store/ui'
import { Button } from '@/components/kit/Button'
import { Mark } from '@/components/kit/Glyph'
import { ROLE_LABEL, ROLE_MEANING } from '@/components/kit/Persona'
import { DAY, dateLong, dayLabel, int, issueLine, matches, stamp } from './data'
import { useClock } from './clock'
import { useQuery } from './query'
import { CopyButton, Empty, Field, Note, Pane, Step, SubTabs, Toggle, copyText, cx, inputClass, mutedClass, numClass, selectClass, tableClass, tableWrapClass, tagClass, useArm } from './kit'
import s from './Acceso.module.css'

const ROLES: Role[] = ['user', 'curator', 'guide', 'insider', 'admin']
const FOLIO_WAVE = 150

/**
 * An invitation code: production's shape (INV- + 16 hex, 64 random bits).
 * Minted here because the admin copies it the instant it's generated; the
 * route stores exactly this code (lib/store/efectos/acceso.ts).
 */
function newCode(existing: Set<string>): string {
  for (;;) {
    const b = new Uint8Array(8)
    crypto.getRandomValues(b)
    const code = `INV-${Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')}`
    if (!existing.has(code)) return code
  }
}

function nextFolio(invites: InviteRow[]): { n: number; folio: string } {
  const max = invites.reduce((m, i) => Math.max(m, parseInt(i.folio, 10) || 0), 0)
  return { n: max + 1, folio: `${String(max + 1).padStart(3, '0')}/${FOLIO_WAVE}` }
}

/**
 * The book keyed by code. A code is unique by construction; if the same row
 * ever arrives twice (a replayed log), it is still one invitation.
 */
function useInviteBook(): InviteRow[] {
  const invites = useWorld((st) => st.world.invites)
  return useMemo(() => {
    const seen = new Set<string>()
    return invites.filter((i) => (seen.has(i.code) ? false : (seen.add(i.code), true)))
  }, [invites])
}

const welcomeLink = (code: string) => `${window.location.origin}/welcome?codigo=${encodeURIComponent(code)}`

export function Acceso() {
  const { get, set } = useQuery()
  const sub = get('sub') === 'espera' ? 'espera' : 'invitaciones'
  const invites = useInviteBook()
  const waitlist = useWorld((st) => st.world.waitlist)
  const pending = waitlist.filter((r) => r.status === 'espera').length
  return (
    <div className={s.acceso}>
      <div className={s.head}>
        <SubTabs
          label="Secciones de acceso"
          value={sub}
          onChange={(v) => set({ sub: v === 'invitaciones' ? null : v, q: null, estado: null })}
          options={[
            { value: 'invitaciones', label: 'Invitaciones', count: invites.length },
            { value: 'espera', label: 'Espera', count: pending },
          ]}
        />
        <p className={s.lede}>
          Se entra con un código. La lista de espera no crea cuentas: alimenta este mismo libro de códigos.
        </p>
      </div>
      {sub === 'invitaciones' ? <Invitaciones /> : <Espera />}
    </div>
  )
}

// ── invitaciones ────────────────────────────────────────────────────────────

function Invitaciones() {
  const { get, set } = useQuery()
  const q = get('q') ?? ''
  const dispatch = useDispatch()
  const notify = useUI((st) => st.notify)
  const { now } = useClock()
  const invites = useInviteBook()
  const users = useWorld((st) => st.world.users)
  const items = useWorld((st) => st.world.items)
  const franjas = useMemo(
    () => Object.values(items).filter((i) => i.type === 'franja').sort((a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base' })),
    [items],
  )

  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('user')
  const [isMod, setMod] = useState(false)
  const [franjaId, setFranja] = useState('')
  const [franjaAdmin, setFranjaAdmin] = useState(false)
  const [days, setDays] = useState('30')
  const [made, setMade] = useState<InviteRow | null>(null)

  const next = nextFolio(invites)
  const daysN = days.trim() === '' ? null : Math.floor(Number(days))
  const daysError = daysN !== null && (!Number.isFinite(daysN) || daysN < 1 || daysN > 365) ? 'Entre 1 y 365 días, o vacío para que no expire.' : null

  const generate = () => {
    if (daysError) return
    const at = new Date()
    const row: InviteRow = {
      code: newCode(new Set(invites.map((i) => i.code))),
      name: name.trim(),
      role,
      ...(isMod ? { isMod: true } : {}),
      ...(franjaId ? { franjaId, franjaAdmin } : {}),
      folio: next.folio,
      issued: issueLine(at.getTime()),
      createdAt: at.toISOString(),
      ...(daysN ? { expiresAt: new Date(at.getTime() + daysN * DAY).toISOString() } : {}),
    }
    dispatch({ t: 'invite', row, at: row.createdAt })
    setMade(row)
    setName('')
    notify(`Código ${row.code} emitido · folio ${row.folio}`, { tone: 'energy', energy: 5 })
  }

  const book = useMemo(
    () =>
      // Folio is the issue sequence (seed rows are re-stamped on every load,
      // so their createdAt says nothing about order).
      [...invites]
        .sort((a, b) => (parseInt(b.folio, 10) || 0) - (parseInt(a.folio, 10) || 0) || Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .filter((i) => !q || matches(i.code, q) || matches(i.name, q) || matches(i.folio, q)),
    [invites, q],
  )
  const state = (i: InviteRow) => (i.usedBy ? 'usado' : i.expiresAt && Date.parse(i.expiresAt) < now ? 'expirado' : 'activo')

  return (
    <div className={s.invCols}>
      <Pane n="01" title="Generar código" note={`siguiente folio ${next.folio}`}>
        <form
          className={s.gen}
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            generate()
          }}
        >
          <Step n="01" title="Destinatario">
            <Field label="Nombre en la credencial" htmlFor="inv-name" hint="Se imprime en su tarjeta. Vacío = sin nombre.">
              <input id="inv-name" className={inputClass} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Allan · Club Japan · DJ Támara" />
            </Field>
          </Step>
          <Step n="02" title="Permisos">
            <Field label="Rol" htmlFor="inv-role" hint={ROLE_MEANING[role]}>
              <select id="inv-role" className={selectClass} value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </Field>
            <Toggle checked={isMod} onChange={setMod} label="MOD" hint="Entra con la bandera de moderación." />
            <Field label="Franja" htmlFor="inv-franja" hint="Opcional: entra como parte de su equipo.">
              <select
                id="inv-franja"
                className={selectClass}
                value={franjaId}
                onChange={(e) => {
                  setFranja(e.target.value)
                  if (!e.target.value) setFranjaAdmin(false)
                }}
              >
                <option value="">— cuenta individual —</option>
                {franjas.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title}
                  </option>
                ))}
              </select>
            </Field>
            {franjaId ? <Toggle checked={franjaAdmin} onChange={setFranjaAdmin} label="Admin de su franja" hint="Podrá sumar y quitar miembros de su equipo." /> : null}
          </Step>
          <Step n="03" title="Vigencia">
            <Field label="Expira en (días)" htmlFor="inv-days" error={daysError} hint={daysN ? `Vence el ${dateLong(now + daysN * DAY)}.` : 'Sin fecha: no expira.'}>
              <input id="inv-days" className={cx(inputClass, s.days)} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/[^0-9]/g, ''))} />
            </Field>
          </Step>
          <div className={s.genActions}>
            <Button type="submit" variant="ink" disabled={Boolean(daysError)} icon={<Mark name="plus" size={14} />}>
              Generar código
            </Button>
            {next.n > FOLIO_WAVE ? <span className={s.warn}>El folio pasa de {FOLIO_WAVE}: la primera ola está completa.</span> : null}
          </div>
        </form>

        {made ? (
          <div className={s.made} role="status">
            <span className={s.madeLabel}>Código emitido · cópialo ahora</span>
            <span className={s.madeCode}>{made.code}</span>
            <span className={s.madeMeta}>
              folio {made.folio} · {ROLE_LABEL[made.role]}
              {made.name ? ` · para ${made.name}` : ''}
              {made.expiresAt ? ` · vence ${dayLabel(Date.parse(made.expiresAt))}` : ' · no expira'}
            </span>
            <span className={s.madeActions}>
              <CopyButton text={made.code} label="Copiar código" />
              <CopyButton text={welcomeLink(made.code)} label="Copiar enlace /welcome" />
            </span>
          </div>
        ) : null}
      </Pane>

      <Pane
        n="02"
        title="Libro de códigos"
        note={`${int(invites.length)} emitidos · ${int(invites.filter((i) => i.usedBy).length)} usados`}
        flush
        actions={
          <label className={s.bookSearch}>
            <span className="sr-only">Buscar en el libro</span>
            <input className={inputClass} type="search" defaultValue={q} onChange={(e) => set({ q: e.target.value.trim() || null })} placeholder="Código, nombre o folio" />
          </label>
        }
      >
        {book.length ? (
          <div className={tableWrapClass}>
            <table className={tableClass}>
              <caption className="sr-only">Libro de códigos de invitación, del más reciente al más antiguo</caption>
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col" className={numClass}>
                    Folio
                  </th>
                  <th scope="col">Nombre</th>
                  <th scope="col">Rol · banderas</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Vence</th>
                </tr>
              </thead>
              <tbody>
                {book.map((i) => {
                  const st = state(i)
                  const user = i.usedBy ? users[i.usedBy] : null
                  const franja = i.franjaId ? items[i.franjaId]?.title ?? i.franjaId : null
                  return (
                    <tr key={i.code}>
                      <th scope="row">
                        <span className={s.code}>{i.code}</span>
                        <span className={s.codeCopy}>
                          <CopyButton text={i.code} />
                          {st === 'activo' ? <CopyButton text={welcomeLink(i.code)} label="Enlace" /> : null}
                        </span>
                      </th>
                      <td className={cx(numClass, mutedClass)}>{i.folio}</td>
                      <td>{i.name || <span className={mutedClass}>—</span>}</td>
                      <td>
                        <span className={s.flags}>
                          <span className={tagClass} data-strong={i.role === 'admin' || undefined}>
                            {ROLE_LABEL[i.role]}
                          </span>
                          {i.isMod ? <span className={tagClass}>MOD</span> : null}
                          {franja ? (
                            <span className={tagClass} data-dashed>
                              {i.franjaAdmin ? '★ ' : ''}
                              {franja}
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td>
                        <span className={s.state} data-state={st}>
                          {st === 'usado' ? 'Usado' : st === 'expirado' ? 'Expirado' : 'Activo'}
                        </span>
                        {user ? (
                          <span className={s.usedBy}>
                            @{user.username}
                            {i.usedAt ? ` · ${dayLabel(Date.parse(i.usedAt))}` : ''}
                          </span>
                        ) : null}
                      </td>
                      <td className={mutedClass}>{i.expiresAt ? dayLabel(Date.parse(i.expiresAt)) : 'nunca'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>{q ? `Ningún código coincide con «${q}».` : 'Todavía no hay códigos.'}</Empty>
        )}
      </Pane>
    </div>
  )
}

// ── espera ──────────────────────────────────────────────────────────────────

type Derived = 'pendiente' | 'invitado' | 'registrado'
const DERIVED_LABEL: Record<Derived, string> = { pendiente: 'Pendiente', invitado: 'Invitado', registrado: 'Registrado' }

function linkedInvite(row: WaitlistRow, invites: InviteRow[]): InviteRow | null {
  let found: InviteRow | null = null
  for (const i of invites) if (i.name === row.alias && Date.parse(i.createdAt) >= Date.parse(row.at)) found = i
  return found
}

function Espera() {
  const { get, set } = useQuery()
  const q = get('q') ?? ''
  const rawEstado = get('estado')
  const estado: Derived | null = rawEstado === 'pendiente' || rawEstado === 'invitado' || rawEstado === 'registrado' ? rawEstado : null
  const dispatch = useDispatch()
  const notify = useUI((st) => st.notify)
  const waitlist = useWorld((st) => st.world.waitlist)
  const invites = useInviteBook()
  const { armed, arm } = useArm()

  const rows = useMemo(() => {
    const queue = [...waitlist].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    return queue.map((r, i) => {
      const inv = linkedInvite(r, invites)
      const d: Derived = r.status === 'registrado' || inv?.usedBy ? 'registrado' : r.status === 'invitado' ? 'invitado' : 'pendiente'
      return { r, pos: i + 1, inv, d }
    })
  }, [waitlist, invites])

  const counts = { total: rows.length, pendiente: 0, invitado: 0, registrado: 0 }
  for (const x of rows) counts[x.d]++
  const visible = rows.filter((x) => (!estado || x.d === estado) && (!q || matches(x.r.alias, q) || matches(x.r.email, q) || matches(x.r.city, q) || matches(x.r.source, q)))

  const generate = async (row: WaitlistRow) => {
    const at = new Date()
    const inv: InviteRow = {
      code: newCode(new Set(invites.map((i) => i.code))),
      name: row.alias,
      role: 'user',
      folio: nextFolio(invites).folio,
      issued: issueLine(at.getTime()),
      createdAt: at.toISOString(),
      expiresAt: new Date(at.getTime() + 30 * DAY).toISOString(),
    }
    dispatch({ t: 'invite', row: inv, at: inv.createdAt })
    dispatch({ t: 'waitlist-status', id: row.id, status: 'invitado', at: inv.createdAt })
    const ok = await copyText(welcomeLink(inv.code))
    notify(ok ? `Código ${inv.code} para ${row.alias}: enlace copiado` : `Código ${inv.code} emitido. Copia el enlace desde la fila.`, { tone: 'energy', energy: 5 })
  }

  return (
    <div className={s.espera}>
      <div className={s.stats} role="group" aria-label="Estado de la lista de espera">
        {(
          [
            ['total', 'Señales', counts.total],
            ['pendiente', 'Pendientes', counts.pendiente],
            ['invitado', 'Invitados', counts.invitado],
            ['registrado', 'Registrados', counts.registrado],
          ] as const
        ).map(([key, label, n]) => {
          const on = key === 'total' ? !estado : estado === key
          return (
            <button key={key} type="button" className={s.stat} data-on={on || undefined} aria-pressed={on} onClick={() => set({ estado: key === 'total' || on ? null : key })}>
              <span className={s.statN}>{int(n)}</span>
              <span className={s.statL}>{label}</span>
            </button>
          )
        })}
      </div>

      <Pane
        n="01"
        title="Lista de espera"
        note="en orden de llegada: la fila es su lugar"
        flush
        actions={
          <label className={s.bookSearch}>
            <span className="sr-only">Filtrar la lista</span>
            <input className={inputClass} type="search" defaultValue={q} onChange={(e) => set({ q: e.target.value.trim() || null })} placeholder="Alias, email, ciudad…" />
          </label>
        }
      >
        {visible.length ? (
          <div className={tableWrapClass}>
            <table className={tableClass}>
              <caption className="sr-only">Lista de espera en orden de llegada</caption>
              <thead>
                <tr>
                  <th scope="col" className={numClass}>
                    #
                  </th>
                  <th scope="col">Alias</th>
                  <th scope="col">Email</th>
                  <th scope="col">Ciudad</th>
                  <th scope="col">Origen</th>
                  <th scope="col">Llegó</th>
                  <th scope="col">Estado</th>
                  <th scope="col">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map(({ r, pos, inv, d }) => (
                  <tr key={r.id}>
                    <td className={cx(numClass, mutedClass)}>{String(pos).padStart(3, '0')}</td>
                    <th scope="row" className={s.alias}>
                      {r.alias || '—'}
                    </th>
                    <td className={s.email}>{r.email}</td>
                    <td>{r.city || <span className={mutedClass}>—</span>}</td>
                    <td className={mutedClass}>{r.source || '—'}</td>
                    <td className={cx(mutedClass, s.nowrap)}>{stamp(Date.parse(r.at))}</td>
                    <td>
                      <span className={s.state} data-state={d === 'pendiente' ? 'pendiente' : d === 'invitado' ? 'activo' : 'usado'}>
                        {DERIVED_LABEL[d]}
                      </span>
                      {inv ? <span className={s.usedBy}>{inv.code}</span> : null}
                    </td>
                    <td>
                      <span className={s.rowActions}>
                        {d === 'pendiente' ? (
                          <Button size="sm" variant="ink" onClick={() => generate(r)}>
                            Generar código
                          </Button>
                        ) : inv && d === 'invitado' ? (
                          <CopyButton text={welcomeLink(inv.code)} label="Copiar enlace" />
                        ) : null}
                        <button
                          type="button"
                          className={s.del}
                          data-armed={armed === r.id || undefined}
                          onClick={() => {
                            if (arm(r.id)) {
                              dispatch({ t: 'waitlist-delete', id: r.id, at: new Date().toISOString() })
                              notify(`${r.alias || r.email} sale de la lista`)
                            }
                          }}
                        >
                          {armed === r.id ? '¿Seguro? Borrar' : 'Borrar'}
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>{rows.length ? 'Nadie en la lista coincide con el filtro.' : 'Nadie en la lista de espera todavía. Las señales llegan desde /espera.'}</Empty>
        )}
      </Pane>
      <Note>
        «Generar código» emite una invitación de lector con vigencia de 30 días, marca la fila como invitada y copia el enlace
        /welcome?codigo=… para mandarlo por el canal que sea. «Registrado» se deriva del código canjeado. Borrar pide dos clics.
      </Note>
    </div>
  )
}
