'use client'

/**
 * /u/[username] — the public credential. The card is the hero; the
 * expediente beside it says the same thing in words. Public progression is
 * only what's allowed to be public: role or living rank, flags, trophies,
 * firma, and the band their pieces span — never HL, never presence, never a
 * count that ranks a person.
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import Link from 'next/link'
import { useMemo } from 'react'
import type { ForoThread, User } from '@/lib/types'
import { useItems, useNow, useWorld } from '@/lib/store/world'
import { useMe, useRank } from '@/lib/store/session'
import { FORO_THREAD_CAP } from '@/lib/store/world-core'
import { rankCategory } from '@/lib/logic/feed'
import { fmt } from '@/lib/logic/time'
import { getGenreNames } from '@/lib/genres'
import type { TrophyKey } from '@/lib/trophies'
import { energyVariation, VIBE_NAMES } from '@/lib/vibe'
import { Organismo } from '@/components/organismo/Organismo'
import { Badge, Flags, ROLE_MEANING } from '@/components/kit/Persona'
import { RANK_MEANING, Mark } from '@/components/kit/Glyph'
import { BandChip, Empty, SectionHead } from '@/components/kit/Bits'
import { Button } from '@/components/kit/Button'
import { Credencial } from './Credencial'
import { Insignias } from '@/components/insignias/Insignias'
import { bandOfPieces, credencialForUser, joinOrder, monthStamp, pinsFrom, trophyStates } from './data'
import { bandVars } from './cssColor'
import styles from './PerfilPublico.module.css'

export function Perfil({ username }: { username: string }) {
  const hydrated = useWorld((s) => s.hydrated)
  const users = useWorld((s) => s.world.users)
  const user = useMemo(() => {
    const h = username.toLowerCase()
    return Object.values(users).find((u) => u.username.toLowerCase() === h) ?? null
  }, [users, username])

  if (!user) return hydrated ? <SinSenal username={username} /> : <div className={styles.pending} aria-busy="true" />
  return <Expediente user={user} />
}

/** Conditions for locked trophies — the rule, never the scalar behind it. */
const LOCKED_HINT: Record<TrophyKey, string> = {
  versatile_voice: 'Se gana publicando en cinco formatos distintos.',
  published_voice: 'Se gana al llegar a cinco publicaciones.',
  signal_caster: 'Se gana al recibir diez [!] en comentarios propios.',
  question_caster: 'Se gana al recibir diez [?] en comentarios propios.',
  thread_anchor: 'Se gana abriendo un hilo en el foro que pase de veinte respuestas.',
  crowd_compass: 'Se gana calibrando veinticinco piezas con el fader.',
  presence_logged: 'Se gana dejando presencia: calibrar, comentar, publicar.',
  presence_deep: 'Se gana cuando esa presencia cobra peso.',
  presence_persistent: 'Se gana sosteniendo la presencia a lo largo del tiempo.',
  presence_insider_track: 'Se gana con una presencia larga y constante en la señal.',
}

const pad2 = (n: number) => String(n).padStart(2, '0')

function longMonth(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  } catch {
    return monthStamp(iso)
  }
}

