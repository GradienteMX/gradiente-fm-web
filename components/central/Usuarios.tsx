'use client'

/**
 * USUARIOS — roles, flags, franja teams. Labels go on people, never weights
 * on content: this is where they are set. A person's presence (their private
 * HL) is not shown here either and cannot be touched — it is earned, and it
 * gates trophies; injecting it would manufacture status.
 */

import { useMemo, useState } from 'react'
import type { Role, User } from '@/lib/types'
import { useDispatch, useWorld } from '@/lib/store/world'
import { useUI } from '@/lib/store/ui'
import { useRank } from '@/lib/store/session'
import { Chip } from '@/components/kit/Bits'
import { Button } from '@/components/kit/Button'
import { Avatar, Badge, Flags, ROLE_LABEL, ROLE_MEANING } from '@/components/kit/Persona'
import { Mark } from '@/components/kit/Glyph'
import { fmt } from '@/lib/logic/time'
import { int, matches } from './data'
import { useQuery } from './query'
import { Empty, Field, Note, Pane, Toggle, cx, inputClass, selectClass } from './kit'
import s from './Usuarios.module.css'

const ROLES: Role[] = ['user', 'curator', 'guide', 'insider', 'admin']
type RolFilter = Role | 'mod'

function elevated(u: User) {
  return u.role !== 'user' || u.isMod || u.isOG || Boolean(u.franjaId)
}

