'use client'

/**
 * The desk's card. Still a poster (art dominant, the title at the piece's
 * own energy, the energy line along the bottom edge whose glow is its
 * life) — but its gestures are the owner's: Ver, Editar, Cultivar. HL
 * appears only as a word, and only on pieces you made.
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import { useRouter } from 'next/navigation'
import type { ContentItem, Draft, User } from '@/lib/types'
import { useDispatch } from '@/lib/store/world'
import { perm } from '@/lib/store/session'
import { useUI } from '@/lib/store/ui'
import { currentHp } from '@/lib/curation'
import { hlBracket } from '@/lib/dashboard/hl'
import { bandGradient, energyHex, energyVariation } from '@/lib/vibe'
import { fitTitle } from '@/lib/typeset'
import { ago, fmt } from '@/lib/logic/time'
import { FormatGlyph, FORMAT_LABEL, Mark } from '@/components/kit/Glyph'
import { Accion, AccionLink } from './kit'
import { lifeGlow, pieceEnergy, useCosecha } from './logic'
import styles from './PiezaMesa.module.css'

const SIZES = '(max-width: 640px) 50vw, (max-width: 1200px) 25vw, 240px'

function Poster({
  item,
  title,
  life,
  stamp,
  label,
  onOpen,
  priority,
}: {
  item: ContentItem
  title: string
  life: number
  stamp?: string | null
  label: string
  onOpen: (e: React.MouseEvent<HTMLButtonElement>) => void
  priority?: boolean
}) {
  const e = pieceEnergy(item)
  return (
    <button
      type="button"
      className={styles.poster}
      onClick={onOpen}
      aria-label={label}
      style={
        {
          '--e': energyHex(e.mid),
          '--band': bandGradient(e.min, e.max),
          '--life': life.toFixed(3),
        } as React.CSSProperties
      }
    >
      <span className={styles.art}>
        {item.imageUrl ? (
          <Image src={item.imageUrl} alt="" fill sizes={SIZES} className={styles.img} draggable={false} priority={priority} />
        ) : (
          <span className={styles.plate} style={{ background: bandGradient(e.min, e.max, '160deg') }} />
        )}
      </span>
      <span className={styles.scrim} />
      <span className={styles.top}>
        <span className={styles.fmt}>
          <FormatGlyph type={item.type} size={11} />
          {FORMAT_LABEL[item.type]}
        </span>
        {stamp ? <span className={styles.stamp}>{stamp}</span> : null}
      </span>
      <span className={styles.title} style={{ fontVariationSettings: energyVariation(e.mid), fontSize: fitTitle(title, e.mid, 26, 13, 0.9) }}>
        {title}
      </span>
      <span className={styles.energy} aria-hidden="true" />
    </button>
  )
}

function rectOf(el: Element) {
  const r = el.getBoundingClientRect()
  return { x: r.left, y: r.top, width: r.width, height: r.height }
}

/** A published piece. */
export function PiezaCard({
  item,
  me,
  now,
  byline,
  code,
  priority,
}: {
  item: ContentItem
  me: User
  now: Date
  byline?: string | null
  /** Reference code in your body of work («MX·014»). */
  code?: string
  priority?: boolean
}) {
  const openLectura = useUI((s) => s.openLectura)
  const openCosecha = useCosecha((s) => s.open)
  const mine = item.createdById === me.id
  const hl = currentHp(item, now)
  const harvested = Boolean(item.harvestedAt)
  const canEdit = perm.canCreateContent(me, item.type) && (mine || (item.franjaId ? perm.canManageFranja(me, item.franjaId) : false))
  const open = (e: React.MouseEvent<HTMLElement>) => {
    const poster = (e.currentTarget.closest('article') ?? e.currentTarget).querySelector('button')
    openLectura(item.slug, poster ? rectOf(poster) : null)
  }
  return (
    <article className={styles.card} data-harvested={harvested || undefined}>
      <Poster item={item} title={item.title} life={lifeGlow(hl)} stamp={harvested ? 'Cosechada' : null} label={`Ver «${item.title}»`} onOpen={open} priority={priority} />
      <div className={styles.info}>
        <span className={styles.date}>
          {code ? <span className={styles.code}>{code} · </span> : null}
          {byline ?? fmt.short(item.publishedAt)}
        </span>
      </div>
      {mine ? (
        <div className={styles.life}>
          <span className={styles.hl} title="Solo tú ves la vida de tus piezas">
            HL · {hlBracket(hl)}
          </span>
          {harvested && item.harvestedAt ? <span className={styles.cosechada}>Cosechada · {fmt.short(item.harvestedAt)}</span> : null}
        </div>
      ) : null}
      <div className={styles.actions}>
        <Accion onClick={open}>Ver</Accion>
        {canEdit ? <AccionLink href={`/taller/mesa?editar=${encodeURIComponent(item.id)}`}>Editar</AccionLink> : null}
        {mine && !harvested ? (
          <span className={styles.push}>
            <Accion tone="strong" icon={<Mark name="seed" size={13} />} onClick={() => openCosecha(item.id)} label={`Cultivar «${item.title}»`}>
              Cultivar
            </Accion>
          </span>
        ) : null}
      </div>
    </article>
  )
}

/** A draft (or a pending edit) still on the desk. */
export function BorradorCard({ draft, now }: { draft: Draft; now: Date }) {
  const router = useRouter()
  const ask = useUI((s) => s.ask)
  const notify = useUI((s) => s.notify)
  const dispatch = useDispatch()
  const item = draft.item
  const title = item.title?.trim() || 'Sin título'
  const href = `/taller/mesa?draft=${encodeURIComponent(draft.id)}`
  const stamp = draft.state === 'pendiente' ? 'Pendiente' : draft.publishedId ? 'Edición' : 'Borrador'

  const remove = async () => {
    const ok = await ask({
      title: 'Borrar este borrador',
      body: `«${title}» desaparece de tu mesa. No se puede deshacer${draft.publishedId ? '; la pieza publicada no cambia' : ''}.`,
      confirmLabel: 'Borrar',
      destructive: true,
    })
    if (!ok) return
    dispatch({ t: 'draft-delete', id: draft.id, at: new Date().toISOString() })
    notify('Borrador borrado.')
  }

  return (
    <article className={styles.card} data-draft="">
      <Poster item={item} title={title} life={0.12} stamp={stamp} label={`Continuar «${title}»`} onOpen={() => router.push(href)} />
      <div className={styles.info}>
        <span className={styles.date}>Guardado {ago(draft.updatedAt, now)}</span>
      </div>
      <div className={styles.actions}>
        <AccionLink href={href} tone="strong">
          Continuar
        </AccionLink>
        <span className={styles.push}>
          <Accion tone="danger" onClick={remove}>
            Borrar
          </Accion>
        </span>
      </div>
    </article>
  )
}
