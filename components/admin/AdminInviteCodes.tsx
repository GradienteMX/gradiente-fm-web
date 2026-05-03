'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Database } from '@/lib/supabase/database.types'
import type { PartnerOption } from '@/app/admin/page'

type InviteCodeRow = Database['public']['Tables']['invite_codes']['Row']
type Role = 'user' | 'curator' | 'guide' | 'insider' | 'admin'

const ROLE_LABEL: Record<Role, string> = {
  user: 'USER · lector',
  curator: 'CURATOR · listas/encuestas',
  guide: 'GUIDE · staff editorial',
  insider: 'INSIDER · escena',
  admin: 'ADMIN · todo',
}

export function AdminInviteCodes({
  initialCodes,
  partners,
}: {
  initialCodes: InviteCodeRow[]
  partners: PartnerOption[]
}) {
  const router = useRouter()

  const [role, setRole] = useState<Role>('user')
  const [isMod, setIsMod] = useState(false)
  const [partnerId, setPartnerId] = useState('')
  const [partnerAdmin, setPartnerAdmin] = useState(false)
  const [expiresInDays, setExpiresInDays] = useState<number | ''>(30)

  // Lookup map for displaying partner titles in the existing-codes table —
  // saves a per-row find() when rendering many rows.
  const partnerById = new Map(partners.map((p) => [p.id, p]))

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [latestCode, setLatestCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLatestCode(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/invite-codes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          intended_role: role,
          intended_is_mod: isMod,
          intended_partner_id: partnerId.trim() || null,
          intended_partner_admin: partnerAdmin,
          expires_in_days: expiresInDays === '' ? null : Number(expiresInDays),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Failed' }))
        setError(body.error?.toString().toUpperCase() ?? 'FAILED')
        return
      }
      const json = await res.json()
      setLatestCode(json.code.code)
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* noop */
    }
  }

  return (
    <>
      {/* Generator */}
      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-syne text-xl font-bold text-primary">GENERAR CÓDIGO</h2>
          <span className="sys-label">INVITE·NEW</span>
        </div>

        <form
          onSubmit={submit}
          className="flex flex-col gap-4 border bg-base p-4"
          style={{ borderColor: '#242424' }}
        >
          <Field label="ROL">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="border bg-black px-3 py-2 font-mono text-sm text-primary outline-none focus:border-sys-orange"
              style={{ borderColor: '#242424' }}
            >
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </Field>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isMod}
              onChange={(e) => setIsMod(e.target.checked)}
            />
            <span className="font-mono text-[11px] text-secondary">
              Marcar como <span className="text-primary">MOD</span> (puede tombstonear comentarios y threads)
            </span>
          </label>

          <Field label="PARTNER (opcional)">
            <select
              value={partnerId}
              onChange={(e) => {
                setPartnerId(e.target.value)
                // Clear partner_admin when no partner is selected — UI hides
                // the checkbox in that state but keep state coherent too.
                if (!e.target.value) setPartnerAdmin(false)
              }}
              className="border bg-black px-3 py-2 font-mono text-sm text-primary outline-none focus:border-sys-orange"
              style={{ borderColor: '#242424' }}
            >
              <option value="">— ninguno (cuenta individual) —</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                  {p.partner_kind ? `  ·  ${p.partner_kind}` : ''}
                </option>
              ))}
            </select>
          </Field>

          {partnerId.trim() && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={partnerAdmin}
                onChange={(e) => setPartnerAdmin(e.target.checked)}
              />
              <span className="font-mono text-[11px] text-secondary">
                <span className="text-primary">PARTNER_ADMIN</span> (puede invitar/expulsar miembros del equipo)
              </span>
            </label>
          )}

          <Field label="EXPIRA EN (días, vacío = nunca)">
            <input
              type="number"
              min={1}
              value={expiresInDays}
              onChange={(e) =>
                setExpiresInDays(e.target.value === '' ? '' : Number(e.target.value))
              }
              className="border bg-black px-3 py-2 font-mono text-sm text-primary outline-none focus:border-sys-orange"
              style={{ borderColor: '#242424' }}
            />
          </Field>

          {error && (
            <div
              className="border px-3 py-2 font-mono text-[10px] tracking-widest"
              style={{ borderColor: '#E63329', color: '#E63329' }}
            >
              {error}
            </div>
          )}

          {latestCode && (
            <div
              className="flex flex-col gap-2 border px-4 py-3"
              style={{
                borderColor: '#4ADE80',
                backgroundColor: '#4ADE8010',
              }}
            >
              <span className="font-mono text-[10px] tracking-widest" style={{ color: '#4ADE80' }}>
                ✓ CÓDIGO GENERADO · CÓPIALO AHORA
              </span>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate border bg-black px-3 py-2 font-mono text-sm text-primary"
                  style={{ borderColor: '#242424' }}>
                  {latestCode}
                </code>
                <button
                  type="button"
                  onClick={() => copy(latestCode)}
                  className="border px-3 py-2 font-mono text-[10px] tracking-widest text-secondary transition-colors hover:text-primary"
                  style={{ borderColor: '#242424' }}
                >
                  {copied ? '✓ COPIADO' : 'COPIAR'}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="border px-4 py-2.5 font-mono text-[11px] tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              borderColor: '#F97316',
              color: '#F97316',
              backgroundColor: 'rgba(249,115,22,0.08)',
            }}
          >
            {submitting ? '▶ GENERANDO…' : '▶ GENERAR'}
          </button>
        </form>
      </section>

      {/* Existing codes table */}
      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-syne text-xl font-bold text-primary">
            CÓDIGOS EXISTENTES
          </h2>
          <span className="sys-label">{initialCodes.length} ENTRADAS</span>
        </div>

        {initialCodes.length === 0 ? (
          <p className="border bg-base px-4 py-6 text-center font-mono text-[11px] text-muted"
             style={{ borderColor: '#242424' }}>
            // SIN CÓDIGOS GENERADOS TODAVÍA
          </p>
        ) : (
          <div className="overflow-x-auto border" style={{ borderColor: '#242424' }}>
            <table className="w-full font-mono text-[11px]">
              <thead>
                <tr className="border-b" style={{ borderColor: '#242424' }}>
                  <Th>CÓDIGO</Th>
                  <Th>ROL</Th>
                  <Th>FLAGS</Th>
                  <Th>ESTADO</Th>
                  <Th>EXPIRA</Th>
                </tr>
              </thead>
              <tbody>
                {initialCodes.map((c) => {
                  const used = !!c.used_at
                  const expired =
                    c.expires_at !== null && new Date(c.expires_at) < new Date()
                  return (
                    <tr
                      key={c.code}
                      className="border-b"
                      style={{ borderColor: '#1a1a1a' }}
                    >
                      <Td>
                        <button
                          type="button"
                          onClick={() => copy(c.code)}
                          className="truncate text-left text-primary transition-colors hover:text-sys-orange"
                          title="Copiar"
                        >
                          {c.code}
                        </button>
                      </Td>
                      <Td>
                        <span className="text-secondary uppercase">{c.intended_role}</span>
                      </Td>
                      <Td>
                        <span className="text-muted">
                          {[
                            c.intended_is_mod ? 'MOD' : null,
                            c.intended_partner_admin ? 'PA-ADMIN' : null,
                            // Show the partner's TITLE (not the id) so the
                            // table reads naturally — fall back to the id
                            // if the partner item was deleted later.
                            c.intended_partner_id
                              ? partnerById.get(c.intended_partner_id)?.title ?? c.intended_partner_id
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </span>
                      </Td>
                      <Td>
                        {used ? (
                          <span style={{ color: '#9CA3AF' }}>USADO</span>
                        ) : expired ? (
                          <span style={{ color: '#E63329' }}>EXPIRADO</span>
                        ) : (
                          <span style={{ color: '#4ADE80' }}>ACTIVO</span>
                        )}
                      </Td>
                      <Td>
                        <span className="text-muted">
                          {c.expires_at
                            ? new Date(c.expires_at).toISOString().slice(0, 10)
                            : 'nunca'}
                        </span>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="sys-label">{label}</span>
      {children}
    </label>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-widest text-muted">
      {children}
    </th>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2">{children}</td>
}
