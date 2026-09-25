'use client'

/**
 * PUBLICAR — your whole body of work. Published and drafts, sorted by date,
 * title or format, filtered by format, paged. The view lives in the URL so
 * it survives the trip to the Mesa and back.
 */

import { useMemo, useRef } from 'react'
import type { ContentItem, ContentType, Draft, User } from '@/lib/types'
import { perm } from '@/lib/store/session'
import { FormatGlyph, FORMAT_LABEL, FORMAT_PLURAL, Mark } from '@/components/kit/Glyph'
import { Button } from '@/components/kit/Button'
import { Select } from '@/components/kit/Field'
import { Revelado } from '@/components/trama/Revelado'
import { Latch, Vacio } from './kit'
import { BorradorCard, PiezaCard } from './PiezaMesa'
import { COMPOSE_TYPES, pieceCodes, plural, useTallerParams } from './logic'
import styles from './Publicar.module.css'

type Coleccion = 'publicadas' | 'borradores'
type Orden = 'fecha' | 'titulo' | 'formato'
type Row = { kind: 'pieza'; id: string; item: ContentItem; date: string } | { kind: 'borrador'; id: string; draft: Draft; item: ContentItem; date: string }

const PER_PAGE = 12
const ORDENES: Orden[] = ['fecha', 'titulo', 'formato']

