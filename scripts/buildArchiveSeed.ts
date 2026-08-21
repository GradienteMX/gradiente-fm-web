// Archivo Vivo 2005-2013 → /mapa seed converter.
//
// Reads the living-archive pilot (gradiente-ops, branch living-archive-pilot)
// and emits `lib/data/archiveSeed.json`: ContentItem-shaped rows for the map.
// Deterministic and re-runnable, no model calls — same posture as the
// archive's own tools/. See living-archive/MANUAL.md for the data contract;
// the parts honored here:
//
//   · visible credit — author blog + original date ride the item (`author`,
//     `publishedAt`) and the CONTEXTO links carry blog + Wayback URLs;
//   · excerpt + link + attribution, never the full text (`bodyPreview` =
//     excerpt; body_html is NOT copied);
//   · platform occupies the venue slot (`venue` = hosted_on entity);
//   · artists/labels become EntityRefs (first-class, affinity-bearing);
//   · `mentions` is NOT used as HL (archive items carry no hp at all —
//     they decay naturally from their 2010-era publishedAt to the map rim).
//
// Images: the original CDNs (rackcdn/cdn.alteredzones.com) are dead. Each
// candidate is rewritten through Wayback's `im_` modifier at the post's
// capture timestamp and VERIFIED with a polite, throttled fetch (sequential,
// 500ms delay — the Internet Archive rate-limits aggressively; keep the
// pauses). Results are cached in lib/data/archiveImageCache.json so re-runs
// are instant and offline. Posts with no recoverable image are EXCLUDED —
// /mapa's terrain is image-only by rule.
//
// Run: npx tsx scripts/buildArchiveSeed.ts [path-to-living-archive]

import * as fs from 'node:fs'
import * as path from 'node:path'

const ARCHIVE_DIR =
  process.argv[2] ??
  path.join(
    process.env.HOME ?? '~',
    'Documents/gradiente-ops-main/living-archive',
  )
const OUT_PATH = path.join(process.cwd(), 'lib/data/archiveSeed.json')
const CACHE_PATH = path.join(process.cwd(), 'lib/data/archiveImageCache.json')

interface AzPost {
  post_id: number | string
  title: string
  slug: string
  blog_slug: string
  published_at: string
  original_url: string
  wayback_url: string
  captured_at: string
  excerpt: string
  images: string[]
  tags: string[]
}

interface EntityRow {
  entity_key: string
  name: string
  entity_type: string
  canonical_url: string
}

// Minimal CSV parser (no quoting edge cases beyond doubled quotes — the
// archive CSVs are machine-written and regular).
function parseCsv(file: string): Record<string, string>[] {
  const text = fs.readFileSync(file, 'utf8')
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0)
  const parseLine = (line: string): string[] => {
    const out: string[] = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"'
          i++
        } else if (ch === '"') inQ = false
        else cur += ch
      } else if (ch === '"') inQ = true
      else if (ch === ',') {
        out.push(cur)
        cur = ''
      } else cur += ch
    }
    out.push(cur)
    return out
  }
  const header = parseLine(lines[0])
  return lines.slice(1).map((l) => {
    const cells = parseLine(l)
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']))
  })
}

function waybackImageUrl(originalSrc: string, capturedAt: string): string {
  const ts = capturedAt.replace(/[^0-9]/g, '').slice(0, 14)
  return `https://web.archive.org/web/${ts}im_/${originalSrc}`
}

function youtubeThumb(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/,
  )
  return m ? `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` : null
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function verifyImage(
  url: string,
  cache: Record<string, boolean>,
): Promise<boolean> {
  if (url in cache) return cache[url]
  let ok = false
  for (let attempt = 0; attempt < 2 && !ok; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(20_000),
      })
      const type = res.headers.get('content-type') ?? ''
      ok = res.ok && type.startsWith('image/')
      if (res.status === 429) {
        // Backing off hard — the archive is throttling us.
        await sleep(15_000)
        ok = false
        continue
      }
      break
    } catch {
      await sleep(3_000)
    }
  }
  cache[url] = ok
  await sleep(500) // keep the pauses (MANUAL §3)
  return ok
}

