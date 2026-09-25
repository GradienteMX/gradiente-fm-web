'use client'

import { useSyncExternalStore } from 'react'

const noop = () => () => {}

/** A media query, read on the client without a mount-time state flip. */
export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  )
}

export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}

/**
 * A value that only exists in the browser (localStorage, navigator…), read
 * once per render without a hydration mismatch. `get` must be cheap and
 * return a primitive.
 */
export function useClientValue<T extends string | number | boolean | null>(get: () => T, serverValue: T): T {
  return useSyncExternalStore(noop, get, () => serverValue)
}

/** False on the server and during hydration, true once the browser owns the tree. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  )
}