export function PublicarSpace({ me, now, pieces, drafts }: { me: User; now: Date; pieces: ContentItem[]; drafts: Draft[] }) {
  const { params, set } = useTallerParams()
  const gridRef = useRef<HTMLDivElement>(null)

  const coleccion: Coleccion = params.get('coleccion') === 'borradores' ? 'borradores' : 'publicadas'
  const rawOrden = params.get('orden') as Orden | null
  const orden: Orden = rawOrden && ORDENES.includes(rawOrden) ? rawOrden : 'fecha'
  const rawFormato = params.get('formato') as ContentType | null
  const formato: ContentType | null = rawFormato && COMPOSE_TYPES.includes(rawFormato) ? rawFormato : null
  const pagina = Math.max(1, Number.parseInt(params.get('pagina') ?? '1', 10) || 1)

  const base: Row[] = useMemo(
    () =>
      coleccion === 'publicadas'
        ? pieces.map((item) => ({ kind: 'pieza' as const, id: item.id, item, date: item.publishedAt }))
        : drafts.map((draft) => ({ kind: 'borrador' as const, id: draft.id, draft, item: draft.item, date: draft.updatedAt })),
    [coleccion, pieces, drafts],
  )
  const present = useMemo(() => COMPOSE_TYPES.filter((t) => base.some((r) => r.item.type === t)), [base])

  const rows = useMemo(() => {
    const out = formato ? base.filter((r) => r.item.type === formato) : [...base]
    const byDate = (a: Row, b: Row) => b.date.localeCompare(a.date)
    if (orden === 'titulo') out.sort((a, b) => (a.item.title || '').localeCompare(b.item.title || '', 'es', { sensitivity: 'base' }) || byDate(a, b))
    else if (orden === 'formato') out.sort((a, b) => COMPOSE_TYPES.indexOf(a.item.type) - COMPOSE_TYPES.indexOf(b.item.type) || byDate(a, b))
    else out.sort(byDate)
    return out
  }, [base, formato, orden])

  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE))
  const page = Math.min(pagina, pages)
  const visible = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const creatable = COMPOSE_TYPES.filter((t) => perm.canCreateContent(me, t))
  const codes = useMemo(() => pieceCodes(pieces), [pieces])

  const toPage = (p: number) => {
    set({ pagina: p > 1 ? String(p) : null })
    gridRef.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }

  return (
    <div className={styles.publicar}>
      <header className={styles.head} data-rise="">
        <div className={styles.headText}>
          <Revelado as="h2" className={styles.title}>
            Tu obra
          </Revelado>
          <p className={styles.sub}>
            {plural(pieces.length, 'pieza publicada', 'piezas publicadas')} · {plural(drafts.length, 'borrador', 'borradores')}
          </p>
        </div>
        {creatable.length ? (
          <div className={styles.nueva} aria-label="Nueva pieza">
            <span className="label" style={{ color: 'var(--ink-3)' }}>
              Nueva
            </span>
            <div className={styles.nuevaList}>
              {creatable.map((t) => (
                <Button key={t} variant="ghost" size="sm" href={`/taller/mesa?tipo=${t}`} icon={<FormatGlyph type={t} size={13} />}>
                  {FORMAT_LABEL[t]}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </header>

      <div className={styles.toolbar} data-rise="">
        <Latch<Coleccion>
          label="Colección"
          value={coleccion}
          onChange={(v) => set({ coleccion: v === 'publicadas' ? null : v, formato: null, pagina: null })}
          options={[
            { value: 'publicadas', label: <>Publicadas <span className={styles.n}>{pieces.length}</span></> },
            { value: 'borradores', label: <>Borradores <span className={styles.n}>{drafts.length}</span></> },
          ]}
        />
        <div className={styles.orden}>
          <Select
            label="Ordenar"
            value={orden}
            onChange={(e) => set({ orden: e.target.value === 'fecha' ? null : e.target.value, pagina: null })}
            options={[
              { value: 'fecha', label: coleccion === 'borradores' ? 'Último guardado' : 'Fecha de publicación' },
              { value: 'titulo', label: 'Título (A–Z)' },
              { value: 'formato', label: 'Formato' },
            ]}
          />
        </div>
        {present.length > 1 ? (
          <div className={styles.formatos}>
            <Latch<string>
              label="Formato"
              size="sm"
              value={formato ?? 'todos'}
              onChange={(v) => set({ formato: v === 'todos' ? null : v, pagina: null })}
              options={[
                { value: 'todos', label: 'Todos' },
                ...present.map((t) => ({
                  value: t,
                  label: (
                    <>
                      <FormatGlyph type={t} size={12} />
                      {FORMAT_PLURAL[t]}
                    </>
                  ),
                })),
              ]}
            />
          </div>
        ) : null}
      </div>

      <div ref={gridRef} className={styles.gridWrap} data-rise="">
        {rows.length === 0 ? (
          formato ? (
            <Vacio action={<Button variant="ghost" size="sm" onClick={() => set({ formato: null, pagina: null })}>Todos los formatos</Button>}>
              Ninguna pieza en este formato.
            </Vacio>
          ) : coleccion === 'borradores' ? (
            <Vacio>No tienes borradores. Lo que empieces en la Mesa se guarda solo y te espera aquí.</Vacio>
          ) : (
            <Vacio>Aún no publicas. Tu primera pieza empieza en la Mesa: elige un formato arriba.</Vacio>
          )
        ) : (
          <ul className={styles.grid} key={`${coleccion}:${orden}:${formato ?? ''}:${page}`}>
            {visible.map((r, i) => (
              <li key={r.id} style={{ ['--i' as string]: i }}>
                {r.kind === 'pieza' ? <PiezaCard item={r.item} me={me} now={now} code={codes.get(r.item.id)} priority={i < 4} /> : <BorradorCard draft={r.draft} now={now} />}
              </li>
            ))}
          </ul>
        )}
      </div>

      {pages > 1 ? (
        <nav className={styles.pager} aria-label="Páginas de tu obra">
          <Button variant="quiet" size="sm" disabled={page <= 1} onClick={() => toPage(page - 1)} icon={<span className={styles.flip}><Mark name="arrow" size={13} /></span>}>
            Anteriores
          </Button>
          <ol className={styles.pages}>
            {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
              <li key={p}>
                <button type="button" className={styles.pageBtn} aria-current={p === page ? 'page' : undefined} onClick={() => toPage(p)} aria-label={`Página ${p} de ${pages}`}>
                  {p}
                </button>
              </li>
            ))}
          </ol>
          <Button variant="quiet" size="sm" disabled={page >= pages} onClick={() => toPage(page + 1)} iconRight={<Mark name="arrow" size={13} />}>
            Siguientes
          </Button>
        </nav>
      ) : null}
    </div>
  )
}
