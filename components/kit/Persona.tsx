'use client'

/**
 * Identity primitives. Labels go on people, never weights on content:
 * staff show their role, readers show their living rank (from the !/?
 * they've received). Frames are the rank's public, story-shaped marker.
 * No numbers, ever.
 */

import Link from 'next/link'
import type { User, UserRank } from '@/lib/types'
import { useRank } from '@/lib/store/session'
import { RankSigil, RANK_LABEL, RANK_MEANING } from './Glyph'
import styles from './Persona.module.css'

export const ROLE_LABEL: Record<User['role'], string> = {
  user: 'Lector',
  curator: 'Curador',
  guide: 'Guía',
  insider: 'Insider',
  admin: 'Admin',
}

export const ROLE_MEANING: Record<User['role'], string> = {
  user: 'Comenta, reacciona, guarda, calibra, abre hilos.',
  curator: 'Además publica listas y encuestas; abre tienda.',
  guide: 'Voz de la casa: opiniones, mixes, editoriales, reseñas, eventos.',
  insider: 'Voz de la escena: mismos derechos que guía, firma desde adentro.',
  admin: 'Todo. Asigna roles, modera, ajusta.',
}

export function Avatar({ user, size = 36, rank }: { user: User; size?: number; rank?: UserRank }) {
  const r = rank ?? 'normie'
  const framed = user.role === 'user' && r !== 'normie'
  return (
    <span className={styles.avatar} data-rank={framed ? r : undefined} style={{ width: size, height: size }} title={framed ? `${RANK_LABEL[r]} — ${RANK_MEANING[r]}` : undefined}>
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatarUrl} alt="" />
      ) : (
        <span className={styles.initial} style={{ fontSize: size * 0.42 }}>
          {(user.displayName || user.username).slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  )
}

/** The one badge a person carries: role for staff, rank for readers. */
export function Badge({ user, rank }: { user: User; rank: UserRank }) {
  if (user.role !== 'user') {
    return (
      <span className={styles.badge} data-role={user.role} title={ROLE_MEANING[user.role]}>
        {ROLE_LABEL[user.role]}
      </span>
    )
  }
  return (
    <span className={styles.badge} data-rank={rank} title={RANK_MEANING[rank]}>
      <RankSigil rank={rank} size={11} />
      {RANK_LABEL[rank]}
    </span>
  )
}

export function Flags({ user }: { user: User }) {
  return (
    <>
      {user.isMod ? (
        <span className={styles.flag} title="Moderación">
          MOD
        </span>
      ) : null}
      {user.isOG ? (
        <span className={styles.flag} title="Primera ola">
          OG
        </span>
      ) : null}
    </>
  )
}

export function UserChip({ user, withAvatar = true, size = 26, link = true }: { user: User; withAvatar?: boolean; size?: number; link?: boolean }) {
  const rank = useRank(user.id)
  const name = (
    <span className={styles.name}>
      <span className={styles.handle}>@{user.username}</span>
    </span>
  )
  return (
    <span className={styles.chip}>
      {withAvatar ? <Avatar user={user} size={size} rank={rank} /> : null}
      {link ? (
        <Link href={`/u/${user.username}`} className={styles.link}>
          {name}
        </Link>
      ) : (
        name
      )}
      <Badge user={user} rank={rank} />
      <Flags user={user} />
    </span>
  )
}
