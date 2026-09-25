'use client'

import { useEffect, type RefObject } from 'react'
import { getStage, type StageWindow } from './engine'

/** Emit a flare in the field at an element's center (or a point). */
export function flare(target: Element | { x: number; y: number } | null | undefined, energy: number) {
  if (!target) return
  let x: number
  let y: number
  if ('getBoundingClientRect' in target) {
    const r = target.getBoundingClientRect()
    x = r.left + r.width / 2
    y = r.top + r.height / 2
  } else {
    x = target.x
    y = target.y
  }
  getStage().flare(x, y, energy)
}

export function setFieldDim(v: number) {
  getStage().setDim(v)
}

export function setFieldIntensity(v: number) {
  getStage().setIntensity(v)
}

export function setFieldAudio(low: number, mid: number, high: number, level: number) {
  getStage().setAudio(low, mid, high, level)
}

/**
 * Register a DOM-tracked GL window. The factory receives the element and
 * returns the window definition; it's torn down with the component.
 */
export function useStageWindow(
  ref: RefObject<HTMLElement | null>,
  factory: (el: HTMLElement) => (Omit<StageWindow, 'el'> & { dispose?: () => void }) | null,
  deps: unknown[] = [],
) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const def = factory(el)
    if (!def) return
    const off = getStage().addWindow({ ...def, el })
    return () => {
      off()
      def.dispose?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
