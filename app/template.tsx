'use client'

import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import gsap from 'gsap'
import { libreaDe } from '@/lib/librea'
import { Relevo } from '@/components/librea/Relevo'

/**
 * Every route feeds in like a sheet through the platen (a short stepped wipe
 * from the top). Changing SECTION is louder: the incoming livery's slabs
 * hand the page over (Relevo). Templates remount per navigation; `?item=`
 * readings don't navigate, so they never trigger either.
 */
export default function Template({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const pathname = usePathname() ?? '/'
  useLayoutEffect(() => {
    // Development only: lets headless checks slow choreography down.
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __gsap?: typeof gsap }).__gsap = gsap
    const el = ref.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const tw = gsap.fromTo(
      el,
      { clipPath: 'inset(0 0 100% 0)' },
      { clipPath: 'inset(0 0 0% 0)', duration: 0.28, ease: 'steps(6)', clearProps: 'clipPath' },
    )
    return () => {
      tw.kill()
    }
  }, [])
  return (
    <>
      <div ref={ref}>{children}</div>
      <Relevo librea={libreaDe(pathname)} />
    </>
  )
}
