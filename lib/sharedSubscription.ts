// Share one external subscription per key. Each consumer owns one release.
export function createSharedSubscription(start: (key: string) => () => void) {
  const entries = new Map<string, { count: number; stop: () => void }>()
  return (key: string): (() => void) => {
    let entry = entries.get(key)
    if (!entry) {
      entry = { count: 0, stop: start(key) }
      entries.set(key, entry)
    }
    entry.count += 1
    const owned = entry
    let released = false
    return () => {
      if (released) return
      released = true
      owned.count -= 1
      if (owned.count === 0) {
        entries.delete(key)
        owned.stop()
      }
    }
  }
}
