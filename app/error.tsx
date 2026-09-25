'use client'

import { Falla } from '@/components/casa/Falla'

/** Route-segment error boundary: honest copy, a working retry, a way home. */
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <Falla error={error} retry={retry} />
}
