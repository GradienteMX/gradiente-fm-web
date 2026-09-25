'use client'

/**
 * ACCESO — the gate for anything that writes, wherever it's asked for.
 * Gradiente is invite-only: you enter with an identity, or you bring a
 * code — and a code always opens in La Puerta, the one way to sign up. The
 * panel itself (Identidad) is shared with the door; here it lives in a
 * sheet. Entering sets the session cookie; the page is then read again
 * (router.refresh) so the server hands over the viewer's world in place.
 */

import { useRouter } from 'next/navigation'
import { useUI } from '@/lib/store/ui'
import { Sheet } from '@/components/kit/Sheet'
import { Identidad } from '@/components/acceso/Identidad'

export function Acceso() {
  const router = useRouter()
  const access = useUI((s) => s.access)
  const close = useUI((s) => s.closeAccess)
  // Anchored high: switching modes changes its height, and it must not jump.
  return (
    <Sheet open={Boolean(access)} onClose={close} label="Acceso" width={700} variant="top">
      {access ? (
        <Identidad
          variant="hoja"
          initialMode={access.mode === 'registro' ? 'codigo' : 'entrar'}
          reason={access.reason}
          onDone={() => {
            router.refresh()
            close()
          }}
          onClose={close}
        />
      ) : null}
    </Sheet>
  )
}
