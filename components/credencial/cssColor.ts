/**
 * The palette lives in CSS custom properties; canvas and GLSL can't read
 * them. This resolves any CSS color expression (including `var(--ink)`,
 * `color-mix(…)`, oklch…) to bytes by letting the browser compute it and
 * painting it on a 1×1 canvas. Called at paint/mount time, so a global
 * palette flip reaches the printed card and the wheel without code changes.
 */

export type RGBA = [number, number, number, number]

let probeCanvas: CanvasRenderingContext2D | null = null

export function resolveColor(expr: string, fallback: RGBA = [0, 0, 0, 1]): RGBA {
  if (typeof document === 'undefined' || !document.body) return fallback
  try {
    const probe = document.createElement('span')
    probe.style.display = 'none'
    probe.style.color = expr
    document.body.appendChild(probe)
    const computed = getComputedStyle(probe).color
    probe.remove()
    if (!computed) return fallback
    if (!probeCanvas) {
      const c = document.createElement('canvas')
      c.width = c.height = 1
      probeCanvas = c.getContext('2d', { willReadFrequently: true })
    }
    const x = probeCanvas
    if (!x) return fallback
    x.clearRect(0, 0, 1, 1)
    x.fillStyle = '#000'
    x.fillStyle = computed
    x.fillRect(0, 0, 1, 1)
    const d = x.getImageData(0, 0, 1, 1).data
    return [d[0], d[1], d[2], d[3] / 255]
  } catch {
    return fallback
  }
}

/** `rgba()` for canvas from a resolved color, with an extra alpha. */
export function rgba(c: RGBA, alpha = 1): string {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${+(c[3] * alpha).toFixed(4)})`
}

/** Linear mix of two resolved colors (opaque result). */
export function mixRGB(a: RGBA, b: RGBA, t: number): RGBA {
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t), 1]
}

/** 0–1 floats for a shader uniform. */
export function unit(c: RGBA): [number, number, number] {
  return [c[0] / 255, c[1] / 255, c[2] / 255]
}

/** '#rrggbb' / '#rgb' → bytes (no DOM needed). */
export function hexRGBA(hex: string): RGBA {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]
}

/**
 * The card's palette, read from the live tokens: the page (paper), the
 * raised sheet the card is printed on, a sunken tone, and the ink. The
 * TRAMA names come first; the older aliases keep it working meanwhile.
 */
export function paletteNow() {
  return {
    ink: resolveColor('var(--ink)', [17, 17, 17, 1]),
    ground: resolveColor('var(--paper, var(--obs-0))', [237, 235, 227, 1]),
    stock: resolveColor('var(--paper-2, var(--obs-1))', [246, 244, 236, 1]),
    raised: resolveColor('var(--paper-3, var(--obs-2))', [228, 225, 214, 1]),
  }
}

/**
 * The colour actually behind an element: the first ancestor that paints an
 * (almost) opaque background, else the page. The case's thick acrylic
 * paints what's behind it itself, so it has to know.
 */
export function groundBehind(el: Element | null): RGBA {
  let node: Element | null = el
  while (node && node !== document.documentElement) {
    const bg = getComputedStyle(node).backgroundColor
    const c = bg ? resolveColor(bg, [0, 0, 0, 0]) : null
    if (c && c[3] > 0.6) return c
    node = node.parentElement
  }
  const root = getComputedStyle(document.documentElement).backgroundColor
  const body = getComputedStyle(document.body).backgroundColor
  for (const bg of [body, root]) {
    const c = resolveColor(bg, [0, 0, 0, 0])
    if (c[3] > 0.6) return c
  }
  return paletteNow().ground
}

/**
 * Whether an ancestor (inside <body>) paints an opaque background over the
 * element. The stage canvas sits *behind* the DOM (the shell stacks above
 * it), so a painted ancestor hides a GL window completely — the card then
 * has to be the CSS card.
 */
export function paintedOver(el: Element | null): boolean {
  if (typeof document === 'undefined') return false
  let node: Element | null = el?.parentElement ?? null
  while (node && node !== document.body && node !== document.documentElement) {
    const cs = getComputedStyle(node)
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return true
    const c = cs.backgroundColor ? resolveColor(cs.backgroundColor, [0, 0, 0, 0]) : null
    if (c && c[3] > 0.5) return true
    node = node.parentElement
  }
  return false
}

/** A CSS gradient across an energy band built only from the --eN tokens. */
export function bandVars(min: number, max: number, dir = '90deg'): string {
  const lo = Math.max(0, Math.min(10, Math.floor(min)))
  const hi = Math.max(0, Math.min(10, Math.ceil(max)))
  if (hi <= lo) return `var(--e${lo})`
  const stops: string[] = []
  for (let k = lo; k <= hi; k++) stops.push(`var(--e${k})`)
  return `linear-gradient(${dir}, ${stops.join(', ')})`
}

/** The nearest spectrum token for an energy. */
export function energyVar(e: number): string {
  return `var(--e${Math.max(0, Math.min(10, Math.round(e)))})`
}
