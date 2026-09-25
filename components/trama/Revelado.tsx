'use client'

import { createElement, useRef, type HTMLAttributes, type ReactNode } from 'react'
import type { Dir } from './engine'
import type { Preset } from './api'
import { useRevelar, type Trigger } from './hooks'

type Tag = 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'div' | 'strong' | 'em'

export interface ReveladoProps extends HTMLAttributes<HTMLElement> {
  as?: Tag
  preset?: Preset
  /** Energy 0..10: silhouettes print in its ink before cooling to ink. */
  energy?: number
  dir?: Dir
  delay?: number
  duration?: number
  trigger?: Trigger
  /** Replay when this changes (defaults to the text itself). */
  replay?: unknown
  children?: ReactNode
}

/** Real text that prints itself out of blocks, then stays plain DOM. */
export function Revelado({ as = 'span', preset, energy, dir, delay, duration, trigger, replay, children, ...rest }: ReveladoProps) {
  const ref = useRef<HTMLElement>(null)
  useRevelar(ref, {
    preset,
    energy,
    dir,
    delay,
    duration,
    trigger,
    replay: replay ?? (typeof children === 'string' ? children : undefined),
  })
  return createElement(as, { ref, 'data-trama': 'pendiente', ...rest }, children)
}
