'use client'

/**
 * The system, stated by the system. Every figure on these instruments is
 * computed from the running code — the decay math, the permission gates,
 * the rank rule — so the house guide can never drift from what the site
 * actually does. Formats are pictograms; nothing here is colored by hue
 * except energy (and there is no energy here).
 */

import type { ContentType, Role, User, UserRank } from '@/lib/types'
import { currentHp } from '@/lib/curation'
import { perm } from '@/lib/store/session'
import { FormatGlyph, FORMAT_LABEL, FORMAT_PLURAL, RankSigil, RANK_LABEL, RANK_MEANING } from '@/components/kit/Glyph'
import { ROLE_LABEL, ROLE_MEANING } from '@/components/kit/Persona'
import styles from './Sistema.module.css'

const FORMATS: ContentType[] = ['evento', 'mix', 'noticia', 'review', 'editorial', 'opinion', 'articulo', 'listicle']

// ── half-life per format (from currentHp) ───────────────────────────────────

function halfLifeDays(type: ContentType): number {
  const t0 = Date.parse('2026-01-01T00:00:00Z')
  const iso = new Date(t0).toISOString()
  const hp = currentHp({ type, hp: 100, hpLastUpdatedAt: iso, publishedAt: iso }, new Date(t0 + 3_600_000))
  return Math.LN2 / -Math.log(hp / 100) / 24
}

const WINDOW = 30 // days drawn

function curve(h: number): string {
  const pts: string[] = []
  for (let i = 0; i <= 60; i++) {
    const d = (i / 60) * WINDOW
    const y = 38 - 34 * Math.exp((-Math.LN2 * d) / h)
    pts.push(`${((d / WINDOW) * 300).toFixed(1)},${y.toFixed(2)}`)
  }
  return pts.join(' ')
}

const dias = (d: number) => {
  const r = Math.round(d * 10) / 10
  return `${Number.isInteger(r) ? r : r.toFixed(1)} ${r === 1 ? 'día' : 'días'}`
}

export function VidaMedia() {
  const rows = FORMATS.map((t) => ({ t, h: halfLifeDays(t) })).sort((a, b) => a.h - b.h)
  return (
    <figure className={styles.vida}>
      <figcaption className={styles.caption}>
        <span className="label">Vida media por formato</span>
        <span className={styles.captionNote}>Cuánto tarda una pieza en perder la mitad de su vida si nadie la toca. Treinta días a la vista.</span>
      </figcaption>
      <ol className={styles.vidaRows}>
        {rows.map(({ t, h }) => (
          <li key={t} className={styles.vidaRow}>
            <span className={styles.vidaName}>
              <FormatGlyph type={t} size={14} />
              {FORMAT_PLURAL[t]}
            </span>
            <svg className={styles.vidaCurve} viewBox="0 0 300 40" preserveAspectRatio="none" aria-hidden="true">
              <polyline points={`0,40 ${curve(h)} 300,40`} className={styles.vidaArea} />
              <polyline points={curve(h)} className={styles.vidaLine} />
              <line x1={(Math.min(h, WINDOW) / WINDOW) * 300} x2={(Math.min(h, WINDOW) / WINDOW) * 300} y1="2" y2="40" className={styles.vidaHalf} />
            </svg>
            <span className={styles.vidaDays}>{dias(h)}</span>
          </li>
        ))}
      </ol>
      <p className={styles.vidaFoot}>
        Los eventos llevan su propio reloj: la caída se frena conforme se acerca la noche, se congela mientras suena y se acelera cuando la noche ya
        es archivo.
      </p>
    </figure>
  )
}

// ── who publishes what (from the permission gates) ──────────────────────────

const ROLES: Role[] = ['user', 'curator', 'guide', 'insider', 'admin']
const persona = (role: Role, franjaId?: string): User => ({ id: 'casa', username: 'casa', displayName: 'casa', role, joinedAt: '2026-01-01T00:00:00Z', franjaId })

