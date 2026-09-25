/**
 * Deterministic string → [0, 1) hash (FNV-1a folded with a murmur finish).
 *
 * For anything that must look varied but read the same on every load and on
 * both sides of hydration: sticker designs derived from a franja's id, a
 * print's grain, a stagger. Never for anything that needs to be unguessable.
 */
export function hash01(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  h ^= h >>> 13
  h = Math.imul(h, 0x5bd1e995)
  h ^= h >>> 15
  return (h >>> 0) / 4294967296
}
