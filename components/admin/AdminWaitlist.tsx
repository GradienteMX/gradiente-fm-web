'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

// //ESPERA — admin view of the public waitlist (/espera signups).
//
// Queue-ordered table with a per-row GENERAR CÓDIGO action that mints a real
// invite code (via /api/admin/waitlist) and hands back a copyable deep link
// (/welcome?codigo=INV-…). Sending the link is manual for now — DM, mail,
// whatever channel fits the personal-beta posture; automated email delivery
// is a later slice.
//
// Status is three-state but only two are STORED: pending → invited live on
// the row; "REGISTRADO" is derived from the joined invite code's used_at
// (the signup trigger marks codes used — no second write path here).
//
// «EL PLIEGO» chrome (fase F): paper table, ink hairline rules, mono
// uppercase heads. The queue state is carried by chip WEIGHT (faint hairline
// → ink hairline → ink fill), not by colour; only the destructive BORRAR
// speaks in sys-red-paper. Fetches, the two-click delete arming and the
// clipboard deep link are untouched.

export interface WaitlistAdminRow {
  id: string
  email: string
  alias: string
  city: string | null
  source: string | null
  status: string
  invite_code: string | null
  invited_at: string | null
  created_at: string
  invite: { used_at: string | null } | null
}

type Derived = 'pendiente' | 'invitado' | 'registrado'

function deriveState(r: WaitlistAdminRow): Derived {
  if (r.invite?.used_at) return 'registrado'
  if (r.status === 'invited') return 'invitado'
  return 'pendiente'
}

// Weight, not hue: nothing has happened yet → faint; code minted → hairline;
// account created → the ink fill of a closed loop.
const STATE_STYLE: Record<Derived, { label: string; cls: string }> = {
  pendiente: { label: 'PENDIENTE', cls: 'border-ink/25 text-ink-faint' },
  invitado: { label: 'INVITADO', cls: 'border-ink text-ink' },
  registrado: { label: 'REGISTRADO', cls: 'border-ink bg-ink text-paper' },
}

const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

