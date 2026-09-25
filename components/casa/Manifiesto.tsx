'use client'

/**
 * /manifesto — the editorial declaration, still being written. The prose
 * that exists is the team's; every gap is marked honestly as owed, with a
 * note of what goes there. Nothing is filled in on their behalf.
 */

import { CasaDoc, P, SinRedactar, type Apartado } from './CasaDoc'
import { EnergyTitle } from '@/components/secciones/EnergyTitle'
import styles from './Casa.module.css'

const APARTADOS: Apartado[] = [
  {
    id: 'escena',
    title: 'La escena no es una marca',
    content: (
      <P>
        <SinRedactar note="escena frente a producto institucional · unas 150 palabras" />
      </P>
    ),
  },
  {
    id: 'algoritmo',
    title: 'No hay algoritmo',
    content: (
      <>
        <P>
          La prominencia de cada pieza viene de criterio editorial y decaimiento orgánico. No hay métricas de engagement visibles, no hay likes,
          no hay contadores de «trending». El tamaño y la posición de una tarjeta son las únicas señales.
        </P>
        <P>
          <SinRedactar note="profundizar: por qué rechazamos las métricas" />
        </P>
      </>
    ),
  },
  {
    id: 'guias',
    title: 'Guías, no porteros',
    content: (
      <>
        <P>
          Lo editorial y lo que llega de la escena conviven en la misma cuadrícula. No hay un «feed de redacción» separado del «feed real». El
          editor decide qué siembra y qué deja flotar, pero todo compite por la misma atención del lector.
        </P>
        <P>
          <SinRedactar note="elaborar el contraste con la curaduría de arriba hacia abajo" />
        </P>
      </>
    ),
  },
  {
    id: 'vibe',
    title: 'Vibe antes que género',
    content: (
      <>
        <P>
          Filtramos por sensación, no por taxonomía. Un mix de ambient experimental y un set de techno hipnótico pueden estar lado a lado entre
          fresh y warm, porque a esa hora de la noche, esa es la temperatura.
        </P>
        <P>
          <SinRedactar note="explicar el espectro desde la experiencia de quien baila" />
        </P>
      </>
    ),
  },
  {
    id: 'cdmx',
    title: 'CDMX primero',
    content: (
      <P>
        <SinRedactar note="por qué la CDMX, y qué relación con el resto de Latinoamérica" />
      </P>
    ),
  },
]

function Hero() {
  return (
    <>
      <div>
        <EnergyTitle text="Guías, no porteros." energy={7} max={150} share={0.95} />
      </div>
      <p className={styles.heroLede}>
        Una declaración editorial: qué hacemos, qué no hacemos y por qué importa.
      </p>
      <p className={styles.heroLede}>
        <SinRedactar note="el primer párrafo, el que engancha" />
      </p>
      <p className={styles.version}>
        Versión 0.1 · borrador interno
      </p>
    </>
  )
}

export function Manifiesto() {
  return (
    <CasaDoc
      kicker="Manifiesto editorial"
      hero={<Hero />}
      apartados={APARTADOS}
      sweep={[2, 9]}
      colofon={
        <p>
          Versión 0.1 · borrador interno · <SinRedactar note="fecha y firma del equipo editorial" />
        </p>
      }
    />
  )
}
