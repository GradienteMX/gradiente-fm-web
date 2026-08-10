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

const STATE_STYLE: Record<Derived, { label: string; color: string }> = {
  pendiente: { label: 'PENDIENTE', color: '#F97316' },
  invitado: { label: 'INVITADO', color: '#F59E0B' },
  registrado: { label: 'REGISTRADO', color: '#4ADE80' },
}

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
      <div className="flex items-baseline justify-between">
        <h2 className="font-syne text-xl font-bold text-primary">LISTA DE ESPERA</h2>
        <span className="sys-label">{counts.total} SEÑALES</span>
      </div>

      {/* Stats chips */}
      <div className="flex flex-wrap gap-2 font-mono text-[10px] tracking-widest">
        <Chip label={`TOTAL ${counts.total}`} color="#888888" />
        <Chip label={`PENDIENTES ${counts.pendiente}`} color="#F97316" />
        <Chip label={`INVITADOS ${counts.invitado}`} color="#F59E0B" />
        <Chip label={`REGISTRADOS ${counts.registrado}`} color="#4ADE80" />
      </div>

      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="FILTRAR POR EMAIL / ALIAS / CIUDAD…"
        className="border bg-black px-3 py-2 font-mono text-sm text-primary outline-none focus:border-sys-orange"
        style={{ borderColor: '#242424' }}
      />

      {error && (
        <div
          className="border px-3 py-2 font-mono text-[10px] tracking-widest"
          style={{ borderColor: '#E63329', color: '#E63329' }}
        >
          {error}
        </div>
      )}

      {visible.length === 0 ? (
        <p
          className="border bg-base px-4 py-6 text-center font-mono text-[11px] text-muted"
          style={{ borderColor: '#242424' }}
        >
          {rows.length === 0
            ? '// SIN SEÑALES TODAVÍA — LA LISTA DE ESPERA ESTÁ VACÍA'
            : '// NADA COINCIDE CON EL FILTRO'}
        </p>
      ) : (
        <div className="overflow-x-auto border" style={{ borderColor: '#242424' }}>
          <table className="w-full font-mono text-[11px]">
            <thead>
              <tr className="border-b" style={{ borderColor: '#242424' }}>
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
                  <tr key={r.id} className="border-b" style={{ borderColor: '#1a1a1a' }}>
                    <Td>
                      <span className="tabular-nums text-muted">
                        {String(pos).padStart(3, '0')}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-primary">{r.alias || '—'}</span>
                    </Td>
                    <Td>
                      <span className="text-secondary">{r.email}</span>
                    </Td>
                    <Td>
                      <span className="text-muted">{r.city ?? '—'}</span>
                    </Td>
                    <Td>
                      <span className="text-muted">{r.source ?? '—'}</span>
                    </Td>
                    <Td>
                      <span className="tabular-nums text-muted">
                        {new Date(r.created_at).toLocaleDateString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </span>
                    </Td>
                    <Td>
                      <span
                        className="border px-1.5 py-0.5 text-[9px] tracking-widest"
                        style={{ borderColor: st.color, color: st.color }}
                      >
                        {st.label}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        {state === 'pendiente' && (
                          <ActionButton
                            onClick={() => generar(r.id)}
                            disabled={busyId === r.id}
                            color="#F97316"
                          >
                            {busyId === r.id ? '▶ GENERANDO…' : '▶ GENERAR CÓDIGO'}
                          </ActionButton>
                        )}
                        {state !== 'pendiente' && r.invite_code && (
                          <ActionButton onClick={() => copyLink(r)} color="#4ADE80">
                            {copiedId === r.id ? '✓ COPIADO' : 'COPIAR ENLACE'}
                          </ActionButton>
                        )}
                        <ActionButton
                          onClick={() => borrar(r.id)}
                          disabled={busyId === r.id}
                          color={confirmId === r.id ? '#E63329' : '#4A4A4A'}
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

      <p className="font-mono text-[10px] leading-relaxed tracking-widest text-muted">
        &gt; GENERAR CÓDIGO crea una invitación real (folio continuo, expira en
        30 días) y marca la entrada como INVITADO. COPIAR ENLACE entrega el
        deep-link /welcome?codigo=… para enviarlo por el canal que sea.
        REGISTRADO se deriva del código canjeado.
      </p>
    </section>
  )
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span className="border px-2 py-1" style={{ borderColor: color, color }}>
      {label}
    </span>
  )
}

function ActionButton({
  children,
  onClick,
  disabled = false,
  color,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  color: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="whitespace-nowrap border px-2 py-1 text-[9px] tracking-widest transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
      style={{ borderColor: color, color }}
    >
      {children}
    </button>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left text-[9px] tracking-widest text-muted">{children}</th>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2">{children}</td>
}
