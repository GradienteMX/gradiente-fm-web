'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PliegoSection } from '@/components/dashboard/compose/kit/PliegoSection'
import type { Database } from '@/lib/supabase/database.types'
import type { FranjaOption } from '@/app/admin/page'

// ── AdminInviteCodes — the code book, in «EL PLIEGO» chrome ─────────────────
//
// Fase F re-chrome, logic byte-identical: same POST /api/admin/invite-codes
// body, same clipboard copy, same router.refresh(). The generator is now the
// compose pliego's numbered-section register (01 DESTINATARIO · 02 PERMISOS ·
// 03 VIGENCIA) so a long form reads as a printed sheet, and the code book is
// a hairline-ruled paper table with mono uppercase heads.

type InviteCodeRow = Database['public']['Tables']['invite_codes']['Row']
type Role = 'user' | 'curator' | 'guide' | 'insider' | 'admin'

const ROLE_LABEL: Record<Role, string> = {
  user: 'USER · lector',
  curator: 'CURATOR · listas/encuestas',
  guide: 'GUIDE · staff editorial',
  insider: 'INSIDER · escena',
  admin: 'ADMIN · todo',
}

const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

const INPUT_CLS = `min-h-11 w-full border border-ink bg-paper-raised px-3 py-2 font-mono text-d13 text-ink transition-colors placeholder:text-ink-faint focus:bg-white ${FOCUS_RING}`

