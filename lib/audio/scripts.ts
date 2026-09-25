/**
 * Third-party player APIs are loaded once, on demand, and shared. A failed
 * load is forgotten so a later attempt (a new play) can retry honestly.
 */

const cache = new Map<string, Promise<void>>()

export function loadScript(src: string): Promise<void> {
  if (typeof document === 'undefined') return Promise.reject(new Error('sin documento'))
  const hit = cache.get(src)
  if (hit) return hit
  const p = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    const s = existing ?? document.createElement('script')
    const done = () => {
      s.dataset.loaded = '1'
      resolve()
    }
    if (existing?.dataset.loaded === '1') return resolve()
    s.addEventListener('load', done, { once: true })
    s.addEventListener(
      'error',
      () => {
        cache.delete(src)
        s.remove()
        reject(new Error(`no cargó ${src}`))
      },
      { once: true },
    )
    if (!existing) {
      s.src = src
      s.async = true
      document.head.appendChild(s)
    }
  })
  cache.set(src, p)
  return p
}
