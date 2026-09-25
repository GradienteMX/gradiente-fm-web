'use client'

/**
 * CREAR — one pictogram per format you have earned. Nothing here is
 * disabled-but-visible: a format you cannot use is simply not offered, and
 * if you cannot publish yet, the panel says — truthfully — how voice is
 * earned here.
 */

import Link from 'next/link'
import type { User } from '@/lib/types'
import { perm } from '@/lib/store/session'
import { FormatGlyph, FORMAT_LABEL, Mark } from '@/components/kit/Glyph'
import { ROLE_LABEL, ROLE_MEANING } from '@/components/kit/Persona'
import { Panel } from './kit'
import { COMPOSE_TYPES, FORMAT_HINT, FORMAT_PLATE } from './logic'
import styles from './Panel.module.css'

export function Crear({ me, index }: { me: User; index?: string }) {
  const allowed = COMPOSE_TYPES.filter((t) => perm.canCreateContent(me, t))
  if (!allowed.length) return <VozGanada me={me} index={index} />
  return (
    <Panel label="Crear" index={index} meta="La Mesa guarda mientras escribes" area="crear">
      <ul className={styles.formatos}>
        {allowed.map((t) => (
          <li key={t}>
            <Link href={`/taller/mesa?tipo=${t}`} className={styles.formato}>
              <span className={styles.formatoGlyph} style={{ background: FORMAT_PLATE[t] }}>
                <FormatGlyph type={t} size={18} />
              </span>
              <span className={styles.formatoName}>{FORMAT_LABEL[t]}</span>
              <span className={styles.formatoHint}>{FORMAT_HINT[t]}</span>
              <span className={styles.formatoPlus} aria-hidden="true">
                <Mark name="plus" size={13} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function VozGanada({ me, index }: { me: User; index?: string }) {
  return (
    <Panel label="Crear" index={index} area="crear">
      <div className={styles.voz}>
        <p className={styles.vozTitle}>La voz se gana.</p>
        <p className={styles.vozText}>
          Hoy eres <b>{ROLE_LABEL[me.role]}</b>: comentas, reaccionas, guardas, calibras y abres hilos. Eso ya mueve el campo — y también tu presencia.
        </p>
        <ol className={styles.escalera}>
          <li>
            <span className={styles.escalon}>{ROLE_LABEL.curator}</span>
            <span>{ROLE_MEANING.curator}</span>
          </li>
          <li>
            <span className={styles.escalon}>
              {ROLE_LABEL.guide} · {ROLE_LABEL.insider}
            </span>
            <span>{ROLE_MEANING.guide}</span>
          </li>
          <li>
            <span className={styles.escalon}>Franja</span>
            <span>Si un sello, un venue o un colectivo te suma a su equipo, publicas en su nombre.</span>
          </li>
        </ol>
        <p className={styles.vozNote}>No se compra ni se pide: la presencia sostenida es la que te pone en el radar editorial.</p>
      </div>
    </Panel>
  )
}