export function AdminInviteCodes({
  initialCodes,
  franjas,
}: {
  initialCodes: InviteCodeRow[]
  franjas: FranjaOption[]
}) {
  const router = useRouter()

  const [cardName, setCardName] = useState('')
  const [role, setRole] = useState<Role>('user')
  const [isMod, setIsMod] = useState(false)
  const [franjaId, setFranjaId] = useState('')
  const [franjaAdmin, setFranjaAdmin] = useState(false)
  const [expiresInDays, setExpiresInDays] = useState<number | ''>(30)

  // Lookup map for displaying franja titles in the existing-codes table —
  // saves a per-row find() when rendering many rows.
  const franjaById = new Map(franjas.map((p) => [p.id, p]))

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
          card_name: cardName.trim() || null,
          intended_role: role,
          intended_is_mod: isMod,
          intended_franja_id: franjaId.trim() || null,
          intended_franja_admin: franjaAdmin,
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
      setCardName('') // clear the name so the next invitee starts fresh
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
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-ink pb-2">
          <h2 className="font-syne text-d18 font-extrabold uppercase text-ink">
            Generar código
          </h2>
          <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
            INVITE · NEW
          </span>
        </div>

        <form onSubmit={submit} className="grid gap-4">
          <PliegoSection number="01" label="DESTINATARIO" required>
            <Field label="NOMBRE DEL INVITADO" hint="impreso en la tarjeta">
              <input
                type="text"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder="p. ej. Allan · Club Japan · DJ Támara"
                className={INPUT_CLS}
              />
            </Field>
          </PliegoSection>

          <PliegoSection number="02" label="PERMISOS" required>
            <Field label="ROL">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className={INPUT_CLS}
              >
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </Field>

            <CheckRow
              checked={isMod}
              onChange={setIsMod}
              label="MOD"
              description="puede tombstonear comentarios y threads"
            />

            <Field label="FRANJA" hint="opcional">
              <select
                value={franjaId}
                onChange={(e) => {
                  setFranjaId(e.target.value)
                  // Clear franja_admin when no franja is selected — UI hides
                  // the checkbox in that state but keep state coherent too.
                  if (!e.target.value) setFranjaAdmin(false)
                }}
                className={INPUT_CLS}
              >
                <option value="">— ninguno (cuenta individual) —</option>
                {franjas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                    {p.franja_kind ? `  ·  ${p.franja_kind}` : ''}
                  </option>
                ))}
              </select>
            </Field>

            {franjaId.trim() && (
              <CheckRow
                checked={franjaAdmin}
                onChange={setFranjaAdmin}
                label="FRANJA_ADMIN"
                description="puede invitar/expulsar miembros del equipo"
              />
            )}
          </PliegoSection>

          <PliegoSection number="03" label="VIGENCIA">
            <Field label="EXPIRA EN (DÍAS)" hint="vacío = nunca">
              <input
                type="number"
                min={1}
                value={expiresInDays}
                onChange={(e) =>
                  setExpiresInDays(e.target.value === '' ? '' : Number(e.target.value))
                }
                className={INPUT_CLS}
              />
            </Field>
          </PliegoSection>

          {error && (
            <p className="border border-sys-red-paper px-3 py-2 font-mono text-d13 font-bold uppercase tracking-widest text-sys-red-paper">
              ⚠ {error}
            </p>
          )}

          {latestCode && (
            <div className="border border-ink">
              {/* Positive stamp — the acid block with ink on top. */}
              <p className="border-b border-ink bg-acid px-3 py-2 font-mono text-d13 font-bold uppercase tracking-widest text-ink">
                ✓ CÓDIGO GENERADO · CÓPIALO AHORA
              </p>
              <div className="flex flex-wrap items-center gap-2 bg-paper-raised p-3">
                <code className="min-w-0 flex-1 truncate border border-ink bg-paper px-3 py-2 font-mono text-d15 text-ink">
                  {latestCode}
                </code>
                <button
                  type="button"
                  onClick={() => copy(latestCode)}
                  className={`min-h-11 shrink-0 border border-ink px-3 font-mono text-d13 uppercase tracking-widest text-ink hover:bg-ink hover:text-paper ${FOCUS_RING}`}
                >
                  {copied ? '✓ COPIADO' : 'COPIAR'}
                </button>
              </div>
            </div>
          )}

          {/* Primary own-action — acid fill-block, ink on top. */}
          <button
            type="submit"
            disabled={submitting}
            className={`flex min-h-11 items-center justify-between gap-3 border border-ink bg-acid px-4 font-mono text-d13 font-bold uppercase tracking-widest text-ink transition-colors enabled:hover:bg-ink enabled:hover:text-paper disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS_RING}`}
          >
            <span>{submitting ? 'GENERANDO…' : 'GENERAR CÓDIGO'}</span>
            <span aria-hidden>→</span>
          </button>
        </form>
      </section>

      {/* Existing codes table */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-ink pb-2">
          <h2 className="font-syne text-d18 font-extrabold uppercase text-ink">
            Códigos existentes
          </h2>
          <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
            {initialCodes.length} ENTRADAS
          </span>
        </div>

        {initialCodes.length === 0 ? (
          <p className="border border-ink bg-paper-raised px-4 py-6 text-center font-mono text-d13 uppercase tracking-widest text-ink-faint">
            SIN CÓDIGOS GENERADOS TODAVÍA
          </p>
        ) : (
          <div className="overflow-x-auto border border-ink bg-paper-raised">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-ink">
                  <Th>CÓDIGO</Th>
                  <Th>NOMBRE</Th>
                  <Th>ROL</Th>
                  <Th>FOLIO</Th>
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
                    <tr key={c.code}>
                      <Td>
                        <button
                          type="button"
                          onClick={() => copy(c.code)}
                          className={`block min-h-11 max-w-full truncate text-left text-ink underline-offset-4 hover:underline ${FOCUS_RING}`}
                          title="Copiar"
                        >
                          {c.code}
                        </button>
                      </Td>
                      <Td>{c.card_name ?? '—'}</Td>
                      <Td>
                        <span className="uppercase">{c.intended_role}</span>
                      </Td>
                      <Td>
                        <span className="tabular-nums text-ink-soft">
                          {c.folio
                            ? `${String(c.folio).padStart(3, '0')}/${c.folio_denominator}`
                            : '—'}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-ink-soft">
                          {[
                            c.intended_is_mod ? 'MOD' : null,
                            c.intended_franja_admin ? 'PA-ADMIN' : null,
                            // Show the franja's TITLE (not the id) so the
                            // table reads naturally — fall back to the id
                            // if the franja item was deleted later.
                            c.intended_franja_id
                              ? franjaById.get(c.intended_franja_id)?.title ?? c.intended_franja_id
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </span>
                      </Td>
                      <Td>
                        {used ? (
                          <StateChip tone="spent">USADO</StateChip>
                        ) : expired ? (
                          <StateChip tone="red">EXPIRADO</StateChip>
                        ) : (
                          <StateChip tone="ink">ACTIVO</StateChip>
                        )}
                      </Td>
                      <Td>
                        <span className="tabular-nums text-ink-soft">
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
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="font-mono text-d11 uppercase tracking-widest text-ink-soft">
        {label}
        {hint && <span className="ml-2 normal-case tracking-normal text-ink-faint">— {hint}</span>}
      </span>
      {children}
    </label>
  )
}

// A checkbox row sized to the 44px floor, with the flag name in the mono
// register and the capability spelled out in grotesk underneath.
function CheckRow({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  description: string
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 border border-ink bg-paper px-3 py-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={`mt-0.5 h-4 w-4 shrink-0 accent-ink ${FOCUS_RING}`}
      />
      <span className="min-w-0">
        <span className="block font-mono text-d13 font-bold uppercase tracking-widest text-ink">
          {label}
        </span>
        <span className="block font-grotesk text-d13 leading-snug text-ink-soft">
          {description}
        </span>
      </span>
    </label>
  )
}

function StateChip({
  children,
  tone,
}: {
  children: React.ReactNode
  tone: 'ink' | 'red' | 'spent'
}) {
  const cls =
    tone === 'red'
      ? 'border-sys-red-paper text-sys-red-paper'
      : tone === 'spent'
      ? 'border-ink/25 text-ink-faint'
      : 'border-ink text-ink'
  return (
    <span
      className={`inline-block whitespace-nowrap border px-2 py-1 font-mono text-d11 font-bold uppercase tracking-widest ${cls}`}
    >
      {children}
    </span>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="px-3 py-2 text-left font-mono text-d11 font-bold uppercase tracking-widest text-ink-faint"
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
