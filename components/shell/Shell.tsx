'use client'

import { Suspense, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { Nav } from './Nav'
import { Acceso } from './Acceso'
import { Buscador } from './Buscador'
import { Dialogo } from './Dialogo'
import { Reportar } from './Reportar'
import { Avisos } from './Avisos'
import { Atajos } from './Atajos'
import { Colofon } from './Colofon'
import { LecturaHost } from '@/components/lectura/LecturaHost'
import { Consola } from '@/components/consola/Consola'
import styles from './Shell.module.css'

/** Routes that bring their own full-screen chrome (no nav). */
const IMMERSIVE = ['/welcome', '/espera', '/mapa']

/** Full work surfaces: no colophon at the foot (the composer). */
const NO_COLOFON = ['/taller/mesa']

/** Global chrome + everything that must survive navigation. */
export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/'
  const immersive = IMMERSIVE.some((p) => pathname.startsWith(p))
  const colofon = !immersive && !NO_COLOFON.some((p) => pathname.startsWith(p))

  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skip}>
        Saltar al contenido
      </a>
      {immersive ? null : <Nav />}
      <main id="main" className={styles.main}>
        {children}
      </main>
      {colofon ? <Colofon /> : null}
      <Consola />
      <Suspense fallback={null}>
        <LecturaHost />
      </Suspense>
      <Acceso />
      <Buscador />
      <Dialogo />
      <Reportar />
      <Atajos />
      <Avisos />
    </div>
  )
}
