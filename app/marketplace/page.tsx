import { redirect } from 'next/navigation'

/**
 * /marketplace → /mercado, query preserved. The old detail param `listing`
 * is the new `pieza`, so shared links from the previous site still land on
 * the same listing.
 */
export default async function MarketplaceRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const q = new URLSearchParams()
  for (const [key, value] of Object.entries(sp)) {
    const k = key === 'listing' && sp.pieza === undefined ? 'pieza' : key
    if (Array.isArray(value)) value.forEach((v) => q.append(k, v))
    else if (value !== undefined) q.append(k, value)
  }
  const s = q.toString()
  redirect(s ? `/mercado?${s}` : '/mercado')
}
