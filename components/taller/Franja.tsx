'use client'

/**
 * FRANJA — the desk of a band on the dial, for its team. Who it is, what
 * it has published (and a door to publish in its name), who is on the
 * team (franja admins add, promote and retire), and its public profile.
 * Franjas never enter the mosaic; what they author does, attributed.
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { ContentItem, Draft, User } from '@/lib/types'
import { useDispatch, useItems, useWorld } from '@/lib/store/world'
import { perm, useRank } from '@/lib/store/session'
import { useUI } from '@/lib/store/ui'
import { energyVariation } from '@/lib/vibe'
import { ago, fmt } from '@/lib/logic/time'
import { franjaAttributionPrefix } from '@/lib/franjaAttribution'
import { FormatGlyph, FORMAT_LABEL, Mark } from '@/components/kit/Glyph'
import { Avatar, Badge } from '@/components/kit/Persona'
import { Button } from '@/components/kit/Button'
import { TextArea, TextField } from '@/components/kit/Field'
import { Revelado } from '@/components/trama/Revelado'
import { Accion, Nota, Panel, SubPanel, SubTabs, Vacio } from './kit'
import { BorradorCard, PiezaCard } from './PiezaMesa'
import { FORMAT_HINT, FORMAT_PLATE, FRANJA_KIND_LABEL, isHttpUrl, pieceEnergy, useTallerParams } from './logic'
import styles from './Franja.module.css'

type Vista = 'publicaciones' | 'equipo' | 'perfil'

export function FranjaSpace({ me, now, franja }: { me: User; now: Date; franja: ContentItem }) {
  const { params, set } = useTallerParams()
  const raw = params.get('vista')
  const vista: Vista = raw === 'equipo' || raw === 'perfil' ? raw : 'publicaciones'
  const items = useItems()
  const drafts = useWorld((s) => s.world.drafts)
  const users = useWorld((s) => s.world.users)
  const openLectura = useUI((s) => s.openLectura)

  const pubs = useMemo(
    () => items.filter((i) => i.franjaId === franja.id && i.type !== 'franja').sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    [items, franja.id],
  )
  // A teammate's draft is theirs until it is published; you see your own.
  const myDrafts = useMemo(
    () => Object.values(drafts).filter((d) => d.authorId === me.id && d.item.franjaId === franja.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [drafts, me.id, franja.id],
  )
  const team = useMemo(
    () =>
      Object.values(users)
        .filter((u) => u.franjaId === franja.id)
        .sort((a, b) => Number(Boolean(b.franjaAdmin)) - Number(Boolean(a.franjaAdmin)) || a.joinedAt.localeCompare(b.joinedAt)),
    [users, franja.id],
  )
  const e = pieceEnergy(franja)
  const kind = franja.franjaKind ? FRANJA_KIND_LABEL[franja.franjaKind] : 'Franja'

  return (
    <div className={styles.franja}>
      <header className={styles.head} data-rise="">
        <span className={styles.logo}>
          {franja.imageUrl ? <Image src={franja.imageUrl} alt="" fill sizes="96px" className={styles.logoImg} /> : <span className={styles.logoInitial}>{franja.title.slice(0, 1)}</span>}
        </span>
        <div className={styles.headText}>
          <p className={styles.kicker}>
            <span className={styles.band} aria-hidden="true" />
            {kind} · tu franja
          </p>
          <Revelado as="h2" className={styles.name} energy={e.mid} style={{ fontVariationSettings: energyVariation(e.mid) }}>
            {franja.title}
          </Revelado>
          <p className={styles.meta}>
            {[franja.marketplaceLocation, `última señal ${ago(franja.franjaLastUpdated ?? franja.publishedAt, now)}`, `${team.length} en el equipo`].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className={styles.headActions}>
          <Button
            variant="ghost"
            size="sm"
            onClick={(ev: React.MouseEvent<HTMLButtonElement>) => {
              const r = ev.currentTarget.getBoundingClientRect()
              openLectura(franja.slug, { x: r.left, y: r.top, width: r.width, height: r.height })
            }}
          >
            Abrir estación
          </Button>
          <Button variant="quiet" size="sm" href={`/f/${franja.slug}`} iconRight={<Mark name="arrow" size={13} />}>
            Dossier público
          </Button>
        </div>
      </header>

      <div data-rise="">
        <SubTabs<Vista>
          idBase="franja"
          label="Secciones de la franja"
          value={vista}
          onChange={(v) => set({ vista: v === 'publicaciones' ? null : v })}
          tabs={[
            { value: 'publicaciones', label: <>Publicaciones <span className={styles.n}>{pubs.length}</span></> },
            { value: 'equipo', label: <>Equipo <span className={styles.n}>{team.length}</span></> },
            { value: 'perfil', label: 'Perfil' },
          ]}
        />
        <SubPanel idBase="franja" value={vista}>
          {vista === 'publicaciones' ? (
            <Publicaciones me={me} now={now} franja={franja} pubs={pubs} myDrafts={myDrafts} users={users} />
          ) : vista === 'equipo' ? (
            <Equipo me={me} franja={franja} team={team} users={users} />
          ) : (
            <Perfil key={franja.id} me={me} franja={franja} />
          )}
        </SubPanel>
      </div>
    </div>
  )
}

// ── PUBLICACIONES ───────────────────────────────────────────────────────────

function Publicaciones({
  me,
  now,
  franja,
  pubs,
  myDrafts,
  users,
}: {
  me: User
  now: Date
  franja: ContentItem
  pubs: ContentItem[]
  myDrafts: Draft[]
  users: Record<string, User>
}) {
  const types = perm.FRANJA_PUBLISHABLE_TYPES.filter((t) => perm.canCreateContent(me, t))
  const prefix = franja.franjaKind ? franjaAttributionPrefix(franja.franjaKind) : 'PRESENTA'
  return (
    <div className={styles.stack}>
      {types.length ? (
        <Panel label={`Publicar como ${franja.title}`} meta={`En el campo aparece como «${prefix} · ${franja.title}»`}>
          <ul className={styles.tipos}>
            {types.map((t) => (
              <li key={t}>
                <Link href={`/taller/mesa?tipo=${t}&franja=1`} className={styles.tipo}>
                  <span className={styles.tipoGlyph} style={{ background: FORMAT_PLATE[t] }}>
                    <FormatGlyph type={t} size={18} />
                  </span>
                  <span className={styles.tipoName}>{FORMAT_LABEL[t]}</span>
                  <span className={styles.tipoHint}>{FORMAT_HINT[t]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {myDrafts.length ? (
        <section className={styles.section} aria-label="Tus borradores para la franja">
          <p className={styles.sectionHead}>
            <span className="label">Tus borradores para {franja.title}</span>
          </p>
          <ul className={styles.grid}>
            {myDrafts.map((d) => (
              <li key={d.id}>
                <BorradorCard draft={d} now={now} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={styles.section} aria-label="Publicado a nombre de la franja">
        <p className={styles.sectionHead}>
          <span className="label">Publicado a nombre de {franja.title}</span>
        </p>
        {pubs.length === 0 ? (
          <Vacio>
            Aún no hay piezas a nombre de {franja.title}. Lo que publiques desde aquí entra al campo con la franja al frente; la franja nunca entra sola al mosaico.
          </Vacio>
        ) : (
          <ul className={styles.grid}>
            {pubs.map((p, i) => {
              const author = p.createdById ? users[p.createdById] : undefined
              const mine = p.createdById === me.id
              return (
                <li key={p.id}>
                  <PiezaCard item={p} me={me} now={now} byline={mine ? `${fmt.short(p.publishedAt)} · tuya` : author ? `${fmt.short(p.publishedAt)} · @${author.username}` : fmt.short(p.publishedAt)} priority={i < 4} />
                </li>
              )
            })}
          </ul>
        )}
      </section>
      <Nota>
        Publicar a nombre de la franja no te suma el gesto de publicar; lo que la gente haga después con la pieza sí llega a quien la escribió. La vida (HL) de cada pieza solo
        la ve quien la publicó.
      </Nota>
    </div>
  )
}

// ── EQUIPO ──────────────────────────────────────────────────────────────────

function Equipo({ me, franja, team, users }: { me: User; franja: ContentItem; team: User[]; users: Record<string, User> }) {
  const canTeam = perm.canManageFranjaTeam(me, franja.id)
  return (
    <div className={styles.stack}>
      <Panel label="Equipo" meta={canTeam ? 'Administras este equipo' : 'Solo quien administra la franja suma o retira gente'} flush>
        <ul className={styles.team}>
          {team.map((u) => (
            <Miembro key={u.id} u={u} me={me} franja={franja} canTeam={canTeam} />
          ))}
        </ul>
      </Panel>
      {canTeam ? <Sumar me={me} franja={franja} users={users} /> : null}
    </div>
  )
}

function Miembro({ u, me, franja, canTeam }: { u: User; me: User; franja: ContentItem; canTeam: boolean }) {
  const rank = useRank(u.id)
  const dispatch = useDispatch()
  const ask = useUI((s) => s.ask)
  const notify = useUI((s) => s.notify)
  const self = u.id === me.id

  const toggleAdmin = () => {
    dispatch({ t: 'user-admin', userId: u.id, patch: { franjaAdmin: !u.franjaAdmin }, at: new Date().toISOString() })
    notify(u.franjaAdmin ? `@${u.username} ya no administra ${franja.title}.` : `@${u.username} ahora administra ${franja.title}.`)
  }
  const retire = async () => {
    const ok = await ask({
      title: `Retirar a @${u.username}`,
      body: `@${u.username} deja de tener acceso a ${franja.title} y a su mercado. Lo que publicó sigue atribuido a la franja.`,
      confirmLabel: 'Retirar del equipo',
      destructive: true,
    })
    if (!ok) return
    // '' (not undefined): the action log is JSON, and undefined would vanish on replay.
    dispatch({ t: 'user-admin', userId: u.id, patch: { franjaId: '', franjaAdmin: false }, at: new Date().toISOString() })
    notify(`@${u.username} salió del equipo.`)
  }

  return (
    <li className={styles.member}>
      <Avatar user={u} size={40} rank={rank} />
      <div className={styles.memberText}>
        <p className={styles.memberName}>
          <Link href={`/u/${u.username}`} className={styles.memberHandle}>
            @{u.username}
          </Link>
          {self ? <span className={styles.you}>tú</span> : null}
        </p>
        <p className={styles.memberMeta}>
          {u.displayName && u.displayName !== u.username ? `${u.displayName} · ` : ''}desde {fmt.monthYear(u.joinedAt)}
        </p>
      </div>
      <div className={styles.memberBadges}>
        <Badge user={u} rank={rank} />
        {u.franjaAdmin ? <span className={styles.adminChip}>Admin de franja</span> : null}
      </div>
      <div className={styles.memberActions}>
        {canTeam && !self ? (
          <>
            <Accion onClick={toggleAdmin}>{u.franjaAdmin ? 'Quitar admin' : 'Hacer admin'}</Accion>
            <Accion tone="danger" onClick={retire}>
              Retirar
            </Accion>
          </>
        ) : null}
      </div>
    </li>
  )
}

function Sumar({ me, franja, users }: { me: User; franja: ContentItem; users: Record<string, User> }) {
  const dispatch = useDispatch()
  const ask = useUI((s) => s.ask)
  const notify = useUI((s) => s.notify)
  const items = useWorld((s) => s.world.items)
  const [handle, setHandle] = useState('')
  const [note, setNote] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const h = handle.trim().replace(/^@/, '').toLowerCase()
    if (!h) return
    const u = Object.values(users).find((x) => x.username.toLowerCase() === h)
    if (!u) return setNote(`No encontramos a @${h}.`)
    if (u.id === me.id || u.franjaId === franja.id) return setNote(`@${u.username} ya está en el equipo.`)
    if (u.franjaId) {
      const other = items[u.franjaId]?.title ?? 'otra franja'
      const ok = await ask({
        title: `Mover a @${u.username}`,
        body: `@${u.username} pertenece a ${other}. Sumarlo aquí lo mueve a ${franja.title} y le quita el acceso a ${other}.`,
        confirmLabel: 'Mover al equipo',
      })
      if (!ok) return
    }
    dispatch({ t: 'user-admin', userId: u.id, patch: { franjaId: franja.id, franjaAdmin: false }, at: new Date().toISOString() })
    notify(`@${u.username} se sumó a ${franja.title}.`)
    setHandle('')
    setNote(null)
  }

  return (
    <Panel label="Sumar al equipo">
      <form className={styles.sumar} onSubmit={submit}>
        <TextField
          label="Usuario"
          placeholder="@usuario"
          value={handle}
          onChange={(e) => {
            setHandle(e.target.value)
            setNote(null)
          }}
          autoComplete="off"
          hint={note ?? 'Entra como miembro; puedes hacerle admin después.'}
          error={note && note.startsWith('No encontramos') ? note : undefined}
        />
        <Button variant="ink" type="submit" disabled={!handle.trim()}>
          Sumar
        </Button>
      </form>
    </Panel>
  )
}

// ── PERFIL ──────────────────────────────────────────────────────────────────

function Perfil({ me, franja }: { me: User; franja: ContentItem }) {
  const dispatch = useDispatch()
  const notify = useUI((s) => s.notify)
  const can = perm.canManageFranja(me, franja.id)
  const [desc, setDesc] = useState(franja.marketplaceDescription ?? '')
  const [loc, setLoc] = useState(franja.marketplaceLocation ?? '')
  const [url, setUrl] = useState(franja.franjaUrl ?? '')
  const urlError = url.trim() && !isHttpUrl(url) ? 'Usa un enlace completo: https://…' : null
  const patch: Partial<ContentItem> = {}
  if (desc.trim() !== (franja.marketplaceDescription ?? '').trim()) patch.marketplaceDescription = desc.trim()
  if (loc.trim() !== (franja.marketplaceLocation ?? '').trim()) patch.marketplaceLocation = loc.trim()
  if (url.trim() !== (franja.franjaUrl ?? '').trim()) patch.franjaUrl = url.trim()
  const dirty = Object.keys(patch).length > 0

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (!dirty || urlError || !can) return
    dispatch({ t: 'franja-patch', franjaId: franja.id, patch, at: new Date().toISOString() })
    notify(`Perfil de ${franja.title} guardado.`)
  }

  return (
    <div className={styles.perfilWrap}>
      <Panel label="Perfil público" meta="Así se presenta la franja en su estación y su dossier">
        <form className={styles.perfil} onSubmit={save}>
          <TextArea
            label="Descripción"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            maxLength={600}
            counter={{ value: desc.length, max: 600 }}
            placeholder="Qué es esta franja, en una o dos frases."
            rows={4}
            disabled={!can}
          />
          <TextField label="Ubicación" value={loc} onChange={(e) => setLoc(e.target.value)} maxLength={120} placeholder="Monterrey 56, Roma Norte · CDMX" disabled={!can} />
          <TextField label="Enlace" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" inputMode="url" error={urlError} disabled={!can} />
          <div className={styles.perfilActions}>
            <Button variant="ink" type="submit" disabled={!dirty || Boolean(urlError) || !can}>
              Guardar perfil
            </Button>
          </div>
        </form>
      </Panel>
      <Nota>Guardar cuenta como una señal de la franja: el Dial ordena las estaciones por su última señal, nunca por su vida.</Nota>
    </div>
  )
}