function Expediente({ user }: { user: User }) {
  const me = useMe()
  const own = me?.id === user.id
  const rank = useRank(user.id)
  const items = useItems()
  const now = useNow()
  const users = useWorld((s) => s.world.users)
  const earned = useWorld((s) => s.world.trophies[user.id])
  const threads = useWorld((s) => s.world.threads)
  const replies = useWorld((s) => s.world.replies)
  const team = useWorld((s) => (user.franjaId ? s.world.items[user.franjaId]?.title ?? null : null))
  const teamSlug = useWorld((s) => (user.franjaId ? s.world.items[user.franjaId]?.slug ?? null : null))

  const pieces = useMemo(() => items.filter((i) => i.createdById === user.id && i.type !== 'franja'), [items, user.id])
  const band = useMemo(() => bandOfPieces(pieces), [pieces])
  const minute = Math.floor(now.getTime() / 60_000)
  const ranked = useMemo(() => rankCategory(pieces, new Date(minute * 60_000)), [pieces, minute])
  const trophies = useMemo(() => trophyStates(earned), [earned])
  const folio = useMemo(() => joinOrder(users).indexOf(user.id) + 1, [users, user.id])
  const data = useMemo(
    () => credencialForUser({ user, rank, folio, team, pins: pinsFrom(trophies), band }),
    [user, rank, folio, team, trophies, band],
  )

  const hilos = useMemo(() => {
    const open = Object.values(threads)
      .filter((t) => !t.deletion)
      .sort((a, b) => b.bumpedAt.localeCompare(a.bumpedAt))
    const onWall = new Set(open.slice(0, FORO_THREAD_CAP).map((t) => t.id))
    const count = new Map<string, number>()
    for (const r of Object.values(replies)) if (!r.deletion) count.set(r.threadId, (count.get(r.threadId) ?? 0) + 1)
    return Object.values(threads)
      .filter((t) => t.authorId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((t) => ({ t, replies: count.get(t.id) ?? 0, onWall: onWall.has(t.id) }))
  }, [threads, replies, user.id])

  const earnedCount = trophies.filter((t) => t.earnedAt).length
  const staff = user.role !== 'user'
  const meaning = staff ? ROLE_MEANING[user.role] : RANK_MEANING[rank]
  const lo = band ? VIBE_NAMES[Math.round(band.min)] : null
  const hi = band ? VIBE_NAMES[Math.round(band.max)] : null

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-label={`Credencial de @${user.username}`}>
        <div className={styles.cardCol}>
          <Credencial
            data={data}
            hint={earnedCount ? 'Arrástrala para girarla · tócala: al reverso, sus insignias.' : 'Arrástrala para girarla · tócala para voltearla.'}
            hintBack="Arrástrala o tócala para volver al frente."
          />
        </div>

        <div className={styles.expediente}>
          <p className={styles.index}>01 / Credencial pública — folio {data.folio}</p>
          <h1 className={styles.name} style={{ fontVariationSettings: energyVariation(data.energy) }}>
            {user.displayName || user.username}
          </h1>
          <p className={styles.handle}>@{user.username}</p>

          <div className={styles.badges}>
            <Badge user={user} rank={rank} />
            <Flags user={user} />
          </div>
          <p className={styles.meaning}>{meaning}</p>

          <dl className={styles.facts}>
            {user.location ? (
              <div>
                <dt>Zona</dt>
                <dd>{user.location}</dd>
              </div>
            ) : null}
            <div>
              <dt>En la señal desde</dt>
              <dd>{longMonth(user.joinedAt)}</dd>
            </div>
            <div>
              <dt>Folio</dt>
              <dd>
                <span className={styles.serial}>{data.folio}</span>
                <span className={styles.factNote}>Número de serie: el orden en que llegó a la beta. No es un puntaje.</span>
              </dd>
            </div>
            {team ? (
              <div>
                <dt>Equipo</dt>
                <dd>{teamSlug ? <Link href={`/f/${teamSlug}`} className={styles.link}>{team}</Link> : team}</dd>
              </div>
            ) : null}
          </dl>

          {user.bio ? <p className={styles.bio}>{user.bio}</p> : null}
          {user.firma ? <p className={styles.firma}>{user.firma}</p> : null}

          <div className={styles.energia}>
            <span className={styles.energiaHead}>Energía de sus piezas</span>
            {band ? (
              <>
                <div className={styles.energiaRow}>
                  <BandChip min={band.min} max={band.max} size="md" />
                  <span className={styles.energiaCode}>
                    {pad2(Math.round(band.min))}–{pad2(Math.round(band.max))} · {lo === hi ? lo : `${lo} → ${hi}`}
                  </span>
                </div>
                <div className={styles.energiaRow}>
                  <p className={styles.energiaText}>
                    {lo === hi ? `Sus piezas viven en ${lo}.` : `Sus piezas viven entre ${lo} y ${hi}.`}
                  </p>
                </div>
                <div className={styles.meter} aria-hidden="true">
                  <span className={styles.meterTrack} />
                  <span
                    className={styles.meterBand}
                    style={{
                      left: `${band.min * 10}%`,
                      width: `${Math.max(1.4, (band.max - band.min) * 10)}%`,
                      background: bandVars(band.min, band.max),
                    }}
                  />
                  <span className={styles.meterEnds}>
                    <i>GLACIAL</i>
                    <i>VOLCÁN</i>
                  </span>
                </div>
              </>
            ) : (
              <p className={styles.energiaText}>Todavía sin piezas publicadas: su energía aparece cuando publique.</p>
            )}
          </div>

          {own ? (
            <div className={styles.own}>
              <Button href="/taller" variant="ghost" iconRight={<Mark name="arrow" size={15} />}>
                Editar en el Taller
              </Button>
              <span className={styles.ownNote}>Así te ven los demás.</span>
            </div>
          ) : null}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="trofeos-h">
        <SectionHead
          label={`02 / Trofeos — ${pad2(earnedCount)} de ${pad2(trophies.length)}`}
          title={<span id="trofeos-h">Trofeos</span>}
          sub={earnedCount ? 'Se ganan participando; no se compran. Toca una insignia para voltearla: al reverso, el mes y su historia.' : 'Se ganan participando; no se compran. Cada lugar vacío dice cómo se gana.'}
        />
        {/* The pins, pressed into the page: earned ones adhering in soft wells, the rest blind-debossed with their condition. */}
        <Insignias
          variant="vitrina"
          items={trophies.map((t) => ({ key: t.key, label: t.label, description: t.description, earnedAt: t.earnedAt, condition: LOCKED_HINT[t.key] }))}
        />
      </section>

      <section className={styles.section} aria-labelledby="piezas-h">
        <SectionHead
          label={`03 / Publicaciones — ${pad2(pieces.length)} ${pieces.length === 1 ? 'pieza' : 'piezas'}`}
          title={<span id="piezas-h">Publicaciones</span>}
          sub={pieces.length ? 'De la más reciente a la más antigua. El tamaño es su vida.' : undefined}
        />
        <Organismo
          ranked={ranked}
          empty={<Empty title={own ? 'Aún no publicas.' : 'Aún no publica.'}>{own ? 'Lo que publiques desde el Taller aparecerá aquí.' : 'Cuando publique algo, vivirá aquí.'}</Empty>}
        />
      </section>

      <section className={styles.section} aria-labelledby="hilos-h">
        <SectionHead label={`04 / Foro — ${pad2(hilos.length)} ${hilos.length === 1 ? 'hilo' : 'hilos'}`} title={<span id="hilos-h">Hilos que abrió</span>} />
        {hilos.length ? (
          <ul className={styles.hilos}>
            {hilos.map(({ t, replies: n, onWall }, i) => (
              <li key={t.id}>
                <HiloRow t={t} replies={n} onWall={onWall} index={i + 1} />
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="Ningún hilo todavía.">{own ? 'Abre uno en el foro: una imagen, de uno a cinco géneros.' : 'Cuando abra un hilo en el foro, aparecerá aquí.'}</Empty>
        )}
      </section>
    </div>
  )
}

function HiloRow({ t, replies, onWall, index }: { t: ForoThread; replies: number; onWall: boolean; index: number }) {
  const genres = getGenreNames(t.genres).slice(0, 3)
  let when = ''
  try {
    when = fmt.long(t.createdAt)
  } catch {
    when = ''
  }
  return (
    <Link href={`/foro?hilo=${encodeURIComponent(t.id)}`} className={styles.hilo} data-gone={t.deletion ? '' : undefined}>
      <span className={styles.hiloIdx}>{pad2(index)}</span>
      <span className={styles.hiloImg}>
        {t.imageUrl && !t.deletion ? <Image src={t.imageUrl} alt="" fill sizes="88px" /> : null}
      </span>
      <span className={styles.hiloText}>
        <b>{t.deletion ? 'Hilo retirado por moderación' : t.subject}</b>
        <span className={styles.hiloMeta}>
          {when}
          {' · '}
          {replies === 1 ? '1 respuesta' : `${replies} respuestas`}
          {' · '}
          {t.deletion ? 'retirado' : onWall ? 'en el muro' : 'ya cayó del muro'}
        </span>
        {genres.length && !t.deletion ? <span className={styles.hiloGenres}>{genres.join(' · ')}</span> : null}
      </span>
      <Mark name="arrow" size={16} className={styles.hiloArrow} />
    </Link>
  )
}

function SinSenal({ username }: { username: string }) {
  return (
    <div className={styles.none}>
      <p className={styles.noneIdx}>404 · sin señal</p>
      <h1 className={styles.noneTitle}>Nadie firma como @{username}.</h1>
      <p className={styles.noneText}>
        Puede que el nombre esté mal escrito, o que esa identidad todavía no haya cruzado la puerta. Gradiente es por invitación: las credenciales existen solo cuando alguien las activa.
      </p>
      <div className={styles.noneActions}>
        <Button href="/" variant="ink">
          Volver al campo
        </Button>
        <Button href="/welcome" variant="ghost">
          La Puerta
        </Button>
      </div>
    </div>
  )
}
