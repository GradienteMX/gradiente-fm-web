/**
 * Reading whole tables through PostgREST without silently losing rows.
 *
 * PostgREST answers at most `max_rows` rows per request (1000, Supabase's
 * default) and says nothing when it cuts a result short. The world loaders
 * read whole tables (the catalog, the HL ledger…), so they page until a short
 * page comes back. And `.in()` lists travel in the URL: a long one is split,
 * so a growing catalog never outgrows the request line.
 */

/** Rows per page — the project's `max_rows` (Supabase default). Lowering that setting means lowering this. */
export const PAGE_ROWS = 1000

/** Ids per `.in()` request. */
export const IN_CHUNK = 200

type PageResult = { data: unknown; error: { message: string } | null }

/**
 * Every row of a query, page by page. `page(from, to)` must apply `.range(from, to)`
 * to a query with a TOTAL order (end with a unique key) or pages can overlap or skip.
 */
export async function readAll<T>(page: (from: number, to: number) => PromiseLike<PageResult>): Promise<{ rows: T[]; error: { message: string } | null }> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_ROWS) {
    const { data, error } = await page(from, from + PAGE_ROWS - 1)
    if (error) return { rows, error }
    const got = (data ?? []) as T[]
    rows.push(...got)
    if (got.length < PAGE_ROWS) return { rows, error: null }
  }
}

/** Split a list for `.in()` filters. */
export function chunked<T>(xs: T[], size = IN_CHUNK): T[][] {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size))
  return out
}