export function AdminWaitlist({ initialRows }: { initialRows: WaitlistAdminRow[] }) {
  const router = useRouter()
  const [rows, setRows] = useState(initialRows)
  const [filter, setFilter] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const counts = useMemo(() => {
    const c = { total: rows.length, pendiente: 0, invitado: 0, registrado: 0 }
    for (const r of rows) c[deriveState(r)]++
    return c
  }, [rows])

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.email.toLowerCase().includes(q) ||
        r.alias.toLowerCase().includes(q) ||
        (r.city ?? '').toLowerCase().includes(q),
    )
  }, [rows, filter])

  const generar = async (id: string) => {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch('/api/admin/waitlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((json.error ?? 'FALLÓ LA GENERACIÓN').toString().toUpperCase())
        return
      }
      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status: 'invited',
                invite_code: json.code as string,
                invited_at: new Date().toISOString(),
              }
            : r,
        ),
      )
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  const copyLink = async (row: WaitlistAdminRow) => {
    if (!row.invite_code) return
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/welcome?codigo=${encodeURIComponent(row.invite_code)}`,
      )
      setCopiedId(row.id)
      setTimeout(() => setCopiedId((v) => (v === row.id ? null : v)), 1600)
    } catch {
      /* clipboard blocked — noop */
    }
  }

  // Two-click delete: first click arms (¿SEGURO?), second click within 3s
  // deletes. No modal dependency, no accidental single-click wipes.
  const borrar = async (id: string) => {
    if (confirmId !== id) {
      setConfirmId(id)
      setTimeout(() => setConfirmId((v) => (v === id ? null : v)), 3000)
      return
    }
    setConfirmId(null)
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch('/api/admin/waitlist', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError((json.error ?? 'NO SE PUDO BORRAR').toString().toUpperCase())
        return
      }
      setRows((prev) => prev.filter((r) => r.id !== id))
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-ink pb-2">
        <h2 className="font-syne text-d18 font-extrabold uppercase text-ink">
          Lista de espera
        </h2>
        <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
          {counts.total} SEÑALES
        </span>
      </div>

      {/* Counts — real numbers derived from the loaded rows. */}
      <div className="flex flex-wrap gap-2">
        <Chip label="TOTAL" value={counts.total} />
        <Chip label="PENDIENTES" value={counts.pendiente} />
        <Chip label="INVITADOS" value={counts.invitado} />
        <Chip label="REGISTRADOS" value={counts.registrado} />
      </div>

      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="FILTRAR POR EMAIL / ALIAS / CIUDAD…"
        aria-label="Filtrar lista de espera"
        className={`min-h-11 w-full border border-ink bg-paper-raised px-3 py-2 font-mono text-d13 text-ink transition-colors placeholder:text-ink-faint focus:bg-white ${FOCUS_RING}`}
      />

      {error && (
        <p className="border border-sys-red-paper px-3 py-2 font-mono text-d13 font-bold uppercase tracking-widest text-sys-red-paper">
          ⚠ {error}
        </p>
      )}

      {visible.length === 0 ? (
        <p className="border border-ink bg-paper-raised px-4 py-6 text-center font-mono text-d13 uppercase tracking-widest text-ink-faint">
          {rows.length === 0
            ? 'SIN SEÑALES TODAVÍA — LA LISTA DE ESPERA ESTÁ VACÍA'
            : 'NADA COINCIDE CON EL FILTRO'}
        </p>
      ) : (
        <div className="overflow-x-auto border border-ink bg-paper-raised">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-ink">
                <Th>#</Th>
                <Th>ALIAS</Th>
                <Th>EMAIL</Th>
                <Th>CIUDAD</Th>
                <Th>ORIGEN</Th>
                <Th>FECHA</Th>
                <Th>ESTADO</Th>
                <Th>ACCIONES</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const state = deriveState(r)
                const st = STATE_STYLE[state]
                // Queue position within the FULL list (not the filtered view).
                const pos = rows.indexOf(r) + 1
                return (
                  <tr key={r.id}>
                    <Td>
                      <span className="tabular-nums text-ink-faint">
                        {String(pos).padStart(3, '0')}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-ink">{r.alias || '—'}</span>
                    </Td>
                    <Td>
                      <span className="text-ink-soft">{r.email}</span>
                    </Td>
                    <Td>
                      <span className="text-ink-soft">{r.city ?? '—'}</span>
                    </Td>
                    <Td>
                      <span className="text-ink-soft">{r.source ?? '—'}</span>
                    </Td>
                    <Td>
                      <span className="tabular-nums text-ink-soft">
                        {new Date(r.created_at).toLocaleDateString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </span>
                    </Td>
                    <Td>
                      <span
                        className={`inline-block whitespace-nowrap border px-2 py-1 font-mono text-d11 font-bold uppercase tracking-widest ${st.cls}`}
                      >
                        {st.label}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {state === 'pendiente' && (
                          <ActionButton
                            onClick={() => generar(r.id)}
                            disabled={busyId === r.id}
                            tone="filled"
                          >
                            {busyId === r.id ? 'GENERANDO…' : 'GENERAR CÓDIGO'}
                          </ActionButton>
                        )}
                        {state !== 'pendiente' && r.invite_code && (
                          <ActionButton onClick={() => copyLink(r)}>
                            {copiedId === r.id ? '✓ COPIADO' : 'COPIAR ENLACE'}
                          </ActionButton>
                        )}
                        {/* Two-state escalation: hairline while idle, a red
                            fill once armed — the arming is visible, not
                            just verbal. */}
                        <ActionButton
                          onClick={() => borrar(r.id)}
                          disabled={busyId === r.id}
                          tone={confirmId === r.id ? 'red' : 'ink'}
                        >
                          {confirmId === r.id ? '¿SEGURO?' : 'BORRAR'}
                        </ActionButton>
                      </div>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="border border-dashed border-ink/45 p-4 font-grotesk text-d13 leading-relaxed text-ink-soft">
        GENERAR CÓDIGO crea una invitación real (folio continuo, expira en 30
        días) y marca la entrada como INVITADO. COPIAR ENLACE entrega el
        deep-link /welcome?codigo=… para enviarlo por el canal que sea.
        REGISTRADO se deriva del código canjeado.
      </p>
    </section>
  )
}

function Chip({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-2 border border-ink px-2 py-1 font-mono text-d11 font-bold uppercase tracking-widest text-ink">
      {label}
      <span className="tabular-nums text-ink-soft">{value}</span>
    </span>
  )
}

function ActionButton({
  children,
  onClick,
  disabled = false,
  tone = 'ink',
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  tone?: 'ink' | 'filled' | 'red'
}) {
  const tones = {
    ink: 'border-ink text-ink hover:bg-ink hover:text-paper',
    filled: 'border-ink bg-ink text-paper hover:bg-paper hover:text-ink',
    red: 'border-sys-red-paper bg-sys-red-paper text-paper hover:bg-paper hover:text-sys-red-paper',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-11 items-center whitespace-nowrap border px-3 font-mono text-d11 font-bold uppercase tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]} ${FOCUS_RING}`}
    >
      {children}
    </button>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="whitespace-nowrap px-3 py-2 text-left font-mono text-d11 font-bold uppercase tracking-widest text-ink-faint"
    >
      {children}
    </th>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="border-b border-ink/15 px-3 py-2 align-middle font-mono text-d13 text-ink">
      {children}
    </td>
  )
}