export function Roles() {
  const rows: Array<{ key: string; name: string; meaning: string; can: (t: ContentType) => boolean }> = [
    ...ROLES.map((r) => ({
      key: r,
      name: ROLE_LABEL[r],
      meaning: ROLE_MEANING[r],
      can: (t: ContentType) => perm.canCreateContent(persona(r), t),
    })),
    {
      key: 'franja',
      name: 'Equipo de franja',
      meaning: 'Sellos, venues, promotoras y colectivos publican desde su propio espacio, con su nombre al frente.',
      can: (t: ContentType) => perm.canCreateContent(persona('user', 'franja'), t),
    },
  ]
  return (
    <div className={styles.rolesWrap}>
      <table className={styles.roles}>
        <caption className={styles.tcaption}>
          <span className="label">Quién publica qué</span>
          <span className={styles.captionNote}>Cada nivel hereda el anterior. Leído directo de las reglas del sitio.</span>
        </caption>
        <thead>
          <tr>
            <th scope="col" className={styles.rolesCorner}>
              Rol
            </th>
            {FORMATS.map((t) => (
              <th key={t} scope="col" className={styles.rolesFormat}>
                <FormatGlyph type={t} size={14} />
                <span>{FORMAT_LABEL[t]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row" className={styles.rolesRole}>
                <span className={styles.rolesName}>{r.name}</span>
                <span className={styles.rolesMeaning}>{r.meaning}</span>
              </th>
              {FORMATS.map((t) => {
                const ok = r.can(t)
                return (
                  <td key={t} className={styles.rolesCell} data-ok={ok || undefined}>
                    {ok ? <FormatGlyph type={t} size={15} title={`${r.name}: publica ${FORMAT_LABEL[t].toLowerCase()}`} /> : <span className={styles.rolesNo} aria-label="no" />}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── the living rank (from rankFromCounts) ───────────────────────────────────

function rankEdges(): Array<{ rank: UserRank; from: number; to: number }> {
  const out: Array<{ rank: UserRank; from: number; to: number }> = []
  const N = 1000
  for (let i = 0; i <= N; i++) {
    const r = perm.rankFromCounts(i, N - i)
    const last = out[out.length - 1]
    if (last && last.rank === r) last.to = i / N
    else out.push({ rank: r, from: i / N, to: i / N })
  }
  return out
}

export function Rangos() {
  const edges = rankEdges()
  const pct = (x: number) => `${Math.round(x * 100)}%`
  return (
    <figure className={styles.rangos}>
      <figcaption className={styles.caption}>
        <span className="label">Rango vivo</span>
        <span className={styles.captionNote}>
          Qué parte de las reacciones que recibes son <b>[!]</b>. Con menos de {perm.RANK_THRESHOLD} reacciones eres <b>{RANK_LABEL.normie}</b>, como
          todos al llegar.
        </span>
      </figcaption>
      <div className={styles.scale}>
        {edges.map((e) => (
          <div key={e.rank} className={styles.band} style={{ flexGrow: Math.max(0.001, e.to - e.from) }}>
            <span className={styles.bandBar} aria-hidden="true" />
            <span className={styles.bandName}>
              <RankSigil rank={e.rank} size={14} />
              {RANK_LABEL[e.rank]}
            </span>
            <span className={styles.bandRange}>
              {pct(e.from)}–{pct(e.to)} [!]
            </span>
            <span className={styles.bandMeaning}>{RANK_MEANING[e.rank]}</span>
          </div>
        ))}
      </div>
      <div className={styles.scaleAxis} aria-hidden="true">
        <span>Todo [?]</span>
        <span>Todo [!]</span>
      </div>
    </figure>
  )
}

export function Reacciones() {
  return (
    <div className={styles.reacciones}>
      <div className={styles.reaccion}>
        <span className={styles.reaccionMark}>[!]</span>
        <span className={styles.reaccionName}>Señal</span>
        <span className={styles.reaccionLine}>Algo prende, algo importa, algo detona.</span>
      </div>
      <div className={styles.reaccion}>
        <span className={styles.reaccionMark}>[?]</span>
        <span className={styles.reaccionName}>Duda</span>
        <span className={styles.reaccionLine}>Algo abre una pregunta, algo te perturba.</span>
      </div>
    </div>
  )
}
