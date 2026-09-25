'use client'

/**
 * The format picker — eight pictograms, each with what it is and how long
 * it runs. Formats your voice doesn't carry yet stay visible and say how
 * voice is earned; nothing is hidden, nothing pretends to work.
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import type { ContentType, User } from '@/lib/types'
import { perm } from '@/lib/store/session'
import { useNow, useWorld } from '@/lib/store/world'
import { ago } from '@/lib/logic/time'
import { FormatGlyph, FORMAT_LABEL, FORMAT_PLURAL, Mark } from '@/components/kit/Glyph'
import { ROLE_LABEL, ROLE_MEANING } from '@/components/kit/Persona'
import { Button } from '@/components/kit/Button'
import { FORMATOS, FORMATO_CODE, FORMATO_INFO, FORMATO_PLATE, VOZ, franjaByDefault, type Formato } from './model'
import s from './Mesa.module.css'

export function Picker({ me, franja }: { me: User; franja: boolean }) {
  const router = useRouter()
  const [explain, setExplain] = useState<Formato | null>(null)
  const franjaItem = useWorld((st) => (me.franjaId ? st.world.items[me.franjaId] ?? null : null))
  const franjaOk = franja && !!franjaItem
  const drafts = useWorld((st) => st.world.drafts)
  const now = useNow()
  const mine = useMemo(
    () =>
      Object.values(drafts)
        .filter((d) => d.authorId === me.id)
        .sort((x, y) => y.updatedAt.localeCompare(x.updatedAt))
        .slice(0, 6),
    [drafts, me.id],
  )

  return (
    <div className={s.page}>
      <header className={s.head}>
        <span className={s.kicker}>
          <Link href="/taller">Taller</Link> / La mesa
        </span>
        <h1 className={s.title}>¿Qué vas a publicar?</h1>
        <p className={s.lede}>No tienes que saber escribir bien: solo tener algo que decir. Si dudas, escoge el formato más corto que sirva.</p>
        <p className={s.who}>
          Escribes como <b>{ROLE_LABEL[me.role].toUpperCase()}</b> {ROLE_MEANING[me.role]}
          {franjaItem ? (
            <>
              {' '}
              · En el equipo de <b>{franjaItem.title}</b>
            </>
          ) : null}
        </p>
      </header>

      <div className={s.grid} role="group" aria-label="Formatos">
        {FORMATOS.map((t, i) => {
          const can = perm.canCreateContent(me, t)
          const withFranja = !!franjaItem && perm.FRANJA_PUBLISHABLE_TYPES.includes(t) && (franjaOk || franjaByDefault(me, t, false))
          return (
            <button
              key={t}
              type="button"
              className={s.tile}
              data-locked={!can || undefined}
              aria-expanded={!can ? explain === t : undefined}
              style={{ ['--plate' as string]: FORMATO_PLATE[t] }}
              onClick={() => (can ? router.push(`/taller/mesa?tipo=${t}${withFranja && franjaOk ? '&franja=1' : ''}`) : setExplain((e) => (e === t ? null : t)))}
            >
              <span className={s.tileTop}>
                <span className={s.glyph}>
                  <FormatGlyph type={t} size={22} />
                </span>
                {withFranja ? (
                  <span className={s.franjaMark}>con tu franja</span>
                ) : (
                  <span className={s.code} aria-hidden="true">
                    {FORMATO_CODE[t]}·{String(i + 1).padStart(2, '0')}
                  </span>
                )}
              </span>
              <span className={s.tileName}>{FORMAT_LABEL[t]}</span>
              <span className={s.tileQue}>{FORMATO_INFO[t].que}</span>
              <span className={s.tileLargo}>
                <b>{FORMATO_INFO[t].largo}</b>
                {can ? (
                  <Mark name="arrow" size={14} />
                ) : (
                  <span className={s.lock}>
                    <Mark name="lock" size={12} /> Voz por ganar
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>

      {explain ? <SinVoz me={me} type={explain} /> : null}

      {mine.length ? (
        <section className={s.drafts} aria-label="Sigue escribiendo">
          <span className={s.kicker}>Sigue escribiendo</span>
          <div className={s.draftList}>
            {mine.map((d) => (
              <Link key={d.id} href={`/taller/mesa?draft=${d.id}`} className={s.draft}>
                <FormatGlyph type={d.type} size={15} />
                <span className={s.draftTitle} data-empty={!d.item.title.trim() || undefined}>
                  {d.item.title.trim() || `${FORMAT_LABEL[d.type]} sin título`}
                </span>
                {d.publishedId ? <span className={s.badge}>Cambios</span> : d.state === 'pendiente' ? <span className={s.badge}>Pendiente</span> : <span />}
                <span className={s.draftMeta}>{ago(d.updatedAt, now)}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

const LADDER: Array<{ role: User['role'] | 'guide-insider'; label: string; opens: string }> = [
  { role: 'user', label: 'Lector', opens: 'Comenta, reacciona, guarda, calibra la energía, abre hilos en el foro.' },
  { role: 'curator', label: 'Curador', opens: 'Además publica listas, con su encuesta, y abre tienda.' },
  { role: 'guide-insider', label: 'Guía · Insider', opens: 'Opiniones, mixes, noticias, eventos, reseñas, editoriales y artículos. Guía es la voz de la casa; insider, la de la escena.' },
  { role: 'admin', label: 'Admin', opens: 'Todo, y asigna roles.' },
]

/** The honest gate: what this format needs, where you are, how voice is earned. */
export function SinVoz({ me, type }: { me: User; type: ContentType }) {
  const t = type as Formato
  const mine = me.role === 'guide' || me.role === 'insider' ? 'guide-insider' : me.role
  const canList = perm.canCreateContent(me, 'listicle')
  return (
    <section className={s.voz} aria-label={`Por qué aún no puedes publicar ${FORMAT_PLURAL[t].toLowerCase()}`}>
      <div className={s.vozText}>
        <span className={s.kicker}>
          <FormatGlyph type={t} size={13} /> {FORMAT_LABEL[t]}
        </span>
        <h2 className={s.vozTitle}>Esta voz todavía no es tuya.</h2>
        <p className={s.vozBody}>
          {FORMAT_PLURAL[t]}: <b>{VOZ[t]}</b> Hoy escribes como <b>{ROLE_LABEL[me.role].toLowerCase()}</b>.
        </p>
        <p className={s.vozBody}>
          En Gradiente la voz se gana participando, no se compra ni se pide por formulario: comenta, calibra, publica lo que tu rol ya permite. Las etiquetas van en las personas, nunca como peso en
          el contenido. Si sientes que ya es tu momento, háblalo con alguien del equipo.
        </p>
        <div className={s.actions}>
          {canList && t !== 'listicle' ? (
            <Button variant="ink" href="/taller/mesa?tipo=listicle" iconRight={<Mark name="arrow" size={14} />}>
              Escribir una lista
            </Button>
          ) : null}
          <Button variant="ghost" href="/taller">
            Volver al taller
          </Button>
        </div>
      </div>
      <ol className={s.ladder} aria-label="Cómo se gana la voz">
        {LADDER.map((r) => (
          <li key={r.label} className={s.rung} data-me={r.role === mine || undefined}>
            <b>{r.label}</b>
            <span>{r.opens}</span>
          </li>
        ))}
        {me.franjaId ? (
          <li className={s.rung}>
            <b>Tu franja</b>
            <span>Su equipo publica eventos, mixes, noticias, opiniones y listas con el nombre de la franja.</span>
          </li>
        ) : null}
      </ol>
    </section>
  )
}
