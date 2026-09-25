'use client'

/**
 * LA PUERTA — /welcome.
 *
 * The door as it was: an ivory eye in a printed field, the grotesque face
 * in it, the boxed wordmark, one dark panel with the ways in — iniciar
 * sesión, acceso por invitación, and the acid bar onto the waitlist — and
 * the address in the corner. The field behind (Umbral) prints in the
 * house's patterns and answers the door:
 *
 *   gate      the ways in
 *   entrar    an identity (the shared Identidad panel, in the console)
 *   código    each keystroke sends a ring of print out from the eye; a
 *             complete-looking code is looked up on the server; an unknown
 *             one goes cold
 *   espera    the inline waitlist (the same row as /espera)
 *   valid     the eye opens; the Credencial arrives in its invitation state
 *             (name, role, folio, issued) and the registration sheet rises
 *   signed    the same card becomes public, a flare, and into the field
 *
 * Anonymous visitors hold no world: the code is resolved by the server
 * (`peek_invite_card`, one code in, its card out — lib/invitations), the
 * identity is minted by `/api/auth/signup`, and the field is entered with a
 * full load so the server hands over the new person's world.
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import Link from 'next/link'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { useMe } from '@/lib/store/session'
import { useUI } from '@/lib/store/ui'
import { useReducedMotion } from '@/lib/useMedia'
import { peekInviteCard, type InviteCard } from '@/lib/invitations'
import { signUp } from '@/lib/auth/client'
import { flare } from '@/components/stage/api'
import { Wordmark } from '@/components/shell/Wordmark'
import { ROLE_LABEL } from '@/components/kit/Persona'
import { Credencial, type CredencialHandle } from '@/components/credencial/Credencial'
import { credencialForInvite, ROLE_HUE } from '@/components/credencial/data'
import { Umbral, type UmbralHandle } from './Umbral'
import { CODE_MESSAGE as MESSAGE, CODE_SHAPE, codeStatusOf, displayCode as display, type CodeStatus as Status } from './codigo'
import { ListaEspera } from './ListaEspera'
import { Identidad } from '@/components/acceso/Identidad'
import { Cabeza } from '@/components/acceso/Cabeza'
import { LIBREA_SECCION } from '@/lib/librea'
import { Registro, type RegistroValues } from './Registro'
import styles from './Puerta.module.css'

type Phase = 'codigo' | 'abriendo' | 'registro' | 'hecho'
type Panel = 'gate' | 'entrar' | 'codigo' | 'espera'

/** A complete-looking code is looked up once typing pauses this long. */
const LOOKUP_PAUSE_MS = 450

/**
 * Into the field with a full document load, not a client navigation: the
 * root layout (a shared segment a soft navigation never re-renders) has to be
 * read again with the new session so the server hands over this person's
 * world. `replace`: the door doesn't stay behind in history.
 */
function enterField() {
  window.location.replace('/')
}

