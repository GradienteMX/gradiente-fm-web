/**
 * Text helpers for the section surfaces. Search in Spanish must forgive
 * accents and case: «fünk» finds «Funk», «musica» finds «Música».
 */

/** Letters that NFD does not decompose into base + mark. */
const TRANSLIT: Record<string, string> = {
  ø: 'o',
  æ: 'ae',
  œ: 'oe',
  ß: 'ss',
  ł: 'l',
  đ: 'd',
  þ: 'th',
  ı: 'i',
}

/** Lowercase, accent-free, transliterated — for matching, never for display. */
export function fold(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[øæœßłđþı]/g, (c) => TRANSLIT[c] ?? c)
}

/** Every piece of text a person might type to find an event. */
export function eventHaystack(e: { title: string; venue?: string; venueCity?: string; artists?: string[] }): string {
  return fold([e.title, e.venue, e.venueCity, ...(e.artists ?? [])].filter(Boolean).join(' · '))
}

/** "uno", "dos"… for small counts in prose; digits past twelve. */
const WORDS = ['cero', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce']
export function countWord(n: number): string {
  return n >= 0 && n < WORDS.length ? WORDS[n] : String(n)
}

export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}
