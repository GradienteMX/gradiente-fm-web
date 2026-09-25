'use client'

/**
 * Tiny external stores for the few things that change at pointer speed
 * (hovered piece, keyboard cursor, zoom). Components subscribe to exactly
 * the value they show — the terrain surface itself never re-renders on hover.
 */

import { useSyncExternalStore } from 'react'

export interface Cell<T> {
  get(): T
  set(v: T): void
  subscribe(fn: () => void): () => void
}

export function cell<T>(initial: T): Cell<T> {
  let value = initial
  const subs = new Set<() => void>()
  return {
    get: () => value,
    set: (v) => {
      if (Object.is(v, value)) return
      value = v
      subs.forEach((f) => f())
    },
    subscribe: (fn) => {
      subs.add(fn)
      return () => subs.delete(fn)
    },
  }
}

export function useCell<T>(c: Cell<T>): T {
  return useSyncExternalStore(c.subscribe, c.get, c.get)
}
