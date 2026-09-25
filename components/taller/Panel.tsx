'use client'

/**
 * PANEL — the calm instrument desk. The main column is where the work is
 * (create, your pieces, what you kept, what you listen to); the side column
 * is where the world answers (activity, the nights ahead, the stations you
 * follow). On a phone they interleave in that order of urgency.
 */

import { useMemo } from 'react'
import type { ContentItem, Draft, User } from '@/lib/types'
import { Mark } from '@/components/kit/Glyph'
import { Accion, Panel, Vacio } from './kit'
import { Crear } from './Crear'
import { Actividad } from './Actividad'
import { Agenda, Franjas, Guardados, Sesiones } from './Coleccion'
import { BorradorCard, PiezaCard } from './PiezaMesa'
import { canCreateAny, pieceCodes, plural, useSaved } from './logic'
import styles from './Panel.module.css'

export function PanelSpace({
  me,
  now,
  pieces,
  drafts,
  onPublicar,
  onOfertas,
}: {
  me: User
  now: Date
  pieces: ContentItem[]
  drafts: Draft[]
  onPublicar: () => void
  onOfertas: (listingId?: string) => void
}) {
  const saved = useSaved(me.id)
  const creator = canCreateAny(me) || pieces.length > 0 || drafts.length > 0
  // Indexical numbers follow reading order over the widgets that exist.
  const order = ['crear', creator ? 'piezas' : null, 'guardados', 'sesiones', 'actividad', 'agenda', 'franjas'].filter(Boolean) as string[]
  const idx = (k: string) => String(order.indexOf(k) + 1).padStart(2, '0')
  return (
    <div className={styles.desk}>
      <div className={styles.colMain}>
        <Crear me={me} index={idx('crear')} />
        {creator ? <TusPiezas me={me} now={now} pieces={pieces} drafts={drafts} onAll={onPublicar} index={idx('piezas')} /> : null}
        <Guardados me={me} saved={saved} now={now} index={idx('guardados')} />
        <Sesiones saved={saved} index={idx('sesiones')} />
      </div>
      <div className={styles.colSide}>
        <Actividad me={me} now={now} onOfertas={onOfertas} index={idx('actividad')} />
        <Agenda saved={saved} now={now} index={idx('agenda')} />
        <Franjas me={me} now={now} index={idx('franjas')} />
      </div>
    </div>
  )
}

const SHOWN = 6

function TusPiezas({ me, now, pieces, drafts, onAll, index }: { me: User; now: Date; pieces: ContentItem[]; drafts: Draft[]; onAll: () => void; index?: string }) {
  // Work in progress first (at most two), then what is out in the field, newest first.
  const draftShown = drafts.slice(0, 2)
  const pieceShown = pieces.slice(0, SHOWN - draftShown.length)
  const total = pieces.length + drafts.length
  const codes = useMemo(() => pieceCodes(pieces), [pieces])
  return (
    <Panel
      label="Tus piezas"
      index={index}
      area="piezas"
      meta={total ? [plural(pieces.length, 'publicada', 'publicadas'), drafts.length ? plural(drafts.length, 'borrador', 'borradores') : null].filter(Boolean).join(' · ') : undefined}
      actions={
        total > 3 ? (
          <Accion onClick={onAll} icon={<Mark name="arrow" size={13} />}>
            Toda tu obra
          </Accion>
        ) : null
      }
    >
      {total === 0 ? (
        <Vacio>Aún no publicas. Tu primera pieza empieza en Crear; la Mesa guarda sola mientras escribes, y aquí la verás crecer.</Vacio>
      ) : (
        <div className={styles.piezasWrap}>
          <ul className={styles.piezas}>
            {draftShown.map((d) => (
              <li key={d.id}>
                <BorradorCard draft={d} now={now} />
              </li>
            ))}
            {pieceShown.map((p, i) => (
              <li key={p.id}>
                <PiezaCard item={p} me={me} now={now} code={codes.get(p.id)} priority={i < 3} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}