export function Puerta({ initialCode }: { initialCode: string }) {
  const me = useMe()
  const openAccess = useUI((s) => s.openAccess)

  const [panel, setPanel] = useState<Panel>(initialCode ? 'codigo' : 'gate')
  const [code, setCode] = useState(() => display(initialCode))
  const [status, setStatus] = useState<Status>(initialCode ? 'verificando' : 'vacio')
  const [phase, setPhase] = useState<Phase>('codigo')
  const [invite, setInvite] = useState<InviteCard | null>(null)
  const [handle, setHandle] = useState('')
  const [created, setCreated] = useState<{ username: string } | null>(null)
  const [sending, setSending] = useState(false)
  const [signupError, setSignupError] = useState<string | null>(null)
  const reduced = useReducedMotion()

  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const umbral = useRef<UmbralHandle>(null)
  const cardRef = useRef<CredencialHandle>(null)
  const cardColRef = useRef<HTMLDivElement>(null)
  const formColRef = useRef<HTMLDivElement>(null)
  const openedRef = useRef(false)
  /** Only the latest lookup may answer (a slow reply never overwrites a newer code). */
  const lookupSeq = useRef(0)
  const pause = useRef<number | null>(null)

  const team = invite?.franja?.title ?? null

  const openDoor = useCallback((inv: InviteCard) => {
    if (openedRef.current) return
    openedRef.current = true
    setInvite(inv)
    setStatus('valido')
    setPhase('abriendo')
    inputRef.current?.blur()
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.setTimeout(
      () => {
        flare(formRef.current, ROLE_HUE[inv.role].center)
        umbral.current?.open()
        window.setTimeout(() => setPhase('registro'), still ? 0 : 950)
      },
      still ? 0 : 420,
    )
  }, [])

  /** Ask the server what this code is. Every answer but «valid» is shown as it is. */
  const lookup = useCallback(
    async (raw: string) => {
      const n = ++lookupSeq.current
      setStatus('verificando')
      const card = await peekInviteCard(raw)
      if (n !== lookupSeq.current || openedRef.current) return
      const st = codeStatusOf(card.status, card.error)
      if (st === 'valido') return openDoor(card)
      setStatus(st)
      setInvite(card.status === 'invalid' ? null : card)
      umbral.current?.shudder()
    },
    [openDoor],
  )

  // A code that came in the URL gets a beat so the door is seen before it opens.
  useEffect(() => {
    if (!initialCode) return
    const t = window.setTimeout(() => void lookup(display(initialCode)), 700)
    return () => window.clearTimeout(t)
  }, [initialCode, lookup])

  useEffect(
    () => () => {
      if (pause.current) window.clearTimeout(pause.current)
    },
    [],
  )

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (phase !== 'codigo') return
    const next = display(e.target.value)
    if (next.length !== code.length) umbral.current?.pulse()
    setCode(next)
    lookupSeq.current++
    if (pause.current) window.clearTimeout(pause.current)
    if (!next) return setStatus('vacio')
    if (!CODE_SHAPE.test(next)) return setStatus('escribiendo')
    setStatus('verificando')
    pause.current = window.setTimeout(() => void lookup(next), LOOKUP_PAUSE_MS)
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (phase !== 'codigo') return
    if (pause.current) window.clearTimeout(pause.current)
    if (!code) {
      umbral.current?.shudder()
      setStatus('vacio')
      inputRef.current?.focus()
      return
    }
    void lookup(code)
  }

  const toGate = () => {
    if (phase !== 'codigo') return
    setPanel('gate')
  }

  const cardData = useMemo(() => {
    if (!invite) return null
    return credencialForInvite({ invite, team, handle: created?.username ?? handle, minted: Boolean(created) })
  }, [invite, team, handle, created])

  const create = async (v: RegistroValues) => {
    if (!invite || created || sending) return
    setSending(true)
    setSignupError(null)
    const res = await signUp({ email: v.email, password: v.password, username: v.username, inviteCode: invite.code })
    setSending(false)
    if (!res.ok) {
      setSignupError(res.error)
      return
    }
    setCreated({ username: v.username })
    setPhase('hecho')
    flare(cardRef.current?.el, ROLE_HUE[invite.role].center)
    window.setTimeout(enterField, reduced ? 500 : 1700)
  }

  // Registration: the card lands in the opened eye, then steps aside as the
  // sheet rises.
  useLayoutEffect(() => {
    if (phase !== 'registro') return
    const card = cardColRef.current
    const form = formColRef.current
    if (!card || !form) return
    const r = card.getBoundingClientRect()
    // the eye travels with the card, so it lands (captions and all) in ivory
    umbral.current?.aim((r.left + r.width / 2) / window.innerWidth, (r.top + r.height / 2) / window.innerHeight, { delay: 1.15, duration: 1.15 })
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const dx = window.innerWidth * 0.48 - (r.left + r.width / 2)
    const dy = window.innerHeight * 0.45 - (r.top + r.height / 2)
    const tl = gsap.timeline()
    tl.fromTo(card, { x: dx, y: dy }, { x: 0, y: 0, duration: 1.15, ease: 'expo.inOut', delay: 1.15, clearProps: 'transform' })
    tl.fromTo(form, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.95, ease: 'expo.out', clearProps: 'opacity,transform' }, '-=0.55')
    return () => {
      tl.progress(1).kill()
    }
  }, [phase])

  const bad = status === 'usado' || status === 'expirado' || status === 'desconocido' || status === 'sin-red'
  const inRegistro = phase === 'registro' || phase === 'hecho'

  return (
    <div className={styles.puerta} data-phase={phase} data-panel={panel} data-ruta="puerta">
      <Umbral ref={umbral} />

      <header className={styles.top}>
        <Link href="/" className={styles.brand} aria-label="Gradiente — el campo">
          <Wordmark size="md" />
        </Link>
      </header>

      {!inRegistro ? (
        <main className={styles.gate} data-form={panel !== 'gate' || undefined}>
          <div className={styles.faceSlot}>
            <Image className={styles.face} src="/welcome/grotesco-face.png" width={794} height={782} alt="Gradiente · subsistema cultural" priority />
          </div>

          <div className={styles.console}>
            {me ? (
              <p className={styles.dentro}>
                Dentro como <b>@{me.username}</b> ·{' '}
                <Link href="/" className={styles.dentroLink}>
                  ir al campo →
                </Link>
              </p>
            ) : null}

            {panel === 'gate' ? (
              <>
                <div className={styles.ways}>
                  <button type="button" className={styles.way} onClick={() => setPanel('entrar')}>
                    Iniciar sesión
                  </button>
                  <button type="button" className={styles.way} onClick={() => setPanel('codigo')}>
                    Acceso por invitación
                  </button>
                </div>
                <button type="button" className={styles.acid} onClick={() => setPanel('espera')}>
                  <span>¿Sin código? — Unirme a la lista de espera</span>
                  <span aria-hidden="true">→</span>
                </button>
              </>
            ) : panel === 'codigo' ? (
              <section className={styles.sheet} aria-labelledby="puerta-codigo-h">
                <Cabeza librea={LIBREA_SECCION.puerta} band="dial" title="Insertar código" titleId="puerta-codigo-h" chip={{ label: 'Volver', onClick: toGate, disabled: phase !== 'codigo' }} />
                <div className={styles.sheetBody}>
                  <p className={styles.copy}>El código de tu invitación, tal como llegó.</p>
                  <form ref={formRef} onSubmit={onSubmit} data-state={status} noValidate>
                    <div className={styles.f}>
                      <label htmlFor="puerta-codigo">Código de invitación</label>
                      <input
                        id="puerta-codigo"
                        ref={inputRef}
                        className={styles.codeInput}
                        value={code}
                        onChange={onChange}
                        placeholder="INV-XXXXXXXX"
                        autoComplete="off"
                        autoCapitalize="characters"
                        autoCorrect="off"
                        spellCheck={false}
                        inputMode="text"
                        aria-invalid={bad || undefined}
                        aria-describedby="puerta-estado"
                        readOnly={phase !== 'codigo'}
                        autoFocus={!initialCode}
                      />
                    </div>
                    <p id="puerta-estado" className={styles.status} data-tone={bad ? 'cold' : status === 'valido' ? 'open' : undefined} aria-live="polite">
                      {MESSAGE[status]}
                    </p>
                    {status === 'usado' ? (
                      <button type="button" className={styles.aside} onClick={() => setPanel('entrar')}>
                        ¿Es tuyo? Entra con tu identidad
                      </button>
                    ) : status === 'expirado' ? (
                      <Link href="/espera" className={styles.aside}>
                        Pide otro código, o únete a la espera
                      </Link>
                    ) : null}
                    <button type="submit" className={styles.go} disabled={phase !== 'codigo'}>
                      <span>{status === 'valido' ? 'Abriendo…' : 'Activar código'}</span>
                      <span aria-hidden="true">→</span>
                    </button>
                  </form>
                </div>
              </section>
            ) : panel === 'entrar' ? (
              <Identidad variant="puerta" onClose={() => setPanel('gate')} onCodigo={() => setPanel('codigo')} onDone={enterField} />
            ) : (
              <ListaEspera onBack={() => setPanel('gate')} />
            )}
          </div>
        </main>
      ) : invite && cardData ? (
        <main className={styles.registro}>
          <div ref={cardColRef} className={styles.cardCol}>
            <Credencial
              ref={cardRef}
              data={cardData}
              arrive
              hint={created ? 'Tu credencial. Arrástrala para girarla, tócala para voltearla.' : 'Tu invitación. Arrástrala o tócala: al reverso, el código.'}
              hintBack="Arrástrala o tócala para volver al frente."
            />
            <p className={styles.cardNote} aria-live="polite">
              {created
                ? `Credencial pública de @${created.username}.`
                : `Invitación válida · ${ROLE_LABEL[invite.role]}${invite.folio ? ` · folio ${invite.folio} de la invitación` : ''}.`}
            </p>
          </div>
          <div ref={formColRef} className={styles.formCol}>
            <Registro
              invite={invite}
              team={team}
              onHandle={setHandle}
              onSubmit={create}
              onEnter={() => openAccess(undefined, 'entrar')}
              done={created}
              sending={sending}
              error={signupError}
              focusDelay={reduced ? 0 : 2300}
            />
          </div>
        </main>
      ) : null}

      <footer className={styles.bottom}>
        <p>gradiente.org</p>
      </footer>
    </div>
  )
}
