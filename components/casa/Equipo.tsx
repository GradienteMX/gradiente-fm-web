'use client'

/**
 * /equipo — who writes this. Handles and GitHub links are real; roles in
 * the site come from the live roster; bios are owed until each person
 * writes their own.
 */

import Link from 'next/link'
import { useWorld } from '@/lib/store/world'
import { Mark } from '@/components/kit/Glyph'
import { ROLE_LABEL } from '@/components/kit/Persona'
import { EnergyTitle } from '@/components/secciones/EnergyTitle'
import { CasaDoc, P, SinRedactar, type Apartado } from './CasaDoc'
import styles from './Casa.module.css'
import eq from './Equipo.module.css'

/**
 * `handle` is the GitHub handle; `usuario` the username on the site, when it
 * differs. A person whose account isn't found simply shows no role or
 * credencial link — never a guessed one.
 */
const PERSONAS: Array<{ handle: string; usuario?: string; papel: string }> = [
  { handle: 'datavismo-cmyk', papel: 'Dirección · curaduría' },
  { handle: 'hzamorate', papel: 'Colaboración' },
  { handle: 'ikerio', papel: 'Colaboración' },
]

function Persona({ handle, usuario, papel, i }: { handle: string; usuario?: string; papel: string; i: number }) {
  const name = (usuario ?? handle).toLowerCase()
  const user = useWorld((s) => Object.values(s.world.users).find((u) => u.username.toLowerCase() === name) ?? null)
  return (
    <li className={eq.persona}>
      <span className={eq.num}>{String(i + 1).padStart(2, '0')}</span>
      <div className={eq.main}>
        <p className={eq.handle}>@{handle}</p>
        <p className={eq.papel}>
          {papel}
          {user ? <span className={eq.role}>{ROLE_LABEL[user.role]} en el sitio</span> : null}
        </p>
        <p className={eq.bio}>
          <SinRedactar note={`bio de @${handle}, escrita por @${handle}`} />
        </p>
      </div>
      <div className={eq.links}>
        <a href={`https://github.com/${handle}`} target="_blank" rel="noopener noreferrer" className={eq.link}>
          github.com/{handle}
          <Mark name="external" size={13} />
        </a>
        {user ? (
          <Link href={`/u/${user.username}`} className={eq.link}>
            Credencial
            <Mark name="arrow" size={13} />
          </Link>
        ) : null}
      </div>
    </li>
  )
}

const APARTADOS: Apartado[] = [
  {
    id: 'personas',
    title: 'Personas',
    content: (
      <ol className={eq.lista}>
        {PERSONAS.map((p, i) => (
          <Persona key={p.handle} {...p} i={i} />
        ))}
      </ol>
    ),
  },
  {
    id: 'sumarse',
    title: 'Sumarse',
    content: (
      <>
        <P>
          Gradiente se construye desde adentro de la escena: DJs, sellos, promotoras, espacios, gente que escribe y gente que escucha en serio.
          Si ya haces algo, aquí tiene lugar.
        </P>
        <P>
          <SinRedactar note="mecanismo de contacto para sumarse al equipo, cuando exista" />
        </P>
      </>
    ),
  },
]

function Hero() {
  return (
    <>
      <div>
        <EnergyTitle text="Quién escribe esto." energy={4} max={150} share={0.95} />
      </div>
      <p className={styles.heroLede}>
        Gente que va, escucha, escribe y a veces toca. No una redacción.
      </p>
    </>
  )
}

export function Equipo() {
  return <CasaDoc kicker="Equipo" hero={<Hero />} apartados={APARTADOS} indice={false} sweep={[4, 6]} colofon={<p>GRADIENTE · CDMX · 2026</p>} />
}