async function main() {
  const dataDir = path.join(ARCHIVE_DIR, 'data')
  const posts: AzPost[] = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'az_posts.json'), 'utf8'),
  )
  const entities = parseCsv(path.join(dataDir, 'entities.csv')) as unknown as EntityRow[]
  const postEntities = parseCsv(path.join(dataDir, 'post_entities.csv'))
  const mediaLinks = parseCsv(path.join(dataDir, 'media_links.csv'))
  const cache: Record<string, boolean> = fs.existsSync(CACHE_PATH)
    ? JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'))
    : {}

  const entityByKey = new Map(entities.map((e) => [e.entity_key, e]))
  const relationsByPost = new Map<string, Record<string, string>[]>()
  for (const pe of postEntities) {
    const list = relationsByPost.get(pe.post_id) ?? []
    list.push(pe)
    relationsByPost.set(pe.post_id, list)
  }
  const mediaByPost = new Map<string, Record<string, string>[]>()
  for (const ml of mediaLinks) {
    const list = mediaByPost.get(ml.post_id) ?? []
    list.push(ml)
    mediaByPost.set(ml.post_id, list)
  }

  const out: unknown[] = []
  let skippedNoImage = 0
  const sorted = [...posts].sort((a, b) =>
    Number(a.post_id) - Number(b.post_id),
  )

  for (const post of sorted) {
    const pid = String(post.post_id)
    const rels = relationsByPost.get(pid) ?? []

    // Candidate images: post art via Wayback im_, then YouTube thumbnails.
    const candidates: string[] = []
    for (const src of post.images ?? []) {
      if (src.startsWith('http')) {
        candidates.push(waybackImageUrl(src, post.captured_at))
      }
    }
    for (const ml of mediaByPost.get(pid) ?? []) {
      if (ml.kind === 'youtube') {
        const t = youtubeThumb(ml.url)
        if (t) candidates.push(t)
      }
    }
    let imageUrl: string | null = null
    for (const c of candidates) {
      // eslint-disable-next-line no-await-in-loop
      if (await verifyImage(c, cache)) {
        imageUrl = c
        break
      }
    }
    if (!imageUrl) {
      skippedNoImage++
      continue // image-only terrain rule
    }

    const byRole = (role: string) =>
      rels
        .filter((r) => r.role === role)
        .map((r) => entityByKey.get(r.entity_key))
        .filter((e): e is EntityRow => !!e)

    const blog = byRole('published_by')[0]
    const platform = byRole('hosted_on')[0]
    const slugOf = (key: string) => key.split(':')[1] ?? key

    const entityRefs = [
      ...byRole('artist').map((e) => ({
        id: `az:${e.entity_key}`,
        kind: 'artist' as const,
        name: e.name,
        slug: `az-${slugOf(e.entity_key)}`,
      })),
      ...byRole('label').map((e) => ({
        id: `az:${e.entity_key}`,
        kind: 'label' as const,
        name: e.name,
        slug: `az-${slugOf(e.entity_key)}`,
      })),
    ]

    const links = [
      ...(blog?.canonical_url
        ? [{ label: `Publicado por ${blog.name}`, url: blog.canonical_url }]
        : []),
      { label: 'Fuente archivada · Wayback Machine', url: post.wayback_url },
    ]

    out.push({
      id: `az-${pid}`,
      slug: `az-${post.slug}`.slice(0, 96),
      type: 'articulo',
      source: 'archive:wayback',
      title: post.title,
      // Unrated era content — wide neutral band, flagged in the wiki.
      vibeMin: 3,
      vibeMax: 7,
      genres: [],
      // AZ-era tags ride along for display; they are outside the Gradiente
      // taxonomy so tag-affinity deliberately ignores them.
      tags: (post.tags ?? []).map((t) => `az-${t}`).slice(0, 6),
      entities: entityRefs,
      links,
      imageUrl,
      publishedAt: `${post.published_at}T12:00:00Z`,
      author: blog?.name ?? post.blog_slug,
      createdById: `az-blog:${post.blog_slug}`,
      venue: platform?.name ?? 'Altered Zones',
      bodyPreview: post.excerpt,
      excerpt: post.excerpt,
    })
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 1))
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 1))
  console.log(
    `archiveSeed: ${out.length} items written · ${skippedNoImage} posts excluded (no recoverable image) · cache ${Object.keys(cache).length} urls`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