export function Usuarios({ me }: { me: User }) {
  const { get, set } = useQuery()
  const rawRol = get('rol')
  const rol: RolFilter | null = rawRol === 'mod' || (ROLES as string[]).includes(rawRol ?? '') ? (rawRol as RolFilter) : null
  const q = get('q') ?? ''
  const selId = get('u')

  const usersMap = useWorld((st) => st.world.users)
  const items = useWorld((st) => st.world.items)
  const users = useMemo(() => Object.values(usersMap).sort((a, b) => Date.parse(b.joinedAt) - Date.parse(a.joinedAt)), [usersMap])
  const franjas = useMemo(
    () => Object.values(items).filter((i) => i.type === 'franja').sort((a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base' })),
    [items],
  )

  const counts = useMemo(() => {
    const c: Record<RolFilter, number> = { user: 0, curator: 0, guide: 0, insider: 0, admin: 0, mod: 0 }
    for (const u of users) {
      c[u.role]++
      if (u.isMod) c.mod++
    }
    return c
  }, [users])

  const searching = q.trim().length >= 2
  const results = searching ? users.filter((u) => matches(u.username, q.trim().replace(/^@/, '')) || matches(u.displayName, q.trim())) : null
  const filtered = rol ? users.filter((u) => (rol === 'mod' ? u.isMod : u.role === rol)) : null
  const recent = users.filter((u) => !elevated(u)).slice(0, 25)
  const elev = users.filter(elevated)
  const selected = selId ? usersMap[selId] ?? null : null

  const pick = (id: string) => set({ u: id === selId ? null : id })

  return (
    <div className={s.usuarios}>
      <div className={s.cols}>
        <Pane n="01" title="Personas" note={`${int(users.length)} registradas en este mundo`} flush>
          <div className={s.tools}>
            <div className={s.chips} role="group" aria-label="Filtrar por rol">
              <Chip on={!rol} onClick={() => set({ rol: null })}>
                Todos <span className={s.n}>{users.length}</span>
              </Chip>
              {ROLES.map((r) => (
                <Chip key={r} on={rol === r} onClick={() => set({ rol: rol === r ? null : r })}>
                  {ROLE_LABEL[r]} <span className={s.n}>{counts[r]}</span>
                </Chip>
              ))}
              <Chip on={rol === 'mod'} onClick={() => set({ rol: rol === 'mod' ? null : 'mod' })} title="Moderación: una bandera, no un rol">
                MOD <span className={s.n}>{counts.mod}</span>
              </Chip>
            </div>
            <label className={s.search}>
              <span className="sr-only">Buscar por usuario</span>
              <span className={s.at} aria-hidden="true">
                @
              </span>
              <input className={cx(inputClass, s.searchInput)} type="search" defaultValue={q} onChange={(e) => set({ q: e.target.value || null })} placeholder="usuario o nombre (mínimo 2 caracteres)" />
            </label>
            {q.trim().length === 1 ? <p className={s.hint}>Escribe al menos 2 caracteres.</p> : null}
            {searching && rol ? <p className={s.hint}>La búsqueda ignora el filtro de rol.</p> : null}
          </div>

          {results ? (
            <Section title={`${results.length} ${results.length === 1 ? 'resultado' : 'resultados'} para «${q.trim()}»`} users={results} sel={selId} onPick={pick} empty="Nadie con ese usuario o nombre." />
          ) : filtered ? (
            <Section title={`${filtered.length} con ${rol === 'mod' ? 'la bandera MOD' : `rol ${ROLE_LABEL[rol as Role].toLowerCase()}`}`} users={filtered} sel={selId} onPick={pick} empty="Nadie tiene ese rol." />
          ) : (
            <>
              <Section title={`Recientes · ${recent.length}`} hint="los registros más nuevos sin permisos elevados" users={recent} sel={selId} onPick={pick} empty="Todas las personas registradas tienen algún permiso." />
              <Section title={`Elevados · ${elev.length}`} hint="rol distinto de lector, MOD, OG o equipo de franja" users={elev} sel={selId} onPick={pick} empty="Nadie." />
            </>
          )}
        </Pane>

        <div className={s.side}>
          {selected ? (
            <Editor key={selected.id + JSON.stringify([selected.role, selected.isMod, selected.isOG, selected.franjaId, selected.franjaAdmin])} user={selected} me={me} franjas={franjas} onClose={() => set({ u: null })} />
          ) : (
            <div className={s.placeholder}>
              <p className={s.placeholderTitle}>Elige a una persona para editar su rol y sus banderas.</p>
              <p className={s.placeholderText}>
                El rol abre formatos; MOD permite retirar comentarios e hilos dejando la razón; OG es solo una marca de la primera ola.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, hint, users, sel, onPick, empty }: { title: string; hint?: string; users: User[]; sel: string | null; onPick: (id: string) => void; empty: string }) {
  return (
    <section className={s.section}>
      <h3 className={s.sectionTitle}>
        {title}
        {hint ? <span className={s.sectionHint}> — {hint}</span> : null}
      </h3>
      {users.length ? (
        <ul className={s.list}>
          {users.map((u) => (
            <Row key={u.id} user={u} on={u.id === sel} onPick={() => onPick(u.id)} />
          ))}
        </ul>
      ) : (
        <Empty>{empty}</Empty>
      )}
    </section>
  )
}

function Row({ user, on, onPick }: { user: User; on: boolean; onPick: () => void }) {
  const rank = useRank(user.id)
  const franja = useWorld((st) => (user.franjaId ? st.world.items[user.franjaId]?.title ?? user.franjaId : null))
  return (
    <li>
      <button type="button" className={s.row} data-on={on || undefined} aria-pressed={on} onClick={onPick}>
        <Avatar user={user} size={32} rank={rank} />
        <span className={s.rowText}>
          <span className={s.handle}>@{user.username}</span>
          <span className={s.name}>
            {user.displayName}
            {franja ? ` · ${user.franjaAdmin ? '★ ' : ''}${franja}` : ''}
          </span>
        </span>
        <span className={s.rowBadges}>
          <Badge user={user} rank={rank} />
          <Flags user={user} />
        </span>
        <span className={s.joined}>{fmt.short(user.joinedAt)}</span>
      </button>
    </li>
  )
}

function Editor({ user, me, franjas, onClose }: { user: User; me: User; franjas: Array<{ id: string; title: string }>; onClose: () => void }) {
  const dispatch = useDispatch()
  const ask = useUI((st) => st.ask)
  const notify = useUI((st) => st.notify)
  const rank = useRank(user.id)
  const published = useWorld((st) => {
    let n = 0
    for (const it of Object.values(st.world.items)) if (it.createdById === user.id && it.type !== 'franja') n++
    return n
  })
  const comments = useWorld((st) => {
    let n = 0
    for (const c of Object.values(st.world.comments)) if (c.authorId === user.id && !c.deletion) n++
    return n
  })
  const [role, setRole] = useState<Role>(user.role)
  const [isMod, setMod] = useState(Boolean(user.isMod))
  const [isOG, setOG] = useState(Boolean(user.isOG))
  const [franjaId, setFranja] = useState(user.franjaId ?? '')
  const [franjaAdmin, setFranjaAdmin] = useState(Boolean(user.franjaAdmin))

  const self = user.id === me.id
  const demotesSelf = self && user.role === 'admin' && role !== 'admin'
  const dirty = role !== user.role || isMod !== Boolean(user.isMod) || isOG !== Boolean(user.isOG) || franjaId !== (user.franjaId ?? '') || franjaAdmin !== Boolean(user.franjaAdmin)

  const save = async () => {
    if (!dirty) return
    if (demotesSelf) {
      const ok = await ask({
        title: 'Te vas a quitar el rol de admin',
        body: `Pasarás a ${ROLE_LABEL[role].toLowerCase()}. En cuanto guardes pierdes el acceso a Central, y solo otra persona admin puede devolvértelo.`,
        confirmLabel: 'Quitarme el rol',
        destructive: true,
      })
      if (ok !== true) return
    } else if (role === 'admin' && user.role !== 'admin') {
      const ok = await ask({
        title: `Dar el rol de admin a @${user.username}`,
        body: 'Podrá ver todos los números de Central, ajustar la HL de cualquier pieza, borrar contenido y asignar roles — incluido quitarte el tuyo.',
        confirmLabel: 'Hacer admin',
      })
      if (ok !== true) return
    }
    dispatch({
      t: 'user-admin',
      userId: user.id,
      patch: { role, isMod, isOG, franjaId: franjaId || undefined, franjaAdmin: franjaId ? franjaAdmin : false },
      at: new Date().toISOString(),
    })
    notify(`@${user.username}: permisos guardados`)
  }

  return (
    <Pane
      n="02"
      title={`@${user.username}`}
      note={`se unió ${fmt.long(user.joinedAt)}`}
      actions={
        <button type="button" className={s.close} onClick={onClose} aria-label="Cerrar el editor">
          <Mark name="close" size={15} />
        </button>
      }
    >
      <div className={s.editor}>
        <div className={s.identity}>
          <Avatar user={user} size={56} rank={rank} />
          <div className={s.identityText}>
            <span className={s.display}>{user.displayName}</span>
            <span className={s.meta}>
              @{user.username} · {user.id}
            </span>
            <span className={s.badges}>
              <Badge user={user} rank={rank} />
              <Flags user={user} />
              {self ? <span className={s.you}>tú</span> : null}
            </span>
            <span className={s.meta}>
              {int(published)} {published === 1 ? 'pieza publicada' : 'piezas publicadas'} · {int(comments)} {comments === 1 ? 'comentario' : 'comentarios'}
            </span>
          </div>
        </div>

        <fieldset className={s.fieldset}>
          <legend className={s.legend}>Rol</legend>
          <div className={s.roles} role="radiogroup" aria-label="Rol">
            {ROLES.map((r) => (
              <button key={r} type="button" role="radio" aria-checked={role === r} className={s.roleBtn} data-on={role === r || undefined} onClick={() => setRole(r)}>
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>
          <p className={s.meaning}>{ROLE_MEANING[role]}</p>
          {role === 'guide' || role === 'insider' ? <p className={s.hint}>Guía e insider son hermanos: mismos derechos, distinta firma (la casa · la escena).</p> : null}
        </fieldset>

        <fieldset className={s.fieldset}>
          <legend className={s.legend}>Banderas</legend>
          <Toggle
            checked={isMod || role === 'admin'}
            disabled={role === 'admin'}
            onChange={setMod}
            label="MOD"
            hint={role === 'admin' ? 'Implícita en admin.' : 'Retira comentarios e hilos dejando una lápida con la razón. Trabaja la cola de reportes. Independiente del rol.'}
          />
          <Toggle checked={isOG} onChange={setOG} label="OG" hint="Marca de la primera ola. Cosmética: no abre nada." />
        </fieldset>

        <fieldset className={s.fieldset}>
          <legend className={s.legend}>Equipo de franja</legend>
          <Field label="Pertenece a" htmlFor={`uf-${user.id}`} hint="Un equipo publica a nombre de su franja y lleva su tienda.">
            <select
              id={`uf-${user.id}`}
              className={selectClass}
              value={franjaId}
              onChange={(e) => {
                setFranja(e.target.value)
                if (!e.target.value) setFranjaAdmin(false)
              }}
            >
              <option value="">— ninguna —</option>
              {franjas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </select>
          </Field>
          <Toggle checked={franjaAdmin} disabled={!franjaId} onChange={setFranjaAdmin} label="Admin de su franja" hint="Agrega y quita miembros de su propio equipo. No toca otras franjas." />
        </fieldset>

        {demotesSelf ? (
          <p className={s.warn} role="alert">
            Te estás quitando el rol de admin. Al guardar pierdes el acceso a Central; te lo pediremos confirmar.
          </p>
        ) : null}

        <div className={s.actions}>
          <Button variant="ink" disabled={!dirty} onClick={save}>
            Guardar permisos
          </Button>
          {dirty ? (
            <Button
              variant="quiet"
              onClick={() => {
                setRole(user.role)
                setMod(Boolean(user.isMod))
                setOG(Boolean(user.isOG))
                setFranja(user.franjaId ?? '')
                setFranjaAdmin(Boolean(user.franjaAdmin))
              }}
            >
              Descartar
            </Button>
          ) : (
            <span className={s.hint}>Sin cambios.</span>
          )}
        </div>
        <Note>Su presencia (la HL de las personas) es privada también aquí: Central no la muestra ni la puede ajustar.</Note>
      </div>
    </Pane>
  )
}
